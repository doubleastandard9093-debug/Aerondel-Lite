// Greenstead (adapted from Stardew / Animal Crossing): the making-things farm on the Hearthhold island. Not a Townstead, not a Freeframe plot.
import * as THREE from 'three';
import { ITEMS } from '../items.js';
import { perk } from '../skills.js';
import { currentSeason, SEASONS } from '../seasons.js';
import { NORM, obj, arr, num } from './state.js';

export const CROPS = {
  potato:     { id: 'potato',     name: 'Potato',     seed: 'Potato seed',     item: 'Potato',     season: 'spring', lvl: 1,  grow: 120000, plantXp: 8,  harvestXp: 25 },
  cabbage:    { id: 'cabbage',    name: 'Cabbage',    seed: 'Cabbage seed',    item: 'Cabbage',    season: 'spring', lvl: 5,  grow: 150000, plantXp: 10, harvestXp: 32 },
  wheat:      { id: 'wheat',      name: 'Wheat',      seed: 'Wheat seed',      item: 'Wheat',      season: 'summer', lvl: 1,  grow: 150000, plantXp: 8,  harvestXp: 28 },
  tomato:     { id: 'tomato',     name: 'Tomato',     seed: 'Tomato seed',     item: 'Tomato',     season: 'summer', lvl: 15, grow: 180000, plantXp: 12, harvestXp: 40 },
  pumpkin:    { id: 'pumpkin',    name: 'Pumpkin',    seed: 'Pumpkin seed',    item: 'Pumpkin',    season: 'autumn', lvl: 20, grow: 240000, plantXp: 14, harvestXp: 50 },
  winterroot: { id: 'winterroot', name: 'Winterroot', seed: 'Winterroot seed', item: 'Winterroot', season: 'winter', lvl: 10, grow: 200000, plantXp: 12, harvestXp: 36 }
};
export const ANIMALS = {
  chicken: { id: 'chicken', name: 'Chicken', produce: 'Egg',  feed: 'Wheat', time: 120000, lvl: 1,  xp: 18, gold: 200, face: '🐔' },
  cow:     { id: 'cow',     name: 'Cow',     produce: 'Milk', feed: 'Wheat', time: 180000, lvl: 15, xp: 28, gold: 800, face: '🐄' },
  sheep:   { id: 'sheep',   name: 'Sheep',   produce: 'Wool', feed: 'Wheat', time: 180000, lvl: 25, xp: 24, gold: 600, face: '🐑' }
};
const DECOR = {
  fence:     { name: 'Fence',     mats: { Logs: 2 }, xp: 8,  color: 0x8a6a3a },
  scarecrow: { name: 'Scarecrow', mats: { Logs: 3, Flax: 1 }, xp: 12, color: 0xc8a050 },
  bench:     { name: 'Bench',     mats: { Logs: 4 }, xp: 10, color: 0x6a4a2a }
};
const SEED_PRICE = { 'Potato seed': 5, 'Cabbage seed': 6, 'Wheat seed': 5, 'Tomato seed': 8, 'Pumpkin seed': 10, 'Winterroot seed': 8 };
const DEED_GOLD = 2000;

NORM.green = v => {
  v = obj(v);
  const plots = arr(v.plots).map(p => {
    if (!p || typeof p !== 'object') return { crop: null, plantedAt: 0, season: '', cover: false };
    const crop = CROPS[p.crop] ? p.crop : null;
    return { crop, plantedAt: crop ? num(p.plantedAt, 0, 0) : 0, season: crop ? String(p.season || CROPS[crop].season) : '', cover: !!p.cover };
  }).slice(0, 16);
  const animals = arr(v.animals).filter(a => a && ANIMALS[a.type]).map(a => ({ type: a.type, fedAt: num(a.fedAt, 0, 0), ready: !!a.ready })).slice(0, 8);
  const decor = arr(v.decor).filter(d => d && DECOR[d.id]).map(d => ({ id: d.id, x: num(d.x, 0, -14, 14), z: num(d.z, 0, -14, 14), rot: num(d.rot, 0) })).slice(0, 80);
  const grown = {};
  for (const [k, n] of Object.entries(obj(v.grown))) if (ITEMS[k] && n > 0) grown[k] = Math.min(10000, Math.floor(+n || 0));
  return { deed: !!v.deed, plots, animals, decor, grown };
};

export default function greenstead(A) {
  const { ctx, player, skills } = A;
  const G = () => A.S('green');
  let built = false;
  const season = () => currentSeason(player);
  const onPad = () => Math.abs(A.pos().x + 1000) < 20 && Math.abs(A.pos().z - A.zoneC('hold').z) < 16;

  const plotN = () => {
    const L = A.lvl('Farming');
    let n = 4;
    if (L >= 25) n += 2; if (L >= 50) n += 2; if (L >= 75) n += 2; if (L >= 99) n += 2;
    n += Math.floor(Math.max(0, L - 99) / 200);
    return Math.max(4, Math.min(16, n));
  };
  const ensurePlots = () => { const g = G(); while (g.plots.length < plotN()) g.plots.push({ crop: null, plantedAt: 0, season: '', cover: false }); };
  const animalCap = () => {
    const L = A.lvl('Farming');
    let n = 2;
    if (L >= 50) n += 1; if (L >= 99) n += 1;
    n += Math.round(perk(skills, 'Farming', 'animalCap') || 0);
    const hard = ctx.gfxQ && ctx.gfxQ() === 'low' ? 4 : 6;
    return Math.max(1, Math.min(hard, n));
  };
  const decorCap = () => (ctx.gfxQ && ctx.gfxQ() === 'low' ? 40 : 80);
  const growMs = crop => Math.max(4000, Math.round(crop.grow / (1 + perk(skills, 'Farming', 'growSpeed'))));
  const farmXp = (base, inSeason) => Math.round(base * (inSeason ? 1.25 : 1) * (1 + perk(skills, 'Farming', 'xpBonus')));
  const greenhouse = () => A.lvl('Farming') >= 50;
  const canSeason = (crop, covered) => season() === crop.season || (covered && greenhouse());

  A.grew = (item, n) => {
    const g = G(); g.grown = g.grown || {};
    if (n !== undefined) { g.grown[item] = Math.max(0, (g.grown[item] || 0) + n); A.dirty(); return g.grown[item]; }
    return Math.min(g.grown[item] || 0, A.count(item));
  };

  const prevHome = A.holdHome;
  A.holdHome = () => (prevHome && prevHome()) || (!!G().deed && !A.run && onPad());
  A.greenHome = () => !!G().deed && !A.run && onPad();

  const buildFarm = () => {
    if (built || !G().deed) return;
    built = true;
    A.zoneBuild('hold', 0x4a6a3a, 0x8a7a5a);
    // A small field along the north wall, clear of forge / garden / kennel and the south landing.
    A.zoneProp('hold', -4, -11, new THREE.BoxGeometry(10, 0.2, 3.2), 0x5a3a1a, { ext: 'greenstead', name: 'Greenstead field', examine: 'Your farm plots. This is where you make things — not a town house.', radius: 5.5 });
    A.zoneProp('hold', 8, 4, new THREE.BoxGeometry(3, 1.2, 3), 0x8a7a5a, { ext: 'greenstead', name: 'Greenstead barn', examine: 'Animals and preserves.', radius: 2.4 });
    // Reuse the Hold boat if Hearthhold already placed one; don't add a second cylinder on the same landing.
    if (!(ctx.nodes || []).some(e => e && e.ext === 'holdboat' && e.alive !== false))
      A.zoneProp('hold', 0, 10, new THREE.CylinderGeometry(1, 1.2, 0.6, 8), 0x6ad0ff, { ext: 'holdboat', name: 'Boat home', examine: 'Back to the mainland.' });
  };
  ctx.EXT.extTalk.greenstead = { face: '🌾', talk: () => { A.open('green'); return []; } };

  const prevGo = A.holdGo;
  A.holdGo = (...args) => { const r = prevGo && prevGo(...args); buildFarm(); return r; };

  A.greenBuy = () => {
    if (G().deed) return A.log('You already hold the Greenstead deed.', 'game');
    if ((player.gold || 0) < DEED_GOLD) return A.log(`The Greenstead deed costs ${DEED_GOLD} coins.`, 'warn');
    player.gold -= DEED_GOLD;
    G().deed = true;
    ensurePlots();
    A.log('Greenstead is yours. Sail there from Ventures ✦ → Greenstead. It sits on the Hearthhold island — a farm for making things, not a town storehouse.', 'skill');
    A.dirty(); A.refreshQuick();
    return true;
  };
  A.greenGo = () => {
    if (!G().deed) return A.log('Buy the Greenstead deed first (Ventures ✦ → Greenstead, 2,000 coins).', 'warn');
    if (A.run || ctx.EXT.dungeonRun) return A.log('Finish what you are doing first.', 'warn');
    buildFarm();
    if (A.pos().x > -700) player.instanceReturn = { x: A.pos().x, z: A.pos().z };
    const c = A.zoneC('hold'); ctx.travelTo(c.x, c.z + 6);
    A.log('You sail to Greenstead, on the Hearthhold island.', 'game');
    return true;
  };
  A.greenLeave = () => { if (A.holdLeave) A.holdLeave(); };

  A.greenBuySeed = (seed, n = 1) => {
    const price = SEED_PRICE[seed]; if (!price) return;
    const cost = price * n;
    if ((player.gold || 0) < cost) return A.log(`Those seeds cost ${cost} coins.`, 'warn');
    player.gold -= cost; A.give(seed, n); A.log(`You buy ${n} ${seed}.`, 'game'); A.dirty();
    return true;
  };

  A.greenPlant = (i, cropId) => {
    if (!G().deed) return A.log('Buy the Greenstead deed first.', 'warn');
    ensurePlots();
    const crop = CROPS[cropId], plots = G().plots;
    if (!crop || i < 0 || i >= plotN()) return;
    const p = plots[i]; if (!p || p.crop) return A.log('That plot is already planted.', 'warn');
    if (A.lvl('Farming') < crop.lvl) return A.log(`You need Farming ${crop.lvl} to grow ${crop.name}.`, 'warn');
    if (!canSeason(crop, p.cover)) return A.log(`${crop.name} wants ${crop.season}${greenhouse() ? ' — or a winter cover on this plot (Farming 50).' : '.'}`, 'warn');
    if (A.count(crop.seed) < 1) return A.log(`You need a ${crop.seed}.`, 'warn');
    A.take(crop.seed, 1);
    p.crop = cropId; p.plantedAt = Date.now(); p.season = season();
    const xp = farmXp(crop.plantXp, season() === crop.season);
    ctx.giveXP('Farming', xp);
    A.log(`You plant ${crop.name}. (+${xp} Farming)`, 'skill'); A.dirty();
    return true;
  };
  A.greenCover = i => {
    if (!greenhouse()) return A.log('A winter cover wants Farming 50 (Homestead).', 'warn');
    ensurePlots();
    const cap = 1 + (A.leyKey && A.leyKey('seasonkeep') ? 1 : 0);
    const used = G().plots.filter(p => p.cover).length;
    if (used >= cap && !G().plots[i].cover) return A.log(`You can only cover ${cap} plot${cap>1?'s':''} at a time.`, 'warn');
    G().plots[i].cover = !G().plots[i].cover;
    A.log(G().plots[i].cover ? 'You set a winter cover on this plot. One crop can grow out of season here.' : 'You take the cover off.', 'game'); A.dirty();
    return true;
  };
  const ripe = p => { if (!p || !p.crop) return false; const c = CROPS[p.crop]; return c && Date.now() - p.plantedAt >= growMs(c); };
  A.greenHarvest = i => {
    ensurePlots();
    const p = G().plots[i]; if (!ripe(p)) return A.log('Nothing is ready on that plot.', 'warn');
    const crop = CROPS[p.crop], inS = p.season === crop.season;
    let n = 1;
    if (Math.random() < perk(skills, 'Farming', 'farmYield')) n += 1;
    if (Math.random() < perk(skills, 'Farming', 'rareCrop')) n += 1;
    A.give(crop.item, n); A.grew(crop.item, n);
    const xp = farmXp(crop.harvestXp, inS);
    ctx.giveXP('Farming', xp);
    p.crop = null; p.plantedAt = 0; p.season = '';
    A.log(`You harvest ${n} ${crop.item}. (+${xp} Farming)`, 'loot'); A.dirty();
    return true;
  };

  A.greenBuyAnimal = type => {
    const a = ANIMALS[type]; if (!a) return;
    if (A.lvl('Farming') < a.lvl) return A.log(`You need Farming ${a.lvl} to keep a ${a.name}.`, 'warn');
    if (G().animals.length >= animalCap()) return A.log(`Your farm only supports ${animalCap()} animals.`, 'warn');
    if ((player.gold || 0) < a.gold) return A.log(`A ${a.name} costs ${a.gold} coins.`, 'warn');
    player.gold -= a.gold;
    G().animals.push({ type, fedAt: 0, ready: false });
    A.log(`A ${a.name} joins the farm.`, 'skill'); A.dirty();
    return true;
  };
  A.greenFeed = i => {
    const a = G().animals[i], def = a && ANIMALS[a.type]; if (!def) return;
    if (A.count(def.feed) < 1) return A.log(`You need ${def.feed} to feed the ${def.name}.`, 'warn');
    if (a.ready) return A.log('Collect from them first.', 'warn');
    A.take(def.feed, 1); a.fedAt = Date.now(); a.ready = false;
    A.log(`You feed the ${def.name}.`, 'game'); A.dirty();
    return true;
  };
  A.greenCollect = i => {
    const a = G().animals[i], def = a && ANIMALS[a.type]; if (!def) return;
    const ready = a.ready || (a.fedAt && Date.now() - a.fedAt >= def.time);
    if (!ready) return A.log('They are not ready yet.', 'warn');
    A.give(def.produce, 1); A.grew(def.produce, 1);
    ctx.giveXP('Farming', def.xp);
    a.fedAt = 0; a.ready = false;
    A.log(`You collect ${def.produce}. (+${def.xp} Farming)`, 'loot'); A.dirty();
    return true;
  };

  A.greenPreserve = item => {
    if (!ITEMS[item] || !ITEMS[item].farm || item === 'Farm preserves' || item === 'Wool' || item === 'Wheat') return A.log('That is not farm produce you can jar.', 'warn');
    if (A.count(item) < 2) return A.log(`You need 2 ${item} to make preserves.`, 'warn');
    A.take(item, 2); if (A.grew) A.grew(item, -2);
    A.give('Farm preserves', 1); A.grew('Farm preserves', 1);
    ctx.giveXP('Farming', 20);
    A.log(`You jar farm preserves from ${item}. (+20 Farming) This is Farming, not Cooking.`, 'skill'); A.dirty();
    return true;
  };

  A.greenPlace = id => {
    const d = DECOR[id]; if (!d) return;
    if (G().decor.length >= decorCap()) return A.log(`The farm only holds ${decorCap()} décor pieces.`, 'warn');
    if (Object.entries(d.mats).some(([i, n]) => A.count(i) < n)) return A.log(`You need ${Object.entries(d.mats).map(([i, n]) => `${n} ${i}`).join(', ')}.`, 'warn');
    for (const [i, n] of Object.entries(d.mats)) A.take(i, n);
    const slot = G().decor.length;
    G().decor.push({ id, x: -10 + (slot % 5) * 1.4, z: 0 + Math.floor(slot / 5) * 1.4, rot: 0 });
    ctx.giveXP('Construction', d.xp);
    A.log(`You place a ${d.name}. (+${d.xp} Construction)`, 'skill'); A.dirty();
    return true;
  };
  A.greenPick = i => {
    const d = G().decor[i]; if (!d) return;
    G().decor.splice(i, 1);
    const def = DECOR[d.id];
    if (def) for (const [item, n] of Object.entries(def.mats)) A.give(item, n);
    A.log(`You pick up the ${def ? def.name : 'piece'}.`, 'game'); A.dirty();
    return true;
  };

  A.quick(() => A.greenHome() ? [['green', 'Greenstead', 'Your farm: plant, tend, harvest']] : []);
  A.onQuick('green', () => A.open('green'));
  A.every(8, () => {
    if (!G().deed) return;
    for (const a of G().animals) if (a.fedAt && !a.ready && Date.now() - a.fedAt >= (ANIMALS[a.type] || {}).time) a.ready = true;
  });

  A.guide.push(['Greenstead', 'Buy a farm deed (2,000 coins) and sail to Greenstead on the Hearthhold island. Plant seasonal crops, tend a few animals, jar simple preserves, and place a little décor. Planting, harvesting, animals and preserves train Farming (a new skill to 1000, not in combat level). Décor grants a little Construction, but this is not a Construction grind. Town houses stay storage; the Hold garden and Hearthstead herb beds stay as they are.']);
  A.tab({ id: 'green', icon: '🌾', name: 'Greenstead', render: () => {
    const g = G(), s = season(), S = SEASONS[s] || { name: s, icon: '' };
    if (!g.deed) return `<h4>Greenstead</h4><p>A making-things farm on the Hearthhold island. Town houses are for storage; this is where you grow, tend and jar. The deed is 2,000 coins and does not train Farming — planting does.</p><div class="row"><button data-a="buy">Buy the deed (${DEED_GOLD} coins)</button></div>`;
    ensurePlots();
    const plots = g.plots.slice(0, plotN()).map((p, i) => {
      const c = p.crop && CROPS[p.crop];
      const st = !c ? 'empty' : ripe(p) ? 'ready' : `growing (${Math.max(1, Math.ceil((growMs(c) - (Date.now() - p.plantedAt)) / 1000))}s)`;
      return `<div style="margin:6px 0"><b>Plot ${i + 1}</b> <small>${c ? c.name + ' · ' + st : 'empty'}${p.cover ? ' · covered' : ''}</small>
        <div class="row" style="flex-wrap:wrap;gap:4px">${!c ? Object.values(CROPS).map(x => `<button data-a="plant" data-i="${i}" data-k="${x.id}" style="font-size:11px">${x.name}</button>`).join('') : ripe(p) ? `<button data-a="harvest" data-i="${i}">Harvest</button>` : ''}
        ${greenhouse() ? `<button data-a="cover" data-i="${i}" style="font-size:11px">${p.cover ? 'Remove cover' : 'Winter cover'}</button>` : ''}</div></div>`;
    }).join('');
    const seeds = Object.keys(SEED_PRICE).map(k => `<button data-a="seed" data-k="${k}" style="font-size:11px">${k} (${SEED_PRICE[k]}c) ×${A.count(k)}</button>`).join('');
    const an = g.animals.map((a, i) => { const d = ANIMALS[a.type]; const ready = a.ready || (a.fedAt && Date.now() - a.fedAt >= d.time); return `<div class="row" style="gap:4px"><span>${d.face} ${d.name}${ready ? ' · ready' : a.fedAt ? ' · digesting' : ' · hungry'}</span>${ready ? `<button data-a="collect" data-i="${i}">Collect ${d.produce}</button>` : `<button data-a="feed" data-i="${i}">Feed ${d.feed}</button>`}</div>`; }).join('') || '<small>No animals yet.</small>';
    const buyA = Object.values(ANIMALS).map(d => `<button data-a="banimal" data-k="${d.id}" style="font-size:11px">${d.face} ${d.name} (${d.gold}c, Farming ${d.lvl})</button>`).join('');
    const dec = g.decor.map((d, i) => `<button data-a="pick" data-i="${i}" style="font-size:11px">Pick up ${DECOR[d.id].name}</button>`).join('');
    const place = Object.entries(DECOR).map(([id, d]) => `<button data-a="place" data-k="${id}" style="font-size:11px">${d.name} (${Object.entries(d.mats).map(([i, n]) => `${n} ${i}`).join(', ')})</button>`).join('');
    const produce = Object.keys(player.inventory || {}).filter(i => ITEMS[i] && ITEMS[i].farm && i !== 'Wool' && i !== 'Wheat' && i !== 'Farm preserves' && player.inventory[i] >= 2);
    const jars = produce.map(i => `<button data-a="jar" data-k="${i}" style="font-size:11px">Jar 2 ${i}</button>`).join('');
    return `<h4>Greenstead · Farming ${A.lvl('Farming')} · ${S.icon} ${S.name}</h4>
      <p><small>Town houses store things. This farm, and the Hold forge and garden, are where you make them. Crops follow the season; Farming 50 unlocks one winter cover. Décor cap ${g.decor.length}/${decorCap()} (a little Construction XP). Animals ${g.animals.length}/${animalCap()}.</small></p>
      <div class="row" style="gap:4px">${A.greenHome() ? '<button data-a="leave">⛵ Sail home</button>' : '<button data-a="go">⛵ Sail to Greenstead</button>'}</div>
      <h4>Seed stall</h4><div class="row" style="flex-wrap:wrap;gap:4px">${seeds}</div>
      <h4>Plots (${plotN()})</h4>${plots}
      <h4>Animals</h4>${an}<div class="row" style="flex-wrap:wrap;gap:4px">${buyA}</div>
      <h4>Preserves (Farming, not Cooking)</h4><div class="row" style="flex-wrap:wrap;gap:4px">${jars || '<small>Harvest two of the same produce first.</small>'}</div>
      <h4>Décor</h4><div class="row" style="flex-wrap:wrap;gap:4px">${place}</div>${dec ? `<div class="row" style="flex-wrap:wrap;gap:4px">${dec}</div>` : ''}`;
  }, act: (a, d) => {
    if (a === 'buy') A.greenBuy(); if (a === 'go') { A.greenGo(); A.close(); } if (a === 'leave') { A.greenLeave(); A.close(); }
    if (a === 'seed') A.greenBuySeed(d.k, 1); if (a === 'plant') A.greenPlant(+d.i, d.k); if (a === 'harvest') A.greenHarvest(+d.i);
    if (a === 'cover') A.greenCover(+d.i); if (a === 'banimal') A.greenBuyAnimal(d.k); if (a === 'feed') A.greenFeed(+d.i);
    if (a === 'collect') A.greenCollect(+d.i); if (a === 'jar') A.greenPreserve(d.k); if (a === 'place') A.greenPlace(d.k); if (a === 'pick') A.greenPick(+d.i);
  } });

  A.vtests = A.vtests || {};
  A.vtests.greenstead = async (g, A) => {
    const sk = g.skills.Farming, con = g.skills.Construction;
    if (!sk || sk.max !== 1000 || sk.level < 1) return 'skill';
    if ((g.SKILLS || []).includes && false) return 'x';
    const old = { level: sk.level, xp: sk.xp, conL: con && con.level, conX: con && con.xp, gold: g.player.gold, inv: { ...g.player.inventory }, season: g.player.settings && g.player.settings.season };
    const snap = JSON.parse(JSON.stringify(G()));
    const hold = g.player.adapt && g.player.adapt.hold ? JSON.parse(JSON.stringify(g.player.adapt.hold)) : null;
    try {
      g.player.gold = Math.max(g.player.gold, DEED_GOLD + 500);
      if (!G().deed && !A.greenBuy()) return 'buy';
      if (!G().deed) return 'no deed';
      ensurePlots();
      g.player.settings = g.player.settings || {};
      g.player.settings.season = 'spring';
      g.player.inventory['Potato seed'] = (g.player.inventory['Potato seed'] || 0) + 2;
      g.player.inventory['Logs'] = (g.player.inventory['Logs'] || 0) + 8;
      g.player.inventory['Potato'] = (g.player.inventory['Potato'] || 0) + 2;
      const xp0 = sk.xp;
      if (!A.greenPlant(0, 'potato')) return 'plant';
      // Wrong season should fail without a cover (cabbage is also spring; use pumpkin).
      const p1xp = sk.xp;
      const bad = A.greenPlant(1, 'pumpkin');
      if (bad) return 'out of season planted';
      if (sk.xp !== p1xp) return 'out of season xp';
      // Time-skip and harvest.
      G().plots[0].plantedAt = Date.now() - growMs(CROPS.potato) - 100;
      if (!A.greenHarvest(0)) return 'harvest';
      if (sk.xp <= xp0) return 'no farming xp';
      if (!A.grew('Potato')) return 'not marked grown';
      const cx0 = con ? con.xp : 0, d0 = G().decor.length;
      if (!A.greenPlace('fence')) return 'place decor';
      if (con && con.xp <= cx0) return 'no construction xp';
      if (G().decor.length !== d0 + 1) return 'decor missing';
      if (!A.greenPick(G().decor.length - 1) && G().decor.length !== d0) return 'pick decor';
      if (!A.greenPreserve('Potato')) return 'preserves';
      // Hold garden path is untouched (we did not call holdGarden or change hold.garden).
      if (hold && g.player.adapt.hold && g.player.adapt.hold.garden !== hold.garden) return 'hold garden disturbed';
      return true;
    } finally {
      sk.level = old.level; sk.xp = old.xp;
      if (con) { con.level = old.conL; con.xp = old.conX; }
      g.player.gold = old.gold; g.player.inventory = old.inv;
      if (g.player.settings) g.player.settings.season = old.season;
      const gnow = G(); Object.keys(gnow).forEach(k => delete gnow[k]); Object.assign(gnow, snap);
      if (hold && g.player.adapt) g.player.adapt.hold = hold;
    }
  };
}
