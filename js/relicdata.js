// Relicry data: dig sites (one per climate region, positions come from regiondata.js), their artifacts,
// restoration materials, collection rewards and the reforge list. Pure data + save normalizer (no three.js).
export const SITES = {
  'Drowned Chapel':     { mat: 'Bog-iron flake', theme: { floor: 0x3a4436, wall: 0x56604e, accent: 0x7aa08a, glow: 0x60e0c0 }, reward: 'Drowned reliquary staff',
    arts: [['Chapel bell', 1], ["Pilgrim's lamp", 6], ['Drowned censer', 12]] },
  'Frozen Barrow':      { mat: 'Frostglass', theme: { floor: 0x8a96a6, wall: 0xb8c6d6, accent: 0xd8f0ff, glow: 0xbfe8ff }, reward: "Barrow-king's cuirass",
    arts: [["Barrow-king's torc", 20], ['Rime-carved horn', 25], ['Frozen war-banner', 30]] },
  'Sky Shrine Ruins':   { mat: 'Skyslate', theme: { floor: 0x7a7a86, wall: 0xa6a6b0, accent: 0x9ad8ff, glow: 0x9ad8ff }, reward: 'Skyreach warbow',
    arts: [['Wind-chime crown', 35], ['Feathered idol', 40], ['Shrine keystone', 44]] },
  'Sunken Sun Temple':  { mat: 'Sunstone dust', theme: { floor: 0xb08a58, wall: 0xc8a46c, accent: 0xffd860, glow: 0xffd860 }, reward: 'Sun-disc ward',
    arts: [['Sun-disc mirror', 45], ['Scarab seal', 48], ['Temple sundial', 52]] },
  'Overgrown Ziggurat': { mat: 'Vine resin', theme: { floor: 0x4a5a3a, wall: 0x6a7a4e, accent: 0x60d070, glow: 0x60d070 }, reward: 'Ziggurat scale body',
    arts: [['Jade mask', 50], ['Serpent sceptre', 55], ['Calendar stone', 58]] },
  'Cinder Forge Vault': { mat: 'Cinderglass', theme: { floor: 0x3a2a26, wall: 0x5a3a30, accent: 0xff7a30, glow: 0xff8a40 }, reward: 'Sunforged khopesh',
    arts: [['Forge-god anvil', 60], ['Ember crown', 66], ['First hammer', 72]] }
};
// Reforge (restoration of relic arms from fragments): fragments + site material + coins.
export const REFORGE = {
  'Drowned reliquary staff':  { site: 'Drowned Chapel', frags: 14, mat: 30, level: 50 },
  "Barrow-king's helm":       { site: 'Frozen Barrow', frags: 8, mat: 25, level: 40 },
  "Barrow-king's greaves":    { site: 'Frozen Barrow', frags: 12, mat: 30, level: 60 },
  "Barrow-king's cuirass":    { site: 'Frozen Barrow', frags: 16, mat: 35, level: 65 },
  'Skyreach warbow':          { site: 'Sky Shrine Ruins', frags: 14, mat: 30, level: 55 },
  'Sun-disc ward':            { site: 'Sunken Sun Temple', frags: 12, mat: 30, level: 55 },
  'Mirage silk robe':         { site: 'Sunken Sun Temple', frags: 10, mat: 25, level: 45 },
  'Ziggurat scale body':      { site: 'Overgrown Ziggurat', frags: 12, mat: 30, level: 50 },
  'Sunforged khopesh':        { site: 'Cinder Forge Vault', frags: 16, mat: 35, level: 60 }
};
export const artXp = lvl => 40 + lvl * 4;            // restoring
export const digXp = lvl => 8 + lvl * 0.9;           // per excavation find
export const collXp = lvl => 300 + lvl * 30;         // collection turn-in
export function normalizeRelicry(r) {
  const o = r && typeof r === 'object' ? r : {};
  const num = v => Math.max(0, Math.floor(Number(v) || 0));
  const out = { coll: {}, runs: num(o.runs), best: num(o.best), seen: {} };
  for (const s of Object.keys(SITES)) out.coll[s] = num(o.coll && o.coll[s]);
  if (o.seen && typeof o.seen === 'object') for (const [k, v] of Object.entries(o.seen)) if (typeof k === 'string' && k.length < 20) out.seen[k] = num(v);
  return out;
}
