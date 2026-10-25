using System.Collections.Concurrent;
using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using AgentOffice.Domain;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.AI;

namespace AgentOffice.Agents;

/// <summary>
/// A minimal MCP server (streamable HTTP, JSON responses only) that lends one agent turn's tools
/// to a <c>claude</c> CLI process. Each turn registers its tools under a random token and gets a
/// private URL; the token is dropped when the turn ends, so a URL only works while its run is alive.
/// </summary>
public sealed class ClaudeCliToolHost(IServer server)
{
    public const string ServerName = "office";
    private const string Route = "/mcp/claude-cli";

    private readonly ConcurrentDictionary<string, IReadOnlyDictionary<string, AIFunction>> _runs = new();

    public sealed class Lease(ClaudeCliToolHost host, string token, string url) : IDisposable
    {
        public string Url { get; } = url;
        public void Dispose() => host._runs.TryRemove(token, out _);
    }

    public Lease Register(IEnumerable<AITool>? tools)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        _runs[token] = (tools ?? []).OfType<AIFunction>().ToDictionary(f => f.Name, StringComparer.Ordinal);
        return new Lease(this, token, $"{BaseUrl()}{Route}/{token}");
    }

    public void Map(IEndpointRouteBuilder app)
    {
        app.MapPost($"{Route}/{{token}}", HandleAsync);
        // No server-initiated stream; the spec allows 405 for GET. DELETE ends nothing we keep.
        app.MapMethods($"{Route}/{{token}}", ["GET", "DELETE"], () => Results.StatusCode(405));
    }

    private async Task<IResult> HandleAsync(HttpContext http, string token)
    {
        if (http.Connection.RemoteIpAddress is { } ip && !IPAddress.IsLoopback(ip)) return Results.StatusCode(403);
        if (!_runs.TryGetValue(token, out var tools)) return Results.NotFound();

        JsonNode? request;
        try { request = await JsonNode.ParseAsync(http.Request.Body, cancellationToken: http.RequestAborted); }
        catch (JsonException) { return Results.BadRequest(); }

        var id = request?["id"]?.DeepClone();
        var method = request?["method"]?.GetValue<string>();
        if (id is null) return Results.Accepted(); // notifications (initialized, cancelled…) need no answer

        object? result = method switch
        {
            "initialize" => new
            {
                protocolVersion = request?["params"]?["protocolVersion"]?.GetValue<string>() ?? "2025-06-18",
                capabilities = new { tools = new { } },
                serverInfo = new { name = "agent-office", version = "1.0" },
            },
            "ping" => new { },
            "tools/list" => new
            {
                tools = tools.Values.Select(f => new { name = f.Name, description = f.Description, inputSchema = f.JsonSchema }),
            },
            "tools/call" => await CallAsync(tools, request?["params"], http.RequestAborted),
            _ => null,
        };

        return result is null
            ? Results.Json(new { jsonrpc = "2.0", id, error = new { code = -32601, message = $"Method not found: {method}" } })
            : Results.Json(new { jsonrpc = "2.0", id, result });
    }

    private static async Task<object> CallAsync(IReadOnlyDictionary<string, AIFunction> tools, JsonNode? p, CancellationToken ct)
    {
        var name = p?["name"]?.GetValue<string>() ?? "";
        if (!tools.TryGetValue(name, out var fn)) return ToolResult($"Unknown tool '{name}'.", isError: true);

        var args = new AIFunctionArguments();
        if (p?["arguments"] is JsonObject given)
        {
            foreach (var (key, value) in given)
                args[key] = value is null ? null : JsonSerializer.SerializeToElement(value, Json.Options);
        }

        try
        {
            var value = await fn.InvokeAsync(args, ct);
            return ToolResult(value switch
            {
                null => "",
                string s => s,
                JsonElement { ValueKind: JsonValueKind.String } e => e.GetString() ?? "",
                _ => JsonSerializer.Serialize(value, Json.Options),
            }, isError: false);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            return ToolResult($"Error: {ex.Message}", isError: true);
        }
    }

    private static object ToolResult(string text, bool isError) =>
        new { content = new[] { new { type = "text", text } }, isError };

    private string BaseUrl()
    {
        // Prefer plain http: the CLI would reject a self-signed dev certificate.
        var address = server.Features.Get<IServerAddressesFeature>()?.Addresses
                .OrderBy(a => a.StartsWith("https:", StringComparison.OrdinalIgnoreCase)).FirstOrDefault()
            ?? throw new InvalidOperationException("The web server isn't listening yet, so Claude CLI can't reach the office tools.");
        // Kestrel reports wildcard bindings as http://[::]:port or http://+:port; the CLI runs on this machine.
        var uri = new Uri(address.Replace("://+", "://localhost").Replace("://*", "://localhost"));
        var host = uri.Host is "[::]" or "0.0.0.0" ? "localhost" : uri.Host;
        return $"{uri.Scheme}://{host}:{uri.Port}";
    }
}
