// Engrave Sigils (adapted from Lost Ark's engravings): up to 5 build-defining perks, each tier I–III, learned from Sigil tomes.
import { NORM, obj, arr } from './state.js';
const T = [0, 1, 3, 6];   // tomes needed for tier I, II, III
export const SIGILS = {
  ambush: ['Ambush', 'damage on a foe at full health', [0.25, 0.4, 0.6]],
  ricochet: ['Ricochet Master', 'chakram hits bounce to extra foes', [1, 2, 3]],
  keen: ['Keen Eye', 'accuracy', [0.04, 0.07, 0.1]],
  grudge: ['Grudgebearer', 'damage against bosses', [0.08, 0.12, 0.16]],
  bulwark: ['Bulwark', 'less damage taken', [0.04, 0.06, 0.08]],
  surge: ['Surging Soul', 'Overflare gain', [0.15, 0.25, 0.35]],
  breaker: ['Crestbreaker', 'stagger built', [0.2, 0.35, 0.5]],
  scholar: ['Battle Scholar', 'combat XP', [0.05, 0.08, 0.12]],
  cadence: ['Blade Cadence', 'damage with katanas and scimitars', [0.06, 0.09, 0.12]],
  arcanum: ['Arcanum', 'Magic damage', [0.06, 0.09, 0.12]],
  deadeye: ['Deadeye', 'Ranged damage', [0.06, 0.09, 0.12]]
};
NORM.sigils = v => { v = obj(v); const read = {}; for (const [k, n] of Object.entries(obj(v.read))) if (SIGILS[k]) read[k] = Math.max(0, Math.min(6, Math.floor(+n || 0))); return { read, on: [...new Set(arr(v.on).filter(k => SIGILS[k]))].slice(0, 5) }; };
export default function sigils(A) {
  const { ctx } = A, G = () => A.S('sigils');
  A.sigTier = k => { const n = G().read[k] || 0; return n >= 6 ? 3 : n >= 3 ? 2 : n >= 1 ? 1 : 0; };
  A.sig = k => (G().on.includes(k) && A.sigTier(k) ? SIGILS[k][2][A.sigTier(k) - 1] : 0);
  A.mods.dmg.push(m => (m && m.hp >= m.maxHp ? A.sig('ambush') : 0) + (A.isBossy(m) ? A.sig('grudge') : 0) + (['katana', 'scimitar'].includes(A.weapon().cls) ? A.sig('cadence') : 0) + (A.style() === 'Magic' ? A.sig('arcanum') : 0) + (A.style() === 'Ranged' ? A.sig('deadeye') : 0));
  A.mods.acc.push(() => A.sig('keen'));
  A.mods.dr.push(() => A.sig('bulwark'));
  A.mods.xp.push(s => (['Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Swordsmanship', 'Hitpoints'].includes(s) ? A.sig('scholar') : 0));
  if (A.flareGain) A.flareGain.push(() => A.sig('surge'));
  if (A.stagMul) A.stagMul.push(() => A.sig('breaker'));
  let bouncing = false;
  ctx.EXT.extHit.push((mon, d, now, kind) => { const n = A.sig('ricochet'); if (!n || bouncing || A.weapon().cls !== 'chakram' || d <= 0 || kind === 'strike') return;
    bouncing = true; try { const p = mon.mesh.position; for (const m of A.monsNear(p.x, p.z, 6, n + 1).filter(m => m !== mon).slice(0, n)) ctx.strike(m, { dmg: -0.4 }, now, { quiet: true }); } finally { bouncing = false; } });
  A.study = k => { if (!SIGILS[k]) return; if ((G().read[k] || 0) >= 6) return A.log('That sigil is already at tier III.', 'info'); if (!A.take('Sigil tome')) return A.log('You need a Sigil tome (bosses, broken parts, or Glyphcraft 30: 25 Havoc runes + 2 Soft leather).', 'warn');
    const t0 = A.sigTier(k); G().read[k] = (G().read[k] || 0) + 1; const t = A.sigTier(k); A.log(t > t0 ? `You engrave ${SIGILS[k][0]} ${'I'.repeat(t)}.` : `You study ${SIGILS[k][0]} (${G().read[k]}/${T[t + 1]} toward the next tier).`, 'skill'); A.dirty(); };
  A.sigToggle = k => { const g = G(); if (g.on.includes(k)) g.on = g.on.filter(x => x !== k); else if (!A.sigTier(k)) A.log('Study a tome for this sigil first.', 'warn'); else if (g.on.length >= 5) A.log('All 5 sigil slots are full. Remove one first.', 'warn'); else g.on.push(k); A.dirty(); };
  A.guide.push(['Engrave Sigils', 'Ventures ✦ → Sigils. Spend Sigil tomes (boss drops, broken parts, or Glyphcraft 30) to learn sigils, tiers I–III (1, 3 and 6 tomes). Engrave up to 5 at once.']);
  A.tab({ id: 'sigils', icon: '📕', name: 'Sigils', render: () => { const g = G();
    return `<h4>Engraved ${g.on.length}/5 · tomes held ${A.count('Sigil tome')}</h4>` + Object.entries(SIGILS).map(([k, [n, what, v]]) => { const t = A.sigTier(k), on = g.on.includes(k), val = x => (x < 1 ? `+${Math.round(x * 100)}%` : `+${x}`);
      return `<div class="row" style="align-items:center;gap:6px;margin:4px 0"><span style="flex:1;font-size:13px"><b>${n}</b> ${t ? 'I'.repeat(t) : '<span class="muted">unlearned</span>'}<br><small>${v.map(val).join(' / ')} ${what}</small></span><button data-a="study" data-k="${k}" style="min-height:40px">📖</button><button data-a="tog" data-k="${k}" style="min-height:40px">${on ? '✔ On' : 'Off'}</button></div>`; }).join(''); },
    act: (a, d) => { if (a === 'study') A.study(d.k); if (a === 'tog') A.sigToggle(d.k); } });
  A.vtests = A.vtests || {};
  A.vtests.sigils = async (g, A) => { g.player.inventory['Sigil tome'] = 3; A.study('keen'); A.study('keen'); A.study('keen'); A.sigToggle('keen'); const ok = A.sigTier('keen') === 2 && A.sig('keen') === 0.07; A.sigToggle('keen'); return ok; };
}
