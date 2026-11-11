// Ashfall: a solo, skippable, telegraphed Ley flare in a wild region.
// Not a Burst Tide, not a Warband Siege, never a strike on a town.
// Save key is `ash`, not `flare` — Overflare already owns player.adapt.flare.
import * as THREE from 'three';
import { REGION_DATA } from '../regiondata.js';
import { TOWNS } from '../world.js';
import { PLOT } from './freeframe.js';
import { NORM, obj, num } from './state.js';

export const DURATION_MS = 12 * 60 * 1000, WARN_MS = 3 * 60 * 1000;
export const CADENCE_MIN = 22 * 60 * 1000, CADENCE_SPAN = 12 * 60 * 1000;
export const MAIN_TOWNS = ['Larkhaven', 'Emberfold', 'Saltreach', 'Highcrest', 'Whitecairn'];
export const SWAP = { Wolf: 'Goblin', Goblin: 'Skeleton', Cow: 'Wolf', 'Giant Spider': 'Skeleton' };
export const TINT = 0x6a4a32;

NORM.ash = v => {
  v = obj(v);
  return {
    last: Math.max(0, Math.floor(num(v.last, 0, 0))),
    started: 0, // in-progress flares end safely on load; never resume mid-flare from a save
    seen: Math.max(0, Math.floor(num(v.seen, 0, 0))),
    next: Math.max(0, Math.floor(num(v.next, 0, 0)))
  };
};

export default function ashfall(A) {
  const { ctx, player } = A;
  const S = () => A.S('ash');
  const isLow = () => !!(ctx.gfxQ === 'low' || (typeof ctx.gfxQ === 'function' && ctx.gfxQ() === 'low') || (player.settings && player.settings.gfx === 'low'));
  const state = { offered: null, active: null, node: null, wyrm: false, fog0: null };

  const holdPad = (x, z) => {
    const hz = A.zoneC && A.zoneC('hold');
    return !!(hz && Math.abs(x + 1000) < 20 && Math.abs(z - hz.z) < 16);
  };
  A.ashForbidden = (x, z) => {
    for (const n of MAIN_TOWNS) {
      const t = TOWNS[n]; if (t && Math.hypot(x - t.x, z - t.z) < 16 + 8) return n;
    }
    if (holdPad(x, z)) return 'Greenstead';
    if (Math.abs(x - PLOT.x) <= PLOT.half && Math.abs(z - PLOT.z) <= PLOT.half) return 'Claimridge';
    return null;
  };
  const wildRegions = () => REGION_DATA.filter(R => !A.ashForbidden(R.x, R.z));
  const pickRegion = pref => pref || wildRegions().find(r => r.id === 'ashveil') || wildRegions()[0] || REGION_DATA[1];
  const inRegion = (R, x, z) => !!(R && Math.hypot(x - R.x, z - R.z) < (R.r || 40) + 8);

  A.ashOffered = () => !!state.offered;
  A.ashActive = () => !!state.active;
  A.ashRegion = () => (state.active && state.active.region) || (state.offered && state.offered.region) || null;
  A.ashSwapName = name => (state.active && SWAP[name]) || name;

  const clearNode = () => {
    const n = state.node; state.node = null;
    if (!n) return;
    n.alive = false;
    if (n.mesh) { n.mesh.visible = false; if (n.mesh.parent) n.mesh.parent.remove(n.mesh); }
    if (ctx.nodes) ctx.nodes = ctx.nodes.filter(x => x !== n);
  };
  const placeNode = (R) => {
    clearNode();
    const x = R.x + 6, z = R.z + 6;
    const mat = new THREE.MeshBasicMaterial({ color: 0xb08040 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat);
    mesh.position.set(x, 0.4, z);
    mesh.castShadow = false; mesh.receiveShadow = false;
    if (ctx.scene) ctx.scene.add(mesh);
    const node = { name: 'Ash crystal', type: 'ashcrystal', x, z, mesh, alive: true, ash: true, radius: 1.4 };
    mesh.userData.entity = node;
    if (ctx.nodes) ctx.nodes.push(node);
    state.node = node;
    return node;
  };
  A.ashGather = () => {
    if (!state.active || !state.node || !state.node.alive) return A.log('There is no Ash crystal to gather.', 'game'), false;
    const p = A.pos();
    if (Math.hypot(p.x - state.node.x, p.z - state.node.z) > 5) return A.log('Stand closer to the Ash crystal.', 'warn'), false;
    state.node.alive = false;
    A.give('Ash crystal', 1);
    A.log('You gather an Ash crystal from the flare.', 'loot');
    clearNode(); A.dirty(); return true;
  };

  const tintTick = () => {
    const scene = ctx.scene; if (!scene || !scene.fog || !scene.fog.color) return;
    const R = state.active && state.active.region;
    const p = A.pos && A.pos();
    const here = !!(R && p && inRegion(R, p.x, p.z));
    if (here) {
      scene.fog.color.lerp(new THREE.Color(TINT), isLow() ? 0.35 : 0.5);
      if (scene.background && scene.background.isColor) scene.background.copy(scene.fog.color);
    }
    // Larkhaven and other protected ground are never the flare target, so they keep their usual sky.
  };

  A.ashEnd = (why) => {
    const R = state.active && state.active.region;
    clearNode();
    state.active = null;
    state.offered = null;
    S().started = 0;
    S().last = Date.now();
    S().next = Date.now() + CADENCE_MIN + Math.random() * CADENCE_SPAN;
    if (R) A.log(why === 'load' ? 'The Ashfall faded while you were away. The region is ordinary again.' : `The Ashfall over ${R.name} fades. The region is ordinary again.`, 'game');
    A.dirty();
  };
  A.ashPass = () => {
    if (!state.offered) return false;
    const name = state.offered.region.name;
    state.offered = null;
    S().next = Date.now() + CADENCE_MIN * 0.5;
    A.log(`You let the Ashfall over ${name} pass. Nothing is owed.`, 'game');
    return true;
  };
  A.ashOffer = (pref) => {
    if (state.active || state.offered) return false;
    const R = pickRegion(pref);
    if (!R || A.ashForbidden(R.x, R.z)) return false;
    // Do not start a warning on top of a Burst Tide in the same region.
    const tideR = A.tideState && A.tideState.region;
    if (tideR && tideR.name === R.name) return false;
    state.offered = { region: R, at: Date.now(), until: Date.now() + WARN_MS };
    A.log(`An Ashfall is gathering over ${R.name}. You can begin it, or let it pass — you are not punished for leaving it.`, 'skill');
    return true;
  };
  A.ashBegin = (opts = {}) => {
    let R = (state.offered && state.offered.region) || opts.region;
    if (!R) {
      const pos = A.pos && A.pos();
      if (pos) {
        const why = A.ashForbidden(pos.x, pos.z);
        if (why) return A.log(`An Ashfall cannot settle on ${why}. Walk into the wilds first.`, 'warn'), false;
        R = wildRegions().find(r => inRegion(r, pos.x, pos.z));
      }
      if (!R) return A.log('Carve the totem in a wild region to call an Ashfall.', 'warn'), false;
    }
    if (!R || A.ashForbidden(R.x, R.z)) return A.log('An Ashfall cannot settle on a town, a Townstead, Greenstead or Claimridge.', 'warn'), false;
    const tideR = A.tideState && A.tideState.region;
    if (tideR && tideR.name === R.name) return A.log('A Burst Tide is already surging there. The Ashfall will not stack on it.', 'warn'), false;
    if (state.active) return A.log('An Ashfall is already burning in the wilds.', 'warn'), false;
    state.offered = null;
    state.active = { region: R, until: Date.now() + (opts.ms || DURATION_MS), wyrm: false };
    S().started = Date.now(); S().seen++; S().last = Date.now();
    placeNode(R);
    // Mark ordinary foes already in the region so a kill can leave a Wildmark chance.
    if (ctx.monsters) for (const m of ctx.monsters) {
      const mx = (m.mesh && m.mesh.position.x) || m.x || m.spawnX, mz = (m.mesh && m.mesh.position.z) || m.z || m.spawnZ;
      if (inRegion(R, mx, mz) && !A.isBossy?.(m) && !m.boss && !m.skywyrm) m._ashMarked = true;
    }
    // May attract a Skywyrm over the same wild region, at most one, never a town.
    if (A.wyrmOffer && !A.wyrmOffered?.() && !(A.wyrmActive && A.wyrmActive())) {
      try { if (A.wyrmOffer(R)) state.active.wyrm = true; } catch (e) { /* offer is optional */ }
    }
    A.log(`Ashfall over ${R.name} for about ${Math.round((opts.ms || DURATION_MS) / 60000)} minutes. Spawns shift, an Ash crystal may be gathered, and a Wildmark may settle after a marked foe. You can walk away.`, 'skill');
    A.dirty(); return true;
  };
  A.ashGo = () => {
    if (!state.offered) return A.log('No Ashfall is gathering right now.', 'game'), false;
    return A.ashBegin();
  };

  // A Burst Tide can still fire in another region; it is held if it would land on the Ashfall region.
  if (A.tideStart) {
    const prev = A.tideStart;
    A.tideStart = (reg) => {
      const ashR = state.active && state.active.region;
      if (ashR && (!reg || reg.name === ashR.name)) {
        const other = REGION_DATA.find(R => R !== ashR && !A.ashForbidden(R.x, R.z) && (!reg || R.name !== ashR.name));
        return prev(other || undefined);
      }
      return prev(reg);
    };
  }

  if (ctx.spawnMonster) {
    const prev = ctx.spawnMonster;
    ctx.spawnMonster = (type, x, z, ...rest) => {
      if (state.active && inRegion(state.active.region, x, z) && SWAP[type]) type = SWAP[type];
      const m = prev(type, x, z, ...rest);
      if (m && state.active && inRegion(state.active.region, x, z)) m._ashMarked = true;
      return m;
    };
  }

  ctx.EXT.extKill.push(m => {
    if (!state.active || !m || !m._ashMarked || !A.markGrant) return;
    if (Math.random() > 0.2) return;
    const opts = A.markList ? A.markList().map(x => x.id).filter(id => !A.markHas(id)) : [];
    if (!opts.length) return;
    A.markGrant(opts[Math.floor(Math.random() * opts.length)], 'a marked foe in an Ashfall');
  });

  ctx.EXT.extFrame.push(() => { if (state.active) tintTick(); });

  A.every(5, () => {
    const t = Date.now();
    if (!state.offered && !state.active && t > (S().next || 0)) A.ashOffer();
    if (state.offered && t > state.offered.until) A.ashPass();
    if (state.active && t > state.active.until) A.ashEnd('time');
  });

  // In-progress flares end safely on load (core intact, region ordinary).
  A.onReady.push(() => { if (S().started) A.ashEnd('load'); if (!S().next) S().next = Date.now() + CADENCE_MIN; });

  A.npc('ashfall', '☄️', 'Ashwatcher Bren', 'An Ashfall is a short Ley flare in the high wilds. You will get a warning: begin it, or let it pass — nothing is owed if you walk away. For a few minutes that wild region changes its spawns, may raise a Wildmark chance, may show an Ash crystal, and may attract a Skywyrm. It will not settle on a town, a Townstead, Greenstead or Claimridge. It is not a Burst Tide and not a siege. On a phone it is a sky tint and a spawn swap, not a blast. You can also carve an Ash-totem to call one when you are ready.', 'ash');
  A.guide.push(['Ashfall', 'Ventures ✦ → Ashfall, or talk to Ashwatcher Bren in Larkhaven. A warning appears when a Ley flare gathers over a wild region. Begin or let it pass. Towns, Townsteads, Greenstead and Claimridge are never the target. A Burst Tide can still fire in another region. Craft an Ash-totem to start one yourself. On Low: a sky tint and a spawn-table swap, no blast mesh and no extra lights.']);
  A.quick(() => state.active ? [['ash', '☄️Ashfall', `Ashfall: ${state.active.region.name} — ${Math.max(1, Math.ceil((state.active.until - Date.now()) / 60000))} min`]] : state.offered ? [['ash', '☄️Gathering', 'An Ashfall is gathering — Begin or Not now']] : []);
  A.onQuick('ash', () => A.open('ash'));

  A.tab({ id: 'ash', icon: '☄️', name: 'Ashfall', render: () => {
    let body = `<h4>Ashfall</h4><p>A skippable Ley flare in a wild region. Not a Burst Tide, not a siege, and never a strike on a town, a Townstead, Greenstead or Claimridge. On Low this is a sky tint and a spawn swap.</p>
      <p>Flares seen: <b>${S().seen}</b></p>`;
    if (state.active) body += `<p>Ashfall in <b>${A.esc(state.active.region.name)}</b> — ${Math.max(1, Math.ceil((state.active.until - Date.now()) / 60000))} minutes. You can walk away.</p>
      ${state.node && state.node.alive ? `<div class="row"><button data-a="gather" style="min-height:40px">Gather the Ash crystal</button></div>` : ''}`;
    else if (state.offered) body += `<p>An Ashfall is gathering over <b>${A.esc(state.offered.region.name)}</b>. Begin it, or let it pass. Nothing is owed if you leave it.</p>
      <div class="row"><button data-a="go" style="min-height:40px">Begin</button><button data-a="pass" style="min-height:40px">Not now</button></div>`;
    else body += `<p>No flare is gathering right now. Carve an Ash-totem (Construction) to call one in the wilds, or wait for a warning.</p>`;
    return body;
  }, act: a => { if (a === 'go') A.ashGo(); if (a === 'pass') A.ashPass(); if (a === 'gather') A.ashGather(); } });

  A.vtests = A.vtests || {};
  A.vtests.ashfall = async (g, A) => {
    const s = S();
    const snap = { last: s.last, started: s.started, seen: s.seen, next: s.next };
    const hadOff = state.offered, hadAct = state.active, hadNode = state.node;
    const p = A.pos(), o = [p.x, p.z];
    const tide0 = A.tideState ? { region: A.tideState.region, until: A.tideState.until, next: A.tideState.next, stacks: A.tideState.stacks } : null;
    try {
      if (state.offered) A.ashPass();
      if (state.active) A.ashEnd('test');
      s.started = 0;
      const wild = wildRegions().find(r => r.id === 'ashveil') || wildRegions()[0];
      if (!wild) return 'no wild region';
      if (A.ashForbidden(0, 0) !== 'Larkhaven') return 'larkhaven not protected';
      if (A.ashForbidden(PLOT.x, PLOT.z) !== 'Claimridge') return 'claimridge not protected';
      // Decline a warning: the region stays ordinary.
      if (!A.ashOffer(wild)) return 'offer';
      if (A.ashOffer(wild)) return 'second offer';
      if (!state.offered) return 'no offer state';
      if (state.active) return 'active on offer';
      A.ashPass();
      if (state.offered || state.active) return 'still running after pass';
      // Start one in the wilds.
      if (!A.ashOffer(wild)) return 'reoffer';
      if (!A.ashGo()) return 'begin';
      if (!state.active || state.active.region.name !== wild.name) return 'not active in wilds';
      if (!state.node || !state.node.alive) return 'no crystal node';
      if (A.ashSwapName('Wolf') !== 'Goblin') return 'spawn swap';
      // Larkhaven is untouched: forbidden, and the node is not there.
      if (A.ashForbidden(0, 0)) { /* ok */ }
      if (state.node && Math.hypot(state.node.x, state.node.z) < 20) return 'node in Larkhaven';
      // Claimridge cannot be the target.
      const claim = { name: 'Claimridge', x: PLOT.x, z: PLOT.z, r: PLOT.half };
      if (A.ashBegin({ region: claim })) { A.ashEnd('test'); return 'began on Claimridge'; }
      // A Tide can still fire in another region.
      if (A.tideStart && A.tideState) {
        const other = REGION_DATA.find(R => R.name !== wild.name);
        A.tideStart(wild); // should be redirected away from the ash region
        const landed = A.tideState.region;
        if (landed && landed.name === wild.name) return 'tide stacked on ashfall';
        if (other && !landed) {
          // redirected; if it returned undefined region that's also a failure
          return 'tide did not start elsewhere';
        }
        if (A.tideEnd) A.tideEnd();
        else { A.tideState.region = null; A.tideState.until = 0; }
      }
      // End safely, as load would.
      s.started = Date.now();
      A.ashEnd('load');
      if (state.active || s.started) return 'did not end on load';
      if (state.node) return 'node left behind';
      if (A.ashSwapName('Wolf') !== 'Wolf') return 'swap lingered';
    } finally {
      try { if (state.active) A.ashEnd('test'); } catch (e) {}
      state.offered = hadOff;
      if (hadAct) state.active = hadAct; else state.active = null;
      if (hadNode) state.node = hadNode;
      Object.assign(s, snap);
      p.x = o[0]; p.z = o[1];
      if (A.tideState && tide0) Object.assign(A.tideState, tide0);
    }
    return true;
  };
}
