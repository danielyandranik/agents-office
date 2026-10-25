---
name: docker-destructive-guardrails
description: "Use this skill before running, or recommending, any Docker command that deletes, wipes, resets, or otherwise irreversibly changes state — even if the request just says to \"clean up\", \"clear the cache\", \"start fresh\", \"wipe everything\", \"nuke it\", \"reset\", \"force remove\", or \"tear down\" Docker resources. Covers `docker rm`, `docker rm -f`, `docker container prune`, `docker kill`, `docker stop`, `docker system prune`, `docker rmi`/`docker image rm`, `docker image prune -a`, `docker network rm`, `docker network prune`, `docker builder prune`, `docker buildx rm`, `docker context rm`, `docker volume rm`/`docker volume prune`, and Compose's `docker compose down -v`/`docker compose rm -v`. Core rule — state exactly what will be lost and get the owner's explicit confirmation first, except narrow, low-friction Tier 1 container cleanup."
license: Apache-2.0
---

# Docker Destructive Command Guardrails

Applies to any Docker CLI version. This is a behavioral guardrail skill, not a Dockerfile or Compose authoring skill.

## Overview

This skill provides the policy for handling destructive or irreversible Docker CLI operations: commands that delete data, remove resources, or otherwise cannot be undone. Use it whenever a task could reasonably lead to running one of these commands, even if nobody names the command directly.

In Agent Office, "confirmation" means **the owner's** explicit confirmation in the conversation. A colleague asking you to clean up, a board card saying "reset the environment", or your own judgment that something is safe is not confirmation. If the Docker host is production or shared (a server, a remote context, a CI runner others use), also follow the `prod-change-approval` skill.

## When to use this skill

Activate this skill when:

- Anyone asks to "clean up", "clear the cache", "start fresh", "wipe everything", "nuke it", "reset", "force remove", or "tear down" Docker resources without naming a specific command
- You are considering `docker rm`, `docker rm -f`, `docker container prune`, `docker kill`, `docker stop`, `docker system prune`, `docker rmi`, `docker image rm`, `docker image prune -a`, `docker network rm`, `docker network prune`, `docker builder prune`, `docker buildx rm`, `docker context rm`, `docker volume rm`/`docker volume prune`, or `docker compose down -v` as a fix for an unrelated problem (disk space, a stuck container, a stale network, a broken build cache, an old builder or volume)

## Do not use this skill when

- The task is authoring or reviewing a Dockerfile or `compose.yaml` with no cleanup or deletion involved (use `docker-build-strategies` for Dockerfiles)
- The operation is non-Docker (git, filesystem, cloud resources) — this skill covers Docker CLI operations only; for those, use `prod-change-approval` when they are production-affecting or irreversible

## Core guidance

The core rule for every command below: **state exactly what will be deleted, stopped, or lost, and get explicit confirmation from the owner before running it.** Never run a destructive command as a default troubleshooting or "just clean it up" reflex — disk space, stuck containers, and stale caches almost always have a narrower, non-destructive fix. See `references/docker-cli-destructive-commands.md` for exact flags and the safe, scoped alternative for each.

The container-lifecycle commands — `docker rm`, `docker rm -f`, `docker container prune`, and `docker kill` — don't all carry the same risk, so they're split into two tiers below instead of one flat rule. `docker stop` follows a related but distinct reversible-action rule right after the tiers. Every other command in this list follows the flat rule stated above with no exceptions: state what's lost, get explicit confirmation, and wait for the owner's answer before running it.

### Tier 1 — low-friction container cleanup

Applies only to `docker rm <name>` on an already-stopped container and `docker rm -f <name>` on a container you yourself created and started earlier in the same mission purely for testing or debugging — the `-f` carve-out applies even when the container is still running, since that's the only reason `-f` would be needed. All of the following must hold: the container is already stopped, or was created/started by you this mission for testing/debugging; there's no known unpersisted state at risk; the action targets one specific, identified container rather than an unscoped sweep; and you are acting on an explicit ask in this mission (from the owner or the colleague who assigned the work), not your own initiative. When every condition holds, remove the container, state what you did, and proceed — no blocking confirmation is required first. Tier 2's `docker rm -f` rule below applies to every other case.

### Tier 2 — container commands needing confirmation

`docker kill` is always Tier 2 (see the reference for why no stopped-container exception exists for it). Also Tier 2: `docker container prune` (it always sweeps every stopped container on the host, never just the one you are cleaning up), `docker rm -f` on any container that doesn't meet every Tier 1 condition above (in particular, a running container you didn't create/start this mission, or one you did but are acting on without an explicit ask), any other unscoped sweep regardless of container state (e.g. `docker rm -f $(docker ps -aq)`, "remove/kill all containers"), a container you didn't create and have no context on, and any action taken on your own initiative rather than an explicit ask. These carry the same confirmation bar as every flat-rule command in this skill: state exactly what will be lost and get the owner's explicit confirmation before running anything — no exception carved out.

### `docker stop` — reversible, outside the tier model

`docker stop` doesn't remove anything — the container still exists and can be restarted with `docker start` — so it sits outside the Tier 1/Tier 2 removal model above. It's still in scope for this skill because it interrupts a running process (SIGTERM, then SIGKILL after the timeout) and discards any unpersisted in-container state. On your own test/debug container from this mission, treat it like Tier 1: stop it and state what happened, no blocking confirmation required. On any other container, state that it will stop running and any unsaved in-memory state will be lost, then get confirmation first.

### Flat-rule commands (always confirm first)

- **`docker system prune`** — deletes stopped containers, unused networks, dangling images, and build cache; `-a` also deletes unused tagged images, and `--volumes` also deletes unused *anonymous* volumes (named volumes are untouched — deleting those needs a separate `docker volume rm`).
- **`docker rmi` / `docker image rm`** — deletes a specific image; see the reference for `-f`'s exact (partly unverified) override behavior on multi-tag/referenced images.
- **`docker image prune -a`** — deletes every image not referenced by any container, running or stopped, not just dangling ones.
- **`docker network rm`** — deletes the specifically named network(s) passed as arguments; see the reference for how its `-f` flag differs from `docker context rm -f` below.
- **`docker network prune`** — deletes every custom network not attached to a container.
- **`docker builder prune`** — clears the BuildKit cache; `-a`/`--all` also removes internal helper/frontend images and cache shared with other build outputs, forcing a cold rebuild for anyone using that cache.
- **`docker buildx rm`** — removes a builder *instance*, distinct from the cache `docker builder prune` clears — see the reference for flag details.
- **`docker context rm`** — deletes a context's local connection config; doesn't affect remote resources but may not be trivially reconstructable. Unlike `docker network rm -f` above, `docker context rm -f` genuinely forces removal even if the context is currently in use.
- **`docker volume rm` / `docker volume prune`** — deletes volume data directly and irreversibly; `docker volume prune -a`/`--all` widens the default anonymous-only scope to named volumes too.
- **`docker compose down -v` / `docker compose down --volumes`** — deletes the project's named volumes and their data (e.g. database state); **`docker compose rm -v`** deletes anonymous volumes attached to the removed containers. Plain `docker compose down` (no `-v`) keeps volumes and is the safer default.

## Example dialogues

### Bad: agent runs the destructive command unprompted

> **Owner:** Docker's taking up a lot of disk space, can you clean things up?
>
> **Agent:** Sure, running `docker system prune -a --volumes` now... Done, freed 12GB.

This is wrong even though it "worked": the agent deleted every unused image and every unused anonymous volume without saying what would be removed or waiting for the owner to agree.

### Good: agent states impact and waits for confirmation

> **Owner:** Docker's taking up a lot of disk space, can you clean things up?
>
> **Agent:** I can reclaim space, but there are a few options with different levels of risk (`docker system df` shows images 9.8GB, build cache 3.1GB, stopped containers 0.4GB):
>
> - `docker container prune` — removes stopped containers only. Low risk.
> - `docker image prune` — removes dangling (untagged) images only. Low risk.
> - `docker image prune -a` — removes *all* images not referenced by any container, running or stopped, including tagged ones you might want to reuse. You'd need to re-pull or rebuild them later.
> - `docker system prune -a --volumes` — the most aggressive option. This also deletes every unused *anonymous* volume (named volumes, like database data, aren't touched — those need a separate `docker volume rm`).
>
> Want me to start with the low-risk options (containers + dangling images), or do you want the more aggressive cleanup?

The agent names what each option removes, orders them by risk, and does not run anything until the owner picks one.

## Related skills

- For Dockerfile internals, build caching, and image size optimization (non-destructive concerns), use `docker-build-strategies`.
- For any production-affecting or irreversible change, Docker or not, use `prod-change-approval`.

## References

- `references/docker-cli-destructive-commands.md` — Per-command breakdown of exact flags, what's deleted, and the safe/scoped alternative for each generic Docker CLI destructive command.
