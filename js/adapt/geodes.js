// Sealed Geodes (adapted from The First Descendant's amorphous materials): each geode opens only when you beat a named boss or clear a named Breach.
// Opening gives one of 4 parts of a relic recipe; a full set (core, hilt, shell, sigil-plate) forges a permanent relic bonus.
import { ITEMS, ICONS, FRONTIER_UNIQUES } from '../items.js';
import { NORM, obj, arr } from './state.js';
const F = FRONTIER_UNIQUES.map(u => u[0]);
export const GEODES = {
  'Ember geode': { boss: F[0], relic: 'Emberheart Relic', fx: { dmg: 0.04 }, ic: '#e05a2a' },
  'Rime geode': { boss: F[3] || F[1], relic: 'Rimewall Relic', fx: { dr: 0.04 }, ic: '#6ac0f0' },
  'Storm geode': { breach: 'ward', relic: 'Stormsight Relic', fx: { acc: 0.05 }, ic: '#e0d04a' },
  'Void geode': { breach: 'nodes', relic: 'Voidspring Relic', fx: { xp: 0.06 }, ic: '#8a4ae0' }
};
const PARTS = ['core', 'hilt', 'shell', 'sigil-plate'];
for (const [n, g] of Object.entries(GEODES)) { ITEMS[n] = { value: 800, type: 'misc', examine: `Sealed. It opens when you ${g.boss ? `defeat the ${g.boss}` : `clear a ${g.breach === 'ward' ? 'Hold the Ward' : 'Sever the Nodes'} Breach Run`} while carrying it.` }; ICONS[n] = ['🪨', g.ic + '80']; }
NORM.geodes = v => { v = obj(v); const parts = {}; for (const g of Object.keys(GEODES)) parts[g] = [...new Set(arr(obj(v.parts)[g]).filter(p => PARTS.includes(p)))]; return { parts, relics: [...new Set(arr(v.relics).filter(r => Object.values(GEODES).some(g => g.relic === r)))] }; };
export default function geodes(A) {
  const { ctx } = A, G = () => A.S('geodes');
  const relicSum = k => G().relics.reduce((t, r) => t + (Object.values(GEODES).find(g => g.relic === r).fx[k] || 0), 0);
  A.mods.dmg.push(() => relicSum('dmg')); A.mods.dr.push(() => relicSum('dr')); A.mods.acc.push(() => relicSum('acc')); A.mods.xp.push(() => relicSum('xp'));
  A.geodeOpen = name => { if (!A.take(name)) return false; const have = G().parts[name], left = PARTS.filter(p => !have.includes(p));
    if (!left.length) { player().gold += 2000; A.log(`The ${name} cracks open: 2,000 coins (you already have every part).`, 'loot'); return true; }
    const p = left[Math.floor(Math.random() * left.length)]; have.push(p); A.log(`The ${name} cracks open: ${GEODES[name].relic} ${p} (${have.length}/4).`, 'loot'); A.dirty(); return true; };
  const player = () => ctx.player;
  A.relicForge = name => { const g = GEODES[name]; if (G().parts[name].length < 4 || G().relics.includes(g.relic)) return; if (A.lvl('Smithing') < 40) return A.log('Forging a relic needs Smithing 40.', 'warn');
    G().relics.push(g.relic); ctx.giveXP('Smithing', 2500); A.log(`You forge the ${g.relic}! It is a permanent bonus.`, 'skill'); A.dirty(); };
  ctx.EXT.extKill.push(m => { for (const [n, g] of Object.entries(GEODES)) if (g.boss && m.name === g.boss && A.count(n)) A.geodeOpen(n);
    if (!m.venture && Math.random() < (A.isBossy(m) ? 0.2 : 0.006 + Math.min(0.01, (m.level || 1) / 50000))) { const n = Object.keys(GEODES)[Math.floor(Math.random() * 4)]; A.give(n); A.log(`A sealed ${n} drops! (${GEODES[n].boss ? `opens on a ${GEODES[n].boss} kill` : 'opens on a Breach clear'})`, 'loot'); } });
  if (A.onBreachClear) A.onBreachClear.push(r => { for (const [n, g] of Object.entries(GEODES)) if (g.breach === r.mode && A.count(n)) A.geodeOpen(n); if (Math.random() < 0.3) A.give(Object.keys(GEODES)[Math.floor(Math.random() * 4)]); });
  A.guide.push(['Sealed Geodes', 'Geodes drop from foes (bosses often). Each one opens only when you beat a named boss or clear a named Breach while carrying it, giving 1 of 4 relic parts. All 4 parts + Smithing 40 forge a permanent relic (Ventures ✦ → Geodes).']);
  A.tab({ id: 'geodes', icon: '🪨', name: 'Geodes', render: () => Object.entries(GEODES).map(([n, g]) => { const have = G().parts[n], done = G().relics.includes(g.relic);
    const fx = Object.entries(g.fx).map(([k, v]) => `+${Math.round(v * 100)}% ${{ dmg: 'damage', dr: 'less damage taken', acc: 'accuracy', xp: 'combat XP' }[k]}`).join('');
    return `<div style="margin:6px 0"><b>${n}</b> ×${A.count(n)} <small>— opens on ${g.boss ? `a ${A.esc(g.boss)} kill` : `a ${g.breach === 'ward' ? 'Hold the Ward' : 'Sever the Nodes'} Breach clear`}</small><br><small>${g.relic} (${fx}): ${PARTS.map(p => `${have.includes(p) ? '✔' : '○'} ${p}`).join(' ')}</small>${done ? ' <b>✔ forged</b>' : have.length >= 4 ? `<div class="row"><button data-a="forge" data-g="${n}">🔨 Forge relic</button></div>` : ''}</div>`; }).join(''),
    act: (a, d) => { if (a === 'forge') A.relicForge(d.g); } });
  A.vtests = A.vtests || {};
  A.vtests.geodes = async (g, A) => { g.player.inventory['Ember geode'] = 4; for (let i = 0; i < 4; i++) g.EXT.extKill.forEach(f => { try { f({ name: GEODES['Ember geode'].boss }, 0); } catch (e) { /* other hooks */ } });
    return A.S('geodes').parts['Ember geode'].length === 4; };
}
