// Crestbreak (adapted from Lost Ark's stagger and weak points): bosses carry a stagger bar and two breakable parts.
// Heavy techniques, war fans and glaives build stagger fastest; a break stuns the boss, opens it to bonus damage (katanas most) and adds a drop.
import { NORM, obj, num } from './state.js';
NORM.crest = v => { v = obj(v); return { breaks: Math.floor(num(v.breaks, 0, 0)) }; };
const PARTS = ['crest', 'core'];
export default function crestbreak(A) {
  const { ctx } = A;
  A.stagMul = [];   // sigils etc. add fractional bonuses
  let lastSpecial = null;
  ctx.EXT.extSwing.push((mon, swings, ranged, special) => { lastSpecial = special || null; });
  A.partName = (m, i) => (/wyrm|drake|dragon/i.test(m.name) ? ['horn', 'scale-heart'] : /golem|colossus|stonehorn|frost/i.test(m.name) ? ['crystal crest', 'core'] : ['crest', 'core'])[i];
  A.isBroken = m => m && m._brokeUntil && A.tick() < m._brokeUntil;
  A.stagger = (m, n) => {
    if (!A.isBossy(m) || !m.alive) return;
    if (A.isBroken(m)) return;
    m._stag = (m._stag || 0) + n * (1 + A.stagMul.reduce((t, f) => t + (f() || 0), 0));
    if (m._stag >= 100) { m._stag = 0; m._parts = (m._parts || 0) + 1; m._brokeUntil = A.tick() + 8; m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + 3);
      A.S('crest').breaks++; const part = A.partName(m, Math.min(1, m._parts - 1));
      A.log(m._hunt ? `Crestbreak! The ${m.name} is stunned and takes bonus damage.` : `Crestbreak! The ${m.name}'s ${part} shatters. It is stunned and takes bonus damage.`, 'combat');
      if (A.flareAdd) A.flareAdd(15);
      if (ctx.gfxQ() !== 'low') ctx.burst('hit', m.mesh.position.x, m.mesh.position.y + 1.5, m.mesh.position.z, 18); A.dirty(); }
  };
  ctx.EXT.extHit.push((mon, d, now, kind) => {
    if (!A.isBossy(mon) || d <= 0) return;
    const cls = A.weapon().cls; let n = 2 + Math.min(6, d / Math.max(1, mon.maxHp) * 60);
    if (cls === 'warfan' || cls === 'glaive') n *= 2; if (lastSpecial || kind === 'flare') n *= 2.5; if (kind === 'tether') n += 12;
    lastSpecial = null; A.stagger(mon, n);
  });
  A.mods.dmg.push(m => (A.isBroken(m) ? (A.weapon().cls === 'katana' ? 0.7 : 0.4) : 0));
  ctx.EXT.extKill.push(mon => { if (!mon._parts) return; for (let i = 0; i < Math.min(2, mon._parts); i++) { if (A.bonusDrop) A.bonusDrop(mon, `the broken ${A.partName(mon, i)}`); } });
  // A stagger bar inside the existing target panel (no new screen space).
  const tp = document.getElementById('targetPanel'), bar = document.createElement('div');
  bar.id = 'crestBar'; bar.style.cssText = 'height:5px;margin-top:3px;background:#0006;border-radius:3px;overflow:hidden;display:none';
  bar.innerHTML = '<i style="display:block;height:100%;width:0;background:#e8b84a"></i>'; if (tp) tp.appendChild(bar);
  ctx.EXT.extFrame.push(() => { const t = ctx.target(); const on = !!(t && t.alive && A.isBossy(t)); bar.style.display = on ? 'block' : 'none';
    if (on) { const i = bar.firstChild; i.style.width = (A.isBroken(t) ? 100 : t._stag || 0) + '%'; i.style.background = A.isBroken(t) ? '#e85a4a' : '#e8b84a'; } });
  A.guide.push(['Crestbreak', 'Bosses show a gold stagger bar under their health. War fans, glaives, techniques and Overflare fill it fastest. When it breaks the boss is stunned, takes +40% damage (+70% with a katana) for about 5 seconds, and drops extra loot for each broken part.']);
  A.tab({ id: 'crest', icon: '💥', name: 'Crestbreak', render: () => `<h4>Crestbreak</h4><p>Bosses have a stagger bar (gold, under their health). Fill it to break a part: the boss is stunned, takes +40% damage (+70% with a katana) for 8 ticks, and drops an extra reward on death for each broken part (up to 2).</p><p><small>Stagger builders: war fans and glaives ×2, techniques ×2.5, Overflare, Tetherline strikes. Parts broken so far: ${A.S('crest').breaks}.</small></p>` });
  A.vtests = A.vtests || {};
  A.vtests.crestbreak = async (g, A) => { const m = { name: 'Test Warden', boss: true, alive: true, hp: 100, maxHp: 100, mesh: { position: { x: 0, y: 0, z: 0 } } };
    A.stagger(m, 120); return A.isBroken(m) && A.totals(m).dmg >= 0.4; };
}
