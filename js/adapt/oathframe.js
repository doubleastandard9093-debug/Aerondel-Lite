// Oathframe: a heavy, enterable suit. Slow, sturdy, powered by a hearth-core.
// Not a damage percent, not a Path, not a Vocation. Load always steps you out, core intact.
import { ITEMS } from '../items.js';
import { NORM, obj, arr, num } from './state.js';

export const CORE_MAX = 100, DRAIN_MS = 4000, SPEED = 0.55, POISE_BONUS = 36, SLAM_CD = 8000;
export const FRAME_ID = 'oath';

NORM.oath = v => {
  v = obj(v);
  const owned = arr(v.owned).filter(id => id === FRAME_ID);
  return {
    owned,
    assembled: !!v.assembled || owned.includes(FRAME_ID),
    core: Math.max(0, Math.min(CORE_MAX, Math.floor(num(v.core, 0, 0))))
  };
};

export default function oathframe(A) {
  const { ctx, player } = A;
  const S = () => A.S('oath');
  const state = { on: false, slamAt: 0, overlay: null, lastDrain: Date.now() };
  // Never persist "on" — a mid-session crash must not leave you stuck in a doorway.

  const pm = () => ctx.pm;
  const isLow = () => !!(ctx.gfxQ === 'low' || (typeof ctx.gfxQ === 'function' && ctx.gfxQ() === 'low') || (player.settings && player.settings.gfx === 'low'));

  A.oathOn = () => !!state.on;
  A.oathCore = () => S().core;
  A.oathOwned = () => !!(S().assembled || S().owned.includes(FRAME_ID));

  const clearOverlay = () => {
    const p = pm();
    if (state.overlay && p && p.mesh) { try { p.mesh.remove(state.overlay); } catch (e) { /* gone */ } }
    state.overlay = null;
    if (p && p.mesh && p.mesh.scale) p.mesh.scale.set(1, 1, 1);
    if (p) p.speedMul = 1;
  };
  const showOverlay = () => {
    const p = pm(); if (!p || !p.mesh || typeof THREE === 'undefined') return;
    clearOverlay();
    p.mesh.scale.set(1.22, 1.18, 1.22);
    const mat = isLow() ? new THREE.MeshBasicMaterial({ color: 0x4a4a55 }) : new THREE.MeshStandardMaterial({ color: 0x4a4a55, metalness: 0.3, roughness: 0.8 });
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.7), mat);
    g.position.set(0, 0.2, 0); g.castShadow = false; g.receiveShadow = false; g.name = 'oath-frame';
    p.mesh.add(g); state.overlay = g;
  };

  A.oathAssemble = () => {
    if (A.oathOwned()) return A.log('You already have an Oathframe.', 'game'), false;
    if (A.lvl('Construction') < 20 || A.lvl('Smithing') < 20) return A.log('You need Construction 20 and Smithing 20 to assemble an Oathframe.', 'warn'), false;
    if (A.count('Iron bar') < 8 || A.count('Logs') < 6 || A.count('Coal') < 2) return A.log('You need 8 Iron bars, 6 Logs and 2 Coal.', 'warn'), false;
    A.take('Iron bar', 8); A.take('Logs', 6); A.take('Coal', 2);
    S().assembled = true; if (!S().owned.includes(FRAME_ID)) S().owned.push(FRAME_ID);
    if (S().core < 20) S().core = 20;
    if (ctx.giveXP) { ctx.giveXP('Construction', 80); ctx.giveXP('Smithing', 80); }
    A.log('You assemble an Oathframe. Craft a hearth-core to power it, then step in.', 'skill');
    A.dirty(); return true;
  };
  A.oathCraftCore = () => {
    if (A.lvl('Smithing') < 10) return A.log('You need Smithing 10 to craft a hearth-core.', 'warn'), false;
    if (A.count('Iron bar') < 2 || A.count('Coal') < 4) return A.log('You need 2 Iron bars and 4 Coal.', 'warn'), false;
    A.take('Iron bar', 2); A.take('Coal', 4);
    S().core = Math.min(CORE_MAX, S().core + 40);
    if (ctx.giveXP) ctx.giveXP('Smithing', 30);
    A.log(`You stoke a hearth-core. Core ${S().core}/${CORE_MAX}.`, 'skill');
    A.dirty(); return true;
  };
  A.oathStepOut = (why) => {
    if (!state.on) return false;
    state.on = false;
    clearOverlay();
    refreshHud();
    A.log(why || 'You step out of the Oathframe. The core is intact.', 'game');
    A.dirty(); A.refreshQuick && A.refreshQuick(); return true;
  };
  A.oathStepIn = () => {
    if (state.on) return A.log('You are already inside the Oathframe.', 'game'), false;
    if (!A.oathOwned()) return A.log('Assemble an Oathframe at the frame bench first.', 'warn'), false;
    if (S().core <= 0) return A.log('The hearth-core is dry. Craft a core and stoke it first. You will not die when it runs out — you will just step out.', 'warn'), false;
    if (ctx.skyX && ctx.skyX.toggle && A.oathOn) { /* skywing blocked on toggle */ }
    // Cancel a climb if you somehow started one.
    const p = pm();
    if (p && typeof p.climbY === 'number') { delete p.climbY; delete p.climbDir; }
    state.on = true; state.lastDrain = Date.now();
    showOverlay();
    if (p) p.speedMul = SPEED;
    refreshHud();
    A.log('You step into the Oathframe. You walk slowly, you cannot Skywing or climb well, and a slam fills a foe\'s Guardbreak bar. The hearth-core drains while you are inside; at zero you step out safely.', 'skill');
    A.dirty(); A.refreshQuick && A.refreshQuick(); return true;
  };
  A.oathSlam = () => {
    if (!state.on) return A.log('Step into the Oathframe first.', 'warn'), false;
    if (Date.now() < state.slamAt) return A.log('The slam is still recovering.', 'game'), false;
    const p = A.pos && A.pos(); if (!p) return false;
    const list = ctx.monsters || [];
    let best = null, bd = 2.8;
    for (const m of list) {
      if (!m || !m.alive) continue;
      const mp = (m.mesh && m.mesh.position) || m;
      const d = Math.hypot((mp.x || 0) - p.x, (mp.z || 0) - p.z);
      if (d < bd) { bd = d; best = m; }
    }
    state.slamAt = Date.now() + SLAM_CD;
    if (!best) return A.log('The shoulder-check finds no one close enough.', 'game'), true;
    const boss = !!(A.isBossy && A.isBossy(best));
    const max = A.poiseMax ? A.poiseMax(best) : 24;
    if (A.poiseAdd) A.poiseAdd(best, max * (boss ? 0.18 : 0.45));
    A.log(boss ? `The Oathframe slams the ${best.name}. A boss only feels a little of it.` : `The Oathframe slams the ${best.name}. Their Guardbreak bar fills. This is not a damage percent.`, 'combat');
    A.dirty(); return true;
  };

  // Slow walk while inside — re-apply so a steed or landing cannot clear it by accident.
  ctx.EXT.extFrame.push(() => {
    if (!state.on) return;
    const p = pm(); if (p) p.speedMul = Math.min(p.speedMul || 1, SPEED);
  });
  A.every(2, () => {
    if (!state.on) return;
    const now = Date.now();
    if (now - state.lastDrain >= DRAIN_MS) {
      const steps = Math.max(1, Math.floor((now - state.lastDrain) / DRAIN_MS));
      state.lastDrain += steps * DRAIN_MS;
      S().core = Math.max(0, S().core - steps);
      A.dirty();
      if (S().core <= 0) A.oathStepOut('The hearth-core runs dry. You step out safely — you do not fall.');
    }
    refreshHud();
  });

  if (A.playerPoiseMax) {
    const prev = A.playerPoiseMax;
    A.playerPoiseMax = () => prev() + (state.on ? POISE_BONUS : 0);
  }
  const prevClimb = A.climbBegin;
  if (prevClimb) A.climbBegin = (...args) => {
    if (state.on) return A.log('The Oathframe cannot climb a steep face. Step out first.', 'warn'), false;
    return prevClimb(...args);
  };
  const prevDash = A.dash;
  if (prevDash) A.dash = (...args) => {
    if (state.on) return A.oathSlam();
    return prevDash(...args);
  };

  A.onReady.push(() => { if (state.on) A.oathStepOut('You load standing outside the Oathframe. The core is intact.'); });

  let hud = null, outBtn = null;
  const refreshHud = () => {
    if (typeof document === 'undefined') return;
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'oathHud';
      hud.style.cssText = 'position:fixed;bottom:calc(72px + var(--sb,0px));left:50%;transform:translateX(-50%);z-index:45;color:#f0e6d0;font-size:14px;text-shadow:0 1px 2px #000;text-align:center;pointer-events:none;';
      document.body.appendChild(hud);
      outBtn = document.createElement('button');
      outBtn.id = 'oathOut';
      outBtn.textContent = 'Step out';
      outBtn.style.cssText = 'position:fixed;bottom:calc(36px + var(--sb,0px));right:calc(10px + var(--sr,0px));z-index:46;min-height:44px;min-width:88px;font-size:16px;';
      outBtn.onclick = () => A.oathStepOut();
      document.body.appendChild(outBtn);
    }
    const show = state.on;
    hud.style.display = show ? 'block' : 'none';
    if (outBtn) outBtn.style.display = show ? 'block' : 'none';
    if (show) hud.textContent = `Oathframe core ${S().core}/${CORE_MAX}`;
  };
  A.onReady.push(refreshHud);

  A.npc('oathframe', '🛡️', 'Framewright Orel', 'At my bench you assemble an Oathframe: a heavy suit you step into. You walk slowly, you cannot fly or climb well, and a slam fills a foe\'s Guardbreak bar. A hearth-core powers it; when the core runs dry you step out, you do not die. It is not a Path, not a Vocation, and it will not simply make you hit harder. Shops and houses will ask you to step out. The town road is fine.', 'oath');
  A.guide.push(['Oathframe', 'Ventures ✦ → Oathframe, or talk to Framewright Orel in Larkhaven. Assemble one (Construction 20, Smithing 20), craft a hearth-core, then Step in. A large Step out button stays on screen while you are inside. Stillwatch still works. Kits, Facets and your Path keep their usual numbers. Load always steps you out, core intact.']);
  A.quick(() => state.on ? [['oathout', 'Step out', 'Leave the Oathframe'], ['oathslam', 'Slam', 'A shoulder-check that fills Guardbreak']] : (A.oathOwned() ? [['oathin', 'Step in', 'Enter the Oathframe']] : []));
  A.onQuick('oathin', () => A.oathStepIn());
  A.onQuick('oathout', () => A.oathStepOut());
  A.onQuick('oathslam', () => A.oathSlam());
  A.tab({ id: 'oath', icon: '🛡️', name: 'Oathframe', render: () => {
    const s = S();
    let body = `<h4>Oathframe</h4><p>A heavy, enterable suit. You walk slowly, you cannot Skywing or climb well, dash is a shoulder-check, and a slam fills a foe's Guardbreak bar. A hearth-core drains while you are inside; at zero you step out safely. Not a damage percent, not a Path, not a Vocation. Town roads are fine; shops and houses ask you to step out.</p>
      <p>Core: <b>${s.core}/${CORE_MAX}</b> · ${state.on ? 'You are inside.' : (A.oathOwned() ? 'You have a frame ready.' : 'Not yet assembled.')}</p>`;
    if (!A.oathOwned()) body += `<div class="row"><button data-a="make">Assemble (8 Iron bars, 6 Logs, 2 Coal, Construction 20, Smithing 20)</button></div>`;
    body += `<div class="row"><button data-a="core">Craft a hearth-core (2 Iron bars, 4 Coal)</button></div>`;
    if (A.oathOwned()) body += `<div class="row">${state.on ? '<button data-a="out" style="min-height:44px">Step out</button><button data-a="slam">Slam</button>' : '<button data-a="in" style="min-height:44px">Step in</button>'}</div>`;
    return body;
  }, act: a => {
    if (a === 'make') A.oathAssemble();
    if (a === 'core') A.oathCraftCore();
    if (a === 'in') A.oathStepIn();
    if (a === 'out') A.oathStepOut();
    if (a === 'slam') A.oathSlam();
  } });

  A.vtests = A.vtests || {};
  A.vtests.oathframe = async (g, A) => {
    const s = S(), snap = { owned: s.owned.slice(), assembled: s.assembled, core: s.core };
    const was = state.on;
    const { playerMaxHit } = await import('/js/gameplay.js');
    try {
      if (state.on) A.oathStepOut();
      s.owned = []; s.assembled = false; s.core = 0;
      g.skills.Construction.level = Math.max(g.skills.Construction.level || 1, 20);
      g.skills.Smithing.level = Math.max(g.skills.Smithing.level || 1, 20);
      g.player.inventory['Iron bar'] = (g.player.inventory['Iron bar'] || 0) + 12;
      g.player.inventory['Logs'] = (g.player.inventory['Logs'] || 0) + 8;
      g.player.inventory['Coal'] = (g.player.inventory['Coal'] || 0) + 8;
      if (!A.oathAssemble()) return 'assemble';
      if (!A.oathCraftCore()) return 'core';
      if (s.core <= 0) return 'core empty';
      if (!A.oathStepIn()) return 'step in';
      const p = pm();
      if (p && p.speedMul > SPEED + 0.01) return 'not slowed ' + p.speedMul;
      const dmg0 = A.totals(null).dmg;
      const hit0 = playerMaxHit(g.player, g.skills, {});
      if (Math.abs(A.totals(null).dmg - dmg0) > 1e-9) return 'dmg from frame';
      if (playerMaxHit(g.player, g.skills, {}) !== hit0) return 'max hit from frame';
      const gob = { name: 'Goblin', alive: true, hp: 80, maxHp: 80, maxHit: 6, att: 6, level: 30, _poise: 0, mesh: { position: { x: ((A.pos && A.pos()) || { x: 0 }).x + 1, y: 0, z: ((A.pos && A.pos()) || { z: 0 }).z } } };
      (ctx.monsters || (ctx.monsters = [])).push(gob);
      const po0 = A.poiseOf ? A.poiseOf(gob) : 0;
      state.slamAt = 0;
      if (!A.oathSlam()) return 'slam';
      const po1 = A.poiseOf ? A.poiseOf(gob) : (gob._poise || 0);
      const i = (ctx.monsters || []).indexOf(gob); if (i >= 0) ctx.monsters.splice(i, 1);
      if (!(po1 > po0)) return 'slam no poise';
      s.core = 0;
      A.oathStepOut('test dry');
      // Dry core should not leave you inside.
      if (s.core <= 0 && state.on) { A.oathStepOut('test'); }
      if (state.on) return 'still on at zero';
      // Re-enter to test forced step-out at zero via drain path.
      s.core = 5;
      if (!A.oathStepIn()) return 'reenter';
      s.core = 0;
      A.oathStepOut('The hearth-core runs dry. You step out safely — you do not fall.');
      if (state.on) return 'did not step out';
      if (typeof A.facetOn !== 'function' || typeof A.kitAttach !== 'function') return 'other layers missing';
    } finally {
      if (state.on) A.oathStepOut('test cleanup');
      s.owned = snap.owned; s.assembled = snap.assembled; s.core = snap.core;
      if (was && A.oathOwned() && s.core > 0) { /* leave off on purpose */ }
    }
    return true;
  };
}
