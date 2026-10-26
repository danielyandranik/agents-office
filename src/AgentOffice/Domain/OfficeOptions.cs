namespace AgentOffice.Domain;

public sealed class OfficeOptions
{
    public const string Section = "Office";

    /// <summary>Where office.json and event logs are stored.</summary>
    public string DataDir { get; set; } = "office-data";

    /// <summary>
    /// Folders the team may work in. A mission workspace must be inside one of these.
    /// The first one is used for missions that don't specify a folder.
    /// </summary>
    public List<string> WorkspaceRoots { get; set; } = [];

    public const string DefaultWorkspaceRoot = "~/agent-office-workspaces";

    /// <summary>
    /// Extra folders of Agent Skills (one sub-folder per skill, each with a SKILL.md), e.g. ~/.claude/skills.
    /// They show up read-only in the skill library; skills made in the office live in DataDir/skills.
    /// </summary>
    public List<string> SkillDirs { get; set; } = [];

    /// <summary>Max tool-call round trips per agent turn.</summary>
    public int MaxStepsPerTurn { get; set; } = 24;

    /// <summary>How deep colleague-asks-colleague chains may go.</summary>
    public int MaxDelegationDepth { get; set; } = 2;

    public int ShellTimeoutSeconds { get; set; } = 120;
    public int MaxToolOutputChars { get; set; } = 12_000;
}

public sealed class TelegramOptions
{
    public const string Section = "Telegram";

    /// <summary>Token from @BotFather. Keep it in user secrets: dotnet user-secrets set "Telegram:BotToken" "…".</summary>
    public string? BotToken { get; set; }

    /// <summary>Bot API server. Change it only for a self-hosted Bot API server.</summary>
    public string ApiBase { get; set; } = "https://api.telegram.org";
}

public sealed class ProviderOptions
{
    public const string Section = "Providers";

    /// <summary>claude-cli | anthropic | openai | ollama | simulated</summary>
    public string Default { get; set; } = "simulated";
    public string DefaultModel { get; set; } = "";

    public ClaudeCliProvider ClaudeCli { get; set; } = new();
    public AnthropicProvider Anthropic { get; set; } = new();
    public OpenAIProvider OpenAI { get; set; } = new();
    public OllamaProvider Ollama { get; set; } = new();

    /// <summary>The local Claude Code CLI, using the account it is logged in with (no API key).</summary>
    public sealed class ClaudeCliProvider
    {
        /// <summary>Executable name or full path of the <c>claude</c> CLI.</summary>
        public string Command { get; set; } = "claude";
        /// <summary>
        /// Claude Code config folder (CLAUDE_CONFIG_DIR) for this office, which picks the account it logs in with,
        /// e.g. ~/.claude-work. Empty = whatever the app's environment says.
        /// </summary>
        public string? ConfigDir { get; set; }
        /// <summary>
        /// Long-lived token from <c>claude setup-token</c>. When set, the CLI signs in with it instead of the account
        /// logged in on this machine, and keeps its own config folder in the office's data folder (unless ConfigDir
        /// says otherwise). Keep it out of git: appsettings.&lt;Office&gt;.json files are ignored, or use user secrets.
        /// </summary>
        public string? OAuthToken { get; set; }
        public string Model { get; set; } = "sonnet";
        public List<string> Models { get; set; } = [];
    }

    public sealed class AnthropicProvider
    {
        public string? ApiKey { get; set; }
        public string Model { get; set; } = "claude-sonnet-5-5";
        public int MaxOutputTokens { get; set; } = 8192;
        public List<string> Models { get; set; } = [];
    }

    public sealed class OpenAIProvider
    {
        public string? ApiKey { get; set; }
        /// <summary>Optional: any OpenAI-compatible endpoint (Azure OpenAI v1, LM Studio, vLLM…).</summary>
        public string? Endpoint { get; set; }
        public string Model { get; set; } = "gpt-5.4-mini";
        public List<string> Models { get; set; } = [];
    }

    public sealed class OllamaProvider
    {
        public string? Endpoint { get; set; }   // e.g. http://localhost:11434/v1
        public string Model { get; set; } = "qwen3";
        public List<string> Models { get; set; } = [];
    }
}
