// Village runtime: the Sylvaranth ward. Until "The Moonlit Ward" is done, a shimmering dome stands over the elven
// town and anyone who walks into it is turned gently back to the edge. One transparent sphere, no lights.
import * as THREE from 'three';
import { VILLAGES } from './villagedata.js';
import { terrainHeight } from './world.js';

export function installVillages(ctx, isDone) {
  const { scene, player, pm, EXT, log } = ctx;
  const wards = VILLAGES.filter(v => v.ward).map(V => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(V.ward, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(V.x, terrainHeight(V.x, V.z) - 2, V.z); m.renderOrder = 2; scene.add(m);
    return { V, m, warned: 0 };
  });
  const open = W => isDone(player, W.V.gateQuest);
  EXT.extFrame.push(dt => {
    const p = pm.mesh.position;
    for (const W of wards) {
      if (open(W)) { if (W.m.visible) { W.m.visible = false; log(`✨ The ward over ${W.V.name} parts for you.`, 'skill'); } continue; }
      W.m.material.opacity = 0.1 + Math.sin(performance.now() * 0.002) * 0.04;
      const dx = p.x - W.V.x, dz = p.z - W.V.z, d = Math.hypot(dx, dz);
      if (d < W.V.ward) {
        const k = (W.V.ward + 0.6) / Math.max(d, 0.01); p.x = W.V.x + dx * k; p.z = W.V.z + dz * k; pm.target = null;
        if (performance.now() - W.warned > 4000) { W.warned = performance.now(); log(`A cool shimmer turns you aside. Only friends of the elves may enter ${W.V.name}; the envoy outside the ward can tell you more.`, 'game'); }
      }
    }
  });
  EXT.villages = { wards, open: id => { const W = wards.find(w => w.V.id === id); return !W || open(W); } };
}
