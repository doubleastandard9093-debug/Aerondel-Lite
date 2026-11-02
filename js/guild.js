// Player guild (PvE). Found a guild with Guildmaster Halvard in Larkhaven, recruit your companions and hired adventurers,
// earn renown from kills, quests and XP, pay into the guild treasury, upgrade the guild hall's rooms and fire timed
// guild boosts. The hall is a simple low-poly building west of Larkhaven (one mesh group, a box collider, no lights).
import * as THREE from 'three';
import { terrainHeight, colliders } from './world.js';
import { COMPANIONS } from './companions.js';
import { ITEMS } from './items.js';

export const HALL = { x: -22, z: 18 };
// rooms: [id, name, what each level does, cost per level (coins), renown needed per level], max level 5
export const ROOMS = [
  ['hall', 'Great hall', 'Seats more members (+3 per level) and +2% renown per level', 4000, 0],
  ['training', 'Training yard', '+1% combat XP per level (always on)', 6000, 50],
  ['workshop', 'Workshop', '+1% gathering and artisan XP per level (always on)', 6000, 50],
  ['kitchen', 'Kitchen', 'Boosts last 10% longer per level', 5000, 100],
  ['vault', 'Vault', 'Fortune boost pays 20% more per level', 8000, 150],
  ['shrine', 'Shrine', 'Each level makes boosts 8% cheaper in renown', 7000, 200]
];
// boosts: [id, name, icon, minutes, renown cost, effect text]
export const BOOSTS = [
  ['wisdom', 'Banner of Wisdom', '📘', 30, 60, '+10% XP in every skill'],
  ['valor', 'Banner of Valor', '⚔️', 30, 60, '+15% combat XP and 5% damage reduction'],
  ['craft', 'Banner of the Craft', '🔨', 30, 60, '+15% gathering and artisan XP'],
  ['fortune', 'Banner of Fortune', '💰', 30, 80, 'Extra coins and guild crests from kills'],
  ['rally', 'Grand Rally', '🎺', 15, 200, '+25% XP in every skill (guild hall level 3)']
];
const COMBAT = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer'];
const HIRELINGS = ['Brannoc the Steady', 'Isel Quickhand', 'Morwen Ashby', 'Tobin Fell', 'Kestra Vale', 'Orrin Blackbrook', 'Sabeth Wren', 'Dunmar Oakes', 'Liraen Moss', 'Corvin Haske', 'Eda Thornfield', 'Pell Marrow'];
export function normalizeGuild(g) {
  if (!g || typeof g !== 'object' || typeof g.name !== 'string') return null;
  const rooms = {}; for (const [id] of ROOMS) rooms[id] = Math.max(0, Math.min(5, (g.rooms && g.rooms[id]) | 0)); rooms.hall = Math.max(1, rooms.hall);
  return { name: g.name.slice(0, 24), renown: Math.max(0, Math.floor(Number(g.renown) || 0)), funds: Math.max(0, Math.floor(Number(g.funds) || 0)), rooms,
    hired: Array.isArray(g.hired) ? g.hired.filter(h => HIRELINGS.includes(h)) : [], boost: g.boost && typeof g.boost.id === 'string' ? { id: g.boost.id, until: Number(g.boost.until) || 0 } : null, xpAcc: Number(g.xpAcc) || 0 };
}
const NAMES = ['Lantern Oath', 'Larkhaven Wardens', 'Silver Compass', 'Order of the Ember', 'Hollow Oak Company', 'Free Blades of Aerondel'];

export function installGuild(ctx) {
  const { scene, nodes, player, skills, EXT, giveXP, giveItem, log, markDirty, gfx } = ctx;
  player.guild = normalizeGuild(player.guild);
  const G = () => player.guild;
  const say = (t, more = []) => [['npc', t], ...more];
  if (!ITEMS['Guild crest']) ITEMS['Guild crest'] = { value: 250, examine: 'A crest of your guild. Hand it to Guildmaster Halvard for renown.' };
  const boost = () => G() && G().boost && G().boost.until > Date.now() ? G().boost.id : null;
  const members = () => { const g = G(); if (!g) return []; return [...COMPANIONS.filter(c => player.companions && player.companions[c.id] && player.companions[c.id].recruited).map(c => c.short), ...g.hired]; };
  const seats = () => 4 + G().rooms.hall * 3;
  const renown = n => { const g = G(); if (!g) return; g.renown += Math.round(n * (1 + g.rooms.hall * 0.02)); markDirty(); };
  const isCombat = s => COMBAT.includes(s);

  EXT.extXp.push(skill => {
    const g = G(); if (!g) return 1;
    g.xpAcc++; if (g.xpAcc >= 40) { g.xpAcc = 0; renown(1); }
    let m = 1 + (isCombat(skill) ? g.rooms.training : g.rooms.workshop) * 0.01 + members().length * 0.005;
    const b = boost();
    if (b === 'wisdom') m += 0.1; else if (b === 'rally') m += 0.25;
    else if (b === 'valor' && isCombat(skill)) m += 0.15; else if (b === 'craft' && !isCombat(skill)) m += 0.15;
    return m;
  });
  EXT.extIncoming.push(dmg => boost() === 'valor' ? Math.floor(dmg * 0.95) : dmg);
  EXT.extKill.push(mon => {
    const g = G(); if (!g) return; const L = (mon && (mon.level || (mon.type && mon.type.level))) || 5;
    if (Math.random() < 0.25) renown(1);
    if (boost() === 'fortune') { const c = Math.round((5 + L * 2) * (1 + g.rooms.vault * 0.2)); player.gold += c; if (Math.random() < 0.06) { giveItem('Guild crest'); log('Fortune smiles: a Guild crest!', 'loot'); } }
  });

  function roomMenu() {
    const g = G();
    return [{ choose: [...ROOMS.map(([id, name, what, cost, rn]) => {
      const lv = g.rooms[id], c = cost * (lv + 1), r = rn * (lv + 1);
      return [lv >= 5 ? `${name} (max)` : `${name} ${lv}→${lv + 1}: ${c.toLocaleString()} coins from treasury${r ? `, ${r} renown` : ''}`, [{ run: () => {
        if (lv >= 5) return say(`${name} is as grand as it gets. ${what}.`);
        if (g.funds < c) return say(`The treasury holds ${g.funds.toLocaleString()} coins; that needs ${c.toLocaleString()}.`);
        if (g.renown < r) return say(`The masons want a guild of ${r} renown first.`);
        g.funds -= c; g.rooms[id]++; markDirty(); buildHall(); return say(`${name} upgraded to level ${g.rooms[id]}. ${what}.`);
      } }]];
    }), ['Back.', []]] }];
  }
  function boostMenu() {
    const g = G(), cheap = 1 - g.rooms.shrine * 0.08, len = 1 + g.rooms.kitchen * 0.1;
    return [{ choose: [...BOOSTS.map(([id, name, icon, min, cost, eff]) => { const rc = Math.round(cost * cheap), m = Math.round(min * len);
      return [`${icon} ${name} (${m} min, ${rc} renown): ${eff}`, [{ run: () => {
        if (id === 'rally' && g.rooms.hall < 3) return say('A Grand Rally needs a level 3 great hall.');
        if (g.renown < rc) return say(`That costs ${rc} renown; the guild has ${g.renown}.`);
        g.renown -= rc; g.boost = { id, until: Date.now() + m * 60000 }; markDirty(); log(`${icon} ${name} flies over ${g.name} for ${m} minutes: ${eff}.`, 'skill'); return say(`${name} raised!`);
      } }]]; }), ['Back.', []]] }];
  }
  EXT.extTalk.guildmaster = { face: '🏰', talk: () => {
    const g = G();
    if (!g) return [['npc', 'Guildmaster Halvard: Adventurers do better together. Want to found a guild? The charter costs 5,000 coins.'], { choose: [
      ...NAMES.map(n => [`Found "${n}"`, [{ run: () => {
        if (player.gold < 5000) return say('The charter is 5,000 coins.');
        player.gold -= 5000; player.guild = normalizeGuild({ name: n, rooms: { hall: 1 } }); markDirty(); buildHall(); log(`🏰 You found the guild ${n}! Its hall stands west of Larkhaven.`, 'skill');
        return say(`${n} it is! Your recruited companions sign up at once. Hire more adventurers here, and fill the treasury to grow the hall.`);
      } }]]), ['Not now.', []]] }];
    const b = boost(), opts = [
      [`Status`, say(`${g.name}: ${g.renown} renown, ${g.funds.toLocaleString()} coins in the treasury, ${members().length}/${seats()} members (${members().join(', ') || 'just you'}). ${b ? `Active: ${BOOSTS.find(x => x[0] === b)[1]}, ${Math.ceil((g.boost.until - Date.now()) / 60000)} min left.` : 'No banner flying.'}`)],
      ['Deposit 1,000 coins', [{ run: () => { if (player.gold < 1000) return say('You need 1,000 coins.'); player.gold -= 1000; g.funds += 1000; renown(2); return say(`Treasury: ${g.funds.toLocaleString()} coins.`); } }]],
      ['Deposit 10,000 coins', [{ run: () => { if (player.gold < 10000) return say('You need 10,000 coins.'); player.gold -= 10000; g.funds += 10000; renown(20); return say(`Treasury: ${g.funds.toLocaleString()} coins.`); } }]],
      ['Upgrade the hall', roomMenu()],
      ['Raise a guild boost', boostMenu()],
      ['Hire an adventurer (2,000 coins)', [{ run: () => {
        const free = HIRELINGS.filter(h => !g.hired.includes(h));
        if (members().length >= seats()) return say('No seats left. Upgrade the great hall.');
        if (!free.length) return say('Every adventurer in Aerondel already wears your crest!');
        if (g.funds < 2000) return say('Hiring is paid from the treasury: 2,000 coins.');
        g.funds -= 2000; const h = free[Math.floor(Math.random() * free.length)]; g.hired.push(h); markDirty(); buildHall();
        return say(`${h} joins ${g.name}. Each member adds a little guild XP (up to +10%).`);
      } }]],
      ['Turn in guild crests', [{ run: () => { const n = ctx.countItem('Guild crest'); if (!n) return say('You have no crests.'); ctx.removeItem(player, 'Guild crest', n); renown(n * 15); return say(`+${n * 15} renown.`); } }]],
      ['Goodbye.', []]];
    return [['npc', `Guildmaster Halvard: Welcome back to ${g.name}.`], { choose: opts }];
  } };
  for (const n of nodes) if (n.npc === 'guildmaster') n.ext = 'guildmaster';

  // ---- guild hall building ----
  const hall = new THREE.Group(); hall.name = 'guild-hall'; scene.add(hall);
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const y0 = terrainHeight(HALL.x, HALL.z);
  colliders.push({ minX: HALL.x - 5, maxX: HALL.x + 5, minZ: HALL.z - 4, maxZ: HALL.z + 3.2, wall: 'guild-hall' });
  function buildHall() {
    for (const c of [...hall.children]) { hall.remove(c); c.traverse(o => o.geometry && o.geometry.dispose()); }
    const g = G(), lv = g ? g.rooms.hall : 0, low = gfx.quality === 'low';
    const add = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = !low; o.receiveShadow = !low; hall.add(o); return o; };
    const stone = mat(0x8a8478), wood = mat(0x5a3e28), roof = mat(g ? 0x6a2a2a : 0x4a4a4a);
    add(new THREE.BoxGeometry(10, 0.4, 7.2), stone, 0, 0.2, -0.4);
    add(new THREE.BoxGeometry(9.4, 3.4 + lv * 0.25, 6.4), g ? mat(0xc8b48a) : stone, 0, 2.1 + lv * 0.12, -0.4);
    const r = add(new THREE.ConeGeometry(7, 2.6 + lv * 0.2, 4), roof, 0, 5.2 + lv * 0.4, -0.4, Math.PI / 4); r.scale.z = 0.72;
    add(new THREE.BoxGeometry(1.8, 2.6, 0.2), wood, 0, 1.7, 2.85);
    if (g) { // banners: one per room level above 0, colours by room
      const C = [0xb02a2a, 0x2a5ab0, 0xd4af37, 0x3a8a3a, 0x6a3ab0, 0xe0e0e0]; let k = 0;
      ROOMS.forEach(([id], i) => { if (g.rooms[id] > 0 && k < (low ? 3 : 6)) { const x = -4 + k * 1.6; add(new THREE.BoxGeometry(0.7, 1.6 + g.rooms[id] * 0.15, 0.06), mat(C[i]), x, 3.2, 2.9); k++; } });
      add(new THREE.CylinderGeometry(0.08, 0.08, 4, 5), wood, 4.6, 2, 3.6);
      add(new THREE.BoxGeometry(1.4, 0.9, 0.05), mat(0xb02a2a), 5.3, 3.5, 3.6);
    }
    hall.position.set(HALL.x, y0, HALL.z);
  }
  buildHall();
  EXT.guild = { get: G, boost, members, buildHall, renown };
}
