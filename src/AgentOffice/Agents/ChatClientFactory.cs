using System.ClientModel;
using System.Collections.Concurrent;
using AgentOffice.Domain;
using Anthropic;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

namespace AgentOffice.Agents;

/// <summary>
/// Turns (provider, model) into a Microsoft.Extensions.AI <see cref="IChatClient"/>.
/// Agent Framework agents are built on top of these, so any provider works for any colleague.
/// </summary>
public sealed class ChatClientFactory(IOptions<ProviderOptions> providerOptions, IOptions<OfficeOptions> officeOptions, ClaudeCliToolHost claudeCliTools, IHostEnvironment env)
{
    private readonly ProviderOptions _p = providerOptions.Value;
    private readonly ConcurrentDictionary<string, IChatClient> _cache = new();

    public sealed record ProviderInfo(string Id, string Label, bool Configured, string DefaultModel, IReadOnlyList<string> Models);

    public IReadOnlyList<ProviderInfo> Describe() =>
    [
        new("claude-cli", NeedsClaudeToken ? "Claude CLI (add OAuthToken)" : "Claude CLI (your Claude login)",
            ClaudeCliChatClient.Locate(_p.ClaudeCli.Command) is not null && !NeedsClaudeToken, _p.ClaudeCli.Model, _p.ClaudeCli.Models),
        new("anthropic", "Anthropic Claude", !string.IsNullOrWhiteSpace(_p.Anthropic.ApiKey), _p.Anthropic.Model, _p.Anthropic.Models),
        new("openai", "OpenAI-compatible", !string.IsNullOrWhiteSpace(_p.OpenAI.ApiKey), _p.OpenAI.Model, _p.OpenAI.Models),
        new("ollama", "Ollama (local)", !string.IsNullOrWhiteSpace(_p.Ollama.Endpoint), _p.Ollama.Model, _p.Ollama.Models),
        new("simulated", "Simulated (no API key, for trying the office)", true, "simulated", ["simulated"]),
    ];

    public string DefaultProvider => _p.Default;

    /// <summary>Resolves the effective provider/model for a colleague (empty = office default).</summary>
    public (string Provider, string Model) Resolve(string? provider, string? model)
    {
        var prov = string.IsNullOrWhiteSpace(provider) ? _p.Default : provider.Trim().ToLowerInvariant();
        var mdl = !string.IsNullOrWhiteSpace(model) ? model.Trim()
            : !string.IsNullOrWhiteSpace(_p.DefaultModel) && prov == _p.Default ? _p.DefaultModel
            : prov switch
            {
                "claude-cli" => _p.ClaudeCli.Model,
                "anthropic" => _p.Anthropic.Model,
                "openai" => _p.OpenAI.Model,
                "ollama" => _p.Ollama.Model,
                _ => "simulated",
            };
        return (prov, mdl);
    }

    /// <summary>
    /// Returns a chat client with function invocation already configured, so Agent Framework
    /// keeps our step limit instead of adding its own default invoker.
    /// </summary>
    public IChatClient Get(string? provider, string? model)
    {
        var (prov, mdl) = Resolve(provider, model);
        return _cache.GetOrAdd($"{prov}|{mdl}", _ =>
            CreateRaw(prov, mdl)
                .AsBuilder()
                .UseFunctionInvocation(configure: f =>
                {
                    f.MaximumIterationsPerRequest = officeOptions.Value.MaxStepsPerTurn;
                    f.MaximumConsecutiveErrorsPerRequest = 3;
                    f.IncludeDetailedErrors = true;
                })
                .Build());
    }

    /// <summary>
    /// An office whose settings say <c>"OAuthToken": ""</c> signs in with its own token only: never fall back to
    /// whatever account this machine is logged in with. (Leaving the setting out keeps the machine's login.)
    /// </summary>
    private bool NeedsClaudeToken => _p.ClaudeCli.OAuthToken is { } t && t.Trim().Length == 0;

    private IChatClient CreateRaw(string provider, string model) => provider switch
    {
        "claude-cli" when NeedsClaudeToken => throw new InvalidOperationException(
            "This office signs in to Claude with its own token, but Providers:ClaudeCli:OAuthToken is empty. "
            + "Run `claude setup-token` with the right account and paste the token into this office's appsettings.<Office>.json."),

        "claude-cli" => new ClaudeCliChatClient(
            ClaudeCliChatClient.Locate(_p.ClaudeCli.Command)
                ?? throw new InvalidOperationException($"Can't find the Claude CLI ('{_p.ClaudeCli.Command}'). Install Claude Code and run 'claude login', or set Providers:ClaudeCli:Command to its full path."),
            model,
            claudeCliTools,
            ClaudeConfigDir(),
            string.IsNullOrWhiteSpace(_p.ClaudeCli.OAuthToken) ? null : _p.ClaudeCli.OAuthToken.Trim()),

        "anthropic" => new AnthropicClient { ApiKey = Require(_p.Anthropic.ApiKey, "Providers:Anthropic:ApiKey") }
            .AsIChatClient(model, _p.Anthropic.MaxOutputTokens),

        "openai" => new ChatClient(
                model,
                new ApiKeyCredential(Require(_p.OpenAI.ApiKey, "Providers:OpenAI:ApiKey")),
                string.IsNullOrWhiteSpace(_p.OpenAI.Endpoint) ? new OpenAIClientOptions() : new OpenAIClientOptions { Endpoint = new Uri(_p.OpenAI.Endpoint) })
            .AsIChatClient(),

        // Ollama exposes an OpenAI-compatible endpoint, so no extra SDK is needed.
        "ollama" => new ChatClient(
                model,
                new ApiKeyCredential("ollama"),
                new OpenAIClientOptions { Endpoint = new Uri(Require(_p.Ollama.Endpoint, "Providers:Ollama:Endpoint")) })
            .AsIChatClient(),

        "simulated" => new SimulatedChatClient(),

        _ => throw new InvalidOperationException($"Unknown provider '{provider}'. Use claude-cli, anthropic, openai, ollama or simulated."),
    };

    /// <summary>
    /// The CLI's config folder: the one configured, or, when the office signs in with its own token, a folder in the
    /// office's data so nothing comes from this machine's Claude login or settings. Null = the app's environment.
    /// </summary>
    private string? ClaudeConfigDir()
    {
        if (!string.IsNullOrWhiteSpace(_p.ClaudeCli.ConfigDir)) return Paths.Resolve(_p.ClaudeCli.ConfigDir, env.ContentRootPath);
        if (string.IsNullOrWhiteSpace(_p.ClaudeCli.OAuthToken)) return null;
        return Directory.CreateDirectory(Path.Combine(Paths.Resolve(officeOptions.Value.DataDir, env.ContentRootPath), "claude")).FullName;
    }

    private static string Require(string? value, string key) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new InvalidOperationException($"'{key}' is not configured. Set it with: dotnet user-secrets set \"{key}\" \"...\"")
            : value;
}
