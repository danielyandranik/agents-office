/* In-browser stand-in for the Agent Office server.
   Used when the page can't reach the API (opened as a file, ?demo, or as a static preview).
   Same endpoints and the same event stream as the .NET server, with scripted "work". */
window.DemoOffice = (() => {
  'use strict';
  const ROLES = /*ROLES*/[{"title":"Software Engineer","summary":"Implements features with tests, following the codebase's conventions.","persona":"You are a pragmatic senior software engineer. Before changing code, read the relevant files and match existing patterns. Work in small, verifiable steps, add or update tests with every change, and run the build and tests when you can. Explain trade-offs briefly. If a request is ambiguous, state your assumption and proceed.","can":{"files":true,"shell":true,"web":false,"delegate":true,"plan":false},"look":{"shirt":"#3E7CB1","accessory":"headphones"}},{"title":"QA Engineer","summary":"Turns requirements into test plans and tries hard to break things.","persona":"You are a meticulous QA engineer. Test against the stated requirements, not the implementer's notes. Write test plans that map each acceptance criterion to cases (happy path, edge, negative), write automated tests where the project supports them, and report bugs with exact reproduction steps, expected vs actual, and severity. Give a clear PASS/FAIL verdict.","can":{"files":true,"shell":true,"web":false,"delegate":true,"plan":false},"look":{"shirt":"#5C946E","accessory":"glasses"}},{"title":"Product Designer","summary":"Designs flows, screens and copy — including every empty and error state.","persona":"You are a product designer focused on clarity. Describe user flows step by step, sketch screens as ASCII wireframes or simple HTML mockups saved to the workspace, and specify every state: loading, empty, error, success, no permission. Write exact UI copy in plain language. Reuse the product's existing patterns before inventing new ones, and note accessibility requirements.","can":{"files":true,"shell":false,"web":true,"delegate":true,"plan":false},"look":{"shirt":"#C9628B","accessory":"none"}},{"title":"Site Reliability Engineer","summary":"CI/CD, containers, Kubernetes, observability and runbooks.","persona":"You are a site reliability engineer. You own build pipelines, Dockerfiles, Kubernetes manifests, health checks, logging, metrics and tracing (OpenTelemetry), alerts and runbooks. Every change needs a rollback plan. Prefer non-root containers, pinned versions, resource limits and readiness probes. Never touch production without the owner's explicit approval.","can":{"files":true,"shell":true,"web":true,"delegate":true,"plan":false},"look":{"shirt":"#3B3B58","accessory":"cap"}},{"title":"Product Manager","summary":"Frames the problem, writes user stories and testable acceptance criteria.","persona":"You are a product manager. You decide what to build and why, never how. Turn requests into a short problem statement, goals and explicit non-goals, user stories, and Given/When/Then acceptance criteria that QA can verify. List edge cases and open questions only the owner can answer. Always look for the smallest version that solves the real problem.","can":{"files":true,"shell":false,"web":true,"delegate":true,"plan":true},"look":{"shirt":"#D8A031","accessory":"none"}},{"title":"Project Manager","summary":"Plans the work, routes tasks to the right people and keeps the board honest.","persona":"You are a project manager and the team's coordinator. Break goals into tasks on the shared board, decide who should do each one, and ask colleagues to do them with complete context. Track progress, unblock people, and keep scope under control. You don't do specialist work yourself. When the work is done, give the owner a crisp status: done, in progress, blocked, and what needs their decision.","can":{"files":true,"shell":false,"web":false,"delegate":true,"plan":true},"look":{"shirt":"#7A5C99","accessory":"glasses"}},{"title":"Software Architect","summary":"Designs how things get built and splits them into buildable pieces.","persona":"You are a software architect. Read the existing codebase before proposing anything, and match its patterns. Write short designs: approach, components touched, data model and API changes, at least one alternative you rejected and why, risks, and a task breakdown small enough for one sitting each. Prefer boring, reversible choices. Record lasting decisions as ADRs in the workspace.","can":{"files":true,"shell":false,"web":true,"delegate":true,"plan":false},"look":{"shirt":"#2F6F73","accessory":"glasses"}},{"title":"Security Reviewer","summary":"Independent code and security review before anything ships.","persona":"You are an independent code and security reviewer. Review changes for correctness, injection, authentication and authorization gaps, tenant isolation, secrets in code or logs, unsafe deserialization, SSRF, risky dependencies and missing tests. Report findings as [BLOCKER|MAJOR|MINOR|NIT] with file, line, problem and suggested fix, then a verdict. You read; you don't rewrite other people's code.","can":{"files":true,"shell":true,"web":true,"delegate":false,"plan":false},"look":{"shirt":"#8C3B3B","accessory":"none"}},{"title":"Technical Writer","summary":"READMEs, guides, API docs and release notes people actually read.","persona":"You are a technical writer. Write for the reader's task: start with what they need to do, use short sentences and concrete examples, and keep terminology consistent. Verify instructions against the actual code and files. Prefer one good example over three paragraphs of explanation.","can":{"files":true,"shell":false,"web":true,"delegate":true,"plan":false},"look":{"shirt":"#A3B18A","accessory":"none"}},{"title":"Data Analyst","summary":"Queries, cleans and explains data; turns questions into numbers.","persona":"You are a data analyst. Clarify the question, inspect the data before analysing it, state assumptions, and show your method so others can reproduce it. Write analysis scripts to the workspace and run them when you can. Report findings with the numbers, their uncertainty, and what they do and don't show.","can":{"files":true,"shell":true,"web":true,"delegate":true,"plan":false},"look":{"shirt":"#457B9D","accessory":"glasses"}}]/*END_ROLES*/;

  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const rid = (p) => `${p}_${Math.random().toString(16).slice(2, 12)}`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  class Cancelled extends Error {}

  function create() {
    const state = { name: 'Demo Office', agents: [], missions: [], roles: [], cards: [], skills: [
      { name: 'code-review', description: 'Reviews a change for bugs, security issues and missing tests. Use before anything is called done.', instructions: '1. Read the diff and the code around it.\n2. Look for correctness bugs first, then security, then tests.\n3. Report findings as BLOCKER / MAJOR / MINOR with file and line.\n4. End with a verdict: ship, or fix first.', source: 'office', readOnly: false, files: [] },
      { name: 'release-notes', description: 'Writes user-facing release notes from what changed. Use when asked for a changelog or release summary.', instructions: '## Format\n- One line per change, starting with a verb.\n- Group under New, Improved, Fixed.\n- No internal ticket numbers.', source: 'office', readOnly: false, files: [] },
    ] };
    const presence = new Map();
    const active = new Map();
    const runs = new Map();       // missionId -> { cancelled }
    const events = new Map();     // missionId -> events[]
    const recent = [];
    let seq = 0;
    let handler = () => {};

    // ------------------------------------------------------------ events
    function emit(kind, missionId = null, agentId = null, data = null) {
      const e = { seq: ++seq, ts: new Date().toISOString(), kind, missionId, agentId, data: clone(data) };
      if (kind !== 'agent.delta' && kind !== 'agent.status') {
        recent.push(e); if (recent.length > 400) recent.shift();
        if (missionId) { const l = events.get(missionId) || []; l.push(e); events.set(missionId, l); }
      }
      setTimeout(() => handler(e), 0);
      return e;
    }
    const setPresence = (agentId, status, detail = null, missionId = null, withId = null) => {
      const p = { status, detail, missionId, with: withId, since: new Date().toISOString() };
      presence.set(agentId, p);
      emit('agent.status', missionId, agentId, p);
    };
    const begin = (id) => active.set(id, (active.get(id) || 0) + 1);
    const end = (id) => { const n = Math.max(0, (active.get(id) || 1) - 1); active.set(id, n); if (n === 0) setPresence(id, 'idle'); };
    const sleep = (ms, run) => new Promise((res, rej) => setTimeout(() => (run.cancelled ? rej(new Cancelled()) : res()), ms));
    const agent = (id) => state.agents.find((a) => a.id === id);
    const mission = (id) => state.missions.find((m) => m.id === id);
    // Built-ins keep their place; the owner's role with the same title replaces one, others go at the end.
    const roleList = () => {
      const mine = (r, replacesBuiltIn) => ({ ...clone(r), custom: true, replacesBuiltIn });
      const builtIn = new Set(ROLES.map((r) => r.title.toLowerCase()));
      return [
        ...ROLES.map((b) => { const r = state.roles.find((x) => x.title.toLowerCase() === b.title.toLowerCase()); return r ? mine(r, true) : { id: null, skills: [], ...clone(b), custom: false, replacesBuiltIn: false }; }),
        ...state.roles.filter((r) => !builtIn.has(r.title.toLowerCase())).map((r) => mine(r, false)),
      ];
    };
    function saveSkill(b, mustBeNew) {
      const name = String(b.name || '').trim();
      const description = String(b.description || '').replace(/\s+/g, ' ').trim();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error('A skill name uses lowercase letters, digits and hyphens, like release-notes (max 64 characters).');
      if (!description || description.length > 1024) throw new Error('Describe when to use the skill (1–1,024 characters). Colleagues decide from this whether to load it.');
      let k = state.skills.find((x) => x.name === name);
      if (k && mustBeNew) throw new Error(`There is already a skill called ${name}.`);
      if (!k) { k = { name, source: 'office', readOnly: false, files: [] }; state.skills.push(k); }
      Object.assign(k, { description, instructions: String(b.instructions || '').trim() });
      emit('skills.updated', null, null, { skills: state.skills });
      return clone(k);
    }
    // ------------------------------------------------------------ office board
    const COLS = ['backlog', 'todo', 'doing', 'review', 'done'];
    let nextCard = 1;
    const cardList = () => [...state.cards].sort((a, b) => COLS.indexOf(a.status) - COLS.indexOf(b.status) || a.order - b.order);
    const cardsChanged = () => emit('cards.updated', null, null, { cards: cardList() });
    const endOf = (status, except) => Math.max(0, ...state.cards.filter((c) => c.status === status && c !== except).map((c) => c.order)) + 1;
    const findCard = (key) => state.cards.find((c) => c.id === key || String(c.number) === String(key).replace(/^#/, ''));
    function applyCard(c, b) {
      const title = String(b.title ?? c.title ?? '').trim();
      if (!title || title.length > 200) throw new Error('A card needs a title (max 200 characters).');
      if (b.status && !COLS.includes(b.status)) throw new Error('Status must be backlog, todo, doing, review or done.');
      if (b.assignee && !agent(b.assignee)) throw new Error(`Nobody called '${b.assignee}' works here.`);
      const status = b.status || c.status || 'backlog';
      if (c.status && status !== c.status) c.order = endOf(status, c);
      Object.assign(c, {
        title, description: String(b.description ?? c.description ?? '').trim(), status, assignee: b.assignee || null,
        priority: ['low', 'normal', 'high', 'urgent'].includes(b.priority) ? b.priority : 'normal',
        points: b.points == null || b.points === '' ? null : Math.max(0, Math.min(100, +b.points)),
        blocked: !!b.blocked, blockedReason: b.blocked ? clip(b.blockedReason || '', 200) : null, updatedAt: new Date().toISOString(),
      });
      return c;
    }
    function createCard(b, by = 'owner') {
      const c = applyCard({ id: rid('cd'), missionId: null, createdBy: by, createdAt: new Date().toISOString() }, b);
      c.number = nextCard++;
      c.order = endOf(c.status, c);
      state.cards.push(c);
      cardsChanged();
      return c;
    }
    function startCard(c) {
      if (!c.assignee || !agent(c.assignee)) throw new Error('Assign the card to someone first.');
      if (c.missionId && runs.has(c.missionId)) throw new Error("Work on this card is already under way.");
      const goal = `${c.title}\n\n${c.description}`.trim();
      const m = newMission({ title: c.title, goal, mode: 'delegate', leadId: c.assignee, participants: [c.assignee] });
      Object.assign(c, { missionId: m.id, blocked: false, blockedReason: null });
      if (c.status !== 'doing') Object.assign(c, { status: 'doing', order: endOf('doing', c) });
      cardsChanged();
      launch(m, goal);
      return { card: clone(c), mission: clone(m) };
    }
    function missionEnded(m) {
      const c = state.cards.find((x) => x.missionId === m.id);
      if (!c) return;
      if (m.status === 'done') {
        Object.assign(c, { blocked: false, blockedReason: null });
        if (['backlog', 'todo', 'doing'].includes(c.status)) Object.assign(c, { status: 'review', order: endOf('review', c) });
      } else Object.assign(c, { blocked: true, blockedReason: clip(m.error || `Mission ${m.status}.`, 200) });
      cardsChanged();
    }
    function missionResumed(m) {
      const c = state.cards.find((x) => x.missionId === m.id && x.status === 'review');
      if (c) { Object.assign(c, { status: 'doing', order: endOf('doing', c) }); cardsChanged(); }
    }
    const touch = (m, patch) => { Object.assign(m, patch, { updatedAt: new Date().toISOString() }); emit('mission.updated', m.id, null, m); };

    // ------------------------------------------------------------ office
    function hire(p) {
      const name = String(p.name || '').trim();
      if (!name) throw new Error('Name is required (max 40 characters).');
      if (state.agents.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a colleague named ${name}.`);
      const used = new Set(state.agents.map((a) => a.desk));
      let desk = 0; while (used.has(desk)) desk++;
      const a = {
        id: rid('ag'), name, title: p.title || '', persona: p.persona || '', provider: p.provider || '', model: p.model || '',
        look: { skin: '#C68B59', hair: '#2B2118', hairStyle: 'short', shirt: '#3E7CB1', accessory: 'none', ...(p.look || {}) },
        can: { files: true, shell: false, web: false, delegate: true, ...(p.can || {}) }, skills: [...(p.skills || [])], desk, hiredAt: new Date().toISOString(),
      };
      state.agents.push(a);
      emit('office.hired', null, a.id, a);
      return clone(a);
    }

    // ------------------------------------------------------------ canned work
    const roleOf = (a) => {
      // Title decides; persona is only a fallback for custom titles.
      const t = (a.title || a.persona.slice(0, 80)).toLowerCase();
      if (/project manager|coordinat/.test(t)) return 'pm';
      if (/product manager|product owner/.test(t)) return 'product';
      if (/qa|quality|test/.test(t)) return 'qa';
      if (/design|ux|ui/.test(t)) return 'design';
      if (/sre|reliab|devops|infra/.test(t)) return 'sre';
      if (/security|review/.test(t)) return 'review';
      if (/architect/.test(t)) return 'arch';
      if (/engineer|developer|software|programmer/.test(t)) return 'eng';
      if (/writer|docs/.test(t)) return 'docs';
      if (/data|analyst/.test(t)) return 'data';
      return 'any';
    };
    const contribution = (a, topic) => ({
      pm: `Plan for "${topic}": agree on scope, build the smallest useful slice, then test and review. It's split on the board with an owner per task.`,
      product: `For "${topic}", success means users get it done without help. Acceptance criteria and two explicit non-goals are in my notes; the open questions need your call.`,
      qa: `Test plan for "${topic}": the main path, the edge cases most likely to bite, and one failure scenario we'd regret missing. I'll automate what I can and flag the rest.`,
      design: `Flow for "${topic}": one clear primary action per screen, plain-language copy, and every state covered — loading, empty, error and success. Wireframes are in my notes.`,
      sre: `Ops view on "${topic}": no new services needed. I'd add one metric and an alert, and keep a one-step rollback. Details in my notes.`,
      review: `Review of "${topic}": two MAJOR items (input validation and an authorization check) and a few NITs. Fix the majors before this ships.`,
      arch: `Approach for "${topic}": extend what's there instead of adding a new component. I compared two options; the rejected one is in the notes with the reason.`,
      eng: `Implementation for "${topic}": done in small commits with tests, following the existing patterns. Ready for QA.`,
      docs: `Docs for "${topic}": a short how-to plus a reference section. Draft is in the workspace.`,
      data: `Data for "${topic}": I pulled the baseline numbers and will track the change after release. Method is in my notes.`,
      any: `My take on "${topic}": start small, make it testable, and raise risks early. Notes are in the workspace.`,
    }[roleOf(a)]);

    async function typeOut(a, m, text, run) {
      setPresence(a.id, m.mode === 'meeting' ? 'presenting' : 'typing', null, m.id);
      for (const word of text.split(/(?<=\s)/)) {
        await sleep(28 + Math.random() * 45, run);
        emit('agent.delta', m.id, a.id, { text: word });
      }
      emit('agent.said', m.id, a.id, { text });
    }

    async function tool(a, m, name, args, run, sideEffect) {
      const label = { use_skill: 'reading a skill', board_add: 'updating the board', board_update: 'updating the board', write_file: 'writing a file', read_file: 'reading files', list_files: 'reading files', run_command: 'running a command' }[name] || name;
      setPresence(a.id, 'working', label, m.id);
      const callId = rid('call');
      emit('agent.tool', m.id, a.id, { callId, tool: name, args: JSON.stringify(args) });
      await sleep(700 + Math.random() * 700, run);
      const result = sideEffect ? sideEffect() : 'ok';
      emit('agent.tool_result', m.id, a.id, { callId, tool: name, ok: true, result });
      setPresence(a.id, 'thinking', null, m.id);
      await sleep(350, run);
    }

    const boardAdd = (m, title, assignee) => () => {
      const id = `T${m.board.length + 1}`;
      m.board.push({ id, title, assignee, status: 'todo', note: null });
      emit('board.updated', m.id, null, { tasks: m.board });
      return `Added ${id}.`;
    };
    const boardSet = (m, id, status) => () => {
      const t = m.board.find((x) => x.id === id); if (t) t.status = status;
      emit('board.updated', m.id, null, { tasks: m.board });
      return `${id} is now ${status}.`;
    };

    async function runDelegate(m, text, run) {
      const lead = agent(m.leadId);
      const topic = clip(text.split(/[.\n]/)[0], 60);
      begin(lead.id);
      try {
        setPresence(lead.id, 'thinking', null, m.id);
        await sleep(1300, run);
        const helpers = shuffle(state.agents.filter((a) => a.id !== lead.id)).slice(0, Math.min(2, state.agents.length - 1));
        const plan = [[`Scope: ${clip(topic, 34)}`, lead.name], ...helpers.map((h) => [`${h.title || 'Input'}: ${clip(topic, 28)}`, h.name])];
        for (const [title, who] of plan) await tool(lead, m, 'board_add', { title, assignee: who }, run, boardAdd(m, title, who));
        await tool(lead, m, 'board_update', { id: 'T1', status: 'done' }, run, boardSet(m, 'T1', 'done'));

        for (let i = 0; i < helpers.length; i++) {
          const h = helpers[i];
          const request = `Could you handle the ${(h.title || 'your').toLowerCase()} part of "${topic}"? Keep it short; I'll pull it together.`;
          emit('agent.visit', m.id, lead.id, { from: lead.id, to: h.id, request });
          setPresence(lead.id, 'visiting', h.name, m.id, h.id);
          await sleep(1500, run);
          begin(h.id);
          try {
            setPresence(h.id, 'thinking', null, m.id);
            await sleep(1200, run);
            const taskId = `T${i + 2}`;
            await tool(h, m, 'board_update', { id: taskId, status: 'doing' }, run, boardSet(m, taskId, 'doing'));
            const skill = state.skills.find((k) => (h.skills || []).includes(k.name));
            if (skill) await tool(h, m, 'use_skill', { name: skill.name }, run, () => `# Skill: ${skill.name}\n\n${clip(skill.instructions, 200)}`);
            const path = `notes/${h.name.toLowerCase()}-${roleOf(h)}.md`;
            await tool(h, m, 'write_file', { path, content: '…' }, run, () => { emit('workspace.file', m.id, h.id, { path, bytes: 1800 }); return `Wrote ${path}.`; });
            const answer = contribution(h, topic);
            await typeOut(h, m, answer, run);
            await tool(h, m, 'board_update', { id: taskId, status: 'done' }, run, boardSet(m, taskId, 'done'));
            emit('agent.return', m.id, h.id, { from: h.id, to: lead.id, summary: clip(answer, 160) });
          } finally { end(h.id); }
          setPresence(lead.id, 'thinking', null, m.id);
          await sleep(1300, run);
        }

        await tool(lead, m, 'write_file', { path: 'SUMMARY.md', content: '…' }, run, () => { emit('workspace.file', m.id, lead.id, { path: 'SUMMARY.md', bytes: 2400 }); return 'Wrote SUMMARY.md.'; });
        const final = `Here's where "${topic}" stands:\n\n${helpers.map((h) => `- ${h.name} (${h.title}): done — notes in notes/.`).join('\n') || '- I handled it myself.'}\n- Summary is in SUMMARY.md.\n\nNext: review the notes and tell me what to change. (This is the browser demo — run the server with a real model for real work.)`;
        await typeOut(lead, m, final, run);
        return final;
      } finally { end(lead.id); }
    }

    async function runMeeting(m, text, run) {
      const ps = m.participants.map(agent).filter(Boolean);
      const topic = clip(text.split(/[.\n]/)[0], 60);
      ps.forEach((p) => { begin(p.id); setPresence(p.id, 'meeting', m.title, m.id); });
      emit('meeting.started', m.id, null, { participants: ps.map((p) => p.id) });
      let last = '';
      try {
        await sleep(1800, run);
        for (let r = 0; r < m.meetingRounds; r++) {
          for (const p of ps) {
            const line = r === 0 ? contribution(p, topic) : pick([
              `Agree with the direction. One risk to watch: we're underestimating the edge cases. I'd add a day for them.`,
              `Building on that: let's ship the smallest version first and measure before adding more.`,
              `I'd push back slightly — we should settle the acceptance criteria before anyone builds.`,
              `Sounds good to me. I can take the first task on the board today.`,
            ]);
            await typeOut(p, m, line, run);
            setPresence(p.id, 'meeting', m.title, m.id);
            last = `${p.name}: ${line}`;
            await sleep(500, run);
          }
        }
      } finally {
        emit('meeting.ended', m.id, null, { participants: ps.map((p) => p.id) });
        ps.forEach((p) => end(p.id));
      }
      return last;
    }

    async function runChat(m, text, run) {
      const a = agent(m.leadId);
      begin(a.id);
      try {
        setPresence(a.id, 'thinking', null, m.id);
        await sleep(1100, run);
        const reply = `Hi! I'm ${a.name}${a.title ? `, ${a.title.toLowerCase()}` : ''}. About "${clip(text, 60)}": ${contribution(a, clip(text, 40)).split(': ').slice(1).join(': ') || 'happy to help — tell me more.'}`;
        await typeOut(a, m, reply, run);
        return reply;
      } finally { end(a.id); }
    }

    function launch(m, text) {
      if (runs.has(m.id)) throw new Error('They’re still working on the last message. Wait or cancel.');
      const run = { cancelled: false };
      runs.set(m.id, run);
      touch(m, { status: 'running', error: null });
      missionResumed(m);
      emit('user.message', m.id, null, { text });
      const work = m.mode === 'meeting' ? runMeeting : m.mode === 'chat' ? runChat : runDelegate;
      work(m, text, run)
        .then((result) => touch(m, { status: 'done', result }))
        .catch((err) => {
          if (err instanceof Cancelled) touch(m, { status: 'cancelled', error: 'Cancelled by the owner.' });
          else touch(m, { status: 'failed', error: err.message });
          for (const id of m.participants) { active.set(id, 0); setPresence(id, 'idle'); }
        })
        .finally(() => { runs.delete(m.id); missionEnded(m); });
    }

    function newMission(fields) {
      const m = {
        id: rid('ms'), title: '', goal: '', mode: 'delegate', leadId: '', participants: [], workspace: '~/agent-office-workspaces/demo',
        status: 'idle', result: null, error: null, meetingRounds: 2, board: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...fields,
      };
      state.missions.push(m);
      emit('mission.created', m.id, null, m);
      return m;
    }

    // ------------------------------------------------------------ API
    const routes = [
      ['GET', /^api\/office$/, () => ({
        name: state.name, defaultProvider: 'simulated',
        agents: state.agents.map((a) => ({ profile: a, presence: presence.get(a.id) || { status: 'idle' }, effective: { provider: 'simulated', model: 'simulated' } })),
        missions: [...state.missions].sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1)).map((m) => ({ mission: m, running: runs.has(m.id) })),
        recent: recent.slice(-120),
      })],
      ['PUT', /^api\/office\/name$/, (_, b) => { state.name = clip(b.name, 60) || state.name; emit('office.renamed', null, null, { name: state.name }); return { name: state.name }; }],
      ['GET', /^api\/providers$/, () => ({ default: 'simulated', providers: [
        { id: 'anthropic', label: 'Anthropic Claude', configured: false, defaultModel: 'claude-sonnet-5-5', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
        { id: 'openai', label: 'OpenAI-compatible', configured: false, defaultModel: '', models: [] },
        { id: 'ollama', label: 'Ollama (local)', configured: false, defaultModel: '', models: [] },
        { id: 'simulated', label: 'Simulated (no API key, for trying the office)', configured: true, defaultModel: 'simulated', models: ['simulated'] },
      ] })],
      ['GET', /^api\/roles$/, () => roleList()],
      ['POST', /^api\/roles$/, (_, b) => {
        const title = String(b.title || '').trim();
        if (!title || title.length > 80) throw new Error('A role needs a title (max 80 characters).');
        let r = state.roles.find((x) => x.title.toLowerCase() === title.toLowerCase());
        if (!r) { r = { id: rid('rl') }; state.roles.push(r); }
        Object.assign(r, { title, summary: clip(b.summary, 200), persona: b.persona || '', can: { ...(b.can || {}) }, look: { shirt: '#3E7CB1', accessory: 'none', ...(b.look || {}) }, skills: [...(b.skills || [])] });
        emit('roles.updated', null, null, { roles: roleList() });
        return roleList().find((x) => x.id === r.id);
      }],
      ['GET', /^api\/cards$/, () => clone(cardList())],
      ['POST', /^api\/cards$/, (_, b) => clone(createCard(b))],
      ['PUT', /^api\/cards\/([^/]+)$/, ([id], b) => {
        const c = findCard(id); if (!c) throw new Error('No such card.');
        const draft = applyCard({ ...c }, b); // validate on a copy first
        Object.assign(c, draft); cardsChanged(); return clone(c);
      }],
      ['POST', /^api\/cards\/([^/]+)\/move$/, ([id], b) => {
        const c = findCard(id); if (!c) throw new Error('No such card.');
        const to = COLS.includes(b.status) ? b.status : c.status;
        const col = state.cards.filter((x) => x.status === to && x !== c).sort((x, y) => x.order - y.order);
        const at = b.beforeId ? col.findIndex((x) => x.id === b.beforeId) : -1;
        c.order = at < 0 ? endOf(to, c) : at === 0 ? col[0].order - 1 : (col[at - 1].order + col[at].order) / 2;
        c.status = to; cardsChanged(); return clone(c);
      }],
      ['DELETE', /^api\/cards\/([^/]+)$/, ([id]) => {
        const c = findCard(id); if (!c) throw new Error('No such card.');
        state.cards = state.cards.filter((x) => x !== c); cardsChanged(); return null;
      }],
      ['POST', /^api\/cards\/([^/]+)\/start$/, ([id]) => {
        const c = findCard(id); if (!c) throw new Error('No such card.');
        return startCard(c);
      }],
      ['GET', /^api\/skills$/, () => clone(state.skills)],
      ['POST', /^api\/skills$/, (_, b) => saveSkill(b, true)],
      ['PUT', /^api\/skills\/([^/]+)$/, ([name], b) => {
        if (!state.skills.some((k) => k.name === decodeURIComponent(name))) throw new Error('No such skill.');
        return saveSkill({ ...b, name: decodeURIComponent(name) }, false);
      }],
      ['POST', /^api\/skills\/import$/, (_, b) => {
        const text = String(b.text || '').replace(/\r\n/g, '\n');
        const fm = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
        const meta = Object.fromEntries((fm?.[1] || '').split('\n').map((l) => /^([\w-]+):\s*(.*)$/.exec(l)).filter(Boolean).map(([, k, v]) => [k, v.replace(/^(["'])(.*)\1$/, '$2')]));
        if (!meta.name) throw new Error('That SKILL.md has no name in its frontmatter (the block between --- lines at the top).');
        return saveSkill({ name: meta.name, description: meta.description, instructions: (fm ? fm[2] : text).trim() }, false);
      }],
      ['DELETE', /^api\/skills\/([^/]+)$/, ([name]) => {
        name = decodeURIComponent(name);
        if (!state.skills.some((k) => k.name === name)) throw new Error('No such skill.');
        state.skills = state.skills.filter((k) => k.name !== name);
        for (const a of state.agents) if ((a.skills || []).includes(name)) { a.skills = a.skills.filter((n) => n !== name); emit('office.updated', null, a.id, a); }
        if (state.roles.some((r) => (r.skills || []).includes(name))) {
          for (const r of state.roles) r.skills = (r.skills || []).filter((n) => n !== name);
          emit('roles.updated', null, null, { roles: roleList() });
        }
        emit('skills.updated', null, null, { skills: state.skills });
        return null;
      }],
      ['DELETE', /^api\/roles\/([^/]+)$/, ([id]) => {
        if (!state.roles.some((r) => r.id === id)) throw new Error("No such role. Built-in roles can't be deleted.");
        state.roles = state.roles.filter((r) => r.id !== id);
        emit('roles.updated', null, null, { roles: roleList() });
        return null;
      }],
      ['POST', /^api\/agents$/, (_, b) => hire(b)],
      ['PUT', /^api\/agents\/([^/]+)$/, ([id], b) => {
        const a = agent(id); if (!a) throw new Error('No such colleague.');
        if (!String(b.name || '').trim()) throw new Error('Name is required (max 40 characters).');
        Object.assign(a, { name: b.name.trim(), title: b.title || '', persona: b.persona || '', provider: b.provider || '', model: b.model || '', look: b.look, can: b.can, skills: [...(b.skills || [])] });
        emit('office.updated', null, id, a); return clone(a);
      }],
      ['DELETE', /^api\/agents\/([^/]+)$/, ([id]) => {
        if ((active.get(id) || 0) > 0) throw new Error("They're in the middle of something. Cancel their mission first.");
        const a = agent(id); if (!a) throw new Error('No such colleague.');
        state.agents = state.agents.filter((x) => x.id !== id);
        if (state.cards.some((c) => c.assignee === id)) { for (const c of state.cards) if (c.assignee === id) c.assignee = null; cardsChanged(); }
        emit('office.fired', null, id, { id, name: a.name }); return null;
      }],
      ['POST', /^api\/agents\/([^/]+)\/chat$/, ([id], b) => {
        const a = agent(id); if (!a) throw new Error('No such colleague.');
        const m = state.missions.find((x) => x.mode === 'chat' && x.leadId === id) || newMission({ title: `Chat with ${a.name}`, mode: 'chat', leadId: id, participants: [id] });
        if (b && String(b.text || '').trim()) launch(m, b.text.trim());
        return clone(m);
      }],
      ['POST', /^api\/missions$/, (_, b) => {
        if (!String(b.goal || '').trim()) throw new Error('Describe the goal.');
        const parts = (b.participants || []).filter((id) => agent(id));
        const lead = b.leadId && agent(b.leadId) ? b.leadId : parts[0];
        if (b.mode === 'meeting' && parts.length < 2) throw new Error('A meeting needs at least two colleagues.');
        if (b.mode !== 'meeting' && !lead) throw new Error('Pick who leads this mission.');
        if (lead && !parts.includes(lead)) parts.unshift(lead);
        const m = newMission({ title: clip(b.title, 80) || clip(b.goal, 60), goal: b.goal.trim(), mode: b.mode === 'meeting' ? 'meeting' : 'delegate', leadId: lead, participants: parts, meetingRounds: Math.min(5, Math.max(1, b.meetingRounds || 2)) });
        launch(m, m.goal);
        return clone(m);
      }],
      ['GET', /^api\/missions\/([^/]+)$/, ([id]) => {
        const m = mission(id); if (!m) throw new Error('No such mission.');
        return { mission: m, running: runs.has(id), events: events.get(id) || [] };
      }],
      ['POST', /^api\/missions\/([^/]+)\/messages$/, ([id], b) => {
        const m = mission(id); if (!m) throw new Error('No such mission.');
        if (!String(b.text || '').trim()) throw new Error('Message is empty.');
        launch(m, b.text.trim()); return null;
      }],
      ['POST', /^api\/missions\/([^/]+)\/cancel$/, ([id]) => {
        const r = runs.get(id); if (!r) throw new Error("That mission isn't running.");
        r.cancelled = true; return null;
      }],
    ];

    async function call(method, path, body) {
      await new Promise((r) => setTimeout(r, 60));
      for (const [m, re, fn] of routes) {
        const match = m === method && path.match(re);
        if (match) return clone(fn(match.slice(1), body || {}));
      }
      throw new Error(`Not found: ${method} ${path}`);
    }

    // ------------------------------------------------------------ seed: a small team already at work
    const seed = [
      ['Nora', 'Project Manager', { skin: '#E8B98F', hair: '#4A3020', hairStyle: 'bun', accessory: 'glasses' }],
      ['Tigran', 'Software Engineer', { skin: '#C68B59', hair: '#1F1A17', hairStyle: 'short', accessory: 'headphones' }],
      ['Mei', 'QA Engineer', { skin: '#F2D3B3', hair: '#1F1A17', hairStyle: 'long', accessory: 'none' }],
      ['Samir', 'Product Designer', { skin: '#A86B3C', hair: '#1F1A17', hairStyle: 'curly', accessory: 'none' }],
      ['Lena', 'Site Reliability Engineer', { skin: '#F2D3B3', hair: '#C9A063', hairStyle: 'short', accessory: 'cap' }],
    ];
    for (const [name, title, look] of seed) {
      const r = ROLES.find((x) => x.title === title) || {};
      const a = { id: rid('ag'), name, title, persona: r.persona || '', provider: '', model: '', look: { shirt: (r.look || {}).shirt || '#3E7CB1', ...look }, can: { files: true, shell: false, web: false, delegate: true, ...(r.can || {}) }, desk: state.agents.length, hiredAt: new Date().toISOString() };
      state.agents.push(a);
    }
    // A board with some history, so there's something to look at.
    const [nora, tigran, mei, samir, lena] = state.agents.map((a) => a.id);
    const first = createCard({ title: 'Password reset for the customer portal', description: 'Add password reset to the customer portal. Email link, 30-minute expiry, tests included.', status: 'todo', assignee: nora, priority: 'high', points: 5 });
    for (const c of [
      { title: 'Fix the flaky checkout test', description: 'The checkout integration test fails about one run in ten. Find out why and fix it.', status: 'todo', assignee: mei, points: 3 },
      { title: 'Speed up the dashboard query', description: 'The orders dashboard takes 4 seconds to load. Find the slow query and fix it.', status: 'todo', assignee: tigran, priority: 'urgent', points: 5 },
      { title: 'Add rate limiting to the login API', description: 'Limit failed login attempts per account and per IP, with tests.', status: 'backlog', priority: 'high', points: 8 },
      { title: 'Dark mode for the admin app', description: 'Follow the system setting; keep contrast at AA or better.', status: 'backlog', points: 5 },
      { title: 'Export orders as CSV', description: 'From the orders page, respecting the current filters.', status: 'backlog', priority: 'low' },
      { title: 'Review the new onboarding flow', description: 'Review the new onboarding screens for clarity and accessibility.', status: 'review', assignee: samir, points: 2 },
      { title: 'Rotate the staging database password', description: 'Rotate it and update the secret store.', status: 'todo', assignee: lena, points: 1, blocked: true, blockedReason: 'Waiting for access to the secret store' },
      { title: 'Set up error tracking', description: 'Send server errors to the error tracker with release tags.', status: 'done', assignee: lena, points: 3 },
      { title: 'Write release notes for 2.2', description: 'From the merged changes.', status: 'done', assignee: nora, points: 1 },
    ]) createCard(c);
    setTimeout(() => startCard(first), 1600);

    // Keep the demo office alive: when nothing is running for a while, someone picks up a small job.
    const chores = [
      ['Fix the flaky checkout test', 'The checkout integration test fails about one run in ten. Find out why and fix it.'],
      ['Speed up the dashboard query', 'The orders dashboard takes 4 seconds to load. Find the slow query and fix it.'],
      ['Write release notes for 2.3', 'Write release notes for version 2.3 from the merged changes.'],
      ['Add rate limiting to the login API', 'Limit failed login attempts per account and per IP, with tests.'],
      ['Review the new onboarding flow', 'Review the new onboarding screens for clarity and accessibility.'],
    ];
    let quietSince = Date.now();
    setInterval(() => {
      if (runs.size > 0 || state.agents.length === 0) { quietSince = Date.now(); return; }
      if (Date.now() - quietSince < 75000) return;
      // Someone picks up the next assigned card from To do, or a small chore that goes on the board.
      const next = cardList().find((c) => c.status === 'todo' && !c.blocked && agent(c.assignee));
      if (next) startCard(next);
      else {
        const [title, description] = pick(chores);
        startCard(createCard({ title, description, status: 'todo', assignee: pick(state.agents).id, points: pick([1, 2, 3, 5]) }, pick(state.agents).name));
      }
      quietSince = Date.now();
    }, 5000);

    return {
      demo: true,
      get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p),
      onEvent: (fn) => { handler = fn; },
    };
  }

  return { create };
})();
