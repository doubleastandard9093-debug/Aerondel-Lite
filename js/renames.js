// Original-name pass (save v19). RuneScape-derived names were replaced with original ones,
// matching Gielinor Unreal (Data/TownRenames.h + Data/ContentRenames.h). The same table rewrites
// old saves and exports on load (migrateRenameText), so ids that are display names stay in step.
const T = [
  // World
  ['Gielinor', 'Aerondel'],
  // Towns, places, buildings
  ['Port Sarim', 'Saltreach'], ['Brightwater', 'Larkhaven'], ['Ashford', 'Emberfold'], ['Varrock', 'Highcrest'],
  ['Falador', 'Whitecairn'], ['Wellmere', 'Thistlewell'], ['Lumbridge', 'Larkhaven'], ['Sails of Sarim', 'Sails of Saltreach'], ['Sarim', 'Saltreach'],
  ["White Knights' Castle", 'Lantern Keep'], ["White Knights\u2019 castle", 'Lantern Keep'], ['White Knights', 'Lantern Knights'], ['White Knight', 'Lantern Knight'],
  ['Rising Sun', 'Gilded Hearth'], ['Rusty Anchor', 'Barnacle Rest'], ['Church of Saradomin', 'Chapel of the Dawnmother'],
  ["Bob's Brilliant Tools", "Tobin's Trusty Tools"],
  // Gods
  ["Saradomin's", "the Dawnmother's"], ['Saradomin', 'the Dawnmother'], ['Wine of zamorak', 'Wine of the pyre'], ['Zamorak', 'the Pyrelord'], ['Guthix', 'the Greenwarden'],
  // NPCs
  ['Slayer Master Vannaka', 'Huntsmaster Dravik'], ['Vannaka', 'Dravik'], ['Amik Varze', 'Aldous Penhale'], ['Amik', 'Aldous'],
  ['Party Pete', 'Merry Mott'], ['Charlie the Tramp', 'Cobb the Wanderer'], ['Charlie', 'Cobb'], ['King Roald', 'King Aldermar'], ['Roald', 'Aldermar'],
  ['Redbeard', 'Saltbeard'], ['Doric', 'Bruna'], ['Aubury', 'Orrin'], ['Zaff', 'Zevin'], ['Thurgo', 'Durgan'], ['Reldo', 'Ansel'],
  ['Romeo', 'Rowan'], ['Juliet', 'Juniper'], ['Gertrude', 'Gwenna'], ['Vyvin', 'Calder'], ['Wydin', 'Wendric'], ['Wayne', 'Wendel'],
  ['Baraek', 'Barrick'], ['Kaylee', 'Fenna'], ['Betty', 'Odessa'], ['Cassie', 'Brisa'], ['Bob', 'Tobin'],
  ['Mizgog', 'Mardoc'], ['Horvik', 'Halvard'], ['Gerrant', 'Garrow'], ['Ellis', 'Ellard'], ['Rovin', 'Roderic'], ['Imcando', 'Deepforge'],
  // Quests
  ["The Knight's Sword", 'A Blade Reforged'], ["Black Knights' Fortress", 'Siege of the Black Keep'], ['Holy Grail', 'Lantern Chalice'],
  ['Grail', 'Chalice'], ['Phoenix Gang', 'Cinder Gang'], ['Phoenix rises', 'Cinder Gang is finished'], ["Cook's Assistant", 'A Cake for the Lark Fair'],
  ['Mystic Arts', 'Starweave Arts'], ["Slayer's Challenge", "Hunter's Challenge"], ['A Runite Blade', 'A Cobalt Blade'],
  // Skills
  ['Runecrafting', 'Glyphcraft'], ['Runecrafter', 'Glyphcrafter'], ['Herblore', 'Herbalism'],
  // Monsters
  ['Black Knight', 'Ironveil Knight'], ['Lesser Demon', 'Cinder Fiend'], ['Moss Giant', 'Bog Giant'], ['Hill Giant', 'Crag Giant'],
  // Prayers
  ['Protect from Missiles', 'Ward against Missiles'], ['Protect from Magic', 'Ward against Magic'], ['Protect from Melee', 'Ward against Melee'],
  ['Superhuman Strength', "Titan's Might"], ['Incredible Reflexes', 'Lightning Wits'], ['Clarity of Thought', 'Clear Mind'],
  ['Burst of Strength', 'Surge of Might'], ['Improved Reflexes', 'Quickened Wits'], ['Ultimate Strength', 'Colossus Might'],
  ['Thick Skin', 'Hardened Hide'], ['Rapid Heal', 'Swift Mending'], ['Steel Skin', 'Iron Hide'], ['Sharp Eye', 'Keen Sight'],
  ['Rock Skin', 'Stone Hide'], ['Eagle Eye', 'Raptor Sight'], ['Hawk Eye', 'Falcon Sight'],
  // Unique items
  ['Amulet of glory', 'Amulet of renown'], ['Ring of recoil', 'Ring of rebuke'], ['Berserker ring', 'Ring of fury'], ['Obsidian cape', 'Cinderglass cape'],
  ['Granite maul', 'Basalt maul'], ['Dark bow', 'Dusk bow'], ['Rune essence', 'Glyph essence'], ['Pure essence', 'Clear essence'],
  ['Limpwurt root', 'Bitterroot'], ['Limpwurt', 'Bitterroot'], ['Snape grass', 'Marsh reed'], ['Mystic', 'Starweave'],
  // Herbs
  ['Guam leaf', 'Greenwort'], ['Guam', 'Greenwort'], ['Marrentill', 'Marshmint'], ['Tarromin', 'Tallowroot'], ['Harralander', 'Harrowbloom'],
  ['Ranarr weed', 'Ravenweed'], ['Ranarr', 'Ravenweed'], ['Irit leaf', 'Ironleaf'], ['Avantoe', 'Amberleaf'], ['Kwuarm', 'Knotroot'],
  ['Cadantine', 'Cindervine'], ['Dwarf weed', 'Stoneweed'], ['Torstol', 'Thornstalk'],
  // Runes and altars
  ['Chaos', 'Havoc'], ['Mind rune', 'Thought rune'], ['Mind altar', 'Thought altar'], ['Body rune', 'Vital rune'], ['Body altar', 'Vital altar'],
  ['Death rune', 'Grave rune'], ['Death altar', 'Grave altar'], ['Blood rune', 'Crimson rune'], ['Blood altar', 'Crimson altar'],
  // Spells (Strike/Bolt/Blast/Wave -> Dart/Lance/Burst/Torrent)
  ...['Wind', 'Water', 'Earth', 'Fire'].flatMap(e => [[`${e} Strike`, `${e} Dart`], [`${e} Bolt`, `${e} Lance`], [`${e} Blast`, `${e} Burst`], [`${e} Wave`, `${e} Torrent`]]),
  // Metals
  ['Mithril', 'Bluesteel'], ['Adamantite', 'Verdite'], ['Adamant', 'Verdite'], ['Runite', 'Cobalt'],
];
// "Rune"/"Dragon" are only metal tiers in front of these words (Fire rune, Dragon bones, Green Dragon stay).
const GEAR = 'bars?|ore|platebody|platelegs|full helm|med helm|longsword|dagger|sword|shield|pickaxe|axe|arrows|bolts|armour|gear|items|set|tier|metal|cutlass|flintlock|crossbow|thrown dagger|throwing axe|scimitar|battleaxe|mace|warhammer|kiteshield|chainbody|boots|gloves|drops|rocks?|equipment';

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
const lower = s => s.toLowerCase();
export const RENAMES = T;
export function buildRenameRules(pairs, metalTiers = true) {
const RULES = [];
for (const [a, b] of [...pairs].sort((x, y) => y[0].length - x[0].length)) {
  RULES.push([new RegExp(`(?<![A-Za-z])${esc(a)}(?![A-Za-z])`, 'g'), b]);
  // lower-case forms of places, metals, herbs, skills and items (ids and prose); not people
  if (lower(a) !== a && !/^[A-Z][a-z]+$/.test(a) || /^(Gielinor|Brightwater|Ashford|Varrock|Falador|Wellmere|Lumbridge|Mithril|Adamantite|Adamant|Runite|Herblore|Runecrafting|Guam|Marrentill|Tarromin|Harralander|Ranarr|Avantoe|Kwuarm|Cadantine|Torstol|Limpwurt|Mystic)$/.test(a)) {
    if (!/^(Gielinor)$/.test(a)) RULES.push([new RegExp(`(?<![A-Za-z])${esc(lower(a))}(?![A-Za-z])`, 'g'), lower(b)]);
  }
}
if (metalTiers) {
RULES.push([/(?<![A-Za-z])Rune or Dragon(?![A-Za-z])/g, 'Cobalt or Emberite']);
RULES.push([new RegExp(`(?<![A-Za-z])Rune (?=(${GEAR})(?![A-Za-z]))`, 'g'), 'Cobalt ']);
RULES.push([new RegExp(`(?<![A-Za-z])Dragon (?=(${GEAR})(?![A-Za-z]))`, 'g'), 'Emberite ']);
RULES.push([/(?<![A-Za-z])rune (?=(platebody|platelegs|full helm|longsword|scimitar|pickaxe|bars?|arrows)(?![A-Za-z]))/g, 'cobalt ']);
}
return RULES;
}
const RULES = buildRenameRules(T);

export function migrateRenameText(s) {
  for (const [re, b] of RULES) s = s.replace(re, b);
  return s;
}
