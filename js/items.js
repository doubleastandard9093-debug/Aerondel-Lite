// Item definitions, tiers, tools and recipes.
// type decides what tapping the item does. Equipment bonuses (RS-style):
//   atk = melee attack, str = melee strength, ranged = ranged attack, rstr = ranged strength,
//   def = melee defence, rdef = ranged defence, prayer = prayer bonus (slows drain).
// Extras on some items: regen (HP regen), gather { skill: speed }, xp { skill: bonus }.
// set = armour set name (full matched set gives a set bonus). value = shop sell price.

export const HEAL_SCALE = 10; // hitpoints are 10x classic the old classics

export const METALS = ['Bronze', 'Iron', 'Steel', 'Bluesteel', 'Verdite', 'Cobalt', 'Emberite'];
export const METAL_TINT = { Bronze: '#b87333', Iron: '#9a9a9a', Steel: '#d0d8e0', Bluesteel: '#5a6ad0', Verdite: '#3a9a5a', Cobalt: '#3ab8d0', Emberite: '#c04040' };
const TIER_REQ = [1, 10, 20, 30, 40, 50, 60];          // Attack / Defence to wear
const TOOL_REQ = [1, 1, 6, 21, 31, 41, 61];             // Woodcutting / Mining to use
const SMITH_BASE = [1, 15, 30, 50, 70, 85, 90];
const BAR_XP = [12.5, 25, 37.5, 50, 62.5, 75, 90];
const VALUE_MULT = [1, 3, 8, 20, 50, 130, 350];
export const WOODS = ['Logs', 'Oak logs', 'Willow logs', 'Maple logs', 'Yew logs', 'Magic logs'];

export const ITEMS = {};
const def = (name, o) => { ITEMS[name] = { value: 1, ...o }; };

// ---- Resources ----
const ORES = [['Copper ore', 3], ['Tin ore', 3], ['Iron ore', 10], ['Coal', 12], ['Bluesteel ore', 40], ['Verdite ore', 90], ['Cobalt ore', 300], ['Emberite ore', 800]];
for (const [o, v] of ORES) def(o, { type: 'resource', value: v });
WOODS.forEach((w, i) => def(w, { type: 'resource', value: [2, 6, 12, 20, 40, 90][i] }));
for (const [n, v] of [['Flax', 2], ['Cowhide', 6], ['Feather', 1], ['Raw beef', 3], ['Bowstring', 5], ['Soft leather', 10], ['Hard leather', 20]]) def(n, { type: n === 'Bowstring' || /leather/.test(n) ? 'processed' : 'resource', value: v });
def('Bones', { type: 'bones', prayerXp: 10, value: 2 });
def('Big bones', { type: 'bones', prayerXp: 30, value: 15 });
def('Dragon bones', { type: 'bones', prayerXp: 72, value: 200 });
def('Burnt food', { type: 'junk', value: 0 });

// ---- Food: [raw, cooked, cook level, stop-burn level, heal, xp, value] ----
export const FOODS = [
  ['Raw shrimp', 'Cooked shrimp', 1, 34, 3, 30, 4], ['Raw beef', 'Cooked meat', 1, 34, 4, 30, 4],
  ['Raw trout', 'Cooked trout', 15, 50, 7, 70, 10], ['Raw salmon', 'Cooked salmon', 25, 58, 9, 90, 15],
  ['Raw lobster', 'Cooked lobster', 40, 74, 12, 120, 40], ['Raw swordfish', 'Cooked swordfish', 45, 86, 14, 140, 60],
  ['Raw shark', 'Cooked shark', 80, 99, 20, 210, 150],
  ['Raw anchovies', 'Cooked anchovies', 15, 40, 5, 45, 6], ['Raw tuna', 'Cooked tuna', 30, 64, 10, 100, 25],
  ['Raw monkfish', 'Cooked monkfish', 62, 92, 16, 150, 90]
];
for (const [raw, cooked, , , heal, , v] of FOODS) {
  if (!ITEMS[raw]) def(raw, { type: 'resource', value: Math.max(2, Math.round(v * 1.2)) });
  def(cooked, { type: 'food', heal, value: v });
}

// ---- Metal tiers: bars, gear, tools, arrows ----
// Metal armour: strong melee defence, a bit less vs arrows, small attack penalty on big pieces.
function armour(def, t, rangedPenalty) {
  const o = { def, rdef: Math.round(def * 0.8), set: METALS[t], req: { Defence: TIER_REQ[t] } };
  if (rangedPenalty) o.ranged = Math.round(rangedPenalty * (t + 1)) || -1;
  return o;
}
const GEAR = {
  sword:  { suffix: 'sword', slot: 'weapon', bars: 1, off: 2,  stat: t => ({ atk: [5, 9, 14, 20, 28, 38, 52][t], str: [3, 6, 10, 15, 22, 32, 48][t], speed: 4, req: { Attack: TIER_REQ[t] } }), val: 15 },
  helm:   { suffix: 'full helm', slot: 'head', bars: 2, off: 4, stat: t => armour([3, 5, 8, 11, 15, 21, 30][t], t, 0), val: 12 },
  shield: { suffix: 'shield', slot: 'shield', bars: 2, off: 6, stat: t => armour([7, 11, 16, 22, 30, 42, 58][t], t, 0), val: 20 },
  legs:   { suffix: 'platelegs', slot: 'legs', bars: 3, off: 12, stat: t => armour([6, 10, 15, 21, 29, 40, 55][t], t, -0.5), val: 30 },
  body:   { suffix: 'platebody', slot: 'body', bars: 5, off: 16, stat: t => armour([8, 14, 20, 28, 38, 52, 72][t], t, -1), val: 60 },
  axe:    { suffix: 'axe', tool: 'axe', bars: 1, off: 0, stat: t => ({ toolTier: t, req: { Woodcutting: TOOL_REQ[t] } }), val: 10 },
  pickaxe:{ suffix: 'pickaxe', tool: 'pickaxe', bars: 2, off: 1, stat: t => ({ toolTier: t, req: { Mining: TOOL_REQ[t] } }), val: 14 },
  mattock:{ suffix: 'mattock', tool: 'mattock', bars: 2, off: 2, stat: t => ({ toolTier: t, req: { Relicry: TOOL_REQ[t] } }), val: 14 }   // Relicry excavation tool
};
METALS.forEach((m, t) => {
  def(`${m} bar`, { type: 'processed', value: [8, 25, 50, 120, 300, 900, 2500][t] });
  for (const g of Object.values(GEAR)) {
    def(`${m} ${g.suffix}`, { type: g.tool ? 'tool' : g.slot, tool: g.tool, tier: t, metal: m, ...g.stat(t), value: Math.round(g.val * VALUE_MULT[t]) });
  }
  def(`${m} arrows`, { type: 'ammo', count: 15, rstr: [3, 6, 10, 15, 22, 32, 45][t], tier: t, metal: m, value: [1, 2, 4, 8, 16, 40, 100][t] });
});

// ---- Arsenal (v22): weapon classes with their own styles (see arsenal.js) ----
// katana: opening strike on each new foe; scimitar: fast, every 4th swing flourishes; glaive: long, slow, may sweep;
// war fan: builds adrenaline and can stagger; chakram: light disc that may return for a second cut.
export const WCLASSES = {
  katana:   { suffix: 'katana',   atk: [6, 11, 17, 24, 33, 45, 62], str: [4, 7, 12, 18, 26, 37, 54], speed: 4 },
  scimitar: { suffix: 'scimitar', atk: [5, 9, 14, 20, 28, 38, 52], str: [2, 5, 8, 12, 18, 27, 40], speed: 3 },
  glaive:   { suffix: 'glaive',   atk: [6, 10, 16, 23, 32, 44, 60], str: [6, 10, 16, 24, 34, 48, 68], speed: 6 },
  warfan:   { suffix: 'war fan',  atk: [4, 7, 11, 16, 22, 30, 42], str: [2, 4, 7, 10, 15, 22, 32], speed: 3, def: [2, 3, 5, 7, 10, 14, 20] },
  chakram:  { suffix: 'chakram',  atk: [5, 9, 13, 19, 26, 36, 50], str: [3, 5, 9, 13, 19, 28, 40], speed: 3 }
};
METALS.forEach((m, t) => {
  for (const [cls, w] of Object.entries(WCLASSES))
    def(`${m} ${w.suffix}`, { type: 'weapon', wclass: cls, atk: w.atk[t], str: w.str[t], def: w.def ? w.def[t] : 0, speed: w.speed, tier: t, metal: m, req: { Attack: TIER_REQ[t] }, value: Math.round(18 * VALUE_MULT[t] * (cls === 'glaive' ? 1.4 : 1)) });
});

// ---- Bows ----
export const BOWS = [['Shortbow', 1, 8], ['Oak shortbow', 15, 14], ['Willow shortbow', 20, 20], ['Maple shortbow', 30, 28], ['Yew shortbow', 40, 36], ['Magic shortbow', 50, 48]];
BOWS.forEach(([n, req, r], t) => def(n, { type: 'weapon', ranged: r, speed: 4, tier: t, req: { Ranged: req }, value: [20, 40, 80, 160, 400, 1000][t] }));
// ---- Crossbows, bolts and thrown weapons (thrown weapons need no ammo) ----
export const XBOW_METALS = METALS.slice(0, 6);
XBOW_METALS.forEach((m, t) => {
  def(`${m} crossbow`, { type: 'weapon', ranged: [10, 16, 22, 30, 40, 52][t], speed: 5, tier: t, metal: m, req: { Ranged: TIER_REQ[t] }, value: [30, 70, 150, 320, 800, 2200][t] });
  def(`${m} bolts`, { type: 'ammo', count: 10, rstr: [4, 7, 11, 17, 24, 35][t], tier: t, metal: m, value: [1, 3, 5, 10, 20, 50][t] });
  def(`${m} thrown dagger`, { type: 'weapon', thrown: true, ranged: [4, 7, 11, 16, 22, 30][t], rstr: [2, 4, 7, 11, 16, 24][t], speed: 3, tier: t, metal: m, req: { Ranged: TIER_REQ[t] }, value: [10, 25, 60, 150, 380, 1000][t] });
  def(`${m} throwing axe`, { type: 'weapon', thrown: true, ranged: [5, 9, 13, 19, 26, 36][t], rstr: [3, 6, 9, 14, 20, 30][t], speed: 4, tier: t, metal: m, req: { Ranged: TIER_REQ[t] }, value: [14, 35, 80, 200, 500, 1300][t] });
});

// ---- Sails of Saltreach: cutlasses (fast, combo-building blades) and flintlocks (slow, heavy shots) ----
METALS.slice(0, 6).forEach((m, t) => def(`${m} cutlass`, { type: 'weapon', cutlass: true, atk: [5, 8, 13, 18, 25, 34][t], str: [3, 5, 9, 13, 19, 28][t], speed: 3, tier: t, metal: m, req: { Attack: TIER_REQ[t] }, value: [40, 130, 340, 900, 2100, 5600][t] }));
['Iron', 'Steel', 'Bluesteel', 'Verdite'].forEach((m, t) => def(`${m} flintlock`, { type: 'weapon', pistol: true, ranged: [24, 34, 46, 60][t], speed: 7, tier: t + 1, metal: m, req: { Ranged: [10, 20, 30, 40][t] }, value: [240, 640, 1600, 4200][t] }));
def('Lead shot', { type: 'ammo', count: 10, rstr: 22, shot: true, value: 5 });
def('Silver shot', { type: 'ammo', count: 10, rstr: 30, shot: true, vsUndead: 0.25, value: 20 });
def('Treasure chart', { type: 'chart', value: 0 });

// ---- Leather and wood armour ----
// Leather is weaker in melee but good against arrows and helps your aim.
def('Leather cowl', { type: 'head', def: 2, rdef: 4, ranged: 2, set: 'Leather', req: { Defence: 1 }, value: 8 });
def('Leather body', { type: 'body', def: 6, rdef: 9, ranged: 4, set: 'Leather', req: { Defence: 1 }, value: 25 });
def('Leather chaps', { type: 'legs', def: 4, rdef: 6, ranged: 3, set: 'Leather', req: { Defence: 1 }, value: 15 });
def('Hard leather body', { type: 'body', def: 12, rdef: 16, ranged: 8, set: 'Leather', req: { Defence: 10 }, value: 60 });
def('Wooden shield', { type: 'shield', def: 4, rdef: 4, req: { Defence: 1 }, value: 10 });
def('Oak shield', { type: 'shield', def: 6, rdef: 7, req: { Defence: 5 }, value: 25 });

// ---- Jewellery and capes ----
def('Amulet of accuracy', { type: 'neck', atk: 4, ranged: 4, value: 120 });
def('Amulet of strength', { type: 'neck', str: 10, value: 500 });
def('Amulet of defence', { type: 'neck', def: 7, rdef: 7, value: 300 });
def('Holy symbol', { type: 'neck', prayer: 8, value: 200 });
def('Amulet of renown', { type: 'neck', atk: 10, str: 6, ranged: 10, def: 3, rdef: 3, prayer: 3, value: 3000 });
def('Warrior ring', { type: 'ring', atk: 4, str: 4, value: 800 });
def('Archer ring', { type: 'ring', ranged: 6, rstr: 2, value: 800 });
def('Ring of regeneration', { type: 'ring', regen: 0.25, value: 1200 });
def("Miner's ring", { type: 'ring', gather: { Mining: 0.04 }, xp: { Mining: 0.03 }, value: 600 });
def("Forester's ring", { type: 'ring', gather: { Woodcutting: 0.04 }, xp: { Woodcutting: 0.03 }, value: 600 });
def("Angler's ring", { type: 'ring', gather: { Fishing: 0.04 }, xp: { Fishing: 0.03 }, value: 600 });
def('Red cape', { type: 'cape', def: 1, rdef: 1, value: 15 });
def('Blue cape', { type: 'cape', def: 1, rdef: 1, value: 15 });
def('Quest point cape', { type: 'cape', atk: 3, str: 3, ranged: 3, def: 6, rdef: 6, prayer: 4, regen: 0.1, questCape: true, value: 99 });
export const SKILL_CAPE_SKILLS = ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged', 'Magic', 'Prayer', 'Agility', 'Thieving', 'Mining', 'Woodcutting', 'Fishing', 'Smithing', 'Crafting', 'Cooking', 'Fletching', 'Herbalism', 'Glyphcraft', 'Relicry', 'Delving', 'Swordsmanship', 'Hunter'];
for (const sk of SKILL_CAPE_SKILLS) def(`${sk} cape`, { type: 'cape', def: 4, rdef: 4, prayer: 2, capeSkill: sk, req: { [sk]: 99 }, value: 9900 });

// Full matched sets. pieces = how many you need; fx feeds the combat maths.
// ---- Magic and Glyphcraft ----
// Essence is crafted into runes at the rune altars; spells use runes. An elemental staff
// counts as an endless supply of its rune. `mag` is the magic attack bonus.
def('Glyph essence', { type: 'resource', value: 4 });
def('Clear essence', { type: 'resource', value: 6 });
export const HEX_RUNES = [['Bog rune', 20, '#5a7a3a'], ['Bone rune', 35, '#d8d0b0']];
export const RUNES = [['Air rune', 4, '#d8e8f0'], ['Thought rune', 3, '#e0a040'], ['Water rune', 4, '#3a7ad0'], ['Earth rune', 4, '#8a6a3a'], ['Fire rune', 4, '#e04a2a'],
  ['Vital rune', 3, '#6a8ad0'], ['Havoc rune', 90, '#e0c030'], ['Grave rune', 180, '#e8e8e8'], ['Crimson rune', 400, '#c01a1a']];
for (const [n, v] of [...RUNES, ...HEX_RUNES]) def(n, { type: 'rune', value: v });
def('Staff', { type: 'weapon', atk: 2, str: 1, mag: 4, speed: 5, value: 15 });
for (const [el, rune] of [['air', 'Air rune'], ['water', 'Water rune'], ['earth', 'Earth rune'], ['fire', 'Fire rune']]) {
  def(`Staff of ${el}`, { type: 'weapon', atk: 4, str: 2, mag: 10, speed: 5, runeSource: rune, value: 1500 });
}
def('Hexwood staff', { type: 'weapon', atk: 5, str: 3, mag: 14, speed: 5, req: { Magic: 20 }, hexBoost: 0.15, value: 900 });
def('Starweave staff', { type: 'weapon', atk: 8, str: 4, mag: 18, speed: 5, req: { Magic: 40 }, value: 8000 });
def('Wizard hat', { type: 'head', mag: 2, value: 30 });
def('Wizard robe', { type: 'body', mag: 3, value: 45 });
def('Starweave hat', { type: 'head', mag: 4, def: 2, req: { Magic: 40 }, value: 3000 });
def('Starweave robe top', { type: 'body', mag: 20, def: 10, req: { Magic: 40 }, value: 12000 });
def('Starweave robe bottom', { type: 'legs', mag: 15, def: 7, req: { Magic: 40 }, value: 9000 });
def('Wizard robe bottom', { type: 'legs', mag: 2, value: 35 });
def('Cloth', { type: 'processed', value: 6 });
def('Battlestaff', { type: 'weapon', atk: 8, str: 6, mag: 10, speed: 5, req: { Magic: 30, Attack: 20 }, value: 1200 });
// ---- Cooked dishes that heal and give a short buff (buff.boost works like a potion; prayer restores points) ----
def('Hearty stew', { type: 'food', heal: 10, value: 30, buff: { icon: '🍲', ticks: 300, boost: { Strength: [2, 0.05] } } });
def("Monk's broth", { type: 'food', heal: 8, value: 40, buff: { icon: '🙏', prayer: 12 } });
def('Fisherman\'s pie', { type: 'food', heal: 14, value: 70, buff: { icon: '🥧', ticks: 300, boost: { Defence: [2, 0.05] } } });
def("Warrior's feast", { type: 'food', heal: 24, value: 400, buff: { icon: '🍖', ticks: 400, boost: { Attack: [3, 0.06], Strength: [3, 0.06] } } });

export const SETS = {
  Leather: { pieces: ['head', 'body', 'legs'], fx: { racc: 0.05, dr: 0.02 } },
  ...Object.fromEntries(METALS.map((m, t) => [m, { pieces: ['head', 'body', 'legs', 'shield'], fx: { dr: 0.02 + 0.01 * t, acc: 0.03 } }])),
  Wyrmscale: { pieces: ['head', 'body', 'legs', 'shield'], fx: { dr: 0.12, dmgPct: 0.1 } }
};
export function setDesc(fx) {
  return Object.entries(fx).map(([k, v]) => ({ dr: `take ${Math.round(v * 100)}% less damage`, acc: `+${Math.round(v * 100)}% melee accuracy`, racc: `+${Math.round(v * 100)}% ranged accuracy`, dmgPct: `+${Math.round(v * 100)}% damage` })[k]).join(', ');
}

// ---- Herbalism: herbs, secondaries, vials, potions ----
// [clean herb, level to pick/clean/use, clean XP, value]
export const HERBS = [
  ['Greenwort', 1, 2.5, 3], ['Marshmint', 5, 3.8, 5], ['Tallowroot', 11, 5, 8], ['Harrowbloom', 20, 6.3, 15], ['Ravenweed', 25, 7.5, 40],
  ['Toadflax', 30, 8, 20], ['Ironleaf', 40, 8.8, 30], ['Amberleaf', 48, 10, 45], ['Knotroot', 54, 11.3, 55], ['Snapdragon', 59, 11.8, 80],
  ['Cindervine', 65, 12.5, 70], ['Stoneweed', 70, 13.8, 60], ['Thornstalk', 75, 15, 120]
];
export const grimyOf = herb => 'Grimy ' + herb.toLowerCase();
for (const [h, lvl, , v] of HERBS) {
  def(h, { type: 'herb', herbLevel: lvl, value: v });
  def(grimyOf(h), { type: 'grimy', clean: h, herbLevel: lvl, value: Math.max(1, Math.round(v * 0.8)) });
}
export const SECONDARIES = ['Eye of newt', 'Unicorn horn dust', 'Bitterroot', 'Chocolate dust', 'White berries', 'Marsh reed', 'Goat horn dust',
  'Red spider eggs', 'Wine of the pyre', 'Dragon scale dust'];
SECONDARIES.forEach((n, i) => def(n, { type: 'secondary', value: [3, 15, 10, 10, 20, 15, 18, 25, 40, 60][i] }));
def('Vial', { type: 'vial', value: 1 });
def('Vial of water', { type: 'vial', value: 2 });
// [potion, herb, secondary, level, xp, value, tint]
export const POTION_RECIPES = [
  ['Attack potion', 'Greenwort', 'Eye of newt', 3, 25, 20, '#4a8ad0'],
  ['Antipoison', 'Marshmint', 'Unicorn horn dust', 5, 37.5, 30, '#e0e0e0'],
  ['Strength potion', 'Tallowroot', 'Bitterroot', 12, 50, 40, '#d04a4a'],
  ['Energy potion', 'Harrowbloom', 'Chocolate dust', 26, 67.5, 50, '#c08ae0'],
  ['Defence potion', 'Ravenweed', 'White berries', 30, 75, 60, '#4ad08a'],
  ["Prospector's brew", 'Toadflax', 'Marsh reed', 34, 80, 80, '#c0a040'],
  ['Combat potion', 'Harrowbloom', 'Goat horn dust', 36, 84, 90, '#d0a060'],
  ['Prayer potion', 'Ravenweed', 'Marsh reed', 38, 87.5, 150, '#40c0b0'],
  ['Super attack', 'Ironleaf', 'Eye of newt', 45, 100, 120, '#3a6ae0'],
  ["Sage's brew", 'Amberleaf', 'Red spider eggs', 50, 112.5, 160, '#e0d040'],
  ['Super strength', 'Knotroot', 'Bitterroot', 55, 125, 160, '#e03a3a'],
  ['Super restore', 'Snapdragon', 'Red spider eggs', 63, 142.5, 250, '#e06ab0'],
  ['Super defence', 'Cindervine', 'White berries', 66, 150, 200, '#3ae07a'],
  ['Ranging potion', 'Stoneweed', 'Wine of the pyre', 72, 162.5, 220, '#3a9ae0'],
  ['Super combat potion', 'Thornstalk', 'Dragon scale dust', 90, 150, 600, '#3a8a3a']
];
for (const [n, , , , , v] of POTION_RECIPES) def(n, { type: 'potion', value: v });

// ---- Uniques: named drops and quest rewards with special effects ----
// rarity colours the name; eff holds the special (see gameplay.js / main.js):
//   doubleHit, bigHit (+50% damage), lifesteal, poison {chance, dmg}, stun, multiArrow, dmgPct, crit, reflect, potionTime
export const RARITY = { uncommon: '#3ad03a', rare: '#3aa0ff', epic: '#c060ff', legendary: '#ff9a2a' };
const U = (name, o) => def(name, { unique: true, ...o });
U('Venom dagger', { type: 'weapon', atk: 22, str: 16, speed: 3, rarity: 'rare', eff: { poison: { chance: 0.25, dmg: 30 } }, special: '25% chance to poison (30 damage, fading)', req: { Attack: 30 }, value: 4000 });
U("Saltgrave's tricorn", { type: 'head', def: 8, rdef: 10, ranged: 6, mag: 4, rarity: 'epic', eff: { dmgPct: 0.04 }, special: '+4% damage with every style', req: { Defence: 40 }, value: 12000 });
U('Tidecaller cutlass', { type: 'weapon', cutlass: true, atk: 40, str: 36, speed: 3, rarity: 'epic', eff: { lifesteal: 0.08 }, special: 'A Drowned blade: heals 8% of damage dealt', req: { Attack: 50 }, value: 15000 });
U('Vampyric blade', { type: 'weapon', atk: 32, str: 30, speed: 4, rarity: 'epic', eff: { lifesteal: 0.15 }, special: 'Heals you for 15% of the damage you deal', req: { Attack: 40 }, value: 9000 });
U('Basalt maul', { type: 'weapon', atk: 40, str: 58, speed: 6, rarity: 'rare', eff: { stun: 0.15 }, special: '15% chance to stun for 3 seconds. Slow but brutal', req: { Attack: 50, Strength: 50 }, value: 12000 });
U('Emberite dagger', { type: 'weapon', atk: 40, str: 38, speed: 3, rarity: 'rare', eff: { doubleHit: 0.2 }, special: 'Puncture: 20% chance to strike twice', req: { Attack: 60 }, value: 18000 });
U('Emberite longsword', { type: 'weapon', atk: 69, str: 71, speed: 4, rarity: 'epic', eff: { bigHit: 0.15 }, special: 'Cleave: 15% chance of a hit with +50% damage', req: { Attack: 60 }, value: 60000 });
U('Dusk bow', { type: 'weapon', ranged: 95, speed: 6, rarity: 'epic', eff: { multiArrow: 2 }, special: 'Fires two arrows every shot (uses 2 arrows)', req: { Ranged: 60 }, value: 80000 });
U('Cinderglass cape', { type: 'cape', str: 4, def: 9, rdef: 9, rarity: 'rare', eff: { dmgPct: 0.05 }, special: '+5% damage dealt', value: 15000 });
U('Ring of fury', { type: 'ring', str: 12, rarity: 'epic', eff: { crit: 0.05 }, special: '+5% critical hit chance', value: 40000 });
// Hunt points rewards (tasks.js)
U("Hunter's ring", { type: 'ring', atk: 5, ranged: 5, rarity: 'uncommon', special: 'Bought with Hunt points', value: 200 });
U("Duellist's cape", { type: 'cape', atk: 4, def: 4, rarity: 'uncommon', special: 'Bought with arena tokens', value: 400 });
U("Victor's band", { type: 'ring', str: 6, rarity: 'rare', special: 'Proving Grounds ladder top 3', value: 800 });
U('Reefward amulet', { type: 'neck', def: 6, rdef: 6, rarity: 'rare', special: '+8% damage against the Drowned Crew', value: 300 });
U("Saltgrave's signet", { type: 'ring', atk: 6, str: 6, ranged: 6, rarity: 'rare', special: 'Drowned Crew Exalted reward', value: 500 });
U('Ring of rebuke', { type: 'ring', def: 2, rdef: 2, rarity: 'uncommon', eff: { reflect: 0.1 }, special: 'Reflects 10% of damage you take', value: 1500 });
U("Captain's cutlass", { type: 'weapon', atk: 35, str: 32, speed: 4, rarity: 'rare', eff: { doubleHit: 0.1 }, special: '10% chance to strike twice', req: { Attack: 40 }, value: 8000 });
// ---- Frontier uniques (v22): named weapons and armour sets from the frontier elites and Sunderlord Vexmar.
// Stats scale with the dropper's level L; wearing all 4 set pieces gives the set bonus (SETS).
// [dropper, level, set name, weapon name, weapon class, weapon eff, eff text, set fx]
export const FRONTIER_UNIQUES = [
  ['Cinder Warden', 140, 'Ashwarden', 'Emberfang katana', 'katana', { bigHit: 0.15 }, 'Cleave: 15% chance of a hit with +50% damage', { dr: 0.06, dmgPct: 0.06 }],
  ['Bramble Colossus', 220, 'Thornroot', 'Briarhook scimitar', 'scimitar', { poison: { chance: 0.3, dmg: 260 } }, '30% chance to poison (260 damage, fading)', { dr: 0.08, acc: 0.06 }],
  ['Glacier Behemoth', 320, 'Rimeplate', 'Glacierfall glaive', 'glaive', { stun: 0.15 }, '15% chance to freeze the foe for 3 seconds', { dr: 0.1, dmgPct: 0.08 }],
  ['Peak Warlord', 450, 'Stormforged', 'Thunderwing war fan', 'warfan', { doubleHit: 0.2 }, 'Thunderclap: 20% chance to strike twice', { dr: 0.11, acc: 0.1 }],
  ['Bog Revenant', 600, 'Gravemire', 'Mirewraith chakram', 'chakram', { lifesteal: 0.12 }, 'Heals you for 12% of the damage you deal', { dr: 0.12, dmgPct: 0.1 }],
  ['Dune Tyrant', 720, 'Sandsovereign', 'Mirage scimitar', 'scimitar', { crit: 0.08, bigHit: 0.1 }, '+8% critical hit chance; 10% chance of a +50% hit', { dr: 0.13, acc: 0.12 }],
  ['Molten Archon', 880, 'Archon\'s Caldera', 'Magmaheart glaive', 'glaive', { dmgPct: 0.08, bigHit: 0.2 }, '+8% damage; 20% chance of a +50% hit', { dr: 0.14, dmgPct: 0.12 }],
  ['Voidborn Knight', 950, 'Voidwrought', 'Nulledge katana', 'katana', { doubleHit: 0.2, lifesteal: 0.06 }, '20% chance to strike twice; heals 6% of damage dealt', { dr: 0.15, acc: 0.14 }],
  ['Sunderlord Vexmar', 1000, 'Eclipse Sovereign', 'Vexmar, the Last Eclipse', 'katana', { bigHit: 0.25, doubleHit: 0.25, lifesteal: 0.1, dmgPct: 0.1 }, 'The Sunderlord\'s own blade: 25% chance to strike twice, 25% chance of a +50% hit, heals 10% of damage dealt, +10% damage', { dr: 0.2, dmgPct: 0.2, acc: 0.15 }]
];
export const FRONTIER_PIECES = [['head', 'helm', 0.42], ['body', 'cuirass', 1], ['legs', 'greaves', 0.78], ['shield', 'aegis', 0.8]];
export const FRONTIER_TINTS = { Ashwarden: 0x8a3a1a, Thornroot: 0x4a6a2a, Rimeplate: 0xb8d8f0, Stormforged: 0x6a7aa0, Gravemire: 0x3a4a3a, Sandsovereign: 0xc8a060, "Archon's Caldera": 0xd0501a, Voidwrought: 0x3a2a5a, 'Eclipse Sovereign': 0x6a3aa0 };
for (const [mob, L, set, wName, cls, eff, txt, fx] of FRONTIER_UNIQUES) {
  const tint = FRONTIER_TINTS[set];
  const rarity = L >= 900 ? 'legendary' : 'epic', boss = L >= 1000;
  U(wName, { type: 'weapon', wclass: cls, atk: Math.round(L * 0.95 + 20) + (boss ? 150 : 0), str: Math.round(L * 0.9 + 15) + (boss ? 150 : 0), speed: WCLASSES[cls].speed,
    rarity, eff, tint, highTier: true, icon: { katana: '🗡️', scimitar: '🗡️', glaive: '🔱', warfan: '🪭', chakram: '💿' }[cls], special: `${txt}. Dropped by ${mob}`, req: { Attack: L, Swordsmanship: Math.round(L / 2) }, value: L * 900, frontier: mob });
  for (const [slot, word, k] of FRONTIER_PIECES)
    U(`${set} ${word}`, { type: slot, set, def: Math.round(L * 0.75 * k), rdef: Math.round(L * 0.7 * k), str: slot === 'body' ? Math.round(L * 0.06) : 0, rarity, tint, highTier: true,
      special: `${set} set piece. Dropped by ${mob}`, req: { Defence: L }, value: L * 500, frontier: mob });
  SETS[set] = { pieces: ['head', 'body', 'legs', 'shield'], fx };
}
U('Highcrag warhammer', { type: 'weapon', atk: 48, str: 55, speed: 5, rarity: 'epic', eff: { stun: 0.1, dmgPct: 0.05 }, special: '10% chance to stun, +5% damage', req: { Attack: 50 }, value: 20000 });
U("Herbalist's amulet", { type: 'neck', def: 3, rdef: 3, prayer: 4, rarity: 'rare', eff: { potionTime: 0.25 }, special: 'Potions last 25% longer', value: 5000 });
for (const [piece, type, d, rd, extra] of [['helm', 'head', 30, 32, {}], ['body', 'body', 75, 80, { ranged: -6 }], ['legs', 'legs', 55, 58, { ranged: -3 }], ['shield', 'shield', 60, 60, {}]]) {
  U(`Wyrmscale ${piece}`, { type, def: d, rdef: rd, ...extra, set: 'Wyrmscale', rarity: 'legendary', special: 'Wyrmscale set: 12% less damage and +10% damage with all 4 pieces', req: { Defence: 70 }, value: 50000 });
}
export function rarityOf(item) { return (ITEMS[item] && ITEMS[item].rarity) || null; }
export function rarityColor(item) { const r = rarityOf(item); return r ? RARITY[r] : null; }

// ---- Single-tier tools ----
export const TOOL_TYPES = [
  { id: 'axe', name: 'Axe', icon: '🪓', skill: 'Woodcutting' },
  { id: 'pickaxe', name: 'Pickaxe', icon: '⛏️', skill: 'Mining' },
  { id: 'mattock', name: 'Mattock', icon: '⛏️', skill: 'Relicry' },
  { id: 'net', name: 'Fishing net', icon: '🥅' },
  { id: 'rod', name: 'Fishing rod', icon: '🎣' },
  { id: 'cage', name: 'Lobster pot', icon: '🧺' },
  { id: 'harpoon', name: 'Harpoon', icon: '🔱' },
  { id: 'hammer', name: 'Hammer', icon: '🔨' },
  { id: 'knife', name: 'Knife', icon: '🔪' },
  { id: 'needle', name: 'Needle', icon: '🪡' },
  { id: 'tinderbox', name: 'Tinderbox', icon: '🔥' },
  { id: 'spade', name: 'Spade', icon: '🪏' }
];
for (const [n, tool, v] of [['Small fishing net', 'net', 5], ['Fly fishing rod', 'rod', 10], ['Lobster pot', 'cage', 20], ['Harpoon', 'harpoon', 25],
  ['Hammer', 'hammer', 1], ['Knife', 'knife', 1], ['Needle', 'needle', 1], ['Tinderbox', 'tinderbox', 1], ['Spade', 'spade', 6]]) {
  def(n, { type: 'tool', tool, tier: 0, value: v });
}
export const STARTER_TOOLS = ['Bronze axe', 'Bronze pickaxe', 'Small fishing net', 'Hammer', 'Knife', 'Needle', 'Tinderbox'];

export function isTool(item) { return !!(ITEMS[item] && ITEMS[item].type === 'tool'); }
export function toolType(item) { return ITEMS[item] && ITEMS[item].tool; }

// Every identical item stacks in one slot.
export function isStackable(item) { return true; }

export function slotFor(item) {
  const t = ITEMS[item] && ITEMS[item].type;
  if (['weapon', 'shield', 'body', 'legs', 'head', 'ammo', 'neck', 'ring', 'cape'].includes(t)) return t;
  return null;
}
export function isRangedWeapon(item) { return !!(item && ITEMS[item] && ITEMS[item].ranged); }
export function itemValue(item) { return ITEMS[item] ? ITEMS[item].value : 1; }

// ---- Icons: [emoji, tint] ----
const KIND_ICON = { cutlass: '🗡️', flintlock: '🔫', sword: '⚔️', 'full helm': '🪖', shield: '🛡️', platelegs: '👖', platebody: '🦺', axe: '🪓', pickaxe: '⛏️', mattock: '⛏️', arrows: '🏹', bar: '🧱', crossbow: '🏹', bolts: '➶', 'thrown dagger': '🔪', 'throwing axe': '🪓' };
const FIXED_ICONS = {
  Coal: ['🪨', '#11111180'], 'Copper ore': ['🪨', '#b8733340'], 'Tin ore': ['🪨', '#c8c8c840'], 'Iron ore': ['🪨', '#8a4b3a50'],
  'Bluesteel ore': ['🪨', '#5a6ad060'], 'Verdite ore': ['🪨', '#3a9a5a60'], 'Cobalt ore': ['🪨', '#3ab8d060'],
  Flax: ['🌾', ''], Cowhide: ['🐄', ''], Bones: ['🦴', ''], 'Big bones': ['🦴', '#e0d0a060'], 'Dragon bones': ['🦴', '#3a8a3a60'], 'Raw beef': ['🥩', ''], Feather: ['🪶', ''],
  Bowstring: ['🧵', ''], 'Soft leather': ['🟫', ''], 'Hard leather': ['🟫', '#5a3a1a60'], 'Burnt food': ['🍘', '#22222280'],
  'Raw shrimp': ['🦐', ''], 'Cooked shrimp': ['🍤', ''], 'Raw trout': ['🐟', ''], 'Cooked trout': ['🐠', ''], 'Raw salmon': ['🐟', '#e0806040'],
  'Cooked salmon': ['🍣', ''], 'Cooked meat': ['🍖', ''], 'Raw lobster': ['🦞', '#40608040'], 'Cooked lobster': ['🦞', ''],
  'Raw swordfish': ['🐟', '#6080c040'], 'Cooked swordfish': ['🐡', ''], 'Raw shark': ['🦈', '#6080c040'], 'Cooked shark': ['🦈', ''],
  'Leather cowl': ['🧢', ''], 'Leather body': ['🧥', ''], 'Leather chaps': ['👖', '#7a4a2450'], 'Hard leather body': ['🧥', '#5a3a1a60'],
  'Wooden shield': ['🛡️', '#8a5a2a50'], 'Oak shield': ['🛡️', '#c49a5a50'],
  'Small fishing net': ['🥅', ''], 'Fly fishing rod': ['🎣', ''], 'Lobster pot': ['🧺', ''], Harpoon: ['🔱', ''],
  Hammer: ['🔨', ''], Knife: ['🔪', ''], Needle: ['🪡', ''], Tinderbox: ['🔥', ''],
  'Amulet of accuracy': ['📿', '#4a8ad060'], 'Amulet of strength': ['📿', '#d04a4a60'], 'Amulet of defence': ['📿', '#4ad08a60'],
  'Holy symbol': ['✝️', '#e0e0e060'], 'Amulet of renown': ['📿', '#ffd70080'], 'Warrior ring': ['💍', '#d04a4a60'], 'Archer ring': ['💍', '#4ad04a60'],
  'Ring of regeneration': ['💍', '#ff80c060'], "Miner's ring": ['💍', '#8a8a8a60'], "Forester's ring": ['💍', '#3a8a3a60'], "Angler's ring": ['💍', '#3a7ad060'],
  'Red cape': ['🧣', '#c0303060'], 'Blue cape': ['🧣', '#3050c060'], 'Quest point cape': ['🧣', '#3060ff80'],
  'Emberite ore': ['🪨', '#c0404060'], 'Emberite bar': ['🧱', '#c0404060'],
  'Emberite sword': ['🗡️', '#c0404060'], 'Emberite full helm': ['⛑️', '#c0404060'],
  'Emberite shield': ['🛡️', '#c0404060'], 'Emberite platelegs': ['👖', '#c0404060'],
  'Emberite platebody': ['🦺', '#c0404060'], 'Emberite axe': ['🪓', '#c0404060'],
  'Emberite pickaxe': ['⛏️', '#c0404060'], 'Emberite arrows': ['➶', '#c0404060'],
  'Uncut sapphire': ['💎', '#4060ff40'], 'Uncut emerald': ['💎', '#40ff6040'],
  'Uncut ruby': ['💎', '#ff406040'], 'Uncut diamond': ['💎', '#e0e0e040'],
  'Sapphire': ['💎', '#4060ff60'], 'Emerald': ['💎', '#40ff6060'],
  'Ruby': ['💎', '#ff406060'], 'Diamond': ['💎', '#e0e0e060'],
  'Gold ore': ['🪨', '#ffd70040'], 'Gold bar': ['🧱', '#ffd70060'],
  'Bird nest': ['🪺', ''], 'Raw pike': ['🐟', ''], 'Raw tuna': ['🐟', '#c0a06040'],
  'Cooked pike': ['🍣', ''], 'Cooked tuna': ['🍣', '#c0a06040']
};
const WOOD_TINT = ['', '#c49a5a40', '#7a9a4a40', '#c0702a40', '#4a6a3a50', '#3a5ad050'];
const UNIQUE_ICON = { 'Venom dagger': '🗡️', 'Vampyric blade': '🗡️', 'Basalt maul': '🔨', 'Emberite dagger': '🗡️', 'Emberite longsword': '⚔️', 'Dusk bow': '🏹',
  'Cinderglass cape': '🧣', 'Ring of fury': '💍', 'Ring of rebuke': '💍', "Hunter's ring": '💍', "Duellist's cape": '🧣', "Victor's band": '💍', 'Reefward amulet': '📿', "Saltgrave's signet": '💍', "Captain's cutlass": '🗡️', 'Highcrag warhammer': '🔨', "Herbalist's amulet": '📿' };
const SECOND_ICON = { 'Eye of newt': '👁️', 'Unicorn horn dust': '🦄', 'Bitterroot': '🥕', 'Chocolate dust': '🍫', 'White berries': '🫐', 'Marsh reed': '🌱',
  'Goat horn dust': '🐐', 'Red spider eggs': '🔴', 'Wine of the pyre': '🍷', 'Dragon scale dust': '🐉' };
export function iconFor(item) {
  if (FIXED_ICONS[item]) return FIXED_ICONS[item];
  const info0 = ITEMS[item];
  if (info0) {
    if (info0.unique) {
      const tint = RARITY[info0.rarity] + '50';
      if (/^Wyrmscale/.test(item)) return [{ head: '⛑️', body: '🦺', legs: '👖', shield: '🛡️' }[info0.type], '#2a8a3a80'];
      if (info0.highTier) return [info0.icon || { weapon: info0.ranged ? '🏹' : info0.mag ? '🪄' : '⚔️', head: '⛑️', body: '🦺', legs: '👖', shield: '🛡️', ring: '💍' }[info0.type] || '✨', tint];
      return [UNIQUE_ICON[item] || '✨', tint];
    }
    if (info0.type === 'herb') return ['🌿', '#3ad03a30'];
    if (info0.type === 'grimy') return ['🌿', '#6a5a2a60'];
    if (info0.type === 'secondary') return [SECOND_ICON[item] || '🧂', ''];
    if (item === 'Vial') return ['⚱️', ''];
    if (item === 'Vial of water') return ['🧪', '#3a7ad040'];
    if (info0.type === 'potion') { const r = POTION_RECIPES.find(p => p[0] === item); return ['🧪', (r ? r[6] : '#888888') + '60']; }
  }
  if (info0 && info0.type === 'rune') { const r = [...RUNES, ...HEX_RUNES].find(x => x[0] === item); return ['🔶', (r ? r[2] : '#888888') + '70']; }
  if (item === 'Glyph essence' || item === 'Clear essence') return ['🪨', item === 'Clear essence' ? '#f0f0ff70' : '#c0c8d070'];
  if (info0 && info0.runeSource) { const r = RUNES.find(x => x[0] === info0.runeSource); return ['🪄', r[2] + '70']; }
  if (item === 'Battlestaff') return ['🪄', '#8a8a9a70'];
  if (item === 'Cloth') return ['🧻', ''];
  if (item === 'Treasure chart') return ['🗺️', '#d4af3750'];
  if (item === 'Lead shot' || item === 'Silver shot') return ['⚫', item === 'Silver shot' ? '#e0e0f070' : '#50505070'];
  if (item === 'Hexwood staff') return ['🪄', '#5a7a3a70'];
  if (item === "Saltgrave's tricorn") return ['🎩', '#2a1a3a80'];
  if (item === 'Tidecaller cutlass') return ['🗡️', '#3ad0b070'];
  if (info0 && info0.buff) return [{ 'Hearty stew': '🍲', "Monk's broth": '🥣', "Fisherman's pie": '🥧', "Warrior's feast": '🍖' }[item] || '🍲', '#d4af3740'];
  if (item === 'Staff' || item === 'Starweave staff') return ['🪄', item === 'Starweave staff' ? '#6a3ad070' : ''];
  if (/^(Wizard|Starweave) /.test(item)) return [/hat$/.test(item) ? '🎩' : /bottom$/.test(item) ? '👖' : '🥻', /^Starweave/.test(item) ? '#3a5ad070' : '#2a3a9a60'];
  if (ITEMS[item] && ITEMS[item].capeSkill) return ['🧣', '#d4af3780'];
  const w = WOODS.indexOf(item);
  if (w >= 0) return ['🪵', WOOD_TINT[w]];
  const bow = BOWS.findIndex(b => b[0] === item);
  if (bow >= 0) return ['🏹', WOOD_TINT[bow]];
  const info = ITEMS[item];
  if (info && info.metal) {
    const kind = item.slice(info.metal.length + 1);
    const ic = KIND_ICON[kind] || (info.tool === 'axe' ? '🪓' : info.tool === 'pickaxe' ? '⛏️' : '📦');
    return [ic, (METAL_TINT[info.metal] || '#888888') + '60'];
  }
  if (/ bar$/.test(item)) { const m = item.split(' ')[0]; return ['🧱', (METAL_TINT[m] || '#888') + '60']; }
  return ['📦', ''];
}
export const ICONS = FIXED_ICONS;

const EXAMINE = {
  Coal: 'Hmm, a non-renewable energy source!', Bones: 'Bones are for burying!', 'Big bones': 'Ew, it\'s a pile of big bones.',
  Feather: 'Used for fly fishing and fletching.', Flax: 'A plant cultivated for fibres.', Cowhide: 'I should take this to the tanner.',
  Bowstring: 'I need a bow stave to attach this to.', 'Burnt food': 'Oops!', Hammer: 'Good for hitting things.', Knife: 'A dangerous looking knife.',
  Needle: 'Used with leather to make armour.', Tinderbox: 'Useful for lighting a fire.', 'Small fishing net': 'Useful for catching small fish.',
  'Fly fishing rod': 'Useful for fly fishing.', 'Lobster pot': 'Useful for catching lobsters.', Harpoon: 'Useful for catching really big fish.',
  'Glyph essence': 'An uncharged rune stone. Take it to a rune altar.', 'Clear essence': 'A pure uncharged rune stone. Havoc, Death and Blood altars need this.',
  'Vital rune': 'Used for Body-rune spells. Shops buy them too.', 'Staff': 'A plain wooden staff. A little magic attack.'
};
// Short bonus summary, e.g. "melee atk +9, str +6, def +3".
export const STAT_NAMES = { atk: 'melee atk', str: 'str', ranged: 'ranged atk', rstr: 'ranged str', def: 'melee def', rdef: 'ranged def', prayer: 'prayer', mag: 'magic atk' };
export function statLine(item) {
  const info = ITEMS[item] || {};
  const bits = [];
  for (const [k, n] of Object.entries(STAT_NAMES)) if (info[k]) bits.push(`${n} ${info[k] > 0 ? '+' : ''}${info[k]}`);
  if (info.regen) bits.push(`HP regen +${Math.round(info.regen * 100)}%`);
  for (const [sk, v] of Object.entries(info.gather || {})) bits.push(`${sk} speed +${Math.round(v * 100)}%`);
  for (const [sk, v] of Object.entries(info.xp || {})) bits.push(`${sk} XP +${Math.round(v * 100)}%`);
  return bits.join(', ');
}
export function examineItem(item) {
  const info = ITEMS[item] || {};
  let text = EXAMINE[item] || (info.type === 'food' ? 'Mmm, this looks tasty.' : info.tool ? `A ${item.toLowerCase()}. It goes on my toolbelt.`
    : /^Raw /.test(item) ? 'I should try cooking this.' : / ore$/.test(item) ? 'This needs refining.' : / bar$/.test(item) ? `It's a bar of ${item.split(' ')[0].toLowerCase()}.`
    : `It's ${/^[aeiou]/i.test(item) ? 'an' : 'a'} ${item.toLowerCase()}.`);
  if (info.capeSkill) text = `The cape worn by masters of ${info.capeSkill}. Boosts your ${info.capeSkill} perks by 10%.`;
  if (info.questCape) text = 'The cape of a true adventurer. Needs every quest complete.';
  if (info.type === 'grimy') text = `I need to clean this herb before I can use it (Herbalism ${info.herbLevel}).`;
  if (info.type === 'herb') text = `A clean ${item.toLowerCase()}, ready for a potion.`;
  if (info.type === 'potion' && POTION_INFO[item]) text = `${item}: ${POTION_INFO[item]}.`;
  if (info.unique) text = `[${info.rarity[0].toUpperCase() + info.rarity.slice(1)}] ${item}. Special: ${info.special}.`;
  if (info.runeSource) text = `A magical staff. While you wield it you have unlimited ${info.runeSource.toLowerCase()}s.`;
  if (info.type === 'rune' && !EXAMINE[item]) text = `One of the ${item.split(' ')[0].toLowerCase()} runes used for casting spells.`;
  const bits = [];
  if (info.heal) bits.push(`heals ${info.heal * HEAL_SCALE}`);
  if (info.buff) bits.push(info.buff.prayer ? `restores ${info.buff.prayer * 10} prayer` : 'buff ' + Object.entries(info.buff.boost).map(([k, [f, pc]]) => `${k} +${f}+${Math.round(pc * 100)}%`).join(', ') + ` for ${Math.round(info.buff.ticks * 0.6 / 60)} min`);
  if (info.thrown) bits.push('thrown, needs no ammo');
  if (info.prayerXp) bits.push(`bury for ${info.prayerXp} Prayer xp`);
  const st = statLine(item);
  if (st) bits.push(st);
  if (info.set) bits.push(`${info.set} set piece`);
  if (info.eff && info.eff.potionTime) bits.push(`potions +${Math.round(info.eff.potionTime * 100)}% duration`);
  if (info.tool && info.toolTier !== undefined) bits.push(`tier ${info.toolTier + 1} tool`);
  if (info.req) bits.push('needs ' + Object.entries(info.req).map(([k, v]) => `${k} ${v}`).join(', '));
  if (bits.length) text += ` (${bits.join(', ')})`;
  return text;
}

// Short potion descriptions for examine (effects live in potions.js).
export const POTION_INFO = {
  'Attack potion': '+3 +10% Attack for 5 minutes', Antipoison: 'cures poison and protects you for 90 seconds',
  'Strength potion': '+3 +10% Strength for 5 minutes', 'Energy potion': 'restores 30% run energy',
  'Defence potion': '+3 +10% Defence for 5 minutes', "Prospector's brew": '+10% mining, woodcutting, fishing and herb success for 5 minutes',
  'Combat potion': '+3 +10% Attack and Strength for 5 minutes', 'Prayer potion': 'restores 7 + 25% of your prayer points',
  'Super attack': '+5 +15% Attack for 5 minutes', "Sage's brew": '+10% XP in every skill for 5 minutes', 'Super strength': '+5 +15% Strength for 5 minutes',
  'Super restore': 'restores 8 + 25% of your prayer points and 20% run energy', 'Super defence': '+5 +15% Defence for 5 minutes',
  'Ranging potion': '+4 +10% Ranged for 5 minutes', 'Super combat potion': '+5 +15% Attack, Strength and Defence for 5 minutes'
};

// ---- Recipes ----
// cat = Crafting panel sub-tab, group = heading inside it. station: furnace, anvil, range. tool: needed on the belt.
export const RECIPES = [];
const R = r => RECIPES.push({ station: null, tool: null, ...r });
// Smelting
R({ name: 'Smelt Bronze bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 1, inputs: { 'Copper ore': 1, 'Tin ore': 1 }, output: 'Bronze bar', xp: 6, station: 'furnace' });
R({ name: 'Smelt Iron bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 15, inputs: { 'Iron ore': 1 }, output: 'Iron bar', xp: 12, station: 'furnace' });
R({ name: 'Smelt Steel bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 30, inputs: { 'Iron ore': 1, Coal: 2 }, output: 'Steel bar', xp: 17, station: 'furnace' });
R({ name: 'Smelt Bluesteel bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 50, inputs: { 'Bluesteel ore': 1, Coal: 4 }, output: 'Bluesteel bar', xp: 30, station: 'furnace' });
R({ name: 'Smelt Verdite bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 70, inputs: { 'Verdite ore': 1, Coal: 6 }, output: 'Verdite bar', xp: 37.5, station: 'furnace' });
R({ name: 'Smelt Cobalt bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 85, inputs: { 'Cobalt ore': 1, Coal: 8 }, output: 'Cobalt bar', xp: 50, station: 'furnace' });
// Smithing at the anvil
const BRONZE_LVL = { sword: 1, helm: 3, shield: 5, legs: 10, body: 14, axe: 1, pickaxe: 1, mattock: 2 };
METALS.forEach((m, t) => {
  for (const [key, g] of Object.entries(GEAR)) {
    R({ name: `Smith ${m} ${g.suffix}`, cat: 'Smithing', group: m, skill: 'Smithing', level: t === 0 ? BRONZE_LVL[key] : Math.min(99, SMITH_BASE[t] + g.off),
      inputs: { [`${m} bar`]: g.bars }, output: `${m} ${g.suffix}`, xp: BAR_XP[t] * g.bars, station: 'anvil', tool: 'hammer' });
  }
});
// Crafting
R({ name: 'Tan Cowhide', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 1, inputs: { Cowhide: 1 }, output: 'Soft leather', xp: 20 });
R({ name: 'Tan Hard leather', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 28, inputs: { Cowhide: 1 }, output: 'Hard leather', xp: 35 });
R({ name: 'Sew Leather cowl', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 9, inputs: { 'Soft leather': 1 }, output: 'Leather cowl', xp: 18.5, tool: 'needle' });
R({ name: 'Sew Leather body', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 14, inputs: { 'Soft leather': 3 }, output: 'Leather body', xp: 25, tool: 'needle' });
R({ name: 'Sew Leather chaps', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 18, inputs: { 'Soft leather': 2 }, output: 'Leather chaps', xp: 27, tool: 'needle' });
R({ name: 'Sew Hard leather body', cat: 'Crafting', group: 'Leather', skill: 'Crafting', level: 28, inputs: { 'Hard leather': 2 }, output: 'Hard leather body', xp: 35, tool: 'needle' });
R({ name: 'Spin Flax', cat: 'Crafting', group: 'Spinning', skill: 'Crafting', level: 1, inputs: { Flax: 1 }, output: 'Bowstring', xp: 15 });
R({ name: 'Craft Wooden shield', cat: 'Crafting', group: 'Woodwork', skill: 'Crafting', level: 1, inputs: { Logs: 2 }, output: 'Wooden shield', xp: 10, tool: 'hammer' });
R({ name: 'Craft Oak shield', cat: 'Crafting', group: 'Woodwork', skill: 'Crafting', level: 15, inputs: { 'Oak logs': 2 }, output: 'Oak shield', xp: 25, tool: 'hammer' });
// Fletching
const BOW_LVL = [5, 20, 35, 50, 65, 80], BOW_XP = [5, 16.5, 33.3, 50, 67.5, 83.3];
BOWS.forEach(([n], t) => R({ name: `Fletch ${n}`, cat: 'Fletching', group: 'Bows', skill: 'Fletching', level: BOW_LVL[t], inputs: { [WOODS[t]]: 1, Bowstring: 1 }, output: n, xp: BOW_XP[t], tool: 'knife' }));
const ARROW_LVL = [1, 15, 30, 45, 60, 75, 90], ARROW_XP = [10, 15, 25, 37.5, 50, 62.5, 75];
METALS.forEach((m, t) => R({ name: `Fletch ${m} arrows`, cat: 'Fletching', group: 'Arrows', skill: 'Fletching', level: ARROW_LVL[t], inputs: { [`${m} bar`]: 1, [WOODS[Math.min(t, WOODS.length - 1)]]: 1 }, output: `${m} arrows`, xp: ARROW_XP[t], tool: 'knife' }));
const XBOW_LVL = [9, 24, 39, 46, 54, 61], XBOW_XP = [12, 24, 38, 52, 68, 84];
XBOW_METALS.forEach((m, t) => {
  R({ name: `Fletch ${m} crossbow`, cat: 'Fletching', group: 'Crossbows', skill: 'Fletching', level: XBOW_LVL[t], inputs: { [`${m} bar`]: 1, [WOODS[t]]: 1, Bowstring: 1 }, output: `${m} crossbow`, xp: XBOW_XP[t], tool: 'knife' });
  R({ name: `Fletch ${m} bolts`, cat: 'Fletching', group: 'Bolts', skill: 'Fletching', level: XBOW_LVL[t], inputs: { [`${m} bar`]: 1, Feather: 5 }, output: `${m} bolts`, xp: XBOW_XP[t] * 0.8, tool: 'knife' });
  R({ name: `Smith ${m} thrown dagger`, cat: 'Smithing', group: 'Thrown weapons', skill: 'Smithing', level: Math.min(99, SMITH_BASE[t] + 3), inputs: { [`${m} bar`]: 1 }, output: `${m} thrown dagger`, xp: BAR_XP[t], station: 'anvil', tool: 'hammer' });
  R({ name: `Smith ${m} throwing axe`, cat: 'Smithing', group: 'Thrown weapons', skill: 'Smithing', level: Math.min(99, SMITH_BASE[t] + 7), inputs: { [`${m} bar`]: 2 }, output: `${m} throwing axe`, xp: BAR_XP[t] * 2, station: 'anvil', tool: 'hammer' });
});
// Arsenal (v22): the 5 weapon classes at the anvil. [bars, level offset over the metal's base]
const WCLASS_SMITH = { katana: [2, 5], scimitar: [2, 3], glaive: [3, 9], warfan: [1, 4], chakram: [1, 6] };
METALS.forEach((m, t) => {
  for (const [cls, w] of Object.entries(WCLASSES)) {
    const [bars, off] = WCLASS_SMITH[cls];
    R({ name: `Smith ${m} ${w.suffix}`, cat: 'Smithing', group: 'Arsenal', skill: 'Smithing', level: Math.min(99, SMITH_BASE[t] + off), inputs: { [`${m} bar`]: bars }, output: `${m} ${w.suffix}`, xp: BAR_XP[t] * bars, station: 'anvil', tool: 'hammer' });
  }
});
// Magic gear: weave cloth, sew robes, carve staves; a battlestaff needs the anvil
R({ name: 'Weave Cloth', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 5, inputs: { Flax: 2 }, output: 'Cloth', xp: 12 });
R({ name: 'Sew Wizard hat', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 10, inputs: { Cloth: 1 }, output: 'Wizard hat', xp: 20, tool: 'needle' });
R({ name: 'Sew Wizard robe bottom', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 16, inputs: { Cloth: 2 }, output: 'Wizard robe bottom', xp: 30, tool: 'needle' });
R({ name: 'Sew Wizard robe', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 20, inputs: { Cloth: 3 }, output: 'Wizard robe', xp: 40, tool: 'needle' });
R({ name: 'Sew Starweave hat', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 50, inputs: { Cloth: 2, 'Vital rune': 10 }, output: 'Starweave hat', xp: 80, tool: 'needle' });
R({ name: 'Sew Starweave robe bottom', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 56, inputs: { Cloth: 4, 'Vital rune': 20 }, output: 'Starweave robe bottom', xp: 110, tool: 'needle' });
R({ name: 'Sew Starweave robe top', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 60, inputs: { Cloth: 5, 'Vital rune': 25 }, output: 'Starweave robe top', xp: 140, tool: 'needle' });
R({ name: 'Carve Staff', cat: 'Crafting', group: 'Magic gear', skill: 'Crafting', level: 8, inputs: { 'Oak logs': 1 }, output: 'Staff', xp: 18, tool: 'knife' });
R({ name: 'Smith Battlestaff', cat: 'Smithing', group: 'Thrown weapons', skill: 'Smithing', level: 40, inputs: { Staff: 1, 'Steel bar': 1 }, output: 'Battlestaff', xp: 60, station: 'anvil', tool: 'hammer' });
// Cooking
for (const [raw, cooked, lvl, stop, , xp] of FOODS) {
  R({ name: `Cook ${cooked.replace('Cooked ', '')}`, cat: 'Cooking', group: 'Range or fire', skill: 'Cooking', level: lvl, inputs: { [raw]: 1 }, output: cooked, xp, station: 'range', burnStop: stop });
}
R({ name: 'Cook Hearty stew', cat: 'Cooking', group: 'Dishes (buffs)', skill: 'Cooking', level: 25, inputs: { 'Cooked meat': 2 }, output: 'Hearty stew', xp: 60, station: 'range' });
R({ name: "Cook Monk's broth", cat: 'Cooking', group: 'Dishes (buffs)', skill: 'Cooking', level: 30, inputs: { 'Cooked salmon': 1, 'Vial of water': 1 }, output: "Monk's broth", xp: 80, station: 'range' });
R({ name: "Cook Fisherman's pie", cat: 'Cooking', group: 'Dishes (buffs)', skill: 'Cooking', level: 45, inputs: { 'Cooked tuna': 1, 'Cooked trout': 1 }, output: "Fisherman's pie", xp: 120, station: 'range' });
R({ name: "Cook Warrior's feast", cat: 'Cooking', group: 'Dishes (buffs)', skill: 'Cooking', level: 82, inputs: { 'Cooked shark': 1, 'Cooked lobster': 1 }, output: "Warrior's feast", xp: 260, station: 'range' });


// Emberite metal
R({ name: 'Smelt Emberite bar', cat: 'Smithing', group: 'Smelting', skill: 'Smithing', level: 90, inputs: { 'Emberite ore': 1 }, output: 'Emberite bar', xp: 90, station: 'furnace' });

// Herbalism: clean grimy herbs, then herb + vial of water + secondary = potion.
for (const [n, herb, sec, lvl, xp] of POTION_RECIPES) R({ name: `Brew ${n}`, cat: 'Herbalism', group: 'Potions', skill: 'Herbalism', level: lvl, inputs: { [herb]: 1, 'Vial of water': 1, [sec]: 1 }, output: n, xp });
for (const [h, lvl, xp] of HERBS) R({ name: `Clean ${h}`, cat: 'Herbalism', group: 'Cleaning', skill: 'Herbalism', level: lvl, inputs: { [grimyOf(h)]: 1 }, output: h, xp });

export const CRAFT_TABS = ['Smithing', 'Crafting', 'Fletching', 'Cooking', 'Herbalism'];

export function recipeOutputQty(recipe) {
  const info = ITEMS[recipe.output];
  return (info && info.type === 'ammo' && info.count) ? info.count : 1;
}
export function hasInputs(inventory, recipe) {
  for (const [item, qty] of Object.entries(recipe.inputs)) if ((inventory[item] || 0) < qty) return false;
  return true;
}
export function canCraft(skills, inventory, recipe) {
  if (skills[recipe.skill].level < recipe.level) return false;
  return hasInputs(inventory, recipe);
}


// ---- Climate regions / Relicry materials (dropped by regional creatures, dug at dig sites) ----
def('Relic shard', { type: 'resource', value: 25 });
def('Ancient fragment', { type: 'resource', value: 400 });

// ---- Huntwright (v24): carved parts and crafted hunt sets. These do not replace frontier uniques.
// Set bonuses are behavioural (faster carves, longer part-break windows), not raw damage.
// [boss, level, hunterReq, set, weapon, wclass, parts [[id, item, label]], setText]
export const HUNTS = [
  ['Cinder Warden', 140, 1, 'Brandhide', 'Brandhide cleaver', 'scimitar', [['horn', 'Cinder horn', 'cinder horn'], ['plate', 'Ash plate', 'ash plate'], ['tail', 'Ember tail', 'ember tail']], 'Carves 20% faster'],
  ['Bramble Colossus', 220, 20, 'Briarhide', 'Briarhide hook', 'scimitar', [['horn', 'Bramble horn', 'bramble horn'], ['plate', 'Thorn plate', 'thorn plate'], ['tail', 'Vine lash', 'vine lash']], 'Carves 20% faster'],
  ['Glacier Behemoth', 320, 40, 'Rimehide', 'Rimehide pike', 'glaive', [['horn', 'Rime horn', 'rime horn'], ['plate', 'Frost plate', 'frost plate'], ['tail', 'Ice lash', 'ice lash']], 'Part breaks last a little longer'],
  ['Peak Warlord', 450, 60, 'Stormhide', 'Stormhide fan', 'warfan', [['horn', 'Peak horn', 'peak horn'], ['plate', 'Storm plate', 'storm plate'], ['wing', 'Warlord plume', 'warlord plume']], 'Tracks resolve a little faster'],
  ['Bog Revenant', 600, 80, 'Mirehide', 'Mirehide disc', 'chakram', [['horn', 'Bog crest', 'bog crest'], ['plate', 'Mire plate', 'mire plate'], ['tail', 'Revenant coil', 'revenant coil']], 'Carves 20% faster'],
  ['Dune Tyrant', 720, 120, 'Dunewrought', 'Dunewrought scimitar', 'scimitar', [['horn', 'Dune horn', 'dune horn'], ['plate', 'Sand plate', 'sand plate'], ['tail', 'Tyrant lash', 'tyrant lash']], 'Part breaks last a little longer'],
  ['Molten Archon', 880, 200, 'Cinderwrought', 'Cinderwrought glaive', 'glaive', [['horn', 'Archon horn', 'archon horn'], ['plate', 'Magma plate', 'magma plate'], ['core', 'Ember core', 'ember core']], 'Carves 20% faster'],
  ['Voidborn Knight', 950, 350, 'Nightwrought', 'Nightwrought katana', 'katana', [['horn', 'Void crest', 'void crest'], ['plate', 'Night plate', 'night plate'], ['core', 'Knight core', 'knight core']], 'Part breaks last a little longer'],
  ['Sunderlord Vexmar', 1000, 500, 'Eclipshide', 'Eclipshide edge', 'katana', [['horn', 'Eclipse horn', 'eclipse horn'], ['plate', 'Sunder plate', 'sunder plate'], ['core', 'Last-light core', 'last-light core'], ['tail', 'Eclipse lash', 'eclipse lash']], 'Carves 25% faster and part breaks last longer'],
  ['Stonehorn', 140, 15, 'Hillhide', 'Hillhide maul-blade', 'scimitar', [['horn', 'Stone horn', 'stone horn'], ['legs', 'Hill plate', 'hill plate']], 'Part breaks last a little longer'],
  ['Frostmaw', 150, 25, 'Scarhide', 'Scarhide fang', 'scimitar', [['horn', 'Frost horn', 'frost horn'], ['legs', 'Scar plate', 'scar plate']], 'Carves 20% faster'],
  ['Ashwyrm', 165, 30, 'Cinderback', 'Cinderback glaive', 'glaive', [['horn', 'Wyrm horn', 'wyrm horn'], ['legs', 'Ashwyrm scale', 'ashwyrm scale'], ['tail', 'Cinder tail', 'cinder tail']], 'Part breaks last a little longer']
];
export const HUNT_TINTS = { Brandhide: 0x8a3a1a, Briarhide: 0x4a6a2a, Rimehide: 0xb8d8f0, Stormhide: 0x6a7aa0, Mirehide: 0x3a4a3a, Dunewrought: 0xc8a060, Cinderwrought: 0xd0501a, Nightwrought: 0x3a2a5a, Eclipshide: 0x6a3aa0, Hillhide: 0x7a6a4a, Scarhide: 0x8ab0c8, Cinderback: 0x7a3a1a };
export const huntByBoss = name => HUNTS.find(h => h[0] === name) || null;
def('Hunt remnant', { type: 'resource', value: 25, special: 'A leftover scrap from a carved hunt.' });
for (const [boss, L, hun, set, wName, cls, parts, txt] of HUNTS) {
  const tint = HUNT_TINTS[set], rarity = L >= 900 ? 'legendary' : L >= 400 ? 'epic' : 'rare';
  const atk = Math.round(L * 0.72 + 16), str = Math.round(L * 0.68 + 12), dfn = Math.round(L * 0.55);
  for (const [, item] of parts) def(item, { type: 'resource', value: Math.max(8, Math.round(L * 0.4)), huntPart: true, huntBoss: boss, special: `Carved from ${boss}.` });
  U(wName, { type: 'weapon', wclass: cls, atk, str, speed: WCLASSES[cls].speed, rarity, tint, highTier: true, huntSet: set, huntBoss: boss,
    special: `Huntwright ${set}. ${txt}. Crafted from ${boss} parts.`, req: { Attack: Math.min(L, 1000), Hunter: hun, Swordsmanship: Math.round(hun / 2) }, value: L * 400 });
  for (const [slot, word, k] of [['head', 'helm', 0.42], ['body', 'cuirass', 1], ['legs', 'greaves', 0.78]])
    U(`${set} ${word}`, { type: slot, set, huntSet: set, huntBoss: boss, def: Math.round(dfn * k), rdef: Math.round(dfn * 0.9 * k), rarity, tint, highTier: true,
      special: `${set} hunt set. ${txt}. Crafted from ${boss} parts.`, req: { Defence: Math.min(L, 1000), Hunter: hun }, value: L * 250 });
  SETS[set] = { pieces: ['head', 'body', 'legs'], fx: { huntSet: set } };
}
