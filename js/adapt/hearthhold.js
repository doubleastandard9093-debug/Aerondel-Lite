// Hearthhold (adapted from Lost Ark's stronghold): a private island with a forge, garden and kennel you upgrade,
// and timed expeditions for your recruited companions.
import * as THREE from 'three';
import { COMPANIONS } from '../companions.js';
import { NORM, obj, num } from './state.js';
const B = {
  forge: { name: 'Forge', icon: '🔨', cost: [[5000, { 'Iron bar': 20 }], [25000, { 'Iron bar': 60, Coal: 60 }], [100000, { 'Iron bar': 150, 'Cobalt ore': 20 }]], desc: l => `${['—', 'a Lesser graft', 'a Lesser graft and a Sigil tome', 'a Greater graft and a Sigil tome'][l]} each day` },
  garden: { name: 'Garden', icon: '🌿', cost: [[3000, { Logs: 30 }], [15000, { 'Oak logs': 60 }], [60000, { 'Maple logs': 100 }]], desc: l => `${['no', '6', '12', '20'][l]} herbs every 2 hours` },
  kennel: { name: 'Kennel', icon: '🐾', cost: [[4000, { Logs: 40 }], [20000, { 'Willow logs': 60 }], [80000, { 'Yew logs': 80 }]], desc: l => `expeditions bring back ${['×1', '×1.5', '×2', '×3'][l]}` }
};
const TRIPS = { short: ['Coastal forage', 10, 1], mid: ['Ridge survey', 30, 3], long: ['Deep frontier', 60, 7] };
const HERBS = ['Greenwort', 'Marshmint', 'Tallowroot', 'Harrowbloom', 'Toadflax', 'Ironleaf'];
const LOOT = [['Iron ore', 6], ['Coal', 6], ['Oak logs', 6], ['Willow logs', 5], ['Raw trout', 5], ['Flax', 8]];
NORM.hold = v => { v = obj(v); const lv = {}; for (const k of Object.keys(B)) lv[k] = Math.floor(num(obj(v.lv)[k], 0, 0, 3)); const trips = {};
  for (const [id, t] of Object.entries(obj(v.trips))) if (t && TRIPS[t.kind] && Number.isFinite(+t.back)) trips[id] = { kind: t.kind, back: +t.back }; return { owned: !!v.owned, lv, trips, forgeDay: String(v.forgeDay || ''), garden: num(v.garden, 0), done: Math.floor(num(v.done, 0, 0)) }; };
export default function hearthhold(A) {
  const { ctx, player } = A, H = () => A.S('hold'); let built = false;
  const today = () => new Date().toISOString().slice(0, 10);
  A.holdHome = () => !A.run && H().owned && Math.abs(A.pos().x + 1000) < 20 && Math.abs(A.pos().z - A.zoneC('hold').z) < 16;
  const build = () => { if (built) return; built = true; A.zoneBuild('hold', 0x4a6a3a, 0x8a7a5a);
    [['forge', -7, -6, 0x5a4a4a], ['garden', 0, -8, 0x3a8a3a], ['kennel', 7, -6, 0x7a5a3a]].forEach(([k, dx, dz, c]) => A.zoneProp('hold', dx, dz, new THREE.BoxGeometry(3, 2.4, 3), c, { ext: 'holdbuild', name: `Hearthhold ${B[k].name}`, examine: 'Your building.', hold: k, radius: 2.6 }));
    A.zoneProp('hold', 0, 10, new THREE.CylinderGeometry(1, 1.2, 0.6, 8), 0x6ad0ff, { ext: 'holdboat', name: 'Boat home', examine: 'Back to the mainland.' }); };
  ctx.EXT.extTalk.holdbuild = { face: '🏰', talk: () => { A.open('hold'); return []; } };
  ctx.EXT.extTalk.holdboat = { face: '⛵', talk: () => { A.holdLeave(); return []; } };
  A.holdGo = () => { if (!H().owned) return A.log('Buy the island deed first (Ventures ✦ → Hold, 10,000 coins).', 'warn'); if (A.run || ctx.EXT.dungeonRun) return A.log('Finish what you are doing first.', 'warn');
    build(); if (A.pos().x > -700) player.instanceReturn = { x: A.pos().x, z: A.pos().z }; const c = A.zoneC('hold'); ctx.travelTo(c.x, c.z + 6); A.log('You sail to Hearthhold.', 'game'); };
  A.holdLeave = () => { const b = player.instanceReturn || { x: 0, z: 10 }; player.instanceReturn = null; ctx.travelTo(b.x, b.z); };
  A.holdBuy = () => { if (H().owned) return; if (player.gold < 10000) return A.log('The deed costs 10,000 coins.', 'warn'); player.gold -= 10000; H().owned = true; A.log('Hearthhold is yours!', 'skill'); A.dirty(); };
  A.holdUp = k => { const l = H().lv[k]; if (l >= 3) return; const [g, mats] = B[k].cost[l]; if (player.gold < g || Object.entries(mats).some(([i, n]) => A.count(i) < n)) return A.log(`Upgrade needs ${A.fmt(g)} coins and ${Object.entries(mats).map(([i, n]) => `${n} ${i}`).join(', ')} in your pack.`, 'warn');
    player.gold -= g; for (const [i, n] of Object.entries(mats)) A.take(i, n); H().lv[k]++; ctx.giveXP('Crafting', 500 * H().lv[k]); A.log(`${B[k].name} upgraded to level ${H().lv[k]}.`, 'skill'); A.dirty(); };
  A.holdForge = () => { const l = H().lv.forge; if (!l || H().forgeDay === today()) return; H().forgeDay = today(); A.give(l >= 3 ? 'Greater brutal graft' : 'Lesser keen graft'); if (l >= 2) A.give('Sigil tome'); A.log('You collect today\'s forge work.', 'loot'); A.dirty(); };
  A.holdGarden = () => { const l = H().lv.garden; if (!l) return; const now = Date.now(); if (now - H().garden < 2 * 3600000) return; H().garden = now; const n = [0, 6, 12, 20][l]; for (let i = 0; i < n; i++) A.give(HERBS[Math.floor(Math.random() * HERBS.length)]); A.log(`You harvest ${n} herbs.`, 'loot'); A.dirty(); };
  const crew = () => COMPANIONS.filter(c => player.companions && player.companions[c.id] && player.companions[c.id].recruited);
  A.holdSend = (id, kind) => { if (!TRIPS[kind] || H().trips[id] || !crew().some(c => c.id === id)) return; if (player.activeCompanion === id) return A.log('Dismiss them from your side first.', 'warn'); H().trips[id] = { kind, back: Date.now() + TRIPS[kind][1] * 60000 }; A.log(`${COMPANIONS.find(c => c.id === id).short} sets out: ${TRIPS[kind][0]}.`, 'game'); A.dirty(); };
  A.holdCollect = id => { const t = H().trips[id]; if (!t || Date.now() < t.back) return; delete H().trips[id]; const m = [1, 1.5, 2, 3][H().lv.kennel], k = TRIPS[t.kind][2]; const got = [];
    for (let i = 0; i < k; i++) { const [it, n] = LOOT[Math.floor(Math.random() * LOOT.length)]; const q = Math.round(n * m); A.give(it, q); got.push(`${q} ${it}`); } if (t.kind === 'long' && Math.random() < 0.3 && A.bonusDrop) A.bonusDrop({ level: 300 }, 'the expedition'); H().done++; A.log(`Expedition back: ${got.join(', ')}.`, 'loot'); A.dirty(); };
  A.every(20, () => { for (const [id, t] of Object.entries(H().trips)) if (Date.now() >= t.back && !t.told) { t.told = true; A.log(`${(COMPANIONS.find(c => c.id === id) || {}).short || 'A companion'} is back from an expedition (Ventures ✦ → Hold).`, 'game'); } });
  A.npc('hold', '🏰', 'Harbourmaster Wynn', 'An island sits empty off the west coast. 10,000 coins and it\'s yours to build on.', 'hold', [['Sail to Hearthhold.', () => { A.holdGo(); }]]);
  A.guide.push(['Hearthhold', 'Ventures ✦ → Hold (or Harbourmaster Wynn in Larkhaven). Buy the island deed (10,000), then upgrade a Forge (daily grafts and tomes), Garden (herbs every 2 h) and Kennel (bigger expedition hauls). Send recruited companions on 10, 30 or 60 minute expeditions.']);
  A.tab({ id: 'hold', icon: '🏰', name: 'Hold', render: () => { const h = H(); if (!h.owned) return '<h4>Hearthhold</h4><p>A private island off the west coast.</p><div class="row"><button data-a="buy">Buy the deed (10,000 coins)</button></div>';
    const bl = Object.entries(B).map(([k, b]) => { const l = h.lv[k], nx = b.cost[l]; return `<div style="margin:6px 0"><b>${b.icon} ${b.name}</b> level ${l}/3 <small>— ${b.desc(l)}</small>${nx ? `<div class="row"><button data-a="up" data-k="${k}" style="font-size:12px">⬆ ${A.fmt(nx[0])} + ${Object.entries(nx[1]).map(([i, n]) => `${n} ${i}`).join(', ')}</button></div>` : ''}</div>`; }).join('');
    const now = Date.now(), cr = crew().map(c => { const t = h.trips[c.id]; return `<div class="row" style="align-items:center;gap:4px;margin:3px 0"><span style="flex:1;font-size:13px">${c.face} ${c.short}${t ? ` — ${TRIPS[t.kind][0]}: ${now >= t.back ? '<b>back!</b>' : Math.ceil((t.back - now) / 60000) + ' min'}` : ''}</span>${t ? (now >= t.back ? `<button data-a="col" data-c="${c.id}">Collect</button>` : '') : Object.entries(TRIPS).map(([k, [n, m]]) => `<button data-a="send" data-c="${c.id}" data-t="${k}" style="font-size:11px">${m}m</button>`).join('')}</div>`; }).join('');
    return `<div class="row" style="gap:4px">${A.holdHome() ? '<button data-a="leave">⛵ Sail home</button>' : '<button data-a="go">⛵ Sail to Hearthhold</button>'}${h.lv.forge && h.forgeDay !== today() ? '<button data-a="forge">🔨 Collect forge</button>' : ''}${h.lv.garden && now - h.garden >= 7200000 ? '<button data-a="garden">🌿 Harvest</button>' : ''}</div>${bl}<h4>Expeditions (${h.done} done)</h4>${cr || '<small class="muted">Recruit companions first (Bonds).</small>'}`; },
    act: (a, d) => { ({ buy: A.holdBuy, go: () => { A.holdGo(); A.close(); }, leave: () => { A.holdLeave(); A.close(); }, forge: A.holdForge, garden: A.holdGarden })[a]?.(); if (a === 'up') A.holdUp(d.k); if (a === 'send') A.holdSend(d.c, d.t); if (a === 'col') A.holdCollect(d.c); } });
  A.vtests = A.vtests || {};
  A.vtests.hold = async (g, A) => { const gold = g.player.gold; g.player.gold = 1e6; A.holdBuy(); A.holdGo(); await new Promise(r => setTimeout(r, 4000)); const home = A.holdHome(); g.player.inventory.Logs = 40; A.holdUp('garden'); A.holdGarden();
    const herbs = HERBS.some(h => A.count(h)); A.holdLeave(); await new Promise(r => setTimeout(r, 500)); g.player.gold = gold; return home && herbs && A.pos().x > -700 || `h${home} g${herbs}`; };
}
