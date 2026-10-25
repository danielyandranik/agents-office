using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using AgentOffice.Agents;
using AgentOffice.Domain;
using Microsoft.Extensions.Options;

namespace AgentOffice.Office;

/// <summary>
/// Lets the owner run the office from Telegram. It long-polls the Bot API, so it only makes outgoing
/// requests: no public URL or webhook. Only chats paired with a one-time code from the web UI are served.
/// Messages become chats, missions and board changes; mission results, reviews and blockers come back
/// as messages, and replying to one of them continues that mission.
/// </summary>
public sealed class TelegramBot(
    IOptions<TelegramOptions> options,
    OfficeStore store,
    EventBus bus,
    OfficeRuntime runtime,
    ILogger<TelegramBot> log) : BackgroundService
{
    private const int MaxText = 3900;                       // Telegram's limit is 4096 characters
    private const int MaxPairingMisses = 5;
    private static readonly TimeSpan PairingTtl = TimeSpan.FromMinutes(10);
    private static readonly JsonSerializerOptions JsonOut = new() { DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };

    // A private client: the shared HttpClient factory logs request URLs, and Bot API URLs contain the token.
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(90) };
    private readonly Channel<OfficeEvent> _events = Channel.CreateUnbounded<OfficeEvent>(new UnboundedChannelOptions { SingleReader = true });

    private readonly object _pairGate = new();
    private Pairing? _pairing;
    private sealed class Pairing(string code, DateTimeOffset expires)
    {
        public string Code { get; } = code;
        public DateTimeOffset Expires { get; } = expires;
        public int Misses { get; set; }
    }

    // Which mission each bot message was about, so replying to it continues that mission. Oldest are forgotten.
    private readonly ConcurrentDictionary<(long Chat, long Message), string> _aboutMission = new();
    private readonly ConcurrentQueue<(long Chat, long Message)> _aboutOrder = new();
    // The chat whose message started a mission's current turn gets the answer.
    private readonly ConcurrentDictionary<string, long> _turnFrom = new();
    // Read and written only by the event loop.
    private readonly Dictionary<string, string> _lastStatus = new();
    private readonly Dictionary<string, (string Status, bool Blocked)> _cardSeen = new();
    private readonly HashSet<string> _justEnded = new();

    public bool Configured => !string.IsNullOrWhiteSpace(options.Value.BotToken);
    public string? BotUsername { get; private set; }
    public string? Problem { get; private set; }

    // =====================================================================
    // Web UI: status, pairing, chats
    // =====================================================================

    public object Status()
    {
        Pairing? p;
        lock (_pairGate) p = _pairing is { } x && x.Expires > DateTimeOffset.UtcNow ? x : null;
        return new
        {
            configured = Configured,
            bot = BotUsername,
            problem = Problem,
            chats = store.Read(s => OfficeStore.Clone(s.TelegramChats)!),
            pairing = p is null ? null : new
            {
                code = p.Code,
                expiresAt = p.Expires,
                link = BotUsername is null ? null : $"https://t.me/{BotUsername}?start={p.Code}",
            },
        };
    }

    public object NewPairing()
    {
        if (!Configured) throw new OfficeException(400, "Add a bot token first (Telegram:BotToken).");
        lock (_pairGate) _pairing = new Pairing(RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6"), DateTimeOffset.UtcNow + PairingTtl);
        return Status();
    }

    public void SetMuted(long chatId, bool muted)
    {
        store.Write(s =>
        {
            var chat = s.TelegramChats.FirstOrDefault(c => c.Id == chatId) ?? throw new OfficeException(404, "That chat isn't paired.");
            chat.Muted = muted;
        });
        Changed();
    }

    public void Unpair(long chatId)
    {
        var removed = store.Write(s => s.TelegramChats.RemoveAll(c => c.Id == chatId));
        if (removed == 0) throw new OfficeException(404, "That chat isn't paired.");
        Changed();
    }

    private void Changed() => bus.Publish("telegram.updated");

    private bool TryPair(string code)
    {
        lock (_pairGate)
        {
            if (_pairing is null || _pairing.Expires <= DateTimeOffset.UtcNow) return false;
            var ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(code.Trim()), Encoding.UTF8.GetBytes(_pairing.Code));
            if (ok) _pairing = null;                                              // one use
            else if (++_pairing.Misses >= MaxPairingMisses) _pairing = null;      // no guessing
            return ok;
        }
    }

    // =====================================================================
    // Polling
    // =====================================================================

    protected override async Task ExecuteAsync(CancellationToken stop)
    {
        if (!Configured) return;

        foreach (var (id, status) in store.Read(s => s.Missions.Select(m => (m.Id, m.Status)).ToList())) _lastStatus[id] = status;
        foreach (var c in runtime.Board.List()) _cardSeen[c.Id] = (c.Status, c.Blocked);
        bus.Published += OnPublished;
        var notifications = Task.Run(() => EventLoopAsync(stop), CancellationToken.None);

        try { await PollAsync(stop); }
        finally
        {
            bus.Published -= OnPublished;
            _events.Writer.TryComplete();
            await notifications;
        }
    }

    private async Task PollAsync(CancellationToken stop)
    {
        long offset = 0;
        var backoff = TimeSpan.FromSeconds(2);
        while (!stop.IsCancellationRequested)
        {
            try
            {
                if (BotUsername is null)
                {
                    var me = await CallAsync("getMe", new { }, stop);
                    BotUsername = me.GetProperty("username").GetString();
                    await CallAsync("setMyCommands", new { commands = Commands.Select(c => new { command = c.Name, description = c.Help }) }, stop);
                    log.LogInformation("Telegram bot @{Bot} is listening", BotUsername);
                    SetProblem(null);
                }

                var updates = await CallAsync("getUpdates", new { offset, timeout = 50, allowed_updates = new[] { "message" } }, stop);
                SetProblem(null);
                backoff = TimeSpan.FromSeconds(2);
                foreach (var u in updates.EnumerateArray())
                {
                    offset = u.GetProperty("update_id").GetInt64() + 1;
                    if (!u.TryGetProperty("message", out var msg)) continue;
                    try { await HandleAsync(msg, stop); }
                    catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning(ex, "Telegram message failed"); }
                }
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
            catch (TelegramError ex)
            {
                var badToken = ex.Code is 401 or 404;
                if (badToken) BotUsername = null;
                SetProblem(badToken ? "Telegram rejected the bot token. Check Telegram:BotToken."
                    : ex.Code == 409 ? "Another copy of Agent Office (or another program) is using this bot."
                    : $"Telegram said: {ex.Message}");
                await PauseAsync(ex.RetryAfter ?? TimeSpan.FromSeconds(badToken ? 60 : 15), stop);
            }
            catch (Exception ex)
            {
                // Network errors don't contain the URL (and so not the token), but don't log the exception object anyway.
                log.LogWarning("Telegram poll failed: {Message}", ex.Message);
                SetProblem("Can't reach Telegram right now; retrying.");
                await PauseAsync(backoff, stop);
                backoff = TimeSpan.FromSeconds(Math.Min(60, backoff.TotalSeconds * 2));
            }
        }
    }

    private void SetProblem(string? problem)
    {
        if (problem == Problem) return;
        Problem = problem;
        if (problem is not null) log.LogWarning("Telegram: {Problem}", problem);
        Changed();
    }

    private static async Task PauseAsync(TimeSpan delay, CancellationToken stop)
    {
        try { await Task.Delay(delay, stop); }
        catch (OperationCanceledException) { }
    }

    // =====================================================================
    // Incoming messages
    // =====================================================================

    private static readonly (string Name, string Help)[] Commands =
    [
        ("help", "What I can do"),
        ("team", "Who's here and what they're doing"),
        ("missions", "What's running"),
        ("mission", "@Name goal: start a mission"),
        ("meeting", "@A @B topic: hold a meeting"),
        ("cancel", "Stop a mission (reply to its message)"),
        ("board", "The office board"),
        ("card", "[@Name] title | details: add a card"),
        ("go", "12: hand card #12 to its assignee"),
        ("move", "12 todo: move a card"),
        ("done", "12: accept a card"),
        ("mute", "Pause office notifications here"),
        ("unmute", "Resume office notifications"),
        ("unpair", "Disconnect this chat"),
    ];

    private const string Help = """
        Here's what I can do:
        @Name message: talk to a colleague (reply to their answer to keep going)
        /mission @Name goal: start a mission led by Name
        /meeting @A @B topic: hold a meeting
        /missions: what's running
        /cancel: stop a mission (reply /cancel to its message)
        /team: who's here and what they're doing
        /board: the office board
        /card [@Name] title | details: add a card to the backlog
        /go 12: hand card #12 to its assignee
        /move 12 todo: move a card (backlog, todo, doing, review, done)
        /done 12: accept a card
        /mute, /unmute: office notifications in this chat
        /unpair: disconnect this chat
        """;

    private async Task HandleAsync(JsonElement msg, CancellationToken ct)
    {
        var chatEl = msg.GetProperty("chat");
        var chatId = chatEl.GetProperty("id").GetInt64();
        var text = msg.TryGetProperty("text", out var t) ? (t.GetString() ?? "").Trim() : "";
        var (cmd, arg) = ParseCommand(text);

        if (Str(chatEl, "type") != "private")
        {
            if (cmd is not null) await SendAsync(chatId, "I only work in a private chat with the office's owner.", ct: ct);
            return;
        }

        var paired = store.Read(s => s.TelegramChats.Any(c => c.Id == chatId));
        if (!paired)
        {
            if (cmd is "pair" or "start" && arg.Length > 0)
            {
                if (TryPair(arg))
                {
                    var from = msg.TryGetProperty("from", out var f) ? f : chatEl;
                    var name = string.Join(' ', new[] { Str(from, "first_name"), Str(from, "last_name") }.Where(x => x.Length > 0));
                    if (Str(from, "username") is { Length: > 0 } user) name = name.Length > 0 ? $"{name} (@{user})" : $"@{user}";
                    store.Write(s => s.TelegramChats.Add(new TelegramChat { Id = chatId, Name = name.Length > 0 ? name : chatId.ToString() }));
                    Changed();
                    await SendAsync(chatId, $"Paired with {store.Read(s => s.Name)}. You'll hear about finished missions, reviews and blockers here.\n\n{Help}", ct: ct);
                }
                else await SendAsync(chatId, "That code is wrong or has expired. Make a new one in Agent Office → Telegram.", ct: ct);
                return;
            }
            await SendAsync(chatId, "This office is private. To connect, open Agent Office in your browser, choose Telegram → Pair a chat, and send me the code it shows.", ct: ct);
            return;
        }

        if (text.Length == 0) { await SendAsync(chatId, "I can only read text messages.", ct: ct); return; }

        try
        {
            // Replying to one of my messages continues the mission it was about.
            if (cmd is null or "cancel"
                && msg.TryGetProperty("reply_to_message", out var replied)
                && _aboutMission.TryGetValue((chatId, replied.GetProperty("message_id").GetInt64()), out var missionId))
            {
                if (cmd == "cancel") await CancelAsync(chatId, missionId, ct);
                else await FollowUpAsync(chatId, missionId, text, ct);
                return;
            }

            switch (cmd)
            {
                case null when text.StartsWith('@'): await AskAsync(chatId, text, ct); break;
                case null: await SendAsync(chatId, "Start with @Name to talk to a colleague, or reply to one of my messages. /help shows everything else.", ct: ct); break;
                case "help" or "start": await SendAsync(chatId, Help, ct: ct); break;
                case "team": await SendAsync(chatId, Team(), ct: ct); break;
                case "missions": await SendAsync(chatId, Missions(), ct: ct); break;
                case "mission": await StartMissionAsync(chatId, arg, ct); break;
                case "meeting": await StartMeetingAsync(chatId, arg, ct); break;
                case "cancel": await CancelAsync(chatId, null, ct); break;
                case "board": await SendAsync(chatId, Board(), ct: ct); break;
                case "card": await NewCardAsync(chatId, arg, ct); break;
                case "go": await StartCardAsync(chatId, arg, ct); break;
                case "done": await MoveCardAsync(chatId, $"{arg} done", ct); break;
                case "move": await MoveCardAsync(chatId, arg, ct); break;
                case "mute": SetMuted(chatId, true); await SendAsync(chatId, "Notifications paused here. You'll still get answers to what you ask. /unmute to resume.", ct: ct); break;
                case "unmute": SetMuted(chatId, false); await SendAsync(chatId, "Notifications are back on.", ct: ct); break;
                case "unpair": Unpair(chatId); await SendAsync(chatId, "Disconnected. Pair again from Agent Office whenever you like.", ct: ct); break;
                case "pair": await SendAsync(chatId, "This chat is already paired.", ct: ct); break;
                default: await SendAsync(chatId, $"I don't know /{cmd}. /help shows what I can do.", ct: ct); break;
            }
        }
        catch (OfficeException ex)
        {
            await SendAsync(chatId, ex.Message, ct: ct);
        }
    }

    private async Task AskAsync(long chatId, string text, CancellationToken ct)
    {
        var (who, rest) = Addressed(text);
        if (who is null) { await SendAsync(chatId, $"Nobody here goes by that name. {Roster()}", ct: ct); return; }
        if (rest.Length == 0) { await SendAsync(chatId, $"What should I tell {who.Name}?", ct: ct); return; }

        var chat = runtime.OpenChat(who.Id);
        _turnFrom[chat.Id] = chatId;
        try { runtime.PostMessage(chat.Id, rest); }
        catch (OfficeException) { _turnFrom.TryRemove(chat.Id, out _); throw; }
        await TypingAsync(chatId, ct);
    }

    private async Task FollowUpAsync(long chatId, string missionId, string text, CancellationToken ct)
    {
        var mission = store.FindMission(missionId) ?? throw new OfficeException(404, "That mission is gone.");
        _turnFrom[missionId] = chatId;
        try { runtime.PostMessage(missionId, text); }
        catch (OfficeException) { _turnFrom.TryRemove(missionId, out _); throw; }
        if (mission.Mode == MissionModes.Chat) await TypingAsync(chatId, ct);
        else await SendAsync(chatId, $"Added to “{mission.Title}”. I'll send the answer.", missionId, ct: ct);
    }

    private async Task StartMissionAsync(long chatId, string arg, CancellationToken ct)
    {
        var (lead, goal) = Addressed(arg);
        if (lead is null || goal.Length == 0)
        {
            await SendAsync(chatId, $"Say who leads it and what needs doing, like: /mission @Nora Add password reset to the portal\n{Roster()}", ct: ct);
            return;
        }
        var mission = runtime.StartMission(new MissionRequest("", goal, MissionModes.Delegate, lead.Id, [lead.Id], null, null));
        _turnFrom[mission.Id] = chatId;
        await SendAsync(chatId, $"Started “{mission.Title}”, led by {lead.Name}. I'll tell you when it's done; reply to this message to add something.", mission.Id, ct: ct);
    }

    private async Task StartMeetingAsync(long chatId, string arg, CancellationToken ct)
    {
        var people = new List<AgentProfile>();
        var rest = arg;
        while (Addressed(rest) is ({ } who, var after)) { if (people.All(p => p.Id != who.Id)) people.Add(who); rest = after; }
        if (people.Count < 2 || rest.Length == 0)
        {
            await SendAsync(chatId, $"Name at least two people and a topic, like: /meeting @Nora @Tigran How should we split the release?\n{Roster()}", ct: ct);
            return;
        }
        var ids = people.Select(p => p.Id).ToList();
        var mission = runtime.StartMission(new MissionRequest("", rest, MissionModes.Meeting, ids[0], ids, null, null));
        _turnFrom[mission.Id] = chatId;
        await SendAsync(chatId, $"{string.Join(", ", people.Select(p => p.Name))} are meeting about “{mission.Title}”. I'll send the outcome.", mission.Id, ct: ct);
    }

    private async Task CancelAsync(long chatId, string? missionId, CancellationToken ct)
    {
        if (missionId is null)
        {
            var running = store.Read(s => s.Missions.Where(m => runtime.IsRunning(m.Id)).Select(m => (m.Id, m.Title)).ToList());
            if (running.Count == 0) { await SendAsync(chatId, "Nothing is running.", ct: ct); return; }
            if (running.Count > 1)
            {
                await SendAsync(chatId, $"Several things are running:\n{string.Join('\n', running.Select(r => $"• {r.Title}"))}\nReply /cancel to my message about the one to stop.", ct: ct);
                return;
            }
            missionId = running[0].Id;
        }
        var title = store.FindMission(missionId)?.Title ?? "That mission";
        await SendAsync(chatId, runtime.Cancel(missionId) ? $"Stopping “{title}”." : $"“{title}” isn't running.", ct: ct);
    }

    private async Task NewCardAsync(long chatId, string arg, CancellationToken ct)
    {
        var (who, rest) = Addressed(arg);
        var parts = rest.Split('|', 2, StringSplitOptions.TrimEntries);
        if (parts[0].Length == 0) { await SendAsync(chatId, "Give the card a title, like: /card @Mei Fix the flaky checkout test | fails one run in ten", ct: ct); return; }
        var card = runtime.Board.Create(new CardChanges(parts[0], parts.Length > 1 ? parts[1] : "", CardStatus.Backlog, who?.Id), "owner");
        await SendAsync(chatId, $"Added #{card.Number} to Backlog{(who is null ? "" : $", assigned to {who.Name}")}. /go {card.Number} hands it over{(who is null ? " once it has an assignee" : "")}.", ct: ct);
    }

    private async Task StartCardAsync(long chatId, string arg, CancellationToken ct)
    {
        if (!int.TryParse(arg.TrimStart('#'), out var number)) { await SendAsync(chatId, "Which card? Like: /go 12", ct: ct); return; }
        var (card, mission) = runtime.StartCard(number.ToString());
        _turnFrom[mission.Id] = chatId;
        await SendAsync(chatId, $"{NameOf(card.Assignee)} started on #{card.Number} {card.Title}. I'll tell you when it's ready for review.", mission.Id, ct: ct);
    }

    private async Task MoveCardAsync(long chatId, string arg, CancellationToken ct)
    {
        var parts = arg.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length < 2 || !int.TryParse(parts[0].TrimStart('#'), out var number))
        {
            await SendAsync(chatId, "Which card, and where to? Like: /move 12 review", ct: ct);
            return;
        }
        var column = parts[1].ToLowerInvariant() switch { "in progress" or "progress" => CardStatus.Doing, "to do" => CardStatus.Todo, var x => x };
        var card = runtime.Board.Move(number.ToString(), column, null);
        await SendAsync(chatId, $"#{card.Number} {card.Title} is in {ColumnName(card.Status)}.", ct: ct);
    }

    // =====================================================================
    // Read-only views
    // =====================================================================

    private string Team()
    {
        var people = store.Read(s => OfficeStore.Clone(s.Agents)!);
        if (people.Count == 0) return "Nobody works here yet. Hire someone in Agent Office.";
        return string.Join('\n', people.OrderBy(p => p.Desk).Select(p =>
        {
            var presence = runtime.PresenceOf(p.Id);
            var doing = presence.Status switch
            {
                "idle" => "free",
                "thinking" => "thinking",
                "typing" => "writing",
                "working" => presence.Detail ?? "working",
                "visiting" => $"talking with {presence.Detail}",
                "meeting" or "presenting" => "in a meeting",
                var s => s,
            };
            return $"• {p.Name}{(p.Title.Length > 0 ? $", {p.Title}" : "")}: {doing}";
        }));
    }

    private string Missions()
    {
        var missions = store.Read(s => OfficeStore.Clone(s.Missions.Where(m => m.Mode != MissionModes.Chat).OrderByDescending(m => m.UpdatedAt).Take(8).ToList())!);
        if (missions.Count == 0) return "No missions yet. Start one with /mission @Name goal.";
        return string.Join('\n', missions.Select(m =>
            $"{(runtime.IsRunning(m.Id) ? "▶" : m.Status == MissionStatus.Done ? "✓" : m.Status == MissionStatus.Failed ? "✗" : "■")} {m.Title}, {NameOf(m.LeadId)}{(runtime.IsRunning(m.Id) ? " (running)" : "")}"));
    }

    private string Board()
    {
        var cards = runtime.Board.List();
        if (cards.Count == 0) return "The board is empty. Add a card with /card title.";
        var sb = new StringBuilder();
        foreach (var column in CardStatus.All)
        {
            var inColumn = cards.Where(c => c.Status == column).ToList();
            if (column == CardStatus.Done) { if (inColumn.Count > 0) sb.Append($"Done: {inColumn.Count} card{(inColumn.Count == 1 ? "" : "s")}"); continue; }
            sb.AppendLine($"{ColumnName(column)} ({inColumn.Count})");
            foreach (var c in inColumn.Take(10))
            {
                sb.Append($"  #{c.Number} {c.Title}");
                if (c.Assignee is not null) sb.Append($", {NameOf(c.Assignee)}");
                if (c.Points is { } p) sb.Append($" · {p} pts");
                if (c.Priority is "high" or "urgent") sb.Append($" · {c.Priority}");
                if (c.Blocked) sb.Append($" · blocked{(string.IsNullOrEmpty(c.BlockedReason) ? "" : $": {c.BlockedReason}")}");
                sb.AppendLine();
            }
            if (inColumn.Count > 10) sb.AppendLine($"  …and {inColumn.Count - 10} more");
            sb.AppendLine();
        }
        return sb.ToString().Trim();
    }

    // =====================================================================
    // Notifications
    // =====================================================================

    private void OnPublished(OfficeEvent e)
    {
        if (e.Kind is "mission.updated" or "cards.updated") _events.Writer.TryWrite(e);
    }

    private async Task EventLoopAsync(CancellationToken stop)
    {
        try
        {
            await foreach (var e in _events.Reader.ReadAllAsync(stop))
            {
                try
                {
                    if (e.Kind == "mission.updated" && e.Data is Mission m) await OnMissionAsync(m, stop);
                    else if (e.Kind == "cards.updated") await OnCardsAsync(stop);
                }
                catch (Exception ex) when (ex is not OperationCanceledException) { log.LogWarning(ex, "Telegram notification failed"); }
            }
        }
        catch (OperationCanceledException) { }
    }

    private async Task OnMissionAsync(Mission m, CancellationToken ct)
    {
        var before = _lastStatus.GetValueOrDefault(m.Id);
        _lastStatus[m.Id] = m.Status;
        if (before != MissionStatus.Running || m.Status == MissionStatus.Running) return; // only the end of a turn

        long? origin = _turnFrom.TryRemove(m.Id, out var o) ? o : null;
        if (m.Mode == MissionModes.Chat)
        {
            // 1:1 chats are private conversations: only answer the chat that asked.
            if (origin is not long asker) return;
            var who = NameOf(m.LeadId);
            await SendAsync(asker, m.Status switch
            {
                MissionStatus.Done => $"{who}: {m.Result}",
                MissionStatus.Failed => $"{who} couldn't answer: {m.Error}",
                _ => $"{who} stopped.",
            }, m.Id, ct: ct);
            return;
        }

        _justEnded.Add(m.Id);
        var card = runtime.Board.List().FirstOrDefault(c => c.MissionId == m.Id);
        var text = m.Status switch
        {
            MissionStatus.Done => $"✅ {m.Title} is done.\n\n{m.Result}\n\n"
                + (card is null ? "Reply to this message to follow up." : $"#{card.Number} is waiting for your review: /done {card.Number} to accept it, or reply here to ask for changes."),
            MissionStatus.Failed => $"❌ {m.Title} failed: {m.Error}",
            _ => $"⏹ {m.Title} was cancelled.",
        };
        foreach (var chat in origin is long asked ? [asked] : NotifyChats()) await SendAsync(chat, text, m.Id, ct: ct);
    }

    private async Task OnCardsAsync(CancellationToken ct)
    {
        var cards = runtime.Board.List();
        var notes = new List<string>();
        foreach (var c in cards)
        {
            var had = _cardSeen.TryGetValue(c.Id, out var before);
            _cardSeen[c.Id] = (c.Status, c.Blocked);
            // A mission that just ended has already been reported, card and all.
            if (!had || (c.MissionId is not null && _justEnded.Contains(c.MissionId))) continue;
            if (c.Status == CardStatus.Review && before.Status != CardStatus.Review)
                notes.Add($"👀 #{c.Number} {c.Title} is ready for review. /done {c.Number} to accept it.");
            if (c.Blocked && !before.Blocked)
                notes.Add($"⛔ #{c.Number} {c.Title} is blocked{(string.IsNullOrEmpty(c.BlockedReason) ? "." : $": {c.BlockedReason}")}");
        }
        foreach (var gone in _cardSeen.Keys.Where(id => cards.All(c => c.Id != id)).ToList()) _cardSeen.Remove(gone);
        _justEnded.Clear();
        if (notes.Count == 0) return;
        foreach (var chat in NotifyChats()) await SendAsync(chat, string.Join('\n', notes), ct: ct);
    }

    private List<long> NotifyChats() => store.Read(s => s.TelegramChats.Where(c => !c.Muted).Select(c => c.Id).ToList());

    // =====================================================================
    // Bot API
    // =====================================================================

    private sealed class TelegramError(int code, string message, TimeSpan? retryAfter) : Exception(message)
    {
        public int Code { get; } = code;
        public TimeSpan? RetryAfter { get; } = retryAfter;
    }

    private async Task<JsonElement> CallAsync(string method, object body, CancellationToken ct)
    {
        using var res = await _http.PostAsJsonAsync($"{options.Value.ApiBase.TrimEnd('/')}/bot{options.Value.BotToken}/{method}", body, JsonOut, ct);
        using var doc = await JsonDocument.ParseAsync(await res.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var root = doc.RootElement;
        if (root.TryGetProperty("ok", out var ok) && ok.ValueKind == JsonValueKind.True) return root.GetProperty("result").Clone();
        TimeSpan? retry = root.TryGetProperty("parameters", out var p) && p.TryGetProperty("retry_after", out var ra) ? TimeSpan.FromSeconds(ra.GetInt32()) : null;
        throw new TelegramError(
            root.TryGetProperty("error_code", out var code) ? code.GetInt32() : (int)res.StatusCode,
            root.TryGetProperty("description", out var d) ? d.GetString() ?? "" : res.ReasonPhrase ?? "",
            retry);
    }

    private async Task SendAsync(long chatId, string text, string? aboutMission = null, CancellationToken ct = default)
    {
        text = text.Trim();
        if (text.Length > MaxText) text = text[..MaxText].TrimEnd() + "\n…(the rest is in Agent Office)";
        try
        {
            var sent = await CallAsync("sendMessage", new { chat_id = chatId, text, link_preview_options = new { is_disabled = true } }, ct);
            if (aboutMission is not null) Remember(chatId, sent.GetProperty("message_id").GetInt64(), aboutMission);
        }
        catch (TelegramError ex) when (ex.Code == 403)
        {
            log.LogInformation("Telegram chat {Chat} has blocked the bot", chatId);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogWarning("Telegram send failed: {Message}", ex.Message);
        }
    }

    private async Task TypingAsync(long chatId, CancellationToken ct)
    {
        try { await CallAsync("sendChatAction", new { chat_id = chatId, action = "typing" }, ct); }
        catch (Exception ex) when (ex is not OperationCanceledException) { /* only a courtesy */ }
    }

    private void Remember(long chatId, long messageId, string missionId)
    {
        if (!_aboutMission.TryAdd((chatId, messageId), missionId)) return;
        _aboutOrder.Enqueue((chatId, messageId));
        while (_aboutOrder.Count > 2000 && _aboutOrder.TryDequeue(out var old)) _aboutMission.TryRemove(old, out _);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /// <summary>"/go@OfficeBot 12" → ("go", "12"); plain text → (null, text).</summary>
    private static (string? Command, string Arg) ParseCommand(string text)
    {
        if (!text.StartsWith('/')) return (null, text);
        var space = text.IndexOfAny([' ', '\n']);
        var head = space < 0 ? text[1..] : text[1..space];
        var at = head.IndexOf('@');
        if (at >= 0) head = head[..at];
        return (head.ToLowerInvariant(), space < 0 ? "" : text[(space + 1)..].Trim());
    }

    /// <summary>Peels a leading @Name off the text. Names can contain spaces, so the longest match wins.</summary>
    private (AgentProfile? Who, string After) Addressed(string text)
    {
        text = text.TrimStart();
        if (!text.StartsWith('@')) return (null, text);
        foreach (var a in store.Read(s => OfficeStore.Clone(s.Agents)!).OrderByDescending(a => a.Name.Length))
        {
            var tag = "@" + a.Name;
            if (text.StartsWith(tag, StringComparison.OrdinalIgnoreCase) && (text.Length == tag.Length || !char.IsLetterOrDigit(text[tag.Length])))
                return (a, text[tag.Length..].TrimStart(' ', ',', ':', '\n'));
        }
        return (null, text);
    }

    private string Roster()
    {
        var names = store.Read(s => s.Agents.Select(a => a.Name).ToList());
        return names.Count == 0 ? "Nobody works here yet." : $"Colleagues: {string.Join(", ", names)}.";
    }

    private string NameOf(string? agentId) => store.FindAgent(agentId ?? "")?.Name ?? "Someone";

    private static string ColumnName(string status) => status switch
    {
        CardStatus.Backlog => "Backlog",
        CardStatus.Todo => "To do",
        CardStatus.Doing => "In progress",
        CardStatus.Review => "Review",
        CardStatus.Done => "Done",
        _ => status,
    };

    private static string Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    public override void Dispose()
    {
        _http.Dispose();
        base.Dispose();
    }
}
