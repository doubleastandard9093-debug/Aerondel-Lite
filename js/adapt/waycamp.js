// Waycamp: one portable camp pack you place in the wild and pack up again.
// Not Freeframe, not a town house, not the farm. Tiny cap. No Holdraids. Small Construction XP.
import { ITEMS } from '../items.js';
import { PLOT } from './freeframe.js';
import { TOWNS } from '../world.js';
import { NORM, obj, num } from './state.js';

export const CAMP_ITEM = 'Waycamp kit';
export const TOWN_R = 16, CAMP_R = 4, PLACE_XP = 15, CRAFT_XP = 40;
export const PIECE_CAP_LOW = 8, PIECE_CAP_HIGH = 12;
export const MAIN_TOWNS = ['Larkhaven', 'Emberfold', 'Saltreach', 'Highcrest', 'Whitecairn'];
export const BASE_PIECES = ['bed', 'chest', 'bench', 'fire', 'lantern'];
export const EXTRA = { stool: { name: 'Stool', logs: 1, xp: 5 }, crate: { name: 'Crate', logs: 1, xp: 5 }, rack: { name: 'Rack', logs: 1, xp: 5 } };

NORM.camp = v => {
  v = obj(v);
  const chest = {};
  for (const [it, n] of Object.entries(obj(v.chest))) {
    const q = Math.max(0, Math.floor(num(n, 0, 0, 1e6)));
    if (q > 0 && typeof it === 'string') chest[it] = q;
  }
  let placed = null;
  if (v.placed && typeof v.placed === 'object' && Number.isFinite(+v.placed.x) && Number.isFinite(+v.placed.z))
    placed = { x: +v.placed.x, z: +v.placed.z, rot: num(v.placed.rot, 0) };
  const pieces = Array.isArray(v.pieces) ? v.pieces.filter(p => typeof p === 'string').slice(0, PIECE_CAP_HIGH) : BASE_PIECES.slice();
  return { owned: !!v.owned, placed, chest, pieces: pieces.length ? pieces : BASE_PIECES.slice() };
};

export default function waycamp(A) {
  const { player, ctx } = A;
  const S = () => A.S('camp');
  const isLow = () => !!(ctx.gfxQ === 'low' || (player.settings && player.settings.gfx === 'low'));
  A.campCap = () => (isLow() ? PIECE_CAP_LOW : PIECE_CAP_HIGH);
  let meshes = [], stations = [];

  const holdPad = (x, z) => {
    const hz = A.zoneC && A.zoneC('hold');
    return !!(hz && Math.abs(x + 1000) < 20 && Math.abs(z - hz.z) < 16);
  };
  A.campForbidden = (x, z) => {
    for (const n of MAIN_TOWNS) {
      const t = TOWNS[n]; if (t && Math.hypot(x - t.x, z - t.z) < TOWN_R) return n;
    }
    if (holdPad(x, z)) return 'Greenstead';
    if (Math.abs(x - PLOT.x) <= PLOT.half && Math.abs(z - PLOT.z) <= PLOT.half) return 'Claimridge';
    return null;
  };
  A.campHere = () => {
    const p = S().placed; if (!p) return false;
    const pos = A.pos && A.pos(); if (!pos) return false;
    return Math.hypot(pos.x - p.x, pos.z - p.z) < CAMP_R + 0.5;
  };

  const clearWorld = () => {
    for (const m of meshes) { try { if (m.parent) m.parent.remove(m); if (ctx.scene) ctx.scene.remove(m); } catch (e) { /* already gone */ } }
    meshes = [];
    if (ctx.nodes) for (const s of stations) { const i = ctx.nodes.indexOf(s); if (i >= 0) ctx.nodes.splice(i, 1); }
    stations = [];
  };
  const rebuild = () => {
    clearWorld();
    const p = S().placed; if (!p || typeof THREE === 'undefined' || !ctx.scene) return;
    const y = (ctx.terrainHeight ? ctx.terrainHeight(p.x, p.z) : 0) || 0;
    const g = new THREE.Group();
    const box = (dx, dz, w, h, d, color) => {
      const mat = new THREE.MeshBasicMaterial({ color });
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(dx, h / 2, dz);
      m.castShadow = false; m.receiveShadow = false;
      g.add(m);
    };
    // Cheap box props only — no physics, no extra lights.
    if (S().pieces.includes('bed')) box(-1.1, 0, 1.4, 0.35, 0.8, 0x6a4a2a);
    if (S().pieces.includes('chest')) box(1.1, 0, 0.7, 0.5, 0.5, 0x5a3a1a);
    if (S().pieces.includes('bench')) box(0, 1.1, 0.9, 0.5, 0.5, 0x4a4a4a);
    if (S().pieces.includes('fire')) box(0, -1.1, 0.4, 0.35, 0.4, 0xc06020);
    if (S().pieces.includes('lantern')) box(0.2, 0.2, 0.15, 0.7, 0.15, 0xd0c060);
    if (S().pieces.includes('stool')) box(-0.6, 1.0, 0.35, 0.4, 0.35, 0x7a5a3a);
    if (S().pieces.includes('crate')) box(0.8, 1.0, 0.45, 0.45, 0.45, 0x8a6a3a);
    if (S().pieces.includes('rack')) box(-1.2, -0.8, 0.2, 0.9, 0.6, 0x5a4a2a);
    g.position.set(p.x, y, p.z);
    ctx.scene.add(g);
    meshes.push(g);
    const addSt = (kind, name, dx, dz) => {
      const s = { type: 'station', kind, name, alive: true, x: p.x + dx, z: p.z + dz, radius: 0.6, camp: true };
      if (ctx.nodes) ctx.nodes.push(s);
      stations.push(s);
    };
    if (S().pieces.includes('bench')) addSt('anvil', 'Waycamp bench', 0, 1.1);
    if (S().pieces.includes('fire')) addSt('range', 'Waycamp fire', 0, -1.1);
  };
  A.campRebuild = rebuild;

  A.campCraft = () => {
    const s = S();
    if (s.owned && (A.count(CAMP_ITEM) || s.placed)) return A.log('You already have a Waycamp kit.', 'game'), false;
    if (A.lvl('Construction') < 8) return A.log('You need Construction 8 to craft a Waycamp kit.', 'warn'), false;
    if (A.count('Logs') < 8 || A.count('Iron bar') < 2) return A.log('You need 8 Logs and 2 Iron bars.', 'warn'), false;
    A.take('Logs', 8); A.take('Iron bar', 2);
    A.give(CAMP_ITEM, 1);
    s.owned = true; if (!s.pieces.length) s.pieces = BASE_PIECES.slice();
    if (ctx.giveXP) ctx.giveXP('Construction', CRAFT_XP);
    A.log('You pack a Waycamp kit. Place it in the wild — not in a town, not on Greenstead, not on Claimridge.', 'skill');
    A.dirty(); return true;
  };
  A.campPlaceAt = (x, z) => {
    const s = S();
    if (s.placed) return A.log('You already have a camp down. Pack it up first.', 'warn'), false;
    if (!s.owned && A.count(CAMP_ITEM) < 1) return A.log('Craft a Waycamp kit first.', 'warn'), false;
    if (!s.owned && A.count(CAMP_ITEM) >= 1) s.owned = true;
    if (A.count(CAMP_ITEM) < 1) return A.log('The Waycamp kit is not in your pack.', 'warn'), false;
    const why = A.campForbidden(x, z);
    if (why) return A.log(`You cannot place a Waycamp in ${why}. Find a spot in the wild.`, 'warn'), false;
    if (!A.take(CAMP_ITEM, 1)) return false;
    s.placed = { x, z, rot: 0 };
    if (!s.pieces.length) s.pieces = BASE_PIECES.slice();
    if (ctx.giveXP) ctx.giveXP('Construction', PLACE_XP);
    A.log(`You set down your Waycamp. Pack it up from Ventures ✦ → Waycamp when you want to move it. +${PLACE_XP} Construction XP.`, 'skill');
    rebuild(); A.dirty(); return true;
  };
  A.campPlace = () => {
    const p = A.pos && A.pos(); if (!p) return A.log('Move to a clear wild spot first.', 'warn'), false;
    return A.campPlaceAt(p.x, p.z);
  };
  A.campPack = () => {
    const s = S(); if (!s.placed) return A.log('No camp is down.', 'game'), false;
    s.placed = null;
    // Extra décor returns a log; the base kit pieces stay packed in the kit.
    let extras = 0;
    s.pieces = s.pieces.filter(p => { if (BASE_PIECES.includes(p)) return true; extras++; return false; });
    if (!s.pieces.length) s.pieces = BASE_PIECES.slice();
    if (extras) A.give('Logs', extras);
    A.give(CAMP_ITEM, 1);
    clearWorld();
    A.log('You pack the Waycamp. The kit is in your pack; the chest is still packed with it.', 'game');
    A.dirty(); return true;
  };
  A.campRest = () => {
    const s = S(); if (!s.placed) return A.log('Place the camp first.', 'warn'), false;
    if (!A.campHere()) return A.log('Stand at your Waycamp to rest.', 'warn'), false;
    if (!s.pieces.includes('bed')) return A.log('The camp has no bed.', 'warn'), false;
    const heal = Math.max(1, Math.round((player.maxHp || 10) * 0.2));
    player.hp = Math.min(player.maxHp, (player.hp || 0) + heal);
    player.runEnergy = 100;
    A.log(`You rest at your Waycamp. (+${heal} hitpoints, run energy restored.)`, 'game'); A.dirty(); return true;
  };
  A.campDeposit = (item, n = 1) => {
    const s = S(); if (!s.placed && !s.owned) return false;
    n = Math.max(1, Math.floor(n));
    if (!ITEMS[item] || A.count(item) < n) return A.log('You do not have that.', 'warn'), false;
    if (!A.take(item, n)) return false;
    s.chest[item] = (s.chest[item] || 0) + n;
    A.log(`You put ${n} ${item} in the Waycamp chest.`, 'game'); A.dirty(); return true;
  };
  A.campTake = (item, n = 1) => {
    const s = S(); n = Math.max(1, Math.floor(n));
    if ((s.chest[item] || 0) < n) return A.log('The chest does not have that many.', 'warn'), false;
    s.chest[item] -= n; if (s.chest[item] <= 0) delete s.chest[item];
    A.give(item, n); A.dirty(); return true;
  };
  A.campAdd = kind => {
    const def = EXTRA[kind]; if (!def) return false;
    const s = S(); if (!s.placed || !A.campHere()) return A.log('Stand at your placed camp to add a piece.', 'warn'), false;
    if (s.pieces.length >= A.campCap()) return A.log(`The camp is at its cap (${A.campCap()} pieces).`, 'warn'), false;
    if (A.count('Logs') < def.logs) return A.log(`You need ${def.logs} Logs.`, 'warn'), false;
    A.take('Logs', def.logs);
    s.pieces.push(kind);
    if (ctx.giveXP) ctx.giveXP('Construction', def.xp);
    A.log(`You add a ${def.name} to the camp. +${def.xp} Construction XP.`, 'skill');
    rebuild(); A.dirty(); return true;
  };

  // Freight can treat a owned Waycamp as one more home (a chest, not a second plot).
  if (A.freightHomes) {
    const prevH = A.freightHomes, prevO = A.freightOwned;
    A.freightHomes = () => [...prevH(), ...(S().owned ? [{ id: 'camp', name: 'Waycamp', kind: 'camp' }] : [])];
  }
  const prevOwned = A.freightOwned;
  if (prevOwned) A.freightOwned = id => (id === 'camp' ? !!S().owned : prevOwned(id));

  A.npc('waycamp', '⛺', 'Campwright Noll', 'I pack a tiny camp you can set down in the wild and pack up again. One at a time. Not in a town, not on the farm, not on Claimridge. Freeframe stays the Construction grind, and raids never come for a Waycamp.', 'camp');
  A.guide.push(['Waycamp', 'Ventures ✦ → Waycamp, or talk to Campwright Noll in Larkhaven. Craft a Waycamp kit (Construction 8) and place it in the wild. It has a bed, a small chest, a workbench and a fire. Pack it up to move it. One camp at a time. Not in a town, not on Greenstead, not on Claimridge. No Holdraids. Construction XP is small — Freeframe is still the grind.']);
  A.quick(() => A.campHere() ? [['campack', 'Pack camp', 'Pack up your Waycamp']] : (A.count(CAMP_ITEM) ? [['camplace', 'Place camp', 'Set down your Waycamp in the wild']] : []));
  A.onQuick('camplace', () => A.campPlace());
  A.onQuick('campack', () => A.campPack());
  A.every && A.every(20, () => { if (S().placed && !meshes.length) rebuild(); });
  A.onReady.push(() => { if (S().placed) rebuild(); });

  A.tab({ id: 'camp', icon: '⛺', name: 'Waycamp', render: () => {
    const s = S(), cap = A.campCap();
    const here = A.campHere();
    let body = `<h4>Waycamp</h4><p>One portable camp. Place it in the wild and pack it up to move. Not Freeframe, not a town house, not the farm. Raids never come for it. Construction XP is small.</p>`;
    if (!s.owned && A.count(CAMP_ITEM) < 1) body += `<div class="row"><button data-a="craft">Craft a Waycamp kit (8 Logs, 2 Iron bars, Construction 8)</button></div>`;
    else if (!s.placed) body += `<p><small>You have a packed kit${A.count(CAMP_ITEM) ? '' : ' (it is not in your pack — check the bank)'}.</small></p><div class="row"><button data-a="place">Place it here</button></div>`;
    else body += `<p>Camp is down at ${s.placed.x.toFixed(0)}, ${s.placed.z.toFixed(0)}. ${here ? 'You are here.' : 'Walk over to use the bed and chest.'} Pieces ${s.pieces.length}/${cap}.</p>
      <div class="row">${here ? '<button data-a="rest">Rest</button>' : ''}<button data-a="pack">Pack up</button></div>`;
    if (s.owned) {
      const ch = Object.entries(s.chest).map(([it, n]) => `<div class="row"><div>${A.esc(it)} ×${n}</div>${here || !s.placed ? `<button data-a="take" data-k="${A.esc(it)}">Take 1</button>` : ''}</div>`).join('') || '<small class="muted">Chest is empty.</small>';
      body += `<h4>Chest</h4>${ch}`;
      if (here) {
        const pack = Object.keys(player.inventory || {}).filter(it => ITEMS[it] && player.inventory[it] > 0).slice(0, 12);
        body += `<div>${pack.map(it => `<button data-a="put" data-k="${A.esc(it)}">Deposit ${A.esc(it)}</button>`).join(' ')}</div>`;
        body += `<h4>Add a piece</h4>${Object.entries(EXTRA).map(([k, d]) => `<button data-a="add" data-k="${k}">${d.name} (1 Log)</button>`).join(' ')}`;
      }
    }
    return body;
  }, act: (a, d) => {
    if (a === 'craft') A.campCraft();
    if (a === 'place') A.campPlace();
    if (a === 'pack') A.campPack();
    if (a === 'rest') A.campRest();
    if (a === 'put') A.campDeposit(d.k, 1);
    if (a === 'take') A.campTake(d.k, 1);
    if (a === 'add') A.campAdd(d.k);
  } });

  A.vtests = A.vtests || {};
  A.vtests.waycamp = async (g, A) => {
    const P = g.player, s = A.S('camp');
    const snap = { owned: s.owned, placed: s.placed && { ...s.placed }, chest: { ...s.chest }, pieces: s.pieces.slice(), logs: A.count('Logs'), bars: A.count('Iron bar'), kit: A.count(CAMP_ITEM) };
    const frameN = (A.framePieces && A.framePieces().length) || 0;
    P.inventory['Logs'] = (P.inventory['Logs'] || 0) + 20;
    P.inventory['Iron bar'] = (P.inventory['Iron bar'] || 0) + 4;
    g.skills.Construction.level = Math.max(g.skills.Construction.level || 1, 8);
    if (!s.owned && A.count(CAMP_ITEM) < 1 && !A.campCraft()) return 'craft';
    if (s.placed) A.campPack();
    if (A.count(CAMP_ITEM) < 1) { P.inventory[CAMP_ITEM] = 1; s.owned = true; }
    if (A.campPlaceAt(0, 0)) return 'placed in Larkhaven';
    if (A.campPlaceAt(PLOT.x, PLOT.z)) return 'placed on Claimridge';
    const hz = A.zoneC && A.zoneC('hold');
    if (hz && A.campPlaceAt(-1000, hz.z)) return 'placed on Greenstead';
    if (!A.campPlaceAt(40, 40)) return 'wild place';
    if (!s.placed || s.placed.x !== 40) return 'not down';
    // Rest requires being at the camp; teleport the player mesh if present.
    if (g.pm && g.pm.mesh && g.pm.mesh.position) g.pm.mesh.position.set(40, g.pm.mesh.position.y || 0, 40);
    const hp0 = P.hp;
    const rested = A.campRest();
    P.inventory['Logs'] = (P.inventory['Logs'] || 0) + 2;
    if (!A.campDeposit('Logs', 2)) return 'deposit';
    const held = s.chest.Logs || 0;
    if (A.raidStart) {
      const was = !!s.placed && (s.chest.Logs || 0);
      A.raidStart({ force: true, silent: true });
      if (A.raidEnd) A.raidEnd(true);
      if (!s.placed || (s.chest.Logs || 0) !== was) return 'raid hit camp';
    }
    if ((A.framePieces && A.framePieces().length) !== frameN) return 'freeframe pieces changed';
    if (!A.campPack()) return 'pack';
    if (s.placed) return 'still down';
    if (A.count(CAMP_ITEM) < 1) return 'kit not returned';
    if ((s.chest.Logs || 0) !== held) return 'chest lost on pack';
    if (!A.campPlaceAt(35, 50)) return 'replace';
    A.campPack();
    // restore
    s.owned = snap.owned; s.placed = snap.placed; s.chest = snap.chest; s.pieces = snap.pieces;
    if (A.campRebuild) A.campRebuild();
    void hp0; void rested;
    return true;
  };
}
