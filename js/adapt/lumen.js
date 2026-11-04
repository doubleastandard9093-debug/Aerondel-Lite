// Lumen Rise (adapted from Destiny 2's power level): once a combat skill reaches 1000, a Lumen score climbs 1000 → 1100 through boss kills,
// with weekly Pinnacle chests (Vigil Gates, Burst Tide boss waves) giving the biggest jumps. Kept apart from skill XP.
import { NORM, obj, num } from './state.js';
const week = () => Math.floor((Date.now() / 86400000 + 3) / 7);   // weeks since epoch, rolling on Monday (UTC)
NORM.lumen = v => { v = obj(v); return { score: num(v.score, 1000, 1000, 1100), week: Math.floor(num(v.week, 0)), pinn: Math.floor(num(v.pinn, 0, 0, 9)) }; };
export default function lumen(A) {
  const { ctx } = A, L = () => A.S('lumen');
  A.lumenOn = () => ['Attack', 'Strength', 'Defence', 'Ranged', 'Magic', 'Swordsmanship', 'Hitpoints'].some(s => A.lvl(s) >= 1000);
  const gain = n => { if (!A.lumenOn()) return; const l = L(); const b = l.score; l.score = Math.min(1100, l.score + n); if (Math.floor(l.score) > Math.floor(b)) A.log(`Lumen rises to ${Math.floor(l.score)}.`, 'skill'); A.dirty(); };
  A.lumenGain = gain;
  A.pinnacle = (src) => { if (!A.lumenOn()) return false; const l = L(); if (l.week !== week()) { l.week = week(); l.pinn = 0; } if (l.pinn >= 3) return false; l.pinn++; const n = Math.max(1, 6 - (l.score - 1000) / 25); A.log(`Pinnacle chest (${src})!`, 'loot'); gain(n); if (A.bonusDrop) A.bonusDrop({ level: 900 }, 'the Pinnacle chest'); return true; };
  ctx.EXT.extKill.push(m => { if (!A.lumenOn()) return; if (m.tideBoss) A.pinnacle('Burst Tide'); else if (A.isBossy(m)) gain(Math.max(0.05, 0.5 - (L().score - 1000) / 250)); });
  const bonus = () => (A.lumenOn() ? (L().score - 1000) * 0.001 : 0);   // up to +10%
  A.mods.dmg.push(bonus); A.mods.dr.push(() => bonus() / 2);
  A.guide.push(['Lumen Rise', 'After any combat skill reaches 1000, Ventures ✦ → Lumen tracks a score from 1000 to 1100. Boss kills raise it a little (less as it climbs); up to 3 weekly Pinnacle chests (Vigil Gates and Burst Tide boss waves) raise it most. Each point is +0.1% damage and +0.05% damage reduction.']);
  A.tab({ id: 'lumen', icon: '🔆', name: 'Lumen', render: () => { const l = L(); if (!A.lumenOn()) return '<h4>Lumen Rise</h4><p>Reach level 1000 in any combat skill to begin.</p>';
    const pin = l.week === week() ? l.pinn : 0; return `<h4>Lumen ${Math.floor(l.score)} / 1100</h4><div class="bar"><i style="width:${l.score - 1000}%"></i></div><p>+${(bonus() * 100).toFixed(1)}% damage, ${(bonus() * 50).toFixed(1)}% less damage taken.</p><p><small>Pinnacle chests this week: ${pin}/3 (Vigil Gates clears, Burst Tide boss waves). Resets Monday 00:00 UTC.</small></p>`; } });
  A.vtests = A.vtests || {};
  A.vtests.lumen = async (g, A) => { const sk = A.skills.Magic, old = sk.level; sk.level = 1000; try { return await Tlumen(g, A); } finally { sk.level = old; } };
  const Tlumen = async (g, A) => { if (!A.lumenOn()) return 'locked (ok: needs 1000)'; const s0 = A.S('lumen').score; A.pinnacle('test'); return A.S('lumen').score > s0; };
}
