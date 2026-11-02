// Seasonal events of Aerondel. Every season runs a season-long festival, and short specials overlap a few weeks
// each year. Festival Herald Odelyn in Larkhaven square runs them: a daily task, a token shop that only opens while
// its event runs (tokens keep), and token-for-XP blessings. Kills drop the active event's tokens.
// Decorations are a handful of simple meshes around the square (fewer on Low, emissive only, no extra lights).
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { terrainHeight } from './world.js';
import { currentSeason } from './seasons.js';

// [month, day] windows (inclusive, months 1-12); a window may wrap the new year.
export const EVENTS = [
  { id: 'bloomtide', name: 'Bloomtide', icon: '🌸', season: 'spring', token: 'Bloom petal', deco: 'flowers', colors: [0xff9ad0, 0xfff07a, 0xb08aff],
    blurb: 'Larkhaven strews the square with blossoms to wake the fields.', shop: [['Bloomcrown', 'head', { def: 4, rdef: 4, mag: 2 }, 60], ['Honeyed bun', 'food', { heal: 22 }, 4]] },
  { id: 'midsummer', name: 'Midsummer Fair', icon: '🎪', season: 'summer', token: 'Fair ticket', deco: 'bunting', colors: [0xe04a3a, 0xf0c040, 0x3a7ae0],
    blurb: 'Stalls, games and the long light of the year\'s longest days.', shop: [['Fairgoer\'s straw hat', 'head', { def: 3, rdef: 3, ranged: 2 }, 60], ['Candied apple', 'food', { heal: 22 }, 4]] },
  { id: 'harvest', name: 'Harvest Moon', icon: '🌾', season: 'autumn', token: 'Harvest sheaf', deco: 'pumpkins', colors: [0xe07a20, 0xc0902a, 0x8a3a1a],
    blurb: 'The fields are in. Aerondel gives thanks under a fat orange moon.', shop: [['Sheaf-crown', 'head', { def: 4, rdef: 4, str: 2 }, 60], ['Harvest pie', 'food', { heal: 26 }, 5]] },
  { id: 'frostfall', name: 'Frostfall', icon: '❄️', season: 'winter', token: 'Frost star', deco: 'snowmen', colors: [0xf4f8ff, 0x8ac8ff, 0xd04040],
    blurb: 'Snow, lanterns and the longest night; gifts are left on every doorstep.', shop: [['Frostfall toque', 'head', { def: 4, rdef: 5, atk: 2 }, 60], ['Spiced cider', 'food', { heal: 24 }, 4]] },
  { id: 'lantern', name: 'Lantern Night', icon: '🏮', special: true, from: [10, 24], to: [11, 7], token: 'Ghost lantern', deco: 'lanterns', colors: [0xffa040, 0x9a60ff, 0x60ffb0],
    blurb: 'For two weeks the dead walk lightly; lanterns guide them home. Kills drop twice as many tokens.', shop: [['Hollow-eyed mask', 'head', { def: 5, rdef: 5, mag: 3 }, 90], ['Grave-cake', 'food', { heal: 30 }, 6]] },
  { id: 'founders', name: "Founders' Week", icon: '🏰', special: true, from: [6, 1], to: [6, 10], token: 'Founder\'s seal', deco: 'bunting', colors: [0xd4af37, 0x2a4aa0, 0xffffff],
    blurb: 'Aerondel remembers the first walls of Larkhaven.', shop: [['Founder\'s circlet', 'head', { def: 5, rdef: 5, atk: 2, str: 2 }, 120]] }
];
export const eventById = id => EVENTS.find(e => e.id === id);
const inWindow = (d, from, to) => { const v = (d.getMonth() + 1) * 100 + d.getDate(), a = from[0] * 100 + from[1], b = to[0] * 100 + to[1]; return a <= b ? v >= a && v <= b : v >= a || v <= b; };
// Active events for a date: the current season's festival plus any special whose window contains the date.
export function activeEvents(player, d = new Date()) {
  const s = currentSeason(player, d);
  return EVENTS.filter(e => e.special ? inWindow(d, e.from, e.to) : e.season === s);
}
for (const E of EVENTS) {
  if (!ITEMS[E.token]) ITEMS[E.token] = { value: 1, stack: true, examine: `${E.name} token. Spend it with Festival Herald Odelyn in Larkhaven.` };
  for (const [n, type, st, cost] of E.shop) if (!ITEMS[n]) ITEMS[n] = type === 'food' ? { type: 'food', heal: st.heal, value: cost * 10, examine: `${E.name} treat.` }
    : { type, ...st, value: cost * 100, cosmetic: E.id, examine: `Worn at ${E.name}. Bought with ${E.token.toLowerCase()}s.` };
}
export function normalizeEvents(e) {
  const o = e && typeof e === 'object' ? e : {};
  const daily = o.daily && typeof o.daily === 'object' ? o.daily : null;
  return { daily: daily && typeof daily.day === 'string' ? { day: daily.day, kind: String(daily.kind || 'kill'), skill: daily.skill || null, n: Math.max(1, daily.n | 0), base: Number(daily.base) || 0, c: Math.max(0, daily.c | 0), done: !!daily.done } : null,
    seen: Array.isArray(o.seen) ? o.seen.filter(x => typeof x === 'string').slice(-20) : [], total: Math.max(0, o.total | 0) };
}
const DAILY_SKILLS = ['Woodcutting', 'Mining', 'Fishing', 'Cooking', 'Smithing', 'Crafting', 'Fletching', 'Herbalism', 'Agility', 'Thieving'];

export function installEvents(ctx) {
  const { scene, nodes, player, skills, EXT, giveXP, giveItem, countItem, removeItem, log, markDirty, gfx } = ctx;
  player.events = normalizeEvents(player.events);
  const P = () => player.events;
  const say = (t, more = []) => [['npc', t], ...more];
  const today = () => new Date().toLocaleDateString('en-CA');
  const lowestSkill = () => Object.keys(skills).filter(k => k !== 'Hitpoints').sort((a, b) => skills[a].xp - skills[b].xp)[0];

  // announce new events once
  const act = () => activeEvents(player);
  for (const E of act()) if (!P().seen.includes(E.id + new Date().getFullYear())) { P().seen.push(E.id + new Date().getFullYear()); log(`${E.icon} ${E.name} has begun! ${E.blurb} Visit Festival Herald Odelyn in Larkhaven square.`, 'skill'); }

  function daily() {
    const d = P().daily;
    if (d && d.day === today()) return d;
    const r = Math.random();
    P().daily = r < 0.5 ? { day: today(), kind: 'kill', n: 12, c: 0, done: false }
      : (s => ({ day: today(), kind: 'xp', skill: s, n: 1500 + skills[s].level * 40, base: skills[s].xp, c: 0, done: false }))(DAILY_SKILLS[Math.floor(Math.random() * DAILY_SKILLS.length)]);
    markDirty(); return P().daily;
  }
  const progress = d => d.kind === 'xp' ? Math.max(0, Math.floor(skills[d.skill].xp - d.base)) : d.c;
  const taskText = d => d.kind === 'xp' ? `Earn ${d.n.toLocaleString()} ${d.skill} XP (${Math.min(progress(d), d.n).toLocaleString()}/${d.n.toLocaleString()})` : `Defeat ${d.n} monsters (${Math.min(d.c, d.n)}/${d.n})`;

  EXT.extKill.push(mon => {
    const L = act(); if (!L.length) return;
    const d = P().daily; if (d && d.day === today() && d.kind === 'kill' && !d.done) d.c++;
    for (const E of L) if (Math.random() < (E.special ? 0.3 : 0.15)) { giveItem(E.token, E.special ? 2 : 1); log(`You find ${E.special ? 'two ' + E.token.toLowerCase() + 's' : 'a ' + E.token.toLowerCase()}.`, 'loot'); }
  });

  EXT.extTalk.festival = { face: '🎪', talk: () => {
    const L = act(), opts = [];
    if (!L.length) return say('No festival right now. Come back when the season turns!');
    const d = daily();
    if (!d.done) opts.push([progress(d) >= d.n ? 'I finished the festival task.' : `Today's task: ${taskText(d)}`, [{ run: () => {
      if (progress(d) < d.n) return say(`Not yet: ${taskText(d)}.`);
      d.done = true; P().total++;
      for (const E of L) giveItem(E.token, E.special ? 15 : 10);
      const s = lowestSkill(); giveXP(s, 400 + skills[s].level * 30); markDirty();
      return say(`Splendid! Tokens for every festival running, and a blessing on your ${s}. New task tomorrow.`);
    } }]]);
    else opts.push(['Today\'s task is done.', say('A new one tomorrow, friend.')]);
    for (const E of L) opts.push([`${E.icon} ${E.name} stall (${countItem(E.token)} ${E.token.toLowerCase()}s)`, [{ choose: [
      ...E.shop.map(([n, type, st, cost]) => [`${n} — ${cost} ${E.token.toLowerCase()}s${type === 'food' ? '' : ` (${Object.entries(st).map(([k, v]) => `+${v} ${k}`).join(', ')})`}`, [{ run: () => {
        if (countItem(E.token) < cost) return say(`That's ${cost} ${E.token.toLowerCase()}s; you have ${countItem(E.token)}.`);
        removeItem(player, E.token, cost); giveItem(n); markDirty(); return say(`The ${n}, yours to keep!`); } }]]),
      [`Blessing: 25 ${E.token.toLowerCase()}s for XP in your weakest skill`, [{ run: () => {
        if (countItem(E.token) < 25) return say('You need 25 for a blessing.');
        const s = lowestSkill(); removeItem(player, E.token, 25); const xp = 1000 + skills[s].level * 60; giveXP(s, xp); markDirty(); return say(`${s} blessed (+${xp} XP).`); } }]],
      ['Back.', []]] }]]);
    opts.push(['What\'s on?', say(L.map(E => `${E.icon} ${E.name}: ${E.blurb}`).join(' '))]);
    opts.push(['Goodbye.', []]);
    return [['npc', `Festival Herald Odelyn: Welcome to ${L.map(E => E.name).join(' and ')}!`], { choose: opts }];
  } };
  const herald = nodes.find(n => n.npc === 'herald'); if (herald) herald.ext = 'festival';

  // ---- decorations around Larkhaven square ----
  const deco = new THREE.Group(); deco.name = 'festival-deco'; scene.add(deco);
  const mats = {}; const M = (c, e = 0) => mats[c + ':' + e] || (mats[c + ':' + e] = new THREE.MeshLambertMaterial({ color: c, emissive: e ? c : 0, emissiveIntensity: e }));
  function piece(E, i, x, z) {
    const g = new THREE.Group(), c = E.colors[i % E.colors.length], y = terrainHeight(x, z);
    if (E.deco === 'pumpkins') { const p = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 7), M(c)); p.scale.y = 0.75; p.position.y = 0.32; g.add(p); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.2, 5), M(0x3a5a1a)); s.position.y = 0.72; g.add(s); }
    else if (E.deco === 'snowmen') { for (const [r, h] of [[0.5, 0.45], [0.36, 1.1], [0.25, 1.6]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M(0xf4f8ff)); b.position.y = h; g.add(b); } const n = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 5), M(0xff8a2a)); n.rotation.x = Math.PI / 2; n.position.set(0, 1.6, 0.3); g.add(n); }
    else if (E.deco === 'flowers') { for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), M(E.colors[(i + k) % 3])); f.position.set(Math.cos(k * 1.3) * 0.4, 0.3, Math.sin(k * 1.3) * 0.4); g.add(f); } const b = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.2, 8), M(0x5a3a22)); b.position.y = 0.1; g.add(b); }
    else { // lanterns and bunting poles
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 5), M(0x4a3626)); pole.position.y = 1.3; g.add(pole);
      const l = new THREE.Mesh(E.deco === 'lanterns' ? new THREE.SphereGeometry(0.24, 8, 6) : new THREE.ConeGeometry(0.3, 0.5, 3), M(c, E.deco === 'lanterns' ? 0.9 : 0)); l.position.y = 2.7; if (E.deco !== 'lanterns') l.rotation.x = Math.PI; g.add(l);
    }
    g.position.set(x, y, z); g.rotation.y = i * 1.7; deco.add(g);
  }
  let built = null;
  function build() {
    const key = act().map(e => e.id).join(',') + '|' + (gfx.quality === 'low');
    if (key === built) return; built = key;
    for (const c of [...deco.children]) { deco.remove(c); c.traverse(o => o.geometry && o.geometry.dispose()); }
    const L = act(), n = gfx.quality === 'low' ? 6 : 14;
    L.forEach((E, k) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + k * 0.22, r = 8.2 + k * 1.1; piece(E, i, Math.cos(a) * r, Math.sin(a) * r); } });
  }
  build();
  let acc = 0; EXT.extFrame.push(dt => { acc += dt; if (acc > 10) { acc = 0; build(); } });
  EXT.events = { active: () => act().map(e => e.id), daily, progress, deco };
}
