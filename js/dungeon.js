// Shared procedural dungeon builder for Relicry relic dungeons and Delving floors.
// Rooms sit on a grid in instance space (x < -700, z > 300; see instances.js 'dungeon'). Each layout is a main
// path (start -> ... -> boss) plus optional side rooms. Every link between rooms is a short corridor with a door
// slot; the caller decides what each door is (skill gate, key door, open arch).
// Geometry is a handful of shared-material boxes; walls are colliders (removed again on dispose).
import * as THREE from 'three';
import { makeRng } from './rng.js';
import { colliders } from './world.js';
import { DUNGEON_BOX } from './instances.js';

export const DUNGEON_ORIGIN = { relic: { x: -1500, z: 560 }, delve: { x: -1500, z: 1100 } };
export const ROOM = 16, GAP = 6, STEP = ROOM + GAP, WALL_H = 3.4;
const DIRS = [[0, 1], [1, 0], [-1, 0], [0, -1]];

// n main rooms, b side rooms. Returns { rooms: [{ i, gx, gz, main, depth, parent }], links: [{ a, b }] }.
export function genLayout(seed, n, b = 0) {
  const rng = makeRng(seed >>> 0 || 1);
  for (let attempt = 0; attempt < 40; attempt++) {
    const rooms = [{ i: 0, gx: 0, gz: 0, main: true, depth: 0, parent: -1 }], links = [], used = new Set(['0,0']);
    let ok = true;
    for (let k = 1; k < n && ok; k++) {
      const p = rooms[k - 1], opts = DIRS.filter(([dx, dz]) => !used.has(`${p.gx + dx},${p.gz + dz}`) && p.gz + dz >= 0);
      if (!opts.length) { ok = false; break; }
      // prefer heading "south" (+z) so the floor reads as a descent
      const [dx, dz] = rng() < 0.5 && opts.some(o => o[1] === 1) ? [0, 1] : opts[Math.floor(rng() * opts.length)];
      const r = { i: k, gx: p.gx + dx, gz: p.gz + dz, main: true, depth: k, parent: k - 1 };
      rooms.push(r); used.add(`${r.gx},${r.gz}`); links.push({ a: k - 1, b: k });
    }
    if (!ok) continue;
    for (let k = 0; k < b; k++) {
      for (let t = 0; t < 20; t++) {
        const p = rooms[1 + Math.floor(rng() * Math.max(1, n - 2))]; if (!p) break;
        const [dx, dz] = DIRS[Math.floor(rng() * 4)], gx = p.gx + dx, gz = p.gz + dz;
        if (gz < 0 || used.has(`${gx},${gz}`)) continue;
        const r = { i: rooms.length, gx, gz, main: false, depth: p.depth, parent: p.i };
        rooms.push(r); used.add(`${gx},${gz}`); links.push({ a: p.i, b: r.i }); break;
      }
    }
    return { rooms, links, rng };
  }
  throw new Error('dungeon layout failed');
}

const _mats = {};
const mat = (c, emissive = 0) => (_mats[c + ':' + emissive] ||= Object.assign(new THREE.MeshLambertMaterial({ color: c, emissive, emissiveIntensity: emissive ? 1 : 0 }), { userData: { shared: true } }));
const BOXG = new THREE.BoxGeometry(1, 1, 1);

// Build the layout at an origin. theme: { floor, wall, accent }. Returns handles; call dispose() on exit.
export function buildDungeon(scene, layout, origin, theme, { lite = false } = {}) {
  const G = new THREE.Group(); G.name = 'dungeon'; scene.add(G);
  const own = [];
  const solid = (x, z, w, d) => { const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, dungeon: true }; colliders.push(c); own.push(c); return c; };
  const box = (x, y, z, w, h, d, m) => { const o = new THREE.Mesh(BOXG, m); o.position.set(x, y, z); o.scale.set(w, h, d); o.receiveShadow = true; G.add(o); return o; };
  const fm = mat(theme.floor), wm = mat(theme.wall), am = mat(theme.accent || 0x8a6a3a, lite ? 0 : (theme.glow || 0));
  const roomPos = r => ({ x: origin.x + r.gx * STEP, z: origin.z + r.gz * STEP });
  const rooms = layout.rooms.map(r => ({ ...r, ...roomPos(r) }));
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  // which sides of a room have an opening
  const open = rooms.map(() => ({}));
  const doors = [];
  for (const L of layout.links) {
    const A = rooms[L.a], B = rooms[L.b], dx = Math.sign(B.gx - A.gx), dz = Math.sign(B.gz - A.gz);
    open[L.a][`${dx},${dz}`] = true; open[L.b][`${-dx},${-dz}`] = true;
    const cx = (A.x + B.x) / 2, cz = (A.z + B.z) / 2, along = dx !== 0;
    // corridor floor and side walls
    box(cx, -0.1, cz, along ? GAP + 0.2 : 3.4, 0.2, along ? 3.4 : GAP + 0.2, fm);
    for (const s of [-1, 1]) {
      const wx = along ? cx : cx + s * 2, wz = along ? cz + s * 2 : cz;
      box(wx, WALL_H / 2, wz, along ? GAP : 0.6, WALL_H, along ? 0.6 : GAP, wm); solid(wx, wz, along ? GAP : 0.6, along ? 0.6 : GAP);
    }
    doors.push({ a: L.a, b: L.b, x: cx, z: cz, along, link: L });
  }
  for (const [k, R] of rooms.entries()) {
    box(R.x, -0.1, R.z, ROOM, 0.2, ROOM, fm);
    const h = ROOM / 2;
    for (const [dx, dz] of DIRS) {
      const wx = R.x + dx * h, wz = R.z + dz * h, alongX = dz !== 0; // wall runs along x when it's a north/south wall
      if (open[k][`${dx},${dz}`]) {
        const seg = (ROOM - 3.4) / 2;
        for (const s of [-1, 1]) {
          const ox = alongX ? s * (1.7 + seg / 2) : 0, oz = alongX ? 0 : s * (1.7 + seg / 2);
          box(wx + ox, WALL_H / 2, wz + oz, alongX ? seg : 0.6, WALL_H, alongX ? 0.6 : seg, wm); solid(wx + ox, wz + oz, alongX ? seg : 0.6, alongX ? 0.6 : seg);
        }
      } else { box(wx, WALL_H / 2, wz, alongX ? ROOM + 0.6 : 0.6, WALL_H, alongX ? 0.6 : ROOM + 0.6, wm); solid(wx, wz, alongX ? ROOM + 0.6 : 0.6, alongX ? 0.6 : ROOM + 0.6); }
    }
    // corner pillars with a cheap glowing cap (emissive only; no lights on Low)
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { box(R.x + px * (h - 1), 1.4, R.z + pz * (h - 1), 0.8, 2.8, 0.8, wm); box(R.x + px * (h - 1), 2.95, R.z + pz * (h - 1), 0.5, 0.3, 0.5, am); }
    minX = Math.min(minX, R.x - h); maxX = Math.max(maxX, R.x + h); minZ = Math.min(minZ, R.z - h); maxZ = Math.max(maxZ, R.z + h);
  }
  let light = null;
  if (!lite) { light = new THREE.PointLight(theme.glow || 0xffd8a0, 6, 26, 1.2); light.name = 'dungeon-light'; G.add(light); }
  DUNGEON_BOX.box = { minX: minX + 0.6, maxX: maxX - 0.6, minZ: minZ + 0.6, maxZ: maxZ - 0.6 };
  return {
    group: G, rooms, doors,
    roomBounds: R => ({ minX: R.x - ROOM / 2 + 1, maxX: R.x + ROOM / 2 - 1, minZ: R.z - ROOM / 2 + 1, maxZ: R.z + ROOM / 2 - 1 }),
    roomOf(x, z) { return rooms.find(R => Math.abs(x - R.x) <= ROOM / 2 && Math.abs(z - R.z) <= ROOM / 2) || null; },
    // A door slab across a corridor; returns { mesh, open() }.
    door(D, color, label) {
      const m = box(D.x, 1.3, D.z, D.along ? 0.5 : 3.4, 2.6, D.along ? 3.4 : 0.5, mat(color, lite ? 0 : color));
      m.material = mat(color, 0); m.name = label || 'door';
      const c = solid(D.x, D.z, D.along ? 0.5 : 3.4, D.along ? 3.4 : 0.5);
      return { mesh: m, open() { m.visible = false; const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); } };
    },
    prop(x, z, w, h, d, color, emissive = 0) { return box(x, h / 2, z, w, h, d, mat(color, lite ? 0 : emissive)); },
    follow(x, z) { if (light) light.position.set(x, 3, z); },
    dispose() {
      for (const c of own) { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); }
      scene.remove(G); DUNGEON_BOX.box = null;   // shared box geometry and cached materials are kept for the next run
    }
  };
}
