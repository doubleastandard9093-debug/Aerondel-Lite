// High/Epic realism for rigged characters (monsters, NPCs, folk, player). Low never calls this.
// - Smooth, crease-aware normals on a cloned geometry (the original faceted geometry stays for Low).
// - MeshPhysicalMaterial per surface kind: skin (warm sheen, soft clearcoat), fur (sheen), cloth,
//   leather, metal, horn/teeth, wet eyes; a small PMREM room environment for reflections.
// - Object-space triplanar micro-normals from the shared noise texture (no UVs needed, 0 bytes download),
//   fading out with distance so far characters cost the same as before.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getNoiseTexture } from './gfx.js';

let ENV = null;
export function initRealismEnv(renderer) {
  if (ENV || !renderer) return ENV;
  const pm = new THREE.PMREMGenerator(renderer);
  ENV = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose();
  return ENV;
}

// --- smooth normals: average face normals of coincident vertices within a crease angle ---
const smoothCache = new WeakMap();
export function smoothGeometry(geo, creaseDeg = 70) {
  if (smoothCache.has(geo)) return smoothCache.get(geo);
  const g = geo.clone();
  const pos = g.attributes.position, n = pos.count;
  const idx = g.index ? g.index.array : null, tri = idx ? idx.length / 3 : n / 3;
  const fn = new Float32Array(tri * 3), vf = Array.from({ length: n }, () => []);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    c.sub(b); a.sub(b); c.cross(a);                 // area-weighted
    fn[t * 3] = c.x; fn[t * 3 + 1] = c.y; fn[t * 3 + 2] = c.z;
    vf[i0].push(t); vf[i1].push(t); vf[i2].push(t);
  }
  const key = i => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const groups = new Map();
  for (let i = 0; i < n; i++) { const k = key(i); let l = groups.get(k); if (!l) groups.set(k, l = []); l.push(i); }
  const cos = Math.cos(creaseDeg * Math.PI / 180), out = new Float32Array(n * 3), own = new THREE.Vector3(), s = new THREE.Vector3(), f = new THREE.Vector3();
  for (const l of groups.values()) {
    const faces = []; for (const i of l) for (const t of vf[i]) faces.push(t);
    for (const i of l) {
      own.set(0, 0, 0); for (const t of vf[i]) own.x += fn[t * 3], own.y += fn[t * 3 + 1], own.z += fn[t * 3 + 2];
      own.normalize(); s.set(0, 0, 0);
      for (const t of faces) { f.set(fn[t * 3], fn[t * 3 + 1], fn[t * 3 + 2]); if (f.clone().normalize().dot(own) >= cos) s.add(f); }
      if (s.lengthSq() < 1e-12) s.copy(own); s.normalize();
      out[i * 3] = s.x; out[i * 3 + 1] = s.y; out[i * 3 + 2] = s.z;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  g.userData.shared = true;
  smoothCache.set(geo, g);
  return g;
}

// --- surface kinds from material names (Quaternius / Kenney naming) ---
const FURRY = /wolf|cow|yeti|spider/;
export function surfaceKind(matName, model = '') {
  const n = (matName || '').toLowerCase();
  if (/eye/.test(n)) return 'eye';
  if (/gold|metal|steel|iron|grey|gray|silver/.test(n)) return 'metal';
  if (/horn|hoove|teeth|tooth|nose|claw/.test(n)) return 'horn';
  if (/tongue|mouth/.test(n)) return 'wet';
  if (/belt|strap|brown|leather|boot/.test(n)) return 'leather';
  if (/wood/.test(n)) return 'wood';
  if (/hair|eyebrow/.test(n)) return 'hair';
  if (/skin|muzzle/.test(n)) return 'skin';
  if (/ghost/.test(n)) return 'ghost';
  if (/main|secondary|light|^material/.test(n)) return FURRY.test(model) ? 'fur' : /dragon|demon|orc|goblin|giant|zombie/.test(model) ? 'hide' : 'cloth';
  if (/atlas/.test(n)) return /skeleton/.test(model) ? 'bone' : 'hide';
  return 'cloth';
}
const K = {   // rough, metal, sheen, sheenRough, clearcoat, ccRough, bump, bumpScale(1/m), env
  skin:    [0.52, 0.0, 0.35, 0.45, 0.10, 0.55, 0.10, 38, 0.30],
  hide:    [0.62, 0.0, 0.10, 0.55, 0.12, 0.6, 0.20, 22, 0.30],
  fur:     [0.85, 0.0, 1.00, 0.35, 0.0, 0.0, 0.35, 55, 0.20],
  hair:    [0.55, 0.0, 0.80, 0.25, 0.0, 0.0, 0.25, 70, 0.30],
  cloth:   [0.82, 0.0, 0.70, 0.60, 0.0, 0.0, 0.22, 48, 0.20],
  leather: [0.58, 0.0, 0.15, 0.6, 0.25, 0.5, 0.28, 30, 0.35],
  wood:    [0.78, 0.0, 0.0, 0.0, 0.05, 0.6, 0.35, 18, 0.20],
  metal:   [0.32, 0.9, 0.0, 0.0, 0.0, 0.0, 0.10, 60, 1.00],
  horn:    [0.40, 0.0, 0.0, 0.0, 0.45, 0.25, 0.15, 30, 0.50],
  bone:    [0.68, 0.0, 0.10, 0.6, 0.15, 0.45, 0.30, 26, 0.30],
  wet:     [0.30, 0.0, 0.0, 0.0, 0.60, 0.10, 0.05, 40, 0.60],
  eye:     [0.10, 0.0, 0.0, 0.0, 1.00, 0.03, 0.0, 1, 0.90],
  ghost:   [0.30, 0.0, 0.40, 0.3, 0.30, 0.2, 0.0, 1, 0.60],
};
const SKIN_SHEEN = new THREE.Color(0xff9a80), WHITE = new THREE.Color(1, 1, 1);

function microNormal(mat, strength, scale, unit = 1) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.tMicro = { value: getNoiseTexture() }; sh.uniforms.microK = { value: strength }; sh.uniforms.microS = { value: scale * unit };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMicroP; varying vec3 vMicroW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMicroP = position;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvMicroW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMicroP; varying vec3 vMicroW; uniform sampler2D tMicro; uniform float microK; uniform float microS;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        float d = length(cameraPosition - vMicroW);
        float k = microK * (1.0 - smoothstep(10.0, 28.0, d));
        if (k > 0.003) {
          vec3 p = vMicroP * microS;
          vec3 w = abs(normal); w = pow(w, vec3(4.0)); w /= (w.x + w.y + w.z + 1e-4);
          vec2 g = (texture2D(tMicro, p.yz).rg - 0.5) * w.x + (texture2D(tMicro, p.xz).rg - 0.5) * w.y + (texture2D(tMicro, p.xy).rg - 0.5) * w.z;
          vec2 g2 = (texture2D(tMicro, p.xy * 3.1 + 0.3).gb - 0.5);
          vec3 t = normalize(cross(normal, vec3(0.0, 1.0, 0.07))), bt = cross(normal, t);
          normal = normalize(normal + (t * (g.x + g2.x * 0.5) + bt * (g.y + g2.y * 0.5)) * k * 2.0);
        }
      }`);
  };
  mat.customProgramCacheKey = () => 'micro';
}

// Physical copy of a cheap material. Colour/map/vertexColors carried over; caller keeps userData.base.
export function richMaterial(m, model = '', unit = 1) {
  const kind = surfaceKind(m.name, model), [r, me, sh, shr, cc, ccr, bump, bs, env] = K[kind];
  const p = new THREE.MeshPhysicalMaterial({
    name: m.name, color: m.color.clone(), map: m.map || null, vertexColors: !!m.vertexColors,
    transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest,
    emissive: m.emissive ? m.emissive.clone() : new THREE.Color(0), emissiveMap: m.emissiveMap || null, emissiveIntensity: m.emissiveIntensity ?? 1,
    roughness: r, metalness: me, clearcoat: cc, clearcoatRoughness: ccr,
    sheen: sh, sheenRoughness: shr, envMap: ENV, envMapIntensity: env, specularIntensity: kind === 'fur' || kind === 'cloth' ? 0.35 : 0.5,
  });
  if (sh > 0) p.sheenColor.copy(kind === 'skin' ? SKIN_SHEEN : WHITE).lerp(p.color, kind === 'skin' ? 0.3 : kind === 'fur' ? 0.55 : 0.8);
  if (kind === 'ghost') { p.transparent = true; p.opacity = Math.min(p.opacity, 0.82); p.emissive.copy(p.color).multiplyScalar(0.25); }
  if (bump > 0) microNormal(p, bump, bs, unit);
  p.userData.kind = kind;
  return p;
}

// Upgrade a loaded (skinned) object in place: smooth geometry + physical materials. Returns material list.
// height: the character's real height in world units (used to scale micro detail to ~mm-cm features).
export function realify(obj, model = '', height = 1.75) {
  const mats = [], bb = new THREE.Box3(); let ext = 0;
  obj.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox); ext = Math.max(ext, bb.max.y - bb.min.y, bb.max.x - bb.min.x, bb.max.z - bb.min.z); } });
  const unit = height / Math.max(1e-4, ext);
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (o.geometry && o.geometry.attributes.normal) o.geometry = smoothGeometry(o.geometry);
    const up = m => { const r = richMaterial(m, model, unit); r.userData.base = (m.userData.base || m.color).clone(); mats.push(r); return r; };
    o.material = Array.isArray(o.material) ? o.material.map(up) : up(o.material);
    o.receiveShadow = true;
  });
  return mats;
}
