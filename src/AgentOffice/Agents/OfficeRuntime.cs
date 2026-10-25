using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AgentOffice.Domain;
using AgentOffice.Office;
using Microsoft.Agents.AI;
using Microsoft.Agents.AI.Workflows;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Options;

namespace AgentOffice.Agents;

public sealed class OfficeException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed record MissionRequest(
    string Title,
    string Goal,
    string Mode,
    string? LeadId,
    List<string>? Participants,
    string? Workspace,
    int? MeetingRounds);

/// <summary>
/// The office: hires and fires colleagues, runs missions on Microsoft Agent Framework,
/// and turns everything agents do into events the UI animates.
/// </summary>
public sealed partial class OfficeRuntime(
    OfficeStore store,
    EventBus bus,
    ChatClientFactory clients,
    IOptions<OfficeOptions> officeOptions,
    IHttpClientFactory httpFactory,
    IHostEnvironment env,
    ILogger<OfficeRuntime> log)
{
    private readonly OfficeOptions _opt = officeOptions.Value;
    private readonly ConcurrentDictionary<string, AgentPresence> _presence = new();
    private readonly ConcurrentDictionary<string, int> _activeRuns = new();
    private readonly ConcurrentDictionary<string, AgentSession> _sessions = new();
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _sessionLocks = new();
    private readonly ConcurrentDictionary<string, CancellationTokenSource> _missionRuns = new();
    private readonly ConcurrentDictionary<string, List<ChatMessage>> _meetingHistory = new();

    public OfficeStore Store => store;
    public EventBus Bus => bus;

    public AgentPresence PresenceOf(string agentId) =>
        _presence.TryGetValue(agentId, out var p) ? p : new AgentPresence("idle", null, null, null, DateTimeOffset.UtcNow);

    public bool IsRunning(string missionId) => _missionRuns.ContainsKey(missionId);

    // =====================================================================
    // Hiring
    // =====================================================================

    public AgentProfile Hire(AgentProfile candidate)
    {
        Validate(candidate, isNew: true);
        var hired = store.Write(s =>
        {
            if (s.Agents.Any(a => string.Equals(a.Name, candidate.Name.Trim(), StringComparison.OrdinalIgnoreCase)))
                throw new OfficeException(409, $"There is already a colleague named {candidate.Name}.");

            var used = s.Agents.Select(a => a.Desk).ToHashSet();
            candidate.Id = Ids.New("ag");
            candidate.Name = candidate.Name.Trim();
            candidate.Desk = Enumerable.Range(0, 1000).First(i => !used.Contains(i));
            candidate.HiredAt = DateTimeOffset.UtcNow;
            s.Agents.Add(candidate);
            return OfficeStore.Clone(candidate)!;
        });
        bus.Publish("office.hired", agentId: hired.Id, data: hired);
        return hired;
    }

    public AgentProfile Update(string id, AgentProfile changes)
    {
        Validate(changes, isNew: false);
        var updated = store.Write(s =>
        {
            var a = s.Agents.FirstOrDefault(x => x.Id == id) ?? throw new OfficeException(404, "No such colleague.");
            if (s.Agents.Any(x => x.Id != id && string.Equals(x.Name, changes.Name.Trim(), StringComparison.OrdinalIgnoreCase)))
                throw new OfficeException(409, $"There is already a colleague named {changes.Name}.");
            a.Name = changes.Name.Trim();
            a.Title = changes.Title.Trim();
            a.Persona = changes.Persona;
            a.Provider = changes.Provider;
            a.Model = changes.Model;
            a.Look = changes.Look;
            a.Can = changes.Can;
            return OfficeStore.Clone(a)!;
        });
        bus.Publish("office.updated", agentId: id, data: updated);
        return updated;
    }

    public void Fire(string id)
    {
        if (_activeRuns.TryGetValue(id, out var n) && n > 0)
            throw new OfficeException(409, "They're in the middle of something. Cancel their mission first.");

        var fired = store.Write(s =>
        {
            var a = s.Agents.FirstOrDefault(x => x.Id == id) ?? throw new OfficeException(404, "No such colleague.");
            s.Agents.Remove(a);
            return a;
        });
        _presence.TryRemove(id, out _);
        bus.Publish("office.fired", agentId: id, data: new { fired.Id, fired.Name });
    }

    private void Validate(AgentProfile p, bool isNew)
    {
        if (string.IsNullOrWhiteSpace(p.Name) || p.Name.Trim().Length > 40) throw new OfficeException(400, "Name is required (max 40 characters).");
        if ((p.Title ?? "").Length > 80) throw new OfficeException(400, "Title is too long (max 80 characters).");
        if ((p.Persona ?? "").Length > 12_000) throw new OfficeException(400, "Instructions are too long (max 12,000 characters).");
        p.Title ??= "";
        p.Persona ??= "";
        p.Provider = (p.Provider ?? "").Trim().ToLowerInvariant();
        p.Model = (p.Model ?? "").Trim();
        p.Look ??= new();
        p.Can ??= new();
        if (p.Provider.Length > 0 && clients.Describe().All(x => x.Id != p.Provider))
            throw new OfficeException(400, $"Unknown provider '{p.Provider}'.");
    }

    // =====================================================================
    // Missions
    // =====================================================================

    public Mission StartMission(MissionRequest req)
    {
        var mode = (req.Mode ?? MissionModes.Delegate).Trim().ToLowerInvariant();
        if (mode is not (MissionModes.Delegate or MissionModes.Meeting))
            throw new OfficeException(400, "Mode must be 'delegate' or 'meeting'.");
        if (string.IsNullOrWhiteSpace(req.Goal)) throw new OfficeException(400, "Describe the goal.");

        var roster = store.Read(s => s.Agents.Select(a => a.Id).ToHashSet());
        var participants = (req.Participants ?? []).Where(roster.Contains).Distinct().ToList();
        var lead = req.LeadId is not null && roster.Contains(req.LeadId) ? req.LeadId : participants.FirstOrDefault();

        if (mode == MissionModes.Delegate && lead is null) throw new OfficeException(400, "Pick who leads this mission.");
        if (mode == MissionModes.Meeting && participants.Count < 2) throw new OfficeException(400, "A meeting needs at least two colleagues.");
        if (lead is not null && !participants.Contains(lead)) participants.Insert(0, lead);

        var mission = new Mission
        {
            Title = string.IsNullOrWhiteSpace(req.Title) ? Shorten(req.Goal, 60) : req.Title.Trim(),
            Goal = req.Goal.Trim(),
            Mode = mode,
            LeadId = lead ?? participants[0],
            Participants = participants,
            MeetingRounds = Math.Clamp(req.MeetingRounds ?? 2, 1, 5),
        };
        mission.Workspace = ResolveWorkspace(req.Workspace, mission.Id);

        store.Write(s => s.Missions.Add(mission));
        bus.Publish("mission.created", mission.Id, data: OfficeStore.Clone(mission));
        Launch(mission.Id, mission.Goal);
        return OfficeStore.Clone(mission)!;
    }

    /// <summary>Owner's 1:1 chat with a colleague is just a mission in chat mode.</summary>
    public Mission OpenChat(string agentId)
    {
        var agent = store.FindAgent(agentId) ?? throw new OfficeException(404, "No such colleague.");
        var workspace = ResolveWorkspace(null, $"chat-{Slug(agent.Name)}");

        // Look up and create in one locked step so two quick clicks can't open two chats.
        var (mission, created) = store.Write(s =>
        {
            var existing = s.Missions.FirstOrDefault(m => m.Mode == MissionModes.Chat && m.LeadId == agent.Id);
            if (existing is not null) return (OfficeStore.Clone(existing)!, false);
            var chat = new Mission
            {
                Title = $"Chat with {agent.Name}",
                Goal = "",
                Mode = MissionModes.Chat,
                LeadId = agent.Id,
                Participants = [agent.Id],
                Workspace = workspace,
            };
            s.Missions.Add(chat);
            return (OfficeStore.Clone(chat)!, true);
        });
        if (created) bus.Publish("mission.created", mission.Id, data: mission);
        return mission;
    }

    public void PostMessage(string missionId, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) throw new OfficeException(400, "Message is empty.");
        _ = store.FindMission(missionId) ?? throw new OfficeException(404, "No such mission.");
        if (IsRunning(missionId)) throw new OfficeException(409, "They're still working on the last message. Wait or cancel.");
        Launch(missionId, text.Trim());
    }

    public bool Cancel(string missionId)
    {
        if (!_missionRuns.TryGetValue(missionId, out var cts)) return false;
        try { cts.Cancel(); }
        catch (ObjectDisposedException) { return false; } // finished in the meantime
        return true;
    }

    public T UpdateBoard<T>(string missionId, Func<List<BoardTask>, T> change)
    {
        var (result, board) = store.Write(s =>
        {
            var m = s.Missions.FirstOrDefault(x => x.Id == missionId) ?? throw new OfficeException(404, "No such mission.");
            var r = change(m.Board);
            m.UpdatedAt = DateTimeOffset.UtcNow;
            return (r, OfficeStore.Clone(m.Board)!);
        });
        bus.Publish("board.updated", missionId, data: new { tasks = board });
        return result;
    }

    private void Launch(string missionId, string text)
    {
        var cts = new CancellationTokenSource();
        if (!_missionRuns.TryAdd(missionId, cts))
        {
            cts.Dispose();
            throw new OfficeException(409, "This mission is already running.");
        }
        _ = Task.Run(() => RunTurnAsync(missionId, text, cts));
    }

    private async Task RunTurnAsync(string missionId, string text, CancellationTokenSource cts)
    {
        var ct = cts.Token;
        try
        {
            SetMission(missionId, m => { m.Status = MissionStatus.Running; m.Error = null; });
            bus.Publish("user.message", missionId, data: new { text });

            var mission = store.FindMission(missionId)!;
            var result = mission.Mode == MissionModes.Meeting
                ? await RunMeetingAsync(mission, text, ct)
                : await RunLeadAsync(mission, text, ct);

            SetMission(missionId, m => { m.Status = MissionStatus.Done; m.Result = result; });
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            SetMission(missionId, m => { m.Status = MissionStatus.Cancelled; m.Error = "Cancelled by the owner."; });
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Mission {MissionId} failed", missionId);
            SetMission(missionId, m => { m.Status = MissionStatus.Failed; m.Error = ex.Message; });
        }
        finally
        {
            _missionRuns.TryRemove(missionId, out _);
            cts.Dispose();
        }
    }

    private Task<string> RunLeadAsync(Mission mission, string text, CancellationToken ct)
    {
        var lead = store.FindAgent(mission.LeadId) ?? throw new OfficeException(404, "The lead for this mission is no longer in the office.");
        var ctx = new RunContext(mission.Id, mission.Workspace, Depth: 0, Chain: [lead.Id], InMeeting: false, ct);
        return RunAgentTurnAsync(lead, text, ctx, $"{mission.Id}:{lead.Id}");
    }

    // =====================================================================
    // Agent turns (Agent Framework ChatClientAgent)
    // =====================================================================

    private ChatClientAgent BuildAgent(AgentProfile me, RunContext ctx, IReadOnlyList<AgentProfile> everyone, Mission mission)
    {
        var officeName = store.Read(s => s.Name);
        var tools = new AgentToolbox(this, me, ctx, _opt, httpFactory).Build(everyone);
        return new ChatClientAgent(clients.Get(me.Provider, me.Model), new ChatClientAgentOptions
        {
            Id = me.Id,
            Name = SafeName(me.Name),
            Description = me.Title,
            ChatOptions = new ChatOptions
            {
                Instructions = Prompts.Instructions(officeName, me, everyone, mission, ctx),
                Tools = tools,
            },
        });
    }

    private async Task<string> RunAgentTurnAsync(AgentProfile me, string input, RunContext ctx, string sessionKey)
    {
        var ct = ctx.Cancellation;
        var mission = store.FindMission(ctx.MissionId) ?? throw new OfficeException(404, "No such mission.");
        var everyone = store.Read(s => OfficeStore.Clone(s.Agents)!);

        // A colleague asked twice at once gets a fresh, memory-less session for the second ask
        // instead of two runs sharing (and corrupting) one conversation.
        var gate = _sessionLocks.GetOrAdd(sessionKey, _ => new SemaphoreSlim(1, 1));
        var ownsSession = false;
        BeginRun(me.Id);
        try
        {
            ownsSession = await gate.WaitAsync(0, ct);
            var agent = BuildAgent(me, ctx, everyone, mission);
            AgentSession session;
            if (ownsSession && _sessions.TryGetValue(sessionKey, out var existing))
            {
                session = existing;
            }
            else
            {
                session = await agent.CreateSessionAsync(ct);
                if (ownsSession) _sessions[sessionKey] = session;
            }

            SetPresence(me.Id, "thinking", null, ctx.MissionId);
            var reply = new StringBuilder();
            var callNames = new Dictionary<string, string>();

            await foreach (var update in agent.RunStreamingAsync(input, session, cancellationToken: ct))
            {
                HandleUpdate(me, ctx.MissionId, update, reply, callNames);
            }

            var text = reply.ToString().Trim();
            bus.Publish("agent.said", ctx.MissionId, me.Id, new { text });
            return text.Length == 0 ? "(finished without a written reply)" : text;
        }
        finally
        {
            if (ownsSession) gate.Release();
            EndRun(me.Id);
        }
    }

    /// <summary>Maps Agent Framework streaming updates to office events.</summary>
    private void HandleUpdate(AgentProfile me, string missionId, AgentResponseUpdate update, StringBuilder reply, Dictionary<string, string> callNames)
    {
        foreach (var content in update.Contents)
        {
            switch (content)
            {
                case TextContent { Text.Length: > 0 } t:
                    if (PresenceOf(me.Id).Status is not ("typing" or "presenting")) SetPresence(me.Id, "typing", null, missionId);
                    reply.Append(t.Text);
                    bus.Publish("agent.delta", missionId, me.Id, new { text = t.Text });
                    break;

                case TextReasoningContent:
                    if (PresenceOf(me.Id).Status != "thinking") SetPresence(me.Id, "thinking", null, missionId);
                    break;

                case FunctionCallContent call:
                    callNames[call.CallId] = call.Name;
                    if (reply.Length > 0) bus.Publish("agent.said", missionId, me.Id, new { text = reply.ToString().Trim(), interim = true });
                    reply.Clear(); // the final reply is what comes after the last tool call
                    if (call.Name != "ask_colleague")
                    {
                        SetPresence(me.Id, "working", ToolLabel(call.Name), missionId);
                    }
                    bus.Publish("agent.tool", missionId, me.Id, new { callId = call.CallId, tool = call.Name, args = Summarize(call.Arguments) });
                    break;

                case FunctionResultContent result:
                    callNames.TryGetValue(result.CallId, out var name);
                    bus.Publish("agent.tool_result", missionId, me.Id, new
                    {
                        callId = result.CallId,
                        tool = name,
                        ok = result.Exception is null,
                        result = Shorten(result.Result?.ToString() ?? result.Exception?.Message ?? "", 600),
                    });
                    SetPresence(me.Id, "thinking", null, missionId);
                    break;
            }
        }
    }

    // =====================================================================
    // Colleague-to-colleague
    // =====================================================================

    public async Task<string> AskColleagueAsync(AgentProfile caller, string colleagueName, string request, RunContext ctx, CancellationToken ct)
    {
        var colleague = store.FindAgent(colleagueName.Trim().TrimStart('@'));
        if (colleague is null)
        {
            var names = store.Read(s => string.Join(", ", s.Agents.Where(a => a.Id != caller.Id).Select(a => a.Name)));
            return $"Nobody called '{colleagueName}' works here. Colleagues: {names}.";
        }
        if (colleague.Id == caller.Id) return "That's you — do it yourself.";
        if (ctx.Depth >= _opt.MaxDelegationDepth) return "Delegation limit reached. Do this yourself or report back to whoever asked you.";
        if (ctx.Chain.Contains(colleague.Id)) return $"{colleague.Name} is already part of this request chain; asking them again would loop. Decide yourself.";

        bus.Publish("agent.visit", ctx.MissionId, caller.Id, new { from = caller.Id, to = colleague.Id, request = Shorten(request, 400) });
        SetPresence(caller.Id, "visiting", colleague.Name, ctx.MissionId, colleague.Id);

        try
        {
            var childCtx = ctx with { Depth = ctx.Depth + 1, Chain = [.. ctx.Chain, colleague.Id], Cancellation = ct };
            var answer = await RunAgentTurnAsync(
                colleague,
                $"[Request from {caller.Name} ({caller.Title})]\n{request}",
                childCtx,
                $"{ctx.MissionId}:{colleague.Id}");
            bus.Publish("agent.return", ctx.MissionId, colleague.Id, new { from = colleague.Id, to = caller.Id, summary = Shorten(answer, 400) });
            return $"{colleague.Name} replied:\n{answer}";
        }
        finally
        {
            SetPresence(caller.Id, "thinking", null, ctx.MissionId);
        }
    }

    // =====================================================================
    // Meetings (Agent Framework group chat workflow)
    // =====================================================================

    private async Task<string> RunMeetingAsync(Mission mission, string text, CancellationToken ct)
    {
        var everyone = store.Read(s => OfficeStore.Clone(s.Agents)!);
        var people = mission.Participants.Select(pid => everyone.FirstOrDefault(a => a.Id == pid)).OfType<AgentProfile>().ToList();
        if (people.Count < 2) throw new OfficeException(400, "Fewer than two participants are still in the office.");

        var ctx = new RunContext(mission.Id, mission.Workspace, Depth: 0, Chain: [], InMeeting: true, ct);
        var agents = people.Select(p => BuildAgent(p, ctx, everyone, mission)).ToList();
        // Workflow executor ids are "<name>_<id>" with non-alphanumerics collapsed to '_' (mirrors the framework's
        // internal helper). The agent id itself is unique, so fall back to matching on it if the format ever changes.
        var byExecutor = agents.Zip(people).ToDictionary(x => ExecutorIdFor(x.First), x => x.Second);
        AgentProfile? Speaker(string executorId) =>
            byExecutor.TryGetValue(executorId, out var mapped) ? mapped
            : people.FirstOrDefault(person => executorId.Contains(ExecutorIdRegex().Replace(person.Id, "_"), StringComparison.Ordinal));

        var workflow = AgentWorkflowBuilder
            .CreateGroupChatBuilderWith(all => new RoundRobinGroupChatManager(all) { MaximumIterationCount = mission.MeetingRounds * all.Count })
            .AddParticipants(agents)
            .WithName($"meeting-{mission.Id}")
            .Build();

        var history = _meetingHistory.GetOrAdd(mission.Id, _ => []);
        var mark = history.Count;
        var completed = false;
        history.Add(new ChatMessage(ChatRole.User, text));

        foreach (var p in people)
        {
            BeginRun(p.Id);
            SetPresence(p.Id, "meeting", mission.Title, mission.Id);
        }
        bus.Publish("meeting.started", mission.Id, data: new { participants = people.Select(p => p.Id) });

        AgentProfile? speaker = null;
        var current = new StringBuilder();
        var callNames = new Dictionary<string, string>();
        var lastWords = "";

        void FinishSpeaker()
        {
            if (speaker is null) return;
            var said = current.ToString().Trim();
            if (said.Length > 0) lastWords = $"{speaker.Name}: {said}";
            bus.Publish("agent.said", mission.Id, speaker.Id, new { text = said });
            SetPresence(speaker.Id, "meeting", mission.Title, mission.Id);
            current.Clear();
        }

        try
        {
            await using var run = await InProcessExecution.RunStreamingAsync(workflow, history.ToList(), cancellationToken: ct);
            await run.TrySendMessageAsync(new TurnToken(emitEvents: true));

            await foreach (var evt in run.WatchStreamAsync(ct))
            {
                switch (evt)
                {
                    // AgentResponseUpdateEvent derives from WorkflowOutputEvent, so it must be matched first.
                    case AgentResponseUpdateEvent e when Speaker(e.ExecutorId) is { } who:
                        if (speaker?.Id != who.Id)
                        {
                            FinishSpeaker();
                            speaker = who;
                            SetPresence(who.Id, "presenting", mission.Title, mission.Id);
                        }
                        HandleUpdate(who, mission.Id, e.Update, current, callNames);
                        break;

                    case AgentResponseUpdateEvent:
                        break;

                    case WorkflowOutputEvent output when output.As<List<ChatMessage>>() is { } transcript:
                        history.Clear();
                        history.AddRange(transcript); // group chat yields the full conversation
                        break;

                    case WorkflowErrorEvent error:
                        throw error.Exception ?? new InvalidOperationException("The meeting failed.");

                    case ExecutorFailedEvent failed:
                        throw failed.Data ?? new InvalidOperationException($"{failed.ExecutorId} failed during the meeting.");
                }
            }
            // WatchStreamAsync ends quietly on cancellation instead of throwing; make it count as cancelled.
            ct.ThrowIfCancellationRequested();
            FinishSpeaker();
            completed = true;
        }
        finally
        {
            // A failed or cancelled round shouldn't leave its prompt behind to be replayed next time.
            if (!completed && history.Count > mark) history.RemoveRange(mark, history.Count - mark);
            bus.Publish("meeting.ended", mission.Id, data: new { participants = people.Select(p => p.Id) });
            foreach (var p in people) EndRun(p.Id);
        }

        return lastWords.Length > 0 ? lastWords : "The meeting ended without conclusions.";
    }

    // =====================================================================
    // Presence & helpers
    // =====================================================================

    private void BeginRun(string agentId) => _activeRuns.AddOrUpdate(agentId, 1, (_, n) => n + 1);

    private void EndRun(string agentId)
    {
        var left = _activeRuns.AddOrUpdate(agentId, 0, (_, n) => Math.Max(0, n - 1));
        if (left == 0) SetPresence(agentId, "idle", null, null);
    }

    private void SetPresence(string agentId, string status, string? detail, string? missionId, string? with = null)
    {
        var p = new AgentPresence(status, detail, missionId, with, DateTimeOffset.UtcNow);
        _presence[agentId] = p;
        bus.Publish("agent.status", missionId, agentId, p);
    }

    private void SetMission(string missionId, Action<Mission> change)
    {
        var snapshot = store.Write(s =>
        {
            var m = s.Missions.First(x => x.Id == missionId);
            change(m);
            m.UpdatedAt = DateTimeOffset.UtcNow;
            return OfficeStore.Clone(m)!;
        });
        bus.Publish("mission.updated", missionId, data: snapshot);
    }

    private string ResolveWorkspace(string? requested, string fallbackName)
    {
        var configured = _opt.WorkspaceRoots.Where(r => !string.IsNullOrWhiteSpace(r)).ToList();
        if (configured.Count == 0) configured.Add(OfficeOptions.DefaultWorkspaceRoot);
        var roots = configured.Select(r => Paths.Resolve(r, env.ContentRootPath)).Distinct().ToList();

        var path = string.IsNullOrWhiteSpace(requested)
            ? Path.Combine(roots[0], Slug(fallbackName))
            : Paths.Resolve(requested.Trim(), roots[0]);

        if (!roots.Any(r => Paths.IsInside(path, r)))
            throw new OfficeException(400, $"The workspace must be inside one of: {string.Join(", ", roots)}. Add folders in Office:WorkspaceRoots.");

        Directory.CreateDirectory(path);
        return path;
    }

    private static string ToolLabel(string tool) => tool switch
    {
        "read_file" or "list_files" => "reading files",
        "write_file" => "writing a file",
        "run_command" => "running a command",
        "fetch_url" => "browsing the web",
        "board_add" or "board_update" or "board_list" => "updating the board",
        _ => tool,
    };

    private static string Summarize(IDictionary<string, object?>? args)
    {
        if (args is null || args.Count == 0) return "";
        var json = JsonSerializer.Serialize(args, Json.Options);
        return Shorten(json, 500);
    }

    private static string Shorten(string text, int max)
    {
        text = text.Trim();
        return text.Length <= max ? text : text[..max].TrimEnd() + "…";
    }

    private static string ExecutorIdFor(AIAgent agent) =>
        ExecutorIdRegex().Replace(string.IsNullOrEmpty(agent.Name) ? agent.Id : $"{agent.Name}_{agent.Id}", "_");

    private static string SafeName(string name)
    {
        var s = NameRegex().Replace(name.Trim(), "_");
        return s.Length == 0 ? "colleague" : s;
    }

    private static string Slug(string text)
    {
        var s = SlugRegex().Replace(text.ToLowerInvariant(), "-").Trim('-');
        return s.Length == 0 ? "workspace" : s[..Math.Min(s.Length, 48)];
    }

    [GeneratedRegex(@"[^A-Za-z0-9_-]")]
    private static partial Regex NameRegex();

    [GeneratedRegex(@"[^a-z0-9]+")]
    private static partial Regex SlugRegex();

    [GeneratedRegex("[^0-9A-Za-z]+")]
    private static partial Regex ExecutorIdRegex();
}
