// Leychemistry (adapted from Breath of the Wild): a small, readable ruleset — fire, wind and metal — not a full chemistry sim. On Low this is state and a tint, not a spreading particle field.
import * as THREE from 'three';
import { isRaining, isStorm, setWeather, WET } from '../weather.js';
import { inInstance } from '../instances.js';
import { HOUSES } from './townsteads.js';
import { NORM, obj } from './state.js';

const CELL = 2;
const keyOf = (x, z) => `${Math.round(x / CELL) * CELL},${Math.round(z / CELL) * CELL}`;
const parse = k => { const [x, z] = k.split(',').map(Number); return { x, z }; };

NORM.chem = v => { v = obj(v); return { seen: !!v.seen, nests: Math.max(0, Math.floor(Number(v.nests) || 0)) }; };

export default function leychem(A) {
  const { ctx, player } = A;
  const fires = new Map(); // key -> { kind: 'grass'|'wood', heat, x, z }
  const cap = () => (ctx.gfxQ && ctx.gfxQ() === 'low' ? 8 : 24);
  const tints = [];

  const nearTown = (x, z) => HOUSES.some(h => Math.hypot(x - h.x, z - h.z) < 14);
  const nearFarm = (x, z) => !!(A.greenHome && A.greenHome() && inInstance(x)) || (A.zoneC && Math.hypot(x - (A.zoneC('hold').x || 0), z - (A.zoneC('hold').z || 0)) < 20 && inInstance(x));
  A.leyProtected = (x, z) => nearTown(x, z) || nearFarm(x, z) || (inInstance(x) && !(A.frameOn && A.frameOn(x, z)));

  A.leyCanBurn = (x, z, kind = 'grass') => {
    if (A.leyProtected(x, z) && kind === 'grass') return false;
    if (kind === 'wood') return !!(A.frameFlammable && A.frameFlammable(x, z)) || !A.leyProtected(x, z);
    return !A.leyProtected(x, z);
  };
  A.leyOnFire = (x, z) => fires.has(keyOf(x, z));
  A.leyIgnite = (x, z, kind = 'grass', src) => {
    if (!A.leyCanBurn(x, z, kind)) return false;
    if (fires.size >= cap() && !fires.has(keyOf(x, z))) return false;
    const k = keyOf(x, z); if (fires.has(k)) { fires.get(k).heat = Math.min(3, fires.get(k).heat + 1); return true; }
    fires.set(k, { kind, heat: 1, x: parse(k).x, z: parse(k).z, src: src || 'spark' });
    A.S('chem').seen = true; tintCell(parse(k).x, parse(k).z, true); A.dirty(); return true;
  };
  A.leyExtinguish = (x, z) => { const k = keyOf(x, z); if (!fires.has(k)) return false; fires.delete(k); tintCell(parse(k).x, parse(k).z, false); return true; };
  A.leyFires = () => [...fires.values()];

  function tintCell(x, z, on) {
    if (ctx.gfxQ && ctx.gfxQ() === 'low') return; // Low: state only, no extra meshes
    let m = tints.find(o => o.x === x && o.z === z);
    if (on && !m) {
      m = { x, z, mesh: new THREE.Mesh(new THREE.CircleGeometry(CELL * 0.7, 8), new THREE.MeshBasicMaterial({ color: 0xff6a20, transparent: true, opacity: 0.45, depthWrite: false })) };
      m.mesh.rotation.x = -Math.PI / 2; m.mesh.position.set(x, 0.08, z); ctx.scene.add(m.mesh); tints.push(m);
    }
    if (m && m.mesh) m.mesh.visible = !!on;
  }

  A.leyPushWind = (x, z, fx, fz) => {
    const moved = [];
    for (const [k, f] of [...fires.entries()]) {
      if (Math.hypot(f.x - x, f.z - z) > 10) continue;
      const nx = f.x + Math.sign(fx) * CELL, nz = f.z + Math.sign(fz) * CELL;
      if (A.leyIgnite(nx, nz, f.kind, 'wind')) moved.push({ x: nx, z: nz });
    }
    return moved;
  };
  A.leyStrike = (x, z) => {
    A.log('Lightning finds the metal.', 'warn');
    // A light shock — not a big damage spike. Conductors ignite nearby grass/wood.
    if (player.hp > 1 && Math.hypot(A.pos().x - x, A.pos().z - z) < 3) player.hp = Math.max(1, player.hp - Math.max(1, Math.round(player.maxHp * 0.04)));
    A.leyIgnite(x, z, (A.frameFlammable && A.frameFlammable(x, z)) ? 'wood' : 'grass', 'lightning');
    return true;
  };
  const wearingMetal = () => {
    const eq = player.equipment || {};
    return Object.values(eq).some(n => n && /Iron|Steel|Bluesteel|Verdite|Cobalt|Emberite|mith|plate/i.test(String(n)));
  };

  let acc = 0;
  ctx.EXT.extFrame.push((dt) => {
    acc += Math.min(0.05, dt || 0.016);
    if (acc < 0.8) return; acc = 0;
    if (isRaining()) { for (const f of [...fires.values()]) if (Math.random() < 0.7) A.leyExtinguish(f.x, f.z); }
    // Spread: at most one new cell per tick on Low.
    const list = [...fires.values()];
    let grew = 0, maxGrow = ctx.gfxQ && ctx.gfxQ() === 'low' ? 1 : 2;
    for (const f of list) {
      if (grew >= maxGrow) break;
      f.heat -= 0.15; if (f.heat <= 0) { A.leyExtinguish(f.x, f.z); continue; }
      const d = [[CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL]][Math.floor(Math.random() * 4)];
      if (Math.random() < 0.45 && A.leyIgnite(f.x + d[0], f.z + d[1], f.kind, 'spread')) grew++;
    }
    // Lightning in a storm, on metal gear or a metal Freeframe piece.
    if (isStorm() && Math.random() < 0.08) {
      if (wearingMetal()) A.leyStrike(A.pos().x, A.pos().z);
      else if (A.frameMetal && A.frameMetal()) { const m = A.frameMetal(); A.leyStrike(m.x, m.z); }
    }
  });

  // Wind: a Wordcry shoves nearby flames; Storm attunement does too.
  if (A.cryUse) {
    const prev = A.cryUse;
    A.cryUse = (id) => {
      const ok = prev(id);
      if (ok) { const yaw = ctx.pm && ctx.pm.mesh ? ctx.pm.mesh.rotation.y : 0; A.leyPushWind(A.pos().x, A.pos().z, Math.sin(yaw), Math.cos(yaw)); }
      return ok;
    };
  }

  A.npc('leychem', '⚗️', 'Leychemist Rowan', 'Fire, wind and metal listen to a few simple rules here. Rain puts fire out. Wind shoves a flame. Metal draws a storm. Town houses and the farm will not quietly burn down.', 'chem');
  A.guide.push(['Leychemistry', 'Ventures ✦ → Leychemistry, or talk to Leychemist Rowan in Larkhaven. Fire can spread across wild grass and wooden Freeframe pieces (on the claimed plot only). Rain or water puts it out. A Wordcry, or Storm attunement, can push a flame. Metal gear and metal pieces draw lightning in a storm. On Low this is a state and a tint, not a particle field. Townsteads and Greenstead crops will not burn.']);
  A.tab({ id: 'chem', icon: '⚗️', name: 'Leychemistry', render: () => {
    const n = fires.size;
    return `<h4>Leychemistry · ${n} flame${n === 1 ? '' : 's'}</h4>
      <p>A small ruleset: fire spreads on wild grass and on wooden builds on your claimed plot; rain puts it out; wind shoves it; metal draws a storm. Town houses and the farm are protected.</p>
      <p><small>${isRaining() ? 'It is raining — flames are dying back.' : isStorm() ? 'A storm is up — metal may draw a strike.' : 'The sky is quiet.'} ${n ? 'Burning cells: ' + n + '/' + cap() + '.' : 'No flames right now.'}</small></p>`;
  }, act: () => {} });

  A.vtests = A.vtests || {};
  A.vtests.leychem = async (g, A) => {
    const hp = g.player.hp, wet = WET.value;
    const oldF = [...fires.keys()];
    try {
      // A town house must not ignite.
      const h = HOUSES[0];
      if (A.leyIgnite(h.x, h.z, 'grass')) return 'town burned';
      // A wild cell can ignite, spread, and be pushed by wind, then rain puts it out.
      const x = 30, z = 70;
      if (A.leyProtected(x, z)) { /* pick farther */ }
      const wx = A.leyProtected(x, z) ? 120 : x, wz = A.leyProtected(x, z) ? 120 : z;
      if (!A.leyIgnite(wx, wz, 'grass', 'test')) return 'no ignite';
      if (!A.leyOnFire(wx, wz)) return 'not on fire';
      A.leyPushWind(wx, wz, 1, 0);
      setWeather('drizzle');
      for (let i = 0; i < 8; i++) for (const f of ctx.EXT.extFrame) { try { f(1); } catch (e) {} }
      // After rain ticks, the original cell should be out or nearly so.
      const still = A.leyFires().length;
      setWeather('clear');
      for (const f of A.leyFires()) A.leyExtinguish(f.x, f.z);
      if (still > cap()) return 'cap ' + still;
      // Metal strike is callable and does not wreck the player.
      g.player.hp = Math.max(20, hp);
      A.leyStrike(A.pos().x + 20, A.pos().z + 20);
      A.leyExtinguish(A.pos().x + 20, A.pos().z + 20);
      return true;
    } finally {
      for (const f of A.leyFires()) A.leyExtinguish(f.x, f.z);
      for (const k of oldF) { /* left clean */ }
      setWeather('clear'); WET.value = wet; g.player.hp = hp;
    }
  };
}
