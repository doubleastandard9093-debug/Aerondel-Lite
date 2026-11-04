// Tetherline (grapple): zip to a foe (a staggering strike) or to the nearest tree or rock you face. Key L or the 🪝 button.
export default function tether(A) {
  const { ctx } = A; let ready = 0;
  const cd = () => Math.max(3, 10 - Math.floor(A.lvl('Agility') / 15)) * 1000;
  A.tetherFind = () => { const p = A.pos(), f = ctx.pm.facing || 0, fx = Math.sin(f), fz = Math.cos(f);
    const t = ctx.target(); if (t && t.alive && t.mesh) { const d = Math.hypot(t.mesh.position.x - p.x, t.mesh.position.z - p.z); if (d > 3 && d < 18) return { mon: t, x: t.mesh.position.x, z: t.mesh.position.z, d }; }
    let best = null; for (const n of ctx.nodes) { if (!n || !n.alive || !/tree|rock|ore/i.test(n.type || '')) continue; const x = n.x ?? n.mesh?.position.x, z = n.z ?? n.mesh?.position.z; const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
      if (d < 4 || d > 18 || (dx * fx + dz * fz) / d < 0.5) continue; if (!best || d < best.d) best = { x, z, d }; } return best; };
  A.tether = () => { if (Date.now() < ready) return A.log(`Tetherline recharging (${Math.ceil((ready - Date.now()) / 1000)}s).`, 'game'); if (ctx.pm.dodge) return;
    const a = A.tetherFind(); if (!a) return A.log('Nothing to tether to — face a tree or rock, or target a foe 4–18 m away.', 'game');
    const p = A.pos(), dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz), go = d - 2, ms = 260;
    ctx.pm.dodge = { x: dx / d, z: dz / d, left: ms, speed: go / (ms / 1000) }; ready = Date.now() + cd();
    if (a.mon) setTimeout(() => { if (a.mon.alive) { ctx.strike(a.mon, { acc: 0.3, dmg: 0.2 }, performance.now(), { quiet: true }); for (const f of ctx.EXT.extHit) if (A.stagger && f) { /* stagger via crest */ } if (A.stagger) A.stagger(a.mon, 14); } }, ms);
    if (ctx.gfxQ() !== 'low') ctx.burst('dust', p.x, p.y, p.z, 6); return true; };
  A.key('tether', A.tether);
  A.onQuick('tether', A.tether);
  A.quick(() => { const a = Date.now() >= ready && A.tetherFind(); return a ? [['tether', '🪝Tether', a.mon ? `Tether to the ${a.mon.name} (L)` : 'Tetherline (L)']] : null; });
  A.guide.push(['Tetherline', 'Press L or tap 🪝Tether: zip to your target foe (a strike that builds Crestbreak stagger) or to the tree or rock you face, 4–18 m away. Cooldown 10 s, down to 3 s with Agility.']);
  A.vtests = A.vtests || {};
  A.vtests.tether = async (g, A) => { const p = A.pos(), n = A.ctx.nodes.find(n => /tree|rock/i.test(n.type || '') && n.alive); if (!n) return 'no node'; const x = n.x ?? n.mesh.position.x, z = n.z ?? n.mesh.position.z;
    p.x = x; p.z = z - 9; A.ctx.pm.facing = 0; const ok = A.tether(); await new Promise(r => setTimeout(r, 2000)); return !!ok && Math.hypot(p.x - x, p.z - z) < 8 || `d${Math.round(Math.hypot(p.x - x, p.z - z))}`; };
}
