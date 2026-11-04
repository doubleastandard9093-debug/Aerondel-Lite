// Shared instanced zones for Ventures (Breach Runs, Vigil Gates, Hearthhold): flat 28×28 pads far west (x = -1000).
import * as THREE from 'three';
import { MONSTER_TYPES } from '../gameplay.js';
import { VENTURE_ZONES, VENTURE_HALF, instanceAt, inInstance } from '../instances.js';
export default function zone(A) {
  const { ctx, player } = A, built = {}, pool = [];
  A.zoneC = id => ({ x: -1000, z: VENTURE_ZONES.find(v => v.id === id).z });
  A.zoneBuild = (id, color = 0x3a3a46, edge = 0x6a5a8a) => {
    if (built[id]) return built[id]; const c = A.zoneC(id), g = new THREE.Group(); g.name = 'venture-' + id;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(VENTURE_HALF * 2, VENTURE_HALF * 2), new THREE.MeshLambertMaterial({ color })); fl.rotation.x = -Math.PI / 2; fl.position.y = 0.02; g.add(fl);
    const wm = new THREE.MeshLambertMaterial({ color: edge });
    for (const [w, d, x, z] of [[VENTURE_HALF * 2, 0.6, 0, -VENTURE_HALF], [VENTURE_HALF * 2, 0.6, 0, VENTURE_HALF], [0.6, VENTURE_HALF * 2, -VENTURE_HALF, 0], [0.6, VENTURE_HALF * 2, VENTURE_HALF, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), wm); m.position.set(x, 0.8, z); g.add(m); }
    g.position.set(c.x, 0, c.z); ctx.scene.add(g); return (built[id] = { g, c, props: [] });
  };
  // A pickable prop inside a zone ("Use" talks via extTalk[ext]).
  A.zoneProp = (id, dx, dz, geo, color, data) => { const Z = A.zoneBuild(id), m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 })); const x = Z.c.x + dx, z = Z.c.z + dz;
    m.position.set(x, (geo.parameters && geo.parameters.height || 1) / 2, z); ctx.scene.add(m); const e = Object.assign({ mesh: m, alive: true, x, z, radius: 1.8, type: 'hearth' }, data); m.userData.entity = e; ctx.pickables.push(m); ctx.nodes.push(e); Z.props.push(e); return e; };
  A.zonePropRemove = e => { e.alive = false; e.mesh.visible = false; const i = ctx.pickables.indexOf(e.mesh); if (i >= 0) ctx.pickables.splice(i, 1); const j = ctx.nodes.indexOf(e); if (j >= 0) ctx.nodes.splice(j, 1); ctx.scene.remove(e.mesh); };
  A.cap = (n) => Math.min(n, ctx.gfxQ() === 'low' ? 8 : 15);
  A.vLevel = () => Math.max(10, Math.round((A.lvl('Attack') + A.lvl('Strength') + A.lvl('Defence') + A.lvl('Hitpoints') + Math.max(A.lvl('Ranged'), A.lvl('Magic'), A.lvl('Swordsmanship'))) / 5));
  A.zoneSpawn = (id, type, dx, dz, L, extra = {}) => {
    const c = A.zoneC(id), x = c.x + dx, z = c.z + dz, h = VENTURE_HALF - 1, bounds = { minX: c.x - h, maxX: c.x + h, minZ: c.z - h, maxZ: c.z + h };
    let m = pool.find(q => q.ventureType === type && !q.alive && !q.dying);
    if (!m) { m = ctx.spawnMonster(type, x, z, 2, bounds); m.ventureType = type; pool.push(m); }
    const T = MONSTER_TYPES[type], k = Math.max(0.2, L / T.level);
    Object.assign(m, { name: T.name, title: T.title, level: Math.round(L), hp: Math.round(T.hp * k), maxHp: Math.round(T.hp * k), maxHit: Math.max(3, Math.round(T.maxHit * Math.sqrt(k))), att: Math.max(1, Math.round(T.att * k)), def: Math.max(1, Math.round(T.def * k)),
      alive: true, dying: false, state: 'fight', nextAttackTick: A.tick() + 3, respawnAt: 0, respawn: 1e12, spawnX: x, spawnZ: z, bounds, stunUntil: 0, venom: null, venture: id, boss: false, vigil: false, ...extra });
    if (extra.hpMul) { m.maxHp = m.hp = Math.round(m.hp * extra.hpMul); }
    m.mesh.visible = true; m.mesh.rotation.set(0, 0, 0); m.mesh.position.set(x, 0, z); return m;
  };
  A.zoneAlive = id => pool.filter(m => m.alive && m.venture === id);
  A.zonePark = id => { for (const m of pool) if (m.venture === id) { m.alive = false; m.dying = false; m.state = 'dead'; m.respawnAt = 0; m.venture = null; m.mesh.visible = false; } ctx.stopAction(); };
  // One run at a time across all Ventures zones; leaving the pad or dying ends it.
  A.run = null;
  A.runStart = (id, run) => { if (A.run || ctx.EXT.dungeonRun) { A.log('Finish what you are doing first.', 'warn'); return false; }
    A.zoneBuild(id); if (!inInstance(A.pos().x)) player.instanceReturn = { x: A.pos().x, z: A.pos().z };
    A.run = { id, start: Date.now(), ...run }; ctx.EXT.dungeonRun = { kind: id, end: win => A.runEnd(win) }; const c = A.zoneC(id); ctx.travelTo(c.x, c.z + VENTURE_HALF - 3); A.dirty(); return true; };
  A.runEnd = (win) => { const r = A.run; if (!r) return; A.run = null; ctx.EXT.dungeonRun = null; try { r.end && r.end(win, r); } catch (e) { console.warn(e); }
    A.zonePark(r.id); for (const e of [...(built[r.id] ? built[r.id].props : [])]) if (e.temp) A.zonePropRemove(e); if (built[r.id]) built[r.id].props = built[r.id].props.filter(e => !e.temp);
    const back = player.instanceReturn || { x: 0, z: 10 }; if (!r.stay) setTimeout(() => { if (!A.run && instanceAt(A.pos().x, A.pos().z) === 'venture') { player.instanceReturn = null; ctx.travelTo(back.x, back.z); } }, win ? 1500 : 10); A.dirty(); };
  ctx.EXT.extDeath.push(() => { if (A.run) A.runEnd(false); });
  ctx.EXT.extTick.push(() => { const r = A.run; if (!r) return; const p = A.pos(); if (instanceAt(p.x, p.z) !== 'venture' || Math.abs(p.z - A.zoneC(r.id).z) > VENTURE_HALF + 2) { if (++r.away > 3) A.runEnd(false); return; } r.away = 0; if (r.tick) r.tick(r); });
  // Safety: standing on a Ventures pad with no run (e.g. after a reload) sends you home.
  A.every(5, () => { const p = A.pos(); if (!A.run && !ctx.EXT.dungeonRun && instanceAt(p.x, p.z) === 'venture' && !(A.holdHome && A.holdHome())) { const b = player.instanceReturn || { x: 0, z: 10 }; player.instanceReturn = null; ctx.travelTo(b.x, b.z); } });
}
