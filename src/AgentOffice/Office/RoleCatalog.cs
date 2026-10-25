using System.Text.Json;
using AgentOffice.Agents;
using AgentOffice.Domain;

namespace AgentOffice.Office;

/// <summary>
/// Role templates for the hire dialog: the built-ins shipped in Data/roles.json plus the owner's own,
/// stored in office.json. Saving a role with a built-in's title replaces it; deleting that brings it back.
/// </summary>
public sealed class RoleCatalog(OfficeStore store, EventBus bus, IHostEnvironment env)
{
    public sealed record RoleView(string? Id, string Title, string Summary, string Persona, Capabilities Can, RoleLook Look, bool Custom, bool ReplacesBuiltIn);

    private readonly Lazy<List<RoleTemplate>> _builtIn = new(() => LoadBuiltIn(env));

    public IReadOnlyList<RoleView> List()
    {
        var custom = store.Read(s => OfficeStore.Clone(s.Roles)!);
        var byTitle = custom.ToDictionary(r => r.Title, StringComparer.OrdinalIgnoreCase);
        var builtInTitles = _builtIn.Value.Select(r => r.Title).ToHashSet(StringComparer.OrdinalIgnoreCase);

        // Built-ins keep their place in the list even when the owner has replaced them.
        return _builtIn.Value
            .Select(b => byTitle.TryGetValue(b.Title, out var mine) ? View(mine, custom: true, replaces: true) : View(b, custom: false, replaces: false))
            .Concat(custom.Where(r => !builtInTitles.Contains(r.Title)).Select(r => View(r, custom: true, replaces: false)))
            .ToList();
    }

    /// <summary>Adds a role, or updates the owner's role with the same title.</summary>
    public RoleView Save(RoleTemplate role)
    {
        var title = (role.Title ?? "").Trim();
        if (title.Length is 0 or > 80) throw new OfficeException(400, "A role needs a title (max 80 characters).");
        if ((role.Summary ?? "").Length > 200) throw new OfficeException(400, "The summary is too long (max 200 characters).");
        if ((role.Persona ?? "").Length > 12_000) throw new OfficeException(400, "Instructions are too long (max 12,000 characters).");

        var saved = store.Write(s =>
        {
            var existing = s.Roles.FirstOrDefault(r => string.Equals(r.Title, title, StringComparison.OrdinalIgnoreCase));
            if (existing is null)
            {
                existing = new RoleTemplate { Id = Ids.New("rl") };
                s.Roles.Add(existing);
            }
            existing.Title = title;
            existing.Summary = (role.Summary ?? "").Trim();
            existing.Persona = role.Persona ?? "";
            existing.Can = role.Can ?? new();
            existing.Look = role.Look ?? new();
            return OfficeStore.Clone(existing)!;
        });
        Changed();
        return List().First(r => r.Id == saved.Id);
    }

    public void Delete(string id)
    {
        store.Write(s =>
        {
            var role = s.Roles.FirstOrDefault(r => r.Id == id) ?? throw new OfficeException(404, "No such role. Built-in roles can't be deleted.");
            s.Roles.Remove(role);
        });
        Changed();
    }

    private void Changed() => bus.Publish("roles.updated", data: new { roles = List() });

    private static RoleView View(RoleTemplate r, bool custom, bool replaces) =>
        new(r.Id, r.Title, r.Summary, r.Persona, r.Can, r.Look, custom, replaces);

    private static List<RoleTemplate> LoadBuiltIn(IHostEnvironment env)
    {
        var file = Path.Combine(AppContext.BaseDirectory, "Data", "roles.json");
        if (!File.Exists(file)) file = Path.Combine(env.ContentRootPath, "Data", "roles.json");
        return File.Exists(file) ? JsonSerializer.Deserialize<List<RoleTemplate>>(File.ReadAllText(file), Json.Options) ?? [] : [];
    }
}
