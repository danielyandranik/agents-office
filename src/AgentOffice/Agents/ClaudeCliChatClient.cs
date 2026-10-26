using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using AgentOffice.Domain;
using Microsoft.Extensions.AI;

namespace AgentOffice.Agents;

/// <summary>
/// Runs each request through the local <c>claude</c> CLI (<c>claude -p</c>), so it uses whatever account
/// the CLI is logged in with (a Claude subscription via <c>claude login</c>) instead of an API key.
///
/// The CLI runs the tool loop itself: the colleague's tools are lent to it over MCP by
/// <see cref="ClaudeCliToolHost"/>, and the calls and results it streams back are surfaced as
/// informational function contents so the office can animate them without invoking anything twice.
/// The CLI session id is returned as the conversation id, so follow-up turns resume the same session.
/// </summary>
public sealed class ClaudeCliChatClient(string command, string model, ClaudeCliToolHost toolHost, string? configDir = null, string? oauthToken = null) : IChatClient
{
    private const string ToolPrefix = $"mcp__{ClaudeCliToolHost.ServerName}__";

    // Sessions are stored per working directory, so every run uses the same one to be able to resume.
    private static readonly string WorkDir = Directory.CreateDirectory(Path.Combine(Path.GetTempPath(), "agent-office-claude-cli")).FullName;

    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default) =>
        await GetStreamingResponseAsync(messages, options, cancellationToken).ToChatResponseAsync(cancellationToken);

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var (system, prompt) = Render(messages.ToList(), options);
        var sessionId = options?.ConversationId;
        var hasTools = options?.Tools is { Count: > 0 };
        using var lease = toolHost.Register(options?.Tools);

        var psi = new ProcessStartInfo(command)
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardInputEncoding = new UTF8Encoding(false),
            StandardOutputEncoding = Encoding.UTF8,
            UseShellExecute = false,
            WorkingDirectory = WorkDir,
        };
        foreach (var arg in new[]
                 {
                     "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
                     "--model", model,
                     "--system-prompt", system,
                     "--tools", "",              // no built-in Bash/Edit/…; colleagues only get their office tools
                     "--setting-sources", "",    // ignore the owner's CLAUDE.md, hooks and plugins
                     "--disable-slash-commands",
                     "--strict-mcp-config",
                 })
        {
            psi.ArgumentList.Add(arg);
        }
        if (hasTools)
        {
            var mcp = new { mcpServers = new Dictionary<string, object> { [ClaudeCliToolHost.ServerName] = new { type = "http", url = lease.Url } } };
            psi.ArgumentList.Add("--mcp-config");
            psi.ArgumentList.Add(JsonSerializer.Serialize(mcp));
            psi.ArgumentList.Add("--allowedTools");
            psi.ArgumentList.Add($"mcp__{ClaudeCliToolHost.ServerName}");
        }
        if (!string.IsNullOrEmpty(sessionId))
        {
            psi.ArgumentList.Add("--resume");
            psi.ArgumentList.Add(sessionId);
        }

        // Make sure the CLI uses its own login rather than a key that happens to be in our environment.
        psi.Environment.Remove("ANTHROPIC_API_KEY");
        psi.Environment.Remove("ANTHROPIC_AUTH_TOKEN");
        // Started from inside a Claude Code session, the CLI would otherwise think it is nested.
        psi.Environment.Remove("CLAUDECODE");
        psi.Environment.Remove("CLAUDE_CODE_ENTRYPOINT");
        // ask_colleague runs a whole colleague turn; don't let the CLI give up on it.
        psi.Environment["MCP_TOOL_TIMEOUT"] = "3600000";
        // Which Claude account this office uses: its own token if it has one, else the login in the config folder.
        if (configDir is not null) psi.Environment["CLAUDE_CONFIG_DIR"] = configDir;
        if (oauthToken is not null) psi.Environment["CLAUDE_CODE_OAUTH_TOKEN"] = oauthToken;

        Process process;
        try { process = Process.Start(psi) ?? throw new InvalidOperationException("Couldn't start the Claude CLI."); }
        catch (Win32Exception ex)
        {
            throw new InvalidOperationException($"Couldn't run '{command}' ({ex.Message}). Install Claude Code and run 'claude login', or set Providers:ClaudeCli:Command.", ex);
        }

        using var _ = process;
        var stderr = process.StandardError.ReadToEndAsync(CancellationToken.None);
        string? error = null;
        var finished = false;

        try
        {
            await process.StandardInput.WriteAsync(prompt);
            process.StandardInput.Close();

            while (await process.StandardOutput.ReadLineAsync(cancellationToken) is { } line)
            {
                if (line.Length == 0 || line[0] != '{') continue;
                using var doc = JsonDocument.Parse(line);
                var evt = doc.RootElement;
                if (evt.TryGetProperty("session_id", out var sid) && sid.GetString() is { Length: > 0 } s) sessionId = s;

                switch (Str(evt, "type"))
                {
                    case "system" when Str(evt, "subtype") == "init" && hasTools:
                        CheckToolsConnected(evt);
                        break;

                    case "stream_event" when evt.GetProperty("event") is var e && Str(e, "type") == "content_block_delta":
                        var delta = e.GetProperty("delta");
                        AIContent? piece = Str(delta, "type") switch
                        {
                            "text_delta" => new TextContent(Str(delta, "text")),
                            "thinking_delta" => new TextReasoningContent(Str(delta, "thinking")),
                            _ => null,
                        };
                        if (piece is not null) yield return Update(ChatRole.Assistant, piece, sessionId);
                        break;

                    // Text already arrived as deltas; complete messages only add the tool calls.
                    case "assistant":
                        foreach (var block in Blocks(evt).Where(b => Str(b, "type") == "tool_use"))
                        {
                            var args = block.TryGetProperty("input", out var input) && input.ValueKind == JsonValueKind.Object
                                ? input.EnumerateObject().ToDictionary(p => p.Name, p => (object?)p.Value.Clone())
                                : [];
                            yield return Update(ChatRole.Assistant, new FunctionCallContent(Str(block, "id"), ToolName(Str(block, "name")), args) { InformationalOnly = true }, sessionId);
                        }
                        break;

                    case "user":
                        foreach (var block in Blocks(evt).Where(b => Str(b, "type") == "tool_result"))
                        {
                            var text = ResultText(block);
                            var failed = block.TryGetProperty("is_error", out var ie) && ie.ValueKind == JsonValueKind.True;
                            yield return Update(ChatRole.Tool, new FunctionResultContent(Str(block, "tool_use_id"), text)
                            {
                                Exception = failed ? new InvalidOperationException(text) : null,
                            }, sessionId);
                        }
                        break;

                    case "result":
                        finished = true;
                        if (evt.TryGetProperty("is_error", out var isError) && isError.ValueKind == JsonValueKind.True)
                        {
                            error = Str(evt, "result") is { Length: > 0 } r ? r : Str(evt, "subtype");
                            break;
                        }
                        var usage = evt.TryGetProperty("usage", out var u) ? u : default;
                        yield return new ChatResponseUpdate(ChatRole.Assistant, [new UsageContent(new UsageDetails
                        {
                            InputTokenCount = Long(usage, "input_tokens") + Long(usage, "cache_read_input_tokens") + Long(usage, "cache_creation_input_tokens"),
                            OutputTokenCount = Long(usage, "output_tokens"),
                        })])
                        {
                            ConversationId = sessionId,
                            ModelId = model,
                            FinishReason = ChatFinishReason.Stop,
                        };
                        break;
                }
            }

            await process.WaitForExitAsync(CancellationToken.None);
        }
        finally
        {
            if (!process.HasExited)
            {
                try { process.Kill(entireProcessTree: true); }
                catch (InvalidOperationException) { } // exited in the meantime
            }
        }

        cancellationToken.ThrowIfCancellationRequested();
        if (error is not null) throw new InvalidOperationException($"Claude CLI: {error}");
        if (!finished)
        {
            var detail = (await stderr).Trim();
            throw new InvalidOperationException($"Claude CLI exited with code {process.ExitCode}" +
                (detail.Length > 0 ? $": {Shorten(detail, 600)}" : ". Is it logged in? Run 'claude login'."));
        }
    }

    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceKey is null && serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose() { }

    /// <summary>Finds the CLI even when the app was started from an IDE with a minimal PATH.</summary>
    public static string? Locate(string command)
    {
        if (Path.IsPathRooted(command)) return File.Exists(command) ? command : null;
        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var names = OperatingSystem.IsWindows() ? new[] { $"{command}.exe", $"{command}.cmd", command } : [command];
        var dirs = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
            .Concat([Path.Combine(home, ".claude", "local"), Path.Combine(home, ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin"]);
        return dirs.SelectMany(d => names.Select(n => Path.Combine(d, n))).FirstOrDefault(File.Exists);
    }

    /// <summary>
    /// A resumed CLI session already holds the history, so only the new messages are sent. A fresh one
    /// gets earlier messages (e.g. a meeting transcript) as context, and the trailing user messages as the prompt.
    /// </summary>
    private static (string System, string Prompt) Render(List<ChatMessage> messages, ChatOptions? options)
    {
        var system = new StringBuilder(options?.Instructions ?? "");
        foreach (var m in messages.Where(m => m.Role == ChatRole.System)) system.AppendLine().AppendLine(m.Text);
        if (system.Length == 0) system.Append("You are a helpful assistant.");

        var rest = messages.Where(m => m.Role != ChatRole.System).ToList();
        var split = rest.Count;
        while (split > 0 && rest[split - 1].Role == ChatRole.User) split--;

        var prompt = new StringBuilder();
        if (split > 0)
        {
            prompt.AppendLine("<conversation_so_far>");
            foreach (var m in rest[..split]) prompt.AppendLine(Describe(m));
            prompt.AppendLine("</conversation_so_far>").AppendLine();
        }
        foreach (var m in rest[split..]) prompt.AppendLine(m.Text);
        if (split == rest.Count) prompt.Append("It's your turn to speak.");
        return (system.ToString().Trim(), prompt.ToString().Trim());
    }

    private static string Describe(ChatMessage m)
    {
        var who = m.AuthorName ?? (m.Role == ChatRole.Assistant ? "You" : m.Role == ChatRole.User ? "User" : m.Role.Value);
        var parts = m.Contents.Select(c => c switch
        {
            TextContent t => t.Text,
            FunctionCallContent f => $"[used {f.Name} {JsonSerializer.Serialize(f.Arguments, Json.Options)}]",
            FunctionResultContent r => $"[result: {Shorten(r.Result?.ToString() ?? "", 2000)}]",
            _ => "",
        }).Where(s => s.Length > 0);
        return $"{who}: {string.Join('\n', parts)}";
    }

    private static void CheckToolsConnected(JsonElement init)
    {
        if (!init.TryGetProperty("mcp_servers", out var servers) || servers.ValueKind != JsonValueKind.Array) return;
        var office = servers.EnumerateArray().FirstOrDefault(s => Str(s, "name") == ClaudeCliToolHost.ServerName);
        if (office.ValueKind == JsonValueKind.Object && Str(office, "status") is not ("connected" or ""))
            throw new InvalidOperationException($"Claude CLI couldn't reach the office tools (MCP status: {Str(office, "status")}).");
    }

    private static ChatResponseUpdate Update(ChatRole role, AIContent content, string? sessionId) =>
        new(role, [content]) { ConversationId = sessionId };

    private static IEnumerable<JsonElement> Blocks(JsonElement evt) =>
        evt.TryGetProperty("message", out var msg) && msg.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array
            ? content.EnumerateArray()
            : [];

    private static string ResultText(JsonElement block)
    {
        if (!block.TryGetProperty("content", out var c)) return "";
        return c.ValueKind switch
        {
            JsonValueKind.String => c.GetString() ?? "",
            JsonValueKind.Array => string.Join('\n', c.EnumerateArray().Select(p => Str(p, "text")).Where(t => t.Length > 0)),
            _ => c.ToString(),
        };
    }

    private static string ToolName(string name) => name.StartsWith(ToolPrefix, StringComparison.Ordinal) ? name[ToolPrefix.Length..] : name;

    private static string Str(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() ?? "" : "";

    private static long Long(JsonElement e, string name) =>
        e.ValueKind == JsonValueKind.Object && e.TryGetProperty(name, out var v) && v.TryGetInt64(out var n) ? n : 0;

    private static string Shorten(string text, int max) => text.Length <= max ? text : text[..max] + "…";
}
