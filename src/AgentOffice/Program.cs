using System.Text.Json;
using System.Text.Json.Serialization;
using AgentOffice.Agents;
using AgentOffice.Domain;
using AgentOffice.Office;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<OfficeOptions>(builder.Configuration.GetSection(OfficeOptions.Section));
builder.Services.Configure<ProviderOptions>(builder.Configuration.GetSection(ProviderOptions.Section));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);
builder.Services.AddHttpClient("web", c =>
    {
        c.Timeout = TimeSpan.FromSeconds(20);
        c.DefaultRequestHeaders.UserAgent.ParseAdd("AgentOffice/1.0");
    })
    // Every connection is made by us, to an address we checked is public. Redirects are followed
    // by hand in fetch_url so each hop goes through the same check (no DNS-rebinding, no redirect to 169.254.x).
    .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
    {
        AllowAutoRedirect = false,
        UseProxy = false,
        ConnectCallback = AgentToolbox.ConnectPublicOnlyAsync,
    });
builder.Services.AddProblemDetails();

builder.Services.AddSingleton<OfficeStore>();
builder.Services.AddSingleton<EventBus>();
builder.Services.AddSingleton<RoleCatalog>();
builder.Services.AddSingleton<SkillLibrary>();
builder.Services.AddSingleton<OfficeBoard>();
builder.Services.AddSingleton<ClaudeCliToolHost>();
builder.Services.AddSingleton<ChatClientFactory>();
builder.Services.AddSingleton<OfficeRuntime>();

var app = builder.Build();

// Turn office rule violations into clean 4xx responses the UI can show.
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (OfficeException ex)
    {
        ctx.Response.StatusCode = ex.Status;
        await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapHub<OfficeHub>("/hub");
app.Services.GetRequiredService<ClaudeCliToolHost>().Map(app);

var api = app.MapGroup("/api");

// ---- office snapshot: everything the UI needs to draw the floor
api.MapGet("/office", (OfficeStore store, OfficeRuntime runtime, ChatClientFactory clients, EventBus bus) =>
{
    var (name, agents, missions) = store.Read(s => (
        s.Name,
        OfficeStore.Clone(s.Agents)!,
        OfficeStore.Clone(s.Missions.OrderByDescending(m => m.UpdatedAt).Take(50).ToList())!));
    return Results.Ok(new
    {
        name,
        defaultProvider = clients.DefaultProvider,
        agents = agents.Select(a => new { profile = a, presence = runtime.PresenceOf(a.Id), effective = Effective(clients, a) }),
        missions = missions.Select(m => new { mission = m, running = runtime.IsRunning(m.Id) }),
        recent = bus.Recent(120),
    });
});

api.MapPut("/office/name", (OfficeStore store, EventBus bus, RenameRequest req) =>
{
    var name = (req.Name ?? "").Trim();
    if (name.Length is 0 or > 60) return Results.BadRequest(new { error = "Office name must be 1–60 characters." });
    store.Write(s => s.Name = name);
    bus.Publish("office.renamed", data: new { name });
    return Results.Ok(new { name });
});

api.MapGet("/providers", (ChatClientFactory clients) => Results.Ok(new { @default = clients.DefaultProvider, providers = clients.Describe() }));

// ---- role templates: optional starting points for the hire dialog, not a fixed org chart
api.MapGet("/roles", (RoleCatalog roles) => Results.Ok(roles.List()));
api.MapPost("/roles", (RoleCatalog roles, RoleTemplate role) => Results.Ok(roles.Save(role)));
api.MapDelete("/roles/{id}", (RoleCatalog roles, string id) => { roles.Delete(id); return Results.NoContent(); });

// ---- office board: a kanban of the team's work; starting a card hands it to its assignee as a mission
api.MapGet("/cards", (OfficeBoard board) => Results.Ok(board.List()));
api.MapPost("/cards", (OfficeBoard board, CardRequest req) => Results.Ok(board.Create(req.ToChanges(), "owner")));
api.MapPut("/cards/{id}", (OfficeBoard board, string id, CardRequest req) => Results.Ok(board.Update(id, req.ToChanges())));
api.MapPost("/cards/{id}/move", (OfficeBoard board, string id, MoveCardRequest req) => Results.Ok(board.Move(id, req.Status, req.BeforeId)));
api.MapDelete("/cards/{id}", (OfficeBoard board, string id) => { board.Delete(id); return Results.NoContent(); });
api.MapPost("/cards/{id}/start", (OfficeBoard board, OfficeRuntime runtime, string id, StartCardRequest req) =>
{
    var card = board.Find(id) ?? throw new OfficeException(404, "No such card.");
    if (card.MissionId is not null && runtime.IsRunning(card.MissionId)) throw new OfficeException(409, "Work on this card is already under way.");
    var lead = req.LeadId ?? card.Assignee ?? throw new OfficeException(400, "Assign the card to someone first.");
    var goal = $"{card.Title}\n\n{card.Description}".Trim()
        + $"\n\n(Office board card #{card.Number}. When you're done, say what's ready for the owner to review.)";
    var mission = runtime.StartMission(new MissionRequest(card.Title, goal, MissionModes.Delegate, lead, [lead], req.Workspace, null));
    board.Started(card.Id, mission.Id);
    // A very quick mission may already be over before the card was linked to it.
    if (runtime.Store.FindMission(mission.Id) is { Status: not (MissionStatus.Running or MissionStatus.Idle) } ended)
        board.MissionEnded(ended.Id, ended.Status, ended.Error);
    return Results.Ok(new { card = board.Find(card.Id), mission });
});

// ---- skills: Agent Skills (SKILL.md) that roles and colleagues can have
api.MapGet("/skills", (SkillLibrary skills) => Results.Ok(skills.List()));
api.MapPost("/skills", (SkillLibrary skills, SkillRequest req) => Results.Ok(skills.Save(req.Name, req.Description, req.Instructions, mustBeNew: true)));
api.MapPut("/skills/{name}", (SkillLibrary skills, string name, SkillRequest req) =>
{
    var existing = skills.List().FirstOrDefault(s => s.Name == name);
    if (existing is null) return Results.NotFound(new { error = "No such skill." });
    if (existing.ReadOnly) return Results.BadRequest(new { error = $"{name} comes from {existing.Source}; edit it there, or import a copy." });
    return Results.Ok(skills.Save(name, req.Description, req.Instructions, mustBeNew: false));
});
api.MapDelete("/skills/{name}", (SkillLibrary skills, string name) => { skills.Delete(name); return Results.NoContent(); });
api.MapPost("/skills/import", (SkillLibrary skills, ImportRequest req) => Results.Ok(skills.Import(req.Text)));

// ---- colleagues
api.MapPost("/agents", (OfficeRuntime runtime, AgentProfile candidate) => Results.Ok(runtime.Hire(candidate)));
api.MapPut("/agents/{id}", (OfficeRuntime runtime, string id, AgentProfile changes) => Results.Ok(runtime.Update(id, changes)));
api.MapDelete("/agents/{id}", (OfficeRuntime runtime, string id) => { runtime.Fire(id); return Results.NoContent(); });
api.MapPost("/agents/{id}/chat", (OfficeRuntime runtime, string id, MessageRequest req) =>
{
    var chat = runtime.OpenChat(id);
    if (!string.IsNullOrWhiteSpace(req.Text)) runtime.PostMessage(chat.Id, req.Text);
    return Results.Ok(chat);
});

// ---- missions
api.MapPost("/missions", (OfficeRuntime runtime, MissionRequest req) => Results.Ok(runtime.StartMission(req)));
api.MapGet("/missions/{id}", (OfficeStore store, OfficeRuntime runtime, string id) =>
{
    var mission = store.FindMission(id);
    return mission is null
        ? Results.NotFound(new { error = "No such mission." })
        : Results.Ok(new { mission, running = runtime.IsRunning(id), events = store.ReadEvents(id, 1500) });
});
api.MapPost("/missions/{id}/messages", (OfficeRuntime runtime, string id, MessageRequest req) =>
{
    runtime.PostMessage(id, req.Text ?? "");
    return Results.Accepted();
});
api.MapPost("/missions/{id}/cancel", (OfficeRuntime runtime, string id) =>
    runtime.Cancel(id) ? Results.Accepted() : Results.Conflict(new { error = "That mission isn't running." }));

app.Run();

static object Effective(ChatClientFactory clients, AgentProfile a)
{
    var (provider, model) = clients.Resolve(a.Provider, a.Model);
    return new { provider, model };
}

public sealed record MessageRequest(string? Text);
public sealed record RenameRequest(string? Name);
public sealed record SkillRequest(string? Name, string? Description, string? Instructions);
public sealed record ImportRequest(string? Text);
public sealed record MoveCardRequest(string? Status, string? BeforeId);
public sealed record StartCardRequest(string? LeadId, string? Workspace);

/// <summary>A whole card from the UI: missing assignee or points mean "none".</summary>
public sealed record CardRequest(string? Title, string? Description, string? Status, string? Assignee, string? Priority, int? Points, bool? Blocked, string? BlockedReason)
{
    public CardChanges ToChanges() => new(Title ?? "", Description ?? "", Status, Assignee, Priority, Points, Blocked ?? false, BlockedReason,
        ClearAssignee: string.IsNullOrWhiteSpace(Assignee), ClearPoints: Points is null);
}
