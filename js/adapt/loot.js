// Shared loot for Ventures: Sigil tomes and Grafts drop from bosses, break parts and reliquaries.
import { ITEMS, ICONS, RECIPES } from '../items.js';
export const GRAFTS = { Keen: ['acc', '🎯', 'accuracy'], Brutal: ['dmg', '🗡️', 'damage'], Warding: ['dr', '🛡️', 'damage reduction'], Fervent: ['flare', '⚡', 'Overflare gain'] };
export const GRAFT_VAL = { Lesser: 0.02, Greater: 0.05, Exalted: 0.09 };
const def = (n, o, ic) => { ITEMS[n] = { value: 1, ...o }; ICONS[n] = ic; };
def('Sigil tome', { type: 'misc', value: 500, examine: 'Study it in Ventures → Sigils to learn or deepen a sigil.' }, ['📕', '#8a3ad050']);
for (const [g, [, ic]] of Object.entries(GRAFTS)) for (const t of Object.keys(GRAFT_VAL)) def(`${t} ${g.toLowerCase()} graft`, { type: 'misc', value: { Lesser: 300, Greater: 1500, Exalted: 6000 }[t], examine: `Socket it into gear at Graftwright Oren (Ventures → Grafts).` }, [ic, '#6ad0c050']);
const R = r => { if (!RECIPES.some(x => x.output === r.output)) RECIPES.push({ station: null, tool: null, ...r }); };
R({ name: 'Bind Sigil tome', cat: 'Crafting', group: 'Ventures', skill: 'Glyphcraft', level: 30, inputs: { 'Havoc rune': 25, 'Soft leather': 2 }, output: 'Sigil tome', xp: 120 });
R({ name: 'Forge Lesser keen graft', cat: 'Smithing', group: 'Ventures', skill: 'Smithing', level: 30, inputs: { 'Iron bar': 3, 'Air rune': 20 }, output: 'Lesser keen graft', xp: 60, station: 'anvil' });
R({ name: 'Forge Lesser brutal graft', cat: 'Smithing', group: 'Ventures', skill: 'Smithing', level: 30, inputs: { 'Iron bar': 3, 'Fire rune': 20 }, output: 'Lesser brutal graft', xp: 60, station: 'anvil' });
R({ name: 'Forge Lesser warding graft', cat: 'Smithing', group: 'Ventures', skill: 'Smithing', level: 30, inputs: { 'Iron bar': 3, 'Earth rune': 20 }, output: 'Lesser warding graft', xp: 60, station: 'anvil' });
R({ name: 'Forge Lesser fervent graft', cat: 'Smithing', group: 'Ventures', skill: 'Smithing', level: 30, inputs: { 'Iron bar': 3, 'Water rune': 20 }, output: 'Lesser fervent graft', xp: 60, station: 'anvil' });
export default function loot(A) {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  A.rollLoot = (big) => { const r = Math.random(); if (r < 0.4) return 'Sigil tome'; return `${big && Math.random() < 0.3 ? 'Greater' : 'Lesser'} ${pick(Object.keys(GRAFTS)).toLowerCase()} graft`; };
  A.bonusDrop = (mon, why) => { const it = A.rollLoot((mon && mon.level || 0) >= 200); A.give(it); A.log(`Bonus from ${why}: ${it}.`, 'loot'); };
  A.ctx.EXT.extKill.push(mon => { if (A.isBossy(mon) && Math.random() < 0.15) A.bonusDrop(mon, `the ${mon.name}`); });
}
