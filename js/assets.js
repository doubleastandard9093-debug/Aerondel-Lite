// Real 3D models (CC0 Kenney packs, see CREDITS.md) streamed in over procedural placeholders.
// - One GLTFLoader + MeshoptDecoder, one Promise cache per file: every copy shares geometry and materials.
// - Nothing is fetched until a chunk that uses it loads (regions.js calls dressProp from a chunk factory).
// - The procedural mesh shows first and stays if a fetch fails, so the game never depends on the files.
// - Low quality / phones use fewer variants; ?models=0 turns models off entirely.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const BASE = new URL('../models/', import.meta.url);
const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const state = { on: Q.get('models') !== '0' && typeof document !== 'undefined', low: false, touch: false, failed: 0, loaded: 0 };
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
const leafMats = [];
const leafTint = new THREE.Color(1, 1, 1);

export function setModelQuality({ low = false, touch = false } = {}) { state.low = low; state.touch = touch; }
export function modelStats() { return { on: state.on, files: cache.size, loaded: state.loaded, failed: state.failed }; }

// kind -> variants (paths under models/, no .glb). fit: 'h' match placeholder height, 'w' match footprint.
const V = (cat, ...names) => names.map(n => cat + '/' + n);
export const MODEL_KINDS = {
  tree: { v: V('nature', 'broadleaf_a', 'broadleaf_b', 'broadleaf_c', 'broadleaf_d'), fit: 'h' },
  pine: { v: V('nature', 'pine_a', 'pine_b', 'pine_c', 'pine_d'), fit: 'h' },
  deadtree: { v: V('nature', 'dead_a', 'dead_b', 'dead_c'), fit: 'h' },
  palm: { v: V('nature', 'palm_a', 'palm_b', 'palm_c'), fit: 'h' },
  cactus: { v: V('nature', 'cactus_a', 'cactus_b', 'cactus_c'), fit: 'h' },
  rock: { v: V('nature', 'rock_a', 'rock_b', 'rock_c', 'rock_d'), fit: 'w' },
  boulder: { v: V('nature', 'rock_a', 'rock_b', 'rock_d'), fit: 'w' },
  mossrock: { v: V('nature', 'rock_a', 'rock_b', 'rock_d'), fit: 'w' },
  bush: { v: V('nature', 'bush_a', 'bush_b', 'bush_c'), fit: 'w' },
  junglebush: { v: V('nature', 'bush_a', 'bush_b', 'bush_c'), fit: 'w' },
  fence: { v: V('props', 'fence_a', 'fence_b', 'fence_c'), fit: 'w' },
  crate: { v: V('props', 'crate_a', 'crate_b', 'crate_c'), fit: 'h' },
  campfire: { v: V('props', 'campfire_a', 'campfire_b', 'campfire_c'), fit: 'w', keepChildren: 'flame' },
  pillar: { v: V('props', 'pillar_a', 'pillar_b', 'pillar_c'), fit: 'h' },
  stall: { v: V('props', 'stall_a', 'stall_b', 'cart_a'), fit: 'w' },
  gobhut: { v: V('buildings', 'gob_a', 'gob_b', 'gob_c'), fit: 'w' },
  ogrehall: { v: V('buildings', 'ogre_a', 'ogre_b', 'ogre_c'), fit: 'w' },
  elftower: { v: V('buildings', 'elf_a', 'elf_c'), fit: 'h' },
  elfhall: { v: V('buildings', 'elf_b', 'elf_c'), fit: 'w' },
  cottage: { v: V('buildings', 'human_a', 'human_b', 'human_c'), fit: 'w' },
};
export const FOLK = V('characters', 'folk_m_a', 'folk_f_a', 'folk_m_b', 'folk_f_b', 'folk_m_c', 'folk_f_c');

function prep(gltf, path = '') {
  const palm = /palm/.test(path);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = !palm;   // palms: fronds self-shadowed into near-black, so lit only
    if (palm) for (const m of [].concat(o.material)) { m.side = THREE.DoubleSide; if (m.emissive) m.emissive.copy(m.color).multiplyScalar(0.22); }
    if (o.geometry) o.geometry.userData.shared = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.userData.shared = true;
      if (/leaf|leafs|foliage|green/i.test(m.name || '') && !m.userData.base) { m.userData.base = m.color.clone(); leafMats.push(m); m.color.copy(m.userData.base).multiply(leafTint); }
    }
  });
  return gltf;
}
export function loadModel(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(new URL(path + '.glb', BASE).href)
    .then(g => { state.loaded++; return prep(g, path); })
    .catch(e => { state.failed++; console.warn('[models] failed', path, e && e.message); return null; }));
  return cache.get(path);
}
// Seasons: multiply model leaf colours by the season leaf tint (same hex as the procedural foliage).
export function applyLeafTint(hexOrColor) {
  leafTint.set(hexOrColor);
  // procedural leaf tints are tuned around mid-green; normalise so summer ~ white
  const k = 1 / Math.max(0.35, Math.max(leafTint.r, leafTint.g, leafTint.b)); leafTint.multiplyScalar(k);
  for (const m of leafMats) m.color.copy(m.userData.base).multiply(leafTint);
}

const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const _b = new THREE.Box3(), _s = new THREE.Vector3(), _c = new THREE.Vector3();
export function hasModel(kind) { return state.on && !!MODEL_KINDS[kind]; }

// holder: the Object3D returned to the chunk system; its children are the procedural placeholder (at origin).
export function dressProp(holder, kind, x, z) {
  const K = MODEL_KINDS[kind];
  if (!state.on || !K) return holder;
  const n = state.low || state.touch ? Math.min(2, K.v.length) : K.v.length;
  const path = K.v[Math.floor(hash(x, z) * n) % n];
  loadModel(path).then(g => {
    if (!g || holder.userData.dressed) return;
    const keep = holder.children.filter(c => K.keepChildren && c.userData.part === K.keepChildren);
    const ph = holder.children.filter(c => !keep.includes(c));
    const pb = new THREE.Box3(); for (const c of ph) pb.expandByObject(c);
    const pSize = pb.isEmpty() ? new THREE.Vector3(1, 1, 1) : pb.getSize(new THREE.Vector3());
    const m = g.scene.clone();
    _b.setFromObject(m); _b.getSize(_s); _b.getCenter(_c);
    const k = K.fit === 'h' ? pSize.y / Math.max(1e-3, _s.y) : Math.max(pSize.x, pSize.z) / Math.max(1e-3, Math.max(_s.x, _s.z));
    m.scale.setScalar(k); m.position.set(-_c.x * k, -_b.min.y * k, -_c.z * k);
    m.userData.model = path;
    for (const c of ph) holder.remove(c);
    holder.add(m);
    holder.userData.dressed = path;
  });
  return holder;
}

// ---- ambient townsfolk: skinned, animated (idle / walk / gather), wander near a spot ----
const folk = [];
export function makeFolk(path, x, z, ground, opts = {}) {
  const holder = new THREE.Group();
  holder.position.set(x, ground(x, z), z);
  const F = { holder, home: [x, z], target: null, wait: 1 + hash(x, z) * 3, mixer: null, acts: {}, cur: null, ground, speed: 1.2 };
  holder.userData.folk = F; holder.userData.noChunk = true;
  F.path = path; Object.assign(F, opts); folk.push(F);
  return holder;
}
function loadFolk(F) {
  F.requested = true;
  loadModel(F.path).then(g => {
    const holder = F.holder;
    if (!g) return;
    const m = skClone(g.scene);
    m.updateMatrixWorld(true); m.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
    _b.setFromObject(m, true); _b.getSize(_s);
    if (F.tint != null) m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(new THREE.Color(1, 1, 1).lerp(new THREE.Color(F.tint), 0.4)); } });
    m.scale.multiplyScalar((F.height || 1.75) / Math.max(1e-3, _s.y));
    m.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    holder.add(m);
    F.mixer = new THREE.AnimationMixer(m);
    const ALT = { 'pick-up': /^(pick-up|interact|eating)$/i, 'emote-yes': /^(emote-yes|yes|wave)$/i };
    for (const name of ['idle', 'walk', 'pick-up', 'emote-yes']) { const c = THREE.AnimationClip.findByName(g.animations, name) || g.animations.find(a => (ALT[name] || new RegExp('^' + name + '$', 'i')).test(a.name.split('|').pop())); if (c) F.acts[name] = F.mixer.clipAction(c); }
    play(F, 'idle');
  });
}
function play(F, name) {
  const a = F.acts[name]; if (!a || F.cur === a) return;
  a.reset().fadeIn(0.25).play(); if (F.cur) F.cur.fadeOut(0.25); F.cur = a;
}
export function updateFolk(dt) {
  for (const F of folk) {
    if (!F.holder.parent) continue;                  // unloaded chunk: frozen
    F.holder.visible = !state.low;                  // Low: no skinned animation at all
    if (state.low) continue;
    if (!F.requested && state.on) loadFolk(F);
    if (!F.mixer) continue;
    const p = F.holder.position;
    if (F.target) {
      const dx = F.target[0] - p.x, dz = F.target[1] - p.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { F.target = null; F.wait = 2 + Math.random() * 5; play(F, Math.random() < 0.35 ? 'pick-up' : Math.random() < 0.2 ? 'emote-yes' : 'idle'); }
      else { const s = Math.min(d, F.speed * dt); p.x += dx / d * s; p.z += dz / d * s; p.y = F.ground(p.x, p.z); F.holder.rotation.y = Math.atan2(dx, dz); }
    } else if ((F.wait -= dt) <= 0) {
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 4;
      F.target = [F.home[0] + Math.cos(a) * r, F.home[1] + Math.sin(a) * r]; play(F, 'walk');
    } else if (F.cur && F.cur !== F.acts.idle && F.cur.time > F.cur.getClip().duration * 0.95 && F.cur.getClip().name !== 'walk') play(F, 'idle');
    F.mixer.update(dt);
  }
}
