using System.ComponentModel;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;
using AgentOffice.Domain;
using Microsoft.Extensions.AI;

namespace AgentOffice.Agents;

/// <summary>Per-run context: which mission, which folder, how deep in a colleague chain.</summary>
public sealed record RunContext(
    string MissionId,
    string Workspace,
    int Depth,
    IReadOnlyList<string> Chain,
    bool InMeeting,
    CancellationToken Cancellation);

/// <summary>
/// The tools one colleague gets for one run. Tools are generic office abilities, not role-specific:
/// what a colleague does with them comes from their persona.
/// </summary>
public sealed partial class AgentToolbox(
    OfficeRuntime runtime,
    AgentProfile me,
    RunContext ctx,
    OfficeOptions options,
    IHttpClientFactory httpFactory)
{
    public IList<AITool> Build(IReadOnlyList<AgentProfile> colleagues)
    {
        var tools = new List<AITool>
        {
            AIFunctionFactory.Create(BoardList, "board_list", "List tasks on this mission's shared board."),
            AIFunctionFactory.Create(BoardAdd, "board_add", "Add a task to the shared board. Returns the task id."),
            AIFunctionFactory.Create(BoardUpdate, "board_update", "Update a board task's status (todo, doing, blocked, done) and optional note."),
        };

        if (me.Can.Files)
        {
            tools.Add(AIFunctionFactory.Create(ListFiles, "list_files", "List files and folders in the mission workspace."));
            tools.Add(AIFunctionFactory.Create(ReadFile, "read_file", "Read a text file from the mission workspace."));
            tools.Add(AIFunctionFactory.Create(WriteFile, "write_file", "Create or overwrite a text file in the mission workspace."));
        }

        if (me.Can.Shell)
        {
            tools.Add(AIFunctionFactory.Create(RunCommand, "run_command",
                $"Run a shell command in the mission workspace (timeout {options.ShellTimeoutSeconds}s). Use for builds, tests, git."));
        }

        if (me.Can.Web)
        {
            tools.Add(AIFunctionFactory.Create(FetchUrl, "fetch_url", "Fetch a public web page and return its text."));
        }

        var others = colleagues.Where(c => c.Id != me.Id).ToList();
        if (me.Can.Delegate && !ctx.InMeeting && others.Count > 0 && ctx.Depth < options.MaxDelegationDepth)
        {
            var roster = string.Join(", ", others.Select(c => c.Name));
            tools.Add(AIFunctionFactory.Create(AskColleague, "ask_colleague",
                $"Walk over to a colleague and ask them to do something or give input. They can't see your conversation, so include all context. Colleagues: {roster}."));
        }

        return tools;
    }

    // ---------------------------------------------------------------- board

    private string BoardList()
    {
        var mission = runtime.Store.FindMission(ctx.MissionId);
        if (mission is null || mission.Board.Count == 0) return "The board is empty.";
        return string.Join('\n', mission.Board.Select(t =>
            $"{t.Id} [{t.Status}] {t.Title}" + (t.Assignee is null ? "" : $" — {t.Assignee}") + (t.Note is null ? "" : $" ({t.Note})")));
    }

    private string BoardAdd(
        [Description("Short task title.")] string title,
        [Description("Colleague name responsible, if any.")] string? assignee = null)
    {
        var id = runtime.UpdateBoard(ctx.MissionId, board =>
        {
            var next = $"T{board.Count + 1}";
            board.Add(new BoardTask { Id = next, Title = Clip(title, 140), Assignee = assignee, Status = "todo" });
            return next;
        });
        return $"Added {id}.";
    }

    private string BoardUpdate(
        [Description("Task id, e.g. T3.")] string id,
        [Description("todo | doing | blocked | done")] string status,
        [Description("Optional short note.")] string? note = null)
    {
        status = status.Trim().ToLowerInvariant();
        if (status is not ("todo" or "doing" or "blocked" or "done")) return "Status must be todo, doing, blocked or done.";
        var found = runtime.UpdateBoard(ctx.MissionId, board =>
        {
            var task = board.FirstOrDefault(t => string.Equals(t.Id, id.Trim(), StringComparison.OrdinalIgnoreCase));
            if (task is null) return false;
            task.Status = status;
            if (note is not null) task.Note = Clip(note, 200);
            return true;
        });
        return found ? $"{id} is now {status}." : $"No task {id}. Use board_list to see ids.";
    }

    // ---------------------------------------------------------------- files

    private string ListFiles([Description("Folder relative to the workspace root. Default '.'.")] string path = ".")
    {
        var dir = Sandbox(path);
        if (!Directory.Exists(dir)) return $"No folder '{path}'.";
        var entries = new DirectoryInfo(dir).EnumerateFileSystemInfos()
            .Where(e => e.Name is not (".git" or "node_modules" or "bin" or "obj"))
            .OrderBy(e => e is FileInfo).ThenBy(e => e.Name)
            .Take(300)
            .Select(e => e is DirectoryInfo ? e.Name + "/" : $"{e.Name} ({((FileInfo)e).Length:N0} B)");
        var text = string.Join('\n', entries);
        return text.Length == 0 ? "(empty folder)" : text;
    }

    private string ReadFile(
        [Description("File path relative to the workspace root.")] string path,
        [Description("1-based line to start at. Default 1.")] int startLine = 1,
        [Description("Max lines to return. Default 400.")] int maxLines = 400)
    {
        var file = Sandbox(path);
        if (!File.Exists(file)) return $"No file '{path}'.";
        var lines = File.ReadLines(file).Skip(Math.Max(0, startLine - 1)).Take(Math.Clamp(maxLines, 1, 2000));
        return Clip(string.Join('\n', lines), options.MaxToolOutputChars);
    }

    private string WriteFile(
        [Description("File path relative to the workspace root.")] string path,
        [Description("Full file content.")] string content)
    {
        var file = Sandbox(path);
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        File.WriteAllText(file, content);
        runtime.Bus.Publish("workspace.file", ctx.MissionId, me.Id, new { path = Relative(file), bytes = Encoding.UTF8.GetByteCount(content) });
        return $"Wrote {Relative(file)} ({content.Length:N0} chars).";
    }

    // ---------------------------------------------------------------- shell

    private async Task<string> RunCommand([Description("Shell command line.")] string command, CancellationToken cancellationToken)
    {
        var psi = OperatingSystem.IsWindows()
            ? new ProcessStartInfo("cmd.exe") { ArgumentList = { "/c", command } }
            : new ProcessStartInfo("/bin/bash") { ArgumentList = { "-c", command } };
        psi.WorkingDirectory = ctx.Workspace;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        psi.UseShellExecute = false;

        using var process = Process.Start(psi) ?? throw new InvalidOperationException("Could not start shell.");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(options.ShellTimeoutSeconds));

        var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
        var stderr = process.StandardError.ReadToEndAsync(timeout.Token);
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { /* already exited */ }
            if (cancellationToken.IsCancellationRequested) throw;
            return $"Timed out after {options.ShellTimeoutSeconds}s and was stopped.";
        }

        var output = $"exit code {process.ExitCode}\n{await stdout}{await stderr}";
        return Clip(output, options.MaxToolOutputChars);
    }

    // ---------------------------------------------------------------- web

    private const int MaxRedirects = 5;
    private const int MaxBodyBytes = 2 * 1024 * 1024;

    private async Task<string> FetchUrl([Description("Absolute http(s) URL.")] string url, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))
            return "Only absolute http(s) URLs are allowed.";

        var client = httpFactory.CreateClient("web");
        try
        {
            for (var hop = 0; ; hop++)
            {
                using var response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                if ((int)response.StatusCode is >= 300 and < 400 && response.Headers.Location is { } location)
                {
                    if (hop >= MaxRedirects) return $"Stopped after {MaxRedirects} redirects.";
                    uri = location.IsAbsoluteUri ? location : new Uri(uri, location);
                    if (uri.Scheme is not ("http" or "https")) return "Redirected to a non-http(s) address; not followed.";
                    continue;
                }

                var body = await ReadCappedAsync(response.Content, cancellationToken);
                var text = TagRegex().Replace(ScriptRegex().Replace(body, " "), " ");
                text = WebUtility.HtmlDecode(SpaceRegex().Replace(text, " ")).Trim();
                return $"HTTP {(int)response.StatusCode} {uri}\n" + Clip(text, options.MaxToolOutputChars);
            }
        }
        catch (HttpRequestException ex) when (ex.InnerException is PrivateAddressException || ex is { Message: var m } && m.Contains(PrivateAddressException.Text, StringComparison.Ordinal))
        {
            return PrivateAddressException.Text;
        }
        catch (PrivateAddressException)
        {
            return PrivateAddressException.Text;
        }
    }

    private static async Task<string> ReadCappedAsync(HttpContent content, CancellationToken ct)
    {
        await using var stream = await content.ReadAsStreamAsync(ct);
        var buffer = new byte[MaxBodyBytes];
        var total = 0;
        int read;
        while (total < buffer.Length && (read = await stream.ReadAsync(buffer.AsMemory(total), ct)) > 0) total += read;
        return Encoding.UTF8.GetString(buffer, 0, total);
    }

    /// <summary>
    /// SocketsHttpHandler.ConnectCallback for the "web" client: resolves the host once, refuses private,
    /// loopback and link-local addresses, and connects to exactly the addresses it checked.
    /// </summary>
    public static async ValueTask<Stream> ConnectPublicOnlyAsync(SocketsHttpConnectionContext context, CancellationToken cancellationToken)
    {
        var host = context.DnsEndPoint.Host;
        IPAddress[] addresses = IPAddress.TryParse(host, out var literal)
            ? [literal]
            : await Dns.GetHostAddressesAsync(host, cancellationToken);
        if (addresses.Length == 0 || addresses.Any(IsPrivate)) throw new PrivateAddressException();

        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(addresses, context.DnsEndPoint.Port, cancellationToken);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    private sealed class PrivateAddressException() : Exception(Text)
    {
        public const string Text = "That address is private or local; only public sites are allowed.";
    }

    internal static bool IsPrivate(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip)) return true;
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6UniqueLocal;
        var b = ip.GetAddressBytes();
        return b[0] == 10 || b[0] == 127 || b[0] == 0
            || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
            || (b[0] == 192 && b[1] == 168)
            || (b[0] == 169 && b[1] == 254)
            || (b[0] == 100 && b[1] >= 64 && b[1] <= 127);
    }

    // ---------------------------------------------------------------- colleagues

    private Task<string> AskColleague(
        [Description("Colleague name.")] string colleague,
        [Description("What you need, with all the context they need.")] string request,
        CancellationToken cancellationToken) =>
        runtime.AskColleagueAsync(me, colleague, request, ctx, cancellationToken);

    // ---------------------------------------------------------------- helpers

    /// <summary>
    /// Resolves a path inside the workspace, refusing anything that escapes it: "..", absolute paths,
    /// and symlinks at ANY level (a linked folder like ws/link → /etc would otherwise expose link/passwd).
    /// Paths that don't exist yet are checked through their deepest existing parent.
    /// </summary>
    private string Sandbox(string path)
    {
        var root = Path.GetFullPath(ctx.Workspace);
        var full = Path.GetFullPath(Path.Combine(root, path ?? "."));
        if (!Paths.IsInside(full, root))
            throw new InvalidOperationException($"'{path}' is outside the mission workspace.");

        if (!Paths.IsInside(RealPath(full), RealPath(root)))
            throw new InvalidOperationException($"'{path}' goes through a link that points outside the mission workspace.");
        return full;
    }

    /// <summary>Walks the path one component at a time, replacing each existing symlink with its final target.</summary>
    private static string RealPath(string fullPath)
    {
        var current = Path.GetPathRoot(fullPath) ?? "";
        var parts = fullPath[current.Length..].Split(new[] { Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar }, StringSplitOptions.RemoveEmptyEntries);
        foreach (var part in parts)
        {
            var next = Path.Combine(current, part);
            FileSystemInfo info = Directory.Exists(next) ? new DirectoryInfo(next) : new FileInfo(next);
            if (info.Exists && info.LinkTarget is not null)
                next = info.ResolveLinkTarget(returnFinalTarget: true)?.FullName ?? next;
            current = Path.GetFullPath(next);
        }
        return current;
    }

    private string Relative(string full) => Path.GetRelativePath(ctx.Workspace, full).Replace('\\', '/');

    private static string Clip(string text, int max) => text.Length <= max ? text : text[..max] + $"\n…[truncated {text.Length - max:N0} chars]";

    [GeneratedRegex(@"<(script|style)[\s\S]*?</\1>", RegexOptions.IgnoreCase)]
    private static partial Regex ScriptRegex();

    [GeneratedRegex(@"<[^>]+>")]
    private static partial Regex TagRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex SpaceRegex();
}
