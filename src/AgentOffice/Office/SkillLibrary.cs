using System.Text;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using AgentOffice.Agents;
using AgentOffice.Domain;
using Microsoft.Extensions.Options;

namespace AgentOffice.Office;

/// <summary>
/// Skills in the Agent Skills format: a folder per skill holding a SKILL.md (YAML frontmatter with
/// name and description, then Markdown instructions) and optional bundled files.
/// Skills made in the office live in DataDir/skills and can be edited. Read-only skills come from the ones that
/// ship with the app (Data/skills, vetted copies of upstream skills with their licenses) and from folders listed in
/// Office:SkillDirs (e.g. ~/.claude/skills). A name in the office wins over the same name elsewhere.
/// </summary>
public sealed partial class SkillLibrary(IOptions<OfficeOptions> options, IHostEnvironment env, OfficeStore store, EventBus bus, RoleCatalog roles)
{
    public sealed record SkillView(string Name, string Description, string Instructions, string Source, bool ReadOnly, IReadOnlyList<string> Files)
    {
        [JsonIgnore] public string Dir { get; init; } = "";
    }

    private const int MaxInstructions = 60_000;
    public const string OfficeSource = "office";
    public const string BuiltInSource = "built-in";

    /// <summary>Provenance files kept next to vendored skills; they aren't instructions, so colleagues don't see them.</summary>
    private static readonly HashSet<string> NotForAgents = new(StringComparer.OrdinalIgnoreCase) { "LICENSE", "LICENSE.txt", "LICENSE.md", "NOTICE", "NOTICE.txt", "SOURCE.md" };

    private string OfficeDir => Path.Combine(Paths.Resolve(options.Value.DataDir, env.ContentRootPath), "skills");

    public IReadOnlyList<SkillView> List()
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var list = new List<SkillView>();
        foreach (var (root, source, readOnly) in Roots())
        {
            if (!Directory.Exists(root)) continue;
            foreach (var dir in Directory.EnumerateDirectories(root).Order(StringComparer.Ordinal))
            {
                var skill = Load(dir, source, readOnly);
                if (skill is not null && seen.Add(skill.Name)) list.Add(skill);
            }
        }
        return list;
    }

    /// <summary>The named skills that exist, in the order given; unknown names are skipped.</summary>
    public IReadOnlyList<SkillView> Resolve(IEnumerable<string>? names)
    {
        var all = List().ToDictionary(s => s.Name, StringComparer.Ordinal);
        return (names ?? []).Distinct().Select(n => all.GetValueOrDefault(n)).OfType<SkillView>().ToList();
    }

    /// <summary>Creates an office skill, or (when <paramref name="mustBeNew"/> is false) replaces the office skill with that name.</summary>
    public SkillView Save(string? name, string? description, string? instructions, bool mustBeNew)
    {
        name = (name ?? "").Trim();
        description = WhitespaceRegex().Replace(description ?? "", " ").Trim();
        instructions = (instructions ?? "").Replace("\r\n", "\n").Trim();
        if (!NameRegex().IsMatch(name) || name.Length > 64)
            throw new OfficeException(400, "A skill name uses lowercase letters, digits and hyphens, like release-notes (max 64 characters).");
        if (description.Length is 0 or > 1024)
            throw new OfficeException(400, "Describe when to use the skill (1–1,024 characters). Colleagues decide from this whether to load it.");
        if (instructions.Length > MaxInstructions) throw new OfficeException(400, $"Instructions are too long (max {MaxInstructions:N0} characters).");

        var existing = List().FirstOrDefault(s => s.Name == name);
        if (mustBeNew && existing is not null) throw new OfficeException(409, $"There is already a skill called {name}.");

        var dir = Path.Combine(OfficeDir, name);
        Directory.CreateDirectory(dir);
        var text = $"---\nname: {name}\ndescription: \"{description.Replace("\\", "\\\\").Replace("\"", "\\\"")}\"\n---\n\n{instructions}\n";
        var file = Path.Combine(dir, "SKILL.md");
        File.WriteAllText(file + ".tmp", text, new UTF8Encoding(false));
        File.Move(file + ".tmp", file, overwrite: true);
        Changed();
        return List().First(s => s.Name == name);
    }

    /// <summary>Imports a SKILL.md's text into the office library.</summary>
    public SkillView Import(string? text)
    {
        var (meta, body) = Parse(text ?? "");
        if (!meta.TryGetValue("name", out var name))
            throw new OfficeException(400, "That SKILL.md has no name in its frontmatter (the block between --- lines at the top).");
        return Save(name, meta.GetValueOrDefault("description"), body, mustBeNew: false);
    }

    /// <summary>
    /// Copies a read-only skill (built-in or from a skill folder) into the office library, bundled files, license and
    /// provenance included, so it can be edited. The office copy then takes precedence; deleting it brings the original back.
    /// </summary>
    public SkillView CopyToOffice(string name)
    {
        var skill = List().FirstOrDefault(s => s.Name == name) ?? throw new OfficeException(404, "No such skill.");
        if (!skill.ReadOnly) throw new OfficeException(409, $"{name} is already an office skill.");
        if (!NameRegex().IsMatch(name)) throw new OfficeException(400, $"'{name}' isn't a valid skill name for the office library.");

        var target = Path.Combine(OfficeDir, name);
        if (Directory.Exists(target)) throw new OfficeException(409, $"The office library already has a folder called {name}.");
        foreach (var file in Directory.EnumerateFiles(skill.Dir, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(skill.Dir, file);
            if (rel.StartsWith('.') || rel.Contains($"{Path.DirectorySeparatorChar}.")) continue;
            var dest = Path.Combine(target, rel);
            Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
            File.Copy(file, dest);
        }
        Changed();
        return List().First(s => s.Name == name);
    }

    /// <summary>Deletes an office skill and takes it off every colleague and role that had it.</summary>
    public void Delete(string name)
    {
        var skill = List().FirstOrDefault(s => s.Name == name) ?? throw new OfficeException(404, "No such skill.");
        if (skill.ReadOnly)
            throw new OfficeException(400, skill.Source == BuiltInSource ? $"{name} ships with Agent Office and can't be deleted." : $"{name} comes from {skill.Source}; remove it there.");
        Directory.Delete(skill.Dir, recursive: true);

        // Another folder may still provide a skill with this name, in which case attachments keep working.
        if (List().All(s => s.Name != name))
        {
            var (changedAgents, changedRoles) = store.Write(s => (
                s.Agents.Where(a => a.Skills.Remove(name)).Select(a => OfficeStore.Clone(a)!).ToList(),
                s.Roles.Count(r => r.Skills.Remove(name))));
            foreach (var a in changedAgents) bus.Publish("office.updated", agentId: a.Id, data: a);
            if (changedRoles > 0) bus.Publish("roles.updated", data: new { roles = roles.List() });
        }
        Changed();
    }

    private void Changed() => bus.Publish("skills.updated", data: new { skills = List() });

    private IEnumerable<(string Root, string Source, bool ReadOnly)> Roots()
    {
        yield return (OfficeDir, OfficeSource, false);
        var builtIn = Path.Combine(AppContext.BaseDirectory, "Data", "skills");
        yield return (Directory.Exists(builtIn) ? builtIn : Path.Combine(env.ContentRootPath, "Data", "skills"), BuiltInSource, true);
        foreach (var d in options.Value.SkillDirs.Where(d => !string.IsNullOrWhiteSpace(d)))
            yield return (Paths.Resolve(d, env.ContentRootPath), d, true);
    }

    private static SkillView? Load(string dir, string source, bool readOnly)
    {
        var file = Path.Combine(dir, "SKILL.md");
        if (!File.Exists(file)) return null;
        try
        {
            var (meta, body) = Parse(File.ReadAllText(file));
            var name = meta.GetValueOrDefault("name") is { Length: > 0 } n ? n : Path.GetFileName(dir);
            var files = Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories)
                .Select(f => Path.GetRelativePath(dir, f).Replace('\\', '/'))
                .Where(f => f != "SKILL.md" && !f.StartsWith('.') && !f.Contains("/.") && !NotForAgents.Contains(f))
                .Order(StringComparer.Ordinal).Take(100).ToList();
            return new SkillView(name, meta.GetValueOrDefault("description") ?? "", body, source, readOnly, files) { Dir = dir };
        }
        catch (IOException) { return null; }
        catch (UnauthorizedAccessException) { return null; }
    }

    /// <summary>
    /// Splits a SKILL.md into its frontmatter fields and body. Handles the YAML a SKILL.md uses in practice:
    /// <c>key: value</c> lines, quoted values, and <c>|</c> / <c>&gt;</c> block values.
    /// </summary>
    public static (Dictionary<string, string> Meta, string Body) Parse(string text)
    {
        text = text.Replace("\r\n", "\n").TrimStart('﻿');
        var meta = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (!text.StartsWith("---\n", StringComparison.Ordinal)) return (meta, text.Trim());
        var end = text.IndexOf("\n---", 3, StringComparison.Ordinal);
        if (end < 0) return (meta, text.Trim());

        var lines = end > 4 ? text[4..end].Split('\n') : [];
        for (var i = 0; i < lines.Length; i++)
        {
            var m = FieldRegex().Match(lines[i]);
            if (!m.Success) continue;
            var key = m.Groups[1].Value;
            var value = m.Groups[2].Value.Trim();
            if (value is "|" or ">" or "|-" or ">-")
            {
                var block = new List<string>();
                while (i + 1 < lines.Length && (lines[i + 1].StartsWith(' ') || lines[i + 1].Length == 0)) block.Add(lines[++i].Trim());
                value = string.Join(value.StartsWith('|') ? "\n" : " ", block).Trim();
            }
            else if (value.Length >= 2 && (value[0] == '"' && value[^1] == '"'))
            {
                value = value[1..^1].Replace("\\\"", "\"").Replace("\\\\", "\\");
            }
            else if (value.Length >= 2 && value[0] == '\'' && value[^1] == '\'')
            {
                value = value[1..^1].Replace("''", "'");
            }
            meta[key] = value;
        }

        var bodyStart = text.IndexOf('\n', end + 4);
        return (meta, bodyStart < 0 ? "" : text[(bodyStart + 1)..].Trim());
    }

    [GeneratedRegex(@"^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex NameRegex();

    [GeneratedRegex(@"^([A-Za-z][\w-]*):\s?(.*)$")]
    private static partial Regex FieldRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
