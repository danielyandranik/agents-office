/* Agent Office UI — vanilla JS, no build step.
   The floor is a projection of server events: presence decides where each person is and what they're doing. */
(() => {
  'use strict';

  // ================================================================ utilities
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clip = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const tail = (s, n) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? '…' + s.slice(-(n - 1)) : s; };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const timeOf = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const raf = (fn) => requestAnimationFrame(fn);

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 4200);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  // ================================================================ look options
  const SKINS = ['#F2D3B3', '#E8B98F', '#C68B59', '#A86B3C', '#7D4B2A', '#4E2F1C'];
  const HAIRS = ['#1F1A17', '#4A3020', '#8A5A2B', '#C9A063', '#B4462E', '#9AA0A6', '#E8E4DA'];
  const SHIRTS = ['#3E7CB1', '#5C946E', '#C9628B', '#3B3B58', '#D8A031', '#7A5C99', '#2F6F73', '#8C3B3B', '#A3B18A', '#457B9D', '#E07A5F', '#264653'];
  const HAIR_STYLES = [['short', 'Short'], ['long', 'Long'], ['bun', 'Bun'], ['curly', 'Curly'], ['bald', 'None']];
  const ACCESSORIES = [['none', 'None'], ['glasses', 'Glasses'], ['headphones', 'Headphones'], ['cap', 'Cap']];
  const NAMES = ['Nora', 'Tigran', 'Mei', 'Samir', 'Lena', 'Diego', 'Anahit', 'Kofi', 'Ingrid', 'Ravi', 'Yuki', 'Omar', 'Clara', 'Arman', 'Zoe', 'Mateo',
    'Aisha', 'Lukas', 'Priya', 'Hugo', 'Sofia', 'Emeka', 'Hana', 'Felix', 'Lucia', 'Davit', 'Maya', 'Jonas', 'Leila', 'Theo', 'Nadia', 'Kai'];
  const randomLook = () => ({
    skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(['short', 'short', 'long', 'bun', 'curly', 'bald']),
    shirt: pick(SHIRTS), accessory: pick(['none', 'none', 'glasses', 'headphones', 'cap']),
  });

  // ================================================================ paper-cut person
  /** crop: 'full' (walking body), 'bust' (portrait), 'head' (tiny chips) */
  function avatar(look = {}, crop = 'full') {
    const L = { skin: '#C68B59', hair: '#2B2118', hairStyle: 'short', shirt: '#3E7CB1', accessory: 'none', ...look };
    const vb = crop === 'head' ? '12 6 40 40' : crop === 'bust' ? '4 2 56 98' : '0 0 64 112';
    const sleeve = shade(L.shirt, -0.08);
    const hairBack = {
      long: `<path d="M15 24 Q15 8 32 8 Q49 8 49 24 L50 50 Q41 53 32 53 Q23 53 14 50 Z" fill="${L.hair}"/>`,
      curly: '',
      bun: `<circle cx="32" cy="8" r="6.5" fill="${L.hair}"/>`,
    }[L.hairStyle] || '';
    const hairFront = {
      short: `<path d="M16.5 25 Q16 8.5 32 8.5 Q48 8.5 47.5 25 Q44 16.5 32 16 Q21 16.5 16.5 25 Z" fill="${L.hair}"/>`,
      long: `<path d="M16 26 Q16 9 32 9 Q48 9 48 26 Q43 15 32 15 Q22 15 16 26 Z" fill="${L.hair}"/>`,
      bun: `<path d="M16.5 24 Q17 9.5 32 9.5 Q47 9.5 47.5 24 Q43 15.5 32 15.5 Q21 15.5 16.5 24 Z" fill="${L.hair}"/>`,
      curly: [[19, 17], [25, 11.5], [32, 10], [39, 11.5], [45, 17], [16.5, 24], [47.5, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${L.hair}"/>`).join(''),
      bald: '',
    }[L.hairStyle] || '';
    const acc = {
      glasses: `<g fill="none" stroke="#1D2836" stroke-width="1.6"><circle cx="26.5" cy="27" r="4.4"/><circle cx="37.5" cy="27" r="4.4"/><path d="M30.9 27 h2.2"/></g>`,
      headphones: `<path d="M15 27 Q15 6 32 6 Q49 6 49 27" fill="none" stroke="#1D2836" stroke-width="3"/><rect x="11.5" y="23" width="7" height="11" rx="3" fill="#1D2836"/><rect x="45.5" y="23" width="7" height="11" rx="3" fill="#1D2836"/>`,
      cap: `<path d="M16 22 Q16 7 32 7 Q48 7 48 22 Z" fill="${shade(L.shirt, -0.15)}"/><path d="M30 21 h22 q2 0 2 2 v0 q0 2 -2 2 h-22 z" fill="${shade(L.shirt, -0.25)}"/>`,
    }[L.accessory] || '';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g class="legs">
        <g class="leg-l"><rect x="20" y="82" width="10" height="24" rx="4" fill="#3D4451"/><ellipse cx="25" cy="107" rx="6.5" ry="3" fill="#22262D"/></g>
        <g class="leg-r"><rect x="34" y="82" width="10" height="24" rx="4" fill="#3D4451"/><ellipse cx="39" cy="107" rx="6.5" ry="3" fill="#22262D"/></g>
      </g>
      ${hairBack}
      <rect x="27" y="37" width="10" height="11" rx="3" fill="${shade(L.skin, -0.06)}"/>
      <path d="M11 86 V62 Q11 45.5 32 45.5 Q53 45.5 53 62 V86 Z" fill="${L.shirt}"/>
      <path d="M26 46 L32 53 L38 46" fill="none" stroke="${shade(L.shirt, -0.18)}" stroke-width="1.6"/>
      <g class="arm-l"><rect x="6.5" y="51" width="9.5" height="27" rx="4.75" fill="${sleeve}"/><circle cx="11.25" cy="78" r="4.2" fill="${L.skin}"/></g>
      <g class="arm-r"><rect x="48" y="51" width="9.5" height="27" rx="4.75" fill="${sleeve}"/><circle cx="52.75" cy="78" r="4.2" fill="${L.skin}"/></g>
      <circle cx="32" cy="26" r="15" fill="${L.skin}"/>
      <circle cx="22.5" cy="31.5" r="2.6" fill="#E88B7A" opacity=".35"/><circle cx="41.5" cy="31.5" r="2.6" fill="#E88B7A" opacity=".35"/>
      <g class="eyes"><circle cx="26.5" cy="27" r="1.9" fill="#1D2836"/><circle cx="37.5" cy="27" r="1.9" fill="#1D2836"/></g>
      <path d="M28.5 33.5 Q32 36 35.5 33.5" fill="none" stroke="#1D2836" stroke-width="1.5" stroke-linecap="round"/>
      ${hairFront}${acc}
    </svg>`;
  }

  // ================================================================ floor geometry
  const W = 1240;
  const COLS = 4, DESK_X0 = 50, DESK_Y0 = 196, DX = 205, DY = 180, DESK_W = 170;
  const MEET = { x: 892, y: 156, w: 320, h: 330 };
  const deskXY = (slot) => ({ x: DESK_X0 + (slot % COLS) * DX, y: DESK_Y0 + Math.floor(slot / COLS) * DY, row: Math.floor(slot / COLS) });
  const seatXY = (slot) => { const d = deskXY(slot); return { x: d.x + DESK_W / 2 - 32, y: d.y - 64, z: 10 + d.row * 10 + 2 }; };
  const visitorXY = (slot) => { const d = deskXY(slot); return { x: d.x + DESK_W - 30, y: d.y + 18, z: 400 }; };
  const meetingXY = (k, n) => {
    const cx = MEET.x + MEET.w / 2, cy = MEET.y + MEET.h / 2 + 8;
    const a = -Math.PI / 2 + (2 * Math.PI * k) / Math.max(n, 1);
    return { x: cx + Math.cos(a) * 128 - 32, y: cy + Math.sin(a) * 92 - 92, z: 300 + Math.round(Math.sin(a) * 50) };
  };
  const stageHeight = () => {
    const slots = Math.max(...[...S.agents.values()].map((a) => a.profile.desk + 1), 0);
    const rows = Math.max(3, Math.ceil((slots + 1) / COLS));
    return Math.max(820, DESK_Y0 + rows * DY + 40);
  };
  const doorXY = () => ({ x: -70, y: stageHeight() - 190, z: 500 });

  // ================================================================ state
  const S = {
    name: 'Agent Office',
    defaultProvider: 'simulated',
    agents: new Map(),        // id -> { profile, presence, effective }
    missions: new Map(),      // id -> mission (+ running)
    feeds: new Map(),         // missionId -> items[]
    agentFeeds: new Map(),    // agentId -> items[]
    bubbles: new Map(),       // agentId -> { text, kind, until }
    loadedMissions: new Set(),
    chatMission: new Map(),   // agentId -> missionId
    focus: null,
    selected: null,
    drawer: null,             // 'agent' | 'missions' | null
    tab: 'activity',
    providers: [],
    roles: [],
    demo: false,
    consoleCollapsed: false,
  };
  const people = new Map(); // agentId -> element
  let backend;

  // ================================================================ backend (real server or in-browser demo)
  async function connect() {
    const real = await tryRealBackend();
    backend = real || window.DemoOffice.create();
    S.demo = !real;
    $('#demoFlag').hidden = !S.demo;
    backend.onEvent(onEvent);
    if (backend.onReconnect) backend.onReconnect(loadSnapshot);
    await loadSnapshot();
    const [prov, roles] = await Promise.all([backend.get('api/providers').catch(() => null), backend.get('api/roles').catch(() => [])]);
    S.providers = prov?.providers || [];
    S.roles = roles || [];
  }

  async function tryRealBackend() {
    if (location.protocol === 'file:' || new URLSearchParams(location.search).has('demo')) return null;
    try {
      const probe = await fetch('api/office', { headers: { accept: 'application/json' } });
      if (!probe.ok || !(probe.headers.get('content-type') || '').includes('json')) return null;
    } catch { return null; }

    const call = async (method, path, body) => {
      const res = await fetch(path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 204 || res.status === 202) return null;
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.title || `Request failed (${res.status}).`);
      return data;
    };
    let handler = () => {}, reconnect = () => {};
    const hub = new signalR.HubConnectionBuilder().withUrl('hub').withAutomaticReconnect().build();
    hub.on('event', (e) => handler(e));
    hub.onreconnected(() => reconnect());
    await hub.start();
    return {
      get: (p) => call('GET', p), post: (p, b) => call('POST', p, b || {}), put: (p, b) => call('PUT', p, b), del: (p) => call('DELETE', p),
      onEvent: (fn) => { handler = fn; }, onReconnect: (fn) => { reconnect = fn; },
    };
  }

  async function loadSnapshot() {
    const snap = await backend.get('api/office');
    S.name = snap.name;
    S.defaultProvider = snap.defaultProvider;
    S.agents.clear();
    for (const a of snap.agents) S.agents.set(a.profile.id, { profile: a.profile, presence: a.presence, effective: a.effective });
    S.missions.clear();
    for (const m of snap.missions) S.missions.set(m.mission.id, { ...m.mission, running: m.running });
    for (const m of S.missions.values()) if (m.mode === 'chat') S.chatMission.set(m.leadId, m.id);
    for (const e of snap.recent || []) applyToFeeds(e, true);
    if (!S.focus) {
      const latest = [...S.missions.values()].filter((m) => m.mode !== 'chat').sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))[0];
      if (latest) await focusMission(latest.id, false);
    }
    for (const id of [...people.keys()]) if (!S.agents.has(id)) { people.get(id).remove(); people.delete(id); }
    renderAll();
  }

  // ================================================================ events
  function onEvent(e) {
    applyToFeeds(e, false);
    const a = e.agentId ? S.agents.get(e.agentId) : null;
    const d = e.data || {};

    switch (e.kind) {
      case 'agent.status':
        if (a) {
          a.presence = d;
          if (d.status === 'presenting' && d.missionId) {
            // The floor passes to a new speaker: everyone else's bubble in that meeting goes away.
            for (const pid of S.missions.get(d.missionId)?.participants || []) {
              if (pid !== e.agentId && S.bubbles.has(pid)) { clearTimeout(S.bubbles.get(pid).timer); S.bubbles.delete(pid); updatePerson(pid); }
            }
          }
          updatePerson(e.agentId); updateNameplate(e.agentId);
        }
        break;
      case 'agent.delta':
        if (a) {
          const b = S.bubbles.get(e.agentId);
          const text = (b && b.kind === 'speech' && b.until > Date.now() ? b.text : '') + d.text;
          say(e.agentId, text, 'speech', 6000);
        }
        break;
      case 'agent.said':
        if (a && d.text && !d.interim) say(e.agentId, d.text, 'speech', S.missions.get(e.missionId)?.mode === 'meeting' ? 2500 : 5000);
        break;
      case 'agent.visit':
        say(d.from, d.request, 'speech', 5500);
        break;
      case 'agent.return':
        say(d.from, d.summary, 'speech', 5500);
        break;
      case 'office.hired':
        S.agents.set(d.id, { profile: d, presence: { status: 'idle' }, effective: null });
        renderStage(); enterPerson(d.id); updateHeadcount();
        break;
      case 'office.updated':
        if (a) { a.profile = d; renderStage(); refreshPerson(d.id); if (S.selected === d.id && S.tab !== 'profile') renderDrawer(); }
        break;
      case 'office.fired':
        leavePerson(e.agentId);
        break;
      case 'office.renamed':
        S.name = d.name; $('#officeName').textContent = S.name; document.title = S.name;
        break;
      case 'mission.created':
      case 'mission.updated': {
        const prev = S.missions.get(d.id);
        const running = d.status === 'running';
        S.missions.set(d.id, { ...d, running });
        if (d.mode === 'chat') S.chatMission.set(d.leadId, d.id);
        if (e.kind === 'mission.created' && d.mode !== 'chat' && (!S.focus || !S.missions.get(S.focus)?.running)) focusMission(d.id, false);
        if (prev?.status === 'running' && d.status !== 'running' && d.mode !== 'chat') {
          toast(d.status === 'done' ? `“${clip(d.title, 50)}” is done.` : d.status === 'failed' ? `“${clip(d.title, 40)}” failed: ${clip(d.error, 80)}` : `“${clip(d.title, 50)}” was cancelled.`);
        }
        renderWhiteboard(); renderConsole(); updateRunningCount();
        if (S.drawer === 'missions') renderDrawer();
        break;
      }
      case 'board.updated': {
        const m = S.missions.get(e.missionId);
        if (m) { m.board = d.tasks; if (S.focus === e.missionId) renderWhiteboard(); }
        break;
      }
    }

    if (e.missionId && (e.missionId === S.focus || e.missionId === S.chatMission.get(S.selected))) scheduleFeeds();
    else if (e.agentId === S.selected) scheduleFeeds();
  }

  /** Feed model: one list per mission and per colleague, built from events (live or replayed). */
  function applyToFeeds(e, replay) {
    const d = e.data || {};
    const push = (item) => {
      item.ts = e.ts; item.seq = e.seq;
      if (e.missionId) {
        const f = S.feeds.get(e.missionId) || []; f.push(item); if (f.length > 1500) f.splice(0, f.length - 1500); S.feeds.set(e.missionId, f);
      }
      if (item.agentId) {
        const f = S.agentFeeds.get(item.agentId) || []; f.push(item); if (f.length > 300) f.splice(0, f.length - 300); S.agentFeeds.set(item.agentId, f);
      }
      return item;
    };
    const openSpeech = (agentId) => {
      const f = S.feeds.get(e.missionId) || [];
      for (let i = f.length - 1; i >= Math.max(0, f.length - 40); i--) if (f[i].kind === 'speech' && f[i].agentId === agentId && f[i].open) return f[i];
      return null;
    };

    switch (e.kind) {
      case 'user.message': push({ kind: 'owner', text: d.text }); break;
      case 'agent.delta': {
        if (replay) break;
        const it = openSpeech(e.agentId);
        if (it) it.text += d.text; else push({ kind: 'speech', agentId: e.agentId, text: d.text, open: true });
        break;
      }
      case 'agent.said': {
        const it = openSpeech(e.agentId);
        if (it) { it.text = d.text || it.text; it.open = false; }
        else if (d.text) push({ kind: 'speech', agentId: e.agentId, text: d.text, open: false });
        break;
      }
      case 'agent.tool':
        if (d.tool === 'ask_colleague') break;
        push({ kind: 'tool', agentId: e.agentId, tool: d.tool, text: `${d.tool}(${clip(d.args, 220)})` });
        break;
      case 'agent.tool_result':
        if (d.ok === false) push({ kind: 'error', agentId: e.agentId, text: `${d.tool || 'tool'} failed: ${clip(d.result, 240)}` });
        break;
      case 'agent.visit': push({ kind: 'visit', agentId: d.from, to: d.to, text: `asked ${nameOf(d.to)}: ${d.request}` }); break;
      case 'workspace.file': push({ kind: 'file', agentId: e.agentId, text: `wrote ${d.path}` }); break;
      case 'meeting.started': push({ kind: 'system', text: `Meeting started with ${(d.participants || []).map(nameOf).join(', ')}.` }); break;
      case 'mission.updated':
        if (d.status === 'failed') push({ kind: 'error', text: `Mission failed: ${d.error}` });
        else if (d.status === 'cancelled' && !replay) push({ kind: 'system', text: d.error || 'Cancelled.' });
        break;
    }
  }

  const nameOf = (id) => S.agents.get(id)?.profile.name || 'someone';

  // ================================================================ floor rendering
  let sizer;
  function renderStage() {
    const stage = $('#stage');
    const H = stageHeight();
    stage.style.height = H + 'px';
    if (!sizer) {
      sizer = document.createElement('div');
      sizer.className = 'stage-sizer';
      sizer.style.position = 'relative';
      sizer.style.overflow = 'hidden';
      stage.parentNode.insertBefore(sizer, stage);
      sizer.append(stage);
    }

    const agents = [...S.agents.values()];
    const occupied = new Map(agents.map((a) => [a.profile.desk, a]));
    const maxSlot = Math.max(-1, ...agents.map((a) => a.profile.desk));
    const slots = Math.max(COLS * 2, Math.ceil((maxSlot + 2) / COLS) * COLS);
    const lounge = { x: MEET.x, y: MEET.y + MEET.h + 28, w: MEET.w, h: H - (MEET.y + MEET.h + 28) - 30 };

    let html = `<div class="wall"></div>
      <div class="door" style="top:${H - 150}px" title="Door"></div>
      <div class="whiteboard" id="whiteboard" role="button" tabindex="0" aria-label="Mission board"></div>
      <div class="room meeting" style="left:${MEET.x}px;top:${MEET.y}px;width:${MEET.w}px;height:${MEET.h}px"><span class="room-label">Meeting room</span>
        <div class="meeting-table" style="left:${MEET.w / 2 - 100}px;top:${MEET.h / 2 - 50}px;width:200px;height:116px"></div></div>
      <div class="room lounge" style="left:${lounge.x}px;top:${lounge.y}px;width:${lounge.w}px;height:${lounge.h}px"><span class="room-label">Kitchen</span>
        <div class="sofa" style="left:24px;top:${Math.max(48, lounge.h - 80)}px"></div>
        <div class="coffee" style="left:${lounge.w - 70}px;top:44px"></div>
        <div class="plant" style="left:${lounge.w - 64}px;top:${Math.max(120, lounge.h - 70)}px"></div></div>`;

    for (let i = 0; i < slots; i++) {
      const { x, y, row } = deskXY(i);
      const a = occupied.get(i);
      const st = a?.presence?.status || 'idle';
      html += `<div class="desk ${a ? '' : 'vacant'} ${a && ['typing', 'working', 'thinking'].includes(st) ? 'busy' : ''}" data-desk="${i}" ${a ? `data-agent="${a.profile.id}"` : ''}
        style="left:${x}px;top:${y}px;z-index:${10 + row * 10 + 5}">
        <div class="top"><div class="laptop"></div><div class="mug"></div></div><div class="front"></div>
        ${a ? `<button class="nameplate" data-agent="${a.profile.id}" title="${esc(a.profile.title)}"><i class="dot ${esc(st)}"></i><span>${esc(a.profile.name)}</span></button>` : ''}
      </div>`;
    }

    if (agents.length === 0) {
      html += `<div class="empty-office">
        <h2>An empty office, ready for a team</h2>
        <p>Hire colleagues one by one — any role, any instructions, any model — or start with a small software team and change it later.</p>
        <div class="row"><button class="btn primary" data-action="hire">Hire your first colleague</button>
        <button class="btn" data-action="starter">Hire a starter team</button></div></div>`;
    }

    stage.innerHTML = html;
    for (const el of people.values()) stage.append(el);
    renderWhiteboard();
    fitStage();
  }

  function fitStage() {
    if (!sizer) return;
    const wrap = $('#floorWrap');
    const H = stageHeight();
    const scale = Math.max(0.56, Math.min(1, (wrap.clientWidth - 2) / W)); // below this, pan instead of shrinking
    $('#stage').style.transform = `scale(${scale})`;
    sizer.style.width = W * scale + 'px';
    sizer.style.height = H * scale + 'px';
    sizer.style.margin = '0 auto';
  }

  function personTarget(id) {
    const a = S.agents.get(id);
    if (!a) return null;
    const p = a.presence || { status: 'idle' };
    if (p.status === 'visiting' && p.with && S.agents.has(p.with)) {
      return { ...visitorXY(S.agents.get(p.with).profile.desk), standing: true, key: 'visit:' + p.with };
    }
    if ((p.status === 'meeting' || p.status === 'presenting') && p.missionId) {
      const m = S.missions.get(p.missionId);
      const list = m?.participants || [];
      const k = Math.max(0, list.indexOf(id));
      return { ...meetingXY(k, list.length || 1), standing: true, key: 'meet:' + p.missionId + ':' + k };
    }
    return { ...seatXY(a.profile.desk), standing: false, key: 'desk:' + a.profile.desk };
  }

  function createPerson(id) {
    const el = document.createElement('div');
    el.className = 'person';
    el.dataset.agent = id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.innerHTML = `${avatar(S.agents.get(id).profile.look)}<div class="ind"></div>`;
    el.addEventListener('transitionend', (ev) => {
      if (ev.propertyName !== 'left' && ev.propertyName !== 'top') return;
      el.classList.remove('walking');
      const t = personTarget(id);
      el.classList.toggle('standing', !!t?.standing);
      el.style.zIndex = t?.z ?? 20;
      if (el.dataset.leaving) { el.remove(); people.delete(id); }
    });
    people.set(id, el);
    $('#stage').append(el);
    return el;
  }

  function refreshPerson(id) {
    const el = people.get(id);
    if (!el) return;
    el.querySelector('svg').outerHTML = avatar(S.agents.get(id).profile.look);
    updatePerson(id);
  }

  function placePerson(id, instant) {
    const el = people.get(id) || createPerson(id);
    const t = personTarget(id);
    if (!t || el.dataset.leaving) return;
    if (el.dataset.key === t.key) return;
    const firstPlacement = !el.dataset.key;
    el.dataset.key = t.key;
    el.classList.toggle('edge-r', t.x > W - 210);
    el.classList.toggle('edge-l', t.x < 70);
    if (firstPlacement || instant) {
      el.style.transition = 'none';
      el.style.left = t.x + 'px'; el.style.top = t.y + 'px';
      el.style.zIndex = t.z;
      el.classList.toggle('standing', t.standing);
      void el.offsetWidth;
      el.style.transition = '';
      return;
    }
    el.classList.add('walking', 'standing');
    el.style.zIndex = 450;
    el.style.left = t.x + 'px'; el.style.top = t.y + 'px';
  }

  function enterPerson(id) {
    const el = people.get(id) || createPerson(id);
    const door = doorXY();
    el.style.transition = 'none';
    el.style.left = door.x + 'px'; el.style.top = door.y + 'px';
    el.dataset.key = 'door';
    void el.offsetWidth;
    el.style.transition = '';
    raf(() => raf(() => updatePerson(id)));
  }

  function leavePerson(id) {
    const el = people.get(id);
    S.agents.delete(id);
    if (S.selected === id) closeDrawer();
    if (el) {
      const door = doorXY();
      el.dataset.leaving = '1';
      el.classList.add('walking', 'standing');
      el.querySelector('.ind').innerHTML = '';
      el.style.zIndex = 450;
      el.style.left = door.x + 'px'; el.style.top = door.y + 'px';
      setTimeout(() => { if (people.get(id) === el) { el.remove(); people.delete(id); } }, 1600);
    }
    renderStage(); updateHeadcount();
  }

  function say(id, text, kind, ms) {
    if (!text || !S.agents.has(id)) return;
    const prev = S.bubbles.get(id);
    if (prev?.timer) clearTimeout(prev.timer);
    const b = { text, kind, until: Date.now() + ms };
    b.timer = setTimeout(() => { if (S.bubbles.get(id) === b) { S.bubbles.delete(id); updatePerson(id); } }, ms);
    S.bubbles.set(id, b);
    updatePerson(id);
  }

  function updatePerson(id) {
    const a = S.agents.get(id);
    if (!a) return;
    placePerson(id);
    const el = people.get(id);
    if (!el) return;
    const st = a.presence?.status || 'idle';
    for (const c of ['thinking', 'typing', 'working', 'visiting', 'meeting', 'presenting']) el.classList.toggle(c, st === c);
    el.classList.toggle('selected', S.selected === id);
    el.setAttribute('aria-label', `${a.profile.name}, ${a.profile.title || 'colleague'} — ${statusText(a.presence)}`);

    const b = S.bubbles.get(id);
    const ind = el.querySelector('.ind');
    if (b && b.until > Date.now()) ind.innerHTML = `<div class="bubble">${esc(tail(b.text, 170))}</div>`;
    else if (st === 'working' && a.presence.detail) ind.innerHTML = `<div class="chip">${esc(a.presence.detail)}</div>`;
    else if (st === 'thinking' || st === 'visiting') ind.innerHTML = `<div class="bubble thought"><span class="thinking-dots"><i></i><i></i><i></i></span></div>`;
    else ind.innerHTML = '';

    const desk = document.querySelector(`.desk[data-agent="${id}"]`);
    if (desk) desk.classList.toggle('busy', ['typing', 'working', 'thinking'].includes(st));
  }

  function updateNameplate(id) {
    const dot = document.querySelector(`.nameplate[data-agent="${id}"] .dot`);
    if (dot) dot.className = `dot ${S.agents.get(id)?.presence?.status || 'idle'}`;
    if (S.selected === id && S.drawer === 'agent') {
      const line = $('#drawerStatus');
      if (line) line.textContent = statusText(S.agents.get(id).presence);
    }
  }

  function statusText(p) {
    const s = p?.status || 'idle';
    const withName = p?.with ? nameOf(p.with) : p?.detail;
    return {
      idle: 'Free', thinking: 'Thinking', typing: 'Writing', working: p?.detail ? clip(p.detail, 40) : 'Working',
      visiting: `Talking with ${withName || 'a colleague'}`, meeting: 'In a meeting', presenting: 'Speaking in a meeting',
    }[s] || s;
  }

  function renderWhiteboard() {
    const wb = $('#whiteboard');
    if (!wb) return;
    const m = S.focus ? S.missions.get(S.focus) : null;
    if (!m) {
      wb.innerHTML = `<div class="wb-title">${esc(S.name)}<small>${S.agents.size ? 'Start a mission and the plan shows up here.' : 'Hire someone to get going.'}</small></div>`;
      return;
    }
    const tasks = (m.board || []).slice(-7);
    const tilt = (i) => [-1.5, 1, -0.5, 1.5, -1, 0.5, -2][i % 7];
    wb.innerHTML = `<div class="wb-title">${esc(clip(m.title, 60))}<small>${esc(modeLabel(m))}</small></div>
      <div class="stickies">${tasks.length ? tasks.map((t, i) => `<div class="sticky ${esc(t.status)}" style="--tilt:${tilt(i)}deg" title="${esc(t.title)}${t.note ? ' — ' + esc(t.note) : ''}">
        <span>${esc(t.title)}</span><em>${esc(t.assignee || t.id)}</em></div>`).join('')
      : `<div class="sticky todo" style="--tilt:-1deg"><span>No tasks yet</span><em>board</em></div>`}</div>`;
  }

  const modeLabel = (m) => m.mode === 'meeting' ? `Meeting · ${m.participants.length} people` : m.mode === 'chat' ? 'Chat' : `Led by ${nameOf(m.leadId)}`;

  // ================================================================ console (focused mission)
  async function focusMission(id, openConsole = true) {
    S.focus = id;
    if (!S.loadedMissions.has(id)) {
      S.loadedMissions.add(id);
      try {
        const res = await backend.get(`api/missions/${id}`);
        S.missions.set(id, { ...res.mission, running: res.running });
        S.feeds.set(id, []);
        for (const e of res.events) applyToFeeds(e, true);
      } catch (err) { toast(err.message); }
    }
    if (openConsole) S.consoleCollapsed = false;
    renderWhiteboard(); renderConsole();
    if (S.drawer === 'missions') renderDrawer();
  }

  function renderConsole() {
    const host = $('#console');
    const m = S.focus ? S.missions.get(S.focus) : null;
    host.classList.toggle('collapsed', S.consoleCollapsed);
    if (!m) {
      host.innerHTML = `<div class="console-head"><h4>No mission selected</h4><span class="spacer" style="flex:1"></span>
        ${S.agents.size ? '<button class="btn" data-action="new-mission">New mission</button>' : ''}</div>`;
      return;
    }
    const lead = m.mode === 'meeting' ? 'the team' : nameOf(m.leadId);
    host.innerHTML = `<div class="console-head">
        <h4 title="${esc(m.goal)}">${esc(m.title)}</h4>
        <span class="status-pill ${esc(m.status)}">${esc(missionStatusText(m))}</span>
        <span class="spacer" style="flex:1"></span>
        ${m.running ? '<button class="btn danger" data-action="cancel">Cancel</button>' : ''}
        <button class="btn ghost" data-action="toggle-console" aria-expanded="${!S.consoleCollapsed}">${S.consoleCollapsed ? 'Show log' : 'Hide log'}</button>
      </div>
      <div class="console-body" id="consoleFeed"></div>
      <form class="composer" data-form="mission-message">
        <label class="sr-only" for="missionMsg">Message</label>
        <textarea id="missionMsg" rows="1" placeholder="${m.running ? 'They’re working — you can reply when they finish' : `Reply to ${esc(lead)}…`}" ${m.running ? 'disabled' : ''}></textarea>
        <button class="btn primary" ${m.running ? 'disabled' : ''}>Send</button>
      </form>`;
    renderFeedInto($('#consoleFeed'), S.feeds.get(m.id) || [], 'Waiting for the first update…');
  }

  const missionStatusText = (m) => ({ running: 'Working', done: 'Done', failed: 'Failed', cancelled: 'Cancelled', idle: 'Idle' }[m.status] || m.status);

  function renderFeedInto(container, items, emptyText) {
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    const shown = items.slice(-160);
    container.innerHTML = shown.length ? `<div class="feed">${shown.map(feedItemHtml).join('')}</div>` : `<p class="feed-empty">${esc(emptyText)}</p>`;
    if (nearBottom || container.dataset.first !== '1') { container.scrollTop = container.scrollHeight; container.dataset.first = '1'; }
  }

  function feedItemHtml(it) {
    const a = it.agentId ? S.agents.get(it.agentId) : null;
    if (it.kind === 'tool' || it.kind === 'file') {
      return `<div class="feed-line" title="${esc(it.text)}"><b>${esc(a ? a.profile.name : '')}</b>${esc(it.text)}</div>`;
    }
    const who = it.kind === 'owner' ? '<div class="who">You</div>' : a ? `<div class="who">${avatar(a.profile.look, 'head')}</div>` : '<div class="who"></div>';
    const name = it.kind === 'owner' ? 'You' : a ? a.profile.name : it.agentId ? 'Former colleague' : 'Office';
    return `<div class="feed-item ${esc(it.kind)}">${who}<div><div class="meta"><b>${esc(name)}</b> · ${timeOf(it.ts)}</div><div class="text">${esc(it.text)}${it.open ? ' ▍' : ''}</div></div></div>`;
  }

  let feedsScheduled = false;
  function scheduleFeeds() {
    if (feedsScheduled) return;
    feedsScheduled = true;
    raf(() => {
      feedsScheduled = false;
      if (S.focus && !S.consoleCollapsed) renderFeedInto($('#consoleFeed'), S.feeds.get(S.focus) || [], 'Waiting for the first update…');
      if (S.drawer === 'agent' && S.selected) {
        if (S.tab === 'activity') renderFeedInto($('#drawerFeed'), S.agentFeeds.get(S.selected) || [], 'Nothing yet. Activity shows up here as they work.');
        if (S.tab === 'chat') renderFeedInto($('#drawerFeed'), S.feeds.get(S.chatMission.get(S.selected)) || [], 'Say hello — they’ll answer here.');
      }
    });
  }

  // ================================================================ drawer
  function openAgent(id, tab) {
    S.selected = id; S.drawer = 'agent'; S.tab = tab || (S.tab === 'missions' ? 'activity' : S.tab || 'activity');
    for (const pid of people.keys()) updatePerson(pid);
    renderDrawer();
  }
  function openMissions() { S.drawer = 'missions'; const prev = S.selected; S.selected = null; if (prev) updatePerson(prev); renderDrawer(); }
  function closeDrawer() {
    const prev = S.selected;
    S.drawer = null; S.selected = null;
    if (prev) updatePerson(prev);
    $('#drawer').classList.remove('open');
    setTimeout(fitStage, 260);
  }

  function renderDrawer() {
    const host = $('#drawer');
    host.classList.toggle('open', !!S.drawer);
    setTimeout(fitStage, 260);
    if (S.drawer === 'missions') {
      const list = [...S.missions.values()].filter((m) => m.mode !== 'chat').sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
      host.innerHTML = `<div class="drawer-inner">
        <div class="drawer-head"><div><h3>Missions</h3><p>${list.length ? `${list.filter((m) => m.running).length} running` : 'None yet'}</p></div>
          <button class="btn ghost close" data-action="close-drawer" aria-label="Close">✕</button></div>
        <div class="drawer-body"><div class="mission-list">${list.map((m) => `
          <button class="mission-row" data-mission="${m.id}" aria-current="${m.id === S.focus}">
            <b>${esc(m.title)}</b><span class="status-pill ${esc(m.status)}">${esc(missionStatusText(m))}</span>
            <small>${esc(modeLabel(m))} · ${timeOf(m.updatedAt)}</small></button>`).join('') || '<p class="feed-empty">Start a mission to put the team to work.</p>'}
        </div></div>
        <div class="drawer-foot"><button class="btn primary" data-action="new-mission">New mission</button></div></div>`;
      return;
    }
    if (S.drawer !== 'agent' || !S.agents.has(S.selected)) { host.innerHTML = ''; return; }

    const a = S.agents.get(S.selected);
    const p = a.profile;
    const eff = a.effective ? `${a.effective.provider} · ${a.effective.model}` : (p.provider ? `${p.provider} · ${p.model || 'default'}` : 'Office default model');
    host.innerHTML = `<div class="drawer-inner">
      <div class="drawer-head">
        <div class="portrait">${avatar(p.look, 'bust')}</div>
        <div><h3>${esc(p.name)}</h3><p>${esc(p.title || 'Colleague')}</p><p id="drawerStatus">${esc(statusText(a.presence))}</p></div>
        <button class="btn ghost close" data-action="close-drawer" aria-label="Close">✕</button>
      </div>
      <div class="tabs" role="tablist">
        ${[['activity', 'Activity'], ['chat', 'Chat'], ['profile', 'Profile']].map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}</button>`).join('')}
      </div>
      <div class="drawer-body" id="drawerBody"></div>
      ${S.tab === 'chat' ? `<form class="composer" data-form="chat"><label class="sr-only" for="chatMsg">Message ${esc(p.name)}</label>
        <textarea id="chatMsg" rows="1" placeholder="Message ${esc(p.name)}…"></textarea><button class="btn primary">Send</button></form>` : ''}
    </div>`;

    const body = $('#drawerBody');
    if (S.tab === 'activity') {
      body.innerHTML = `<p class="feed-empty" style="margin-top:0">${esc(eff)}</p><div id="drawerFeed"></div>`;
      renderFeedInto($('#drawerFeed'), S.agentFeeds.get(p.id) || [], 'Nothing yet. Activity shows up here as they work.');
    } else if (S.tab === 'chat') {
      body.innerHTML = '<div id="drawerFeed"></div>';
      const mid = S.chatMission.get(p.id);
      if (mid && !S.loadedMissions.has(mid)) loadMissionFeed(mid).then(scheduleFeeds);
      renderFeedInto($('#drawerFeed'), S.feeds.get(mid) || [], 'Say hello — they’ll answer here.');
    } else {
      body.innerHTML = profileFormHtml(p, 'edit');
      wireProfileForm(body, structuredClone(p), 'edit');
    }
  }

  async function loadMissionFeed(id) {
    S.loadedMissions.add(id);
    const res = await backend.get(`api/missions/${id}`);
    S.missions.set(id, { ...res.mission, running: res.running });
    S.feeds.set(id, []);
    for (const e of res.events) applyToFeeds(e, true);
  }

  // ================================================================ profile form (hire + edit)
  function profileFormHtml(p, mode) {
    const providers = S.providers.length ? S.providers : [{ id: 'simulated', label: 'Simulated', configured: true, models: ['simulated'] }];
    const toggle = (key, label, hint) => `<label class="toggle"><input type="checkbox" data-can="${key}" ${p.can?.[key] ? 'checked' : ''}><span><b>${label}</b><small>${hint}</small></span></label>`;
    return `<div class="form" data-profile-form>
      ${mode === 'hire' ? '' : ''}
      <div class="lookout">
        <div class="avatar-preview" data-preview>${avatar(p.look)}</div>
        <div class="form">
          <div class="field"><span>Skin</span><div class="swatches">${SKINS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-look="skin" data-value="${c}" aria-label="Skin ${c}" aria-pressed="${p.look.skin === c}"></button>`).join('')}</div></div>
          <div class="field"><span>Hair</span><div class="swatches">${HAIRS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-look="hair" data-value="${c}" aria-label="Hair ${c}" aria-pressed="${p.look.hair === c}"></button>`).join('')}</div>
            <div class="seg">${HAIR_STYLES.map(([v, l]) => `<button type="button" data-look="hairStyle" data-value="${v}" aria-pressed="${p.look.hairStyle === v}">${l}</button>`).join('')}</div></div>
          <div class="field"><span>Shirt</span><div class="swatches">${SHIRTS.map((c) => `<button type="button" class="swatch" style="background:${c}" data-look="shirt" data-value="${c}" aria-label="Shirt ${c}" aria-pressed="${p.look.shirt === c}"></button>`).join('')}</div></div>
          <div class="field"><span>Extra</span><div class="seg">${ACCESSORIES.map(([v, l]) => `<button type="button" data-look="accessory" data-value="${v}" aria-pressed="${p.look.accessory === v}">${l}</button>`).join('')}</div></div>
          <div><button type="button" class="btn" data-action="random-look">Surprise me</button></div>
        </div>
      </div>
      <div class="two">
        <label class="field"><span>Name</span><div class="input-row"><input data-field="name" maxlength="40" value="${esc(p.name)}" required>
          ${mode === 'hire' ? '<button type="button" class="btn" data-action="random-name" aria-label="Suggest a name">↻</button>' : ''}</div></label>
        <label class="field"><span>Role</span><input data-field="title" maxlength="80" value="${esc(p.title)}" placeholder="e.g. Backend Engineer"></label>
      </div>
      <label class="field"><span>Instructions</span><textarea data-field="persona" maxlength="12000" placeholder="What they're expert in, how they work, what they should never do.">${esc(p.persona)}</textarea>
        <small>This is the whole job description. Change it any time; it applies from their next turn.</small></label>
      <div class="two">
        <label class="field"><span>Model provider</span><select data-field="provider">
          <option value="">Office default (${esc(S.defaultProvider)})</option>
          ${providers.map((x) => `<option value="${esc(x.id)}" ${p.provider === x.id ? 'selected' : ''} ${x.configured ? '' : 'disabled'}>${esc(x.label)}${x.configured ? '' : ' — not configured'}</option>`).join('')}
        </select></label>
        <label class="field"><span>Model</span><input data-field="model" list="modelList" value="${esc(p.model)}" placeholder="Provider default">
          <datalist id="modelList">${providers.flatMap((x) => x.models || []).map((m) => `<option value="${esc(m)}">`).join('')}</datalist></label>
      </div>
      <div class="field"><span>Can</span><div class="toggles">
        ${toggle('files', 'Read & write files', 'Inside the mission folder only')}
        ${toggle('delegate', 'Ask colleagues', 'Walk over and hand off work')}
        ${toggle('web', 'Browse the web', 'Public sites only')}
        ${toggle('shell', 'Run commands', 'Builds, tests, git — in the mission folder')}
      </div></div>
      ${mode === 'edit' ? `<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:4px">
        <button type="button" class="btn danger" data-action="fire">Let ${esc(p.name)} go</button>
        <span class="dlg-error" data-error></span>
        <button type="button" class="btn primary" data-action="save-profile">Save changes</button></div>` : ''}
    </div>`;
  }

  /** Two-way binds a profile form to a draft object. */
  function wireProfileForm(root, draft, mode) {
    const preview = () => { const pv = root.querySelector('[data-preview]'); if (pv) pv.innerHTML = avatar(draft.look); };
    root.addEventListener('input', (ev) => {
      const f = ev.target.dataset.field;
      if (f) draft[f] = ev.target.value;
      const c = ev.target.dataset.can;
      if (c) draft.can[c] = ev.target.checked;
      if (f === 'name' && mode === 'hire') updateHireButton(draft);
    });
    root.addEventListener('change', (ev) => {
      const f = ev.target.dataset.field;
      if (f) draft[f] = ev.target.value;
    });
    root.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      if (btn.dataset.look) {
        draft.look[btn.dataset.look] = btn.dataset.value;
        root.querySelectorAll(`[data-look="${btn.dataset.look}"]`).forEach((b) => b.setAttribute('aria-pressed', b === btn));
        preview();
      } else if (btn.dataset.action === 'random-look') {
        draft.look = randomLook();
        root.querySelectorAll('[data-look]').forEach((b) => b.setAttribute('aria-pressed', draft.look[b.dataset.look] === b.dataset.value));
        preview();
      } else if (btn.dataset.action === 'random-name') {
        draft.name = freshName();
        root.querySelector('[data-field="name"]').value = draft.name;
        updateHireButton(draft);
      } else if (btn.dataset.action === 'save-profile') {
        try { await backend.put(`api/agents/${draft.id}`, draft); toast('Saved.'); }
        catch (err) { root.querySelector('[data-error]').textContent = err.message; }
      } else if (btn.dataset.action === 'fire') {
        // Two-step instead of confirm(): first click arms the button, second click lets them go.
        if (btn.dataset.armed !== '1') {
          btn.dataset.armed = '1';
          btn.textContent = `Yes, let ${draft.name} go`;
          setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = `Let ${draft.name} go`; } }, 4000);
          return;
        }
        try { await backend.del(`api/agents/${draft.id}`); toast(`${draft.name} has left the office.`); }
        catch (err) { root.querySelector('[data-error]').textContent = err.message; }
      }
    });
  }

  function freshName() {
    const taken = new Set([...S.agents.values()].map((a) => a.profile.name.toLowerCase()));
    const free = NAMES.filter((n) => !taken.has(n.toLowerCase()));
    return free.length ? pick(free) : pick(NAMES) + ' ' + (S.agents.size + 1);
  }

  // ================================================================ hire dialog
  let hireDraft = null;
  function openHire() {
    const dlg = $('#dlgHire');
    hireDraft = { name: freshName(), title: '', persona: '', provider: '', model: '', look: randomLook(), can: { files: true, shell: false, web: false, delegate: true } };
    dlg.innerHTML = `<form class="dlg" method="dialog" data-form="hire">
      <div class="dlg-head"><h2 id="hireTitle">Hire a colleague</h2><button type="button" class="btn ghost close" data-action="close-dialog" aria-label="Close">✕</button></div>
      <div class="dlg-body"><div class="hire-grid">
        <div><div class="field" style="margin-bottom:6px"><span>Start from a role</span><small>Optional — fills in the form, which you can then change.</small></div>
          <div class="templates">
            <button type="button" class="template" data-template="-1" aria-pressed="true"><b>Blank</b><span>Write the role yourself.</span></button>
            ${S.roles.map((r, i) => `<button type="button" class="template" data-template="${i}" aria-pressed="false"><b>${esc(r.title)}</b><span>${esc(r.summary)}</span></button>`).join('')}
          </div></div>
        <div id="hireForm">${profileFormHtml(hireDraft, 'hire')}</div>
      </div></div>
      <div class="dlg-foot"><span class="dlg-error" data-error></span>
        <button type="button" class="btn" data-action="close-dialog">Cancel</button>
        <button class="btn primary" id="hireSubmit">Hire ${esc(hireDraft.name)}</button></div>
    </form>`;
    wireProfileForm($('#hireForm', dlg), hireDraft, 'hire');
    dlg.querySelector('.templates').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-template]');
      if (!b) return;
      dlg.querySelectorAll('[data-template]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      const r = S.roles[+b.dataset.template];
      hireDraft.title = r?.title || '';
      hireDraft.persona = r?.persona || '';
      if (r?.can) hireDraft.can = { ...hireDraft.can, ...r.can };
      if (r?.look) hireDraft.look = { ...hireDraft.look, ...r.look };
      const form = $('#hireForm', dlg);
      form.innerHTML = profileFormHtml(hireDraft, 'hire');
    });
    dlg.showModal();
    dlg.querySelector('[data-field="name"]').focus();
  }

  function updateHireButton(draft) {
    const b = $('#hireSubmit');
    if (b) b.textContent = draft.name.trim() ? `Hire ${draft.name.trim()}` : 'Hire';
  }

  async function submitHire(form) {
    const err = form.querySelector('.dlg-foot [data-error]');
    err.textContent = '';
    if (!hireDraft.name.trim()) { err.textContent = 'Give them a name.'; return; }
    try {
      const hired = await backend.post('api/agents', hireDraft);
      $('#dlgHire').close();
      toast(`${hired.name} joined the office.`);
    } catch (e) { err.textContent = e.message; }
  }

  async function hireStarterTeam() {
    const want = ['Project Manager', 'Software Engineer', 'QA Engineer', 'Product Designer'];
    for (const title of want) {
      const r = S.roles.find((x) => x.title === title);
      if (!r) continue;
      const look = { ...randomLook(), ...(r.look || {}) };
      try { await backend.post('api/agents', { name: freshName(), title: r.title, persona: r.persona, provider: '', model: '', look, can: r.can }); }
      catch (e) { toast(e.message); break; }
      await new Promise((res) => setTimeout(res, 450));
    }
  }

  // ================================================================ mission dialog
  let missionDraft = null;
  function openNewMission() {
    if (!S.agents.size) { toast('Hire someone first — missions need a team.'); return; }
    const agents = [...S.agents.values()].map((a) => a.profile).sort((a, b) => a.desk - b.desk);
    missionDraft = { title: '', goal: '', mode: 'delegate', leadId: agents[0].id, participants: agents.slice(0, Math.min(3, agents.length)).map((a) => a.id), workspace: '', meetingRounds: 2 };
    const dlg = $('#dlgMission');
    const draw = () => {
      dlg.innerHTML = `<form class="dlg" method="dialog" data-form="mission">
        <div class="dlg-head"><h2 id="missionTitle">New mission</h2><button type="button" class="btn ghost close" data-action="close-dialog" aria-label="Close">✕</button></div>
        <div class="dlg-body"><div class="form">
          <label class="field"><span>What needs doing?</span><textarea data-m="goal" required placeholder="e.g. Add password reset to the customer portal. Email link, 30-minute expiry, tests included.">${esc(missionDraft.goal)}</textarea></label>
          <label class="field"><span>Short title</span><input data-m="title" maxlength="80" value="${esc(missionDraft.title)}" placeholder="Optional — taken from the goal if empty"></label>
          <div class="field"><span>How should they work?</span><div class="seg">
            <button type="button" data-mode="delegate" aria-pressed="${missionDraft.mode === 'delegate'}">One person leads, pulls others in</button>
            <button type="button" data-mode="meeting" aria-pressed="${missionDraft.mode === 'meeting'}">Meeting — everyone discusses</button></div></div>
          ${missionDraft.mode === 'delegate'
            ? `<div class="field"><span>Lead</span><div class="people-pick">${agents.map((a) => chip(a, missionDraft.leadId === a.id, 'lead')).join('')}</div></div>`
            : `<div class="field"><span>Who's in the meeting</span><div class="people-pick">${agents.map((a) => chip(a, missionDraft.participants.includes(a.id), 'part')).join('')}</div></div>
               <label class="field"><span>Rounds</span><input type="number" min="1" max="5" data-m="meetingRounds" value="${missionDraft.meetingRounds}"><small>Each round, everyone speaks once.</small></label>`}
          <label class="field"><span>Work folder</span><input data-m="workspace" value="${esc(missionDraft.workspace)}" placeholder="Leave empty for a fresh folder, or point at a repo">
            <small>Must be inside a folder allowed in the server settings (Office:WorkspaceRoots).</small></label>
        </div></div>
        <div class="dlg-foot"><span class="dlg-error" data-error></span><button type="button" class="btn" data-action="close-dialog">Cancel</button><button class="btn primary">Start mission</button></div>
      </form>`;
    };
    const chip = (a, on, kind) => `<button type="button" class="person-chip" data-${kind}="${a.id}" aria-pressed="${on}"><span class="mini">${avatar(a.look, 'head')}</span>${esc(a.name)}</button>`;
    draw();
    dlg.oninput = (ev) => { const k = ev.target.dataset.m; if (k) missionDraft[k] = k === 'meetingRounds' ? +ev.target.value : ev.target.value; };
    dlg.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.mode) { missionDraft.mode = b.dataset.mode; draw(); }
      else if (b.dataset.lead) { missionDraft.leadId = b.dataset.lead; draw(); }
      else if (b.dataset.part) {
        const id = b.dataset.part, list = missionDraft.participants;
        missionDraft.participants = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
        draw();
      }
    };
    dlg.showModal();
    dlg.querySelector('[data-m="goal"]').focus();
  }

  async function submitMission(form) {
    const err = form.querySelector('[data-error]');
    err.textContent = '';
    if (!missionDraft.goal.trim()) { err.textContent = 'Describe what needs doing.'; return; }
    const body = {
      title: missionDraft.title, goal: missionDraft.goal, mode: missionDraft.mode,
      leadId: missionDraft.mode === 'delegate' ? missionDraft.leadId : null,
      participants: missionDraft.mode === 'meeting' ? missionDraft.participants : [missionDraft.leadId],
      workspace: missionDraft.workspace || null, meetingRounds: missionDraft.meetingRounds,
    };
    try {
      const m = await backend.post('api/missions', body);
      $('#dlgMission').close();
      S.missions.set(m.id, { ...m, running: true });
      S.loadedMissions.add(m.id);
      if (!S.feeds.has(m.id)) S.feeds.set(m.id, []);
      await focusMission(m.id);
    } catch (e) { err.textContent = e.message; }
  }

  // ================================================================ global wiring
  function updateHeadcount() {
    const n = S.agents.size;
    $('#headcount').textContent = n === 0 ? 'No one here yet' : n === 1 ? '1 colleague' : `${n} colleagues`;
  }
  function updateRunningCount() {
    const n = [...S.missions.values()].filter((m) => m.running && m.mode !== 'chat').length;
    const el = $('#runningCount');
    el.hidden = n === 0; el.textContent = n;
  }

  function renderAll() {
    $('#officeName').textContent = S.name;
    document.title = S.name;
    renderStage();
    for (const id of S.agents.keys()) placePerson(id, true);
    for (const id of S.agents.keys()) updatePerson(id);
    updateHeadcount(); updateRunningCount();
    renderConsole(); renderDrawer();
  }

  function wire() {
    $('#btnHire').onclick = openHire;
    $('#btnNewMission').onclick = openNewMission;
    $('#btnMissions').onclick = () => (S.drawer === 'missions' ? closeDrawer() : openMissions());
    $('#officeName').onclick = () => {
      // Inline rename: swap the title for an input; Enter or blur saves, Escape cancels.
      const btn = $('#officeName');
      const input = document.createElement('input');
      input.id = 'officeNameInput';
      input.className = 'office-name';
      input.value = S.name;
      input.maxLength = 60;
      input.setAttribute('aria-label', 'Office name');
      btn.hidden = true;
      btn.after(input);
      input.focus(); input.select();
      let done = false;
      const finish = async (save) => {
        if (done) return; done = true;
        const name = input.value.trim();
        input.remove(); btn.hidden = false;
        if (save && name && name !== S.name) {
          try { await backend.put('api/office/name', { name }); } catch (e) { toast(e.message); }
        }
      };
      input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
      input.addEventListener('blur', () => finish(true));
    };

    document.addEventListener('click', async (ev) => {
      const t = ev.target;
      const action = t.closest('[data-action]')?.dataset.action;
      if (action === 'hire') return openHire();
      if (action === 'starter') return hireStarterTeam();
      if (action === 'new-mission') return openNewMission();
      if (action === 'close-drawer') return closeDrawer();
      if (action === 'close-dialog') return t.closest('dialog').close();
      if (action === 'toggle-console') { S.consoleCollapsed = !S.consoleCollapsed; renderConsole(); return; }
      if (action === 'cancel' && S.focus) { try { await backend.post(`api/missions/${S.focus}/cancel`); } catch (e) { toast(e.message); } return; }

      const tab = t.closest('[data-tab]');
      if (tab) { S.tab = tab.dataset.tab; if (S.tab === 'chat') await ensureChat(S.selected); renderDrawer(); return; }

      const missionRow = t.closest('[data-mission]');
      if (missionRow) { await focusMission(missionRow.dataset.mission); return; }

      if (t.closest('#whiteboard')) { openMissions(); return; }

      const agentEl = t.closest('.person, .nameplate, .desk[data-agent]');
      if (agentEl && agentEl.closest('#stage')) { openAgent(agentEl.dataset.agent); }
    });

    document.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('.person, #whiteboard')) { ev.preventDefault(); ev.target.click(); }
      if (ev.key === 'Escape' && S.drawer && !document.querySelector('dialog[open]')) closeDrawer();
      if (ev.key === 'Enter' && !ev.shiftKey && ev.target.matches('.composer textarea')) { ev.preventDefault(); ev.target.form.requestSubmit(); }
    });

    document.addEventListener('submit', async (ev) => {
      const form = ev.target;
      const kind = form.dataset.form;
      if (!kind) return;
      ev.preventDefault();
      if (kind === 'hire') return submitHire(form);
      if (kind === 'mission') return submitMission(form);
      const ta = form.querySelector('textarea');
      const text = ta.value.trim();
      if (!text) return;
      try {
        if (kind === 'mission-message') { await backend.post(`api/missions/${S.focus}/messages`, { text }); ta.value = ''; }
        if (kind === 'chat') {
          const mid = S.chatMission.get(S.selected);
          if (mid) await backend.post(`api/missions/${mid}/messages`, { text });
          else { const m = await backend.post(`api/agents/${S.selected}/chat`, { text }); S.chatMission.set(S.selected, m.id); S.loadedMissions.add(m.id); }
          ta.value = '';
          ta.focus();
        }
      } catch (e) { toast(e.message); }
    });

    new ResizeObserver(fitStage).observe($('#floorWrap'));
  }

  async function ensureChat(agentId) {
    if (S.chatMission.has(agentId)) return;
    try {
      const m = await backend.post(`api/agents/${agentId}/chat`, { text: '' });
      S.chatMission.set(agentId, m.id);
      S.missions.set(m.id, { ...m, running: false });
      S.loadedMissions.add(m.id);
      if (!S.feeds.has(m.id)) S.feeds.set(m.id, []);
    } catch (e) { toast(e.message); }
  }

  wire();
  connect().catch((e) => { console.error(e); toast(`Couldn't load the office: ${e.message}`); });
})();
