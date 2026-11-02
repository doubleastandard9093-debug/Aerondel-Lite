// Rigged, animated CC0 characters (Quaternius via poly.pizza; Kenney mini characters) that replace the
// procedural monster / player / NPC meshes. The procedural mesh stays as the fallback (load fails,
// ?models=0) and as the Low-graphics look (no skeletal animation on Low, except the player).
import * as THREE from 'three';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';
import { loadModel } from './assets.js';
import { smoothGeometry, richMaterial } from './realism.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const RS = { on: Q.get('models') !== '0' && typeof document !== 'undefined', low: false, touch: false, active: 0, real: Q.get('real') !== '0' };
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
  'Barrow Ghoul': [T('zombie', 0x9ab08a, 0.4)], 'Cinder Warden': [T('demon', 0xc0502a, 0.4)], 'Thornback Prowler': [T('wolf', 0x5a7a3a, 0.5)],
  'Bramble Colossus': [T('giant', 0x5a7a3a)], 'Hoarfrost Stalker': [T('wolf', 0xe0ecf8, 0.5)], 'Glacier Behemoth': [T('yeti', 0xa0c8f0, 0.4)],
  'Storm Gryphon': [T('dragon', 0x9a8a6a)], 'Peak Warlord': [T('orc', 0x6a6a7a, 0.5)], 'Murk Leech': [T('spider', 0x2a3a2a)], 'Bog Revenant': [T('skeleton', 0x7a9a7a, 0.5)],
  'Glass Scorpion': [T('spider', 0xd0d8e0)], 'Dune Tyrant': [T('giant', 0xc89a6a)], 'Caldera Drake': [T('dragon', 0xa0301a)], 'Molten Archon': [T('demon_blue', 0xff6a1a, 0.5)],
  'Voidborn Knight': [T('matt', 0x4a3a7a, 0.6)], 'Sunderlord Vexmar': [T('demon', 0x6a4aa0, 0.6)],
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
    const meshes = []; obj.traverse(o => { if (o.isMesh) meshes.push({ o, geo: o.geometry, mat: o.material }); });
    const R = { meshes, fitH: len || height, rich: false, obj, mixer: new THREE.AnimationMixer(obj), clips: g.animations, acts: {}, cur: null, curSt: null, once: 0, mats, name, on: false };
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
// High/Epic: smooth normals + physical materials (realism.js); Low keeps the faceted cheap set.
export function setRigRich(R, on) {
  if (R.rich === on) return;
  R.rich = on;
  if (on && !R.richMats) {
    const ext = new THREE.Box3(); let e = 0;
    for (const M of R.meshes) { M.geo.computeBoundingBox(); ext.copy(M.geo.boundingBox); e = Math.max(e, ext.max.y - ext.min.y, ext.max.x - ext.min.x, ext.max.z - ext.min.z); }
    const unit = R.fitH / Math.max(1e-4, e), add = [], kinds = [];
    R.richMats = new Map();
    for (const M of R.meshes) {
      M.rgeo = M.geo.attributes.normal ? smoothGeometry(M.geo) : M.geo;
      const up = m => { if (R.richMats.has(m)) return R.richMats.get(m); const r = richMaterial(m, R.name, unit); r.color.copy(m.color); r.userData.base = m.userData.base; R.richMats.set(m, r); add.push(r); if (R.matKind) kinds.push(R.matKind[R.mats.indexOf(m)]); return r; };
      M.rmat = Array.isArray(M.mat) ? M.mat.map(up) : up(M.mat);
    }
    R.mats.push(...add); if (R.matKind) R.matKind.push(...kinds);
  }
  for (const M of R.meshes) { M.o.geometry = on ? M.rgeo : M.geo; M.o.material = on ? M.rmat : M.mat; M.o.receiveShadow = on; }
}
export const rigRichWanted = () => RS.real && !RS.low;
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
  if (R.meshes && R.rich !== rigRichWanted()) setRigRich(R, rigRichWanted());
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

// ---- player: Adventurer, tinted by the equipped armour tier, procedural weapon / bow / shield on the hand bones ----
CLIP.roll = [/^roll$/i];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
export function attachPlayerRig(pm) {
  if (!RS.on || pm.rig !== undefined) return;
  pm.rig = null;
  makeRig('adventurer', { height: 1.78 }).then(R => {
    if (!R) return;
    const p = pm.parts, G = pm.mesh;
    G.add(R.obj);
    const bone = re => { let b = null; R.obj.traverse(o => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
    const hR = bone(/^wrist\.?_?r$/i), hL = bone(/^wrist\.?_?l$/i);
    R.obj.updateMatrixWorld(true); G.updateMatrixWorld(true);
    const mount = (b, items) => {
      if (!b) return;
      const h = new THREE.Group(); b.add(h);
      b.getWorldScale(_v); G.getWorldScale(_v2); h.scale.set(_v2.x / _v.x, _v2.y / _v.y, _v2.z / _v.z);
      for (const [it, pos, rot] of items) { it.userData.home = [it.parent, it.position.clone(), it.rotation.clone()]; h.add(it); it.position.set(...pos); it.rotation.set(...rot); }
    };
    mount(hR, [[p.sword, [0, 0.08, 0.02], [Math.PI, 0, 0]]]);
    mount(hL, [[p.bow, [0, 0.08, 0.04], [0, 0, 0]], [p.shield, [-0.08, 0.1, 0], [0, 0, 0]]]);
    // body / legs materials follow the procedural gear colours (tier tint)
    R.matKind = R.mats.map(m => /leg|pant|feet|boot|shoe/i.test(m.name) ? 'legs' : /skin|eye|hair|face|black|white/i.test(m.name) ? null : 'body');
    pm.rig = R; R.on = false;
  });
}
export function showPlayerRig(pm, on) {
  const R = pm.rig; if (!R || R.on === on) return;
  R.on = on; R.obj.visible = on;
  const p = pm.parts;
  for (const c of [p.body, p.leftArm, p.rightArm, p.leftLeg, p.rightLeg]) if (c) c.visible = !on;
}
const _wc = new THREE.Color(1, 1, 1), _tc = new THREE.Color();
export function drivePlayer(pm, dt, running) {
  const R = pm.rig; if (!R || !R.on) return;
  const p = pm.parts;
  // tier tint, cheap: 3 colour lerps per material
  R.mats.forEach((m, i) => { const k = R.matKind[i]; if (!k) return; const src = k === 'legs' ? p.legMat.color : p.bodyMat.color, hx = src.getHex(); if (hx === 0x6b4423 || hx === 0x3a2a1a) { m.color.copy(m.userData.base); return; } m.color.copy(m.userData.base).multiply(_tc.copy(_wc).lerp(src, 0.6).multiplyScalar(1.3)); });
  let trig = null;
  const a = pm.actionAnim || 0;
  if (a > (R.pa || 0) + 0.3) trig = pm.actionKind === 'bow' ? 'shoot' : /melee|chop|mine|smith/.test(pm.actionKind) ? 'attack' : 'interact';
  else if ((pm.hitT || 0) > (R.ph || 0) + 0.3) trig = 'hit';
  R.pa = a; R.ph = pm.hitT || 0;
  if (pm.dodge && R.curSt !== 'roll') trig = 'roll';
  drive(R, dt, pm.moving ? (running ? 'run' : 'walk') : 'idle', trig);
}

// ---- NPCs and companions: rigged by role, procedural kit stays as Low / far / fallback look ----
const NPC_FOLK = ['characters/folk_m_a', 'characters/folk_f_a', 'characters/folk_m_b', 'characters/folk_f_b', 'characters/folk_m_c', 'characters/folk_f_c'];
const hstr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export function npcRigSpec(name, look = {}) {
  if (/wizard|mage|sage|seer|druid|witch|chronicler|scholar|alchemist|hermit|oracle/i.test(name)) return T('wizard');
  if (/guard|knight|captain|soldier|squire|warden|sergeant|sentry|marshal/i.test(name)) return T('matt', look.body ?? 0xb0b0c0, 0.4);
  if (/ogre|grumsh|brute/i.test(name)) return T('orc_enemy', 0x9a8a5a, 0.4);
  if (/pirate|sailor|deckhand|bosun|smuggler/i.test(name)) return T('sam', look.body ?? null, 0.35);
  const h = hstr(name);
  return { m: NPC_FOLK[RS.touch ? h % 2 : h % NPC_FOLK.length], tint: null, k: 0 };
}
const NPC_DIST = 45;
export function npcRig(e, camX, camZ) {
  if (e.rig === undefined) {
    if (!wantRigs()) return;
    const d = Math.hypot(e.mesh.position.x - camX, e.mesh.position.z - camZ);
    if (d > (RS.touch ? 30 : NPC_DIST)) return;
    e.rig = null;
    const V = npcRigSpec(e.name || '', e.look);
    makeRig(V.m, { height: 1.72, tint: V.tint, k: V.k }).then(R => { if (R) { e.rig = R; e.mesh.add(R.obj); R.obj.visible = false; } });
    return;
  }
  if (e.rig) showRig(e, wantRigs() && !!e.mesh.parent && Math.hypot(e.mesh.position.x - camX, e.mesh.position.z - camZ) < (RS.touch ? 32 : NPC_DIST + 3));
}
export function driveNpc(e, dt) {
  const R = e.rig; if (!R || !R.on) return;
  const p = e.mesh.position, sp = e._rp ? Math.hypot(p.x - e._rp.x, p.z - e._rp.z) / Math.max(dt, 1e-3) : 0;
  e._rp = (e._rp || new THREE.Vector3()).copy(p);
  e._sp = (e._sp || 0) * 0.8 + sp * 0.2;
  drive(R, dt, e._sp > 3.2 ? 'run' : e._sp > 0.3 ? 'walk' : 'idle');
}
