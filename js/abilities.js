// Combat skills on the quick bar. Unlocked by combat levels; cooldowns are in game ticks (0.6s).
import { perk } from './skills.js';

export const ABILITIES = [
  { id: 'power', tier: 'basic',    name: 'Power Strike',  icon: '💥', skill: 'Strength', level: 5,  cd: 17, style: 'melee', desc: 'Your next hit deals +60% damage and is more accurate.' },
  { id: 'fortify', tier: 'threshold',  name: 'Fortify',       icon: '🛡️', skill: 'Defence',  level: 5,  cd: 50, style: 'any',   desc: 'Take 50% less damage for 6 seconds.' },
  { id: 'puncture', tier: 'basic', name: 'Puncture',      icon: '🗡️', skill: 'Attack',   level: 10, cd: 25, style: 'melee', desc: 'Strike twice at once.' },
  { id: 'volley', tier: 'basic',   name: 'Rapid Volley',  icon: '🏹', skill: 'Ranged',   level: 10, cd: 30, style: 'ranged', desc: 'Fire three arrows at once (uses 3 arrows).' },
  { id: 'bash', tier: 'basic',     name: 'Shield Bash',   icon: '🔰', skill: 'Defence',  level: 20, cd: 34, style: 'melee', desc: 'A light hit that stuns your target for 3 seconds.' },
  { id: 'rage', tier: 'ultimate',     name: 'Berserk',       icon: '😡', skill: 'Strength', level: 30, cd: 84, style: 'any',   desc: '+20% accuracy and damage for 9 seconds, but you take 10% more damage.' },
  { id: 'snipe', tier: 'threshold',    name: 'Snipe',         icon: '🎯', skill: 'Ranged',   level: 30, cd: 40, style: 'ranged', desc: 'One carefully aimed shot with double max hit.' },
  // Magic kit: cast while attacking with a spell. Each uses extra runes.
  { id: 'windb', tier: 'basic',    name: 'Wind Lance',  icon: '💨', skill: 'Magic', level: 5,  cd: 15, style: 'magic', element: 'wind',  runes: { 'Air rune': 4 }, desc: 'A second wind burst on top of your spell. Uses 4 Air runes.' },
  { id: 'waterb', tier: 'basic',   name: 'Water Lance', icon: '💧', skill: 'Magic', level: 15, cd: 20, style: 'magic', element: 'water', runes: { 'Water rune': 3, 'Havoc rune': 1 }, desc: 'A heavy water lance. Uses 3 Water and 1 Havoc rune.' },
  { id: 'earthb', tier: 'basic',   name: 'Earth Lance', icon: '🪨', skill: 'Magic', level: 25, cd: 25, style: 'magic', element: 'earth', runes: { 'Earth rune': 3, 'Havoc rune': 1 }, desc: 'A crushing earth lance that slows the target. Uses 3 Earth and 1 Havoc rune.' },
  { id: 'fireb', tier: 'basic',    name: 'Fire Lance',  icon: '🔥', skill: 'Magic', level: 35, cd: 30, style: 'magic', element: 'fire',  runes: { 'Fire rune': 4, 'Havoc rune': 1 }, desc: 'A searing fire lance that burns. Uses 4 Fire and 1 Havoc rune.' },
  { id: 'surge', tier: 'threshold', name: 'Surge',     icon: '⚡', skill: 'Magic', level: 30, cd: 45, style: 'magic', runes: { 'Havoc rune': 3 }, desc: 'Your next 3 casts deal +50% damage. Uses 3 Havoc runes.' },
  { id: 'storm', tier: 'ultimate', name: 'Storm',      icon: '⛈️', skill: 'Magic', level: 50, cd: 90, style: 'magic', runes: { 'Air rune': 8, 'Grave rune': 2 }, desc: 'Lightning strikes your target and every foe near it. Uses 8 Air and 2 Death runes.' },
  // Combat Paths (combat level 30): two skills per Path, only on your bar while that Path is chosen.
  { id: 'challenge', tier: 'basic', name: 'Challenge', icon: '📣', skill: 'Defence', level: 1, path: 'bulwark', cd: 20, style: 'any', desc: 'Bulwark: a shield-shove hit that delays your target\'s next attacks.' },
  { id: 'wall', tier: 'threshold', name: 'Stalwart Wall', icon: '🧱', skill: 'Defence', level: 1, path: 'bulwark', cd: 60, style: 'any', desc: 'Bulwark: take 60% less damage for 4 seconds.' },
  { id: 'mend', tier: 'basic', name: 'Mending Light', icon: '💚', skill: 'Prayer', level: 1, path: 'mender', cd: 25, style: 'any', desc: 'Mender: heal 12% of your hitpoints.' },
  { id: 'ward', tier: 'threshold', name: 'Warding Hymn', icon: '🎶', skill: 'Prayer', level: 1, path: 'mender', cd: 60, style: 'any', desc: 'Mender: take 40% less damage and heal a little each tick for 6 seconds.' },
  { id: 'rend', tier: 'basic', name: 'Rending Blow', icon: '🩸', skill: 'Strength', level: 1, path: 'striker', cd: 20, style: 'any', desc: 'Striker: a heavy hit with +90% damage.' },
  { id: 'flurry', tier: 'threshold', name: 'Flurry', icon: '🌪️', skill: 'Attack', level: 1, path: 'striker', cd: 45, style: 'any', desc: 'Striker: three fast hits at -15% damage each.' },
  // v22 high-level techniques (Arsenal). Each gets stronger with its matching weapon class.
  { id: 'iaido', tier: 'threshold', name: 'Iaido Draw', icon: '🗡️', skill: 'Attack', level: 110, cd: 40, style: 'melee', desc: 'A lightning draw: +150% damage and much more accurate (+250% with a katana).' },
  { id: 'crescent', tier: 'basic', name: 'Crescent Cut', icon: '🌙', skill: 'Strength', level: 150, cd: 22, style: 'melee', desc: 'Two arcing cuts at +20% damage (three with a scimitar).' },
  { id: 'whirl', tier: 'threshold', name: 'Reaping Whirl', icon: '🌀', skill: 'Attack', level: 200, cd: 45, style: 'melee', desc: 'Four spinning cuts at -10% damage (five with a glaive).' },
  { id: 'gale', tier: 'basic', name: 'Gale Fan', icon: '🪭', skill: 'Defence', level: 250, cd: 30, style: 'melee', desc: 'A buffeting strike that stuns for 3 seconds (almost 5 with a war fan).' },
  { id: 'ricochet', tier: 'basic', name: 'Ricochet', icon: '💿', skill: 'Attack', level: 300, cd: 28, style: 'melee', desc: 'Three rebounding hits, each harder than the last (harder with a chakram).' },
  { id: 'starfall', tier: 'threshold', name: 'Starfall Volley', icon: '🌠', skill: 'Ranged', level: 400, cd: 50, style: 'ranged', desc: 'Four shots at +30% damage.' },
  { id: 'eclipse', tier: 'ultimate', name: 'Eclipse Severance', icon: '🌑', skill: 'Strength', level: 500, cd: 120, style: 'melee', desc: 'One cut at +400% damage; +900% against foes under 15% HP.' },
  { id: 'thousand', tier: 'ultimate', name: 'Thousand Cuts', icon: '✴️', skill: 'Swordsmanship', level: 750, cd: 110, style: 'melee', desc: 'Six blinding cuts at +10% damage and accuracy.' },
  { id: 'frostspire', tier: 'basic', name: 'Frost Spire', icon: '🧊', skill: 'Magic', level: 150, cd: 24, style: 'magic', scale: true, runes: { 'Water rune': 6, 'Havoc rune': 2 }, desc: 'A spear of ice that freezes the target for 2 seconds. Grows with Magic level. Uses 6 Water and 2 Havoc runes.' },
  { id: 'leyrend', tier: 'threshold', name: 'Ley Rend', icon: '🌌', skill: 'Magic', level: 350, cd: 45, style: 'magic', scale: true, runes: { 'Havoc rune': 5 }, desc: 'Tears the leylines through your target and weakens it. Grows with Magic level. Uses 5 Havoc runes.' },
  { id: 'astralnova', tier: 'ultimate', name: 'Astral Nova', icon: '🌟', skill: 'Magic', level: 600, cd: 100, style: 'magic', scale: true, runes: { 'Air rune': 10, 'Grave rune': 4 }, desc: 'A starburst on your target that also hits every foe within 6 m. Grows with Magic level. Uses 10 Air and 4 Grave runes.' },
  { id: 'voidcollapse', tier: 'ultimate', name: 'Void Collapse', icon: '🕳️', skill: 'Magic', level: 900, cd: 120, style: 'magic', scale: true, runes: { 'Grave rune': 6, 'Havoc rune': 6 }, desc: 'Crushes the target in a collapsing void; double damage under 25% HP. Uses 6 Grave and 6 Havoc runes.' },
  { id: 'rejuv', tier: 'ultimate',    name: 'Rejuvenate',    icon: '✨', skill: 'Defence',  level: 40, cd: 100, style: 'any',  desc: 'Heal 20% of your hitpoints.' }
];

// Adrenaline (RS3-style): basics build it, thresholds cost 50, ultimates cost 100.
export const ADREN = { basic: { gain: 9, cost: 0 }, threshold: { gain: 0, cost: 50 }, ultimate: { gain: 0, cost: 100 } };
export function adrenCost(a) { return ADREN[a.tier || 'basic'].cost; }
export function adrenGain(a) { return ADREN[a.tier || 'basic'].gain; }
export function abilityById(id) { return ABILITIES.find(a => a.id === id); }
// Path skills need the matching Combat Path (set by main.js through setPathSource).
let pathOf = () => null;
export function setPathSource(f) { pathOf = f; }
export function unlocked(skills, a) { return a.path ? pathOf() === a.path : skills[a.skill].level >= a.level; }
export function cooldownTicks(skills, a) {
  return Math.max(0, Math.round(a.cd * (1 - perk(skills, 'Attack', 'abilityCd'))));
}
