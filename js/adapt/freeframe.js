// Freeframe (adapted from Valheim): piece-by-piece building with a support rule, only on a claimed wild plot. This is the main Construction grind. Not a Townstead and not Greenstead.
import * as THREE from 'three';
import { terrainHeight, colliders } from '../world.js';
import { perk } from '../skills.js';
import { NORM, obj, arr, num } from './state.js';

export const PLOT = { name: 'Claimridge', x: 22, z: 78, half: 12 };
const GRID = 1.5;
const KINDS = {
  foundation: { name: 'Foundation', mats: { Logs: 4 }, xp: 28, hp: 40, wood: true, support: true, tier: 'wood', lvl: 1 },
  wall:       { name: 'Wall',       mats: { Logs: 3 }, xp: 22, hp: 28, wood: true,  tier: 'wood', lvl: 1 },
  floor:      { name: 'Floor',      mats: { Logs: 3 }, xp: 22, hp: 24, wood: true,  tier: 'wood', lvl: 1 },
  roof:       { name: 'Roof',       mats: { Logs: 3, 'Soft leather': 1 }, xp: 26, hp: 20, wood: true, thatch: true, tier: 'thatch', lvl: 10 },
  palisade:   { name: 'Palisade',   mats: { Logs: 5 }, xp: 30, hp: 36, wood: true,  tier: 'wood', lvl: 20 },
  stonewall:  { name: 'Stone wall', mats: { 'Stone slab': 2, Logs: 1 }, xp: 36, hp: 50, tier: 'stone', lvl: 40 },
  plate:      { name: 'Reinforced plate', mats: { 'Iron bar': 2, 'Stone slab': 1 }, xp: 48, hp: 70, metal: true, tier: 'reinforced', lvl: 70 }
};
const DEED_GOLD = 3000;
const gxOf = x => Math.round((x - PLOT.x) / GRID);
const gzOf = z => Math.round((z - PLOT.z) / GRID);
const worldX = gx => PLOT.x + gx * GRID;
const worldZ = gz => PLOT.z + gz * GRID;
const inPlot = (x, z) => Math.abs(x - PLOT.x) <= PLOT.half && Math.abs(z - PLOT.z) <= PLOT.half;

NORM.frame = v => {
  v = obj(v);
  const pieces = arr(v.pieces).filter(p => p && KINDS[p.kind]).map(p => ({
    id: String(p.id || ''), kind: p.kind, gx: Math.floor(num(p.gx, 0, -20, 20)), gz: Math.floor(num(p.gz, 0, -20, 20)),
    rot: Math.floor(num(p.rot, 0, 0, 3)), hp: Math.max(0, Math.floor(num(p.hp, KINDS[p.kind].hp, 0))),
    tier: KINDS[p.kind].tier
  })).slice(0, 80);
  return { deed: !!v.deed, pieces, nextId: Math.max(1, Math.floor(num(v.nextId, 1, 1))) };
};

export default function freeframe(A) {
  const { ctx, player } = A;
  const F = () => A.S('frame');
  const cap = () => Math.min(ctx.gfxQ && ctx.gfxQ() === 'low' ? 28 : 48, 20 + Math.floor(A.lvl('Construction') / 40) + (perk(A.skills, 'Construction', 'pieceCap') || 0));
  const range = () => 3 + (perk(A.skills, 'Construction', 'supportRange') || 0) * 8;
  const meshes = new Map();
  const boxes = new Map();
  const baseY = () => terrainHeight(PLOT.x, PLOT.z);

  const spend = rec => {
    if (Object.entries(rec).some(([i, n]) => A.count(i) < n)) return `You need ${Object.entries(rec).map(([i, n]) => `${n} ${i}`).join(', ')}.`;
    for (const [i, n] of Object.entries(rec)) A.take(i, n); return null;
  };
  const at = (gx, gz) => F().pieces.filter(p => p.gx === gx && p.gz === gz);
  const supported = () => {
    const r = range(), have = new Set(), q = [];
    for (const p of F().pieces) if (KINDS[p.kind].support) { const k = p.gx + ',' + p.gz; if (!have.has(k)) { have.add(k); q.push([p.gx, p.gz, 0]); } }
    while (q.length) {
      const [x, z, d] = q.shift(); if (d >= r) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
        if (have.has(k)) continue;
        if (at(nx, nz).length) { have.add(k); q.push([nx, nz, d + 1]); }
      }
    }
    return have;
  };

  const dropMesh = id => {
    const m = meshes.get(id); if (m) { ctx.scene.remove(m); m.traverse(o => { if (o.geometry) o.geometry.dispose(); }); meshes.delete(id); }
    const b = boxes.get(id); if (b) { const i = colliders.indexOf(b); if (i >= 0) colliders.splice(i, 1); boxes.delete(id); }
  };
  const show = p => {
    dropMesh(p.id);
    const def = KINDS[p.kind], y = baseY();
    const color = def.metal ? 0x8a8a96 : def.tier === 'stone' ? 0x7a7a72 : def.thatch ? 0xc8a050 : 0x8a5a2a;
    const h = p.kind === 'foundation' || p.kind === 'floor' ? 0.4 : p.kind === 'roof' ? 0.5 : 1.6;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(GRID * 0.95, h, GRID * 0.95), new THREE.MeshLambertMaterial({ color }));
    mesh.position.set(worldX(p.gx), y + h / 2, worldZ(p.gz));
    if (A.leyOnFire && A.leyOnFire(worldX(p.gx), worldZ(p.gz))) mesh.material.color.setHex(0xc24a12);
    ctx.scene.add(mesh); meshes.set(p.id, mesh);
    const box = { minX: worldX(p.gx) - 0.7, maxX: worldX(p.gx) + 0.7, minZ: worldZ(p.gz) - 0.7, maxZ: worldZ(p.gz) + 0.7, frame: p.id };
    colliders.push(box); boxes.set(p.id, box);
  };
  const rebuild = () => { for (const p of F().pieces) if (!meshes.has(p.id)) show(p); };

  A.frameOn = (x, z) => inPlot(x, z) && F().deed;
  A.frameHome = () => { const p = A.pos(); return F().deed && inPlot(p.x, p.z); };
  A.frameFlammable = (x, z) => {
    const gx = gxOf(x), gz = gzOf(z);
    return at(gx, gz).some(p => KINDS[p.kind].wood || KINDS[p.kind].thatch);
  };
  A.frameMetal = () => {
    const p = F().pieces.find(q => KINDS[q.kind].metal);
    return p ? { x: worldX(p.gx), z: worldZ(p.gz) } : null;
  };
  A.frameClaimed = () => !!F().deed;
  A.framePieces = () => F().pieces;
  A.frameDamage = (x, z, n) => {
    const p = at(gxOf(x), gzOf(z))[0]; if (!p) return false;
    p.hp = Math.max(0, p.hp - n);
    if (p.hp <= 0) A.frameRemove(p.id, 'It gives way.');
    else if (meshes.get(p.id)) meshes.get(p.id).material.color.offsetHSL(0, 0, -0.05);
    return true;
  };

  A.frameBuy = () => {
    if (F().deed) return A.log('You already hold the Claimridge deed.', 'game'), true;
    if ((player.gold || 0) < DEED_GOLD) return A.log(`The Claimridge deed costs ${DEED_GOLD} coins.`, 'warn'), false;
    player.gold -= DEED_GOLD;
    F().deed = true;
    A.log('You claim Claimridge, a wild plot north of Larkhaven. Build here — not in town, not on the farm. Buying the deed does not train Construction; placing pieces does.', 'skill');
    A.dirty(); A.refreshQuick && A.refreshQuick(); return true;
  };
  A.framePlace = (kind, gx, gz) => {
    const def = KINDS[kind]; if (!def) return false;
    if (!F().deed) return A.log('Claim the wild plot first.', 'warn'), false;
    if (A.lvl('Construction') < def.lvl) return A.log(`You need Construction ${def.lvl} to place a ${def.name}.`, 'warn'), false;
    if (Math.abs(gx * GRID) > PLOT.half || Math.abs(gz * GRID) > PLOT.half) return A.log('That is outside the claimed plot.', 'warn'), false;
    if (F().pieces.length >= cap()) return A.log(`The plot holds ${cap()} pieces at your Construction.`, 'warn'), false;
    if (at(gx, gz).some(p => p.kind === kind)) return A.log('That cell already has one.', 'warn'), false;
    if (kind !== 'foundation' && !F().pieces.some(p => KINDS[p.kind].support && Math.abs(p.gx - gx) + Math.abs(p.gz - gz) <= 1)) return A.log('Place a foundation, then build out from it.', 'warn'), false;
    const err = spend(def.mats); if (err) return A.log(err, 'warn'), false;
    const id = 'p' + F().nextId++;
    const hp = Math.round(def.hp * (1 + (perk(A.skills, 'Construction', 'pieceHp') || 0)));
    const piece = { id, kind, gx, gz, rot: 0, hp, tier: def.tier };
    F().pieces.push(piece); show(piece);
    ctx.giveXP('Construction', def.xp);
    A.log(`You raise a ${def.name}. (+${def.xp} Construction)`, 'skill'); A.dirty(); return id;
  };
  A.frameRemove = (id, why) => {
    const i = F().pieces.findIndex(p => p.id === id); if (i < 0) return false;
    const p = F().pieces[i]; F().pieces.splice(i, 1); dropMesh(id);
    if (why) A.log(`${KINDS[p.kind].name}: ${why}`, 'warn');
    A.frameSettle(); A.dirty(); return true;
  };
  A.frameSettle = () => {
    const have = supported();
    const falling = F().pieces.filter(p => !KINDS[p.kind].support && !have.has(p.gx + ',' + p.gz));
    for (const p of falling) { A.log(`A ${KINDS[p.kind].name} loses its support and comes down.`, 'warn'); dropMesh(p.id); }
    F().pieces = F().pieces.filter(p => KINDS[p.kind].support || have.has(p.gx + ',' + p.gz));
  };
  A.frameRepair = id => {
    const p = F().pieces.find(q => q.id === id); if (!p) return false;
    const def = KINDS[p.kind], need = Math.max(1, Math.ceil((def.hp - p.hp) / 20));
    const mat = Object.keys(def.mats)[0];
    if (A.count(mat) < 1) return A.log(`You need ${mat} to repair that.`, 'warn'), false;
    A.take(mat, 1);
    const heal = Math.round(14 * (1 + (perk(A.skills, 'Construction', 'repairSpeed') || 0)));
    p.hp = Math.min(def.hp, p.hp + heal);
    ctx.giveXP('Construction', 10);
    A.log(`You repair the ${def.name}. (+10 Construction)`, 'skill'); show(p); A.dirty(); return true;
  };
  A.frameGo = () => { if (!F().deed && !A.frameBuy()) return; ctx.travelTo(PLOT.x, PLOT.z + 2); };
  A.every && A.every(8, () => { if (F().deed) rebuild(); });

  A.npc('freeframe', '🪵', 'Plotwarden Tess', 'Claimridge is a wild plot north of town. Claim it, then build piece by piece — foundations first. If you cut the support, the rest comes down. This is not a town house and not the farm.', 'frame');
  A.guide.push(['Freeframe', `Ventures ✦ → Freeframe, or talk to Plotwarden Tess in Larkhaven. Claim Claimridge (a wild plot at ${PLOT.x}, ${PLOT.z}) and build wood, thatch, stone, then reinforced pieces, gated by Construction. Pieces need a path to a foundation or they fall. Building, upgrading and repairing train Construction and are the main way to take it toward 1000. Wooden pieces can burn (Leychemistry); the fire stays on this plot. Town houses and Greenstead are not for freeform walls.`]);
  A.quick(() => (A.frameHome() ? [['frame', 'Freeframe', 'Build on your claimed plot']] : []));
  A.onQuick('frame', () => A.open('frame'));
  A.tab({ id: 'frame', icon: '🪵', name: 'Freeframe', render: () => {
    const f = F();
    if (!f.deed) return `<h4>Claimridge</h4><p>A wild plot north of Larkhaven for freeform building. Town houses are storage; the farm is for growing. The deed is ${DEED_GOLD} coins and does not train Construction — placing pieces does.</p><div class="row"><button data-a="buy" style="min-height:44px">Claim the plot (${DEED_GOLD} coins)</button></div>`;
    const list = f.pieces.map(p => `<div class="row" style="margin:4px 0"><small>${KINDS[p.kind].name} (${p.gx},${p.gz}) · ${p.hp} hp</small><button data-a="fix" data-i="${p.id}">Repair</button><button data-a="cut" data-i="${p.id}">Dismantle</button></div>`).join('') || '<p><small>No pieces yet. Place a foundation first.</small></p>';
    const btns = Object.entries(KINDS).map(([k, d]) => `<button data-a="put" data-k="${k}" style="font-size:11px;min-height:36px">${d.name}</button>`).join('');
    return `<h4>Claimridge · ${f.pieces.length}/${cap()} pieces · Construction ${A.lvl('Construction')}</h4>
      <p>Foundations first, then build out. Cut a foundation and unsupported pieces fall. Repair after a raid or a fire.</p>
      <div class="row"><button data-a="go" style="min-height:40px">Go to the plot</button></div>
      <h4>Place (next empty cell beside a foundation)</h4><div class="row" style="flex-wrap:wrap;gap:4px">${btns}</div>${list}`;
  }, act: (a, d) => {
    if (a === 'buy') A.frameBuy();
    if (a === 'go') { A.frameGo(); A.close && A.close(); }
    if (a === 'put') {
      const fnds = F().pieces.filter(p => KINDS[p.kind].support);
      let gx = 0, gz = 0;
      if (!fnds.length && d.k === 'foundation') { gx = 0; gz = 0; }
      else if (fnds.length) {
        const roots = fnds[fnds.length - 1];
        const slot = [[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0], [0, 2]].find(([dx, dz]) => !at(roots.gx + dx, roots.gz + dz).some(p => p.kind === d.k));
        gx = roots.gx + (slot ? slot[0] : 1); gz = roots.gz + (slot ? slot[1] : 0);
        if (d.k === 'foundation' && at(gx, gz).some(p => p.kind === 'foundation')) { gx += 1; }
      } else return A.log('Place a foundation first.', 'warn');
      A.framePlace(d.k, gx, gz);
    }
    if (a === 'fix') A.frameRepair(d.i);
    if (a === 'cut') A.frameRemove(d.i, 'You take it down.');
  } });

  A.vtests = A.vtests || {};
  A.vtests.freeframe = async (g, A) => {
    const f = F(), prev = JSON.parse(JSON.stringify(f)), gold = g.player.gold, inv = { ...g.player.inventory };
    const con = { level: g.skills.Construction.level, xp: g.skills.Construction.xp };
    try {
      g.player.gold = Math.max(g.player.gold, DEED_GOLD + 10);
      g.player.inventory['Logs'] = (g.player.inventory['Logs'] || 0) + 40;
      g.player.inventory['Soft leather'] = (g.player.inventory['Soft leather'] || 0) + 4;
      g.skills.Construction.level = Math.max(g.skills.Construction.level, 1);
      if (!A.frameBuy()) return 'buy';
      if (!f.deed) return 'no deed';
      const xp0 = g.skills.Construction.xp;
      const fid = A.framePlace('foundation', 0, 0); if (!fid) return 'foundation';
      const wid = A.framePlace('wall', 1, 0); if (!wid) return 'wall';
      if (g.skills.Construction.xp <= xp0) return 'no construction xp';
      if (f.pieces.length < 2) return 'pieces missing';
      // Cutting the foundation should drop the unsupported wall.
      A.frameRemove(fid, 'test cut');
      if (f.pieces.some(p => p.id === wid)) return 'unsupported wall stayed';
      // Town / farm are not this plot.
      if (A.frameOn(13, -6)) return 'town marked as plot';
      // Wooden cell is flammable once rebuilt.
      const f2 = A.framePlace('foundation', 0, 0); const w2 = A.framePlace('wall', 1, 0);
      if (!(A.frameFlammable(worldX(1), worldZ(0)))) return 'not flammable';
      if (A.leyIgnite) { A.leyIgnite(worldX(1), worldZ(0), 'wood', 'test'); A.leyExtinguish && A.leyExtinguish(worldX(1), worldZ(0)); }
      return true;
    } finally {
      for (const p of (F().pieces || []).slice()) A.frameRemove(p.id);
      Object.keys(f).forEach(k => delete f[k]); Object.assign(f, prev);
      for (const p of (f.pieces || [])) show(p);
      g.player.gold = gold; g.player.inventory = inv;
      g.skills.Construction.level = con.level; g.skills.Construction.xp = con.xp;
    }
  };
}
