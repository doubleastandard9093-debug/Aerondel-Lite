// Relicry: excavate dig sites in the climate regions, restore damaged artifacts, turn in collections,
// and use a restored artifact on a site's vault door to open an instanced relic dungeon.
// Relic dungeons: procedurally assembled rooms (dungeon.js), skill gates covering every skill (gates.js),
// scaled sentinels, a boss and a loot chest. Leaving returns you to the dig site.
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { MONSTER_TYPES, LOOT_TABLES, bestTool } from './gameplay.js';
import { REGION_DATA } from './regiondata.js';
import { terrainHeight } from './world.js';
import { inInstance, instanceAt } from './instances.js';
import { perk } from './skills.js';
import { SITES, REFORGE, artXp, digXp, collXp, normalizeRelicry } from './relicdata.js';
import { genLayout, buildDungeon, DUNGEON_ORIGIN } from './dungeon.js';
import { GATES, drawGates, gateLevel } from './gates.js';
import { RELIC_GEAR } from './relicgear.js';

// ---- items ----
const def = (n, o) => { if (!ITEMS[n]) ITEMS[n] = { value: 1, ...o }; };
for (const [site, S] of Object.entries(SITES)) {
  def(S.mat, { value: 20 + S.arts[0][1], examine: `Restoration material from the ${site}.` });
  for (const [a, lvl] of S.arts) {
    def(`Damaged ${a.charAt(0).toLowerCase() + a.slice(1)}`, { value: 30 + lvl * 4, artifact: a, damaged: true, examine: `A damaged artifact from the ${site}. Restore it at the site's bench.` });
    def(a, { value: 200 + lvl * 25, artifact: a, site, examine: `A restored artifact from the ${site}. Part of a collection.` });
  }
}
def('Relic key', { value: 1500, examine: 'Opens any one gate inside a relic dungeon.' });
const dmgName = a => `Damaged ${a.charAt(0).toLowerCase() + a.slice(1)}`;

// ---- monsters ----
Object.assign(MONSTER_TYPES, {
  'Relic sentinel': { name: 'Relic sentinel', level: 40, hp: 400, maxHit: 30, att: 30, def: 30, speed: 4, color: 0x8a7a5a, scale: 1.05, skin: 0xa89a7a },
  'Vault warden':   { name: 'Vault warden',   level: 50, hp: 500, maxHit: 34, att: 34, def: 34, speed: 4, color: 0x6a5a3a, scale: 1.15, skin: 0xb8a070 },
  'Relic colossus': { name: 'Relic colossus', level: 80, hp: 1500, maxHit: 50, att: 50, def: 50, speed: 5, color: 0x5a5048, scale: 1.8, skin: 0x9a8a70 }
});
for (const n of ['Relic sentinel', 'Vault warden', 'Relic colossus']) LOOT_TABLES[n] = [{ item: 'Relic shard', chance: 0.5, qty: [1, 3] }];

// stats for a monster of type at dungeon level L
const scaled = (type, L, boss) => {
  const T = MONSTER_TYPES[type], k = Math.max(0.25, L / T.level);
  return { name: T.name, title: T.title, level: Math.round(boss ? L + 15 : L), hp: Math.round(T.hp * k * (boss ? 1.4 : 1)), maxHit: Math.max(4, Math.round(T.maxHit * Math.sqrt(k))),
    att: Math.max(1, Math.round(T.att * k)), def: Math.max(1, Math.round(T.def * k)) };
};

export function installRelicry(ctx) {
  const { scene, nodes, pickables, player, skills, pm, EXT, giveXP, giveItem, countItem, removeItem, log, travelTo, spawnMonster, markDirty, gfx } = ctx;
  player.relicry = normalizeRelicry(player.relicry);
  const P = () => player.relicry;
  const lvl = () => skills.Relicry.level;
  const shared = new Map();
  const mat = c => { if (!shared.has(c)) shared.set(c, new THREE.MeshLambertMaterial({ color: c })); return shared.get(c); };
  const addNode = (x, z, mesh, data) => {
    mesh.position.x = x; mesh.position.z = z; mesh.position.y += data.y || 0; scene.add(mesh); pickables.push(mesh);
    const ent = Object.assign({ mesh, alive: true, x, z, radius: 1.4, type: 'hearth' }, data); mesh.userData.entity = ent; nodes.push(ent); return ent;
  };
  const say = (t, more = []) => [['npc', t], ...more];

  // ---- dig sites ----
  const sites = [];
  for (const R of REGION_DATA) {
    if (!R.dig || !SITES[R.dig.name]) continue;
    const S = SITES[R.dig.name], cx = R.x + R.dig.dx, cz = R.z + R.dig.dz, y = terrainHeight(cx, cz);
    const site = { name: R.dig.name, level: R.dig.level, x: cx, z: cz, S, region: R.name };
    sites.push(site);
    for (const [i, [ox, oz]] of [[-4, -2], [0, 3.5], [4, -1.5]].entries()) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 7), mat(S.theme.floor)); m.position.y = 0.4; m.name = 'dig-mound';
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), mat(0x8a6a3a)); pole.position.set(0.9, 0.3, 0.6); m.add(pole);
      addNode(cx + ox, cz + oz, m, { y, ext: 'relicdig', name: `${site.name} excavation`, examine: `Excavation trench. Relicry ${site.level}+.`, site, idx: i });
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1), mat(0x7a5a3a)); bench.position.y = 0.45;
    addNode(cx + 5, cz + 5, bench, { y, ext: 'relicbench', name: `${site.name} restoration bench`, examine: 'Restore artifacts, turn in collections and reforge relic arms.', site });
    const arch = new THREE.Group(); arch.name = 'relic-vault';
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 0.6), mat(S.theme.wall)); p.position.set(s * 1.3, 1.5, 0); arch.add(p); }
    const lint = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.7), mat(S.theme.wall)); lint.position.y = 3.1; arch.add(lint);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2, 2.8, 0.3), mat(S.theme.accent)); door.position.y = 1.4; arch.add(door);
    addNode(cx - 5, cz + 5, arch, { y, ext: 'relicvault', name: `${site.name} vault`, examine: 'A sealed vault. A restored artifact from this site would open it.', site, radius: 1.8 });
  }

  // ---- excavation loop ----
  let dig = null;   // { ent, next }
  EXT.extTick.push(() => {
    if (!dig) return;
    const e = dig.ent, p = pm.mesh.position;
    if (Math.hypot(p.x - e.x, p.z - e.z) > 3.2 || player.hp <= 0) { dig = null; return; }
    if (ctx.tick() < dig.next) return;
    const fast = Math.random() < perk(skills, 'Relicry', 'fastGather');
    dig.next = ctx.tick() + (fast ? 2 : 3);
    pm.actionAnim = 1; pm.actionKind = 'tool';
    const s = e.site, tool = ITEMS[dig.tool], t = tool ? tool.toolTier || 0 : 0;
    const chance = Math.min(0.9, 0.3 + (lvl() - s.level) * 0.01 + t * 0.05);
    if (Math.random() > chance) return;
    giveXP('Relicry', digXp(s.level));
    const dbl = Math.random() < perk(skills, 'Relicry', 'double') ? 2 : 1, r = Math.random();
    if (Math.random() < perk(skills, 'Relicry', 'rareFind')) { giveItem('Ancient fragment'); log('Lost Hoards: an Ancient fragment!', 'loot', '#ffd700'); }
    if (r < 0.16) {
      const can = s.S.arts.filter(([, l]) => l <= lvl());
      const [a] = can[Math.floor(Math.random() * can.length)]; giveItem(dmgName(a)); log(`You unearth a ${dmgName(a).toLowerCase()}!`, 'loot', '#ffd700');
    } else if (r < 0.5) { giveItem(s.S.mat, dbl); log(`You find ${dbl > 1 ? dbl + ' pieces of ' : ''}${s.S.mat.toLowerCase()}.`, 'game'); }
    else if (r < 0.72) giveItem('Relic shard', dbl);
    else if (r < 0.74) { giveItem('Ancient fragment'); log('An Ancient fragment glints in the soil!', 'loot', '#ffd700'); }
    else log('You sift through the soil.', 'game');
    markDirty();
  });
  EXT.extTalk.relicdig = { face: '🏺', talk: e => {
    const s = e.site;
    if (lvl() < s.level) return say(`You need Relicry level ${s.level} to excavate the ${s.name}. The Drowned Chapel in Mirelow Fen takes beginners.`);
    const tool = bestTool(player, skills, 'mattock');
    if (!tool) return [{ run: () => { giveItem('Bronze mattock'); log('A site warden lends you a Bronze mattock. Better mattocks are smithed at an anvil.', 'game'); return []; } }, ['npc', 'Take this mattock. Dig, sift, restore. Then the vault.'], ...startDig(e, 'Bronze mattock')];
    return startDig(e, tool);
  } };
  const startDig = (e, tool) => [{ run: () => { ctx.stopAction(); dig = { ent: e, next: ctx.tick() + 2, tool }; log(`You start excavating with your ${tool.toLowerCase()}. Move away to stop.`, 'game'); return []; } }];

  // ---- bench: restore, collections, reforge ----
  EXT.extTalk.relicbench = { face: '🧰', talk: e => {
    const s = e.site, S = s.S, opts = [];
    for (const [a, l] of S.arts) if (countItem(dmgName(a)) > 0) opts.push([`Restore ${a} (Relicry ${l}; 2 ${S.mat}, 1 Relic shard${l >= 30 ? ', 1 Ancient fragment' : ''})`, [{ run: () => restore(s, a, l) }]]);
    if (S.arts.every(([a]) => countItem(a) > 0)) opts.push([`Turn in the ${s.name} collection`, [{ run: () => turnIn(s) }]]);
    for (const [g, R] of Object.entries(REFORGE)) if (R.site === s.name) opts.push([`Reforge ${g} (Relicry ${R.level}; ${R.frags} Ancient fragments, ${R.mat} ${S.mat}, 1 restored artifact)`, [{ run: () => reforge(s, g, R) }]]);
    opts.push(['What is all this?', say(`Dig at the trenches for ${S.mat.toLowerCase()}, shards and damaged artifacts. Restore artifacts here; a full set of three (${S.arts.map(a => a[0]).join(', ')}) completes the collection. Any restored artifact opens the vault: a relic dungeon. Collections turned in so far: ${P().coll[s.name]}.`)]);
    opts.push(['Goodbye.', []]);
    return [{ choose: opts }];
  } };
  function restore(s, a, l) {
    const S = s.S, needFrag = l >= 30;
    if (lvl() < l) return say(`You need Relicry ${l} to restore that.`);
    if (countItem(S.mat) < 2 || countItem('Relic shard') < 1 || (needFrag && countItem('Ancient fragment') < 1)) return say(`You need 2 ${S.mat}, 1 Relic shard${needFrag ? ' and 1 Ancient fragment' : ''}.`);
    const save = Math.random() < perk(skills, 'Relicry', 'saveMat');
    removeItem(player, dmgName(a), 1);
    if (!save) { removeItem(player, S.mat, 2); removeItem(player, 'Relic shard', 1); if (needFrag) removeItem(player, 'Ancient fragment', 1); }
    giveItem(a); giveXP('Relicry', artXp(l)); markDirty();
    return say(`You restore the ${a}.${save ? ' (Curator: materials saved.)' : ''}`);
  }
  function turnIn(s) {
    const S = s.S; for (const [a] of S.arts) removeItem(player, a, 1);
    const first = P().coll[s.name] === 0; P().coll[s.name]++;
    giveXP('Relicry', collXp(s.level)); giveItem('Coins', 1000 + s.level * 60); giveItem('Ancient fragment', 2);
    if (first) { giveItem(S.reward); log(`Collection complete! The curators award you the ${S.reward}.`, 'loot', '#ffd700'); }
    markDirty();
    return say(first ? `The ${s.name} collection is complete. Take the ${S.reward}, with thanks.` : `Another ${s.name} collection. Coins, fragments and our thanks.`);
  }
  function reforge(s, g, R) {
    const S = s.S;
    if (lvl() < R.level) return say(`You need Relicry ${R.level} to reforge the ${g}.`);
    const art = S.arts.map(a => a[0]).find(a => countItem(a) > 0);
    if (countItem('Ancient fragment') < R.frags || countItem(S.mat) < R.mat || !art) return say(`You need ${R.frags} Ancient fragments, ${R.mat} ${S.mat} and a restored artifact from this site.`);
    removeItem(player, 'Ancient fragment', R.frags); removeItem(player, S.mat, R.mat); removeItem(player, art, 1);
    giveItem(g); giveXP('Relicry', 2000 + R.level * 40); log(`You reforge the ${g}!`, 'loot', '#ffd700'); markDirty();
    return say(`The ${g} gleams as if new.`);
  }

  // ---- relic dungeons ----
  const pool = [];
  let run = null;
  EXT.extTalk.relicvault = { face: '🚪', talk: e => {
    const s = e.site, art = s.S.arts.map(a => a[0]).find(a => countItem(a) > 0);
    if (EXT.dungeonRun) return say('You are already in a dungeon.');
    if (!art) return say(`The vault is sealed. Restore an artifact from the ${s.name} to open it.`);
    const L = dunLevel(s);
    return [['npc', `The ${art} fits the seal. Beyond lies a relic dungeon (level ${L}): gates that test your skills, sentinels and a guardian. The artifact will be consumed.`],
      { choose: [[`Enter (uses your ${art})`, [{ run: () => { enter(s, art); return []; } }]], ['Not yet.', []]] }];
  } };
  const dunLevel = s => Math.max(s.level, Math.min(99, Math.round((s.level + lvl()) / 2)));
  function enter(s, art) {
    if (run || EXT.dungeonRun || !removeItem(player, art, 1)) return;
    const L = dunLevel(s), seed = (Date.now() ^ (L * 7919)) >>> 0;
    const nGates = 6, lay = genLayout(seed, nGates + 2, 1), lite = gfx.quality === 'low';
    const D = buildDungeon(scene, lay, DUNGEON_ORIGIN.relic, s.S.theme, { lite });
    const gateSkills = drawGates(skills, P().seen, nGates, lay.rng);
    run = { s, L, D, gates: [], ents: [], start: Date.now(), bossDead: false };
    EXT.dungeonRun = { kind: 'relic', end: win => finish(win) };
    if (!inInstance(pm.mesh.position.x)) player.instanceReturn = { x: s.x - 5, z: s.z + 7.5 };
    const ease = perk(skills, 'Relicry', 'gateEase');
    // gates on the main path links, in order
    const mainDoors = D.doors.filter(d => lay.rooms[d.b].main);
    mainDoors.forEach((d, i) => {
      if (i >= nGates) return;   // last link (into the boss room) stays open
      const skill = gateSkills[i], G = GATES[skill], need = gateLevel(L, i, ease), door = D.door(d, s.S.theme.accent, G.name);
      const ent = { mesh: door.mesh, alive: true, x: d.x, z: d.z, radius: 2.2, type: 'hearth', ext: 'relicgate', name: `${G.name} (${skill} ${need})`, examine: `${G.act}: needs ${skill} ${need}.`, gate: { skill, need, door, i, open: false } };
      door.mesh.userData.entity = ent; pickables.push(door.mesh); nodes.push(ent); run.ents.push(ent); run.gates.push(ent);
      P().seen[skill] = (P().seen[skill] || 0) + 1;
    });
    // sentinels in a few rooms, boss in the last main room, chest in the side room (or boss room)
    const mains = D.rooms.filter(r => r.main), boss = mains[mains.length - 1];
    mains.forEach((r, k) => { if (k > 0 && k < mains.length - 1 && k % 2 === 0) for (let j = 0; j < (L >= 50 ? 3 : 2); j++) spawn('Relic sentinel', r.x - 3 + j * 3, r.z, L, D.roomBounds(r)); });
    run.boss = spawn('Relic colossus', boss.x, boss.z, L, D.roomBounds(boss), true);
    const side = D.rooms.find(r => !r.main) || boss;
    const chest = D.prop(side.x + 4, side.z, 1.4, 1, 1, 0xb08a3a, s.S.theme.glow);
    const cEnt = { mesh: chest, alive: true, x: side.x + 4, z: side.z, radius: 1.6, type: 'hearth', ext: 'relicchest', name: 'Reliquary chest', examine: 'Sealed until the guardian falls.' };
    chest.userData.entity = cEnt; pickables.push(chest); nodes.push(cEnt); run.ents.push(cEnt);
    const ex = D.prop(mains[0].x, mains[0].z - 6.5, 2, 2.6, 0.4, 0x2a2018);
    const xEnt = { mesh: ex, alive: true, x: mains[0].x, z: mains[0].z - 6.5, radius: 1.6, type: 'hearth', ext: 'relicexit', name: 'Way out', examine: 'Back to the dig site. Leaving ends the run.' };
    ex.userData.entity = xEnt; pickables.push(ex); nodes.push(xEnt); run.ents.push(xEnt);
    travelTo(mains[0].x, mains[0].z - 3);
    log(`Relic dungeon, level ${L}: ${run.gates.map(g => g.gate.skill).join(', ')} gates, then the Relic colossus.`, 'warn');
    markDirty();
  }
  function spawn(type, x, z, L, bounds, boss = false) {
    let m = pool.find(q => q.relicType === type && !q.alive && !q.dying);
    if (!m) { m = spawnMonster(type, x, z, 2, bounds); m.relicType = type; pool.push(m); }
    Object.assign(m, scaled(type, L, boss), { alive: true, dying: false, state: 'idle', respawnAt: 0, respawn: 1e12, spawnX: x, spawnZ: z, bounds, stunUntil: 0, venom: null, relic: true, relicBoss: boss });
    m.hp = m.maxHp = m.hp; m.mesh.visible = true; m.mesh.rotation.set(0, 0, 0); m.mesh.position.set(x, 0, z);
    return m;
  }
  function openGate(ent, how) {
    const g = ent.gate; g.open = true; g.door.open(); ent.alive = false;
    const i = pickables.indexOf(ent.mesh); if (i >= 0) pickables.splice(i, 1);
    log(how || GATES[g.skill].done, 'game'); markDirty();
  }
  EXT.extTalk.relicgate = { face: '🔒', talk: ent => {
    const g = ent.gate, G = GATES[g.skill], have = skills[g.skill].level, opts = [];
    if (g.warden && g.warden.alive) return say('The warden blocks the way. Beat it!');
    opts.push([`${G.act} (${g.skill} ${g.need})`, [{ run: () => tryGate(ent) }]]);
    if (countItem('Relic key') > 0) opts.push(['Use a Relic key', [{ run: () => { removeItem(player, 'Relic key', 1); openGate(ent, 'The Relic key turns and the gate opens.'); return []; } }]]);
    opts.push(['Leave it.', []]);
    return [['npc', `${G.name}. ${G.act}: needs ${g.skill} ${g.need} (you have ${have}).`], { choose: opts }];
  } };
  function tryGate(ent) {
    const g = ent.gate, G = GATES[g.skill];
    if (skills[g.skill].level < g.need) return say(`You need ${g.skill} ${g.need}. A Relic key would open it, or come back stronger.`);
    if (G.kind === 'fight') {
      const r = run.D.roomOf(pm.mesh.position.x, pm.mesh.position.z) || run.D.rooms[0];
      g.warden = spawn('Vault warden', (r.x + ent.x) / 2, (r.z + ent.z) / 2, run.L, run.D.roomBounds(r));
      g.warden.state = 'fight'; g.warden.nextAttackTick = ctx.tick() + 2; g.warden.wardenOf = ent;
      return say('A Vault warden steps out of the wall!');
    }
    if (G.kind === 'hp') { const cost = Math.max(1, Math.round(player.maxHp * 0.1)); if (player.hp <= cost + 1) return say('You are too weak to feed the seal.'); player.hp -= cost; }
    giveXP(g.skill, 20 + g.need * 6); giveXP('Relicry', 10 + g.need * 2);
    openGate(ent); return [];
  }
  EXT.extKill.push(mon => {
    if (!run || !mon.relic) return;
    if (mon.wardenOf) { const ent = mon.wardenOf; mon.wardenOf = null; giveXP('Attack', 20 + ent.gate.need * 6); giveXP('Relicry', 10 + ent.gate.need * 2); openGate(ent); }
    if (mon.relicBoss) { run.bossDead = true; giveXP('Relicry', 150 + run.L * 12); log('The Relic colossus crumbles! The reliquary chest unseals.', 'loot', '#ffd700'); }
  });
  EXT.extTalk.relicchest = { face: '🎁', talk: ent => {
    if (!run.bossDead) return say('The chest is sealed by the guardian\'s power.');
    if (ent.looted) return say('Empty.');
    ent.looted = true; const L = run.L;
    giveItem('Coins', 60 * L + Math.floor(Math.random() * 40 * L)); giveItem('Relic shard', 5 + Math.floor(Math.random() * 10)); giveItem('Ancient fragment', 1 + Math.floor(Math.random() * (1 + L / 30)));
    giveItem(run.s.S.mat, 4 + Math.floor(L / 10));
    if (Math.random() < 0.3) giveItem('Relic key');
    giveXP('Relicry', 200 + L * 15);
    let gear = '';
    if (Math.random() < 0.02 + L / 2500) { gear = RELIC_GEAR[Math.floor(Math.random() * RELIC_GEAR.length)][0]; giveItem(gear); log(`Rare drop: ${gear}!`, 'loot', '#ff8c00'); }
    P().runs++; const secs = Math.round((Date.now() - run.start) / 1000); if (!P().best || secs < P().best) P().best = secs;
    markDirty();
    return say(`Inside: coins, shards, fragments${gear ? ' and the ' + gear : ''}. Run ${P().runs} done in ${secs}s.`);
  } };
  EXT.extTalk.relicexit = { face: '🚪', talk: () => [{ choose: [['Leave the dungeon', [{ run: () => { finish(true); return []; } }]], ['Stay', []]] }] };
  function finish(ok) {
    if (!run) return; const r = run; run = null; EXT.dungeonRun = null;
    for (const e of r.ents) { e.alive = false; const i = nodes.indexOf(e); if (i >= 0) nodes.splice(i, 1); const j = pickables.indexOf(e.mesh); if (j >= 0) pickables.splice(j, 1); }
    for (const m of pool) { m.alive = false; m.dying = false; m.state = 'dead'; m.respawnAt = 0; m.relic = false; m.wardenOf = null; m.mesh.visible = false; }
    ctx.stopAction(); r.D.dispose();
    const back = { x: r.s.x - 5, z: r.s.z + 7.5 }; player.instanceReturn = null;
    travelTo(back.x, back.z); if (!ok) log('The relic dungeon collapses behind you.', 'warn');
    markDirty();
  }
  EXT.extDeath.push(() => { if (run) finish(false); });
  EXT.extFrame.push(() => { if (run) run.D.follow(pm.mesh.position.x, pm.mesh.position.z); });
  // A save made inside a dungeon reloads at the door: send the player back out.
  let checked = false;
  EXT.extTick.push(() => {
    if (checked) return; checked = true;
    const p = pm.mesh.position;
    if (!EXT.dungeonRun && instanceAt(p.x, p.z) === 'dungeon') { const b = player.instanceReturn || { x: sites[0].x, z: sites[0].z + 8 }; player.instanceReturn = null; travelTo(b.x, b.z); }
  });
  ctx.EXT.relicry = { sites, enter, finish, get run() { return run; }, openGate, tryGate, dig: e => { const t = bestTool(player, skills, 'mattock'); if (t) startDig(e, t)[0].run(); } };
  return ctx.EXT.relicry;
}
