using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microsoft.Extensions.AI;

namespace AgentOffice.Agents;

/// <summary>
/// A fake model so you can watch the office work without an API key.
/// It follows a plausible script — note on the board, ask a colleague, write notes, answer —
/// using whatever tools the real agent was given, so the whole pipeline (Agent Framework,
/// function invocation, events, UI) runs for real; only the "thinking" is canned.
/// </summary>
public sealed partial class SimulatedChatClient : IChatClient
{
    private static readonly string[] Openers =
    [
        "Here's where I landed",
        "Quick summary from my side",
        "Done — my take below",
        "I looked into it",
    ];

    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default) =>
        await GetStreamingResponseAsync(messages, options, cancellationToken).ToChatResponseAsync(cancellationToken);

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var list = messages.ToList();
        var lastUserIndex = list.FindLastIndex(m => m.Role == ChatRole.User);
        var userText = lastUserIndex >= 0 ? list[lastUserIndex].Text : "";
        var stepsDone = list.Skip(lastUserIndex + 1).SelectMany(m => m.Contents).OfType<FunctionResultContent>().Count();
        var usedTools = list.Skip(lastUserIndex + 1).SelectMany(m => m.Contents).OfType<FunctionCallContent>().Select(c => c.Name).ToHashSet();

        var instructions = options?.Instructions ?? "";
        var me = NameRegex().Match(instructions) is { Success: true } nm ? nm.Groups[1].Value : "I";
        var tools = (options?.Tools ?? []).ToDictionary(t => t.Name, t => t);
        var fromColleague = userText.StartsWith("[Request from", StringComparison.Ordinal);
        var inMeeting = instructions.Contains("You are in a meeting", StringComparison.Ordinal);
        var topic = Shorten(StripHeader(userText), 70);

        await Task.Delay(Random.Shared.Next(700, 1600), cancellationToken);

        FunctionCallContent? call = null;
        if (!inMeeting)
        {
            if (!fromColleague && stepsDone == 0 && tools.ContainsKey("board_add"))
            {
                call = Call("board_add", new() { ["title"] = Shorten(topic, 50), ["assignee"] = me });
            }
            else if (!usedTools.Contains("use_skill") && tools.TryGetValue("use_skill", out var useSkill)
                     && SkillsRegex().Match(useSkill.Description) is { Success: true } sm)
            {
                call = Call("use_skill", new() { ["name"] = sm.Groups[1].Value.Split(',')[0].Trim() });
            }
            else if (!fromColleague && !usedTools.Contains("ask_colleague") && tools.TryGetValue("ask_colleague", out var ask)
                     && ColleaguesRegex().Match(ask.Description) is { Success: true } cm)
            {
                var names = cm.Groups[1].Value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
                if (names.Length > 0)
                {
                    var who = names[Random.Shared.Next(names.Length)];
                    call = Call("ask_colleague", new()
                    {
                        ["colleague"] = who,
                        ["request"] = $"Could you give me your perspective on: {topic}? Two or three concrete points are enough.",
                    });
                }
            }

            if (call is null && fromColleague && stepsDone == 0 && tools.ContainsKey("list_files"))
            {
                call = Call("list_files", new() { ["path"] = "." });
            }
            else if (call is null && !fromColleague && !usedTools.Contains("write_file") && tools.ContainsKey("write_file"))
            {
                var slug = SlugRegex().Replace(me.ToLowerInvariant(), "-");
                call = Call("write_file", new()
                {
                    ["path"] = $"notes/{slug}-{DateTime.UtcNow:HHmmss}.md",
                    ["content"] = $"# Notes on {topic}\n\n- Context gathered\n- Options compared\n- Recommendation drafted\n\n_(written by the simulated model)_\n",
                });
            }
        }

        if (call is not null)
        {
            yield return new ChatResponseUpdate(ChatRole.Assistant, [call]) { FinishReason = ChatFinishReason.ToolCalls };
            yield break;
        }

        var reply = inMeeting
            ? $"From where I sit, the key thing with \"{topic}\" is to keep the first step small and testable. I'd agree with the direction so far and add one risk to watch. (simulated)"
            : fromColleague
                ? $"{Openers[Random.Shared.Next(Openers.Length)]}:\n\n1. Clarify the success criteria first.\n2. Start with the smallest slice that proves the idea.\n3. Flag risks early rather than at review.\n\n(simulated answer — connect a real provider to get real work)"
                : $"{Openers[Random.Shared.Next(Openers.Length)]} on \"{topic}\":\n\n- I put it on the board and pulled in a colleague for a second opinion.\n- I wrote my notes into the workspace.\n- Next step: replace the simulated provider with a real model and run this again.\n\n(simulated)";

        foreach (var word in Regex.Split(reply, @"(?<=\s)"))
        {
            await Task.Delay(Random.Shared.Next(18, 55), cancellationToken);
            yield return new ChatResponseUpdate(ChatRole.Assistant, word);
        }
    }

    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceKey is null && serviceType.IsInstanceOfType(this) ? this : null;

    public void Dispose() { }

    private static FunctionCallContent Call(string name, Dictionary<string, object?> args) =>
        new($"sim_{Guid.NewGuid():N}"[..16], name, args);

    private static string StripHeader(string text)
    {
        var i = text.IndexOf(']', StringComparison.Ordinal);
        return text.StartsWith('[') && i > 0 ? text[(i + 1)..].Trim() : text.Trim();
    }

    private static string Shorten(string text, int max)
    {
        text = WhitespaceRegex().Replace(text, " ").Trim();
        return text.Length <= max ? text : text[..max].TrimEnd() + "…";
    }

    [GeneratedRegex(@"You are ([^,\n]+),")]
    private static partial Regex NameRegex();

    [GeneratedRegex(@"your skills: ([^.\n]+)")]
    private static partial Regex SkillsRegex();

    [GeneratedRegex(@"Colleagues: ([^.\n]+)")]
    private static partial Regex ColleaguesRegex();

    [GeneratedRegex(@"[^a-z0-9]+")]
    private static partial Regex SlugRegex();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespaceRegex();
}
