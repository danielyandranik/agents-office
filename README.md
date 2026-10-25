# Agent Office

A team of AI colleagues in a loft office you can watch. Each colleague is a
[Microsoft Agent Framework](https://github.com/microsoft/agent-framework) agent; the browser
shows them as people at desks: typing, thinking, walking over to ask each other things, and
gathering in the meeting room. Hire anyone for any role, point the team at any folder, and give
them a mission.

Nothing about the team is hard-coded. A colleague is just data: name, role, instructions, model,
abilities and looks. The role templates in the hire dialog are optional starting points, and you
can add your own: fill in the hire form (or open a colleague's profile) and click **Save as role**.
Saving under a built-in's title replaces it; **↺** on its card brings the built-in back.

```
Browser  ── REST: hire, missions, messages ──►  ASP.NET Core
   ▲                                              │
   └──── SignalR: every office event ◄── OfficeRuntime ── Agent Framework
                                                  │        ChatClientAgent per colleague
                                                  │        Group-chat workflow for meetings
                                                  └── tools: board, files, shell, web, ask_colleague
```

## Run it

Requires the .NET 10 SDK.

```bash
cd src/AgentOffice
dotnet run
# open http://localhost:5080
```

It starts with the **claude-cli** provider: colleagues run on the [Claude Code](https://claude.com/claude-code)
CLI using the account it's logged in with, so a Claude subscription is enough and no API key is needed.
Install Claude Code and run `claude login` once. Click **Hire a starter team**, then **New mission**.

Each colleague turn runs `claude -p` with Claude Code's built-in tools turned off. The colleague's
office tools (board, files, shell, web, ask_colleague) are lent to it over a private, per-turn MCP
endpoint on this server (`/mcp/claude-cli/{token}`, loopback only), and follow-up messages resume the
same CLI session. Your `CLAUDE.md`, hooks and plugins aren't loaded.

To try the office without a model, switch to the canned **simulated** provider:

```bash
dotnet user-secrets set "Providers:Default" "simulated"
```

### Other providers

```bash
dotnet user-secrets set "Providers:Anthropic:ApiKey" "sk-ant-..."
dotnet user-secrets set "Providers:Default" "anthropic"
```

Or set it per colleague in the hire/profile form. Providers, all configured under `Providers` in
`appsettings.json` or user secrets:

| Provider    | Settings                                                                                |
|-------------|-----------------------------------------------------------------------------------------|
| `claude-cli`| optional `Command` (path to `claude`), `Model` (default `sonnet`; `opus`, `haiku` or a full model id) |
| `anthropic` | `ApiKey`, `Model` (default `claude-sonnet-5-5`)                                          |
| `openai`    | `ApiKey`, `Model`, optional `Endpoint` for any OpenAI-compatible API (Azure OpenAI v1, vLLM, LM Studio) |
| `ollama`    | `Endpoint` (e.g. `http://localhost:11434/v1`), `Model`                                   |
| `simulated` | nothing. It's for trying the office.                                                    |

Mixing is fine: a cheap model for coordination, a strong one for review.

### Run it from Telegram

The office can be driven from a Telegram chat: talk to colleagues, start missions and meetings,
manage the board, and get a message when work is done, needs review or gets blocked. Nothing needs
hosting. The app long-polls Telegram, so it only makes outgoing requests and works from your laptop
while it's running.

1. In Telegram, open [@BotFather](https://t.me/BotFather), send `/newbot`, and copy the token.
2. Store it: `dotnet user-secrets set "Telegram:BotToken" "123456:ABC…"`, then restart the app.
3. Click the paper-plane button in the top bar, **Pair a chat**, and open the bot from there (or send it
   `/pair <code>`). Codes work once, for 10 minutes; only paired private chats are answered.

In the chat, `@Nora …` talks to a colleague; replying to any of the bot's messages continues that
conversation or mission. `/help` lists the rest: `/mission @Name goal`, `/meeting @A @B topic`,
`/missions`, `/cancel`, `/team`, `/board`, `/card`, `/go 12`, `/move 12 review`, `/done 12`, `/mute`.
Messages pass through Telegram's servers, so treat them as you would any chat.

### Let the team work on your code

Missions run inside a work folder. By default each mission gets a fresh folder under
`~/agent-office-workspaces`. To point a mission at an existing repository, allow its parent folder
first:

```json
"Office": { "WorkspaceRoots": [ "~/agent-office-workspaces", "~/code" ] }
```

Then enter `~/code/my-repo` as the work folder in **New mission**.

## How the team works

**Delegate missions.** One colleague leads. They get the goal and can use the shared board, files,
commands and the web (if allowed), and can *ask a colleague*. Asking a colleague is a tool call
that runs the other agent with the request and returns their answer. On the floor you see the
lead walk over to that desk. Chains are depth-limited (`MaxDelegationDepth`) and loop-protected:
nobody can be asked twice within the same chain.

**Meetings.** The chosen colleagues walk into the meeting room and take turns, using the Agent
Framework group-chat workflow with a round-robin manager. Reply in the log to hold another round
with the full history.

**Chats.** The *Chat* tab in a colleague's drawer is a 1:1 conversation with memory.

**Breaks.** The floor is a loft: brick walls, factory windows, a café, a game room and a
lounge. When a colleague has nothing to do, they go on a break by themselves:

- make an espresso and drink it at the bar
- play foosball or ping-pong with whoever else is free
- play darts or an arcade machine
- put on a record, read or nap on the sofa
- water the plants, or look out the window

Work always comes first: when they're asked to do something, they head straight back to their desk.
Breaks are purely visual. They run in the browser and cost no tokens.

**Skills.** Roles and colleagues can have skills: reusable playbooks in the
[Agent Skills](https://agentskills.io) format, a folder with a `SKILL.md` (frontmatter `name` and `description`,
then Markdown instructions) and any files it needs. Attach them under **Skills** in the hire form or a
colleague's profile; a colleague hired from a role starts with the role's skills. **Manage skills** lets you
write, edit and delete skills, or import a `SKILL.md`. They're stored in `office-data/skills/`.
Folders in `Office:SkillDirs` (default `~/.claude/skills`) show up read-only, so your Claude Code skills
work here too.

Every built-in role comes with skills: 56 ship with the app in `src/AgentOffice/Data/skills/`. 44 are vetted
copies of published skills (obra/superpowers, addyosmani, Anthropic's knowledge-work-plugins, Sentry, Trail of
Bits, Cloudflare, Docker, Microsoft and others), pinned to a commit, adapted to run as instructions only, and
kept with their license and a `SOURCE.md` of what changed; 12 are house skills for gaps nobody had filled (for
example `ac-test-plan`, `work-handoff-brief`, `prod-change-approval`, `security-verdict`). The full list with
sources, licenses and roles is in [`Data/skills/README.md`](src/AgentOffice/Data/skills/README.md). Built-in
skills are read-only; **Make an editable copy** turns one into an office skill you can change (delete the copy
to go back).

A colleague's instructions list only each skill's name and description. When the work calls for one, they
load it with `use_skill` and read its bundled files with `read_skill_file`, so unused skills cost almost nothing.
When one of their skills points to another ("use the `verification-before-completion` skill"), they can load that
one from the library by name too.

**The office board.** **Board** in the top bar opens a kanban of the team's work: Backlog, To do,
In progress, Review and Done. Cards have a number (#12), priority, story points, an assignee and a
blocked flag; drag them between columns or open one to edit it. **Start work** hands a card to its
assignee as a mission: the card moves to In progress and shows the mission's task progress, goes to
Review when the mission finishes (you move it to Done), and is flagged blocked if the mission fails.
Colleagues with **Plan on the board** (on for the Project and Product Manager roles) can list, add,
assign, estimate and flag cards with `office_board_list`, `office_board_add` and `office_board_update`;
only you move cards to Done.

**The mission board.** Every mission has a board, which shows on the office whiteboard as sticky notes.
Agents manage it with `board_add`, `board_update` and `board_list`.

### Abilities per colleague

| Ability        | Tools                                    | Default |
|----------------|------------------------------------------|---------|
| Files          | `list_files`, `read_file`, `write_file`  | on      |
| Ask colleagues | `ask_colleague`                          | on      |
| Web            | `fetch_url` (public hosts only)          | off     |
| Commands       | `run_command` (bash/cmd, timeout)        | off     |

## Safety

These protections are enforced in code, not left to the prompt:

- **Folders.** File tools resolve every path inside the mission folder and reject `..`, absolute
  paths, and symlinks at any level of the path that lead outside it. Mission folders must sit under `WorkspaceRoots`.
- **Commands.** Off unless you enable them per colleague. They run in the mission folder with a
  timeout, but as **your OS user**. For real repos, run the server in a container or VM, or as a
  user that can only see those folders.
- **Web.** `fetch_url` connects only to addresses it has checked are public, and re-checks every
  redirect. A prompt-injected page can't send an agent into your network or a cloud metadata
  endpoint. Bodies are capped at 2 MB.
- **Limits.** Each turn is capped at `MaxStepsPerTurn` tool round trips, with at most 3
  consecutive tool errors.
- **Network.** The server listens on `localhost:5080` only and has no authentication. Keep it
  local, or put it behind your own auth before exposing it.
- **Prompt rules.** Instructions treat file and web content as data and forbid destructive or
  irreversible actions unless you asked for them. That's guidance, not enforcement. Use branch
  protection and scoped credentials for anything that matters.

## Project layout

```
src/AgentOffice/
  Program.cs                 endpoints + SignalR hub
  Domain/                    profiles, missions, board; JSON store (office-data/)
  Agents/
    OfficeRuntime.cs         hiring, missions, Agent Framework agents, meetings, presence
    AgentToolbox.cs          sandboxed tools
    Prompts.cs               instructions built from persona + office context
    ChatClientFactory.cs     claude-cli / anthropic / openai / ollama / simulated → IChatClient
    ClaudeCliChatClient.cs   IChatClient over `claude -p` (uses the CLI's login, no API key)
    ClaudeCliToolHost.cs     minimal MCP endpoint that lends a turn's tools to the CLI
    SimulatedChatClient.cs   canned model for trying things out
  Data/roles.json            built-in role templates (yours are saved in office.json)
  wwwroot/                   the office UI (vanilla JS, no build step)
    demo.js                  in-browser stand-in for the server (?demo or no API)
tools/sync-demo.mjs          copies roles.json and built-in skills into demo.js; --bundle makes a single-file preview
tools/textures.py            regenerates the floor's material textures (brick, wood, concrete) in styles.css
tools/skills-manifest.py     regenerates Data/skills/README.md (built-in skills: source, license, commit, roles)
```

State lives in `src/AgentOffice/office-data/`: `office.json` and one event log per mission. Delete
the folder to start fresh.

## API

| Method | Path                          | Purpose                                              |
|--------|-------------------------------|------------------------------------------------------|
| GET    | `/api/office`                 | Snapshot: colleagues + presence, missions, recent events |
| POST   | `/api/agents`                 | Hire (body: profile)                                 |
| PUT    | `/api/agents/{id}`            | Update profile                                       |
| DELETE | `/api/agents/{id}`            | Let go (refused while they're working)               |
| POST   | `/api/agents/{id}/chat`       | Open the 1:1 chat, optionally with a first message   |
| POST   | `/api/missions`               | Start: `{ title, goal, mode: "delegate"\|"meeting", leadId, participants, workspace, meetingRounds }` |
| GET    | `/api/missions/{id}`          | Mission + event log                                  |
| POST   | `/api/missions/{id}/messages` | Follow-up from you                                   |
| POST   | `/api/missions/{id}/cancel`   | Cancel                                               |
| GET    | `/api/roles`, `/api/providers`| Hire-dialog data (built-in roles merged with yours)  |
| POST   | `/api/roles`                  | Add a role, or update yours with that title: `{ title, summary, persona, can, look: { shirt, accessory } }` |
| DELETE | `/api/roles/{id}`             | Delete one of your roles (a replaced built-in comes back) |
| GET    | `/api/cards`                  | Office board cards                                   |
| POST   | `/api/cards`                  | New card: `{ title, description, status, assignee, priority, points, blocked, blockedReason }` |
| PUT    | `/api/cards/{id}`             | Replace a card's fields (same body)                  |
| POST   | `/api/cards/{id}/move`        | Move to a column / position: `{ status, beforeId }`  |
| POST   | `/api/cards/{id}/start`       | Hand the card to its assignee as a mission           |
| DELETE | `/api/cards/{id}`             | Delete a card                                        |
| GET    | `/api/telegram`               | Bot status, paired chats, current pairing code       |
| POST   | `/api/telegram/pair`          | New one-time pairing code (10 minutes)               |
| PUT    | `/api/telegram/chats/{id}`    | `{ muted }`: office notifications on or off for a chat |
| DELETE | `/api/telegram/chats/{id}`    | Unpair a chat                                        |
| GET    | `/api/skills`                 | Skill library: office skills plus read-only ones from `Office:SkillDirs` |
| POST   | `/api/skills`                 | New skill: `{ name, description, instructions }` |
| PUT    | `/api/skills/{name}`          | Edit an office skill's description and instructions |
| POST   | `/api/skills/import`          | Import a SKILL.md: `{ text }` (replaces an office skill with that name) |
| DELETE | `/api/skills/{name}`          | Delete an office skill and detach it from colleagues and roles |

SignalR hub `/hub` pushes `event` messages `{ seq, ts, kind, missionId, agentId, data }`. Kinds
include `agent.status`, `agent.delta`, `agent.said`, `agent.tool`, `agent.tool_result`,
`agent.visit`, `agent.return`, `board.updated`, `workspace.file`, `mission.*`, `meeting.*` and
`office.*`, `roles.updated`, `skills.updated`, `cards.updated` and `telegram.updated`.

## Where to take it next

- Swap the JSON store for SQL Server / EF Core when you want history and search.
- Add approval steps (Agent Framework supports approval-required functions) for `run_command` or
  for pushing to git.
- Add MCP tools per colleague (`Microsoft.Agents.AI.Mcp`) for GitHub, Jira or your own APIs.
- Add OpenTelemetry. Agent Framework emits traces you can send to the same collector as your
  other services.
