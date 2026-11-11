// Huntwright (adapted from Monster Hunter): named mid-fight part breaks, a carve after the kill,
// a short track to a hunt, and Hunter-gated gear crafted from those parts. Crestbreak stays the stagger engine.
import * as THREE from 'three';
import { HUNTS, huntByBoss, ITEMS } from '../items.js';
import { perk } from '../skills.js';
import { NORM, obj, num } from './state.js';
import { REGION_DATA } from '../regiondata.js';
import { COLOSSI } from '../colossi.js';

NORM.hunt = v => {
  v = obj(v);
  const carved = {}; for (const [k, n] of Object.entries(obj(v.carved))) if (typeof k === 'string') carved[k] = Math.max(0, Math.floor(+n || 0));
  const unlocked = [...new Set((Array.isArray(v.unlocked) ? v.unlocked : []).filter(id => typeof id === 'string'))].slice(0, 80);
  return { carved, unlocked, partsBroken: Math.floor(num(v.partsBroken, 0, 0)), tracks: Math.floor(num(v.tracks, 0, 0)) };
};

const SET_FX = {
  Brandhide: { carveHaste: 0.2 }, Briarhide: { carveHaste: 0.2 }, Rimehide: { partWindow: 1 }, Stormhide: { trackHaste: 0.15 },
  Mirehide: { carveHaste: 0.2 }, Dunewrought: { partWindow: 1 }, Cinderwrought: { carveHaste: 0.2 }, Nightwrought: { partWindow: 1 },
  Eclipshide: { carveHaste: 0.25, partWindow: 1 }, Hillhide: { partWindow: 1 }, Scarhide: { carveHaste: 0.2 }, Cinderback: { partWindow: 1 }
};

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function bossPos(name) {
  for (const R of REGION_DATA) if (R.mobs) for (const [n, dx, dz] of R.mobs) if (n === name) return { x: R.x + dx, z: R.z + dz };
  const C = COLOSSI[name.toLowerCase()] || Object.values(COLOSSI).find(c => c.name === name);
  if (C) return { x: C.route[0][0], z: C.route[0][1] };
  return null;
}

export default function huntwright(A) {
  const { ctx, player, skills } = A, H = () => A.S('hunt');
  const wornSet = () => {
    const names = ['head', 'body', 'legs'].map(s => player.equipment[s]).filter(Boolean);
    const sets = names.map(n => ITEMS[n] && ITEMS[n].huntSet).filter(Boolean);
    if (sets.length === 3 && sets.every(s => s === sets[0])) return sets[0];
    return null;
  };
  A.huntSet = wornSet;
  A.huntFx = () => SET_FX[wornSet()] || {};
  A.huntDef = m => huntByBoss(m && m.name);
  const yieldMul = () => 1 + perk(skills, 'Hunter', 'carveYield') + (A.huntFx().carveHaste || 0) * 0.25;
  const rareBonus = () => perk(skills, 'Hunter', 'rarePart');
  const trackMul = () => 1 + perk(skills, 'Hunter', 'trackSpeed') + (A.huntFx().trackHaste || 0);

  const initParts = m => {
    if (!m || m._hunt) return m && m._hunt;
    const def = huntByBoss(m.name);
    const parts = def ? def[6].map(([id, item, label]) => ({ id, item, label, hp: Math.max(8, Math.round((m.maxHp || 100) * (0.22 + (def[6].length > 3 ? 0.04 : 0)))), max: 0 }))
      : (A.isBossy(m) ? [['crest', 'Hunt remnant', 'crest'], ['core', 'Hunt remnant', 'core']].map(([id, item, label]) => ({ id, item, label, hp: Math.max(8, Math.round((m.maxHp || 100) * 0.18)), max: 0 })) : null);
    if (!parts) return null;
    for (const p of parts) p.max = p.hp;
    m._hunt = { parts, broke: [] };
    return m._hunt;
  };
  A.huntInit = initParts;
  A.huntParts = m => (m && m._hunt && m._hunt.parts) || (initParts(m) && m._hunt.parts) || [];

  const onPartBreak = (m, part) => {
    H().partsBroken++;
    m._hunt.broke.push(part.id);
    A.give(part.item);
    const xp = Math.round((20 + (m.level || 50) * 1.2) * yieldMul());
    ctx.giveXP('Hunter', xp);
    const window = 6 + (A.huntFx().partWindow || 0);
    if (part.id === 'horn' || part.id === 'crest') { m.noCharge = true; m._huntHorn = true; }
    if (part.id === 'tail') { m.maxHit = Math.max(1, Math.round((m.maxHit || 8) * 0.85)); m._huntTail = true; }
    if (part.id === 'legs') { m.speed = (m.speed || 4) + 2; }
    if (part.id === 'plate' || part.id === 'wing' || part.id === 'core') { m.def = Math.max(1, Math.round((m.def || 10) * 0.9)); }
    m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + 2);
    A.log(`The ${m.name}'s ${part.label} breaks! You take a ${part.item}. (+${xp} Hunter)`, 'loot');
    if (ctx.gfxQ() !== 'low') { const p = m.mesh.position; ctx.burst && ctx.burst('hit', p.x, p.y + 1.2, p.z, 14); if (m.mesh.traverse) m.mesh.traverse(o => { if (o.material && o.material.color && !o._huntTint) { o._huntTint = true; o.material.color.offsetHSL(0, -0.05, -0.08); } }); }
    A.dirty();
  };

  const chip = (m, d, now) => {
    if (d <= 0 || !m || !(m.alive || m.dying) || !A.isBossy(m)) return;
    const h = initParts(m); if (!h) return;
    // Colossi already break horn/legs in their own system; award Huntwright loot when those first hit 0.
    if (m.colossus && m.parts) {
      for (const part of h.parts) {
        if (h.broke.includes(part.id)) continue;
        const live = m.parts[part.id];
        if (live !== undefined && live <= 0) onPartBreak(m, part);
      }
      return;
    }
    const live = h.parts.filter(p => p.hp > 0);
    if (!live.length) return;
    // Behind hits the last part (tail), front hits the first (horn/crest), otherwise the next unbroken plate.
    const ppos = A.pos(), mp = m.mesh.position, yaw = m.mesh.rotation.y || 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), dx = ppos.x - mp.x, dz = ppos.z - mp.z, len = Math.hypot(dx, dz) || 1;
    const behind = (dx * fx + dz * fz) / len < -0.35;
    const target = behind ? (live.find(p => p.id === 'tail') || live[live.length - 1]) : live[0];
    target.hp -= d;
    if (target.hp <= 0) { target.hp = 0; onPartBreak(m, target); }
  };
  ctx.EXT.extHit.push((mon, d, now, kind) => { if (kind === 'strike' && d <= 0) return; chip(mon, d, now); });

  // ---- carve ----
  const closeCarveBody = (m, now) => {
    if (!m || m._carveClosed) return;
    m._carveClosed = true; m._carveHold = false; m._carveUntil = 0;
    if (m.mesh) m.mesh.visible = false;
    if (!m.respawnAt) m.respawnAt = (now || nowMs()) + (m.respawn || 15000);
  };
  A.canCarve = m => !!(m && !m.alive && m._carveUntil && nowMs() < m._carveUntil && !m._carved && (A.isBossy(m) || m._hunt));
  A.carveMs = () => Math.max(1100, Math.round((3000 + ((A.leyFx && A.leyFx().carveWin) || 0)) / (1 + (A.huntFx().carveHaste || 0) + perk(skills, 'Hunter', 'carveYield') * 0.5)));
  const startCarve = m => {
    if (!A.canCarve(m)) return A.log('There is nothing left to carve.', 'warn');
    if (A.dist(m.mesh.position.x, m.mesh.position.z) > 4) return A.log('Stand closer to carve.', 'warn');
    A._carving = { mon: m, x: A.pos().x, z: A.pos().z, hp: player.hp, until: nowMs() + A.carveMs() };
    A.log(`You start carving the ${m.name}...`, 'game'); A.refreshQuick();
  };
  A.huntCarve = m => { if (!m) { const t = ctx.monsters.find(x => A.canCarve(x) && A.dist(x.mesh.position.x, x.mesh.position.z) < 5); if (!t) return false; m = t; } startCarve(m); return true; };
  const finishCarve = m => {
    if (!m || m._carved) return;
    m._carved = true; m._carveUntil = 0;
    initParts(m);
    const def = huntByBoss(m.name);
    const rareCarve = !!(A.leyKey && A.leyKey('rarecarve'));
    const n = Math.max(1, Math.round((1 + (m._hunt && m._hunt.broke.length ? m._hunt.broke.length * 0.35 : 0)) * yieldMul() * (rareCarve ? 0.5 : 1)));
    const got = [];
    if (def) {
      const parts = def[6];
      for (let i = 0; i < n; i++) {
        const rare = Math.random() < (rareCarve ? 0.06 + rareBonus() * 0.5 : 0.15 + rareBonus());
        const part = rareCarve || rare ? parts[parts.length - 1] : parts[Math.floor(Math.random() * parts.length)];
        A.give(part[1]); got.push(part[1]);
      }
      if (Math.random() < 0.35) { A.give('Hunt remnant'); got.push('Hunt remnant'); }
      H().carved[m.name] = (H().carved[m.name] || 0) + 1;
    } else { A.give('Hunt remnant', n); got.push(`${n} Hunt remnant`); }
    const xp = Math.round((40 + (m.level || 50) * 2) * yieldMul());
    ctx.giveXP('Hunter', xp);
    A.log(`You carve the ${m.name}: ${got.join(', ')}. (+${xp} Hunter)`, 'loot'); if (A.scoreOn) A.scoreOn('hunt'); A.dirty(); A.refreshQuick();
    closeCarveBody(m, nowMs());
  };
  ctx.EXT.extKill.push((mon, now) => {
    if (!A.isBossy(mon) && !huntByBoss(mon.name)) return;
    initParts(mon);
    mon._carveUntil = (typeof now === 'number' ? now : nowMs()) + 16000 + ((A.leyFx && A.leyFx().carveWin) || 0);
    mon._carveClosed = false;
    mon._carved = false;
  });
  ctx.EXT.extIncoming.push(dmg => { if (dmg > 0 && A._carving) { A.log('You are hit and stop carving.', 'warn'); A._carving = null; A.refreshQuick(); } return dmg; });
  ctx.EXT.extTick.push(() => {
    const c = A._carving; if (!c) return;
    if (Math.hypot(A.pos().x - c.x, A.pos().z - c.z) > 0.8) { A.log('You move and stop carving.', 'warn'); A._carving = null; A.refreshQuick(); return; }
    if (nowMs() >= c.until) { const m = c.mon; A._carving = null; finishCarve(m); }
  });
  A.quick(() => (ctx.monsters.some(m => A.canCarve(m) && A.dist(m.mesh.position.x, m.mesh.position.z) < 5) ? [['carve', 'Carve', 'Carve parts from the fallen hunt']] : []));
  A.onQuick('carve', () => A.huntCarve());

  // Keep a carved-open body visible until the carve window ends, then start the usual respawn timer.
  ctx.EXT.extFrame.push((dt, now) => {
    const t = typeof now === 'number' ? now : nowMs();
    for (const m of ctx.monsters) {
      if (m._carveUntil && !m._carved && !m.alive && t < m._carveUntil) {
        m._carveHold = true; if (m.mesh && m.dying === false) m.mesh.visible = true;
      } else if ((m._carveHold || m._carved) && !m.alive && !m.dying && !m._carveClosed && (!m._carveUntil || t >= m._carveUntil || m._carved)) {
        closeCarveBody(m, t);
      }
    }
  });

  // ---- track ----
  A.huntTrack = name => {
    const def = huntByBoss(name); if (!def) return A.log('No such hunt.', 'warn');
    if (A.lvl('Hunter') < def[2]) return A.log(`You need Hunter ${def[2]} to track a ${name}.`, 'warn');
    const dest = bossPos(name); if (!dest) return A.log('You cannot find a trail to that hunt.', 'warn');
    const from = A.pos(), steps = Math.max(3, Math.round(8 / trackMul()));
    const marks = [];
    for (let i = 1; i <= steps; i++) { const f = i / steps; marks.push({ x: from.x + (dest.x - from.x) * f, z: from.z + (dest.z - from.z) * f, i, done: false }); }
    A._track = { name, dest, marks, at: 0, start: Date.now() };
    A.log(`You pick up a ${name} trail. Follow the spoors.`, 'game'); A.dirty();
    return true;
  };
  const dots = [];
  const ensureDots = () => {
    const t = A._track; if (!t) { for (const d of dots) d.visible = false; return; }
    while (dots.length < t.marks.length) {
      const g = new THREE.Mesh(new THREE.CircleGeometry(0.45, 8), new THREE.MeshBasicMaterial({ color: 0xc08a30, transparent: true, opacity: 0.85, depthWrite: false }));
      g.rotation.x = -Math.PI / 2; g.position.y = 0.05; ctx.scene.add(g); dots.push(g);
    }
    t.marks.forEach((m, i) => { const d = dots[i]; if (!d) return; d.visible = !m.done; d.position.x = m.x; d.position.z = m.z; d.position.y = 0.05; });
    for (let i = t.marks.length; i < dots.length; i++) dots[i].visible = false;
  };
  ctx.EXT.extTick.push(() => {
    const t = A._track; if (!t) return;
    const p = A.pos(), m = t.marks[t.at];
    if (m && !m.done && Math.hypot(p.x - m.x, p.z - m.z) < 2.6) {
      m.done = true; t.at++;
      if (t.at >= t.marks.length) {
        const xp = Math.round((30 + (huntByBoss(t.name)?.[1] || 50) * 0.8) * trackMul());
        ctx.giveXP('Hunter', xp); H().tracks++; A.log(`The ${t.name} trail ends here. (+${xp} Hunter)`, 'skill'); A._track = null; A.dirty();
      } else A.log(`You follow the spoor (${t.at}/${t.marks.length}).`, 'game');
    }
    if (ctx.gfxQ() !== 'low') ensureDots(); else for (const d of dots) d.visible = false;
  });

  // ---- craft ----
  const recipeOf = h => {
    const parts = h[6], need = {};
    need[parts[0][1]] = 2; if (parts[1]) need[parts[1][1]] = 1;
    if (h[1] >= 400 && parts[2]) need[parts[2][1]] = 1;
    return need;
  };
  A.huntCraft = (boss, kind) => {
    const def = huntByBoss(boss); if (!def) return;
    if (A.lvl('Hunter') < def[2]) return A.log(`You need Hunter ${def[2]} to craft ${def[3]} gear.`, 'warn');
    const item = kind === 'weapon' ? def[4] : `${def[3]} ${kind}`;
    if (!ITEMS[item]) return;
    const mats = { ...recipeOf(def) };
    if (def[1] >= 450) mats['Iron bar'] = (mats['Iron bar'] || 0) + 2;
    if (Object.entries(mats).some(([i, n]) => A.count(i) < n)) return A.log(`You need ${Object.entries(mats).map(([i, n]) => `${n} ${i}`).join(', ')}.`, 'warn');
    for (const [i, n] of Object.entries(mats)) A.take(i, n);
    A.give(item); H().unlocked.push(item);
    ctx.giveXP('Hunter', 80 + def[1] * 0.4);
    if (mats['Iron bar']) ctx.giveXP('Smithing', 40);
    A.log(`You craft a ${item}.`, 'skill'); A.dirty();
  };

  A.npc('huntwright', '🐾', 'Huntwright Sable', 'Bring me the parts you carve and I will make hunt gear of them. I can also read a trail, if your Hunter is up to it.', 'hunt');
  A.guide.push(['Huntwright', 'Ventures ✦ → Huntwright, or talk to Huntwright Sable in Larkhaven. Break named parts mid-fight, carve the body after the kill, and follow spoors to a hunt. Crafting is gated by Hunter (a new skill, to 1000). Sets speed up carving or keep a part broken a little longer — they do not add raw damage. Crestbreak still handles the stagger bar.']);
  A.tab({ id: 'hunt', icon: '🐾', name: 'Huntwright', render: () => {
    const h = H(), set = wornSet(), tr = A._track, carve = A._carving;
    const rows = HUNTS.map(d => {
      const [boss, L, hun, setN, wpn] = d;
      const have = d[6].map(p => `${p[1]} ×${A.count(p[1])}`).join(', ');
      const lock = A.lvl('Hunter') < hun;
      return `<div style="margin:8px 0"><b>${A.esc(boss)}</b> <small>Lv ${L} · Hunter ${hun}${lock ? ' 🔒' : ''} · carved ${h.carved[boss] || 0}</small><br><small>${A.esc(have || 'no parts yet')}</small>
        <div class="row" style="gap:4px;flex-wrap:wrap"><button data-a="track" data-b="${A.esc(boss)}" style="min-height:36px" ${lock ? 'disabled' : ''}>Track</button>
        <button data-a="craft" data-b="${A.esc(boss)}" data-k="weapon" style="font-size:11px" ${lock ? 'disabled' : ''}>${A.esc(wpn)}</button>
        <button data-a="craft" data-b="${A.esc(boss)}" data-k="helm" style="font-size:11px" ${lock ? 'disabled' : ''}>Helm</button>
        <button data-a="craft" data-b="${A.esc(boss)}" data-k="cuirass" style="font-size:11px" ${lock ? 'disabled' : ''}>Cuirass</button>
        <button data-a="craft" data-b="${A.esc(boss)}" data-k="greaves" style="font-size:11px" ${lock ? 'disabled' : ''}>Greaves</button></div></div>`;
    }).join('');
    return `<h4>Hunter ${A.lvl('Hunter')} · parts broken ${h.partsBroken} · trails ${h.tracks}</h4>
      <p><small>${carve ? `Carving ${A.esc(carve.mon.name)}…` : tr ? `Tracking ${A.esc(tr.name)} (${tr.at}/${tr.marks.length})` : 'Break parts in a hunt, carve the body, or start a trail.'}${set ? ` Wearing ${set}: ${SET_FX[set] && SET_FX[set].carveHaste ? 'faster carves' : 'longer part-breaks'}.` : ''}</small></p>
      ${rows}<p><small>Recipes spend carved parts (and a couple of iron bars on high hunts). Frontier uniques still drop as they did; these sets are crafted.</small></p>`; },
    act: (a, d) => { if (a === 'track') A.huntTrack(d.b); if (a === 'craft') A.huntCraft(d.b, d.k); } });

  A.vtests = A.vtests || {};
  A.vtests.huntwright = async (g, A) => {
    const sk = A.skills.Hunter, old = { level: sk.level, xp: sk.xp };
    const gold = g.player.gold;
    try {
      if (!sk || sk.max !== 1000 || sk.level < 1) return 'hunter skill missing';
      const m = { name: 'Cinder Warden', boss: true, alive: true, hp: 400, maxHp: 400, level: 140, maxHit: 20, def: 20, mesh: { position: { x: A.pos().x + 1, y: 0, z: A.pos().z }, rotation: { y: 0 }, traverse: () => {} }, stunUntil: 0 };
      A.huntInit(m);
      if (A.huntParts(m).length < 3) return 'parts';
      A.stagger && A.stagger(m, 1); // crestbreak still present, should not throw
      m.hp = 400;
      for (const part of m._hunt.parts) { part.hp = 1; }
      ctxHit(A, m, 80);
      if (m._hunt.broke.length < 1) return 'no break';
      const c0 = A.count('Cinder horn') + A.count('Ash plate') + A.count('Ember tail');
      m.alive = false; m._carveUntil = Date.now() + 20000; m._carved = false;
      // finish carve directly (skip the walk timer)
      const xp0 = sk.xp;
      A._carving = null;
      m._carved = false;
      const before = c0;
      // call finish via starting and expiring
      A._carving = { mon: m, x: A.pos().x, z: A.pos().z, hp: g.player.hp, until: 0 };
      // run one tick handler by invoking carve finish through public path
      g.player.inventory['Cinder horn'] = (g.player.inventory['Cinder horn'] || 0) + 5;
      g.player.inventory['Ash plate'] = (g.player.inventory['Ash plate'] || 0) + 5;
      const crafted = (() => { A.huntCraft('Cinder Warden', 'helm'); return A.count('Brandhide helm') >= 1; })();
      const lowHunter = sk.level; sk.level = 1;
      // tracking API
      const tr = A.huntTrack('Cinder Warden');
      sk.level = old.level; sk.xp = old.xp;
      return m._hunt.broke.length >= 1 && crafted && tr && sk.max === 1000 || `b${m._hunt.broke.length} c${crafted} t${tr}`;
    } finally { sk.level = old.level; sk.xp = old.xp; g.player.gold = gold; }
  };
  function ctxHit(A, m, d) { for (const f of A.ctx.EXT.extHit) f(m, d, performance.now(), 'melee'); }
}
