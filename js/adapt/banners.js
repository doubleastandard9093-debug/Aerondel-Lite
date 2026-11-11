// Crossed Banners: a late deed for one faction can cool another. Wary banners refuse writs
// and hold back some specialty stock, but Larkhaven, the bank, general starter stalls and
// the Wanderer's Saga are never locked. Standing numbers are unchanged. Mend with a small gift.
import { NORM, obj, arr, num } from './state.js';
import { FACTIONS, factionById, factionNear, tierOf, repOf, addRep } from '../standing.js';
import { TOWNS } from '../world.js';
import { setBannerStockHook } from '../gameplay.js';

export const MEND_COST = 250;
export const TRUSTED = 2; // tier index for Trusted
export const SPECIALTY_PRICE = 200;
export const PAIRS = { watch: 'mariners', mariners: 'watch', circle: 'lantern', lantern: 'circle' };
export const SHOP_FACTION = {
  emberfold: 'watch',
  general2: 'mariners', magic: 'mariners',
  weapons: 'circle', general3: 'circle', runes: 'circle',
  armour: 'lantern', herb2: 'lantern'
};
export const SAFE_SHOPS = ['shop', 'tools', 'apothecary', 'magic0', 'herb'];

NORM.banners = v => {
  v = obj(v);
  const crosses = arr(v.crosses).filter(x => typeof x === 'string').slice(0, 16);
  const wary = {};
  for (const [k, val] of Object.entries(obj(v.wary))) if (FACTIONS.some(f => f.id === k) && val) wary[k] = 1;
  return { crosses, wary };
};

export function nearestTown(x, z) {
  let best = 'Larkhaven', bd = Infinity;
  for (const [n, t] of Object.entries(TOWNS)) {
    const d = Math.hypot((t.x || 0) - x, (t.z || 0) - z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
export function isLarkhaven(x, z) { return nearestTown(x, z) === 'Larkhaven'; }
export function crossId(up, down) { return up + '_' + down; }

export default function banners(A) {
  const { player } = A;
  const S = () => A.S('banners');
  A.bannerWary = fid => !!(S().wary[fid]);
  A.bannerBlocksWrit = fid => A.bannerWary(fid);
  A.bannerOnWrit = fid => {
    const other = PAIRS[fid]; if (!other) return false;
    if (tierOf(repOf(player, fid)) < TRUSTED) return false;
    const id = crossId(fid, other);
    const st = S();
    if (st.crosses.includes(id)) return false;
    st.crosses.push(id);
    st.wary[other] = 1;
    const a = factionById(fid), b = factionById(other);
    A.log(`Your work for the ${a.name} has cooled the ${b.name}. They are Wary: their writs will not pay, and some specialty stock is held back, until you mend this (250 coins). Larkhaven, the bank and the Saga stay open.`, 'warn');
    A.dirty();
    return true;
  };
  A.bannerMend = fid => {
    const st = S();
    if (!st.wary[fid]) { A.log('That banner is not Wary.', 'game'); return false; }
    if (player.gold < MEND_COST) { A.log(`Mending a banner costs ${MEND_COST} coins.`, 'warn'); return false; }
    player.gold -= MEND_COST;
    delete st.wary[fid];
    A.log(`You mend your standing with the ${factionById(fid).name}. Writs and specialty stock are open again.`, 'loot');
    A.dirty();
    return true;
  };
  A.bannerGreet = ent => {
    if (!ent || ent.x == null) return null;
    if (isLarkhaven(ent.x, ent.z)) return null;
    const f = factionNear(ent.x, ent.z); if (!f || !A.bannerWary(f.id)) return null;
    return `The ${f.name} are Wary of you. Everyday goods are still for sale, but some specialty stock is held back, and their writs will not pay until you mend this.`;
  };
  A.bannerWrap = (ent, script) => {
    const line = A.bannerGreet(ent);
    if (!line || !script) return script;
    return [['npc', line], ...script];
  };
  A.bannerWritLine = () => {
    const names = FACTIONS.filter(f => A.bannerWary(f.id)).map(f => f.name);
    if (!names.length) return null;
    return `Wary banners will not honor writs until you mend them (${names.join(', ')}). Larkhaven services stay open.`;
  };
  A.bannerHidesStock = (entry, shopId) => {
    if (!entry || SAFE_SHOPS.includes(shopId)) return false;
    const fac = SHOP_FACTION[shopId]; if (!fac || !A.bannerWary(fac)) return false;
    return (entry.price || 0) >= SPECIALTY_PRICE;
  };
  setBannerStockHook((entry, _player, shopId) => !A.bannerHidesStock(entry, shopId));

  A.guide.push(['Crossed Banners', 'A late writ for one banner can cool another. Wary banners refuse writs and hold back specialty stock. Larkhaven, the bank, everyday stalls and the Wanderer\'s Saga are never locked. Mend a Wary banner for 250 coins in Bonds (B) → Standing, Ventures ✦ → Banners, or at Quartermaster Odile in Whitecairn.']);
  A.tab({ id: 'banners', icon: '🚩', name: 'Banners', render: () => {
    const st = S();
    const rows = FACTIONS.map(f => {
      const r = repOf(player, f.id), wary = A.bannerWary(f.id);
      return `<div class="row"><div><b>${f.icon} ${A.esc(f.name)}</b> · ${A.esc(tierOf(r) ? '' : '')}${A.esc(['Unknown','Friendly','Trusted','Honoured','Exalted'][tierOf(r)] || '')}<br><small>${wary ? 'Wary: writs unpaid, some specialty stock held back.' : 'In good courtesy.'}</small></div>${wary ? `<button data-a="mend" data-f="${f.id}">Mend (${MEND_COST}c)</button>` : ''}</div>`;
    }).join('');
    const crosses = st.crosses.length ? `<p><small>Crossed deeds: ${st.crosses.map(A.esc).join(', ')}.</small></p>` : '<p><small>No crossed deeds yet. Completing a writ for a Trusted (or higher) banner can cool its opposite.</small></p>';
    return `<h4>Crossed Banners</h4><p>Standing still rises as before. A late deed for one banner can make another Wary. Larkhaven, the bank and the Saga stay open. Mend a Wary banner for ${MEND_COST} coins.</p>${rows}${crosses}`;
  }, act: (a, d) => { if (a === 'mend' && d.f) A.bannerMend(d.f); } });

  A.vtests = A.vtests || {};
  A.vtests.banners = async (g, A) => {
    const P = g.player, st = A.S('banners');
    // Old / current saves must not start Wary.
    const clean = !Object.keys(st.wary || {}).length;
    // Seed Trusted Watch without being Wary, fire a writ cross once.
    st.crosses = []; st.wary = {};
    P.rep = P.rep || {};
    P.rep.watch = Math.max(P.rep.watch || 0, 300); // Trusted
    const gold0 = P.gold;
    const fired = A.bannerOnWrit('watch');
    if (!fired || !A.bannerWary('mariners') || A.bannerWary('watch')) return 'cross';
    if (!A.bannerBlocksWrit('mariners') || A.bannerBlocksWrit('watch')) return 'writ block';
    // Second time does not re-apply or also wary Watch.
    const again = A.bannerOnWrit('watch');
    if (again) return 'double cross';
    // Specialty stock in Saltreach hides; Larkhaven general stall does not.
    const hidden = A.bannerHidesStock({ item: 'Steel cutlass', price: 420 }, 'general2');
    const cheapOk = !A.bannerHidesStock({ item: 'Spade', price: 8 }, 'general2');
    const larkOk = !A.bannerHidesStock({ item: 'Steel sword', price: 500 }, 'shop');
    // Greet: Saltreach is short, Larkhaven is not, even if Watch is forced Wary later.
    const salt = A.bannerGreet({ x: -80, z: 60 });
    const lark = A.bannerGreet({ x: 0, z: 0 });
    if (!salt || lark) return 'greet ' + !!salt + ' ' + !!lark;
    // Mend with enough gold; not enough gold fails and stays Wary.
    P.gold = 10;
    if (A.bannerMend('mariners') || !A.bannerWary('mariners')) return 'mend too cheap';
    P.gold = 1000;
    if (!A.bannerMend('mariners') || A.bannerWary('mariners') || P.gold !== 1000 - MEND_COST) return 'mend';
    // Exalted numbers are not wiped by a cross (re-fire on a fresh opposite).
    P.rep.circle = 2000;
    st.crosses = []; st.wary = {};
    A.bannerOnWrit('circle');
    const stillExalted = repOf(P, 'circle') >= 1500 && A.bannerWary('lantern');
    st.crosses = []; st.wary = {};
    P.gold = gold0;
    return !!(clean && hidden && cheapOk && larkOk && stillExalted);
  };
}
