// Chunk streaming. The world is cut into square CHUNK x CHUNK cells keyed "cx,cz".
// - Chunks within LOAD_RADIUS of the player attach their meshes; chunks beyond
//   UNLOAD_RADIUS (= LOAD_RADIUS + 1, hysteresis) detach them, so walking along a
//   chunk edge doesn't thrash.
// - Attach/detach work is queued and time-sliced (BUDGET_MS per frame) so a
//   chunk crossing never causes a frame hitch, even on phones.
// - Regenerable objects (registered with { regen: true }, e.g. data-driven region
//   props from regions.js) are fully disposed (geometry + materials) once their
//   chunk is DISPOSE_RADIUS away, and rebuilt from data on return.
// - Gameplay data (monster HP, colliders, NPC refs) lives outside the meshes, so
//   unloading never loses state. Monsters in unloaded chunks pause (see
//   isLoadedAt) and resume at their spawn point.
import * as THREE from 'three';

export const CHUNK = 32;          // world units per chunk
export let LOAD_RADIUS = 2;       // 2 -> 5x5 chunks around the player
let UNLOAD_RADIUS = 3, DISPOSE_RADIUS = 5;
const BUDGET_MS = 2.5;            // per-frame time slice for attach/detach
const chunks = new Map();         // key -> { cx, cz, objs: Set, loaded }
const dynamic = [];               // moving things (monsters): { obj, getPos, parent }
const queue = [];                 // pending { c, load }
let curCx = 1e9, curCz = 1e9, dirty = true, sceneRef = null;

const keyOf = (cx, cz) => cx + ',' + cz;
const cOf = v => Math.floor(v / CHUNK);

// Radius per device: phones/tablets never exceed 2 (5x5 = 160 units), desktop High gets 3 (7x7).
// ?chunks=N overrides (testing).
export function radiusFor(quality, touch) {
  const f = typeof location !== 'undefined' && +new URLSearchParams(location.search).get('chunks');
  if (f >= 1 && f <= 6) return f;
  if (touch) return 2;
  return quality === 'low' ? 2 : 3;
}
export function setLoadRadius(r) {
  if (r === LOAD_RADIUS) return;
  LOAD_RADIUS = r; UNLOAD_RADIUS = r + 1; DISPOSE_RADIUS = r + 3; dirty = true;
}

function chunkFor(cx, cz) {
  const key = keyOf(cx, cz);
  let c = chunks.get(key);
  if (!c) { c = { cx, cz, objs: new Set(), loaded: false, queued: false }; chunks.set(key, c); }
  return c;
}

// factory: () => Object3D, called the first time the chunk loads.
// opts.regen: the factory can rebuild the object, so it may be disposed when far away.
export function registerChunkObject(x, z, factory, parent = null, opts = {}) {
  const ent = { factory, obj: null, parent, regen: !!opts.regen };
  const c = chunkFor(cOf(x), cOf(z));
  c.objs.add(ent);
  if (c.loaded && sceneRef) attach(ent, sceneRef);   // late registration into a live chunk
  return ent;
}

// Register a moving object; its chunk is recomputed on each update.
export function registerDynamic(obj, getPos, parent = null) {
  const ent = { obj, getPos, parent: parent || obj.parent };
  dynamic.push(ent);
  return ent;
}

// True when the chunk containing (x, z) is inside the unload ring (meshes present / AI active).
export function isLoadedAt(x, z) {
  return Math.max(Math.abs(cOf(x) - curCx), Math.abs(cOf(z) - curCz)) <= UNLOAD_RADIUS;
}

function attach(ent, scene) {
  if (!ent.obj) { ent.obj = ent.factory(); if (!ent.parent) ent.parent = ent.obj.parent || scene; }
  const p = ent.parent || scene;
  if (ent.obj.parent !== p) p.add(ent.obj);
}
function detach(ent) { if (ent.obj && ent.obj.parent) ent.obj.parent.remove(ent.obj); }
function dispose(ent) {
  if (!ent.obj || !ent.regen) return;
  detach(ent);
  ent.obj.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) if (!m.userData.shared) m.dispose();
    if (o.isInstancedMesh) o.dispose();
  });
  ent.obj = null;
}

const ring = c => Math.max(Math.abs(c.cx - curCx), Math.abs(c.cz - curCz));

export function updateChunks(px, pz, scene) {
  sceneRef = scene;
  const cx = cOf(px), cz = cOf(pz);
  if (cx !== curCx || cz !== curCz || dirty) {
    curCx = cx; curCz = cz; dirty = false;
    for (const c of chunks.values()) {
      const d = ring(c);
      if (!c.loaded && d <= LOAD_RADIUS) queue.push({ c, load: true });
      else if (c.loaded && d > UNLOAD_RADIUS) queue.push({ c, load: false });
      else if (!c.loaded && d > DISPOSE_RADIUS) for (const e of c.objs) if (e.obj && e.regen) dispose(e);
    }
    // nearest chunks first so the ground under the player fills in first
    queue.sort((a, b) => ring(a.c) - ring(b.c));
  }
  pumpChunks(scene);
  for (const d of dynamic) {
    const p = d.getPos(), want = isLoadedAt(p.x, p.z);
    if (want && !d.obj.parent) (d.parent || scene).add(d.obj);
    else if (!want && d.obj.parent) d.obj.parent.remove(d.obj);
  }
}

// Load everything around (px, pz) right now, no time slicing (startup / teleports behind a fade).
export function primeChunks(px, pz, scene) { dirty = true; updateChunks(px, pz, scene); pumpChunks(scene, Infinity); }

// Drain queued attach/detach work within the frame budget. Call every frame.
export function pumpChunks(scene = sceneRef, budget = BUDGET_MS) {
  if (!queue.length || !scene) return;
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < budget) {
    const { c, load } = queue.shift(), d = ring(c);
    // re-check against the current position: the player may have moved since it was queued
    if (load && (c.loaded || d > LOAD_RADIUS)) continue;
    if (!load && (!c.loaded || d <= UNLOAD_RADIUS)) continue;
    c.loaded = load;
    for (const e of c.objs) load ? attach(e, scene) : detach(e);
  }
}

export function chunkStats() {
  let loaded = 0, objs = 0, built = 0;
  for (const c of chunks.values()) {
    if (c.loaded) { loaded++; objs += c.objs.size; }
    for (const e of c.objs) if (e.obj) built++;
  }
  return { chunk: CHUNK, radius: LOAD_RADIUS, unload: UNLOAD_RADIUS, center: [curCx, curCz], chunks: chunks.size, loaded, objs, built, queued: queue.length, dynamic: dynamic.length, dynLoaded: dynamic.filter(d => d.obj.parent).length };
}

// Hand every static, compact scene object to the chunk manager.
// Skips instanced meshes, lights, huge objects (ground, water, sky) and anything in `skip`.
// Objects with userData.alwaysLoaded (bank, shops, quest givers if flagged) stay attached.
export function adoptSceneObjects(scene, skip = new Set()) {
  const box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3();
  let n = 0;
  for (const o of [...scene.children]) {
    if (skip.has(o) || o.isLight || o.isCamera || o.isInstancedMesh || o.userData.noChunk || o.userData.alwaysLoaded) continue;
    box.setFromObject(o);
    if (box.isEmpty()) continue;
    box.getCenter(c); box.getSize(s);
    if (Math.max(s.x, s.z) > 40) continue;
    o.parent.remove(o);                    // start detached; the queue attaches what's near
    registerChunkObject(c.x, c.z, () => o, scene);
    n++;
  }
  dirty = true;
  return n;
}
