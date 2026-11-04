// Wayfarer's Ledger (adapted from Lost Ark's collectibles): boss souls, rare drops, lore stones and village trinkets.
// Progress is account-wide: it is kept in this save and in a separate browser record shared by every save on the device.
import * as THREE from 'three';
import { FRONTIER_UNIQUES } from '../items.js';
import { TOWNS, terrainHeight } from '../world.js';
import { VILLAGES } from '../villagedata.js';
import { NORM, obj, arr } from './state.js';

const LS = 'aerondel-ledger';
export const SOULS = [...FRONTIER_UNIQUES.map(u => u[0]), 'Captain Saltgrave', 'Stonehorn', 'Frostmaw', 'Ashwyrm'];
export const RARES = FRONTIER_UNIQUES.map(u => u[3]);
const LORE = [
  'The first Larkhaven bell was cast from a fallen star. It still rings a little sharp.',
  'Emberfold\'s forges were lit with a coal that has never once gone out.',
  'Saltreach sailors leave one fish on the dock each dawn "for the one below".',
  'Highcrest was a watchtower long before it was a town; its stairs still count to 99.',
  'Whitecairn\'s cairns are graves of travellers who knew the road too well.',
  'The tundra wolves follow the old frost lines, not the scent of prey.',
  'Skyreach lodges keep a candle lit for climbers who never came down.',
  'The Mirage Well shows each traveller a different city at the bottom.',
  'Fen-folk say the Drowned Chapel bell rings when the water is about to rise.',
  'Vexmar was a knight once. The eclipse took his name before it took his blade.',
  'Goblin totems are not gods. They are ledgers of grudges, carved in order.',
  'Elven wards hum at a pitch only grief can hear.'];
export const LORE_IDS = LORE.map((_, i) => 'lore' + i);
export const TRINKETS = VILLAGES.map(v => v.id);
const ALL = () => SOULS.length + RARES.length + LORE.length + TRINKETS.length;
NORM.ledger = v => { v = obj(v); const pick = (a, ok) => [...new Set(arr(a).filter(x => ok.includes(x)))]; return { souls: pick(v.souls, SOULS), rares: pick(v.rares, RARES), lore: pick(v.lore, LORE_IDS), trinkets: pick(v.trinkets, TRINKETS) }; };
const readLS = () => { try { return NORM.ledger(JSON.parse(localStorage.getItem(LS) || 'null')); } catch (e) { return NORM.ledger(null); } };

export default function ledger(A) {
  const { ctx, player } = A, Lg = () => A.S('ledger');
  // Merge the device-wide record into this save (and back), so collections count across all your characters.
  const sync = () => { const a = Lg(), b = readLS(); for (const k of ['souls', 'rares', 'lore', 'trinkets']) a[k] = [...new Set([...a[k], ...b[k]])]; try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) { /* private mode */ } };
  sync();
  A.ledgerCount = () => { const a = Lg(); return a.souls.length + a.rares.length + a.lore.length + a.trinkets.length; };
  A.ledgerTier = () => Math.floor(A.ledgerCount() / 5);
  A.mods.dmg.push(() => A.ledgerTier() * 0.01);
  A.mods.dr.push(() => A.ledgerTier() * 0.01);
  A.mods.xp.push(() => A.ledgerTier() * 0.02);
  const add = (k, id, label) => { const a = Lg(); if (a[k].includes(id)) return false; const t0 = A.ledgerTier(); a[k].push(id); sync();
    A.log(`Wayfarer's Ledger: ${label} recorded (${A.ledgerCount()}/${ALL()}).`, 'loot');
    if (A.ledgerTier() > t0) A.log(`Ledger milestone ${A.ledgerTier()}: +1% damage, 1% less damage taken and +2% combat XP, on every character.`, 'skill'); A.dirty(); return true; };
  A.ledgerAdd = add;
  ctx.EXT.extKill.push(mon => { const s = SOULS.find(n => mon.name === n || mon.title === n || (mon.colossus && (mon.name || '').startsWith(n))); if (s) add('souls', s, `${s}'s soul`); });
  A.every(10, () => { for (const r of RARES) if (!Lg().rares.includes(r) && A.owns(r)) add('rares', r, r);
    const p = A.pos(); for (const V of VILLAGES) if (!Lg().trinkets.includes(V.id) && Math.hypot(p.x - V.x, p.z - V.z) < V.r) add('trinkets', V.id, `${V.name} trinket`); });
  // Lore stones beside towns and camps.
  const T = Object.entries(TOWNS).slice(0, LORE.length), geo = new THREE.BoxGeometry(0.5, 1.4, 0.3), mat = new THREE.MeshLambertMaterial({ color: 0x8a8a9a, emissive: 0x1a2a4a });
  A.loreStones = T.map(([town, t], i) => { const x = t.x + 7, z = t.z + 5, y = terrainHeight(x, z); const m = new THREE.Mesh(geo, mat); m.position.set(x, y + 0.7, z); m.rotation.y = i; m.name = 'lore-stone'; ctx.scene.add(m);
    const ent = { mesh: m, alive: true, x, z, radius: 1.4, type: 'hearth', ext: 'lorestone', loreId: LORE_IDS[i], name: 'Lore stone', examine: `Old writing near ${town}.` };
    m.userData.entity = ent; ctx.nodes.push(ent); ctx.pickables.push(m); return ent; });
  ctx.EXT.extTalk.lorestone = { face: '🪨', talk: ent => { const i = LORE_IDS.indexOf(ent.loreId); add('lore', ent.loreId, 'a lore stone'); return [['npc', `The stone reads: "${LORE[i]}"`]]; } };
  A.guide.push(['Wayfarer\'s Ledger', 'Ventures ✦ → Ledger. Collect boss souls (frontier bosses, Saltgrave, the Colossi), frontier uniques, 12 lore stones beside towns and camps, and a trinket from each village. Every 5 entries: +1% damage, 1% less damage taken, +2% combat XP, shared by every save on this device.']);
  const list = (title, all, got, nm = x => x) => `<h4>${title} ${got.length}/${all.length}</h4><div class="grid">${all.map(x => `<span style="flex:1 0 45%;font-size:12px" class="${got.includes(x) ? '' : 'muted'}">${got.includes(x) ? '✔' : '○'} ${A.esc(nm(x))}</span>`).join('')}</div>`;
  A.tab({ id: 'ledger', icon: '📖', name: 'Ledger', render: () => { const a = Lg(), n = A.ledgerCount();
    return `<h4>${n}/${ALL()} entries · milestone ${A.ledgerTier()}</h4><div class="bar"><i style="width:${n / ALL() * 100}%"></i></div><p><small>Now: +${A.ledgerTier()}% damage, ${A.ledgerTier()}% less damage taken, +${A.ledgerTier() * 2}% combat XP. Next milestone at ${(A.ledgerTier() + 1) * 5}.</small></p>` +
      list('Boss souls', SOULS, a.souls) + list('Rare drops', RARES, a.rares) + list('Lore stones', LORE_IDS, a.lore, x => `Stone near ${T[LORE_IDS.indexOf(x)][0]}`) + list('Village trinkets', TRINKETS, a.trinkets, x => VILLAGES.find(v => v.id === x).name); } });
  A.vtests = A.vtests || {};
  A.vtests.ledger = async (g, A) => { const n0 = A.ledgerCount(); g.EXT.extTalk.lorestone.talk(A.loreStones[0]); g.EXT.extKill.forEach(f => f({ name: 'Cinder Warden' }, 0));
    const ls = JSON.parse(localStorage.getItem('aerondel-ledger')); return A.ledgerCount() >= n0 + 2 && ls.lore.includes('lore0') && A.loreStones.length === 12; };
}
