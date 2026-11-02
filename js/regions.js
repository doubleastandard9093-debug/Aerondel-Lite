// Data-driven map regions, streamed by chunk.js.
//
// Adding a region is a data-only change: append an object to REGIONS below (or
// push one from a separate file and import it here). Nothing is built at
// startup; each prop is registered with its chunk and only constructed when the
// player comes within load range, then disposed again when far away, so a
// bigger map costs phones almost nothing until you visit it.
//
// Region shape:
// {
//   id: 'fernreach',             // unique, original name
//   name: 'Fernreach Hollow',    // shown on the world map
//   bounds: [minX, minZ, maxX, maxZ],  // world units; used for the map label and growing WORLD_HALF
//   props: [ ['tree', x, z, scale?, rotY?], ['rock', x, z, scale?], ... ],  // kinds: see KINDS
//   mobs:  [ ['Goblin', x, z, roam?], ... ],   // MONSTER_TYPES names; spawned once, paused when unloaded
// }
// Props with a collider (trees, rocks, crates, pillars, fences) block movement
// whether or not their chunk is loaded, so streaming never changes gameplay.
import * as THREE from 'three';
import { registerChunkObject } from './chunk.js';
import { terrainHeight, colliders, PATHS } from './world.js';
import { REGION_DATA, BIOMES } from './regiondata.js';
import { vcMat, bake, col, place, prim } from './models.js';
import { makeRng } from './rng.js';
import { VILLAGES } from './villagedata.js';
import { hasModel, dressProp, makeFolk, FOLK } from './assets.js';

export const REGIONS = [
  // Example (uncomment and move to an empty area to try it):
  // { id: 'fernreach', name: 'Fernreach Hollow', bounds: [200, 200, 260, 260],
  //   props: [['tree', 210, 214], ['tree', 222, 230, 1.3], ['rock', 240, 220], ['pillar', 230, 245], ['campfire', 228, 236]],
  //   mobs: [['Goblin', 236, 238, 3]] },
];

// Demo region used by the headless streaming check (?regiontest=1). Not part of the normal map.
const TEST_REGION = { id: 'streamtest', name: 'Streaming Test', bounds: [-40, 120, 40, 200],
  props: Array.from({ length: 60 }, (_, i) => [['tree', 'rock', 'crate', 'pillar', 'bush'][i % 5], -36 + (i % 10) * 8, 124 + Math.floor(i / 10) * 12]) };

const shared = o => { o.userData.shared = true; return o; };
const M = {
  bark: shared(new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 })),
  leaf: shared(new THREE.MeshStandardMaterial({ color: 0x4f7d3a, roughness: 0.8 })),
  stone: shared(new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.95 })),
  wood: shared(new THREE.MeshStandardMaterial({ color: 0x9a7246, roughness: 0.85 })),
  ember: shared(new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff5a10, emissiveIntensity: 1.2 })),
};
const G = {
  trunk: shared(new THREE.CylinderGeometry(0.22, 0.32, 2.4, 10)),
  crown: shared(new THREE.IcosahedronGeometry(1.4, 2)),
  rock: shared(new THREE.DodecahedronGeometry(1, 1)),
  box: shared(new THREE.BoxGeometry(1, 1, 1)),
  pillar: shared(new THREE.CylinderGeometry(0.45, 0.55, 3.2, 16)),
  bush: shared(new THREE.IcosahedronGeometry(0.8, 1)),
  log: shared(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8)),
  flame: shared(new THREE.ConeGeometry(0.3, 0.7, 10)),
};
const mesh = (g, m, y = 0) => { const o = new THREE.Mesh(g, m); o.position.y = y; o.castShadow = true; o.receiveShadow = true; return o; };

// Climate props: each is ONE baked vertex-coloured mesh (one draw call) sharing vcMat; geometry is
// built once per kind and variant and reused by every copy.
const CLIMATE_GEO = {};
vcMat.userData.shared = true; // never disposed with a chunk (used all over the world)
const g3 = (kind, v, fn) => (CLIMATE_GEO[kind + v] ||= shared(bake(fn(makeRng(kind.length * 31 + v * 7)))));
const lowpoly = (geo, rng, amt) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + (rng() - 0.5) * amt), p.getY(i) * (1 + (rng() - 0.5) * amt * 0.6), p.getZ(i) * (1 + (rng() - 0.5) * amt)); geo.computeVertexNormals(); return geo; };
const C = (geo, hex) => col(geo.index ? geo.toNonIndexed() : geo, hex);
const CLIMATE = {
  pine: [0.45, r => { const s = 0.8 + r() * 0.5; return [C(place(prim.cyl(0.14, 0.22, 1.4, 6), 0, 0.7), 0x5a3a24), C(place(prim.cone(1.3, 2.4, 7), 0, 2.2, 0, 0, 0, 0, s), 0x2e5a3a), C(place(prim.cone(1.0, 2.0, 7), 0, 3.3, 0, 0, 0.4, 0, s), 0x356a42), C(place(prim.cone(0.6, 1.4, 7), 0, 4.3, 0, 0, 0.8, 0, s), 0x3a7448)]; }],
  snowpine: [0.45, r => [C(place(prim.cyl(0.14, 0.22, 1.4, 6), 0, 0.7), 0x5a3a24), C(place(prim.cone(1.3, 2.4, 7), 0, 2.2), 0x3a5a4a), C(place(prim.cone(1.05, 0.6, 7), 0, 3.1), 0xf0f4fa), C(place(prim.cone(0.8, 1.8, 7), 0, 3.6, 0, 0, 0.5), 0x3a5a4a), C(place(prim.cone(0.55, 0.9, 7), 0, 4.6), 0xf4f8ff)]],
  snowrock: [0.8, r => [C(lowpoly(place(new THREE.DodecahedronGeometry(1, 0), 0, 0.45, 0, 0, 0, 0, 1.3, 0.8, 1.1), r, 0.3), 0x8a8e98), C(place(new THREE.DodecahedronGeometry(0.9, 0), 0, 0.95, 0, 0, 0, 0, 1.1, 0.35, 0.9), 0xf2f6fc)]],
  iceshard: [0.4, r => [0, 1, 2].map(i => C(place(prim.cone(0.3 + r() * 0.15, 1.6 + r() * 1.4, 5), (i - 1) * 0.4, 0.8, (r() - 0.5) * 0.5, (r() - 0.5) * 0.4, 0, (i - 1) * 0.3), 0xa8d8f0))],
  deadtree: [0.35, r => [C(place(prim.cyl(0.12, 0.25, 3, 6), 0, 1.5), 0x4a3a2c), C(place(prim.cyl(0.05, 0.1, 1.4, 5), 0.4, 2.4, 0, 0, 0, -0.9), 0x4a3a2c), C(place(prim.cyl(0.05, 0.09, 1.1, 5), -0.3, 2.0, 0.1, 0.3, 0, 1.0), 0x4a3a2c)]],
  boulder: [0.9, r => [C(lowpoly(place(new THREE.DodecahedronGeometry(1, 0), 0, 0.5, 0, 0, 0, 0, 1.3, 0.9, 1.1), r, 0.35), 0x7a7a72), C(place(new THREE.DodecahedronGeometry(0.5, 0), 0.9, 0.25, 0.3), 0x6a6a64)]],
  fern: [0, r => [0, 1, 2, 3, 4].map(i => C(place(prim.cone(0.18, 1.0, 4), Math.cos(i * 1.26) * 0.3, 0.35, Math.sin(i * 1.26) * 0.3, Math.sin(i * 1.26) * 0.7, 0, -Math.cos(i * 1.26) * 0.7), 0x3a7a2a))],
  lavarock: [0.8, r => [C(lowpoly(place(new THREE.DodecahedronGeometry(1, 0), 0, 0.4, 0, 0, 0, 0, 1.2, 0.7, 1.0), r, 0.4), 0x2a2220), C(place(prim.box(1.2, 0.06, 0.12), 0, 0.72, 0.2, 0, 0.6), 0xff5a1a)]],
  vent: [0.5, r => [C(place(prim.cyl(0.35, 0.9, 0.9, 7), 0, 0.45), 0x2a2220), C(place(prim.cyl(0.3, 0.3, 0.05, 7), 0, 0.92), 0xff6a20)]],
  cactus: [0.35, r => [C(place(prim.cyl(0.28, 0.3, 2.4, 7), 0, 1.2), 0x4a8a3a), C(place(prim.cyl(0.18, 0.18, 0.8, 6), 0.45, 1.2, 0, 0, 0, Math.PI / 2), 0x4a8a3a), C(place(prim.cyl(0.17, 0.17, 0.9, 6), 0.8, 1.6), 0x4a8a3a), C(place(prim.cyl(0.16, 0.16, 0.7, 6), -0.4, 1.6, 0, 0, 0, Math.PI / 2), 0x4a8a3a), C(place(prim.cyl(0.15, 0.15, 0.6, 6), -0.7, 1.9), 0x4a8a3a)]],
  palm: [0.35, r => [C(place(prim.cyl(0.16, 0.26, 4.2, 6), 0.3, 2.1, 0, 0, 0, -0.12), 0x8a6a42), ...[0, 1, 2, 3, 4, 5].map(i => C(place(prim.box(0.5, 0.05, 2.0), 0.55 + Math.cos(i * 1.05) * 0.9, 4.0, Math.sin(i * 1.05) * 0.9, 0.35, -i * 1.05 + Math.PI / 2, 0), 0x3a8a3a))]],
  sandstone: [0.9, r => [C(lowpoly(place(prim.box(1.6, 1.4, 1.2), 0, 0.7), r, 0.25), 0xc89a62), C(lowpoly(place(prim.box(1.2, 0.5, 1.0), 0.2, 1.6, 0, 0, 0.4), r, 0.2), 0xb88a52)]],
  bones: [0, r => [C(place(prim.cyl(0.08, 0.08, 1.4, 5), 0, 0.1, 0, 0, 0.3, Math.PI / 2), 0xe8e0c8), C(place(prim.sphere(0.28, 6, 5), 0.8, 0.22, 0.2), 0xe8e0c8), ...[0, 1, 2].map(i => C(place(new THREE.TorusGeometry(0.4, 0.04, 4, 8, Math.PI), -0.2 + i * 0.3, 0.05, 0, 0, Math.PI / 2, 0), 0xe0d8c0))]],
  junglebush: [0, r => [0, 1, 2].map(i => C(lowpoly(place(new THREE.IcosahedronGeometry(0.7, 0), (i - 1) * 0.6, 0.5 + (i % 2) * 0.2, (r() - 0.5) * 0.6), r, 0.3), [0x2a6a22, 0x347a2a, 0x2a5a1e][i]))],
  reed: [0, r => Array.from({ length: 6 }, (_, i) => C(place(prim.cyl(0.03, 0.04, 1.4 + r() * 0.6, 4), (r() - 0.5) * 0.7, 0.75, (r() - 0.5) * 0.7, (r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2), i % 3 ? 0x7a8a4a : 0x8a6a3a))],
  // ---- quest villages ----
  gobhut: [1.7, r => [C(lowpoly(place(prim.cyl(1.5, 1.8, 1.6, 8), 0, 0.8), r, 0.15), 0x7a5a3a), C(lowpoly(place(prim.cone(2.3, 1.9, 8), 0, 2.4, 0, 0, r() * 0.3, 0.06), r, 0.2), 0xb09a5a), C(place(prim.box(0.8, 1.1, 0.2), 0, 0.55, 1.6), 0x2a1a10), C(place(prim.cyl(0.05, 0.05, 1.2, 4), 0.3, 3.5, 0, 0, 0, 0.3), 0x4a3a24)]],
  gobtotem: [0.3, r => [C(place(prim.cyl(0.18, 0.24, 3.2, 6), 0, 1.6), 0x5a3a24), C(place(prim.box(0.6, 0.5, 0.5), 0, 2.9), 0x6aa040), C(place(prim.box(0.9, 0.12, 0.12), 0, 3.3), 0xc0a040), C(place(prim.sphere(0.12, 5, 4), 0.15, 2.95, 0.26), 0xd02020), C(place(prim.sphere(0.12, 5, 4), -0.15, 2.95, 0.26), 0xd02020)]],
  palisade: [0.4, r => Array.from({ length: 5 }, (_, i) => C(place(prim.cone(0.2, 2.6 + r() * 0.6, 5), (i - 2) * 0.42, 1.3, 0), 0x6a4a2a))],
  ogrehall: [3.2, r => [C(lowpoly(place(prim.box(6.5, 2.6, 4.6), 0, 1.3), r, 0.08), 0x6a5a48), C(lowpoly(place(prim.cyl(0.01, 3.9, 2.6, 4), 0, 3.9, 0, 0, Math.PI / 4, 0, 1.15, 1, 0.8), r, 0.1), 0x8a6a3a), C(place(prim.box(1.6, 2.0, 0.2), 0, 1.0, 2.35), 0x2a1a10), C(place(prim.cyl(0.4, 0.5, 3.2, 6), 3.4, 1.6, 2.4), 0x5a4a38), C(place(prim.cyl(0.4, 0.5, 3.2, 6), -3.4, 1.6, 2.4), 0x5a4a38)]],
  ogrestone: [0.8, r => [C(lowpoly(place(prim.box(1.0, 3.6 + r() * 1.2, 0.7), 0, 1.9, 0, (r() - 0.5) * 0.12, r(), (r() - 0.5) * 0.12), r, 0.25), 0x7a7a70), C(place(prim.box(1.05, 0.25, 0.75), 0, 3.0, 0), 0x4a6a2a)]],
  bonepile: [0, r => [C(place(prim.sphere(0.4, 6, 5), 0, 0.2, 0), 0xe8e0c8), C(place(prim.cyl(0.08, 0.08, 1.2, 5), 0.4, 0.15, 0.2, 0, 0.5, Math.PI / 2), 0xe8e0c8), C(place(prim.cyl(0.08, 0.08, 1.0, 5), -0.3, 0.12, -0.2, 0, -0.8, Math.PI / 2), 0xe0d8c0)]],
  elftower: [1.3, r => [C(place(prim.cyl(1.0, 1.25, 7.5, 12), 0, 3.75), 0xeef0ea), C(place(prim.cyl(1.3, 1.3, 0.3, 12), 0, 7.6), 0xd0d8d0), C(place(prim.cone(1.5, 3.2, 12), 0, 9.3), 0x5a9a7a), C(place(prim.box(0.6, 1.4, 0.15), 0, 0.7, 1.2), 0x6a8aa0), C(place(prim.box(0.4, 0.8, 0.12), 0, 5.2, 1.0), 0x9ad0ff)]],
  elfhall: [2.6, r => [C(place(prim.box(5.4, 2.8, 4.0), 0, 1.4), 0xf2f0e8), C(place(prim.cyl(0.01, 3.6, 2.2, 4), 0, 3.9, 0, 0, Math.PI / 4, 0, 1.08, 1, 0.8), 0x4a8a6a), ...[-2.3, -0.8, 0.8, 2.3].map(x => C(place(prim.cyl(0.18, 0.2, 2.8, 8), x, 1.4, 2.15), 0xffffff)), C(place(prim.box(1.2, 2.0, 0.15), 0, 1.0, 2.05), 0x6a8aa0)]],
  silvertree: [0.4, r => [C(place(prim.cyl(0.18, 0.3, 4.2, 7), 0, 2.1), 0xd8d8d0), C(lowpoly(place(new THREE.IcosahedronGeometry(1.8, 1), 0, 5.0, 0, 0, 0, 0, 1, 0.8, 1), r, 0.2), 0xa8d0b8), C(lowpoly(place(new THREE.IcosahedronGeometry(1.2, 0), 0.8, 5.8, 0.3), r, 0.2), 0xc8e8d8)]],
  moonlamp: [0.15, r => [C(place(prim.cyl(0.06, 0.08, 2.4, 6), 0, 1.2), 0xd8d8d0), C(place(prim.sphere(0.22, 8, 6), 0, 2.55), 0xc8f0ff)]],
  cottage: [1.7, r => [C(place(prim.box(3.0, 2.4, 3.0), 0, 1.2), 0xc8b89a), C(place(prim.cyl(0.01, 2.5, 2.0, 4), 0, 3.4, 0, 0, Math.PI / 4), 0x7a4a2a), C(place(prim.box(0.9, 1.5, 0.1), 0, 0.75, 1.52), 0x4a3020)]],
  stall: [0.9, r => [C(place(prim.box(2.0, 0.9, 1.0), 0, 0.45), 0x9a7246), ...[-0.9, 0.9].map(x => C(place(prim.cyl(0.05, 0.05, 2.2, 5), x, 1.1, 0.45), 0x6a4a2a)), C(place(prim.box(2.2, 0.08, 1.3), 0, 2.2, 0.2, 0.2), 0xb03a2a)]],
  mossrock: [0.7, r => [C(lowpoly(place(new THREE.DodecahedronGeometry(0.9, 0), 0, 0.35, 0, 0, 0, 0, 1.2, 0.7, 1.0), r, 0.35), 0x4a4a42), C(place(new THREE.DodecahedronGeometry(0.75, 0), 0, 0.62, 0, 0, 0, 0, 1.05, 0.3, 0.85), 0x4a6a2a)]],
};

// kind -> { build(scale) => Object3D, solid: radius (collider half-size) or 0 }
export const KINDS = {
  tree: { solid: 0.5, build: () => { const g = new THREE.Group(); g.add(mesh(G.trunk, M.bark, 1.2), mesh(G.crown, M.leaf, 3.1)); return g; } },
  rock: { solid: 0.9, build: () => { const o = mesh(G.rock, M.stone, 0.45); o.scale.set(1.2, 0.8, 1); return o; } },
  crate: { solid: 0.55, build: () => mesh(G.box, M.wood, 0.5) },
  pillar: { solid: 0.55, build: () => mesh(G.pillar, M.stone, 1.6) },
  bush: { solid: 0, build: () => mesh(G.bush, M.leaf, 0.5) },
  fence: { solid: 0.15, build: () => { const o = mesh(G.box, M.wood, 0.5); o.scale.set(2, 1, 0.12); return o; } },
  campfire: { solid: 0.4, build: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const l = mesh(G.log, M.bark, 0.1); l.rotation.set(Math.PI / 2, 0, i * 2.1); g.add(l); } const f = mesh(G.flame, M.ember, 0.4); f.userData.part = 'flame'; g.add(f); return g; } },
};
for (const [k, [solid, fn]] of Object.entries(CLIMATE)) KINDS[k] = { solid, build: () => { const v = (Math.random() * 3) | 0; const m = new THREE.Mesh(g3(k, v, fn), vcMat); m.castShadow = true; m.receiveShadow = true; return m; } };

// Climate regions -> prop lists (seeded, so every visit looks the same). Keeps clear of camps,
// dig sites, the Delving hub, ponds, resource nodes and roads.
function distSeg(x, z, x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / L)); return Math.hypot(x - x1 - dx * t, z - z1 - dz * t); }
export function climateRegions(density = 1) {
  return REGION_DATA.map(R => {
    const rng = makeRng(R.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
    const keep = [];
    if (R.camp) keep.push([R.x + R.camp.dx, R.z + R.camp.dz, 15]);
    if (R.dig) keep.push([R.x + R.dig.dx, R.z + R.dig.dz, 10]);
    if (R.delveHub) keep.push([R.x + R.delveHub.dx, R.z + R.delveHub.dz, 9]);
    if (R.pond) keep.push([R.x + R.pond.dx, R.z + R.pond.dz, R.pond.r + 3]);
    for (const n of R.nodes || []) keep.push([R.x + n[2], R.z + n[3], 3]);
    for (const m of R.mobs || []) keep.push([R.x + m[1], R.z + m[2], 3]);
    const props = [];
    for (const [kind0, n0] of Object.entries(R.scatter || {})) {
      const kind = kind0 === 'pine' && R.biome === 'tundra' ? 'snowpine' : kind0;
      const n = Math.round(n0 * density);
      for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * R.r * 0.92, x = R.x + Math.cos(a) * d, z = R.z + Math.sin(a) * d;
        if (keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
        if (PATHS.some(p => distSeg(x, z, ...p) < 3)) continue;
        props.push([kind, x, z, 0.8 + rng() * 0.5, rng() * Math.PI * 2]); i++;
      }
    }
    if (R.camp) {   // a few cottages and a market stall on the camp's outskirts (outside its 15 m clear zone)
      const cx = R.x + R.camp.dx, cz = R.z + R.camp.dz;
      for (let i = 0; i < 3; i++) { const a = 2.4 + i * 0.9, x = cx + Math.cos(a) * 19, z = cz + Math.sin(a) * 19;
        if (!PATHS.some(p => distSeg(x, z, ...p) < 5) && !keep.slice(1).some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + 3)) props.push(['cottage', x, z, 1, Math.atan2(cx - x, cz - z)]); }
      { const x = cx + Math.cos(1.5) * 17, z = cz + Math.sin(1.5) * 17; props.push(['stall', x, z, 1, Math.atan2(cx - x, cz - z)]); }
    }
    return { id: R.id, name: R.name, biome: R.biome, bounds: [R.x - R.r, R.z - R.r, R.x + R.r, R.z + R.r], props };
  });
}

// Quest villages (js/villagedata.js) -> seeded prop rings: huts round a central totem/hall, a palisade or
// stones on the rim, a few scattered extras. All baked vertex-coloured meshes, chunk-loaded like region props.
export function villageRegions() {
  const LAYOUT = { goblin: { core: 'gobtotem', ring: 'gobhut', n: 7, rim: 'palisade', rimN: 18, extra: ['bonepile', 'campfire'] },
    ogre: { core: 'ogrehall', ring: 'ogrehall', n: 4, rim: 'ogrestone', rimN: 12, extra: ['bonepile', 'campfire', 'boulder'] },
    elf: { core: 'elfhall', ring: 'elftower', n: 6, rim: 'silvertree', rimN: 16, extra: ['moonlamp', 'moonlamp', 'fern'] } };
  return VILLAGES.map((V, vi) => {
    const rng = makeRng(9001 + vi * 77), Lo = LAYOUT[V.kind], props = [];
    props.push([Lo.core, V.x, V.z - (V.kind === 'goblin' ? 0 : 6), 1, 0]);
    for (let i = 0; i < Lo.n; i++) { const a = (i / Lo.n) * Math.PI * 2 + 0.4, d = V.r * 0.55; const x = V.x + Math.cos(a) * d, z = V.z + Math.sin(a) * d; props.push([Lo.ring, x, z, 0.9 + rng() * 0.2, Math.atan2(V.x - x, V.z - z)]); }
    for (let i = 0; i < Lo.rimN; i++) { const a = (i / Lo.rimN) * Math.PI * 2, d = V.r * 0.95; if (Math.abs(Math.sin(a)) > 0.97) continue; const x = V.x + Math.cos(a) * d, z = V.z + Math.sin(a) * d; props.push([Lo.rim, x, z, 1, -a + Math.PI / 2]); }
    for (let i = 0; i < 10; i++) { const a = rng() * Math.PI * 2, d = V.r * (0.25 + rng() * 0.15); props.push([Lo.extra[i % Lo.extra.length], V.x + Math.cos(a) * d, V.z + Math.sin(a) * d, 0.8 + rng() * 0.4, rng() * 6]); }
    return { id: V.id, name: V.name, bounds: [V.x - V.r, V.z - V.r, V.x + V.r, V.z + V.r], props, mobs: V.mobs.map(([t, dx, dz, roam]) => [t, V.x + dx, V.z + dz, roam]) };
  });
}

// Register every region prop with its chunk. Returns the regions in use (for the world map).
// spawnMonster/registerDynamic come from main so mobs share the normal AI, loot and respawn code.
export function loadRegions(scene, { spawnMonster, registerDynamic, density = 1, withFolk = true } = {}) {
  const list = [...REGIONS, ...climateRegions(density), ...villageRegions()];
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('regiontest')) list.push(TEST_REGION);
  let props = 0, mobs = 0;
  for (const r of list) {
    for (const [kind, x, z, s = 1, rot = 0] of r.props || []) {
      const K = KINDS[kind];
      if (!K) { console.warn('[regions] unknown prop kind', kind, 'in', r.id); continue; }
      if (K.solid) { const h = K.solid * s; colliders.push({ minX: x - h, maxX: x + h, minZ: z - h, maxZ: z + h, prop: r.id + ':' + kind }); }
      registerChunkObject(x, z, () => {
        let o = K.build();
        if (hasModel(kind)) { const h = new THREE.Group(); h.add(o); o = dressProp(h, kind, x, z); }
        o.position.set(x, terrainHeight(x, z), z); o.scale.multiplyScalar(s); o.rotation.y = rot;
        o.userData.region = r.id; return o;
      }, scene, { regen: true });
      props++;
    }
    if (spawnMonster) for (const [type, x, z, roam = 2] of r.mobs || []) {
      let m = null; try { m = spawnMonster(type, x, z, roam); } catch (e) { console.warn('[regions] bad mob', type, 'in', r.id, e); continue; }
      if (m && registerDynamic) registerDynamic(m.mesh, () => m.mesh.position, scene);
      mobs++;
    }
  }
  // ambient townsfolk (CC0 animated characters), chunk-streamed; skipped on Low/when models are off
  let folk = 0;
  if (withFolk) {
    const spots = [...REGION_DATA.filter(R => R.camp).map(R => [R.x + R.camp.dx, R.z + R.camp.dz]), ...VILLAGES.filter(V => V.kind !== 'ogre').map(V => [V.x, V.z])];
    spots.forEach(([sx, sz], i) => { for (let j = 0; j < (density < 1 ? 1 : 2); j++) {
      const x = sx + (j ? 5 : -5), z = sz + 4 + j * 2, path = FOLK[(i * 2 + j) % (density < 1 ? 2 : FOLK.length)];
      registerChunkObject(x, z, () => makeFolk(path, x, z, terrainHeight), scene); folk++; } });
    // ogre villages: big rigged ogre-kin townsfolk (Quaternius orc, tinted) instead of the human folk
    VILLAGES.filter(V => V.kind === 'ogre').forEach(V => { for (let j = 0; j < (density < 1 ? 1 : 2); j++) {
      const x = V.x + (j ? 6 : -6), z = V.z + 5;
      registerChunkObject(x, z, () => makeFolk('rigged/orc_enemy', x, z, terrainHeight, { height: 2.6, tint: 0x9a8a5a, speed: 0.9 }), scene); folk++; } });
  }
  return { regions: list, props, mobs, folk };
}
