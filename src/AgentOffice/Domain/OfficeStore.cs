using System.Text.Json;
using Microsoft.Extensions.Options;

namespace AgentOffice.Domain;

/// <summary>
/// Small JSON-file store. One lock guards the whole state; writes are atomic (temp file + move).
/// Good enough for a single-owner office; swap for SQL Server/EF Core if you outgrow it.
/// </summary>
public sealed class OfficeStore
{
    private readonly object _gate = new();
    private readonly string _stateFile;
    private readonly string _eventsDir;
    private readonly OfficeState _state;

    public OfficeStore(IOptions<OfficeOptions> options, IHostEnvironment env)
    {
        var dataDir = Paths.Resolve(options.Value.DataDir, env.ContentRootPath);
        Directory.CreateDirectory(dataDir);
        _eventsDir = Path.Combine(dataDir, "events");
        Directory.CreateDirectory(_eventsDir);
        _stateFile = Path.Combine(dataDir, "office.json");

        _state = File.Exists(_stateFile)
            ? JsonSerializer.Deserialize<OfficeState>(File.ReadAllText(_stateFile), Json.Options) ?? new()
            : new();

        // Anything that was running when the process stopped is no longer running.
        foreach (var m in _state.Missions.Where(m => m.Status == MissionStatus.Running))
        {
            m.Status = MissionStatus.Cancelled;
            m.Error = "Interrupted by server restart.";
        }
    }

    /// <summary>Reads under the lock. Return copies (see <see cref="Clone{T}"/>) if the result leaves the lock.</summary>
    public T Read<T>(Func<OfficeState, T> read)
    {
        lock (_gate) return read(_state);
    }

    /// <summary>Mutates under the lock and persists.</summary>
    public T Write<T>(Func<OfficeState, T> write)
    {
        lock (_gate)
        {
            var result = write(_state);
            Save();
            return result;
        }
    }

    public void Write(Action<OfficeState> write) => Write(s => { write(s); return 0; });

    public AgentProfile? FindAgent(string idOrName) => Read(s => Clone(
        s.Agents.FirstOrDefault(a => a.Id == idOrName)
        ?? s.Agents.FirstOrDefault(a => string.Equals(a.Name, idOrName, StringComparison.OrdinalIgnoreCase))));

    public Mission? FindMission(string id) => Read(s => Clone(s.Missions.FirstOrDefault(m => m.Id == id)));

    public void AppendEvent(OfficeEvent evt)
    {
        var file = Path.Combine(_eventsDir, $"{evt.MissionId ?? "office"}.jsonl");
        var line = JsonSerializer.Serialize(evt, Json.Options) + Environment.NewLine;
        lock (_gate) File.AppendAllText(file, line);
    }

    public List<JsonElement> ReadEvents(string missionId, int last)
    {
        var file = Path.Combine(_eventsDir, $"{Path.GetFileName(missionId)}.jsonl");
        if (!File.Exists(file)) return [];
        string[] lines;
        lock (_gate) lines = File.ReadAllLines(file);
        return lines.TakeLast(last)
            .Select(l => JsonSerializer.Deserialize<JsonElement>(l, Json.Options))
            .ToList();
    }

    public static T? Clone<T>(T? value) =>
        value is null ? default : JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Json.Options), Json.Options);

    private void Save()
    {
        var tmp = _stateFile + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(_state, Json.Options));
        File.Move(tmp, _stateFile, overwrite: true);
    }
}

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = false };
}

public static class Paths
{
    /// <summary>Expands ~ and makes the path absolute (relative to <paramref name="baseDir"/>).</summary>
    public static string Resolve(string path, string baseDir)
    {
        if (path.StartsWith('~'))
        {
            var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            path = Path.Combine(home, path.TrimStart('~').TrimStart('/', '\\'));
        }
        return Path.GetFullPath(Path.IsPathRooted(path) ? path : Path.Combine(baseDir, path));
    }

    /// <summary>True when <paramref name="candidate"/> is <paramref name="root"/> or inside it.</summary>
    public static bool IsInside(string candidate, string root)
    {
        var c = Path.GetFullPath(candidate).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var r = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var cmp = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        return c.Equals(r, cmp) || c.StartsWith(r + Path.DirectorySeparatorChar, cmp);
    }
}
