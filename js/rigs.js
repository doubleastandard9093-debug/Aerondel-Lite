// Rigged, animated CC0 characters (Quaternius via poly.pizza; Kenney mini characters) that replace the
// procedural monster / player / NPC meshes. The procedural mesh stays as the fallback (load fails,
// ?models=0) and as the Low-graphics look (no skeletal animation on Low, except the player).
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadModel } from './assets.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const RS = { on: Q.get('models') !== '0' && typeof document !== 'undefined', low: false, touch: false, active: 0 };
export function setRigQuality({ low = false, touch = false } = {}) { RS.low = low; RS.touch = touch; }
export function rigStats() { return { on: RS.on, low: RS.low, active: RS.active }; }

// monster type -> [model, tint|null] variants (touch devices use only the first)
const T = (m, tint = null, k = 0.55) => ({ m, tint, k });
export const MONSTER_RIGS = {
  'Wolf': [T('wolf'), T('wolf', 0x8a8a90)], 'Cow': [T('cow')], 'Giant Spider': [T('spider'), T('spider', 0x5a3a2a)],
  'Zombie': [T('zombie'), T('ghost', 0x9ad0a0, 0.4)], 'Skeleton': [T('skeleton')],
  'Goblin': [T('goblin'), T('orc_enemy', 0x7ab05a, 0.35)],
  'Ogre': [T('giant', 0x9a8a5a)], 'Grumsh': [T('giant', 0xb05a3a)], 'Bog Giant': [T('giant', 0x5a8a4a)], 'Crag Giant': [T('giant', 0x9a9a9a)],
  'Ice Giant': [T('yeti')], 'Green Dragon': [T('dragon', 0x5ab05a)], 'Scorchwing': [T('dragon', 0xd05a2a)],
  'Cinder Fiend': [T('demon'), T('demon_blue', 0xd06030)],
  'Bandit': [T('sam', 0x8a6a4a, 0.3), T('matt', 0x6a5a4a, 0.3)], 'Guard': [T('matt', 0xb0b0c0, 0.35)], 'Ironveil Knight': [T('matt', 0x9aa0b8, 0.5)],
  'Dark Archer': [T('sam', 0x4a4a5a, 0.5)], 'Duellist': [T('sam'), T('matt')], 'Ashen raider': [T('orc', 0x8a7a70, 0.4)],
  'Drowned Deckhand': [T('skeleton', 0x6ab0a0, 0.4)], 'Drowned Gunner': [T('zombie', 0x5a9ab0, 0.4)], 'Captain Saltgrave': [T('orc', 0x4a8a9a, 0.5)]
};

// clip lookup: state -> name patterns, first match wins
const CLIP = {
  idle: [/^idle$/i, /^spider_idle$/i, /flying_idle/i, /^idle/i],
  walk: [/^walk$/i, /spider_walk/i, /fast_flying/i, /walk/i],
  run: [/^run$/i, /^gallop$/i, /spider_walk/i, /fast_flying/i, /run|walk/i],
  attack: [/sword_slash/i, /^slash$/i, /^attack$/i, /spider_attack/i, /bite|headbutt|punch|weapon|attack/i],
  hit: [/hitre/i, /hit/i],
  death: [/death/i],
  interact: [/interact|pick-up/i],
  shoot: [/gun_shoot|shoot/i]
};
const findClip = (clips, st) => { for (const re of CLIP[st] || []) { const c = clips.find(a => re.test(a.name.split('|').pop())); if (c) return c; } return null; };
const _b = new THREE.Box3(), _s = new THREE.Vector3();

// Build an animated instance. fit: target height (or {len}) in the holder's local units.
export function makeRig(name, { height = 1.75, len = 0, tint = null, k = 0.55 } = {}) {
  if (!RS.on) return Promise.resolve(null);
  return loadModel(name.includes('/') ? name : 'rigged/' + name).then(g => {
    if (!g) return null;
    const obj = skClone(g.scene);
    obj.updateMatrixWorld(true);
    obj.traverse(o => { if (o.isSkinnedMesh) o.skeleton.update(); });
    _b.setFromObject(obj, true); _b.getSize(_s);   // precise: skinned + quantized vertices
    const sc = len ? len / Math.max(1e-3, Math.max(_s.x, _s.z)) : height / Math.max(1e-3, _s.y);
    obj.scale.multiplyScalar(sc);
    const mats = [];
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false; o.castShadow = true;
      const tw = m => { const c = m.clone(); c.userData = {}; c.userData.base = c.color.clone(); mats.push(c); return c; };
      o.material = Array.isArray(o.material) ? o.material.map(tw) : tw(o.material);
    });
    const R = { obj, mixer: new THREE.AnimationMixer(obj), clips: g.animations, acts: {}, cur: null, curSt: null, once: 0, mats, name, on: false };
    if (tint != null) tintRig(R, tint, k);
    play(R, 'idle');
    return R;
  });
}
const _w = new THREE.Color(1, 1, 1), _t = new THREE.Color();
export function tintRig(R, hex, k = 0.55, filter = null) {
  _t.set(hex);
  for (const m of R.mats) { if (filter && !filter(m)) continue; m.color.copy(m.userData.base).multiply(_w.clone().lerp(_t, k)); }
}
function act(R, st) {
  if (!(st in R.acts)) { const c = findClip(R.clips, st); R.acts[st] = c ? R.mixer.clipAction(c) : null; }
  return R.acts[st];
}
// play a looping state; one-shots (attack/hit/interact/shoot) run once then fall back; death clamps
export function play(R, st, { once = false, speed = 1 } = {}) {
  const a = act(R, st) || (st === 'run' ? act(R, 'walk') : null) || act(R, 'idle'); if (!a) return;
  if (R.cur === a && !once) { a.timeScale = speed; return; }
  a.reset(); a.timeScale = speed;
  if (once || st === 'death') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = st === 'death'; R.once = st === 'death' ? 1e9 : a.getClip().duration / speed * 0.9; }
  else { a.setLoop(THREE.LoopRepeat, Infinity); R.once = 0; }
  a.fadeIn(0.15).play(); if (R.cur && R.cur !== a) R.cur.fadeOut(0.15);
  R.cur = a; R.curSt = st;
}
// per frame: base looping state + one-shot triggers
export function drive(R, dt, base, trigger = null) {
  if (trigger) play(R, trigger, { once: true });
  else if (R.once > 0) R.once -= dt;
  else if (R.curSt !== base) play(R, base);
  R.mixer.update(dt);
}

// ---- monsters ----
export const rigRange = () => RS.touch ? 40 : 72;
export function wantRigs() { return RS.on && !RS.low; }
export function monsterRig(m, typeName, seed, camX, camZ) {
  const list = MONSTER_RIGS[typeName]; if (!list || !RS.on) return;
  if (m.rig === undefined) {
    const d = Math.hypot(m.mesh.position.x - camX, m.mesh.position.z - camZ);
    if (!wantRigs() || d > rigRange()) return;
    m.rig = null;
    const V = list[RS.touch ? 0 : (seed >>> 0) % list.length];
    const lo = m.lod ? m.lod.lo : m.body.children[0];
    _b.setFromObject(lo); _b.getSize(_s);
    const sc = m.mesh.scale.x || 1, quad = m.legs && m.legs.length >= 4 || /spider|dragon/.test(V.m) && V.m !== 'ghost';
    const fit = quad ? { len: Math.max(_s.x, _s.z) / sc } : { height: _s.y / sc };
    makeRig(V.m, { ...fit, tint: V.tint, k: V.k }).then(R => { if (R) { m.rig = R; m.body.add(R.obj); R.obj.visible = false; } });
  }
}
// switch between rig and procedural look (Low / far toggles)
export function showRig(m, on) {
  const R = m.rig; if (!R) return false;
  if (on === R.on) return on;
  R.on = on; R.obj.visible = on; RS.active += on ? 1 : -1;
  if (on) {
    if (m.lod) { m._lod = m.lod; if (m.lod.hi) { m.lod.parent.remove(m.lod.hi); m.lod.hi = null; } m.lod.lo.visible = false; m.lod = null; }
    else if (m.body && m.body.children[0] !== R.obj) m.body.children[0].visible = false;
    m.rigHi = null;
  } else if (m._lod) { m.lod = m._lod; m._lod = null; m.lod.lo.visible = true; }
  return on;
}
export function driveMonster(m, dt, moving) {
  const R = m.rig; if (!R || !R.on) return;
  let trig = null;
  if ((m.lungeT || 0) > (R.pl || 0) + 0.2) trig = 'attack';
  else if ((m.hitT || 0) > (R.ph || 0) + 0.2 && R.curSt !== 'attack') trig = 'hit';
  R.pl = m.lungeT || 0; R.ph = m.hitT || 0;
  if (m.dying) { if (R.curSt !== 'death') play(R, 'death'); R.mixer.update(dt); return; }
  if (R.curSt === 'death') R.once = 0;
  drive(R, dt, moving ? (m.state === 'idle' ? 'walk' : 'run') : 'idle', trig);
}

