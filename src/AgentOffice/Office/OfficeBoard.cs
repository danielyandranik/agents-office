using AgentOffice.Agents;
using AgentOffice.Domain;

namespace AgentOffice.Office;

/// <summary>The fields of a card that the owner or a colleague can set. Null means "leave as is".</summary>
public sealed record CardChanges(
    string? Title = null,
    string? Description = null,
    string? Status = null,
    string? Assignee = null,
    string? Priority = null,
    int? Points = null,
    bool? Blocked = null,
    string? BlockedReason = null,
    bool ClearAssignee = false,
    bool ClearPoints = false);

/// <summary>
/// The office board: a kanban of cards (backlog → to do → in progress → review → done) shared by the owner
/// and the colleagues allowed to plan. A card can be handed to its assignee as a mission; when that mission
/// ends the card moves to review, or is flagged blocked if it didn't finish.
/// </summary>
public sealed class OfficeBoard(OfficeStore store, EventBus bus)
{
    public IReadOnlyList<BoardCard> List() =>
        store.Read(s => OfficeStore.Clone(s.Cards.OrderBy(c => Array.IndexOf(CardStatus.All, c.Status)).ThenBy(c => c.Order).ToList())!);

    public BoardCard? Find(string idOrNumber) => store.Read(s => OfficeStore.Clone(Lookup(s, idOrNumber)));

    public BoardCard Create(CardChanges c, string createdBy)
    {
        var card = store.Write(s =>
        {
            var card = new BoardCard { CreatedBy = createdBy };
            Apply(s, card, c with { Title = c.Title ?? "", Status = c.Status ?? CardStatus.Backlog }); // throws before anything changes
            card.Number = s.NextCardNumber++;
            card.Order = s.Cards.Where(x => x.Status == card.Status).Select(x => x.Order).DefaultIfEmpty(0).Max() + 1;
            s.Cards.Add(card);
            return OfficeStore.Clone(card)!;
        });
        Changed();
        return card;
    }

    public BoardCard Update(string id, CardChanges c)
    {
        var card = store.Write(s =>
        {
            var current = Lookup(s, id) ?? throw new OfficeException(404, "No such card.");
            // Work on a copy so a rejected change leaves the card as it was.
            var card = OfficeStore.Clone(current)!;
            Apply(s, card, c);
            if (card.Status != current.Status) card.Order = s.Cards.Where(x => x.Status == card.Status && x != current).Select(x => x.Order).DefaultIfEmpty(0).Max() + 1;
            s.Cards[s.Cards.IndexOf(current)] = card;
            return OfficeStore.Clone(card)!;
        });
        Changed();
        return card;
    }

    /// <summary>Moves a card to a column, just before <paramref name="beforeId"/> (or to the end).</summary>
    public BoardCard Move(string id, string? status, string? beforeId)
    {
        var card = store.Write(s =>
        {
            var card = Lookup(s, id) ?? throw new OfficeException(404, "No such card.");
            var to = CheckStatus(status ?? card.Status);
            var column = s.Cards.Where(x => x.Status == to && x != card).OrderBy(x => x.Order).ToList();
            var at = beforeId is null ? -1 : column.FindIndex(x => x.Id == beforeId);
            card.Order = at < 0
                ? column.Select(x => x.Order).DefaultIfEmpty(0).Max() + 1
                : at == 0 ? column[0].Order - 1 : (column[at - 1].Order + column[at].Order) / 2;
            card.Status = to;
            card.UpdatedAt = DateTimeOffset.UtcNow;
            return OfficeStore.Clone(card)!;
        });
        Changed();
        return card;
    }

    public void Delete(string id)
    {
        store.Write(s =>
        {
            var card = Lookup(s, id) ?? throw new OfficeException(404, "No such card.");
            s.Cards.Remove(card);
        });
        Changed();
    }

    /// <summary>Links a freshly started mission to its card and puts the card in progress.</summary>
    public void Started(string cardId, string missionId)
    {
        store.Write(s =>
        {
            var card = Lookup(s, cardId);
            if (card is null) return;
            card.MissionId = missionId;
            card.Blocked = false;
            card.BlockedReason = null;
            if (card.Status != CardStatus.Doing)
            {
                card.Status = CardStatus.Doing;
                card.Order = s.Cards.Where(x => x.Status == CardStatus.Doing && x != card).Select(x => x.Order).DefaultIfEmpty(0).Max() + 1;
            }
            card.UpdatedAt = DateTimeOffset.UtcNow;
        });
        Changed();
    }

    /// <summary>A follow-up on a card's mission puts the card back in progress.</summary>
    public void MissionResumed(string missionId)
    {
        var touched = store.Write(s =>
        {
            var card = s.Cards.FirstOrDefault(c => c.MissionId == missionId && c.Status == CardStatus.Review);
            if (card is null) return false;
            card.Status = CardStatus.Doing;
            card.Order = s.Cards.Where(x => x.Status == CardStatus.Doing && x != card).Select(x => x.Order).DefaultIfEmpty(0).Max() + 1;
            card.UpdatedAt = DateTimeOffset.UtcNow;
            return true;
        });
        if (touched) Changed();
    }

    /// <summary>Called when a mission's turn ends: its card goes to review, or is flagged when the work stopped.</summary>
    public void MissionEnded(string missionId, string status, string? error)
    {
        var touched = store.Write(s =>
        {
            var card = s.Cards.FirstOrDefault(c => c.MissionId == missionId);
            if (card is null) return false;
            if (status == MissionStatus.Done)
            {
                card.Blocked = false;
                card.BlockedReason = null;
                if (card.Status is CardStatus.Backlog or CardStatus.Todo or CardStatus.Doing)
                {
                    card.Status = CardStatus.Review;
                    card.Order = s.Cards.Where(x => x.Status == CardStatus.Review && x != card).Select(x => x.Order).DefaultIfEmpty(0).Max() + 1;
                }
            }
            else
            {
                card.Blocked = true;
                card.BlockedReason = Clip(error ?? $"Mission {status}.", 200);
            }
            card.UpdatedAt = DateTimeOffset.UtcNow;
            return true;
        });
        if (touched) Changed();
    }

    /// <summary>Takes a colleague who left off every card they had.</summary>
    public void Unassign(string agentId)
    {
        var touched = store.Write(s =>
        {
            var mine = s.Cards.Where(c => c.Assignee == agentId).ToList();
            foreach (var c in mine) c.Assignee = null;
            return mine.Count > 0;
        });
        if (touched) Changed();
    }

    private void Changed() => bus.Publish("cards.updated", data: new { cards = List() });

    private static BoardCard? Lookup(OfficeState s, string idOrNumber)
    {
        var key = (idOrNumber ?? "").Trim().TrimStart('#');
        return s.Cards.FirstOrDefault(c => c.Id == key)
            ?? (int.TryParse(key, out var n) ? s.Cards.FirstOrDefault(c => c.Number == n) : null);
    }

    private static void Apply(OfficeState s, BoardCard card, CardChanges c)
    {
        if (c.Title is not null)
        {
            var title = c.Title.Trim();
            if (title.Length is 0 or > 200) throw new OfficeException(400, "A card needs a title (max 200 characters).");
            card.Title = title;
        }
        if (c.Description is not null)
        {
            if (c.Description.Length > 8000) throw new OfficeException(400, "The description is too long (max 8,000 characters).");
            card.Description = c.Description.Trim();
        }
        if (c.Status is not null) card.Status = CheckStatus(c.Status);
        if (c.ClearAssignee) card.Assignee = null;
        else if (!string.IsNullOrWhiteSpace(c.Assignee))
        {
            // Colleagues refer to each other by name; the UI sends ids.
            var who = s.Agents.FirstOrDefault(a => a.Id == c.Assignee)
                ?? s.Agents.FirstOrDefault(a => string.Equals(a.Name, c.Assignee.Trim().TrimStart('@'), StringComparison.OrdinalIgnoreCase))
                ?? throw new OfficeException(400, $"Nobody called '{c.Assignee}' works here.");
            card.Assignee = who.Id;
        }
        if (c.Priority is not null)
        {
            var p = c.Priority.Trim().ToLowerInvariant();
            if (!CardPriority.All.Contains(p)) throw new OfficeException(400, "Priority must be low, normal, high or urgent.");
            card.Priority = p;
        }
        if (c.ClearPoints) card.Points = null;
        else if (c.Points is { } pts)
        {
            if (pts is < 0 or > 100) throw new OfficeException(400, "Points must be between 0 and 100.");
            card.Points = pts;
        }
        if (c.Blocked is { } b)
        {
            card.Blocked = b;
            card.BlockedReason = b ? Clip((c.BlockedReason ?? card.BlockedReason ?? "").Trim(), 200) : null;
        }
        else if (c.BlockedReason is not null && card.Blocked)
        {
            card.BlockedReason = Clip(c.BlockedReason.Trim(), 200);
        }
        card.UpdatedAt = DateTimeOffset.UtcNow;
    }

    private static string CheckStatus(string status)
    {
        var st = status.Trim().ToLowerInvariant() switch { "in progress" or "in-progress" or "doing" => CardStatus.Doing, "to do" or "to-do" => CardStatus.Todo, var x => x };
        return CardStatus.All.Contains(st) ? st : throw new OfficeException(400, "Status must be backlog, todo, doing, review or done.");
    }

    private static string Clip(string text, int max) => text.Length <= max ? text : text[..max].TrimEnd() + "…";
}
