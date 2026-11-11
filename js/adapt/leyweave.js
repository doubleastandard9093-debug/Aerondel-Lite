// Leyweave (adapted from Path of Exile's passive tree): a shared web of small nodes, notables and a few keystones.
// Spend Ley (from fights and bosses — not Anima, which stays on the Lattice). Opens at combat level 50 and grows toward 1000.
import { combatLevel } from '../skills.js';
import { NORM, obj, arr, num, str } from './state.js';

const KEYSTONES = [
  { id: 'rarecarve', name: 'Rare Carve', desc: 'Carved hunt parts are rarer, but a carve always yields a set piece when one exists.' },
  { id: 'stillblade', name: 'Still Blade', desc: 'A Guardbreak riposte window lasts a little longer.' },
  { id: 'seasonkeep', name: 'Season\'s Keep', desc: 'Greenstead can cover one extra plot so a crop can grow out of season.' },
  { id: 'wordecho', name: 'Word-echo', desc: 'A Wordcry also briefly slows nearby foes.' },
  { id: 'leyblood', name: 'Leyblood', desc: 'Kills grant more Ley, and Dull facets drop a little more often.' },
  { id: 'kindsteel', name: 'Kind Steel', desc: 'Unsocketing a Facet Stone is free to your purse, and stunning skills hold a breath longer.' }
];
const NOTABLES = [
  { id: 'clean-carve', name: 'Clean Carve', desc: 'A slightly longer carve window on a hunt.' },
  { id: 'wide-guard', name: 'Wide Guard', desc: 'Reaping Whirl reaches half a metre farther.' },
  { id: 'iron-hold', name: 'Iron Hold', desc: 'Stuns last a little longer.' },
  { id: 'green-hand', name: 'Green Hand', desc: 'Crops on the farm grow a little faster.' },
  { id: 'square-hand', name: 'Square Hand', desc: 'You furnish a Townstead a little faster.' },
  { id: 'ley-sight', name: 'Ley Sight', desc: 'Bosses drop more Ley.' },
  { id: 'soft-step', name: 'Soft Step', desc: 'A successful dodge refunds a little run energy.' },
  { id: 'word-rest', name: 'Word Rest', desc: 'Wordcries come off cooldown a little sooner.' }
];
const SMALL_FX = ['ley', 'carve', 'stun', 'green', 'square', 'word'];

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

function buildWeb() {
  const nodes = [], byId = {}, links = {};
  const add = n => { nodes.push(n); byId[n.id] = n; links[n.id] = links[n.id] || []; };
  const link = (a, b) => { if (a === b) return; if (!links[a].includes(b)) links[a].push(b); if (!links[b].includes(a)) links[b].push(a); };
  add({ id: 'start', name: 'Ley Heart', kind: 'start', cost: 0, ring: 0, x: 0, y: 0, desc: 'The centre of the weave. Path outward from here.', fx: null });
  const counts = [0, 8, 12, 16, 18, 20, 22, 16, 12];
  const rings = [[{ id: 'start', k: 0 }]];
  let ni = 0, ki = 0;
  for (let r = 1; r < counts.length; r++) {
    const n = counts[r], rad = r * 78, row = [];
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 - Math.PI / 2;
      const id = `r${r}k${k}`;
      let kind = 'small', title, desc, fx, cost = 1, key = null;
      if (r >= 7 && ki < KEYSTONES.length && k % Math.max(1, Math.floor(n / KEYSTONES.length)) === 0) {
        const K = KEYSTONES[ki++]; kind = 'key'; title = K.name; desc = K.desc; fx = K.id; cost = 6; key = K.id;
      } else if (r >= 2 && r % 2 === 0 && k % 4 === 0 && ni < NOTABLES.length) {
        const N = NOTABLES[ni++]; kind = 'notable'; title = N.name; desc = N.desc; fx = N.id; cost = 3;
      } else {
        const t = SMALL_FX[(hash(id) + r + k) % SMALL_FX.length];
        title = 'Ley thread'; desc = 'A small thread of the weave, used to path outward.'; fx = t; cost = 1;
      }
      add({ id, name: title, kind, cost, ring: r, x: Math.round(Math.cos(ang) * rad), y: Math.round(Math.sin(ang) * rad), desc, fx, key });
      row.push({ id, k });
    }
    rings.push(row);
    // same-ring neighbours
    for (let k = 0; k < row.length; k++) link(row[k].id, row[(k + 1) % row.length].id);
    // previous ring
    const prev = rings[r - 1];
    for (let k = 0; k < row.length; k++) {
      const t = Math.round(k * prev.length / row.length) % prev.length;
      link(row[k].id, prev[t].id);
      link(row[k].id, prev[(t + 1) % prev.length].id);
    }
  }
  return { nodes, byId, links };
}
const WEB = buildWeb();
const NODE_IDS = new Set(WEB.nodes.map(n => n.id));
const STARTS = [
  { id: 'wanderer', name: 'Wanderer' },
  { id: 'melee', name: 'Melee' },
  { id: 'ranged', name: 'Ranged' },
  { id: 'magic', name: 'Magic' },
  { id: 'sword', name: 'Swordsmanship' }
];
const START_IDS = STARTS.map(s => s.id);

function shortest(from, to) {
  const q = [from], prev = { [from]: null };
  while (q.length) {
    const c = q.shift();
    if (c === to) break;
    for (const n of WEB.links[c] || []) if (!(n in prev)) { prev[n] = c; q.push(n); }
  }
  if (!(to in prev)) return [];
  const path = []; for (let c = to; c; c = prev[c]) path.push(c); return path.reverse();
}
const FIRST_KEY = WEB.nodes.find(n => n.kind === 'key');
const KEY_PATH = FIRST_KEY ? shortest('start', FIRST_KEY.id) : ['start'];

NORM.ley = v => {
  v = obj(v);
  const nodes = [...new Set(arr(v.nodes).filter(id => NODE_IDS.has(id)))];
  return { nodes, ley: Math.max(0, Math.floor(num(v.ley, 0, 0))), spent: Math.max(0, Math.floor(num(v.spent, 0, 0))), start: str(v.start, START_IDS, null) };
};

export default function leyweave(A) {
  const { ctx, player, skills } = A;
  const S = () => A.S('ley');
  const filled = () => new Set(S().nodes);
  A.leyOpen = () => combatLevel(skills) >= 50;
  A.leyKey = id => filled().has('start') && WEB.nodes.some(n => n.key === id && filled().has(n.id));
  A.leyHas = id => filled().has('start') && WEB.nodes.some(n => n.fx === id && filled().has(n.id));
  A.leyFx = () => {
    const f = filled();
    const fx = { leyGain: 0, whirlR: 0, stun: 0, growSpeed: 0, buildSpeed: 0, carveWin: 0, cryCd: 0 };
    if (!f.has('start')) return fx;
    for (const id of f) {
      const n = WEB.byId[id]; if (!n) continue;
      if (n.fx === 'ley' || n.fx === 'ley-sight') fx.leyGain += n.kind === 'notable' ? 1 : 0.2;
      if (n.fx === 'wide-guard') fx.whirlR += 0.5;
      if (n.fx === 'iron-hold' || n.fx === 'stun' || n.fx === 'kindsteel') fx.stun += n.kind === 'key' ? 1 : n.kind === 'notable' ? 1 : 0;
      if (n.fx === 'green-hand' || n.fx === 'green') fx.growSpeed += n.kind === 'notable' ? 0.04 : 0.005;
      if (n.fx === 'square-hand' || n.fx === 'square') fx.buildSpeed += n.kind === 'notable' ? 0.04 : 0.005;
      if (n.fx === 'clean-carve' || n.fx === 'carve') fx.carveWin += n.kind === 'notable' ? 400 : 50;
      if (n.fx === 'word-rest' || n.fx === 'word') fx.cryCd += n.kind === 'notable' ? 0.12 : 0.02;
    }
    if (A.leyKey('leyblood')) fx.leyGain += 1;
    if (A.leyKey('kindsteel')) fx.stun += 1;
    return fx;
  };

  const defaultStart = () => {
    const voc = A.S('voc') && A.S('voc').id;
    if (voc === 'longbow') return 'ranged';
    if (voc === 'leysage' || voc === 'hearthcant') return 'magic';
    if (voc === 'swashbuckler') return 'sword';
    if (voc === 'warder') return 'melee';
    const st = A.S('stance') && A.S('stance').main;
    if (st === 'Ranged') return 'ranged';
    if (st === 'Magic') return 'magic';
    if (st === 'Swordsmanship') return 'sword';
    if (st === 'Melee') return 'melee';
    return 'wanderer';
  };

  A.leyPickStart = id => {
    if (!A.leyOpen()) return A.log('The Leyweave opens at combat level 50.', 'warn');
    if (!START_IDS.includes(id)) return;
    if (S().start && S().nodes.length) return A.log('Refund the weave at a bank before choosing a new start.', 'warn');
    S().start = id;
    if (!S().nodes.includes('start')) { S().nodes.push('start'); }
    A.log(`You begin the Leyweave as a ${STARTS.find(s => s.id === id).name}.`, 'skill'); A.dirty();
    return true;
  };
  A.leyFill = id => {
    if (!A.leyOpen()) return A.log('The Leyweave opens at combat level 50.', 'warn');
    const n = WEB.byId[id]; if (!n) return;
    const s = S();
    if (!s.start) A.leyPickStart(defaultStart());
    if (s.nodes.includes(id)) return;
    if (id !== 'start' && !s.nodes.includes('start')) { if (!A.leyFill('start')) return; }
    if (id !== 'start' && !(WEB.links[id] || []).some(x => s.nodes.includes(x))) return A.log('Fill a node next to one you already have, starting at the Ley Heart.', 'warn');
    // Higher rings ask for a higher combat level, growing toward 1000.
    const need = id === 'start' ? 50 : Math.min(1000, 50 + n.ring * 80);
    if (combatLevel(skills) < need) return A.log(`That ring of the weave opens at combat level ${need}.`, 'warn');
    if (s.ley < n.cost) return A.log(`That node costs ${n.cost} Ley (you have ${s.ley}).`, 'warn');
    s.ley -= n.cost; s.spent += n.cost; s.nodes.push(id);
    A.log(n.kind === 'key' ? `Keystone: ${n.name}. ${n.desc}` : `You path through ${n.name}.`, n.kind === 'key' ? 'skill' : 'game');
    A.dirty();
    return true;
  };
  A.leyRefund = () => {
    const s = S(); if (!s.nodes.length && !s.start) return A.log('The weave is already empty.', 'game');
    const back = Math.floor(s.spent * 0.7);
    const gold = 500;
    if ((player.gold || 0) < gold) return A.log(`Refunding the Leyweave costs ${gold} coins (or talk to a bank).`, 'warn');
    player.gold -= gold; s.ley += back; s.spent = 0; s.nodes = []; s.start = null;
    A.log(`The Leyweave is refunded. ${back} Ley returns to you.`, 'game'); A.dirty();
    return true;
  };

  ctx.EXT.extKill.push(m => {
    if (!A.leyOpen()) return;
    const fx = A.leyFx();
    let n = 0;
    if (A.isBossy(m)) n = 2 + Math.floor(fx.leyGain);
    else if (Math.random() < 0.12 + Math.min(0.15, fx.leyGain * 0.05)) n = 1;
    if (n) { S().ley += n; }
  });

  // Bank respec and Word-echo are hooked from main / wordcries via A.leyKey.
  A.leyBankOpt = () => ({ action: 'Refund Leyweave', target: '500 coins', color: '#c8a050', fn: () => A.leyRefund() });

  A.npc('leyweaver', '🕸️', 'Leyweaver Ione', 'The weave opens at combat level 50. Spend Ley — not Anima — to path from the heart. Keystones change rules, not a huge damage number. A bank can refund the path for a cost.', 'ley');
  A.guide.push(['Leyweave', 'At combat level 50, open Ventures ✦ → Leyweave (or talk to Leyweaver Ione in Larkhaven). Spend Ley earned from fights and bosses (Anima still belongs to the Lattice). Path outward from the Ley Heart; notables and keystones change rules (a longer riposte, a rarer but better carve, an extra farm cover). Refund at a bank for 500 coins (70% of Ley spent returns). Pinch or use the +/− buttons to move around the web on a phone.']);

  let view = { x: 150, y: 190, k: 0.72 }, recOn = false, q = '';
  const applyView = el => { const inner = el && el.querySelector('#leyinner'); if (inner) inner.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; };
  const bindWeb = () => {
    const el = document.getElementById('leyweb'); if (!el) return;
    applyView(el);
    if (el._ley) return; el._ley = true;
    let down = null, lastDist = 0;
    el.addEventListener('pointerdown', e => { if (e.target.closest('[data-a=fill]')) return; down = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      const pts = typeof el.getPointerCapture === 'function' ? 1 : 1;
      if (down && e.buttons) { view.x = down.vx + (e.clientX - down.x); view.y = down.vy + (e.clientY - down.y); applyView(el); }
    });
    el.addEventListener('pointerup', () => { down = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); const k = Math.max(0.35, Math.min(1.8, view.k * (e.deltaY < 0 ? 1.1 : 0.9))); view.k = k; applyView(el); }, { passive: false });
    // pinch
    let pinch = null;
    el.addEventListener('touchstart', e => { if (e.touches.length === 2) { const a = e.touches[0], b = e.touches[1]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k: view.k }; } }, { passive: true });
    el.addEventListener('touchmove', e => { if (e.touches.length === 2 && pinch) { const a = e.touches[0], b = e.touches[1]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); view.k = Math.max(0.35, Math.min(1.8, pinch.k * (d / pinch.d))); applyView(el); } }, { passive: true });
    el.addEventListener('touchend', () => { pinch = null; });
  };

  A.tab({ id: 'ley', icon: '🕸️', name: 'Leyweave', render: () => {
    const s = S(), open = A.leyOpen(), f = filled();
    const rec = recOn && FIRST_KEY ? new Set(shortest('start', FIRST_KEY.id)) : null;
    const ql = (q || '').trim().toLowerCase();
    const nodes = WEB.nodes.map(n => {
      const on = f.has(n.id), can = !on && (n.id === 'start' || (WEB.links[n.id] || []).some(x => f.has(x)));
      const hit = !ql || n.name.toLowerCase().includes(ql) || (n.desc || '').toLowerCase().includes(ql);
      const recN = rec && rec.has(n.id);
      const size = n.kind === 'key' ? 42 : n.kind === 'notable' || n.kind === 'start' ? 36 : 26;
      const bg = on ? (n.kind === 'key' ? '#6a3a8a' : n.kind === 'notable' ? '#4a6aa0' : '#3a5a3a') : can ? '#2a2a36' : '#1a1a22';
      const op = hit ? 1 : 0.25;
      return `<button data-a="fill" data-k="${n.id}" title="${A.esc(n.name)} (${n.cost} Ley) — ${A.esc(n.desc)}"
        style="position:absolute;left:${600 + n.x - size / 2}px;top:${600 + n.y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;padding:0;font-size:${n.kind === 'small' ? 0 : 10}px;line-height:1.1;opacity:${op};background:${bg};${recN && !on ? 'outline:2px solid #ffd780;' : ''}${on ? 'box-shadow:0 0 0 2px #ffd780;' : ''}">${n.kind === 'small' ? '' : A.esc(n.name.split(' ')[0])}</button>`;
    }).join('');
    setTimeout(bindWeb, 0);
    const startBtns = STARTS.map(st => `<button data-a="start" data-k="${st.id}" class="${s.start === st.id ? 'on' : ''}">${A.esc(st.name)}</button>`).join('');
    return `<h4>Leyweave · Ley ${s.ley} · spent ${s.spent} · combat ${combatLevel(skills)}</h4>
      <p><small>${open ? 'Anima stays on the Lattice. Ley is earned from fights and bosses. Keystones change rules, not a large damage number.' : 'Opens at combat level 50. Ley is a currency of its own — not Anima.'}</small></p>
      ${open ? `<div class="row" style="flex-wrap:wrap;gap:4px">${startBtns}
        <button data-a="rec" class="${recOn ? 'on' : ''}">Recommended path</button>
        <button data-a="zin">+</button><button data-a="zout">−</button><button data-a="reset">Centre</button>
        <button data-a="refund">Refund (500 coins)</button></div>
        <div class="row"><input id="leyq" value="${A.esc(q)}" placeholder="Search the weave" style="flex:1;min-height:36px;font-size:14px"/><button data-a="search">Find</button></div>
        <div id="leyweb" style="position:relative;height:380px;overflow:hidden;touch-action:none;background:#12141a;border:1px solid #3a3020;border-radius:8px">
          <div id="leyinner" style="position:absolute;width:1200px;height:1200px;transform-origin:0 0">${nodes}</div>
        </div>
        <p><small>Filled ${s.nodes.length} · pinch or drag to move, +/− to zoom. ${KEYSTONES.filter(k => A.leyKey(k.id)).map(k => k.name).join(' · ') || 'No keystone yet.'}</small></p>` : ''}`;
  }, act: (a, d) => {
    if (a === 'start') A.leyPickStart(d.k);
    if (a === 'fill') A.leyFill(d.k);
    if (a === 'rec') recOn = !recOn;
    if (a === 'zin') view.k = Math.min(1.8, view.k * 1.15);
    if (a === 'zout') view.k = Math.max(0.35, view.k / 1.15);
    if (a === 'reset') { view = { x: 150, y: 190, k: 0.72 }; }
    if (a === 'refund') A.leyRefund();
    if (a === 'search') { const inp = document.getElementById('leyq'); q = (inp && inp.value) || ''; }
  } });

  A.vtests = A.vtests || {};
  A.vtests.leyweave = async (g, A) => {
    const s = S(), snap = JSON.parse(JSON.stringify(s));
    const lat = g.player.adapt && g.player.adapt.lattice ? JSON.parse(JSON.stringify(g.player.adapt.lattice)) : null;
    const bump = ['Attack','Strength','Defence','Hitpoints','Prayer'];
    const oldSk = Object.fromEntries(bump.map(k => [k, { level: A.skills[k].level, xp: A.skills[k].xp }]));
    const gold = g.player.gold;
    try {
      if (WEB.nodes.length < 80) return 'web too small ' + WEB.nodes.length;
      if (!FIRST_KEY || KEY_PATH.length < 2) return 'no key path';
      for (const k of bump) A.skills[k].level = 1000;
      if (!A.leyOpen()) return 'closed at 1000';
      s.ley = 200; s.spent = 0; s.nodes = []; s.start = null;
      if (!A.leyPickStart('wanderer')) return 'start';
      if (!s.nodes.includes('start')) return 'no heart';
      for (const id of KEY_PATH) {
        if (s.nodes.includes(id)) continue;
        if (!A.leyFill(id)) return 'fill ' + id;
      }
      if (!A.leyKey(FIRST_KEY.key)) return 'keystone not on ' + FIRST_KEY.key;
      const spent = s.spent;
      g.player.gold = Math.max(g.player.gold, 500);
      if (!A.leyRefund()) return 'refund';
      if (s.nodes.length) return 'nodes left';
      if (s.start) return 'start left';
      if (s.ley < Math.floor(spent * 0.7)) return 'ley refund short';
      if (lat) {
        const now = JSON.stringify(g.player.adapt.lattice);
        if (now !== JSON.stringify(lat)) return 'lattice changed';
      }
      return true;
    } finally {
      for (const k of bump) { A.skills[k].level = oldSk[k].level; A.skills[k].xp = oldSk[k].xp; } g.player.gold = gold;
      Object.keys(s).forEach(k => delete s[k]); Object.assign(s, snap);
      if (lat && g.player.adapt) g.player.adapt.lattice = lat;
    }
  };
}
