// Batch 6: about a thousand more quests, generated deterministically from templates (same quests, same ids on every
// load, so saves keep their progress). Every town, climate camp and quest village has four quest givers, each with a
// 20-quest storyline that climbs in level. Steps use the normal data format (quests2.js): bring, kill, xp, visit, talk.
// Plus the hand-written village storylines (goblin village, ogre village, and the quest that opens the elven town).
import { ITEMS } from './items.js';
import { makeRng } from './rng.js';
import { VILLAGES } from './villagedata.js';

// [hub, x, z, base level, local monsters [name, level], culture]
const HUBS = [
  ['Larkhaven', 0, 0, 1, [['Goblin', 2], ['Cow', 2], ['Wolf', 14], ['Zombie', 18], ['Skeleton', 22], ['Dark Archer', 25], ['Giant Spider', 27], ['Crag Giant', 28], ['Ironveil Knight', 33]], 'human'],
  ['Emberfold', 50, -24, 5, [['Goblin', 2], ['Wolf', 14], ['Skeleton', 22], ['Bandit', 30], ['Ironveil Knight', 33]], 'human'],
  ['Saltreach', -80, 60, 10, [['Bandit', 30], ['Drowned Deckhand', 24], ['Drowned Gunner', 34], ['Bog Giant', 42], ['Ice Giant', 53]], 'human'],
  ['Whitecairn', -60, -80, 15, [['Zombie', 18], ['Skeleton', 22], ['Ironveil Knight', 33], ['Ogre', 53], ['Ice Giant', 53]], 'human'],
  ['Highcrest', 120, -40, 20, [['Wolf', 14], ['Bandit', 30], ['Ogre', 53], ['Green Dragon', 79], ['Cinder Fiend', 82]], 'human'],
  ['Bogwatch', -360, 185, 22, [['Fen Crawler', 24], ['Mire Hag', 40]], 'human'],
  ['Cragmoor Lodge', 235, -350, 28, [['Crag Ram', 30], ['Skyreach Harpy', 44]], 'human'],
  ['Rimeholt', -250, -355, 32, [['Frostfang Wolf', 36], ['Rime Wraith', 48]], 'human'],
  ['Mirage Well', 360, 120, 38, [['Dune Scuttler', 38], ['Sand Reaver', 50]], 'human'],
  ['Vinehollow', 210, 360, 44, [['Vine Lurker', 45], ['Canopy Stalker', 58]], 'human'],
  ['Cinderpost', 355, -140, 52, [['Ember Imp', 52], ['Magma Brute', 70]], 'human'],
  ['Snarlwick', 190, 40, 4, [['Goblin', 2], ['Wolf', 14], ['Bandit', 30]], 'goblin'],
  ['Gorrumhold', -200, -30, 36, [['Ogre', 53], ['Bog Giant', 42], ['Ice Giant', 53]], 'ogre'],
  ['Sylvaranth', 30, 230, 48, [['Giant Spider', 27], ['Dark Archer', 25], ['Green Dragon', 79]], 'elf']
];
// Roles: theme, skills used, giver title, look preset
const ROLES = {
  forester: { title: ['Woodwarden', 'Forester', 'Bowyer'], skills: ['Woodcutting', 'Fletching'], look: 'ranger', face: '🪓' },
  prospector: { title: ['Prospector', 'Smith', 'Forgemaster'], skills: ['Mining', 'Smithing'], look: 'dwarf', face: '⛏️' },
  angler: { title: ['Angler', 'Cook', 'Innkeeper'], skills: ['Fishing', 'Cooking'], look: 'cook', face: '🎣' },
  warden: { title: ['Warden', 'Captain', 'Huntmaster'], skills: ['Attack', 'Strength', 'Defence', 'Ranged'], look: 'soldier', face: '⚔️' },
  lore: { title: ['Loremaster', 'Seer', 'Archivist'], skills: ['Magic', 'Glyphcraft', 'Prayer'], look: 'wizard', face: '📜' },
  herbal: { title: ['Herbwife', 'Apothecary', 'Healer'], skills: ['Herbalism'], look: 'herbal', face: '🌿' },
  tinker: { title: ['Tinker', 'Weaver', 'Tanner'], skills: ['Crafting'], look: 'worker', face: '🧵' },
  scout: { title: ['Scout', 'Pathfinder', 'Fence'], skills: ['Agility', 'Thieving', 'Ranged'], look: 'thief', face: '🧭' }
};
const ROLE_ORDER = ['forester', 'prospector', 'angler', 'warden', 'lore', 'herbal', 'tinker', 'scout'];
const NAMES = {
  human: ['Aldous', 'Brynn', 'Cedric', 'Delia', 'Edric', 'Fiora', 'Garrick', 'Hester', 'Ivo', 'Jessamy', 'Kellan', 'Linnet', 'Marek', 'Nessa', 'Osric', 'Perrin', 'Quilla', 'Roderick', 'Sorrel', 'Tamsen', 'Ulric', 'Verity', 'Wendel', 'Yarrow', 'Anselm', 'Briony', 'Corwin', 'Dagny', 'Emeric', 'Fenna', 'Gideon', 'Hollis', 'Isolde', 'Jory', 'Kestrel', 'Lowell', 'Maude', 'Niall', 'Odette', 'Pell', 'Rowena', 'Silas', 'Thea', 'Wystan'],
  goblin: ['Snik', 'Grubba', 'Nogg', 'Zitch', 'Krabble', 'Muckle'],
  ogre: ['Gorrum', 'Thudda', 'Brakk', 'Moggra', 'Ungo', 'Hrolla'],
  elf: ['Aelindra', 'Thalanor', 'Sereth', 'Ilyndra', 'Faelar', 'Caelith']
};
const LOOKS = {
  goblin: { body: 0x5a4a2a, legs: 0x3a2a1a, skin: 0x6aa040, build: 0.78, height: 0.8, nose: 1.6, jaw: 1.3, eyes: 0xd0b020, hair: null },
  ogre: { body: 0x6a4a2a, legs: 0x4a3a1a, skin: 0x8a9a5a, build: 1.45, height: 1.35, nose: 1.7, jaw: 1.6, hair: null },
  elf: { body: 0xd8e4d0, legs: 0x5a7a5a, skin: 0xf0d8c0, build: 0.86, height: 1.1, hair: 0xe8dcb0, jaw: 0.8, apron: 0x8ab0e0 }
};
const TIER = l => l < 15 ? 'Novice' : l < 35 ? 'Intermediate' : l < 60 ? 'Experienced' : l < 80 ? 'Master' : 'Grandmaster';
// Gatherables and makeables: [item, level, skill, base count]
const GOODS = {
  Woodcutting: [['Logs', 1, 6], ['Oak logs', 15, 6], ['Willow logs', 30, 6], ['Maple logs', 45, 5], ['Yew logs', 60, 4], ['Magic logs', 75, 3]],
  Fletching: [['Shortbow', 5, 2], ['Oak shortbow', 20, 2], ['Willow shortbow', 35, 2], ['Maple shortbow', 50, 2], ['Yew shortbow', 65, 1], ['Magic shortbow', 80, 1], ['Bronze arrows', 1, 15], ['Iron arrows', 15, 15], ['Steel arrows', 30, 15]],
  Mining: [['Copper ore', 1, 6], ['Tin ore', 1, 6], ['Iron ore', 15, 6], ['Coal', 30, 6], ['Bluesteel ore', 50, 4], ['Verdite ore', 70, 3]],
  Smithing: [['Bronze bar', 1, 4], ['Iron bar', 15, 4], ['Steel bar', 30, 4], ['Bluesteel bar', 50, 3], ['Verdite bar', 70, 2]],
  Fishing: [['Raw shrimp', 1, 6], ['Raw trout', 20, 5], ['Raw salmon', 30, 5], ['Raw lobster', 40, 4], ['Raw swordfish', 50, 3], ['Raw shark', 76, 3]],
  Cooking: [['Cooked shrimp', 1, 5], ['Cooked meat', 1, 5], ['Cooked trout', 15, 5], ['Cooked salmon', 25, 5], ['Cooked lobster', 40, 4], ['Cooked swordfish', 45, 3], ['Cooked shark', 80, 3]],
  Herbalism: [['Greenwort', 1, 4], ['Marshmint', 5, 4], ['Tallowroot', 11, 4], ['Attack potion', 3, 2], ['Antipoison', 5, 2], ['Strength potion', 12, 2], ['Energy potion', 26, 2], ['Prayer potion', 38, 2], ['Super attack', 45, 2], ['Super restore', 63, 1], ['Ranging potion', 72, 1]],
  Crafting: [['Flax', 1, 8], ['Bowstring', 10, 5], ['Soft leather', 1, 4], ['Leather body', 14, 1], ['Hard leather', 28, 3], ['Hard leather body', 28, 1], ['Cowhide', 1, 5]],
  Glyphcraft: [['Air rune', 1, 20], ['Water rune', 5, 20], ['Earth rune', 9, 20], ['Fire rune', 14, 20], ['Thought rune', 2, 20], ['Havoc rune', 35, 15]],
  Prayer: [['Bones', 1, 6], ['Big bones', 20, 5], ['Dragon bones', 60, 3]],
  Magic: [['Air rune', 1, 25], ['Water rune', 5, 25], ['Earth rune', 9, 25], ['Fire rune', 14, 25], ['Vial of water', 1, 5]],
  Combat: [['Bones', 1, 5], ['Cowhide', 1, 4], ['Feather', 1, 15]]
};
const XP_HINT = { Agility: 'Run an agility course.', Thieving: 'Pick pockets or crack stalls.', Magic: 'Cast spells.', Prayer: 'Bury bones or offer them.', Attack: 'Fight with an accurate style.', Strength: 'Fight with an aggressive style.', Defence: 'Fight defensively.', Ranged: 'Fight with a bow.', Glyphcraft: 'Bind glyphs at an altar.' };
// Title pieces (original): adjective + noun, and story lines with {hub}, {who}, {thing}
const ADJ = ['Splintered', 'Hollow', 'Silent', 'Gilded', 'Forgotten', 'Crooked', 'Ashen', 'Wandering', 'Restless', 'Moonlit', 'Sunken', 'Tangled', 'Bitter', 'Patient', 'Broken', 'Hidden', 'Weathered', 'Lantern-lit', 'Frostbitten', 'Smouldering', 'Thorned', 'Faithful', 'Long', 'Last', 'Stolen', 'Untold', 'Wayward', 'Quiet', 'Scarlet', 'Copper'];
const NOUN = ['Oath', 'Errand', 'Ledger', 'Harvest', 'Debt', 'Watch', 'Promise', 'Bargain', 'Remedy', 'Song', 'Signal', 'Bridge', 'Road', 'Toll', 'Crown', 'Key', 'Kettle', 'Banner', 'Anvil', 'Net', 'Lantern', 'Mark', 'Feast', 'Cradle', 'Compass', 'Hearth', 'Map', 'Chime', 'Shrine', 'Ember'];
const WHY = {
  forester: ['The {hub} stockade is rotting through.', 'A storm felled half the windbreak.', 'The bowyers are short of good staves.', 'We need timber for a new bridge.'],
  prospector: ['The forge has gone cold for want of ore.', 'A seam collapsed and we must shore it up.', 'The smiths have an order from the road wardens.', 'Tools wear out faster than we can mend them.'],
  angler: ['The feast is in three days and the larder is bare.', 'Travellers are arriving hungry.', 'The smokehouse needs stocking before the cold.', 'The children of {hub} have had nothing but porridge.'],
  warden: ['Something has been raiding the outskirts of {hub}.', 'The patrol came back two short.', 'The road is not safe after dusk.', 'We must thin them out before they grow bold.'],
  lore: ['An old record speaks of a place I must see confirmed.', 'The wards of {hub} are thinning.', 'A star fell and the omens are muddled.', 'My apprentice ran off with my notes.'],
  herbal: ['A fever is going round {hub}.', 'The healers\' stores are nearly empty.', 'A traveller was bitten by something foul.', 'The midwives need tonics.'],
  tinker: ['Every cloak in {hub} is threadbare.', 'The tannery has an order it cannot fill.', 'We are stitching banners for the fair.', 'The road wardens need new jerkins.'],
  scout: ['There are tracks around {hub} I do not like.', 'A courier never arrived.', 'Someone is moving goods at night.', 'The old ways need walking again.']
};
const END = ['That will do nicely. {hub} owes you.', 'You have a knack for this. Thank you.', 'Splendid work. Take this for your trouble.', 'I will tell everyone in {hub} what you did.', 'Just what was needed. Come back soon; there is always more.'];

const pick = (r, a) => a[Math.floor(r() * a.length)];
const best = (list, L) => { const ok = list.filter(([n, lv]) => lv <= Math.max(1, L) && ITEMS[n]); return ok.length ? ok : list.filter(([n]) => ITEMS[n]).slice(0, 1); };

export const GEN_NPCS = [];   // [id, name, x, z, lookObject, examine, face]
export const GEN_PLACES = {}; // place id -> { x, z, r, name }
export const QDATA6 = [];
const usedNames = new Set();
function questName(r) { for (let i = 0; i < 40; i++) { const n = `The ${pick(r, ADJ)} ${pick(r, NOUN)}`; if (!usedNames.has(n)) { usedNames.add(n); return n; } }
  let k = 2, n; do n = `The ${pick(r, ADJ)} ${pick(r, NOUN)} ${['II', 'III', 'IV', 'V', 'VI'][Math.min(4, k - 2)]}${k > 6 ? ' ' + k : ''}`, k++; while (usedNames.has(n)); usedNames.add(n); return n; }

HUBS.forEach(([hub, hx, hz, base, mons, culture], hi) => {
  const hid = hub.toLowerCase().replace(/[^a-z]/g, '');
  GEN_PLACES[hid + 'Hub'] = { x: hx, z: hz, r: 7, name: `the heart of ${hub}` };
  // three waymarks around each hub for visit steps
  [[0.3, 'north'], [2.4, 'south-west'], [4.3, 'east']].forEach(([a, dir], k) => { const d = culture === 'human' && hi < 5 ? 34 : 30; GEN_PLACES[`${hid}Way${k}`] = { x: Math.round(hx + Math.sin(a) * d), z: Math.round(hz - Math.cos(a) * d), r: 6, name: `the waymark ${dir} of ${hub}` }; });
  const r = makeRng(hi * 7919 + 13);
  const roles = [0, 1, 2, 3].map(k => ROLE_ORDER[(hi * 3 + k * 2) % ROLE_ORDER.length]);
  const givers = roles.map((role, k) => {
    const R = ROLES[role], first = NAMES[culture][(hi * 4 + k) % NAMES[culture].length], title = R.title[(hi + k) % R.title.length];
    const id = `g_${hid}_${k}`, name = culture === 'human' ? `${title} ${first}` : `${first} the ${title}`;
    const a = k * Math.PI / 2 + 0.6, d = culture === 'human' ? 11 + (k % 2) * 3 : 9 + (k % 2) * 4;
    GEN_NPCS.push([id, name, Math.round(hx + Math.cos(a) * d), Math.round(hz + Math.sin(a) * d), LOOKS[culture] || R.look, `${name} of ${hub}. ${culture === 'human' ? 'Always has work for an adventurer.' : culture === 'goblin' ? 'Surprisingly polite, for a goblin.' : culture === 'ogre' ? 'Big, slow-spoken and very patient.' : 'Ageless eyes, a quiet voice.'}`, R.face]);
    return { id, name, role, R };
  });
  givers.forEach((G, k) => {
    let prev = null;
    for (let i = 0; i < 20; i++) {
      const L = Math.min(95, Math.round(base + i * (90 - base) / 19 * 0.82 + k * 2));
      const steps = [], xp = {}, req = { lvl: {} }, nSteps = 1 + (i % 3 === 2 ? 2 : i % 2);
      const sk = G.R.skills[(i + k) % G.R.skills.length];
      for (let s = 0; s < nSteps; s++) {
        const kind = s === 0 ? (G.role === 'warden' ? 'kill' : G.role === 'scout' && i % 2 ? 'visit' : 'bring') : pick(r, ['kill', 'visit', 'xp', 'talk', 'bring']);
        if (kind === 'bring') {
          const pool = GOODS[G.role === 'warden' ? 'Combat' : sk] || GOODS.Combat, [item, lv, n] = pick(r, best(pool, L));
          const cnt = Math.max(1, Math.round(n * (1 + i * 0.06)));
          if (steps.some(x => x.t === 'bring')) continue;
          steps.push({ t: 'bring', items: { [item]: cnt } });
          if (lv > 1 && ['Woodcutting', 'Fletching', 'Mining', 'Smithing', 'Fishing', 'Cooking', 'Herbalism', 'Crafting', 'Glyphcraft'].includes(sk)) req.lvl[sk] = Math.max(req.lvl[sk] || 0, lv);
        } else if (kind === 'kill') {
          const ok = mons.filter(([, ml]) => ml <= L + 12), [mon, ml] = ok.length ? pick(r, ok) : mons[0];
          steps.push({ t: 'kill', mon, n: Math.max(2, Math.min(12, 3 + Math.round(i / 3))) });
        } else if (kind === 'visit') {
          steps.push({ t: 'visit', place: `${hid}Way${Math.floor(r() * 3)}` });
        } else if (kind === 'xp') {
          const s2 = pick(r, G.R.skills); steps.push({ t: 'xp', skill: s2, n: Math.round((200 + L * L * 1.6) / 10) * 10, ...(XP_HINT[s2] ? { hint: XP_HINT[s2] } : {}) });
        } else {
          const o = givers[(k + 1 + Math.floor(r() * 3)) % 4];
          steps.push({ t: 'talk', npc: o.id, where: `in ${hub}`, say: [`${G.name.split(' ').pop()} sent you? Good. Tell them I'll see to my part.`, 'Now off you go, before it gets dark.'] });
        }
      }
      if (!steps.length) steps.push({ t: 'visit', place: `${hid}Hub` });
      const qid = `${hid}_${k}_${i + 1}`;
      xp[sk] = Math.round((120 + L * L * 2.2) / 10) * 10;
      const d = { id: qid, name: questName(r), town: hub, giver: G.id, where: `in ${hub}`, diff: TIER(L), points: L >= 60 ? 2 : 1,
        intro: [pick(r, WHY[G.role]).replace('{hub}', hub), pick(r, ['Will you help?', 'Can I count on you?', 'You look capable. Interested?', 'There is coin in it for you.'])], steps, xp, gold: Math.round(50 + L * L * 1.5),
        end: pick(r, END).replace('{hub}', hub), thanks: `${hub} remembers your help.` };
      const rq = {}; if (prev) rq.q = [prev]; if (Object.keys(req.lvl).length) rq.lvl = req.lvl;
      if (hub === 'Sylvaranth' && !prev) rq.q = ['moonlit_ward'];
      if (rq.q || rq.lvl) d.req = rq;
      if (i === 19) { d.bonus = { desc: `+1% ${sk} XP`, fx: { ['xp.' + sk]: 0.01 } }; d.name = `${G.name.split(' ').pop()}'s ${pick(r, ['Legacy', 'Masterwork', 'Final Word', 'Crowning Task'])}`; }
      QDATA6.push(d); prev = qid;
    }
  });
});

// ---- hand-written village storylines ----
const V = id => VILLAGES.find(v => v.id === id);
const sy = V('sylvaranth');
GEN_NPCS.push(['thalanor_envoy', 'Envoy Ilmarë', sy.x + sy.envoy.dx, sy.z + sy.envoy.dz, LOOKS.elf, 'An elven envoy waiting outside the shimmering ward of Sylvaranth.', '🧝']);
GEN_NPCS.push(['grubnash', 'Chief Grubnash', 190, 38, { ...LOOKS.goblin, hat: 0xc0a040, hatH: 0.25 }, 'The chief of Snarlwick. His crown is a dented saucepan.', '👑']);
GEN_NPCS.push(['gorrum_elder', 'Elder Hrumvald', -200, -27, { ...LOOKS.ogre, beard: 0x8a8a7a }, 'The oldest ogre in Gorrumhold. He speaks very slowly and means every word.', '🪨']);
GEN_PLACES.sylvaWard = { x: sy.x, z: sy.z - 24, r: 5, name: 'the edge of the Sylvaranth ward' };
GEN_PLACES.moonPool = { x: -20, z: 16, r: 10, name: 'the shore of Larkhaven lake at night' };
QDATA6.push(
  { id: 'snarlwick_peace', name: 'Peace in Snarlwick', town: 'Snarlwick', giver: 'grubnash', where: 'in the middle of Snarlwick', diff: 'Novice', points: 2,
    intro: ['Big-folk always hit goblins. Snarlwick goblins not like other goblins! We trade, we farm, we sing (badly).', 'Wild goblins from the hills give us bad name. Thin them, and bring Grubnash cooked meat for peace-feast.'],
    steps: [{ t: 'kill', mon: 'Goblin', n: 8 }, { t: 'bring', items: { 'Cooked meat': 5 } }, { t: 'talk', npc: 'g_snarlwick_0', where: 'in Snarlwick', say: ['Peace-feast? With big-folk? ...Fine. Snarlwick shops open to you now.'] }],
    xp: { Attack: 800, Cooking: 600 }, gold: 400, bonus: { desc: 'Snarlwick goblins call you friend (+1% Thieving XP)', fx: { 'xp.Thieving': 0.01 } },
    end: 'Peace-feast is best feast! You honorary goblin now. Mind the saucepan.', thanks: 'Hello, honorary goblin!' },
  { id: 'gorrum_stones', name: 'The Standing Stones of Gorrumhold', town: 'Gorrumhold', giver: 'gorrum_elder', where: 'by the great longhouse in Gorrumhold', diff: 'Experienced', points: 3, req: { lvl: { Strength: 40, Mining: 35 } },
    intro: ['Little one. The clan stones... are cracked. Ogres remember... by the stones.', 'Bring stone-binding: iron bars and coal. Then... drive off the rogue ogres who broke them.'],
    steps: [{ t: 'bring', items: { 'Iron bar': 8, Coal: 10 } }, { t: 'kill', mon: 'Ogre', n: 4 }, { t: 'xp', skill: 'Strength', n: 5000, hint: 'Fight with an aggressive style.' }],
    xp: { Strength: 6000, Mining: 3000 }, gold: 3000, bonus: { desc: 'Ogre-strength: +1% Strength XP', fx: { 'xp.Strength': 0.01 } },
    end: 'The stones... stand. Gorrumhold... remembers you now. Always.', thanks: 'Little one... welcome.' },
  { id: 'moonlit_ward', name: 'The Moonlit Ward', town: 'Sylvaranth', giver: 'thalanor_envoy', where: 'outside the ward of Sylvaranth, far south of Larkhaven', diff: 'Experienced', points: 4,
    req: { q: ['snarlwick_peace'], lvl: { Magic: 40, Herbalism: 30 } },
    intro: ['Mortal. The ward of Sylvaranth opens only for one who has shown kindness to the unloved and patience with the old ways.', 'You made peace with goblins, I hear. Now: bring me moonwater remedies, walk the lake shore by night, and strengthen the ward with your own craft.'],
    steps: [{ t: 'bring', items: { 'Energy potion': 3, 'Vial of water': 5 } }, { t: 'visit', place: 'moonPool' }, { t: 'xp', skill: 'Magic', n: 6000, hint: 'Cast spells.' }, { t: 'visit', place: 'sylvaWard' }],
    xp: { Magic: 8000, Herbalism: 5000 }, gold: 5000, bonus: { desc: 'Elf-friend: +1% Magic and Herbalism XP', fx: { 'xp.Magic': 0.01, 'xp.Herbalism': 0.01 } },
    end: 'The ward knows your name now. Walk in Sylvaranth as a friend.', thanks: 'Elen síla... ah, forgive me. Welcome, friend.' }
);
