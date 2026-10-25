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
  // Shared light: overlays filled with these gradients give every shape the same top-left light source.
  const LIGHT_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="lightBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <linearGradient id="lightLimb" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".14"/><stop offset=".32" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>
    <radialGradient id="lightHead" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".26"/></radialGradient>
    <linearGradient id="lightHair" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
    <linearGradient id="lightLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>
  </defs></svg>`;
  document.body.insertAdjacentHTML('afterbegin', LIGHT_DEFS);

  /** The same shapes again, filled with a light overlay instead of their colour. */
  const lit = (shapes, color, light) => shapes.replaceAll(`fill="${color}"`, `fill="url(#${light})"`);

  /** crop: 'full' (walking body), 'bust' (portrait), 'head' (tiny chips); face: 'front' or 'back' (seen from behind). */
  function avatar(look = {}, crop = 'full', face = 'front') {
    const L = { skin: '#C68B59', hair: '#2B2118', hairStyle: 'short', shirt: '#3E7CB1', accessory: 'none', ...look };
    const vb = crop === 'head' ? '12 6 40 40' : crop === 'bust' ? '4 2 56 98' : '0 0 64 112';
    const sleeve = shade(L.shirt, -0.08);
    const shoe = (cx) => `<ellipse cx="${cx}" cy="107" rx="6.5" ry="3" fill="#22262D"/><ellipse cx="${cx - 1.5}" cy="105.8" rx="3" ry="1" fill="#fff" opacity=".18"/>`;
    const legs = `<g class="legs">
        <g class="leg-l"><rect x="20" y="82" width="10" height="24" rx="4" fill="#3D4451"/><rect x="20" y="82" width="10" height="24" rx="4" fill="url(#lightLimb)"/>${shoe(25)}</g>
        <g class="leg-r"><rect x="34" y="82" width="10" height="24" rx="4" fill="#3D4451"/><rect x="34" y="82" width="10" height="24" rx="4" fill="url(#lightLimb)"/>${shoe(39)}</g>
      </g>`;
    const arm = (x, cx) => `<rect x="${x}" y="51" width="9.5" height="27" rx="4.75" fill="${sleeve}"/><rect x="${x}" y="51" width="9.5" height="27" rx="4.75" fill="url(#lightLimb)"/>
      <circle cx="${cx}" cy="78" r="4.2" fill="${L.skin}"/><circle cx="${cx}" cy="78" r="4.2" fill="url(#lightHead)"/>`;
    const arms = `<g class="arm-l">${arm(6.5, 11.25)}</g><g class="arm-r">${arm(48, 52.75)}</g>`;
    const torso = (fill) => `<path d="M11 86 V62 Q11 45.5 32 45.5 Q53 45.5 53 62 V86 Z" fill="${fill}"/><path d="M11 86 V62 Q11 45.5 32 45.5 Q53 45.5 53 62 V86 Z" fill="url(#lightBody)"/>`;
    const ears = `<circle cx="16.8" cy="28" r="3" fill="${shade(L.skin, -0.05)}"/><circle cx="47.2" cy="28" r="3" fill="${shade(L.skin, -0.05)}"/>`;
    const head = `<circle cx="32" cy="26" r="15" fill="${L.skin}"/><circle cx="32" cy="26" r="15" fill="url(#lightHead)"/>`;

    if (face === 'back') {
      const curls = [[20, 16], [26, 11], [32, 10], [38, 11], [44, 16], [18, 24], [25, 20], [32, 19], [39, 20], [46, 24], [20, 31], [27, 29], [32, 31], [37, 29], [44, 31], [32, 37]];
      const cover = {
        short: `<path d="M16.6 27 Q16 9 32 9 Q48 9 47.4 27 Q46.5 37.5 32 39.5 Q17.5 37.5 16.6 27 Z" fill="${L.hair}"/>`,
        long: `<path d="M15.5 26 Q15.5 8.5 32 8.5 Q48.5 8.5 48.5 26 L49.5 51 Q41 54 32 54 Q23 54 14.5 51 Z" fill="${L.hair}"/>`,
        bun: `<path d="M16.6 27 Q16 9.5 32 9.5 Q48 9.5 47.4 27 Q46 36.5 32 38.5 Q18 36.5 16.6 27 Z" fill="${L.hair}"/><circle cx="32" cy="13" r="7" fill="${shade(L.hair, -0.08)}"/>`,
        curly: curls.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${L.hair}"/>`).join(''),
        bald: '',
      }[L.hairStyle] || '';
      const acc = {
        headphones: `<path d="M15 27 Q15 6 32 6 Q49 6 49 27" fill="none" stroke="#1D2836" stroke-width="3"/><rect x="11.5" y="23" width="7" height="11" rx="3" fill="#1D2836"/><rect x="45.5" y="23" width="7" height="11" rx="3" fill="#1D2836"/>`,
        cap: `<path d="M16 23 Q16 7 32 7 Q48 7 48 23 Z" fill="${shade(L.shirt, -0.15)}"/><path d="M16 23 Q16 7 32 7 Q48 7 48 23 Z" fill="url(#lightHair)"/><rect x="26" y="20" width="12" height="4" rx="1.5" fill="${shade(L.shirt, -0.32)}"/>`,
      }[L.accessory] || '';
      return `<svg class="av" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${legs}
        <rect x="27" y="36" width="10" height="12" rx="3" fill="${shade(L.skin, -0.1)}"/>
        ${torso(shade(L.shirt, -0.05))}
        <path d="M25 47.5 Q32 50.5 39 47.5" fill="none" stroke="${shade(L.shirt, -0.22)}" stroke-width="1.6"/>
        <path d="M32 50 V84" stroke="${shade(L.shirt, -0.2)}" stroke-width=".8" opacity=".5"/>
        ${arms}${ears}${head}
        ${cover}${lit(cover, L.hair, 'lightHair')}${acc}
      </svg>`;
    }

    const hairBack = {
      long: `<path d="M15 24 Q15 8 32 8 Q49 8 49 24 L50 50 Q41 53 32 53 Q23 53 14 50 Z" fill="${L.hair}"/>`,
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
      glasses: `<g fill="none" stroke="#1D2836" stroke-width="1.5"><circle cx="26.5" cy="27" r="4.4"/><circle cx="37.5" cy="27" r="4.4"/><path d="M30.9 27 h2.2 M22.1 26.5 l-4.6 -1 M41.9 26.5 l4.6 -1"/></g>
        <path d="M24 24.5 l3 -1.5 M35 24.5 l3 -1.5" stroke="#fff" stroke-width="1" opacity=".55" stroke-linecap="round"/>`,
      headphones: `<path d="M15 27 Q15 6 32 6 Q49 6 49 27" fill="none" stroke="#1D2836" stroke-width="3"/><rect x="11.5" y="23" width="7" height="11" rx="3" fill="#1D2836"/><rect x="45.5" y="23" width="7" height="11" rx="3" fill="#1D2836"/>
        <rect x="12.5" y="24" width="2" height="6" rx="1" fill="#fff" opacity=".18"/>`,
      cap: `<path d="M16 22 Q16 7 32 7 Q48 7 48 22 Z" fill="${shade(L.shirt, -0.15)}"/><path d="M16 22 Q16 7 32 7 Q48 7 48 22 Z" fill="url(#lightHair)"/><path d="M30 21 h22 q2 0 2 2 v0 q0 2 -2 2 h-22 z" fill="${shade(L.shirt, -0.25)}"/>`,
    }[L.accessory] || '';
    const brow = shade(L.hair === '#E8E4DA' ? '#9AA0A6' : L.hair, -0.1);
    return `<svg class="av" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${legs}
      ${hairBack}${lit(hairBack, L.hair, 'lightHair')}
      <rect x="27" y="37" width="10" height="11" rx="3" fill="${shade(L.skin, -0.06)}"/>
      ${torso(L.shirt)}
      <path d="M26 46 L32 53 L38 46" fill="none" stroke="${shade(L.shirt, -0.18)}" stroke-width="1.6"/>
      <ellipse cx="32" cy="46.5" rx="6.5" ry="2.2" fill="#000" opacity=".14"/>
      ${arms}${ears}${head}
      <circle cx="22.5" cy="31.5" r="2.6" fill="#E88B7A" opacity=".28"/><circle cx="41.5" cy="31.5" r="2.6" fill="#E88B7A" opacity=".28"/>
      <path d="M23.6 23.2 Q26.5 21.8 29.2 23 M34.8 23 Q37.5 21.8 40.4 23.2" fill="none" stroke="${brow}" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>
      <g class="eyes"><ellipse cx="26.5" cy="27" rx="1.7" ry="2" fill="#1D2836"/><ellipse cx="37.5" cy="27" rx="1.7" ry="2" fill="#1D2836"/>
        <circle cx="27.1" cy="26.3" r=".55" fill="#fff"/><circle cx="38.1" cy="26.3" r=".55" fill="#fff"/></g>
      <path d="M32.3 28.6 Q31 31.4 32.9 31.8" fill="none" stroke="${shade(L.skin, -0.28)}" stroke-width="1" stroke-linecap="round" opacity=".7"/>
      <path d="M28.8 34 Q32 36.2 35.2 34" fill="none" stroke="${shade(L.skin, -0.45)}" stroke-width="1.4" stroke-linecap="round"/>
      ${hairFront}${lit(hairFront, L.hair, 'lightHair')}${acc}
    </svg>`;
  }

  // Things people hold during breaks.
  const PROPS = {
    mug: ['hand', `<svg viewBox="0 0 20 26"><path class="steam-w" d="M7 7 q-2.5 -3 0 -6 M12 7 q-2.5 -3 0 -6" fill="none" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity=".7"/><rect x="3" y="9" width="11" height="14" rx="2" fill="#F4F1EA" stroke="#8C8579" stroke-width=".8"/><path d="M14 12 h2 a3 3 0 0 1 0 6 h-2" fill="none" stroke="#F4F1EA" stroke-width="2"/></svg>`],
    paddle: ['paddle', `<svg viewBox="0 0 22 32"><rect x="9" y="18" width="4" height="13" rx="2" fill="#7A5230"/><circle cx="11" cy="11" r="10" fill="#D23A2E" stroke="#8E2018" stroke-width="1"/></svg>`],
    dart: ['dart', `<svg viewBox="0 0 24 8"><path d="M24 4 L18 3 L18 5 Z" fill="#9AA1A8"/><rect x="8" y="3" width="10" height="2" fill="#2B2B2B"/><path d="M8 4 L1 0 L3 4 L1 8 Z" fill="#E0B020"/></svg>`],
    can: ['can', `<svg viewBox="0 0 34 30"><path d="M4 10 h16 v14 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 z" fill="#4C8656"/><path d="M8 10 q4 -9 8 0" fill="none" stroke="#3B6C44" stroke-width="2"/><path d="M20 14 L30 8 L31 10 L21 18 Z" fill="#4C8656"/><g class="drops" fill="#7FC4E8"><circle cx="32" cy="14" r="1.2"/><circle cx="31" cy="19" r="1.2"/><circle cx="33" cy="23" r="1.2"/></g></svg>`],
    book: ['chest', `<svg viewBox="0 0 32 18"><path d="M16 3 Q8 0 1 2 V17 Q8 15 16 17 Z" fill="#F7F3EA" stroke="#8B6A47"/><path d="M16 3 Q24 0 31 2 V17 Q24 15 16 17 Z" fill="#EFE8D8" stroke="#8B6A47"/><path d="M5 6 h7 M5 9 h7 M20 6 h7 M20 9 h7" stroke="#B9AF9C" stroke-width=".8"/></svg>`],
    laptop: ['lap', `<svg viewBox="0 0 38 26"><rect x="4" y="0" width="30" height="19" rx="2" fill="#3A3F46"/><rect x="6" y="2" width="26" height="15" fill="#9FD3C0"/><rect x="0" y="19" width="38" height="6" rx="2" fill="#5A6068"/></svg>`],
  };

  function plantSvg(kind) {
    if (kind === 'monstera') {
      const leaves = [[-34, 30, -40], [32, 26, 35], [-14, 6, -10], [16, 2, 14], [0, 34, 0], [-28, 52, -60], [30, 54, 60]];
      const leaf = 'M0 0 C-18 -8 -20 -34 0 -44 C20 -34 18 -8 0 0 Z';
      return `<svg viewBox="-60 -10 120 130"><ellipse cx="0" cy="118" rx="34" ry="5" fill="#000" opacity=".22"/>${leaves.map(([x, y]) => `<path d="M0 84 Q${x * 0.4} ${(y + 84) / 2} ${x} ${y}" stroke="#3B6C44" stroke-width="2.4" fill="none"/>`).join('')}${leaves.map(([x, y, r], i) => `<g transform="translate(${x} ${y}) rotate(${r})"><path d="${leaf}" fill="${i % 2 ? '#3F7D4B' : '#468955'}"/><path d="${leaf}" fill="url(#lightLeaf)"/><path d="M0 -2 V-40 M0 -14 L-10 -22 M0 -26 L9 -32 M0 -18 L10 -12" stroke="#2C5C36" stroke-width="1.6" fill="none"/></g>`).join('')}
        <path d="M-26 86 h52 l-6 32 h-40 z" fill="#C9C4BB"/><path d="M-26 86 h52 l-6 32 h-40 z" fill="url(#lightLimb)"/><rect x="-28" y="80" width="56" height="10" rx="3" fill="#B7B1A6"/><rect x="-28" y="80" width="56" height="3" rx="1.5" fill="#fff" opacity=".25"/></svg>`;
    }
    // fiddle-leaf fig
    const leaves = [[0, -6], [-14, 10], [14, 14], [-10, 30], [12, 36], [-16, 52], [10, 58], [0, 22]];
    return `<svg viewBox="-40 -20 80 160"><ellipse cx="0" cy="139" rx="22" ry="4" fill="#000" opacity=".22"/><path d="M0 120 V10" stroke="#6B4A2E" stroke-width="3"/>${leaves.map(([x, y], i) => {
      const t = `transform="rotate(${i % 2 ? 30 : -30} ${x} ${y})"`;
      return `<ellipse cx="${x}" cy="${y}" rx="11" ry="15" ${t} fill="${i % 3 ? '#4E8A55' : '#3E7547'}"/><ellipse cx="${x}" cy="${y}" rx="11" ry="15" ${t} fill="url(#lightLeaf)"/><path d="M${x} ${y - 13} V${y + 13}" ${t} stroke="#2F5E37" stroke-width=".9" opacity=".7"/>`;
    }).join('')}
      <path d="M-20 110 h40 l-5 30 h-30 z" fill="#2F3337"/><path d="M-20 110 h40 l-5 30 h-30 z" fill="url(#lightLimb)"/></svg>`;
  }

  function skylineSvg(i) {
    const blds = i === 0
      ? [[0, 30, 22, 52], [22, 18, 18, 64], [40, 40, 26, 42], [66, 24, 20, 58], [86, 34, 26, 48]]
      : [[0, 36, 26, 46], [26, 14, 16, 68], [42, 28, 24, 54], [66, 44, 22, 38], [88, 22, 24, 60]];
    const lit = [];
    blds.forEach(([x, y, w, h], k) => { for (let yy = y + 6; yy < y + h - 4; yy += 9) for (let xx = x + 4; xx < x + w - 4; xx += 7) if ((xx * 7 + yy * 3 + k) % 5 < 2) lit.push(`<rect class="lit" x="${xx}" y="${yy}" width="3" height="4"/>`); });
    const tower = i === 1 ? `<g class="bld"><rect x="52" y="10" width="14" height="12" rx="2"/><path d="M50 10 L59 2 L68 10 Z"/><rect x="54" y="22" width="2" height="8"/><rect x="62" y="22" width="2" height="8"/></g>` : '';
    return `<svg viewBox="0 0 112 82" preserveAspectRatio="none" aria-hidden="true">${tower}${blds.map(([x, y, w, h]) => `<rect class="bld" x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}${lit.join('')}</svg>`;
  }

  // Code on a busy monitor: two identical screens stacked, so scrolling by half loops seamlessly.
  const CODE_SVG = (() => {
    const colors = ['#C792EA', '#82AAFF', '#C3E88D', '#E6E9EE', '#F78C6C', '#89DDFF', '#676E95'];
    const lines = [[0, 3, 10, 1, 8], [4, 2, 14, 3, 6], [4, 4, 9], [8, 5, 12, 2, 10], [8, 3, 7, 6, 13], [4, 1, 5], [0, 6, 18], [0, 0, 8, 1, 12], [4, 2, 16]];
    let y = 2, out = '';
    for (let pass = 0; pass < 2; pass++, y = 38) {
      for (const [indent, ...segs] of lines) {
        out += `<rect x="1" y="${y}" width="3" height="2.4" fill="#4B5263"/>`;
        let x = 7 + indent;
        for (let k = 0; k + 1 < segs.length || k === 0; k += 2) {
          const c = colors[segs[k] % colors.length], w = segs[k + 1] ?? 6;
          out += `<rect x="${x}" y="${y}" width="${w}" height="2.4" rx=".6" fill="${c}"/>`;
          x += w + 2;
        }
        y += 4;
      }
    }
    return `<svg class="code" viewBox="0 0 58 72" aria-hidden="true">${out}</svg>`;
  })();

  // ================================================================ loft geometry
  const W = 1240, WALL_H = 132;
  const COLS = 4, DESK_X0 = 60, DESK_Y0 = 320, DX = 200, DY = 168, DESK_W = 170;
  const MEET = { x: 880, y: 150, w: 342, h: 300 };
  const MEET_TABLE = { x: 950, y: 290, w: 200, h: 56 };
  const deskXY = (slot) => ({ x: DESK_X0 + (slot % COLS) * DX, y: DESK_Y0 + Math.floor(slot / COLS) * DY });
  const seatXY = (slot) => { const d = deskXY(slot); return { x: d.x + DESK_W / 2 - 32, y: d.y - 64, z: d.y + 40, desk: true }; };
  const visitorXY = (slot) => { const d = deskXY(slot); return { x: d.x + DESK_W - 26, y: d.y + 18, z: d.y + 130 }; };
  // Stand-up meeting around the long table: behind it (facing us), in front of it (backs to us), then the ends.
  const MEET_SEATS = [
    { x: 1018, y: 192 }, { x: 1028, y: 296, face: 'back' }, { x: 958, y: 192 }, { x: 968, y: 296, face: 'back' },
    { x: 1078, y: 192 }, { x: 1088, y: 296, face: 'back' }, { x: 892, y: 236 }, { x: 1150, y: 236, mirror: true },
  ];
  const meetingXY = (k) => { const s = MEET_SEATS[k % MEET_SEATS.length]; return { ...s, z: s.y + 112 }; };

  function layout() {
    const maxSlot = Math.max(-1, ...[...S.agents.values()].map((a) => a.profile.desk));
    const rows = Math.max(2, Math.ceil((maxSlot + 2) / COLS));
    const playTop = Math.max(DESK_Y0 + (rows - 1) * DY + 74 + 44, 606);
    return { rows, slots: rows * COLS, playTop, H: Math.max(1080, playTop + 384) };
  }
  const stageHeight = () => layout().H;
  const doorXY = () => ({ x: -66, y: stageHeight() - 176, z: 4500 });

  /** Where people can spend a break. y is the top of the figure; z defaults to the feet. */
  function spotsFor(L) {
    const p = L.playTop;
    return {
      window: [{ x: 626, y: 136, face: 'back' }, { x: 770, y: 136, face: 'back' }],
      machine: [{ x: 912, y: 434, face: 'back' }, { x: 972, y: 434, face: 'back' }],
      bar: [{ x: 975, y: 542 }, { x: 1045, y: 542 }, { x: 1115, y: 542 }],
      sofa: [{ x: 954, y: 720, sit: true, z: 830 }, { x: 1020, y: 720, sit: true, z: 830 }, { x: 1086, y: 720, sit: true, z: 830 }],
      records: [{ x: 930, y: 914, face: 'back' }],
      shelf: [{ x: 1100, y: 920, face: 'back' }],
      darts: [{ x: 120, y: p + 40, mirror: true }],
      foos: [{ x: 262, y: p + 28 }, { x: 404, y: p + 28 }, { x: 282, y: p + 172, face: 'back' }, { x: 384, y: p + 172, face: 'back' }],
      pong: [{ x: 486, y: p + 82 }, { x: 782, y: p + 82, mirror: true, syncOffset: 600 }],
      arcade: [{ x: 64, y: p + 262, face: 'back' }, { x: 144, y: p + 262, face: 'back' }],
      plant: [{ x: 724, y: p + 214 }],
    };
  }

  /** Break activities. Steps run in order; a group activity starts with several colleagues at once. */
  const ACTIVITIES = {
    coffee: { label: 'Getting coffee', w: 3, steps: [
      { zone: 'machine', ms: [4500, 6000], anim: 'brew' },
      { zone: 'bar', ms: [14000, 22000], prop: 'mug', anim: 'sip', label: 'Coffee at the bar', chat: ['How’s the release going?', 'This roast is good.', 'Lunch later?', 'Did you see the new build?', 'Third coffee today…', 'Any weekend plans?'] },
    ] },
    foosball: { label: 'Playing foosball', w: 3, group: [2, 4], steps: [{ zone: 'foos', ms: [20000, 32000], anim: 'foos', chat: ['Goal!', 'Nice shot!', 'Rematch?', 'No spinning!'] }] },
    pingpong: { label: 'Playing ping-pong', w: 2.5, group: [2, 2], steps: [{ zone: 'pong', ms: [18000, 28000], prop: 'paddle', anim: 'pong', sync: 1200, chat: ['Nice serve!', 'Out!', '11–9!', 'Again?'] }] },
    darts: { label: 'Playing darts', w: 1.5, steps: [{ zone: 'darts', ms: [12000, 19000], prop: 'dart', anim: 'darts', sync: 2400, chat: ['Bullseye!', 'So close…', 'Triple twenty!'] }] },
    arcade: { label: 'Playing an arcade game', w: 1.5, steps: [{ zone: 'arcade', ms: [14000, 22000], anim: 'arcade', chat: ['New high score!', 'One more life…'] }] },
    sofa: { label: 'Relaxing on the sofa', w: 2.5, steps: [{ zone: 'sofa', ms: [16000, 26000], variants: [
      { prop: 'book', label: 'Reading on the sofa' }, { prop: 'laptop', label: 'Browsing on the sofa' }, { anim: 'nap', label: 'Napping on the sofa' },
    ] }] },
    records: { label: 'Putting on a record', w: 1, steps: [
      { zone: 'records', ms: [5000, 7000], anim: 'records', music: true },
      { zone: 'sofa', ms: [14000, 22000], prop: 'book', label: 'Reading on the sofa' },
    ] },
    shelf: { label: 'Browsing the bookshelf', w: 1, steps: [
      { zone: 'shelf', ms: [6000, 9000], anim: 'shelf' },
      { zone: 'sofa', ms: [14000, 22000], prop: 'book', label: 'Reading on the sofa' },
    ] },
    plants: { label: 'Watering the plants', w: 1, steps: [{ zone: 'plant', ms: [7000, 10000], prop: 'can', anim: 'water' }] },
    window: { label: 'Looking out the window', w: 1.5, steps: [{ zone: 'window', ms: [9000, 15000], anim: 'window' }] },
  };

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
    skills: [],
    cards: [],
    boardOpen: false,
    boardFilter: '',          // '' everyone, '-' unassigned, or a colleague id
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
    setInterval(breakTick, 1000);
    const [prov, roles, skills] = await Promise.all([backend.get('api/providers').catch(() => null), backend.get('api/roles').catch(() => []), backend.get('api/skills').catch(() => [])]);
    S.skills = skills || [];
    S.cards = (await backend.get('api/cards').catch(() => [])) || [];
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
          if (d.status !== 'idle' && breaks.has(e.agentId)) endBreak(e.agentId, false); // work comes first
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
        renderStage(); enterPerson(d.id); updateHeadcount(); renderKanban();
        break;
      case 'office.updated':
        if (a) { a.profile = d; renderStage(); refreshPerson(d.id); if (S.selected === d.id && S.tab !== 'profile') renderDrawer(); renderKanban(); }
        break;
      case 'office.fired':
        leavePerson(e.agentId); renderKanban();
        break;
      case 'telegram.updated':
        if ($('#dlgTelegram').open) refreshTelegram();
        break;
      case 'cards.updated':
        S.cards = d.cards || []; renderKanban();
        break;
      case 'skills.updated':
        S.skills = d.skills || []; refreshSkillPicks(); if ($('#dlgSkills').open) renderSkillList();
        break;
      case 'roles.updated':
        S.roles = d.roles || []; refreshTemplates();
        break;
      case 'office.renamed':
        S.name = d.name; $('#officeName').textContent = S.name; document.title = S.name; fitGhostSign();
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
        if (S.cards.some((c) => c.missionId === d.id)) renderKanban();
        break;
      }
      case 'board.updated': {
        const m = S.missions.get(e.missionId);
        if (m) { m.board = d.tasks; if (S.focus === e.missionId) renderWhiteboard(); }
        if (S.cards.some((c) => c.missionId === e.missionId)) renderKanban();
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
  let spotsCache = null;
  const spots = () => spotsCache || (spotsCache = spotsFor(layout()));

  function sceneryHtml(L) {
    const { H, playTop: p } = L;
    // string lights: four sagging spans over the game area
    const spans = [0, 205, 410, 615].map((x0) => ({ x0, x1: x0 + 205, cx: x0 + 102.5 }));
    const bulbs = spans.flatMap(({ x0, x1, cx }) => [0.17, 0.39, 0.61, 0.83].map((t) => {
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
      const y = (1 - t) ** 2 * 8 + 2 * (1 - t) * t * 40 + t ** 2 * 8;
      return `<circle cx="${x.toFixed(1)}" cy="${(y + 4).toFixed(1)}" r="3.4"/>`;
    })).join('');
    const rods = [['red', 1], ['red', 2], ['blue', 3], ['red', 5], ['blue', 5], ['red', 3], ['blue', 2], ['blue', 1]]
      .map(([team, n], i) => `<i class="rod ${team}" style="left:${16 + i * 28}px">${Array.from({ length: n }, (_, k) => `<b style="top:${(16 + (96 / (n + 1)) * (k + 1) - 4).toFixed(1)}px"></b>`).join('')}</i>`).join('');

    return `
      <div class="top-wall brick"></div>
      <div class="side-wall brick" style="height:${H - WALL_H}px"></div>
      <div class="ledge"></div>
      <div class="whiteboard" id="whiteboard" role="button" tabindex="0" aria-label="Mission board"></div>
      <div class="window" style="left:596px">${skylineSvg(0)}</div>
      <div class="window" style="left:740px">${skylineSvg(1)}</div>
      <div class="shaft" style="left:540px"></div><div class="shaft" style="left:684px"></div>
      <div class="sunpatch" style="left:478px"></div><div class="sunpatch" style="left:622px"></div>
      <div class="ao-wall"></div>
      <div class="ambient" style="height:${H}px"></div>
      <div class="ghost-sign" id="ghostSign"><span>${esc(S.name)}</span></div>
      <div class="door-way" style="top:${H - 170}px"></div>
      <div class="barn-door" style="top:${H - 292}px"></div>

      <div class="glass-room" style="left:${MEET.x}px;top:${MEET.y}px;width:${MEET.w}px;height:${MEET.h}px"><div class="glass-back"></div></div>
      <div class="tv" id="tv"></div>
      <div class="meet-table" style="left:${MEET_TABLE.x}px;top:${MEET_TABLE.y}px;width:${MEET_TABLE.w}px;height:${MEET_TABLE.h}px;z-index:${MEET_TABLE.y + MEET_TABLE.h}"></div>
      <div class="glass-front" style="left:${MEET.x}px;top:${MEET.y + MEET.h - 46}px;width:${MEET.w}px;z-index:${MEET.y + MEET.h + 2}"><span class="glass-label">Meeting room</span></div>

      <div class="counter" style="left:888px;top:474px;width:270px;z-index:524">
        <div class="espresso" id="espresso"><i class="led"></i><i class="cup"></i><i class="steam s1"></i><i class="steam s2"></i><i class="steam s3"></i></div>
        <i class="grinder"></i><i class="cups"></i><i class="bowl"></i><i class="herbs"></i>
      </div>
      <div class="fridge" style="left:1166px;top:430px;z-index:528"></div>
      <div class="pool" style="left:920px;top:560px"></div>
      <div class="bar-table" style="left:960px;top:640px;width:220px;z-index:694"></div>
      <div class="stool" style="left:922px;top:648px;z-index:700"></div>
      <div class="stool" style="left:1186px;top:648px;z-index:700"></div>

      <div class="rug" style="left:902px;top:800px;width:300px;height:150px"></div>
      <div class="sofa-back" style="left:942px;top:756px;z-index:770"></div>
      <div class="sofa-seat" style="left:930px;top:792px;z-index:880"></div>
      <div class="coffee-table" style="left:1000px;top:884px;z-index:920"></div>
      <div class="floor-lamp" style="left:902px;top:690px;z-index:812"></div>
      <div class="plant" style="left:1184px;top:690px;width:44px;height:88px;z-index:780">${plantSvg('fig')}</div>
      <div class="sideboard" style="left:896px;top:962px;z-index:1006">
        <i class="speaker l"></i><div class="turntable" id="turntable"><i class="platter"></i><i class="tone-arm"></i></div><div class="notes"><i>♪</i><i>♫</i><i>♪</i></div><i class="speaker r"></i>
      </div>
      <div class="bookshelf" style="left:1062px;top:944px;z-index:1012"></div>
      <div class="floor-stencil" style="left:1062px;top:1030px">Lounge</div>

      <svg class="string-lights" style="top:${p - 8}px" viewBox="0 0 820 50" aria-hidden="true">
        <path d="${spans.map(({ x0, x1, cx }) => `M${x0} 8 Q${cx} 40 ${x1} 8`).join(' ')}"/>${bulbs}
      </svg>
      <div class="darts" id="darts" style="top:${p}px;z-index:${p + 160}">
        <div class="dartboard"><i class="hit h1"></i><i class="hit h2"></i><i class="hit h3"></i></div>
        <i class="dart-fly"><svg viewBox="0 0 24 8"><path d="M0 4 L6 3 L6 5 Z" fill="#9AA1A8"/><rect x="6" y="3" width="10" height="2" fill="#2B2B2B"/><path d="M16 4 L23 0 L21 4 L23 8 Z" fill="#E0B020"/></svg></i>
      </div>
      <div class="pool" style="left:216px;top:${p + 80}px"></div>
      <div class="foos" id="foos" style="left:250px;top:${p + 110}px;z-index:${p + 250}">
        <div class="cab"></div><div class="field"><i class="fball"></i></div><div class="front"></div>${rods}
      </div>
      <div class="pong" id="pong" style="left:560px;top:${p + 130}px;z-index:${p + 232}">
        <div class="top"></div><div class="face"></div><i class="net"></i><i class="pball-x"><i class="pball"></i></i>
      </div>
      ${[64, 144].map((x, i) => `<div class="arcade" id="arcade${i}" style="left:${x}px;top:${p + 196}px;z-index:${p + 332}"><div class="cab"></div><div class="marquee"></div><div class="screen"></div><div class="panel"></div></div>`).join('')}
      <div class="plant" style="left:770px;top:${p + 222}px;width:100px;height:108px;z-index:${p + 336}">${plantSvg('monstera')}</div>
      <div class="floor-stencil" style="left:330px;top:${p + 316}px">Game room</div>`;
  }

  function deskHtml(i, a) {
    const { x, y } = deskXY(i);
    const st = a ? onBreak(a.profile.id) ? 'break' : (a.presence?.status || 'idle') : '';
    const busy = a && ['typing', 'working', 'thinking'].includes(st);
    return `<div class="pool" style="left:${x + 85 - 150}px;top:${y - 70}px"></div>
      <div class="chair" style="left:${x + 62}px;top:${y - 46}px;z-index:${y + 30}"></div>
      <div class="desk ${a ? '' : 'vacant'} ${busy ? 'busy' : ''}" data-desk="${i}" ${a ? `data-agent="${a.profile.id}"` : ''} style="left:${x}px;top:${y}px;z-index:${y + 74}">
        <div class="top"><i class="monitor"><b>${CODE_SVG}</b></i><i class="kbd"></i><i class="mouse"></i><i class="item item-${i % 4}"></i></div><div class="front"></div>
        ${a ? `<button class="nameplate" data-agent="${a.profile.id}" title="${esc(a.profile.name)}${a.profile.title ? ` — ${esc(a.profile.title)}` : ''}"><i class="dot ${esc(st)}"></i><span class="np-name">${esc(a.profile.name)}</span>${a.profile.title ? `<span class="np-role">${esc(a.profile.title)}</span>` : ''}</button>` : ''}
      </div>`;
  }

  function renderStage() {
    const stage = $('#stage');
    const L = layout();
    spotsCache = null;
    stage.style.height = L.H + 'px';
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
    let html = sceneryHtml(L);
    for (let i = 0; i < L.slots; i++) html += deskHtml(i, occupied.get(i));

    if (agents.length === 0) {
      html += `<div class="empty-office">
        <h2>An empty loft, ready for a team</h2>
        <p>Hire colleagues one by one — any role, any instructions, any model — or start with a small software team and change it later.</p>
        <div class="row"><button class="btn primary" data-action="hire">Hire your first colleague</button>
        <button class="btn" data-action="starter">Hire a starter team</button></div></div>`;
    }

    stage.innerHTML = html;
    for (const el of people.values()) stage.append(el);
    // The game area moves down as desks are added; re-seat anyone on a break there.
    for (const [id, el] of people) if ((el.dataset.key || '').startsWith('spot:')) { el.dataset.key = ''; placePerson(id, true); }
    fitGhostSign();
    renderWhiteboard();
    updateProps();
    fitStage();
  }

  function fitGhostSign() {
    const el = $('#ghostSign');
    if (!el) return;
    el.querySelector('span').textContent = S.name;
    const n = S.name.length;
    el.style.fontSize = (n <= 10 ? 46 : n <= 16 ? 38 : n <= 26 ? 30 : 22) + 'px';
  }

  // ================================================================ zoom
  // 'width' fills the floor's width (the default), 'all' fits the whole office, a number is the viewer's own zoom.
  const ZOOM_MIN = 0.3, ZOOM_MAX = 2;
  const ZOOM_STEPS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2];
  const clampZoom = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  let zoomMode = (() => {
    try {
      const saved = localStorage.getItem('office.zoom');
      return saved === 'all' || saved === 'width' ? saved : +saved > 0 ? clampZoom(+saved) : 'width';
    } catch { return 'width'; }
  })();
  let scaleNow = 1;

  function stageScale() {
    const wrap = $('#floorWrap');
    const byWidth = (wrap.clientWidth - 2) / W;
    if (zoomMode === 'all') return clampZoom(Math.min(byWidth, (wrap.clientHeight - 2) / stageHeight()));
    if (zoomMode === 'width') return Math.min(ZOOM_MAX, Math.max(0.56, byWidth)); // below this, pan instead of shrinking
    return zoomMode;
  }

  function fitStage() {
    if (!sizer) return;
    const wrap = $('#floorWrap');
    const H = stageHeight();
    scaleNow = stageScale();
    $('#stage').style.transform = `scale(${scaleNow})`;
    sizer.style.width = W * scaleNow + 'px';
    sizer.style.height = H * scaleNow + 'px';
    // Centred both ways when it's smaller than the window.
    sizer.style.margin = `${Math.max(0, (wrap.clientHeight - H * scaleNow) / 2)}px auto 0`;
    $('#zoomLevel').textContent = Math.round(scaleNow * 100) + '%';
    for (const b of document.querySelectorAll('#zoomBar [data-zoom]')) {
      if (b.dataset.zoom === 'width' || b.dataset.zoom === 'all') b.setAttribute('aria-pressed', zoomMode === b.dataset.zoom);
    }
  }

  /** Changes zoom while keeping the point under the anchor (the pointer, or the middle of the floor) in place. */
  function setZoom(mode, anchor) {
    const wrap = $('#floorWrap');
    const ax = anchor?.x ?? wrap.clientWidth / 2, ay = anchor?.y ?? wrap.clientHeight / 2;
    const px = (wrap.scrollLeft + ax - sizer.offsetLeft) / scaleNow;
    const py = (wrap.scrollTop + ay - sizer.offsetTop) / scaleNow;
    zoomMode = typeof mode === 'number' ? clampZoom(mode) : mode;
    try { localStorage.setItem('office.zoom', String(zoomMode)); } catch { /* zoom just won't be remembered */ }
    fitStage();
    wrap.scrollLeft = px * scaleNow + sizer.offsetLeft - ax;
    wrap.scrollTop = py * scaleNow + sizer.offsetTop - ay;
  }

  function wireZoom() {
    $('#zoomBar').addEventListener('click', (ev) => {
      const z = ev.target.closest('[data-zoom]')?.dataset.zoom;
      if (z === 'in') setZoom(ZOOM_STEPS.find((s) => s > scaleNow + 0.01) ?? ZOOM_MAX);
      else if (z === 'out') setZoom([...ZOOM_STEPS].reverse().find((s) => s < scaleNow - 0.01) ?? ZOOM_MIN);
      else if (z) setZoom(z);
    });
    // ⌘/Ctrl + scroll, and trackpad pinch (which browsers report as ctrl + wheel), zoom around the pointer.
    $('#floorWrap').addEventListener('wheel', (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      const r = ev.currentTarget.getBoundingClientRect();
      setZoom(scaleNow * Math.exp(-ev.deltaY * 0.01), { x: ev.clientX - r.left, y: ev.clientY - r.top });
    }, { passive: false });
  }

  // ================================================================ where each person should be
  function personTarget(id) {
    const a = S.agents.get(id);
    if (!a) return null;
    const p = a.presence || { status: 'idle' };
    if (p.status === 'visiting' && p.with && S.agents.has(p.with)) {
      return { ...visitorXY(S.agents.get(p.with).profile.desk), key: 'visit:' + p.with };
    }
    if ((p.status === 'meeting' || p.status === 'presenting') && p.missionId) {
      const list = S.missions.get(p.missionId)?.participants || [];
      const k = Math.max(0, list.indexOf(id));
      return { ...meetingXY(k), key: 'meet:' + p.missionId + ':' + k };
    }
    const b = p.status === 'idle' ? breaks.get(id) : null;
    const s = b && spots()[b.zone]?.[b.idx];
    if (s) {
      const step = ACTIVITIES[b.act].steps[b.step];
      const v = b.variant || {};
      return {
        x: s.x, y: s.y, z: s.z ?? s.y + 112, face: s.face, sit: s.sit, mirror: s.mirror,
        prop: v.prop ?? step.prop, anim: v.anim ?? step.anim, sync: step.sync, syncOffset: s.syncOffset,
        key: `spot:${b.zone}:${b.idx}:${b.act}:${b.step}`,
      };
    }
    return { ...seatXY(a.profile.desk), key: 'desk:' + a.profile.desk };
  }

  function createPerson(id) {
    const el = document.createElement('div');
    el.className = 'person';
    el.dataset.agent = id;
    el.dataset.face = 'front';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.innerHTML = `<div class="fig">${avatar(S.agents.get(id).profile.look)}<div class="prop"></div></div><div class="ind"></div>`;
    el.addEventListener('transitionend', (ev) => {
      if (ev.target !== el || (ev.propertyName !== 'left' && ev.propertyName !== 'top')) return;
      arrive(el, id);
    });
    people.set(id, el);
    $('#stage').append(el);
    return el;
  }

  function refreshPerson(id) {
    const el = people.get(id);
    if (!el) return;
    el.querySelector('svg.av').outerHTML = avatar(S.agents.get(id).profile.look, 'full', el.dataset.face || 'front');
    updatePerson(id);
  }

  function setFace(el, id, face) {
    if (el.dataset.face === face) return;
    el.dataset.face = face;
    const svg = el.querySelector('svg.av');
    if (svg && S.agents.has(id)) svg.outerHTML = avatar(S.agents.get(id).profile.look, 'full', face);
  }

  function setAnim(el, anim, dur, offset) {
    anim = anim || '';
    if (el.dataset.anim === anim) return;
    if (el.dataset.anim) el.classList.remove('act-' + el.dataset.anim);
    el.dataset.anim = anim;
    if (!anim) return;
    // Synced animations (ping-pong, darts) share one clock with the table/board so swings meet the ball.
    el.style.setProperty('--d', dur ? `-${(Date.now() + (offset || 0)) % dur}ms` : `-${Math.floor(Math.random() * 6000)}ms`);
    el.classList.add('act-' + anim);
  }

  function setProp(el, prop) {
    prop = prop || '';
    if (el.dataset.prop === prop) return;
    el.dataset.prop = prop;
    const host = el.querySelector('.prop');
    const def = PROPS[prop];
    host.className = 'prop' + (def ? ' ' + def[0] : '');
    host.innerHTML = def ? def[1] : '';
  }

  function applyPose(el, id, t) {
    const face = t.face || 'front';
    setFace(el, id, face);
    el.classList.toggle('standing', !t.sit && !t.desk);
    el.classList.toggle('sitting', !!t.sit);
    el.classList.toggle('mirror', !!t.mirror);
    setAnim(el, t.anim, t.sync, t.syncOffset);
    setProp(el, face === 'back' ? null : t.prop);
    el.style.zIndex = t.z;
    updateIndicator(id);
  }

  function placePerson(id, instant) {
    const el = people.get(id) || createPerson(id);
    const t = personTarget(id);
    if (!t || el.dataset.leaving) return;
    if (el.dataset.key === t.key) return;
    const first = !el.dataset.key;
    el.dataset.key = t.key;
    el.classList.toggle('edge-r', t.x > W - 220);
    el.classList.toggle('edge-l', t.x < 80);
    if (first || instant) {
      el.style.transition = 'none';
      el.style.left = t.x + 'px'; el.style.top = t.y + 'px';
      el.classList.remove('walking');
      applyPose(el, id, t);
      void el.offsetWidth;
      el.style.transition = '';
      return;
    }
    walkTo(el, id, t.x, t.y, t.prop);
  }

  /** Walk at a steady pace, facing away from us when heading up the floor. */
  function walkTo(el, id, x, y, carry) {
    const x0 = parseFloat(el.style.left) || 0, y0 = parseFloat(el.style.top) || 0;
    const dist = Math.hypot(x - x0, y - y0);
    const face = y < y0 - 24 ? 'back' : 'front';
    setAnim(el, '');
    el.classList.remove('sitting', 'mirror');
    el.classList.add('walking', 'standing');
    setFace(el, id, face);
    setProp(el, face === 'back' ? null : carry);
    el.style.zIndex = 4500;
    if (dist < 2) { el.style.left = x + 'px'; el.style.top = y + 'px'; arrive(el, id); return; }
    el.style.transitionDuration = Math.min(3.6, Math.max(0.5, dist / 230)).toFixed(2) + 's';
    el.style.left = x + 'px'; el.style.top = y + 'px';
  }

  function arrive(el, id) {
    el.classList.remove('walking');
    if (el.dataset.leaving) { el.remove(); people.delete(id); return; }
    const t = personTarget(id);
    if (t && t.key === el.dataset.key) applyPose(el, id, t);
    updateProps();
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
    endBreak(id, false);
    const el = people.get(id);
    S.agents.delete(id);
    if (S.selected === id) closeDrawer();
    if (el) {
      const door = doorXY();
      el.dataset.leaving = '1';
      el.querySelector('.ind').innerHTML = '';
      walkTo(el, id, door.x, door.y, null);
      setTimeout(() => { if (people.get(id) === el) { el.remove(); people.delete(id); } }, 4200);
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

  function updateIndicator(id) {
    const a = S.agents.get(id);
    const el = people.get(id);
    if (!a || !el) return;
    const st = a.presence?.status || 'idle';
    const b = S.bubbles.get(id);
    const ind = el.querySelector('.ind');
    if (b && b.until > Date.now()) ind.innerHTML = `<div class="bubble ${b.kind === 'chat' ? 'small' : ''}">${esc(tail(b.text, 170))}</div>`;
    else if (st === 'working' && a.presence.detail) ind.innerHTML = `<div class="chip">${esc(a.presence.detail)}</div>`;
    else if (st === 'thinking' || st === 'visiting') ind.innerHTML = `<div class="bubble thought"><span class="thinking-dots"><i></i><i></i><i></i></span></div>`;
    else if (el.dataset.anim === 'nap') ind.innerHTML = '<span class="zzz">z</span>';
    else ind.innerHTML = '';
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
    el.setAttribute('aria-label', `${a.profile.name}, ${a.profile.title || 'colleague'} — ${statusText(a.presence, id)}`);
    updateIndicator(id);
    const desk = document.querySelector(`.desk[data-agent="${id}"]`);
    if (desk) desk.classList.toggle('busy', ['typing', 'working', 'thinking'].includes(st));
  }

  function updateNameplate(id) {
    const a = S.agents.get(id);
    const dot = document.querySelector(`.nameplate[data-agent="${id}"] .dot`);
    if (dot) dot.className = `dot ${onBreak(id) ? 'break' : a?.presence?.status || 'idle'}`;
    if (S.selected === id && S.drawer === 'agent' && a) {
      const line = $('#drawerStatus');
      if (line) line.textContent = statusText(a.presence, id);
    }
  }

  function statusText(p, id) {
    const s = p?.status || 'idle';
    if (s === 'idle') {
      const b = id && breaks.get(id);
      if (!b) return 'At their desk';
      const step = ACTIVITIES[b.act].steps[b.step];
      return `On a break · ${(b.variant?.label || step.label || ACTIVITIES[b.act].label).toLowerCase()}`;
    }
    const withName = p?.with ? nameOf(p.with) : p?.detail;
    return {
      thinking: 'Thinking', typing: 'Writing', working: p?.detail ? clip(p.detail, 40) : 'Working',
      visiting: `Talking with ${withName || 'a colleague'}`, meeting: 'In a meeting', presenting: 'Speaking in a meeting',
    }[s] || s;
  }

  // ================================================================ breaks: what idle colleagues get up to
  const breaks = new Map();     // agentId -> { id, act, step, zone, idx, until, group, variant }
  const spotTaken = new Map();  // 'zone:idx' -> agentId
  const idleClock = new Map();  // agentId -> { since, wait }
  const groups = new Map();     // groupId -> Set(agentId)
  let musicUntil = 0;
  const rand = (a, b) => a + Math.random() * (b - a);
  const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const onBreak = (id) => breaks.has(id) && (S.agents.get(id)?.presence?.status || 'idle') === 'idle';
  const freeSpots = (zone) => (spots()[zone] || []).map((_, i) => i).filter((i) => !spotTaken.has(`${zone}:${i}`));
  const atDeskAndFree = (id) => {
    const a = S.agents.get(id);
    const el = people.get(id);
    return a && (a.presence?.status || 'idle') === 'idle' && !breaks.has(id) && el && !el.dataset.leaving && !el.classList.contains('walking');
  };

  function assign(id, act, stepIdx, idx, until, group) {
    const step = ACTIVITIES[act].steps[stepIdx];
    const b = { id, act, step: stepIdx, zone: step.zone, idx, until, group, variant: step.variants ? pick(step.variants) : null };
    breaks.set(id, b);
    spotTaken.set(`${step.zone}:${idx}`, id);
    idleClock.delete(id);
    updatePerson(id);
    updateNameplate(id);
  }

  function startBreak(id) {
    const now = Date.now();
    const mates = [...S.agents.keys()].filter((o) => o !== id && atDeskAndFree(o) && now - (idleClock.get(o)?.since ?? now) > 2500);
    const options = Object.entries(ACTIVITIES).filter(([, act]) => {
      const need = act.group ? act.group[0] : 1;
      return freeSpots(act.steps[0].zone).length >= need && (!act.group || mates.length >= need - 1);
    });
    if (!options.length) return false;
    let r = Math.random() * options.reduce((sum, [, a]) => sum + a.w, 0);
    const [actId, act] = options.find(([, a]) => (r -= a.w) <= 0) || options[0];
    const step = act.steps[0];
    const until = now + rand(...step.ms);
    if (!act.group) { assign(id, actId, 0, pick(freeSpots(step.zone)), until, null); return true; }

    const free = freeSpots(step.zone);
    const max = Math.min(act.group[1], free.length, mates.length + 1);
    const size = act.group[0] + Math.floor(Math.random() * (max - act.group[0] + 1));
    const members = [id, ...shuffle(mates).slice(0, size - 1)];
    // Foosball: fill opposite sides first so a 1-on-1 game faces off across the table.
    const order = step.zone === 'foos' ? [0, 3, 1, 2].filter((i) => free.includes(i)) : free;
    const gid = `g${now}${Math.random()}`;
    groups.set(gid, new Set(members));
    members.forEach((m, k) => assign(m, actId, 0, order[k], until, gid));
    return true;
  }

  function endBreak(id, chain) {
    const b = breaks.get(id);
    if (!b) return;
    if (spotTaken.get(`${b.zone}:${b.idx}`) === id) spotTaken.delete(`${b.zone}:${b.idx}`);
    breaks.delete(id);
    if (b.group) {
      const g = groups.get(b.group);
      g?.delete(id);
      if (g && g.size === 0) groups.delete(b.group);
      // Not enough players left: the others wrap up too.
      else if (g && g.size < ACTIVITIES[b.act].group[0]) for (const o of g) { const ob = breaks.get(o); if (ob) ob.until = Math.min(ob.until, Date.now() + 1500); }
    }
    idleClock.set(id, { since: Date.now(), wait: chain ? rand(1500, 4000) : rand(9000, 24000) });
    if (S.agents.has(id)) { updatePerson(id); updateNameplate(id); }
  }

  function advance(id, b) {
    const steps = ACTIVITIES[b.act].steps;
    const next = steps[b.step + 1];
    const free = next ? freeSpots(next.zone) : [];
    if (!next || !free.length) { endBreak(id, Math.random() < 0.25); return; }
    if (spotTaken.get(`${b.zone}:${b.idx}`) === id) spotTaken.delete(`${b.zone}:${b.idx}`);
    assign(id, b.act, b.step + 1, pick(free), Date.now() + rand(...next.ms), null);
  }

  function breakTick() {
    const now = Date.now();
    for (const [id, a] of S.agents) {
      const idle = (a.presence?.status || 'idle') === 'idle';
      const b = breaks.get(id);
      if (!idle) { if (b) endBreak(id, false); idleClock.delete(id); continue; }
      const el = people.get(id);
      if (!el || el.dataset.leaving) continue;
      const walking = el.classList.contains('walking');
      if (b) {
        if (now >= b.until) { advance(id, b); continue; }
        const step = ACTIVITIES[b.act].steps[b.step];
        if (!walking && step.music) musicUntil = Math.max(musicUntil, now + 120000);
        if (!walking && step.chat && !S.bubbles.has(id) && Math.random() < 0.035) say(id, pick(step.chat), 'chat', 2400);
        continue;
      }
      const clock = idleClock.get(id);
      if (!clock) { idleClock.set(id, { since: now, wait: rand(3000, 9000) }); continue; }
      if (walking || now - clock.since < clock.wait) continue;
      if (Math.random() < 0.2 || !startBreak(id)) idleClock.set(id, { since: now, wait: rand(6000, 14000) });
    }
    updateProps();
  }

  /** Furniture reacts to whoever is using it. */
  function updateProps() {
    const arrived = (zone) => [...spotTaken].filter(([k, id]) => k.startsWith(zone + ':') && breaks.get(id)?.zone === zone && people.get(id) && !people.get(id).classList.contains('walking')).map(([, id]) => breaks.get(id).idx);
    const set = (sel, on, cls = 'playing', dur = 0) => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (on && !el.classList.contains(cls) && dur) el.style.setProperty('--d', `-${Date.now() % dur}ms`);
      el.classList.toggle(cls, !!on);
    };
    set('#espresso', arrived('machine').length > 0, 'brewing');
    set('#foos', arrived('foos').length >= 2, 'playing', 4800);
    set('#pong', arrived('pong').length >= 2, 'playing', 1200);
    set('#darts', arrived('darts').length >= 1, 'playing', 7200);
    const arc = arrived('arcade');
    set('#arcade0', arc.includes(0));
    set('#arcade1', arc.includes(1));
    set('#turntable', Date.now() < musicUntil);
    set('#tv', [...S.agents.values()].some((a) => ['meeting', 'presenting'].includes(a.presence?.status)), 'on');
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
        <div><h3>${esc(p.name)}</h3><p>${esc(p.title || 'Colleague')}</p><p id="drawerStatus">${esc(statusText(a.presence, p.id))}</p></div>
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
      ${mode === 'hire' ? `<label class="field"><span>Role summary</span><input data-field="summary" maxlength="200" value="${esc(p.summary)}" placeholder="One line for the role card">
        <small>Only used if you save this as a role.</small></label>` : ''}
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
        ${toggle('plan', 'Plan on the board', 'Add, assign and move office cards')}
        ${toggle('web', 'Browse the web', 'Public sites only')}
        ${toggle('shell', 'Run commands', 'Builds, tests, git — in the mission folder')}
      </div></div>
      <div class="field"><span>Skills</span>
        <div class="skill-pick" data-skill-pick>${skillPickHtml(p.skills || [])}</div>
        <small>Playbooks they load when the work calls for it. <button type="button" class="linkish" data-action="manage-skills">Manage skills</button></small></div>
      ${mode === 'edit' ? `<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:4px">
        <button type="button" class="btn danger" data-action="fire">Let ${esc(p.name)} go</button>
        <span class="dlg-error" data-error></span>
        <button type="button" class="btn" data-action="save-role">Save as role</button>
        <button type="button" class="btn primary" data-action="save-profile">Save changes</button></div>` : ''}
    </div>`;
  }

  /** Two-way binds a profile form to a draft object. */
  function wireProfileForm(root, draft, mode) {
    draft.skills ||= [];
    formDrafts.set(root, draft);
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
      if (ev.target.matches('[data-add-skill]') && ev.target.value) {
        if (!draft.skills.includes(ev.target.value)) draft.skills.push(ev.target.value);
        refreshSkillPick(root);
        root.querySelector('[data-add-skill]')?.focus();
      }
    });
    root.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('button');
      if (!btn) return;
      if (btn.dataset.removeSkill) {
        draft.skills = draft.skills.filter((n) => n !== btn.dataset.removeSkill);
        refreshSkillPick(root);
      } else if (btn.dataset.look) {
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
      } else if (btn.dataset.action === 'save-role') {
        await saveRole(draft, root.querySelector('[data-error]'));
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
  let hirePicked = ''; // title of the role template the draft started from
  function openHire() {
    const dlg = $('#dlgHire');
    hireDraft = { name: freshName(), title: '', summary: '', persona: '', provider: '', model: '', look: randomLook(), can: { files: true, shell: false, web: false, delegate: true }, skills: [] };
    hirePicked = '';
    dlg.innerHTML = `<form class="dlg" method="dialog" data-form="hire">
      <div class="dlg-head"><h2 id="hireTitle">Hire a colleague</h2><button type="button" class="btn ghost close" data-action="close-dialog" aria-label="Close">✕</button></div>
      <div class="dlg-body"><div class="hire-grid">
        <div><div class="field" style="margin-bottom:6px"><span>Start from a role</span><small>Optional — fills in the form, which you can then change.</small></div>
          <div class="templates">${templatesHtml()}</div></div>
        <div id="hireForm">${profileFormHtml(hireDraft, 'hire')}</div>
      </div></div>
      <div class="dlg-foot"><span class="dlg-error" data-error></span>
        <button type="button" class="btn" data-action="save-hire-role" title="Keep this title, instructions, abilities and outfit as a role template">Save as role</button>
        <button type="button" class="btn" data-action="close-dialog">Cancel</button>
        <button class="btn primary" id="hireSubmit">Hire ${esc(hireDraft.name)}</button></div>
    </form>`;
    wireProfileForm($('#hireForm', dlg), hireDraft, 'hire');
    dlg.querySelector('[data-action="save-hire-role"]').addEventListener('click', () => saveRole(hireDraft, dlg.querySelector('.dlg-foot [data-error]')));
    dlg.querySelector('.templates').addEventListener('click', async (ev) => {
      const del = ev.target.closest('[data-delete-role]');
      if (del) { await deleteRole(del, dlg.querySelector('.dlg-foot [data-error]')); return; }
      const b = ev.target.closest('[data-template]');
      if (!b) return;
      dlg.querySelectorAll('[data-template]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      const r = S.roles[+b.dataset.template];
      hirePicked = r?.title || '';
      hireDraft.title = r?.title || '';
      hireDraft.summary = r?.summary || '';
      hireDraft.persona = r?.persona || '';
      hireDraft.skills = [...(r?.skills || [])];
      if (r?.can) hireDraft.can = { ...hireDraft.can, ...r.can };
      if (r?.look) hireDraft.look = { ...hireDraft.look, ...r.look };
      const form = $('#hireForm', dlg);
      form.innerHTML = profileFormHtml(hireDraft, 'hire');
    });
    dlg.showModal();
    dlg.querySelector('[data-field="name"]').focus();
  }

  function templatesHtml() {
    const picked = hirePicked.toLowerCase();
    return `<button type="button" class="template" data-template="-1" aria-pressed="${!picked}"><b>Blank</b><span>Write the role yourself.</span></button>
      ${S.roles.map((r, i) => `<div class="template-item">
        <button type="button" class="template" data-template="${i}" aria-pressed="${r.title.toLowerCase() === picked}">
          <b>${esc(r.title)}${r.custom ? ` <em class="role-tag">${r.replacesBuiltIn ? 'edited' : 'yours'}</em>` : ''}</b><span>${esc(r.summary)}</span>
          ${r.skills?.length ? `<span class="role-skills">${r.skills.length === 1 ? '1 skill' : `${r.skills.length} skills`}: ${esc(r.skills.join(', '))}</span>` : ''}</button>
        ${r.custom ? `<button type="button" class="template-del" data-delete-role="${esc(r.id)}" data-reset="${r.replacesBuiltIn ? '1' : ''}"
          title="${r.replacesBuiltIn ? 'Reset to the built-in role' : 'Delete this role'}" aria-label="${r.replacesBuiltIn ? 'Reset' : 'Delete'} ${esc(r.title)}">${r.replacesBuiltIn ? '↺' : '✕'}</button>` : ''}
      </div>`).join('')}`;
  }

  function refreshTemplates() {
    const list = $('#dlgHire')?.open ? $('#dlgHire .templates') : null;
    if (list) list.innerHTML = templatesHtml();
  }

  async function reloadRoles() {
    try { S.roles = (await backend.get('api/roles')) || []; refreshTemplates(); } catch { /* the roles.updated event will catch up */ }
  }

  /** Saves the draft's title, instructions, abilities and outfit as a role (updates the owner's role with that title). */
  async function saveRole(draft, errEl) {
    errEl.textContent = '';
    const title = (draft.title || '').trim();
    if (!title) { errEl.textContent = 'Give the role a title first.'; return; }
    const known = S.roles.find((r) => r.title.toLowerCase() === title.toLowerCase());
    const summary = (draft.summary || '').trim() || known?.summary || clip((draft.persona || '').split(/(?<=[.!?])\s/)[0], 140);
    try {
      const saved = await backend.post('api/roles', { title, summary, persona: draft.persona, can: draft.can, look: { shirt: draft.look.shirt, accessory: draft.look.accessory }, skills: draft.skills || [] });
      if (draft === hireDraft) hirePicked = saved.title;
      await reloadRoles();
      toast(known ? `Updated the ${saved.title} role.` : `Saved ${saved.title} as a role.`);
    } catch (e) { errEl.textContent = e.message; }
  }

  async function deleteRole(btn, errEl) {
    errEl.textContent = '';
    // Two-step, like letting someone go: first click arms, second click deletes.
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = btn.dataset.reset ? 'Reset?' : 'Delete?';
      setTimeout(() => { if (btn.isConnected && btn.dataset.armed) refreshTemplates(); }, 4000);
      return;
    }
    const role = S.roles.find((r) => r.id === btn.dataset.deleteRole);
    try {
      await backend.del(`api/roles/${encodeURIComponent(btn.dataset.deleteRole)}`);
      await reloadRoles();
      if (role) toast(btn.dataset.reset ? `${role.title} is back to the built-in role.` : `Deleted the ${role.title} role.`);
    } catch (e) { errEl.textContent = e.message; }
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
      const { summary, ...profile } = hireDraft;
      const hired = await backend.post('api/agents', profile);
      $('#dlgHire').close();
      toast(`${hired.name} joined the office.`);
    } catch (e) { err.textContent = e.message; }
  }

  async function hireStarterTeam() {
    const want = ['Project Manager', 'Software Engineer', 'QA Engineer', 'Product Designer'];
    for (const title of want) {
      const r = S.roles.find((x) => x.title.toLowerCase() === title.toLowerCase());
      if (!r) continue;
      const look = { ...randomLook(), ...(r.look || {}) };
      try { await backend.post('api/agents', { name: freshName(), title: r.title, persona: r.persona, provider: '', model: '', look, can: r.can, skills: r.skills || [] }); }
      catch (e) { toast(e.message); break; }
      await new Promise((res) => setTimeout(res, 450));
    }
  }

  // ================================================================ skills
  const formDrafts = new WeakMap(); // profile form root -> the draft it edits

  /** Attached skills as removable chips, then a menu of the library's other skills. */
  function skillPickHtml(names) {
    const byName = new Map(S.skills.map((s) => [s.name, s]));
    const chips = names.map((n) => {
      const s = byName.get(n);
      return `<span class="skill-chip ${s ? '' : 'missing'}" title="${esc(s ? s.description : 'Not in the skill library any more')}">${esc(n)}
        <button type="button" data-remove-skill="${esc(n)}" aria-label="Remove ${esc(n)}">✕</button></span>`;
    }).join('');
    const rest = S.skills.filter((s) => !names.includes(s.name));
    const menu = rest.length
      ? `<select data-add-skill aria-label="Add a skill"><option value="">+ Add a skill…</option>${rest.map((s) => `<option value="${esc(s.name)}">${esc(s.name)} — ${esc(clip(s.description, 60))}</option>`).join('')}</select>`
      : S.skills.length ? '' : '<span class="skill-none">No skills in the library yet.</span>';
    return chips + menu;
  }

  function refreshSkillPick(root) {
    const pick = root.querySelector('[data-skill-pick]');
    if (pick) pick.innerHTML = skillPickHtml(formDrafts.get(root)?.skills || []);
  }

  function refreshSkillPicks() {
    for (const pick of document.querySelectorAll('[data-skill-pick]')) {
      for (let el = pick.parentElement; el; el = el.parentElement) {
        if (formDrafts.has(el)) { refreshSkillPick(el); break; }
      }
    }
  }

  let skillSel = null; // name of the skill being edited, or '' for a new one
  function openSkills(name) {
    const dlg = $('#dlgSkills');
    skillSel = name ?? S.skills[0]?.name ?? '';
    dlg.innerHTML = `<form class="dlg" method="dialog" data-form="skill">
      <div class="dlg-head"><h2 id="skillsTitle">Skills</h2><button type="button" class="btn ghost close" data-action="close-dialog" aria-label="Close">✕</button></div>
      <div class="dlg-body"><div class="skills-grid">
        <div><div class="skill-actions">
            <button type="button" class="btn" data-skill-new>+ New skill</button>
            <button type="button" class="btn" data-skill-import title="Import a SKILL.md file">Import</button>
            <input type="file" accept=".md,text/markdown,text/plain" hidden data-skill-file>
          </div>
          <div class="skill-list" id="skillList"></div></div>
        <div id="skillEditor"></div>
      </div></div>
      <div class="dlg-foot"><span class="dlg-error" data-error></span>
        <button type="button" class="btn danger" data-skill-delete hidden>Delete</button>
        <button type="button" class="btn" data-action="close-dialog">Close</button>
        <button class="btn primary" id="skillSave">Save skill</button></div>
    </form>`;
    const err = () => dlg.querySelector('.dlg-foot [data-error]');
    dlg.querySelector('[data-skill-new]').onclick = () => { skillSel = ''; renderSkillList(); renderSkillEditor(); };
    dlg.querySelector('[data-skill-import]').onclick = () => dlg.querySelector('[data-skill-file]').click();
    dlg.querySelector('[data-skill-file]').onchange = async (ev) => {
      const file = ev.target.files?.[0];
      ev.target.value = '';
      if (!file) return;
      err().textContent = '';
      try {
        const saved = await backend.post('api/skills/import', { text: await file.text() });
        await reloadSkills(saved.name);
        toast(`Imported ${saved.name}.`);
      } catch (e) { err().textContent = e.message; }
    };
    dlg.querySelector('#skillList').onclick = (ev) => {
      const item = ev.target.closest('[data-skill]');
      if (!item) return;
      skillSel = item.dataset.skill; renderSkillList(); renderSkillEditor();
    };
    dlg.querySelector('[data-skill-delete]').onclick = async (ev) => {
      const btn = ev.currentTarget;
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1'; btn.textContent = `Yes, delete ${skillSel}`;
        setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Delete'; } }, 4000);
        return;
      }
      err().textContent = '';
      try {
        const name = skillSel;
        await backend.del(`api/skills/${encodeURIComponent(name)}`);
        await reloadSkills(S.skills.find((s) => s.name !== name)?.name ?? '');
        toast(`Deleted ${name}. Colleagues and roles that had it no longer do.`);
      } catch (e) { err().textContent = e.message; }
    };
    renderSkillList();
    renderSkillEditor();
    if (!dlg.open) dlg.showModal();
  }

  async function reloadSkills(select) {
    try { S.skills = (await backend.get('api/skills')) || []; } catch { /* skills.updated will catch up */ }
    refreshSkillPicks();
    if (select !== undefined) skillSel = select;
    if ($('#dlgSkills').open) { renderSkillList(); renderSkillEditor(); }
  }

  function renderSkillList() {
    const list = $('#skillList');
    if (!list) return;
    list.innerHTML = (skillSel === '' ? `<button type="button" class="template" aria-pressed="true"><b>New skill</b><span>Not saved yet</span></button>` : '')
      + (S.skills.length || skillSel === '' ? S.skills.map((s) => `<button type="button" class="template" data-skill="${esc(s.name)}" aria-pressed="${s.name === skillSel}">
          <b>${esc(s.name)}${s.readOnly ? ` <em class="role-tag">${esc(s.source)}</em>` : ''}</b><span>${esc(clip(s.description, 110))}</span></button>`).join('')
        : '<p class="skill-none">No skills yet. Write one, or import a SKILL.md.</p>');
  }

  function renderSkillEditor() {
    const host = $('#skillEditor');
    const dlg = $('#dlgSkills');
    const s = skillSel ? S.skills.find((x) => x.name === skillSel) : null;
    const isNew = skillSel === '' || !s;
    const ro = !!s?.readOnly;
    dlg.querySelector('[data-skill-delete]').hidden = isNew || ro;
    dlg.querySelector('#skillSave').hidden = ro;
    const used = [...S.agents.values()].filter((a) => (a.profile.skills || []).includes(s?.name)).map((a) => a.profile.name);
    host.innerHTML = `<div class="form">
      ${ro ? `<p class="skill-note">${s.source === 'built-in' ? 'This skill ships with Agent Office (a vetted copy of a published skill; see its source in SOURCE.md) and is read-only.' : `This skill comes from <code>${esc(s.source)}</code> and is read-only here.`}
        <button type="button" class="linkish" data-skill-copy>Make an editable copy</button></p>` : ''}
      <label class="field"><span>Name</span><input data-skill-field="name" maxlength="64" value="${esc(s?.name || '')}" ${isNew ? '' : 'readonly'} placeholder="e.g. release-notes" pattern="[a-z0-9]+(-[a-z0-9]+)*" required>
        <small>${isNew ? 'Lowercase letters, digits and hyphens. It can\'t be changed later.' : used.length ? `Used by ${esc(used.join(', '))}.` : 'Not attached to anyone yet.'}</small></label>
      <label class="field"><span>When to use it</span><textarea data-skill-field="description" maxlength="1024" rows="3" ${ro ? 'readonly' : ''} required
        placeholder="e.g. Writes release notes from merged changes. Use when asked for a changelog or release summary.">${esc(s?.description || '')}</textarea>
        <small>Colleagues see only this until they load the skill, so say what it does and when it applies.</small></label>
      <label class="field"><span>Instructions</span><textarea class="skill-body" data-skill-field="instructions" maxlength="60000" ${ro ? 'readonly' : ''}
        placeholder="Steps, checklists, templates, examples — Markdown is fine.">${esc(s?.instructions || '')}</textarea></label>
      ${s?.files?.length ? `<div class="field"><span>Bundled files</span><small>${s.files.map((f) => `<code>${esc(f)}</code>`).join(' ')}</small></div>` : ''}
    </div>`;
    host.querySelector('[data-skill-copy]')?.addEventListener('click', async () => {
      try {
        const copy = await backend.post(`api/skills/${encodeURIComponent(s.name)}/copy`, {});
        await reloadSkills(copy.name);
        toast(`${copy.name} is now an office skill you can edit. Delete the copy to go back to the original.`);
      } catch (e) { dlg.querySelector('.dlg-foot [data-error]').textContent = e.message; }
    });
    if (isNew) host.querySelector('[data-skill-field="name"]').focus();
  }

  async function submitSkill(form) {
    const err = form.querySelector('.dlg-foot [data-error]');
    err.textContent = '';
    const val = (k) => form.querySelector(`[data-skill-field="${k}"]`).value;
    const body = { name: val('name').trim(), description: val('description'), instructions: val('instructions') };
    const existing = S.skills.find((s) => s.name === skillSel);
    try {
      const saved = existing
        ? await backend.put(`api/skills/${encodeURIComponent(existing.name)}`, body)
        : await backend.post('api/skills', body);
      await reloadSkills(saved.name);
      toast(existing ? `Saved ${saved.name}.` : `Added ${saved.name}. Attach it to a role or colleague under Skills.`);
    } catch (e) { err.textContent = e.message; }
  }

  // ================================================================ office board (kanban)
  const COLUMNS = [['backlog', 'Backlog'], ['todo', 'To do'], ['doing', 'In progress'], ['review', 'Review'], ['done', 'Done']];
  const PRIORITIES = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']];
  const POINTS = [1, 2, 3, 5, 8, 13, 21];
  let dragCard = null;

  function setBoardOpen(open) {
    S.boardOpen = open;
    $('#kanban').hidden = !open;
    $('#app').classList.toggle('board-open', open);
    $('#btnBoard').setAttribute('aria-pressed', open);
    if (open) renderKanban();
    else fitStage();
  }

  const pointsOf = (cards) => cards.reduce((n, c) => n + (c.points || 0), 0);

  function renderKanban() {
    const host = $('#kanban');
    if (!S.boardOpen || !host) return;
    const f = S.boardFilter;
    const shown = S.cards.filter((c) => !f || (f === '-' ? !S.agents.has(c.assignee) : c.assignee === f));
    const people = [...S.agents.values()].map((a) => a.profile).sort((a, b) => a.name.localeCompare(b.name));
    const scroll = [...host.querySelectorAll('.kb-list')].map((l) => l.scrollTop);
    const inProgress = S.cards.filter((c) => c.status === 'doing');
    host.innerHTML = `<div class="kb-head">
        <h2>Office board</h2>
        <span class="kb-sum">${S.cards.length} card${S.cards.length === 1 ? '' : 's'} · ${pointsOf(inProgress)} pts in progress · ${S.cards.filter((c) => c.blocked).length} blocked</span>
        <span class="spacer"></span>
        <label class="kb-filter"><span class="sr-only">Show</span><select id="kbFilter">
          <option value="">Everyone</option><option value="-" ${f === '-' ? 'selected' : ''}>Unassigned</option>
          ${people.map((p) => `<option value="${esc(p.id)}" ${f === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
        </select></label>
        <button type="button" class="btn primary" data-kb-new="backlog">+ New card</button>
        <button type="button" class="btn" data-kb-close>Back to the floor</button>
      </div>
      <div class="kb-cols">${COLUMNS.map(([key, label]) => {
        const cards = shown.filter((c) => c.status === key);
        const pts = pointsOf(cards);
        return `<section class="kb-col" data-col="${key}" aria-label="${label}">
          <header><h3>${label}</h3><span class="kb-count">${cards.length}${pts ? ` · ${pts} pts` : ''}</span>
            <button type="button" class="kb-add" data-kb-new="${key}" aria-label="Add a card to ${label}">+</button></header>
          <div class="kb-list" data-list="${key}">${cards.map(cardHtml).join('') || `<p class="kb-empty">${key === 'backlog' ? 'Ideas and requests waiting to be planned.' : key === 'review' ? 'Finished work waits here for you.' : 'Drop cards here.'}</p>`}</div>
        </section>`;
      }).join('')}</div>`;
    host.querySelectorAll('.kb-list').forEach((l, i) => { l.scrollTop = scroll[i] || 0; });
  }

  function cardHtml(c) {
    const who = S.agents.get(c.assignee)?.profile;
    const m = c.missionId ? S.missions.get(c.missionId) : null;
    const tasks = m?.board || [];
    const doneTasks = tasks.filter((t) => t.status === 'done').length;
    const work = m ? (m.running ? 'working on it' : m.status === 'done' ? 'mission done' : m.status) : '';
    return `<article class="kb-card prio-${esc(c.priority)} ${c.blocked ? 'blocked' : ''}" draggable="true" data-card="${esc(c.id)}" tabindex="0"
        aria-label="#${c.number} ${esc(c.title)}${who ? `, ${esc(who.name)}` : ''}${c.blocked ? ', blocked' : ''}">
      <div class="kb-meta"><span class="kb-num">#${c.number}</span>
        ${c.priority !== 'normal' ? `<span class="kb-prio">${esc(c.priority)}</span>` : ''}
        ${c.points != null ? `<span class="kb-pts" title="Story points">${c.points}</span>` : ''}</div>
      <h4>${esc(c.title)}</h4>
      ${c.blocked ? `<p class="kb-blocked">Blocked${c.blockedReason ? `: ${esc(c.blockedReason)}` : ''}</p>` : ''}
      ${m ? `<div class="kb-work ${m.running ? 'running' : ''}">${tasks.length ? `<div class="kb-bar"><i style="width:${Math.round((doneTasks / tasks.length) * 100)}%"></i></div>` : ''}
        <span>${tasks.length ? `${doneTasks}/${tasks.length} tasks · ` : ''}${esc(work)}</span></div>` : ''}
      <footer>${who ? `<span class="kb-who">${avatar(who.look, 'head')}${esc(who.name)}</span>` : '<span class="kb-who none">Unassigned</span>'}
        ${c.createdBy !== 'owner' ? `<span class="kb-by">added by ${esc(c.createdBy)}</span>` : ''}</footer>
    </article>`;
  }

  function wireKanban() {
    const host = $('#kanban');
    host.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-kb-close]')) return setBoardOpen(false);
      const add = ev.target.closest('[data-kb-new]');
      if (add) return openCard(null, add.dataset.kbNew);
      const card = ev.target.closest('[data-card]');
      if (card) openCard(card.dataset.card);
    });
    host.addEventListener('keydown', (ev) => {
      const card = ev.target.closest('[data-card]');
      if (card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openCard(card.dataset.card); }
    });
    host.addEventListener('change', (ev) => {
      if (ev.target.id === 'kbFilter') { S.boardFilter = ev.target.value; renderKanban(); }
    });

    // Drag a card to another column or position; a placeholder shows where it will land.
    const marker = document.createElement('div');
    marker.className = 'kb-drop';
    host.addEventListener('dragstart', (ev) => {
      const card = ev.target.closest('[data-card]');
      if (!card) return;
      dragCard = card.dataset.card;
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', dragCard);
      requestAnimationFrame(() => card.classList.add('dragging'));
    });
    host.addEventListener('dragend', () => {
      dragCard = null;
      marker.remove();
      host.querySelectorAll('.dragging, .drop-target').forEach((el) => el.classList.remove('dragging', 'drop-target'));
    });
    host.addEventListener('dragover', (ev) => {
      const list = ev.target.closest('.kb-col')?.querySelector('.kb-list');
      if (!dragCard || !list) return;
      ev.preventDefault();
      host.querySelectorAll('.drop-target').forEach((el) => el !== list.parentElement && el.classList.remove('drop-target'));
      list.parentElement.classList.add('drop-target');
      const before = [...list.querySelectorAll('[data-card]:not(.dragging)')].find((el) => ev.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2);
      list.insertBefore(marker, before || null);
    });
    host.addEventListener('drop', async (ev) => {
      const list = ev.target.closest('.kb-col')?.querySelector('.kb-list');
      if (!dragCard || !list) return;
      ev.preventDefault();
      const id = dragCard;
      const next = marker.nextElementSibling?.closest?.('[data-card]');
      const card = host.querySelector(`[data-card="${CSS.escape(id)}"]`);
      if (card) list.insertBefore(card, marker); // show it there straight away; the server's update follows
      marker.remove();
      try { await backend.post(`api/cards/${encodeURIComponent(id)}/move`, { status: list.dataset.list, beforeId: next?.dataset.card || null }); }
      catch (e) { toast(e.message); renderKanban(); }
    });
  }

  /** Opens the card editor: an existing card by id, or a new one in <paramref name="column"/>. */
  function openCard(id, column = 'backlog') {
    const existing = id ? S.cards.find((c) => c.id === id) : null;
    const c = existing ? { ...existing } : { title: '', description: '', status: column, assignee: null, priority: 'normal', points: null, blocked: false, blockedReason: '' };
    const dlg = $('#dlgCard');
    const people = [...S.agents.values()].map((a) => a.profile).sort((a, b) => a.name.localeCompare(b.name));
    const m = c.missionId ? S.missions.get(c.missionId) : null;
    dlg.innerHTML = `<form class="dlg" method="dialog" data-form="card">
      <div class="dlg-head"><h2 id="cardTitle">${existing ? `Card #${c.number}` : 'New card'}</h2><button type="button" class="btn ghost close" data-action="close-dialog" aria-label="Close">✕</button></div>
      <div class="dlg-body"><div class="form">
        <label class="field"><span>Title</span><input data-c="title" maxlength="200" required value="${esc(c.title)}" placeholder="e.g. Password reset for the customer portal"></label>
        <label class="field"><span>Description</span><textarea data-c="description" maxlength="8000" placeholder="What's needed, and how we'll know it's done. This becomes the brief when work starts.">${esc(c.description)}</textarea></label>
        <div class="two">
          <label class="field"><span>Column</span><select data-c="status">${COLUMNS.map(([k, l]) => `<option value="${k}" ${c.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span>Assignee</span><select data-c="assignee"><option value="">Unassigned</option>
            ${people.map((p) => `<option value="${esc(p.id)}" ${c.assignee === p.id ? 'selected' : ''}>${esc(p.name)}${p.title ? ` — ${esc(p.title)}` : ''}</option>`).join('')}</select></label>
        </div>
        <div class="two">
          <div class="field"><span>Priority</span><div class="seg">${PRIORITIES.map(([k, l]) => `<button type="button" data-prio="${k}" aria-pressed="${c.priority === k}">${l}</button>`).join('')}</div></div>
          <label class="field"><span>Story points</span><select data-c="points"><option value="">Not estimated</option>
            ${POINTS.map((n) => `<option value="${n}" ${c.points === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <label class="toggle"><input type="checkbox" data-c="blocked" ${c.blocked ? 'checked' : ''}><span><b>Blocked</b><small>Something is in the way</small></span></label>
        <label class="field" data-reason ${c.blocked ? '' : 'hidden'}><span>What's blocking it</span><input data-c="blockedReason" maxlength="200" value="${esc(c.blockedReason || '')}"></label>
        ${m ? `<div class="kb-mission"><span>Mission: <b>${esc(clip(m.title, 60))}</b> · ${m.running ? 'running' : esc(m.status)}</span><button type="button" class="btn" data-open-mission>Open mission</button></div>` : ''}
        ${existing && existing.createdBy !== 'owner' ? `<small class="kb-by">Added by ${esc(existing.createdBy)}</small>` : ''}
      </div></div>
      <div class="dlg-foot"><span class="dlg-error" data-error></span>
        ${existing ? '<button type="button" class="btn danger" data-delete-card>Delete</button>' : ''}
        <button type="button" class="btn" data-start-card></button>
        <button class="btn primary">${existing ? 'Save' : 'Add card'}</button></div>
    </form>`;
    dlg.dataset.card = existing?.id || '';
    dlg.dataset.priority = c.priority;
    const startBtn = dlg.querySelector('[data-start-card]');
    const refreshStart = () => {
      const who = S.agents.get(dlg.querySelector('[data-c="assignee"]').value)?.profile;
      const running = m?.running;
      startBtn.hidden = !who || running;
      startBtn.textContent = who ? `${c.missionId ? 'Start again' : 'Start work'} with ${who.name}` : '';
    };
    refreshStart();
    dlg.querySelector('[data-c="assignee"]').onchange = refreshStart;
    dlg.querySelector('[data-c="blocked"]').onchange = (ev) => { dlg.querySelector('[data-reason]').hidden = !ev.target.checked; };
    dlg.querySelectorAll('[data-prio]').forEach((b) => { b.onclick = () => { dlg.dataset.priority = b.dataset.prio; dlg.querySelectorAll('[data-prio]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }; });
    dlg.querySelector('[data-open-mission]')?.addEventListener('click', () => { dlg.close(); setBoardOpen(false); focusMission(c.missionId); });
    dlg.querySelector('[data-delete-card]')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1'; btn.textContent = 'Yes, delete it';
        setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Delete'; } }, 4000);
        return;
      }
      try { await backend.del(`api/cards/${encodeURIComponent(existing.id)}`); dlg.close(); toast(`Deleted #${existing.number}.`); }
      catch (e) { dlg.querySelector('[data-error]').textContent = e.message; }
    });
    startBtn.onclick = async () => {
      const saved = await saveCard(dlg.querySelector('form'));
      if (!saved) return;
      try {
        await backend.post(`api/cards/${encodeURIComponent(saved.id)}/start`, {});
        dlg.close();
        toast(`${nameOf(saved.assignee)} is on #${saved.number}.`);
      } catch (e) { dlg.querySelector('[data-error]').textContent = e.message; }
    };
    dlg.showModal();
    if (!existing) dlg.querySelector('[data-c="title"]').focus();
  }

  async function saveCard(form) {
    const dlg = $('#dlgCard');
    const err = form.querySelector('[data-error]');
    err.textContent = '';
    const v = (k) => form.querySelector(`[data-c="${k}"]`);
    if (!v('title').value.trim()) { err.textContent = 'Give the card a title.'; return null; }
    const body = {
      title: v('title').value, description: v('description').value, status: v('status').value,
      assignee: v('assignee').value || null, priority: dlg.dataset.priority || 'normal',
      points: v('points').value ? +v('points').value : null,
      blocked: v('blocked').checked, blockedReason: v('blockedReason').value,
    };
    try {
      const id = dlg.dataset.card;
      const saved = id ? await backend.put(`api/cards/${encodeURIComponent(id)}`, body) : await backend.post('api/cards', body);
      dlg.dataset.card = saved.id;
      return saved;
    } catch (e) { err.textContent = e.message; return null; }
  }

  async function submitCard(form) {
    const existing = !!$('#dlgCard').dataset.card;
    const saved = await saveCard(form);
    if (!saved) return;
    $('#dlgCard').close();
    if (!existing) toast(`Added #${saved.number}.`);
  }

  // ================================================================ Telegram
  let telegram = null; // last status from the server
  const TELEGRAM_COMMANDS = [
    ['@Name message', 'talk to a colleague; reply to their answer to keep going'],
    ['/mission @Name goal', 'start a mission'], ['/meeting @A @B topic', 'hold a meeting'],
    ['/missions', 'what’s running'], ['/cancel', 'stop a mission (reply to its message)'], ['/team', 'who’s doing what'],
    ['/board', 'the office board'], ['/card [@Name] title | details', 'add a card'], ['/go 12', 'hand card #12 to its assignee'],
    ['/move 12 todo', 'move a card'], ['/done 12', 'accept a card'], ['/mute, /unmute', 'notifications in that chat'],
  ];

  async function openTelegram() {
    const dlg = $('#dlgTelegram');
    await refreshTelegram();
    if (!dlg.open) dlg.showModal();
  }

  async function refreshTelegram() {
    const before = telegram?.chats?.length ?? null;
    try { telegram = await backend.get('api/telegram'); } catch (e) { telegram = { error: e.message }; }
    if (before !== null && (telegram.chats?.length ?? 0) > before) toast('Telegram chat paired.');
    renderTelegram();
  }

  function renderTelegram() {
    const dlg = $('#dlgTelegram');
    const t = telegram || {};
    const pairing = t.pairing && new Date(t.pairing.expiresAt) > new Date() ? t.pairing : null;
    let body;
    if (S.demo || t.demo) {
      body = '<p>Telegram needs the real server. Run the app with <code>dotnet run</code> and open it from there; this in-browser demo can’t talk to Telegram.</p>';
    } else if (t.error) {
      body = `<p class="dlg-error">${esc(t.error)}</p>`;
    } else if (!t.configured) {
      body = `<p>Run the office from Telegram: talk to colleagues, start missions, manage the board, and get told when work is done.
          Nothing needs hosting. The app polls Telegram for messages, so it works from your laptop while it’s running.</p>
        <ol class="tg-steps">
          <li>In Telegram, open <a href="https://t.me/BotFather" target="_blank" rel="noopener">@BotFather</a>, send <code>/newbot</code> and follow the steps. It gives you a token.</li>
          <li>In <code>src/AgentOffice</code>, store the token:
            <div class="tg-copy"><code id="tgCmd">dotnet user-secrets set "Telegram:BotToken" "123456:ABC…"</code>
            <button type="button" class="btn" data-tg="copy">Copy</button></div></li>
          <li>Restart the app and come back here to pair your chat.</li>
        </ol>`;
    } else {
      const chats = t.chats || [];
      body = `<p class="tg-status ${t.problem ? 'bad' : 'ok'}">${t.problem ? esc(t.problem)
          : t.bot ? `Connected as <a href="https://t.me/${esc(t.bot)}" target="_blank" rel="noopener">@${esc(t.bot)}</a>` : 'Connecting to Telegram…'}</p>
        <h3 class="tg-h">Paired chats</h3>
        ${chats.length ? `<ul class="tg-chats">${chats.map((c) => `<li><span><b>${esc(c.name)}</b><small>Paired ${esc(new Date(c.pairedAt).toLocaleDateString())}</small></span>
            <label class="tg-notify"><input type="checkbox" data-tg-mute="${c.id}" ${c.muted ? '' : 'checked'}> Notifications</label>
            <button type="button" class="btn danger" data-tg-unpair="${c.id}">Remove</button></li>`).join('')}</ul>`
          : '<p class="skill-none">No chats yet. Only paired chats can use the bot; everyone else is turned away.</p>'}
        ${pairing ? `<div class="tg-pair">
            <p>Open the bot and press <b>Start</b>, or send it this code. It works once, for 10 minutes.</p>
            <div class="tg-code">${esc(pairing.code)}</div>
            ${pairing.link ? `<a class="btn primary" href="${esc(pairing.link)}" target="_blank" rel="noopener">Open @${esc(t.bot)} in Telegram</a>` : ''}
            <small>or send <code>/pair ${esc(pairing.code)}</code></small></div>`
          : `<button type="button" class="btn primary" data-tg="pair" ${t.bot ? '' : 'disabled'}>Pair a chat</button>`}
        <details class="tg-help"><summary>What you can say to the bot</summary>
          <dl>${TELEGRAM_COMMANDS.map(([c, d]) => `<dt><code>${esc(c)}</code></dt><dd>${esc(d)}</dd>`).join('')}</dl></details>`;
    }
    dlg.innerHTML = `<div class="dlg">
      <div class="dlg-head"><h2 id="telegramTitle">Telegram</h2><button type="button" class="btn ghost close" data-action="close-dialog" aria-label="Close">✕</button></div>
      <div class="dlg-body tg-body">${body}</div>
      <div class="dlg-foot"><span class="dlg-error" data-error></span><button type="button" class="btn" data-action="close-dialog">Close</button></div>
    </div>`;
    const err = (m) => { dlg.querySelector('[data-error]').textContent = m; };
    dlg.querySelector('[data-tg="copy"]')?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#tgCmd').textContent); toast('Copied. Replace the example token with yours.'); } catch { err('Couldn’t copy; select the command instead.'); }
    });
    dlg.querySelector('[data-tg="pair"]')?.addEventListener('click', async () => {
      try { telegram = await backend.post('api/telegram/pair', {}); renderTelegram(); } catch (e) { err(e.message); }
    });
    dlg.querySelectorAll('[data-tg-mute]').forEach((box) => box.addEventListener('change', async () => {
      try { telegram = await backend.put(`api/telegram/chats/${box.dataset.tgMute}`, { muted: !box.checked }); renderTelegram(); } catch (e) { err(e.message); }
    }));
    dlg.querySelectorAll('[data-tg-unpair]').forEach((btn) => btn.addEventListener('click', async () => {
      if (btn.dataset.armed !== '1') {
        btn.dataset.armed = '1'; btn.textContent = 'Yes, remove';
        setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Remove'; } }, 4000);
        return;
      }
      try { await backend.del(`api/telegram/chats/${btn.dataset.tgUnpair}`); await refreshTelegram(); } catch (e) { err(e.message); }
    }));
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
    $('#btnBoard').onclick = () => setBoardOpen(!S.boardOpen);
    $('#btnTelegram').onclick = openTelegram;
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
      if (action === 'manage-skills') return openSkills();
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
      if (kind === 'skill') return submitSkill(form);
      if (kind === 'card') return submitCard(form);
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

    wireZoom();
    wireKanban();
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
