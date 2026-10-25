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
api.MapGet("/roles", (IHostEnvironment env) =>
{
    var file = Path.Combine(AppContext.BaseDirectory, "Data", "roles.json");
    if (!File.Exists(file)) file = Path.Combine(env.ContentRootPath, "Data", "roles.json");
    return File.Exists(file) ? Results.Text(File.ReadAllText(file), "application/json") : Results.Ok(Array.Empty<object>());
});

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
