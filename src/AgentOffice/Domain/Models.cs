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

    /// <summary>Names of skills from the office's skill library this colleague can load when the work calls for it.</summary>
    public List<string> Skills { get; set; } = [];

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
    /// <summary>See and plan the office board: add cards, move them, assign them.</summary>
    public bool Plan { get; set; }
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
    /// <summary>The office board: work items across all missions.</summary>
    public List<BoardCard> Cards { get; set; } = [];
    public int NextCardNumber { get; set; } = 1;
    /// <summary>Telegram chats the owner paired with the office bot. Nobody else can use it.</summary>
    public List<TelegramChat> TelegramChats { get; set; } = [];
}

public sealed class TelegramChat
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    /// <summary>Muted chats still get answers to their own requests, just no office notifications.</summary>
    public bool Muted { get; set; }
    public DateTimeOffset PairedAt { get; set; } = DateTimeOffset.UtcNow;
}

public static class CardStatus
{
    public const string Backlog = "backlog";
    public const string Todo = "todo";
    public const string Doing = "doing";
    public const string Review = "review";
    public const string Done = "done";
    public static readonly string[] All = [Backlog, Todo, Doing, Review, Done];
}

public static class CardPriority
{
    public static readonly string[] All = ["low", "normal", "high", "urgent"];
}

/// <summary>A card on the office board. Starting work on it hands it to its assignee as a mission.</summary>
public sealed class BoardCard
{
    public string Id { get; set; } = Ids.New("cd");
    /// <summary>Short number people (and colleagues) use to refer to it: #12.</summary>
    public int Number { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = CardStatus.Backlog;
    /// <summary>Position within its column; lower comes first.</summary>
    public double Order { get; set; }
    /// <summary>Colleague id, or null when unassigned.</summary>
    public string? Assignee { get; set; }
    public string Priority { get; set; } = "normal";
    /// <summary>Story points, or null when not estimated.</summary>
    public int? Points { get; set; }
    public bool Blocked { get; set; }
    public string? BlockedReason { get; set; }
    /// <summary>The mission doing this card's work, once started.</summary>
    public string? MissionId { get; set; }
    /// <summary>"owner", or the name of the colleague who added it.</summary>
    public string CreatedBy { get; set; } = "owner";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
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
    /// <summary>Skills a colleague hired into this role starts with.</summary>
    public List<string> Skills { get; set; } = [];
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
