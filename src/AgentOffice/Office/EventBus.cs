using System.Collections.Concurrent;
using AgentOffice.Domain;
using Microsoft.AspNetCore.SignalR;

namespace AgentOffice.Office;

public sealed class OfficeHub : Hub;

/// <summary>Assigns sequence numbers, persists, and broadcasts office events to every connected UI.</summary>
public sealed class EventBus(IHubContext<OfficeHub> hub, OfficeStore store, ILogger<EventBus> log)
{
    private long _seq;
    private readonly ConcurrentQueue<OfficeEvent> _recent = new();
    private const int RecentCapacity = 400;

    /// <summary>Kinds that are too chatty to persist (the final text is persisted separately).</summary>
    private static readonly HashSet<string> Ephemeral = ["agent.delta", "agent.status", "cards.updated"];

    public OfficeEvent Publish(string kind, string? missionId = null, string? agentId = null, object? data = null)
    {
        var evt = new OfficeEvent(Interlocked.Increment(ref _seq), DateTimeOffset.UtcNow, kind, missionId, agentId, data);

        if (!Ephemeral.Contains(kind))
        {
            _recent.Enqueue(evt);
            while (_recent.Count > RecentCapacity && _recent.TryDequeue(out _)) { }
            try { store.AppendEvent(evt); }
            catch (Exception ex) { log.LogWarning(ex, "Could not persist event {Kind}", kind); }
        }

        // Fire-and-forget: a slow browser must never slow an agent down.
        _ = hub.Clients.All.SendAsync("event", evt).ContinueWith(
            t => log.LogDebug(t.Exception, "Broadcast failed"), TaskContinuationOptions.OnlyOnFaulted);

        return evt;
    }

    public IReadOnlyList<OfficeEvent> Recent(int count) => _recent.TakeLast(count).ToList();
}
