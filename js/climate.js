// Climate-region atmosphere: fog colour/density blend and light particles (snow, ash, sand, spores, leaves).
// One THREE.Points cloud that follows the camera; 160 particles on phones/Low, 520 on desktop High.
// Nothing is drawn (or updated) outside the regions.
import * as THREE from 'three';
import { REGION_DATA, BIOMES, regionWeight } from './regiondata.js';

const LOOK = {
  snow:   { color: 0xffffff, size: 0.16, fall: 1.6, drift: 0.6, opacity: 0.9 },
  ash:    { color: 0x3a3230, size: 0.12, fall: 0.6, drift: 0.8, opacity: 0.85, ember: 0xff7a2a },
  sand:   { color: 0xe0c890, size: 0.08, fall: 0.15, drift: 5.5, opacity: 0.6 },
  spores: { color: 0xc8e88a, size: 0.1, fall: -0.15, drift: 0.35, opacity: 0.75 },
  leaves: { color: 0x6aa83a, size: 0.14, fall: 0.8, drift: 1.2, opacity: 0.9 },
};
const BOX = 36, H = 16;

export function createClimate(scene, { lite = false } = {}) {
  const n = lite ? 160 : 520;
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * BOX; pos[i * 3 + 1] = Math.random() * H; pos[i * 3 + 2] = (Math.random() - 0.5) * BOX; seed[i] = Math.random() * 6.28; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.9, depthWrite: false, fog: true });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5; pts.name = 'climateParticles';
  scene.add(pts);
  const fogC = new THREE.Color();
  const st = { region: null, k: 0, base: null, lastSet: null, t: 0 };

  return {
    get region() { return st.k > 0.35 ? st.region : null; },
    setLite(v) { lite = v; },
    update(dt, px, pz, py = 0) {
      st.t += dt;
      let best = null, w = 0;
      for (const R of REGION_DATA) { const k = regionWeight(R, px, pz); if (k > w) { w = k; best = R; } }
      if (best) st.region = best;
      st.k += (w - st.k) * Math.min(1, dt * 1.5);
      // fog: blend colour and thicken (main resets colour each frame in updateCave, density only on quality change)
      if (scene.fog && st.region && st.k > 0.01) {
        const B = BIOMES[st.region.biome];
        fogC.setHex(B.fog); scene.fog.color.lerp(fogC, 0.55 * st.k);
        if (scene.background && scene.background.isColor) scene.background.copy(scene.fog.color);
        if (scene.fog.density !== st.lastSet) st.base = scene.fog.density;
        scene.fog.density = st.lastSet = st.base * (1 + (B.fogK - 1) * st.k);
      } else if (scene.fog && st.lastSet != null) {
        if (scene.fog.density === st.lastSet) scene.fog.density = st.base;
        st.lastSet = null;
      }
      const L = st.region && LOOK[BIOMES[st.region.biome].particles];
      const show = !!L && st.k > 0.05;
      pts.visible = show;
      if (!show) return;
      mat.color.setHex(L.color); mat.size = L.size * (lite ? 1.3 : 1); mat.opacity = L.opacity * Math.min(1, st.k * 1.5);
      pts.position.set(px, py - 3, pz);
      const m = lite ? Math.min(n, 160) : n;
      geo.setDrawRange(0, m);
      const t = st.t, hx = BOX / 2;
      for (let i = 0; i < m; i++) {
        const j = i * 3, s = seed[i];
        let x = pos[j] + (L.drift * (0.6 + 0.4 * Math.sin(t * 0.7 + s))) * dt, y = pos[j + 1] - L.fall * (0.7 + 0.3 * Math.sin(s * 3)) * dt, z = pos[j + 2] + Math.cos(t * 0.9 + s) * L.drift * 0.4 * dt;
        if (y < 0) y += H; else if (y > H) y -= H;
        if (x > hx) x -= BOX; else if (x < -hx) x += BOX;
        if (z > hx) z -= BOX; else if (z < -hx) z += BOX;
        pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
      }
      // keep the cloud steady in world space while the box follows the player
      geo.attributes.position.needsUpdate = true;
    },
  };
}
