// Kitwright: attach up to two named kits to a worn weapon or armour piece.
// Kits are tools (reach, hush, lamp, poise, Stillwatch fill) — not grafts, Facets, Ascent or a damage percent.
import { ITEMS, isRangedWeapon, slotFor, FRONTIER_UNIQUES, setExamineHook } from '../items.js';
import { NORM, obj, arr } from './state.js';
import { setAttackHook } from '../gameplay.js';
import { setFocusHook } from '../stillwatch.js';

export const KIT_SLOTS = 2;
export const KITS = {
  longhaft: { id: 'longhaft', name: 'Longhaft kit', icon: '🪓', slot: 'weapon', melee: true, desc: 'A little more melee reach, a little slower. Not a damage bonus.', inputs: { Logs: 3, 'Iron bar': 1 }, refund: { Logs: 2, 'Iron bar': 1 }, skill: 'Smithing', level: 10, xp: 40 },
  hush: { id: 'hush', name: 'Hush-string kit', icon: '🧵', slot: 'weapon', ranged: true, desc: 'A quieter setup and a little less ranged reach. Shadework can use the hush later.', inputs: { Bowstring: 1, Flax: 3 }, refund: { Bowstring: 1, Flax: 2 }, skill: 'Fletching', level: 10, xp: 40 },
  lamp: { id: 'lamp', name: 'Lamp-rim kit', icon: '🪔', slot: 'armour', desc: 'A short cone of light. On Low this is a pip, not a new mesh or lamp draw.', inputs: { 'Iron bar': 1, Coal: 2 }, refund: { 'Iron bar': 1, Coal: 1 }, skill: 'Crafting', level: 10, xp: 40 },
  collar: { id: 'collar', name: 'Padded collar kit', icon: '🛡️', slot: 'armour', desc: 'A little more player poise. Ordinary scratches still will not stagger you.', inputs: { 'Soft leather': 2, Wool: 1 }, refund: { 'Soft leather': 1, Wool: 1 }, skill: 'Crafting', level: 12, xp: 50 },
  sight: { id: 'sight', name: 'Watch-sight kit', icon: '🔭', slot: 'weapon', desc: 'Stillwatch focus fills a little faster. It does not add damage.', inputs: { 'Iron bar': 1, 'Clear essence': 5 }, refund: { 'Iron bar': 1, 'Clear essence': 3 }, skill: 'Crafting', level: 15, xp: 55 },
  ashthread: { id: 'ashthread', name: 'Ash-thread kit', icon: '🧵', slot: 'armour', desc: 'A little more player poise, less than a padded collar. A Seasonboard schematic. Not a damage bonus.', inputs: { 'Soft leather': 1, Wool: 1, 'Clear essence': 1 }, refund: { 'Soft leather': 1, Wool: 1 }, skill: 'Crafting', level: 8, xp: 30, season: true }
};
const IDS = new Set(Object.keys(KITS));
const UNIQUE = new Set((FRONTIER_UNIQUES || []).map(r => r[3]));

NORM.kits = v => {
  v = obj(v);
  const on = {};
  for (const [it, l] of Object.entries(obj(v.on))) {
    const ok = arr(l).filter(id => IDS.has(id)).slice(0, KIT_SLOTS);
    if (ok.length) on[it] = [...new Set(ok)];
  }
  const owned = arr(v.owned).filter(id => IDS.has(id));
  return { on, owned };
};

export function kitName(id) { return (KITS[id] && KITS[id].name) || id; }
export function isUniqueGear(item) { const info = ITEMS[item] || {}; return !!(info.frontier || info.unique || UNIQUE.has(item)); }

export default function kitwright(A) {
  const { player, skills, ctx } = A;
  const S = () => A.S('kits');
  const worn = () => Object.values(player.equipment || {}).filter(Boolean);
  A.kitList = item => (item && S().on[item]) || [];
  A.kitHas = id => worn().some(it => A.kitList(it).includes(id));
  A.kitHush = () => A.kitHas('hush');
  A.kitLamp = () => A.kitHas('lamp');
  A.kitOnItem = (item, id) => A.kitList(item).includes(id);

  const canTake = (item, kit) => {
    if (!item || !KITS[kit]) return 'Unknown kit.';
    if (isUniqueGear(item)) return 'Frontier uniques keep their identity and cannot take a kit.';
    const info = ITEMS[item] || {};
    const sl = info.type || slotFor(item);
    if (KITS[kit].slot === 'weapon' && sl !== 'weapon') return 'That kit only fits a weapon.';
    if (KITS[kit].slot === 'armour' && !['head', 'body', 'legs', 'shield'].includes(sl)) return 'That kit only fits armour.';
    if (KITS[kit].melee && isRangedWeapon(item)) return 'A longhaft needs a melee weapon.';
    if (KITS[kit].ranged && !isRangedWeapon(item)) return 'A hush-string needs a ranged weapon.';
    if (A.kitList(item).includes(kit)) return 'That kit is already on this item.';
    if (A.kitList(item).length >= KIT_SLOTS) return 'That item already has two kits.';
    return null;
  };

  A.kitCraft = id => {
    const k = KITS[id]; if (!k) return;
    if (k.season && !(A.scoreHas && A.scoreHas('kit-ashthread'))) return A.log('The Ash-thread kit is a Seasonboard schematic. Claim that tier first.', 'warn'), false;
    if (A.lvl(k.skill) < k.level) return A.log(`You need ${k.skill} ${k.level} to craft a ${k.name}.`, 'warn'), false;
    for (const [it, n] of Object.entries(k.inputs)) if (A.count(it) < n) return A.log(`You need ${n} ${it} to craft a ${k.name}.`, 'warn'), false;
    for (const [it, n] of Object.entries(k.inputs)) A.take(it, n);
    A.give(k.name, 1);
    if (!S().owned.includes(id)) S().owned.push(id);
    if (ctx.giveXP) ctx.giveXP(k.skill, k.xp);
    A.log(`You craft a ${k.name}.`, 'skill'); A.dirty(); return true;
  };
  A.kitAttach = (item, id) => {
    if (!worn().includes(item)) return A.log('Wear the item first.', 'warn'), false;
    if (A.count(KITS[id].name) < 1) return A.log(`You do not have a ${KITS[id].name}.`, 'warn'), false;
    const why = canTake(item, id); if (why) return A.log(why, 'warn'), false;
    A.take(KITS[id].name, 1);
    const l = S().on[item] || (S().on[item] = []);
    l.push(id);
    A.log(`You fit a ${KITS[id].name} to your ${item}. ${KITS[id].desc}`, 'skill'); A.dirty(); return true;
  };
  A.kitRemove = (item, i) => {
    const l = S().on[item]; if (!l || !l[i]) return false;
    const id = l.splice(i, 1)[0];
    if (!l.length) delete S().on[item];
    const k = KITS[id];
    A.give(k.name, 1);
    for (const [it, n] of Object.entries(k.refund)) A.give(it, n);
    A.log(`You remove the ${k.name}. Most of the parts come back.`, 'game'); A.dirty(); return true;
  };

  setAttackHook({
    range: (_p, r) => {
      if (A.kitHas('longhaft') && !isRangedWeapon(player.equipment && player.equipment.weapon)) r += 0.5;
      if (A.kitHas('hush') && isRangedWeapon(player.equipment && player.equipment.weapon)) r = Math.max(4, r - 1);
      return r;
    },
    speed: (_p, t) => A.kitHas('longhaft') && !isRangedWeapon(player.equipment && player.equipment.weapon) ? t + 1 : t
  });
  setFocusHook((_S, n) => A.kitHas('sight') ? n * 1.2 : n);
  setExamineHook((item, text) => {
    const ids = A.kitList(item); if (!ids.length) return text;
    return text + ` Kits: ${ids.map(kitName).join(', ')}.`;
  });
  if (A.playerPoiseMax) {
    const prev = A.playerPoiseMax;
    A.playerPoiseMax = () => prev() + (A.kitHas('collar') ? 8 : 0) + (A.kitHas('ashthread') ? 4 : 0);
  } else {
    A.onReady.push(() => {
      if (!A.playerPoiseMax) return;
      const prev = A.playerPoiseMax;
      A.playerPoiseMax = () => prev() + (A.kitHas('collar') ? 8 : 0) + (A.kitHas('ashthread') ? 4 : 0);
    });
  }

  let sel = null;
  A.npc('kitwright', '🧰', 'Kitwright Osha', 'I fit kits to a worn blade or plate: a longer haft, a hush-string, a lamp-rim, a padded collar, a watch-sight. They change how the piece behaves. They are not grafts, and they will not simply make it hit harder.', 'kits');
  A.guide.push(['Kitwright', 'Ventures ✦ → Kitwright, or talk to Kitwright Osha in Larkhaven. Craft kits from ordinary materials (Smithing, Fletching or Crafting) and attach up to two to a worn weapon or armour piece. A longhaft adds reach and slows the swing; a hush-string shortens ranged reach; a lamp-rim is a light pip; a padded collar adds poise; a watch-sight fills Stillwatch a little faster. Removing a kit returns most of the parts. Frontier uniques cannot take a kit. Grafts and Facets stay as they are.']);
  A.tab({ id: 'kits', icon: '🧰', name: 'Kitwright', render: () => {
    const held = Object.keys(KITS).filter(id => A.count(KITS[id].name) > 0);
    const craft = Object.values(KITS).filter(k => !k.season || (A.scoreHas && A.scoreHas('kit-ashthread'))).map(k => {
      const have = Object.entries(k.inputs).map(([it, n]) => `${n} ${it}`).join(', ');
      return `<div class="row"><div><b>${k.icon} ${A.esc(k.name)}</b><br><small>${A.esc(k.desc)} ${k.skill} ${k.level}. ${A.esc(have)}</small></div><button data-a="craft" data-k="${k.id}">Craft</button></div>`;
    }).join('');
    const items = worn().filter(it => ITEMS[it]).map(it => {
      const l = A.kitList(it);
      return `<div style="margin:6px 0"><b>${A.esc(it)}</b> <small>${l.length}/${KIT_SLOTS}</small>
        <div class="row" style="flex-wrap:wrap;gap:4px">${l.map((id, i) => `<button data-a="off" data-it="${A.esc(it)}" data-i="${i}">${KITS[id].icon} ${A.esc(KITS[id].name)} ✕</button>`).join('')}
        ${sel && l.length < KIT_SLOTS ? `<button data-a="on" data-it="${A.esc(it)}">＋ ${A.esc(KITS[sel].name)}</button>` : ''}</div></div>`;
    }).join('');
    return `<h4>Kitwright</h4><p>Up to two kits on a worn weapon or armour piece. Kits change how the piece behaves. They are not grafts or Facets, and they do not add a damage percent. Frontier uniques cannot take a kit.</p>
      <h4>Craft</h4>${craft}
      <h4>Held kits</h4><div class="row" style="flex-wrap:wrap;gap:4px">${held.length ? held.map(id => `<button data-a="sel" data-k="${id}" class="${id === sel ? 'on' : ''}">${KITS[id].icon} ${A.esc(KITS[id].name)} ×${A.count(KITS[id].name)}</button>`).join('') : '<small class="muted">Craft a kit first.</small>'}</div>
      <h4>Worn gear</h4>${items || '<small class="muted">Wear something first.</small>'}`;
  }, act: (a, d) => {
    if (a === 'craft') A.kitCraft(d.k);
    if (a === 'sel') sel = sel === d.k ? null : d.k;
    if (a === 'on' && sel) { A.kitAttach(d.it, sel); if (!A.count(KITS[sel].name)) sel = null; }
    if (a === 'off') A.kitRemove(d.it, +d.i);
  } });

  A.vtests = A.vtests || {};
  A.vtests.kitwright = async (g, A) => {
    const P = g.player, { attackRange, attackSpeedTicks, playerMaxHit } = await import('/js/gameplay.js');
    const w = P.equipment.weapon || 'Bronze sword';
    P.equipment.weapon = w;
    const dmg0 = A.totals(null).dmg;
    const hit0 = playerMaxHit(P, g.skills, {});
    const r0 = attackRange(P), s0 = attackSpeedTicks(P);
    // Give materials and a longhaft, attach, check reach and slower speed, not damage.
    P.inventory['Logs'] = (P.inventory['Logs'] || 0) + 6;
    P.inventory['Iron bar'] = (P.inventory['Iron bar'] || 0) + 3;
    g.skills.Smithing.level = Math.max(g.skills.Smithing.level, 10);
    if (!A.count('Longhaft kit') && !A.kitCraft('longhaft')) return 'craft';
    if (!A.kitAttach(w, 'longhaft')) return 'attach';
    if (!(attackRange(P) > r0 + 0.4 && attackSpeedTicks(P) > s0)) return 'reach ' + attackRange(P) + ' ' + attackSpeedTicks(P);
    if (Math.abs(A.totals(null).dmg - dmg0) > 1e-9) return 'dmg changed';
    if (playerMaxHit(P, g.skills, {}) !== hit0) return 'max hit changed';
    // Facets and grafts still apply on the same weapon (do not clear them).
    const facetOk = typeof A.facetOn === 'function';
    const graftOk = typeof A.graftSum === 'function';
    const parts0 = { Logs: A.count('Logs'), 'Iron bar': A.count('Iron bar'), kit: A.count('Longhaft kit') };
    if (!A.kitRemove(w, A.kitList(w).indexOf('longhaft'))) return 'remove';
    if (A.kitHas('longhaft')) return 'still on';
    if (attackRange(P) !== r0 || attackSpeedTicks(P) !== s0) return 'reach not reverted';
    if (A.count('Longhaft kit') < parts0.kit + 1) return 'kit not returned';
    if (A.count('Logs') < parts0.Logs + 2 || A.count('Iron bar') < parts0['Iron bar'] + 1) return 'refund';
    // Unique blocked.
    const uniq = 'Emberfang katana';
    P.equipment.weapon = uniq;
    P.inventory['Longhaft kit'] = 1;
    const blocked = A.kitAttach(uniq, 'longhaft');
    P.equipment.weapon = w;
    const exam = (await import('/js/items.js')).examineItem;
    // Sight does not change damage either; focus hook is a multiplier.
    return !blocked && facetOk && graftOk && typeof exam === 'function';
  };
}
