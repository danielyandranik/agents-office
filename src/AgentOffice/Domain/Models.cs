namespace AgentOffice.Domain;

/// <summary>A colleague in the office. Everything about the role is data — nothing is hard-coded.</summary>
public sealed class AgentProfile
{
    public string Id { get; set; } = Ids.New("ag");
    public string Name { get; set; } = "";
    public string Title { get; set; } = "";

    /// <summary>Free-form instructions: expertise, working style, boundaries.</summary>
    public string Persona { get; set; } = "";

    /// <summary>Empty = office default provider/model.</summary>
    public string Provider { get; set; } = "";
    public string Model { get; set; } = "";

    public Appearance Look { get; set; } = new();
    public Capabilities Can { get; set; } = new();

    /// <summary>Desk slot on the floor plan (0-based).</summary>
    public int Desk { get; set; }
    public DateTimeOffset HiredAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Appearance
{
    public string Skin { get; set; } = "#C68B59";
    public string Hair { get; set; } = "#2B2118";
    public string HairStyle { get; set; } = "short";   // short | long | bun | curly | bald
    public string Shirt { get; set; } = "#3E7CB1";
    public string Accessory { get; set; } = "none";    // none | glasses | headphones | cap
}

public sealed class Capabilities
{
    /// <summary>Read/write files inside the mission workspace.</summary>
    public bool Files { get; set; } = true;
    /// <summary>Run shell commands inside the mission workspace. Off by default.</summary>
    public bool Shell { get; set; }
    /// <summary>Fetch public web pages.</summary>
    public bool Web { get; set; }
    /// <summary>Ask colleagues for help.</summary>
    public bool Delegate { get; set; } = true;
}

public static class MissionModes
{
    /// <summary>One lead owns the goal and pulls colleagues in as needed.</summary>
    public const string Delegate = "delegate";
    /// <summary>Selected colleagues discuss in turns (Agent Framework group chat workflow).</summary>
    public const string Meeting = "meeting";
    /// <summary>Owner talks 1:1 with a colleague.</summary>
    public const string Chat = "chat";
}

public static class MissionStatus
{
    public const string Idle = "idle";
    public const string Running = "running";
    public const string Done = "done";
    public const string Failed = "failed";
    public const string Cancelled = "cancelled";
}

public sealed class Mission
{
    public string Id { get; set; } = Ids.New("ms");
    public string Title { get; set; } = "";
    public string Goal { get; set; } = "";
    public string Mode { get; set; } = MissionModes.Delegate;
    public string LeadId { get; set; } = "";
    public List<string> Participants { get; set; } = [];
    public string Workspace { get; set; } = "";
    public string Status { get; set; } = MissionStatus.Idle;
    public string? Result { get; set; }
    public string? Error { get; set; }
    public int MeetingRounds { get; set; } = 2;
    public List<BoardTask> Board { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class BoardTask
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Assignee { get; set; }
    public string Status { get; set; } = "todo";        // todo | doing | blocked | done
    public string? Note { get; set; }
}

public sealed class OfficeState
{
    public string Name { get; set; } = "Agent Office";
    public List<AgentProfile> Agents { get; set; } = [];
    public List<Mission> Missions { get; set; } = [];
    /// <summary>Role templates the owner added. One with a built-in's title replaces that built-in.</summary>
    public List<RoleTemplate> Roles { get; set; } = [];
}

/// <summary>A starting point for the hire dialog: fills in the form, which can then be changed.</summary>
public sealed class RoleTemplate
{
    /// <summary>Set for the owner's roles; built-ins from Data/roles.json have none.</summary>
    public string? Id { get; set; }
    public string Title { get; set; } = "";
    public string Summary { get; set; } = "";
    public string Persona { get; set; } = "";
    public Capabilities Can { get; set; } = new();
    public RoleLook Look { get; set; } = new();
}

/// <summary>The part of a look that goes with the role; skin and hair stay the person's own.</summary>
public sealed class RoleLook
{
    public string Shirt { get; set; } = "#3E7CB1";
    public string Accessory { get; set; } = "none";
}

/// <summary>Everything that happens in the office is an event; the UI is a pure projection of these.</summary>
public sealed record OfficeEvent(long Seq, DateTimeOffset Ts, string Kind, string? MissionId, string? AgentId, object? Data);

public sealed record AgentPresence(string Status, string? Detail, string? MissionId, string? With, DateTimeOffset Since);

public static class Ids
{
    public static string New(string prefix) => $"{prefix}_{Guid.NewGuid():N}"[..(prefix.Length + 11)];
}
