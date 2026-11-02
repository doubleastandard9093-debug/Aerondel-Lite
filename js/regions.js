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
import { terrainHeight, colliders } from './world.js';

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

// kind -> { build(scale) => Object3D, solid: radius (collider half-size) or 0 }
export const KINDS = {
  tree: { solid: 0.5, build: () => { const g = new THREE.Group(); g.add(mesh(G.trunk, M.bark, 1.2), mesh(G.crown, M.leaf, 3.1)); return g; } },
  rock: { solid: 0.9, build: () => { const o = mesh(G.rock, M.stone, 0.45); o.scale.set(1.2, 0.8, 1); return o; } },
  crate: { solid: 0.55, build: () => mesh(G.box, M.wood, 0.5) },
  pillar: { solid: 0.55, build: () => mesh(G.pillar, M.stone, 1.6) },
  bush: { solid: 0, build: () => mesh(G.bush, M.leaf, 0.5) },
  fence: { solid: 0.15, build: () => { const o = mesh(G.box, M.wood, 0.5); o.scale.set(2, 1, 0.12); return o; } },
  campfire: { solid: 0.4, build: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const l = mesh(G.log, M.bark, 0.1); l.rotation.set(Math.PI / 2, 0, i * 2.1); g.add(l); } g.add(mesh(G.flame, M.ember, 0.4)); return g; } },
};

// Register every region prop with its chunk. Returns the regions in use (for the world map).
// spawnMonster/registerDynamic come from main so mobs share the normal AI, loot and respawn code.
export function loadRegions(scene, { spawnMonster, registerDynamic } = {}) {
  const list = [...REGIONS];
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('regiontest')) list.push(TEST_REGION);
  let props = 0, mobs = 0;
  for (const r of list) {
    for (const [kind, x, z, s = 1, rot = 0] of r.props || []) {
      const K = KINDS[kind];
      if (!K) { console.warn('[regions] unknown prop kind', kind, 'in', r.id); continue; }
      if (K.solid) { const h = K.solid * s; colliders.push({ minX: x - h, maxX: x + h, minZ: z - h, maxZ: z + h, prop: r.id + ':' + kind }); }
      registerChunkObject(x, z, () => {
        const o = K.build(); o.position.set(x, terrainHeight(x, z), z); o.scale.multiplyScalar(s); o.rotation.y = rot;
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
  return { regions: list, props, mobs };
}
