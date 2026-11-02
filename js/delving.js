// Delving: a floor-crawling skill. Enter at the Delver's Descent (Sunscour Dunes) with nothing but your toolbelt.
// Each floor is procedurally assembled (dungeon.js, shared with relic dungeons): gather ore, wood and fish, craft
// arms and armour at the floor forge, cook at the campfire, find coloured keys for locked doors, pass skill gates
// and defeat the floor guardian. XP scales with floor size and difficulty; tokens buy unique rewards.
// Your own gear is stashed on entry and handed back when you leave (or fall).
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { MONSTER_TYPES, LOOT_TABLES } from './gameplay.js';
import { REGION_DATA } from './regiondata.js';
import { terrainHeight } from './world.js';
import { perk } from './skills.js';
import { normalizeDelving } from './delvedata.js';
import { genLayout, buildDungeon, DUNGEON_ORIGIN } from './dungeon.js';
import { GATES, drawGates, gateLevel } from './gates.js';
import { DELVE_GEAR } from './relicgear.js';

export const SIZES = { small: { name: 'Small', rooms: 5, side: 2 }, medium: { name: 'Medium', rooms: 7, side: 3 }, large: { name: 'Large', rooms: 9, side: 4 } };
const KEYS = [['Crimson', 0xc03030], ['Azure', 0x3070d0], ['Gold', 0xd0a020], ['Jade', 0x30a060]];
const THEMES = [{ floor: 0x3a3430, wall: 0x5a524a, accent: 0x7a6aa0, glow: 0x9a80ff }, { floor: 0x2a3036, wall: 0x46505a, accent: 0x5a8ab0, glow: 0x70b0ff }, { floor: 0x362a2a, wall: 0x56403a, accent: 0xa05a4a, glow: 0xff9070 }];
export const tierOf = diff => Math.min(5, Math.ceil(diff / 2));   // floor item tier 1..5
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

// ---- floor-bound items (taken away when you leave) ----
const B = (n, o) => { ITEMS[n] = { value: 0, bound: true, examine: 'Floor-bound: it crumbles when you leave the floor.', ...o }; };
B('Delve ore', {}); B('Delve logs', {}); B('Raw cavefish', {}); B('Cavefish', { type: 'food', heal: 12 }); B('Burnt cavefish', {});
for (const [k] of KEYS) B(`${k} key`, { examine: `Opens the ${k.toLowerCase()} door on this floor.` });
for (let t = 1; t <= 5; t++) {
  const r = ROMAN[t];
  B(`Delve blade ${r}`, { type: 'weapon', atk: 8 + t * 10, str: 6 + t * 10, speed: 4 });
  B(`Delve shortbow ${r}`, { type: 'weapon', ranged: 8 + t * 12, speed: 4 });
  B(`Delve arrows ${r}`, { type: 'ammo', rstr: 4 + t * 6, stack: true });
  B(`Delve plate ${r}`, { type: 'body', def: 8 + t * 12, rdef: 6 + t * 10 });
  B(`Delve greaves ${r}`, { type: 'legs', def: 6 + t * 9, rdef: 5 + t * 8 });
  B(`Delve buckler ${r}`, { type: 'shield', def: 5 + t * 8, rdef: 5 + t * 8 });
}
// recipes at the floor forge: [label, skill, inputs, output, qty]
const RECIPES = t => { const r = ROMAN[t], L = (t - 1) * 18 + 1; return [
  [`Delve blade ${r}`, 'Smithing', L, { 'Delve ore': 3, 'Delve logs': 1 }, 1],
  [`Delve plate ${r}`, 'Smithing', L, { 'Delve ore': 5 }, 1],
  [`Delve greaves ${r}`, 'Smithing', L, { 'Delve ore': 4 }, 1],
  [`Delve buckler ${r}`, 'Crafting', L, { 'Delve logs': 2, 'Delve ore': 1 }, 1],
  [`Delve shortbow ${r}`, 'Fletching', L, { 'Delve logs': 3 }, 1],
  [`Delve arrows ${r}`, 'Fletching', L, { 'Delve logs': 1, 'Delve ore': 1 }, 40]
]; };

Object.assign(MONSTER_TYPES, {
  'Delve fiend':    { name: 'Delve fiend',    level: 30, hp: 300, maxHit: 26, att: 26, def: 24, speed: 4, color: 0x4a3a5a, scale: 1.0, skin: 0x8a7aa0 },
  'Floor guardian': { name: 'Floor guardian', level: 60, hp: 1100, maxHit: 40, att: 42, def: 40, speed: 5, color: 0x3a2a4a, scale: 1.7, skin: 0x7a6a9a }
});
for (const n of ['Delve fiend', 'Floor guardian']) LOOT_TABLES[n] = [{ item: 'Delve ore', chance: 0.4 }];

export function installDelving(ctx) {
  const { scene, nodes, pickables, player, skills, pm, EXT, giveXP, giveItem, countItem, removeItem, log, travelTo, spawnMonster, markDirty, gfx } = ctx;
  player.delving = normalizeDelving(player.delving);
  const P = () => player.delving, lvl = () => skills.Delving.level;
  const say = t => [['npc', t]];
  const unlocked = () => Math.min(10, 1 + Math.floor(lvl() / 10));

  // gear stash
  function stash() {
    P().stash = { inventory: { ...player.inventory }, equipment: { ...player.equipment }, ammoCount: player.ammoCount || 0 };
    for (const k of Object.keys(player.inventory)) delete player.inventory[k];
    for (const k of Object.keys(player.equipment)) player.equipment[k] = null;
    player.ammoCount = 0;
  }
  function unstash() {
    const s = P().stash; if (!s) return;
    for (const k of Object.keys(player.inventory)) delete player.inventory[k];
    for (const k of Object.keys(player.equipment)) player.equipment[k] = null;
    Object.assign(player.inventory, s.inventory); Object.assign(player.equipment, s.equipment); player.ammoCount = s.ammoCount;
    P().stash = null;
  }
  if (P().stash) { unstash(); log('Your stashed gear from an unfinished Delving floor has been returned.', 'game'); }

  // ---- hub ----
  const R = REGION_DATA.find(r => r.delveHub);
  if (R) {
    const hx = R.x + R.delveHub.dx, hz = R.z + R.delveHub.dz, y = terrainHeight(hx, hz);
    const g = new THREE.Group(); g.name = 'delve-hub';
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.5, 10), new THREE.MeshLambertMaterial({ color: 0x8a7a5a })); ring.position.y = 0.25; g.add(ring);
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.52, 10), new THREE.MeshLambertMaterial({ color: 0x120c18, emissive: 0x2a1a4a })); pit.position.y = 0.27; g.add(pit);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), new THREE.MeshLambertMaterial({ color: 0x6a5a40 })); p.position.set(s * 2.6, 1.6, 0); g.add(p); }
    g.position.set(hx, y, hz); scene.add(g); pickables.push(ring);
    const ent = { mesh: ring, alive: true, x: hx, z: hz, radius: 2.8, type: 'hearth', ext: 'delvehub', name: "Delver's Descent", examine: 'A stair into ever-shifting floors. Bring nothing; take what you earn.' };
    ring.userData.entity = ent; nodes.push(ent);
    ctx.hub = { x: hx, z: hz };
  }

  EXT.extTalk.delvehub = { face: '🕳️', talk: () => {
    if (EXT.dungeonRun) return say('You are already below.');
    const opts = [];
    for (const [k, S] of Object.entries(SIZES)) opts.push([`Enter a ${S.name.toLowerCase()} floor (${S.rooms} rooms)`, [{ choose: [...Array(unlocked()).keys()].map(i => [`Difficulty ${i + 1}${i + 1 === unlocked() ? ' (hardest unlocked)' : ''}`, [{ run: () => { enter(k, i + 1); return []; } }]]).reverse().concat([['Back', []]]) }]]);
    opts.push([`Token shop (${P().tokens} tokens)`, [{ run: () => shop() }]]);
    opts.push(['How does this work?', say(`Your pack and worn gear stay up here (your toolbelt comes along). Below, gather ore, logs and cavefish, craft at the floor forge, cook at the campfire, find coloured keys for locked doors, pass skill gates and beat the floor guardian. Bigger, harder floors give more XP and tokens. Difficulty unlocks every 10 Delving levels. Floors cleared: ${P().floors}.`)]);
    opts.push(['Goodbye.', []]);
    return [['npc', "Ysolde Gatekeeper: Down you go, delver?"], { choose: opts }];
  } };
  function shop() {
    const opts = DELVE_GEAR.map(([n, o]) => [`${n} — ${o.tokens} tokens (${Object.entries(o.req).map(([s, l]) => s + ' ' + l).join(', ')})`, [{ run: () => {
      if (P().tokens < o.tokens) return say(`You need ${o.tokens} tokens; you have ${P().tokens}.`);
      P().tokens -= o.tokens; giveItem(n); log(`You buy the ${n}.`, 'loot', '#ffd700'); markDirty(); return say(`The ${n} is yours. ${o.special}.`);
    } }]]);
    opts.push(['Nothing for now.', []]);
    return [{ choose: opts }];
  }

  // ---- floors ----
  const pool = [];
  let run = null;
  const ent = (mesh, x, z, data) => { const e = Object.assign({ mesh, alive: true, x, z, radius: 1.6, type: 'hearth' }, data); mesh.userData.entity = e; pickables.push(mesh); nodes.push(e); run.ents.push(e); return e; };
  function enter(size, diff) {
    if (run || EXT.dungeonRun) return;
    const S = SIZES[size], seed = (Date.now() ^ (diff * 104729)) >>> 0, lay = genLayout(seed, S.rooms, S.side), rng = lay.rng;
    const D = buildDungeon(scene, lay, DUNGEON_ORIGIN.delve, THEMES[diff % THEMES.length], { lite: gfx.quality === 'low' });
    const L = Math.min(110, 8 + diff * 9), t = tierOf(diff);
    run = { size, diff, L, t, D, ents: [], start: Date.now(), bossDead: false, rooms: S.rooms };
    EXT.dungeonRun = { kind: 'delve', end: win => finish(win) };
    if (ctx.hub) player.instanceReturn = { x: ctx.hub.x, z: ctx.hub.z + 4 };
    stash();
    giveItem('Cavefish', 4);
    const rooms = D.rooms, mains = rooms.filter(r => r.main), sides = rooms.filter(r => !r.main), boss = mains[mains.length - 1];
    // start room: forge + campfire
    const s0 = mains[0];
    ent(D.prop(s0.x - 4, s0.z + 3, 1.6, 1, 1, 0x4a4a52, 0xff7030), s0.x - 4, s0.z + 3, { ext: 'delveforge', name: 'Floor forge', examine: 'Smith, fletch and craft with what you find.' });
    ent(D.prop(s0.x + 4, s0.z + 3, 1, 0.5, 1, 0x5a3a20, 0xff9040), s0.x + 4, s0.z + 3, { ext: 'delvefire', name: 'Campfire', examine: 'Cook raw cavefish here.' });
    ent(D.prop(s0.x, s0.z - 6.5, 2, 2.6, 0.4, 0x1a1420), s0.x, s0.z - 6.5, { ext: 'delveexit', name: 'Stair up', examine: 'Leave the floor. Unfinished floors give nothing.' });
    // resources spread over rooms
    const res = [['Ore vein', 'Mining', 'Delve ore', 0x6a6a7a], ['Pale tree', 'Woodcutting', 'Delve logs', 0x6a8a5a], ['Cave pool', 'Fishing', 'Raw cavefish', 0x3a6a9a]];
    rooms.forEach((r, i) => { if (r === boss) return; const [n, sk, item, c] = res[i % 3]; const x = r.x - 5 + (i % 2) * 10, z = r.z - 4;
      ent(D.prop(x, z, 1.4, n === 'Pale tree' ? 3 : 1, 1.4, c), x, z, { ext: 'delvegather', name: n, examine: `${sk}: gives ${item.toLowerCase()}.`, gather: { skill: sk, item, level: Math.max(1, (t - 1) * 15) } }); });
    // keys: each side room holds a key that opens a later main-path door
    const mainDoors = D.doors.filter(d => rooms[d.b].main), used = new Set();
    sides.forEach((r, k) => {
      if (k >= KEYS.length) return;
      const after = r.depth;   // parent depth; the door must come later than the side room's parent
      const di = mainDoors.findIndex((d, i) => i >= after && i < mainDoors.length - 1 && !used.has(i)); if (di < 0) return;
      used.add(di); const [kn, kc] = KEYS[k];
      ent(D.prop(r.x, r.z, 0.5, 0.5, 0.5, kc, kc), r.x, r.z, { ext: 'delvekey', name: `${kn} key`, examine: 'A floor key.', key: kn });
      const d = mainDoors[di], door = D.door(d, kc, `${kn} door`);
      ent(door.mesh, d.x, d.z, { ext: 'delvedoor', name: `${kn} door`, examine: `Needs the ${kn.toLowerCase()} key.`, key: kn, door, radius: 2.2 });
    });
    // skill gates on remaining main doors (every other one), boss link stays open
    const free = mainDoors.map((d, i) => i).filter(i => !used.has(i) && i < mainDoors.length - 1);
    const ease = perk(skills, 'Delving', 'gateEase'), gs = drawGates(skills, {}, free.length, rng);
    free.forEach((i, k) => {
      const d = mainDoors[i], skill = gs[k], G = GATES[skill], need = gateLevel(L, i, ease), door = D.door(d, 0x8a7a9a, G.name);
      ent(door.mesh, d.x, d.z, { ext: 'delvegate', name: `${G.name} (${skill} ${need})`, examine: `${G.act}: needs ${skill} ${need}.`, gate: { skill, need }, door, radius: 2.2 });
    });
    // foes
    mains.forEach((r, k) => { if (k > 0 && r !== boss) for (let j = 0; j < 1 + (k % 2) + (diff > 5 ? 1 : 0); j++) spawn('Delve fiend', r.x - 3 + j * 3, r.z + 2, L, D.roomBounds(r)); });
    sides.forEach(r => spawn('Delve fiend', r.x + 3, r.z + 3, L, D.roomBounds(r)));
    spawn('Floor guardian', boss.x, boss.z, L + 10, D.roomBounds(boss), true);
    run.boss = boss;
    travelTo(s0.x, s0.z - 3);
    log(`Delving floor: ${S.name}, difficulty ${diff}. Your gear waits above. Gather, craft and fight your way to the guardian.`, 'warn');
    markDirty();
  }
  function spawn(type, x, z, L, bounds, boss = false) {
    let m = pool.find(q => q.delvingType === type && !q.alive && !q.dying);
    if (!m) { m = spawnMonster(type, x, z, 2, bounds); m.delvingType = type; pool.push(m); }
    const T = MONSTER_TYPES[type], k = Math.max(0.2, L / T.level);
    Object.assign(m, { name: T.name, title: T.title, level: Math.round(L), hp: Math.round(T.hp * k), maxHp: Math.round(T.hp * k), maxHit: Math.max(3, Math.round(T.maxHit * Math.sqrt(k))), att: Math.max(1, Math.round(T.att * k)), def: Math.max(1, Math.round(T.def * k)),
      alive: true, dying: false, state: 'idle', respawnAt: 0, respawn: 1e12, spawnX: x, spawnZ: z, bounds, stunUntil: 0, venom: null, delving: true, delvingBoss: boss });
    m.mesh.visible = true; m.mesh.rotation.set(0, 0, 0); m.mesh.position.set(x, 0, z);
    return m;
  }
  const opened = e => {
    e.door.open(); e.alive = false; const i = pickables.indexOf(e.mesh); if (i >= 0) pickables.splice(i, 1);
    const h = perk(skills, 'Delving', 'floorHeal'); if (h && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * h));
    giveXP('Delving', 15 + run.L); markDirty();
  };
  // gathering loop
  let work = null;
  EXT.extTick.push(() => {
    if (!work || !run) { work = null; return; }
    const e = work.e, p = pm.mesh.position;
    if (Math.hypot(p.x - e.x, p.z - e.z) > 3 || player.hp <= 0) { work = null; return; }
    if (ctx.tick() < work.next) return; work.next = ctx.tick() + 3;
    pm.actionAnim = 1; pm.actionKind = 'tool';
    const G = e.gather;
    if (Math.random() < 0.55 + skills[G.skill].level * 0.004) {
      const n = Math.random() < perk(skills, 'Delving', 'double') ? 2 : 1;
      giveItem(G.item, n); giveXP(G.skill, 10 + run.L * 0.6); giveXP('Delving', 4 + run.diff); markDirty();
    }
  });
  EXT.extTalk.delvegather = { face: '⛏️', talk: e => {
    const G = e.gather; if (skills[G.skill].level < G.level) return say(`You need ${G.skill} ${G.level}.`);
    return [{ run: () => { ctx.stopAction(); work = { e, next: ctx.tick() + 2 }; log(`You start gathering ${G.item.toLowerCase()}. Move away to stop.`, 'game'); return []; } }];
  } };
  EXT.extTalk.delveforge = { face: '🔨', talk: () => {
    const opts = [];
    for (let t = 1; t <= run.t; t++) for (const [name, sk, L, inp, q] of RECIPES(t)) opts.push([`${name} (${sk} ${L}; ${Object.entries(inp).map(([i, n]) => n + ' ' + i.replace('Delve ', '')).join(', ')})`, [{ run: () => {
      if (skills[sk].level < L) return say(`You need ${sk} ${L}.`);
      if (Object.entries(inp).some(([i, n]) => countItem(i) < n)) return say('You lack the materials.');
      for (const [i, n] of Object.entries(inp)) removeItem(player, i, n);
      giveItem(name, q); giveXP(sk, 20 + L * 3); giveXP('Delving', 5 + run.diff); markDirty(); return say(`You make ${q > 1 ? q + ' ' : 'a '}${name}.`);
    } }]]);
    opts.push(['Done.', []]); return [{ choose: opts }];
  } };
  EXT.extTalk.delvefire = { face: '🔥', talk: () => {
    const n = countItem('Raw cavefish'); if (!n) return say('You have no raw cavefish.');
    return [{ run: () => { let ok = 0; for (let i = 0; i < n; i++) { removeItem(player, 'Raw cavefish', 1); if (Math.random() < 0.6 + skills.Cooking.level * 0.005) { giveItem('Cavefish'); ok++; } } giveXP('Cooking', ok * (20 + run.L)); markDirty(); return say(`You cook ${ok} of ${n} cavefish.`); } }];
  } };
  EXT.extTalk.delvekey = { face: '🗝️', talk: e => [{ run: () => { giveItem(`${e.key} key`); e.alive = false; e.mesh.visible = false; const i = pickables.indexOf(e.mesh); if (i >= 0) pickables.splice(i, 1); markDirty(); return say(`You take the ${e.key.toLowerCase()} key.`); } }] };
  EXT.extTalk.delvedoor = { face: '🚪', talk: e => {
    if (!countItem(`${e.key} key`)) return say(`Locked. It needs the ${e.key.toLowerCase()} key.`);
    return [{ run: () => { removeItem(player, `${e.key} key`, 1); opened(e); return say(`The ${e.key.toLowerCase()} door swings open.`); } }];
  } };
  EXT.extTalk.delvegate = { face: '🔒', talk: e => {
    const g = e.gate, G = GATES[g.skill];
    return [['npc', `${G.name}. ${G.act}: needs ${g.skill} ${g.need} (you have ${skills[g.skill].level}).`], { choose: [[G.act, [{ run: () => tryGate(e) }]], ['Leave it.', []]] }];
  } };
  function tryGate(e) {
    const g = e.gate, G = GATES[g.skill];
    if (skills[g.skill].level < g.need) return say(`You need ${g.skill} ${g.need}.`);
    if (G.kind === 'hp') { const c = Math.round(player.maxHp * 0.1); if (player.hp <= c + 1) return say('Too weak.'); player.hp -= c; }
    if (G.kind === 'fight') giveXP('Attack', 20 + g.need * 5); else giveXP(g.skill, 20 + g.need * 5);
    opened(e); log(G.done, 'game'); return [];
  }
  EXT.extKill.push(mon => {
    if (!run || !mon.delving) return;
    if (!mon.delvingBoss) { giveXP('Delving', 6 + run.diff * 2); return; }
    run.bossDead = true;
    const xp = Math.round(40 * run.rooms * (1 + run.diff * 0.6) + run.L * 8);
    const tokens = Math.round(run.rooms * run.diff * 12 * (1 + perk(skills, 'Delving', 'tokenBonus')));
    giveXP('Delving', xp); P().tokens += tokens; P().floors++; P().deepest = Math.max(P().deepest, run.diff);
    const secs = Math.round((Date.now() - run.start) / 1000); if (!P().best || secs < P().best) P().best = secs;
    log(`Floor cleared! +${xp} Delving XP and ${tokens} tokens (${P().tokens} total). Take the stair up when ready.`, 'loot', '#ffd700');
    if (Math.random() < 0.015 + run.diff * 0.004) { const g = DELVE_GEAR[Math.floor(Math.random() * DELVE_GEAR.length)][0]; run.reward = g; log(`The guardian drops the ${g}! It waits for you above.`, 'loot', '#ff8c00'); }
    markDirty();
  });
  EXT.extTalk.delveexit = { face: '🪜', talk: () => [{ choose: [[run && run.bossDead ? 'Climb out (floor complete)' : 'Abandon the floor', [{ run: () => { finish(run && run.bossDead); return []; } }]], ['Stay', []]] }] };
  function finish(win) {
    if (!run) return; const r = run; run = null; EXT.dungeonRun = null; work = null;
    for (const e of r.ents) { e.alive = false; const i = nodes.indexOf(e); if (i >= 0) nodes.splice(i, 1); const j = pickables.indexOf(e.mesh); if (j >= 0) pickables.splice(j, 1); }
    for (const m of pool) { m.alive = false; m.dying = false; m.state = 'dead'; m.respawnAt = 0; m.delving = false; m.mesh.visible = false; }
    ctx.stopAction(); r.D.dispose(); unstash();
    for (const k of Object.keys(player.bank || {})) if (ITEMS[k] && ITEMS[k].bound) delete player.bank[k];   // a full pack sends finds to the bank
    if (r.reward) giveItem(r.reward);
    player.instanceReturn = null;
    if (ctx.hub) travelTo(ctx.hub.x, ctx.hub.z + 4);
    if (!win) log('You leave the floor. Floor-bound items crumble away.', 'warn');
    markDirty();
  }
  EXT.extDeath.push(() => { if (run) finish(false); });
  EXT.extFrame.push(() => { if (run) run.D.follow(pm.mesh.position.x, pm.mesh.position.z); });
  EXT.delving = { enter, finish, tryGate, get run() { return run; }, shop };
  return EXT.delving;
}
