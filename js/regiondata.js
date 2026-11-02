// Climate regions around the heartland (pure data, no imports, safe to read from world.js).
//
// To add a region: append an entry. Everything below is optional except id/name/biome/x/z/r.
// Coordinates in `camp`, `nodes`, `mobs`, `dig`, `pond`, `delveHub` are OFFSETS from (x, z).
//   biome     : look + climate. One of BIOMES' keys (or add a new biome there).
//   r         : radius of the region (terrain is softened and tinted inside it).
//   scatter   : { propKind: count } placed with a seeded RNG (see regions.js KINDS). Built lazily per chunk.
//   nodes     : resource nodes for existing skills: ['tree', kind, dx, dz] | ['rock', ore, dx, dz] | ['fish', kind, dx, dz] | ['herb', herb, dx, dz]
//   mobs      : [MONSTER_TYPE, dx, dz, roam]
//   dig       : Relicry dig site { name, dx, dz, level }
//   delveHub  : Delving entrance { dx, dz } (only one region needs it)
export const BIOMES = {
  tundra:   { tint: [1.16, 1.26, 1.78], paint: ['0,255,0', 1],   fog: 0xdfe8f2, fogK: 1.35, particles: 'snow',   relief: 'mounds', map: '#e4ecf4' },
  alpine:   { tint: [1.12, 1.06, 1.22], paint: ['255,0,0', 0.25], fog: 0xc8d6e4, fogK: 1.1, particles: null,     relief: 'crags',  map: '#8a9a78' },
  volcanic: { tint: [0.62, 0.5, 0.5],   paint: ['255,0,0', 1],    fog: 0x5a4a44, fogK: 1.5, particles: 'ash',    relief: 'crags',  map: '#4a3a36' },
  desert:   { tint: [1.06, 1.0, 0.92],  paint: ['0,255,0', 1],    fog: 0xe8d4a8, fogK: 1.2, particles: 'sand',   relief: 'dunes',  map: '#d8c088' },
  jungle:   { tint: [0.72, 1.02, 0.66], paint: null,              fog: 0x9ab890, fogK: 1.4, particles: 'leaves', relief: 'mounds', map: '#2a5a24' },
  swamp:    { tint: [0.76, 0.84, 0.68], paint: ['255,0,0', 0.45], fog: 0x8a9a7a, fogK: 1.8, particles: 'spores', relief: 'flat',   map: '#4a5a3a' },
};

export const REGION_DATA = [
  { id: 'rimeholt', name: 'Rimeholt Tundra', biome: 'tundra', x: -250, z: -355, r: 72,
    camp: { name: 'Rimeholt', dx: 0, dz: 0 },
    scatter: { pine: 70, snowrock: 26, iceshard: 14, deadtree: 10 },
    nodes: [['tree', 'Yew', 18, -10], ['tree', 'Yew', 22, -4], ['tree', 'Maple', -20, 14], ['rock', 'Coal', -12, -18], ['rock', 'Coal', -9, -21], ['rock', 'Bluesteel', -15, -22], ['fish', 'Harpoon', 30, 22], ['herb', 'Snapdragon', 6, 20]],
    pond: { dx: 30, dz: 26, r: 6 },
    mobs: [['Frostfang Wolf', -30, 30, 4], ['Frostfang Wolf', -36, 24, 4], ['Rime Wraith', 40, -30, 3], ['Rime Wraith', 46, -24, 3]],
    dig: { name: 'Frozen Barrow', dx: -34, dz: -6, level: 20 } },
  { id: 'skyreach', name: 'Skyreach Highlands', biome: 'alpine', x: 235, z: -350, r: 66,
    camp: { name: 'Cragmoor Lodge', dx: 0, dz: 0 },
    scatter: { pine: 55, boulder: 30, fern: 20 },
    nodes: [['tree', 'Maple', 14, 12], ['tree', 'Maple', 18, 16], ['tree', 'Magic', -22, -16], ['rock', 'Verdite', -14, 18], ['rock', 'Iron', -10, 22], ['rock', 'Iron', -17, 20], ['herb', 'Knotroot', 20, -14]],
    mobs: [['Crag Ram', 30, 30, 5], ['Crag Ram', 24, 36, 5], ['Skyreach Harpy', -34, -28, 3], ['Skyreach Harpy', -28, -34, 3]],
    dig: { name: 'Sky Shrine Ruins', dx: 30, dz: -22, level: 35 } },
  { id: 'ashveil', name: 'Ashveil Wastes', biome: 'volcanic', x: 365, z: -140, r: 56,
    camp: { name: 'Cinderpost', dx: -10, dz: 0 },
    scatter: { lavarock: 40, deadtree: 18, vent: 10 },
    nodes: [['rock', 'Emberite', 18, 14], ['rock', 'Cobalt', 22, 10], ['rock', 'Coal', 14, 18], ['rock', 'Coal', 20, 20]],
    mobs: [['Ember Imp', 24, -24, 4], ['Ember Imp', 30, -18, 4], ['Magma Brute', 28, 30, 2]],
    dig: { name: 'Cinder Forge Vault', dx: -24, dz: -24, level: 60 } },
  { id: 'sunscour', name: 'Sunscour Dunes', biome: 'desert', x: 360, z: 120, r: 60,
    camp: { name: 'Mirage Well', dx: 0, dz: 0 },
    scatter: { cactus: 45, palm: 12, sandstone: 22, bones: 10 },
    nodes: [['tree', 'Oak', 24, 4], ['rock', 'Bluesteel', -18, 16], ['rock', 'Tin', -14, 20], ['rock', 'Copper', -21, 21], ['fish', 'Net', 18, 14], ['herb', 'Amberleaf', 14, -8]],
    pond: { dx: 18, dz: 16, r: 4 },
    mobs: [['Dune Scuttler', 30, 26, 4], ['Dune Scuttler', 36, 20, 4], ['Sand Reaver', -32, -28, 3]],
    dig: { name: 'Sunken Sun Temple', dx: 32, dz: -24, level: 45 },
    delveHub: { dx: -30, dz: -14 } },
  { id: 'vinehollow', name: 'Verdant Tangle', biome: 'jungle', x: 210, z: 360, r: 60,
    camp: { name: 'Vinehollow', dx: 0, dz: 0 },
    scatter: { palm: 40, junglebush: 50, fern: 40, pine: 10 },
    nodes: [['tree', 'Yew', 16, 14], ['tree', 'Magic', -20, 18], ['tree', 'Willow', 22, -14], ['fish', 'Lure', -26, -14], ['herb', 'Harrowbloom', 10, -20], ['herb', 'Snapdragon', 14, -22]],
    pond: { dx: -26, dz: -18, r: 5 },
    mobs: [['Vine Lurker', 30, 28, 4], ['Vine Lurker', 24, 34, 4], ['Canopy Stalker', -34, 30, 4]],
    dig: { name: 'Overgrown Ziggurat', dx: -30, dz: 32, level: 50 } },
  { id: 'mirelow', name: 'Mirelow Fen', biome: 'swamp', x: -360, z: 185, r: 60,
    camp: { name: 'Bogwatch', dx: 0, dz: 0 },
    scatter: { deadtree: 36, reed: 60, mossrock: 18 },
    nodes: [['tree', 'Willow', 14, 12], ['tree', 'Willow', 18, 16], ['tree', 'Willow', 12, 18], ['fish', 'Net', -18, 18], ['fish', 'Lure', -22, 14], ['herb', 'Marshmint', 20, -12], ['herb', 'Tallowroot', 24, -10]],
    pond: { dx: -22, dz: 20, r: 7 },
    mobs: [['Fen Crawler', 30, -26, 4], ['Fen Crawler', 36, -20, 4], ['Mire Hag', -30, -30, 3]],
    dig: { name: 'Drowned Chapel', dx: -32, dz: -20, level: 1 } },
];

// Weight 0..1 of region `R` at (x, z): 1 inside 70% of the radius, easing to 0 at the edge.
export function regionWeight(R, x, z) {
  const d = Math.hypot(x - R.x, z - R.z) / R.r;
  if (d >= 1) return 0;
  const t = Math.min(1, (1 - d) / 0.3);
  return t * t * (3 - 2 * t);
}
export function regionAt(x, z) {
  for (const R of REGION_DATA) if (Math.hypot(x - R.x, z - R.z) < R.r) return R;
  return null;
}
