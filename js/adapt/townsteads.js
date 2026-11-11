// Townsteads (adapted from Skyrim / Stardew homes): buy existing town houses as storage — a chest, a bed and display hooks.
// This is not a second Hearthstead, not a farm, and not a Freeframe plot. Furnishing trains Construction.
import { ITEMS } from '../items.js';
import { perk } from '../skills.js';
import { inBuilding } from '../world.js';
import { repOf } from '../standing.js';
import { NORM, obj, arr, num } from './state.js';

export const HOUSES = [
  { id: 'lark-e',  name: 'East Larkhaven cottage',  town: 'Larkhaven', x: 13,   z: -6,  gold: 1500, rep: 0,   faction: 'watch' },
  { id: 'lark-n',  name: 'North Larkhaven cottage', town: 'Larkhaven', x: 12.5, z:  7,  gold: 2000, rep: 0,   faction: 'watch' },
  { id: 'lark-w',  name: 'West Larkhaven cottage',  town: 'Larkhaven', x: -12,  z:  5.5,gold: 2000, rep: 0,   faction: 'watch' },
  { id: 'lark-s',  name: 'South Larkhaven cottage', town: 'Larkhaven', x: -14,  z: -7,  gold: 2000, rep: 0,   faction: 'watch' },
  { id: 'ember-a', name: 'Emberfold farmhouse',     town: 'Emberfold', x: 52,   z: -35, gold: 3500, rep: 100, faction: 'watch' },
  { id: 'ember-b', name: 'Emberfold cottage',       town: 'Emberfold', x: 60,   z: -22, gold: 3000, rep: 100, faction: 'watch' },
  { id: 'salt-a',  name: "Saltreach fisherman's cottage", town: 'Saltreach', x: -88, z: 67, gold: 4000, rep: 100, faction: 'mariners' },
  { id: 'high-a',  name: 'Highcrest townhouse',     town: 'Highcrest', x: 110,  z: -33, gold: 6000, rep: 100, faction: 'circle' },
  { id: 'white-e', name: 'East Whitecairn house',   town: 'Whitecairn',x: -70,  z: -72, gold: 5500, rep: 100, faction: 'lantern' },
  { id: 'white-w', name: 'West Whitecairn house',   town: 'Whitecairn',x: -50,  z: -72, gold: 5500, rep: 100, faction: 'lantern' }
];

const FURN_COST = { chest: { Logs: 5 }, bed: { Logs: 4 }, hook: { Logs: 2, 'Iron bar': 1 } };
const FURN_XP = { chest: 45, bed: 35, hook: 25 };

NORM.steads = v => {
  v = obj(v);
  const ids = new Set(HOUSES.map(h => h.id));
  const owned = [...new Set((Array.isArray(v.owned) ? v.owned : []).filter(id => ids.has(id)))];
  const chests = {};
  for (const [id, bag] of Object.entries(obj(v.chests))) {
    if (!ids.has(id) || !bag || typeof bag !== 'object') continue;
    const out = {};
    for (const [item, n] of Object.entries(bag)) if (ITEMS[item] && n > 0) out[item] = Math.min(10000, Math.floor(+n || 0));
    chests[id] = out;
  }
  const furn = {};
  for (const [id, f] of Object.entries(obj(v.furn))) {
    if (!ids.has(id) || !f || typeof f !== 'object') continue;
    const hooks = arr(f.hooks).filter(x => x === null || (typeof x === 'string' && ITEMS[x])).slice(0, 16);
    furn[id] = { chest: !!f.chest, bed: !!f.bed, hooks };
  }
  return { owned, chests, furn };
};

export default function townsteads(A) {
  const { ctx, player, skills } = A;
  const S = () => A.S('steads');
  const houseById = id => HOUSES.find(h => h.id === id);
  const houseAt = (x, z) => {
    let best = null, bd = 3.4;
    for (const h of HOUSES) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
    return best;
  };
  const inside = () => {
    const p = A.pos();
    if (!inBuilding(p.x, p.z, 0.2)) return null;
    return houseAt(p.x, p.z);
  };
  A.steadInside = inside;
  A.steadOwned = id => S().owned.includes(id);

  const hookSlots = () => {
    const L = A.lvl('Construction');
    let n = 1;
    if (L >= 25) n++; if (L >= 50) n++; if (L >= 75) n++; if (L >= 99) n += 2;
    n += Math.floor(Math.max(0, L - 99) / 100);
    n += Math.round(perk(skills, 'Construction', 'pieceCap') || 0);
    return Math.max(1, Math.min(12, n));
  };

  const furnOf = id => { const f = S().furn; if (!f[id]) f[id] = { chest: false, bed: false, hooks: [] }; return f[id]; };
  const chestOf = id => { const c = S().chests; if (!c[id]) c[id] = {}; return c[id]; };

  A.steadBuy = id => {
    const h = houseById(id); if (!h) return;
    if (S().owned.includes(id)) return A.log(`You already own the ${h.name}.`, 'game');
    if ((player.gold || 0) < h.gold) return A.log(`The ${h.name} costs ${h.gold} coins.`, 'warn');
    if (h.rep && repOf(player, h.faction) < h.rep) return A.log(`You need ${h.rep} standing with that town to buy the ${h.name}.`, 'warn');
    // Construction 1 is enough; buying the deed itself does not give XP.
    player.gold -= h.gold;
    S().owned.push(id);
    furnOf(id);
    chestOf(id);
    A.log(`You buy the ${h.name} as a Townstead. It is for storage — a chest, a bed and hooks — not a farm or a workshop.`, 'skill');
    A.dirty(); A.refreshQuick();
    return true;
  };

  const spendMats = rec => {
    if (Object.entries(rec).some(([i, n]) => A.count(i) < n)) return `You need ${Object.entries(rec).map(([i, n]) => `${n} ${i}`).join(', ')}.`;
    for (const [i, n] of Object.entries(rec)) A.take(i, n);
    return null;
  };

  const leyBuild = () => (A.leyFx && A.leyFx().buildSpeed) || 0;
  A.townBuildMs = () => Math.max(350, Math.round(1600 / (1 + (perk(skills, 'Construction', 'buildSpeed') || 0) + leyBuild())));
  A.steadPlace = (id, kind) => {
    const h = houseById(id); if (!h || !S().owned.includes(id)) return A.log('You do not own this house.', 'warn');
    const f = furnOf(id);
    if (kind !== 'hook' && f[kind]) return A.log(`This house already has a ${kind}.`, 'warn');
    if (kind === 'hook' && f.hooks.length >= hookSlots()) return A.log(`Your Construction only supports ${hookSlots()} hooks here.`, 'warn');
    if (A._buildBusy && Date.now() < A._buildBusy) return A.log('You are still setting the last piece.', 'warn');
    const err = spendMats(FURN_COST[kind]); if (err) return A.log(err, 'warn');
    if (kind === 'hook') f.hooks.push(null); else f[kind] = true;
    A._buildBusy = Date.now() + A.townBuildMs();
    const xp = Math.round(FURN_XP[kind] * (1 + perk(skills, 'Construction', 'xpBonus') + perk(skills, 'Construction', 'buildSpeed') * 0.25 + leyBuild() * 0.25));
    ctx.giveXP('Construction', xp);
    if (perk(skills, 'Construction', 'xpBonus') && kind !== 'hook') ctx.giveXP('Crafting', Math.round(xp * 0.15));
    A.log(`You place a ${kind} in the ${h.name}. (+${xp} Construction)`, 'skill'); A.dirty(); A.refreshQuick();
    return true;
  };

  A.steadRest = id => {
    const h = houseById(id); if (!h || !S().owned.includes(id)) return;
    const f = furnOf(id); if (!f.bed) return A.log('Place a bed first.', 'warn');
    const heal = Math.max(1, Math.round(player.maxHp * 0.2));
    player.hp = Math.min(player.maxHp, player.hp + heal);
    player.runEnergy = 100;
    A.log(`You rest in the ${h.name}. (+${heal} hitpoints, run energy restored.)`, 'game'); A.dirty();
    return true;
  };

  A.steadStore = (id, item, n = 1) => {
    if (!S().owned.includes(id) || !furnOf(id).chest) return A.log('Place a chest first.', 'warn');
    if (!ITEMS[item] || A.count(item) < n) return;
    A.take(item, n);
    const bag = chestOf(id); bag[item] = (bag[item] || 0) + n; A.dirty();
    return true;
  };
  A.steadTake = (id, item, n = 1) => {
    const bag = chestOf(id); if ((bag[item] || 0) < n) return;
    bag[item] -= n; if (bag[item] <= 0) delete bag[item];
    A.give(item, n); A.dirty();
    return true;
  };
  A.steadHook = (id, slot, item) => {
    const f = furnOf(id); if (!f.hooks[slot] && f.hooks[slot] !== null) return;
    if (item && !ITEMS[item]) return;
    f.hooks[slot] = item || null; A.dirty();
    A.log(item ? `You hang the ${item} on a hook.` : 'You clear the hook.', 'game');
    return true;
  };

  A.steadOptions = ent => {
    if (!ent || ent.type !== 'building') return [];
    const h = houseAt(ent.x, ent.z); if (!h) return [];
    const owned = S().owned.includes(h.id);
    if (owned) return [
      { action: 'Townstead', target: h.name, color: '#c8a050', fn: () => A.open('steads') },
      { action: 'Rest', target: 'Bed', color: '#c8a050', fn: () => A.steadRest(h.id) }
    ];
    return [{ action: 'Buy Townstead', target: `${h.gold} coins`, color: '#c8a050', fn: () => A.steadBuy(h.id) }];
  };

  A.quick(() => {
    const h = inside(); if (!h || !S().owned.includes(h.id)) return [];
    const f = furnOf(h.id), out = [['stead', 'Townstead', 'Your town house: chest, bed and hooks']];
    if (f.bed) out.push(['steadrest', 'Rest', 'Lie down and recover']);
    return out;
  });
  A.onQuick('stead', () => A.open('steads'));
  A.onQuick('steadrest', () => { const h = inside(); if (h) A.steadRest(h.id); });

  A.guide.push(['Townsteads', 'Buy an existing town house (Larkhaven, Emberfold, Saltreach, Highcrest, Whitecairn) as storage: a chest, a bed and display hooks. Construction 1 is enough for the first chest and bed; furnishing trains Construction and unlocks more hooks. This is not a farm and not a workshop — those belong at the Hold and, later, a wild plot. Walking into an unbought house still works as a plain building.']);
  A.tab({ id: 'steads', icon: '🏠', name: 'Townsteads', render: () => {
    const s = S(), here = inside();
    const rows = HOUSES.map(h => {
      const own = s.owned.includes(h.id), f = own ? furnOf(h.id) : null, bag = own ? chestOf(h.id) : null;
      const items = bag ? Object.entries(bag).map(([i, n]) => `${n} ${i}`).join(', ') : '';
      const need = h.rep ? ` and ${h.rep} standing` : '';
      let body = `<div style="margin:8px 0"><b>${A.esc(h.name)}</b> <small>${h.town}${here && here.id === h.id ? ' · you are here' : ''}${own ? ' · owned' : ` · ${h.gold} coins${need}`}</small>`;
      if (!own) body += `<div class="row"><button data-a="buy" data-b="${h.id}" style="min-height:36px">Buy deed</button></div>`;
      else {
        body += `<br><small>Chest ${f.chest ? 'placed' : 'not placed'} · Bed ${f.bed ? 'placed' : 'not placed'} · Hooks ${f.hooks.length}/${hookSlots()}${items ? ` · stored: ${A.esc(items)}` : ''}</small>
          <div class="row" style="flex-wrap:wrap;gap:4px">${f.chest ? '' : '<button data-a="place" data-b="'+h.id+'" data-k="chest">Place chest (5 Logs)</button>'}${f.bed ? '' : '<button data-a="place" data-b="'+h.id+'" data-k="bed">Place bed (4 Logs)</button>'}
          <button data-a="place" data-b="${h.id}" data-k="hook">Add hook (2 Logs, 1 Iron bar)</button>${f.bed ? `<button data-a="rest" data-b="${h.id}">Rest</button>` : ''}</div>`;
        if (f.chest) {
          const inv = Object.keys(player.inventory || {}).slice(0, 8);
          body += `<div class="row" style="flex-wrap:wrap;gap:4px">${inv.map(i => `<button data-a="store" data-b="${h.id}" data-k="${A.esc(i)}" style="font-size:11px">Store ${A.esc(i)}</button>`).join('')}
            ${Object.keys(bag).map(i => `<button data-a="take" data-b="${h.id}" data-k="${A.esc(i)}" style="font-size:11px">Take ${A.esc(i)}</button>`).join('')}</div>`;
        }
        if (f.hooks.length) body += `<div class="row" style="flex-wrap:wrap;gap:4px">${f.hooks.map((it, i) => `<small>Hook ${i + 1}: ${A.esc(it || 'empty')}</small>`).join(' · ')}</div>`;
      }
      return body + '</div>';
    }).join('');
    return `<h4>Townsteads · Construction ${A.lvl('Construction')} · ${hookSlots()} hook slots</h4>
      <p><small>Town houses are storage. The farm and Hearthhold are where you make things; a claimed wild plot is for freeform building later. Buying a deed does not train Construction; placing the chest, bed and hooks does. Construction 1 is enough for the first furniture.</small></p>${rows}`; },
    act: (a, d) => { if (a === 'buy') A.steadBuy(d.b); if (a === 'place') A.steadPlace(d.b, d.k); if (a === 'rest') A.steadRest(d.b); if (a === 'store') A.steadStore(d.b, d.k); if (a === 'take') A.steadTake(d.b, d.k); } });

  A.vtests = A.vtests || {};
  A.vtests.townsteads = async (g, A) => {
    const sk = A.skills.Construction, old = { level: sk.level, xp: sk.xp, gold: g.player.gold, inv: { ...g.player.inventory } };
    const s = S(), owned0 = s.owned.slice(), chests0 = JSON.parse(JSON.stringify(s.chests)), furn0 = JSON.parse(JSON.stringify(s.furn));
    try {
      if (!sk || sk.max !== 1000 || sk.level < 1) return 'skill';
      g.player.gold = Math.max(g.player.gold, 2000);
      g.player.inventory['Logs'] = (g.player.inventory['Logs'] || 0) + 20;
      g.player.inventory['Iron bar'] = (g.player.inventory['Iron bar'] || 0) + 4;
      g.player.inventory['Bronze sword'] = (g.player.inventory['Bronze sword'] || 0) + 1;
      const id = 'lark-e';
      if (s.owned.includes(id)) { /* ok */ } else if (!A.steadBuy(id)) return 'buy';
      if (!s.owned.includes(id)) return 'not owned';
      const xp0 = sk.xp;
      const b0 = A.townBuildMs();
      const origLey = A.leyFx;
      A.leyFx = () => ({ ...(origLey ? origLey() : {}), buildSpeed: 1 });
      const b1 = A.townBuildMs();
      A.leyFx = origLey;
      if (!(b1 < b0)) return 'ley build unused';
      A._buildBusy = 0;
      if (!furnOf(id).chest && !A.steadPlace(id, 'chest')) return 'chest';
      A._buildBusy = 0;
      if (!furnOf(id).bed && !A.steadPlace(id, 'bed')) return 'bed';
      A._buildBusy = 0;
      if (sk.xp <= xp0) return 'no construction xp';
      const stored = A.steadStore(id, 'Bronze sword', 1);
      if (!stored || (chestOf(id)['Bronze sword'] || 0) < 1) return 'store';
      if (A.count('Bronze sword') !== old.inv['Bronze sword']) { /* took one */ }
      const took = A.steadTake(id, 'Bronze sword', 1);
      if (!took) return 'take';
      A.steadRest(id);
      return true;
    } finally {
      sk.level = old.level; sk.xp = old.xp; g.player.gold = old.gold; g.player.inventory = old.inv;
      s.owned = owned0; s.chests = chests0; s.furn = furn0;
    }
  };
}
