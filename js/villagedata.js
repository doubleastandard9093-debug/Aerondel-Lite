// Quest villages of Aerondel (plain data, no three.js): the goblin village of Snarlwick, the ogre village of
// Gorrumhold and the elven town of Sylvaranth, whose ward only parts for those who finish "The Moonlit Ward".
export const VILLAGES = [
  { id: 'snarlwick', name: 'Snarlwick', kind: 'goblin', x: 190, z: 40, r: 26,
    blurb: 'A ramshackle goblin village of mud huts and crooked totems, east of Emberfold.',
    mobs: [['Goblin', 22, 20, 4], ['Goblin', 26, -18, 4], ['Goblin', -24, 22, 4], ['Wolf', -30, -26, 3]] },
  { id: 'gorrumhold', name: 'Gorrumhold', kind: 'ogre', x: -200, z: -30, r: 30,
    blurb: 'Great hide-roofed longhouses and standing stones: the ogre clans of Gorrumhold, west of Whitecairn.',
    mobs: [['Ogre', 30, 26, 4], ['Ogre', -30, 28, 4], ['Bog Giant', 34, -30, 3]] },
  { id: 'sylvaranth', name: 'Sylvaranth', kind: 'elf', x: 30, z: 230, r: 28, ward: 26, gateQuest: 'moonlit_ward',
    envoy: { dx: 0, dz: -34 },
    blurb: 'White towers under silver leaves, far south of Larkhaven. A shimmering ward keeps strangers out.',
    mobs: [['Giant Spider', 36, 30, 3], ['Dark Archer', -36, 30, 3]] }
];
export const villageById = id => VILLAGES.find(v => v.id === id);
