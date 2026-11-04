// Overflare (adapted from Destiny 2's super meter): fills as you deal and take damage, then unleashes your weapon's ultimate.
import { NORM, num, obj } from './state.js';
NORM.flare = v => { v = obj(v); return { meter: num(v.meter, 0, 0, 100), uses: Math.floor(num(v.uses, 0, 0)) }; };

export const ULTS = {
  katana: ['Thousand Cuts Barrage', 6, 0.45, 0], scimitar: ['Sandstorm Reel', 4, 0.6, 4], glaive: ['Crescent Tempest', 3, 0.8, 5], warfan: ['Gale Sovereign', 3, 0.7, 6],
  chakram: ['Chakram Storm', 4, 0.6, 6], Ranged: ['Starfall Deluge', 4, 0.7, 6], Magic: ['Astral Cataclysm', 3, 0.9, 6], Melee: ["Titan's Overflare", 3, 0.9, 3]
};
export default function overflare(A) {
  const { ctx } = A, F = () => A.S('flare');
  A.flareGain = [];   // other systems add fractional gain bonuses (sigils, attunements)
  const gainMul = () => 1 + A.flareGain.reduce((t, f) => t + (f() || 0), 0);
  let buffUntil = 0, wasFull = false;
  A.flareAdd = n => { const f = F(); f.meter = Math.min(100, f.meter + n * gainMul()); if (f.meter >= 100 && !wasFull) { wasFull = true; A.log('Overflare is ready! Tap Flare (or press U) to unleash it.', 'skill'); } };
  ctx.EXT.extHit.push((mon, d, now, kind) => { if (d > 0 && kind !== 'flare') A.flareAdd(1.5 + Math.min(4, d / Math.max(1, mon.maxHp) * 25)); });
  ctx.EXT.extIncoming.push(dmg => { if (dmg > 0) A.flareAdd(1.2); return dmg; });
  A.mods.dmg.push(() => (A.tick() < buffUntil ? 0.3 : 0));
  A.ult = () => { const w = A.weapon(); return ULTS[w.cls] || ULTS[A.style()] || ULTS.Melee; };
  A.flare = () => {
    const f = F();
    if (f.meter < 100) { A.log(`Overflare is at ${Math.floor(f.meter)}%. Keep fighting to fill it.`, 'game'); return false; }
    const tgt = ctx.target(), p = A.pos(); const [name, hits, bonus, radius] = A.ult();
    const foes = radius ? A.monsNear(p.x, p.z, radius, 6) : []; if (tgt && tgt.alive && !foes.includes(tgt)) foes.unshift(tgt);
    if (!foes.length) { A.log('No foe close enough for your Overflare.', 'warn'); return false; }
    f.meter = 0; f.uses++; wasFull = false; buffUntil = A.tick() + 10;
    A.log(`${name}!`, 'combat');
    const now = performance.now();
    for (let h = 0; h < hits; h++) setTimeout(() => { for (const m of foes.slice(0, radius ? 6 : 1)) ctx.strike(m, { acc: 0.4, dmg: bonus }, performance.now(), { quiet: true });
      if (ctx.gfxQ() !== 'low') { const q = A.pos(); ctx.burst('hit', q.x, q.y + 1.2, q.z, 14); } }, h * 140);
    if (ctx.gfxQ() !== 'low') ctx.burst('dust', p.x, p.y, p.z, 10);
    A.dirty(); return now;
  };
  A.key('overflare', () => A.flare());
  A.onQuick('flare', () => A.flare());
  A.quick(() => (F().meter >= 100 ? [['flare', '⚡Flare', `Overflare: ${A.ult()[0]} (U)`]] : null));
  A.guide.push(['Overflare', 'A meter that fills as you deal and take damage. At 100% a ⚡Flare button appears (or press U) and unleashes your weapon\'s ultimate, then +30% damage for 6 seconds.']);
  A.tab({ id: 'flare', icon: '⚡', name: 'Overflare', render: () => { const f = F(), [n, h, b, r] = A.ult();
    return `<h4>Overflare ${Math.floor(f.meter)}%</h4><div class="bar"><i style="width:${f.meter}%"></i></div>
      <p>Your ultimate with this weapon: <b>${A.esc(n)}</b>: ${h} strikes at +${Math.round(b * 100)}% damage${r ? `, hitting up to 6 foes within ${r} m` : ' on your target'}, then +30% damage for 6 seconds.</p>
      <p><small>Each weapon family has its own: katana Thousand Cuts Barrage, scimitar Sandstorm Reel, glaive Crescent Tempest, war fan Gale Sovereign, chakram Chakram Storm, bows Starfall Deluge, magic Astral Cataclysm, other melee Titan's Overflare. Used ${f.uses} times.</small></p>
      <button data-a="go" ${f.meter < 100 ? 'disabled' : ''}>Unleash (U)</button>`; }, act: a => { if (a === 'go') A.flare(); } });
}
