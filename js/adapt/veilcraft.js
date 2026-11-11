// Veilcraft: unmake a non-unique kit-bearing item to learn its named effect, then bind that lesson with a soul.
// One bound effect per item. Not a Facet, not a Graft, not a Kit, and not a damage percent.
import { ITEMS, slotFor, setExamineHook } from '../items.js';
import { isUniqueGear } from './kitwright.js';
import { NORM, obj, arr, num } from './state.js';
import { SOUL_CAP } from './skywyrms.js';

export const BIND_COST = { 'Clear essence': 2 };
export const UNBIND_GOLD = 25;
export const LESSER_BOSSES = ['Cinder Warden', 'Thornback Prowler', 'Peak Warlord'];
export const EFFECTS = {
  frost: { id: 'frost', name: 'Frost bind', kit: 'longhaft', desc: 'A brief chill on a hit that delays the foe a little. Not a damage percent.' },
  stun:  { id: 'stun',  name: 'Longer hitch', kit: 'collar', desc: 'A slightly longer stun hitch on a hit, with a cooldown. Bosses feel it less.' },
  night: { id: 'night', name: 'Night-sight', kit: 'sight', desc: 'You read worn gear and dim ground a little more clearly.' },
  hush:  { id: 'hush',  name: 'Quiet step', kit: 'hush', desc: 'A quieter step. Shadework can use this later; it is not a sneak sim.' },
  lamp:  { id: 'lamp',  name: 'Veil lamp', kit: 'lamp', desc: 'A short cone of light, like a lamp-rim, with no extra mesh on Low.' }
};
const IDS = new Set(Object.keys(EFFECTS));
const KIT_TO_EFFECT = {};
for (const e of Object.values(EFFECTS)) KIT_TO_EFFECT[e.kit] = e.id;

NORM.veil = v => {
  v = obj(v);
  const known = [...new Set(arr(v.known).filter(id => IDS.has(id)))];
  const on = {};
  for (const [it, id] of Object.entries(obj(v.on))) if (IDS.has(id) && typeof it === 'string') on[it] = id;
  return {
    known,
    souls: Math.max(0, Math.min(SOUL_CAP, Math.floor(num(v.souls, 0, 0)))),
    lesser: Math.max(0, Math.min(SOUL_CAP, Math.floor(num(v.lesser, 0, 0)))),
    on
  };
};

export default function veilcraft(A) {
  const { player, ctx } = A;
  const S = () => A.S('veil');
  const worn = () => Object.values(player.equipment || {}).filter(Boolean);
  const gearSlot = item => {
    const sl = (ITEMS[item] && ITEMS[item].type) || slotFor(item);
    return sl === 'weapon' || ['head', 'body', 'legs', 'shield'].includes(sl);
  };

  // Veilcraft owns the soul pouch. Mirror onto wyrms.souls so the Skywyrms tab stays accurate.
  {
    const w = A.S('wyrms');
    S().souls = Math.min(SOUL_CAP, Math.max(S().souls, (w && w.souls) || 0));
    if (w) w.souls = S().souls;
  }
  A.wyrmSouls = () => S().souls;
  A.wyrmGrantSoul = (n = 1) => {
    n = Math.max(0, Math.floor(n));
    const before = S().souls;
    S().souls = Math.min(SOUL_CAP, S().souls + n);
    const w = A.S('wyrms'); if (w) w.souls = S().souls;
    A.dirty(); return S().souls - before;
  };
  A.wyrmSpendSoul = (n = 1) => {
    n = Math.max(1, Math.floor(n));
    if (S().souls < n) return false;
    S().souls -= n;
    const w = A.S('wyrms'); if (w) w.souls = S().souls;
    A.dirty(); return true;
  };
  A.veilGrantLesser = (n = 1) => {
    n = Math.max(0, Math.floor(n));
    const before = S().lesser;
    S().lesser = Math.min(SOUL_CAP, S().lesser + n);
    A.dirty(); return S().lesser - before;
  };
  A.veilKnown = () => S().known.slice();
  A.veilOn = item => (item && S().on[item]) || null;
  A.veilWorn = id => worn().some(it => S().on[it] === id);
  A.veilHush = () => A.veilWorn('hush');
  A.veilLamp = () => A.veilWorn('lamp') || !!(A.kitLamp && A.kitLamp());
  A.veilNight = () => A.veilWorn('night');

  const paySoul = () => {
    if (A.wyrmSpendSoul(1)) return 'soul';
    if (S().lesser >= 1) { S().lesser -= 1; A.dirty(); return 'lesser'; }
    return null;
  };

  A.veilUnmake = item => {
    if (!item || !ITEMS[item]) return A.log('There is nothing to unmake.', 'warn'), false;
    if (isUniqueGear(item)) return A.log('Frontier uniques and relics keep their identity and cannot be unmade.', 'warn'), false;
    if (A.count(item) < 1 && !worn().includes(item)) return A.log('You do not have that item.', 'warn'), false;
    const kits = (A.kitList && A.kitList(item)) || [];
    const bound = S().on[item];
    let lesson = bound || null;
    if (!lesson) {
      for (const k of kits) if (KIT_TO_EFFECT[k]) { lesson = KIT_TO_EFFECT[k]; break; }
    }
    if (!lesson) return A.log('That item has no kit and no bound veil to learn from.', 'warn'), false;
    // Destroy the item. Drop worn first so take works; kits on it are lost with the piece (you keep the lesson).
    if (worn().includes(item)) {
      for (const [sl, it] of Object.entries(player.equipment || {})) if (it === item) player.equipment[sl] = null;
    }
    if (A.count(item) >= 1) A.take(item, 1);
    if (A.S('kits') && A.S('kits').on) delete A.S('kits').on[item];
    delete S().on[item];
    if (!S().known.includes(lesson)) S().known.push(lesson);
    A.log(`The ${item} comes apart. You keep the lesson: ${EFFECTS[lesson].name}. The item is gone.`, 'skill');
    A.dirty(); return true;
  };
  A.veilBind = (item, id) => {
    if (!EFFECTS[id]) return false;
    if (!S().known.includes(id)) return A.log('You have not learned that lesson yet.', 'warn'), false;
    if (!item || !ITEMS[item] || !gearSlot(item)) return A.log('Bind onto a plain weapon or armour piece.', 'warn'), false;
    if (isUniqueGear(item)) return A.log('Frontier uniques cannot take a veil binding.', 'warn'), false;
    if (S().on[item]) return A.log('That item already has a bound effect. Unbind it first.', 'warn'), false;
    if (A.count(item) < 1 && !worn().includes(item)) return A.log('You do not have that item.', 'warn'), false;
    for (const [it, n] of Object.entries(BIND_COST)) if (A.count(it) < n) return A.log(`You need ${n} ${it} to bind a veil.`, 'warn'), false;
    if (!paySoul()) return A.log('You need a Skywyrm soul, or a lesser bright soul, to bind.', 'warn'), false;
    for (const [it, n] of Object.entries(BIND_COST)) A.take(it, n);
    S().on[item] = id;
    A.log(`You bind ${EFFECTS[id].name} onto your ${item}. ${EFFECTS[id].desc}`, 'skill');
    A.dirty(); return true;
  };
  A.veilUnbind = item => {
    if (!S().on[item]) return A.log('Nothing is bound to that item.', 'warn'), false;
    if ((player.gold || 0) < UNBIND_GOLD) return A.log(`Unbinding costs ${UNBIND_GOLD} coins. The lesson stays known.`, 'warn'), false;
    player.gold -= UNBIND_GOLD;
    const id = S().on[item];
    delete S().on[item];
    A.log(`You unbind ${EFFECTS[id].name} from the ${item}. The lesson stays with you.`, 'game');
    A.dirty(); return true;
  };

  // On-hit: frost delays, stun hitches. Never a damage percent. Bosses and Colossi get a smaller hitch.
  const last = { frost: 0, stun: 0 };
  ctx.EXT.extHit.push((mon, dmg) => {
    if (!mon || !(dmg > 0)) return;
    const tick = (A.tick && A.tick()) || 0;
    const boss = !!(A.isBossy && A.isBossy(mon));
    if (A.veilWorn('frost') && tick - (last.frost || 0) >= 8) {
      last.frost = tick;
      const delay = boss ? 1 : 2;
      mon.nextAttackTick = Math.max(mon.nextAttackTick || 0, tick + delay);
      mon._veilFrost = tick + delay;
    }
    if (A.veilWorn('stun') && tick - (last.stun || 0) >= 20) {
      last.stun = tick;
      const hitch = boss ? 3 : 7; // default weapon stun is 5 ticks; this is slightly longer, bosses much less
      mon.stunUntil = Math.max(mon.stunUntil || 0, tick + hitch);
    }
  });
  setExamineHook((item, text) => {
    const id = S().on[item];
    if (!id) return text;
    return text + ` Veil: ${EFFECTS[id].name}.`;
  });

  ctx.EXT.extKill.push(m => {
    if (!m || !LESSER_BOSSES.includes(m.name)) return;
    if (Math.random() < 0.25 && S().lesser < SOUL_CAP) {
      A.veilGrantLesser(1);
      A.log(`A lesser bright soul settles in your pouch (${S().lesser}/${SOUL_CAP}).`, 'skill');
    }
  });

  let pickItem = null, pickFx = null;
  A.npc('veilcraft', '🕯️', 'Veilwright Ise', 'At my veil bench you may unmake a non-unique kit-bearing piece to learn its named effect — the item is destroyed, the lesson stays. Bind that lesson onto a plain weapon or armour with a Skywyrm soul, or a lesser bright soul, plus a little essence. One binding per item. You can unbind later. This is not a Facet, not a graft, and not a kit, and it will not simply make the piece hit harder. Uniques keep their identity.', 'veil');
  A.guide.push(['Veilcraft', 'Ventures ✦ → Veilcraft, or talk to Veilwright Ise in Highcrest. Unmake a non-unique kit-bearing item to learn its effect (the item is destroyed). Bind a learned lesson onto a plain weapon or armour with a Skywyrm soul (or a lesser bright soul) and 2 Clear essence. One effect per item. Unbind for a few coins; the lesson stays. Frost, a slightly longer hitch, night-sight, a quiet step, or a lamp — not a damage percent. Frontier uniques cannot be unmade.']);
  A.tab({ id: 'veil', icon: '🕯️', name: 'Veilcraft', render: () => {
    const s = S();
    const known = s.known.length ? s.known.map(id => `<button data-a="fx" data-k="${id}" class="${pickFx === id ? 'on' : ''}">${A.esc(EFFECTS[id].name)}</button>`).join(' ') : '<small class="muted">Unmake a kit-bearing item to learn a lesson.</small>';
    const pack = [...new Set([...worn(), ...Object.keys(player.inventory || {}).filter(it => ITEMS[it] && player.inventory[it] > 0)])].filter(gearSlot).slice(0, 16);
    const list = pack.map(it => {
      const kits = (A.kitList && A.kitList(it)) || [];
      const bound = s.on[it];
      const mark = bound ? `veil: ${EFFECTS[bound].name}` : (kits.length ? `kits: ${kits.join(', ')}` : 'plain');
      return `<div class="row"><div><b>${A.esc(it)}</b> <small>${A.esc(mark)}</small></div>
        <button data-a="sel" data-k="${A.esc(it)}" class="${pickItem === it ? 'on' : ''}">Select</button>
        ${kits.length || bound ? `<button data-a="unmake" data-k="${A.esc(it)}">Unmake</button>` : ''}
        ${bound ? `<button data-a="unbind" data-k="${A.esc(it)}">Unbind (${UNBIND_GOLD}c)</button>` : ''}</div>`;
    }).join('') || '<small class="muted">Wear or carry a weapon or armour piece.</small>';
    return `<h4>Veilcraft</h4><p>Unmake a non-unique kit-bearing item to learn its named effect — the item is destroyed, you keep the lesson. Bind a lesson onto a plain piece with a soul and 2 Clear essence. One effect per item. Not a Facet, not a graft, not a kit, and not a damage percent. Uniques cannot be unmade.</p>
      <p>Souls: <b>${s.souls}/${SOUL_CAP}</b> · Lesser bright souls: <b>${s.lesser}/${SOUL_CAP}</b></p>
      <h4>Known lessons</h4><div class="row" style="flex-wrap:wrap;gap:4px">${known}</div>
      ${pickFx && EFFECTS[pickFx] ? `<p><small>${A.esc(EFFECTS[pickFx].desc)}</small></p>` : ''}
      <h4>Your gear</h4>${list}
      ${pickItem && pickFx && !s.on[pickItem] ? `<div class="row"><button data-a="bind" style="min-height:40px">Bind ${A.esc(EFFECTS[pickFx].name)} onto ${A.esc(pickItem)}</button></div>` : ''}
      <p><small>This item will be destroyed if you Unmake it.</small></p>`;
  }, act: (a, d) => {
    if (a === 'fx') pickFx = pickFx === d.k ? null : d.k;
    if (a === 'sel') pickItem = pickItem === d.k ? null : d.k;
    if (a === 'unmake') A.veilUnmake(d.k);
    if (a === 'unbind') A.veilUnbind(d.k);
    if (a === 'bind' && pickItem && pickFx) A.veilBind(pickItem, pickFx);
  } });

  A.vtests = A.vtests || {};
  A.vtests.veilcraft = async (g, A) => {
    const P = g.player, s = S();
    const { playerMaxHit } = await import('/js/gameplay.js');
    const snap = { known: s.known.slice(), souls: s.souls, lesser: s.lesser, on: { ...s.on }, gold: P.gold, wsouls: A.S('wyrms') && A.S('wyrms').souls };
    const wpn0 = P.equipment && P.equipment.weapon;
    try {
      const steel = 'Steel sword';
      P.inventory[steel] = (P.inventory[steel] || 0) + 2;
      P.equipment = P.equipment || {};
      P.equipment.weapon = steel;
      P.inventory['Logs'] = (P.inventory['Logs'] || 0) + 6;
      P.inventory['Iron bar'] = (P.inventory['Iron bar'] || 0) + 3;
      P.inventory['Clear essence'] = (P.inventory['Clear essence'] || 0) + 6;
      g.skills.Smithing.level = Math.max(g.skills.Smithing.level || 1, 10);
      if (!A.count('Longhaft kit') && A.kitCraft && !A.kitCraft('longhaft')) return 'craft kit';
      if (A.kitAttach && !A.kitList(steel).includes('longhaft') && !A.kitAttach(steel, 'longhaft')) return 'attach kit';
      const n0 = A.count(steel);
      if (!A.veilUnmake(steel)) return 'unmake';
      if (A.count(steel) !== n0 - 1) return 'item not destroyed';
      if (!s.known.includes('frost')) return 'lesson not known';
      const uniq = 'Emberfang katana';
      P.inventory[uniq] = (P.inventory[uniq] || 0) + 1;
      if (A.veilUnmake(uniq)) return 'unmade unique';
      // Bind onto a remaining plain steel sword with a soul.
      P.inventory[steel] = Math.max(A.count(steel), 1);
      P.equipment.weapon = steel;
      s.souls = Math.max(s.souls, 1);
      if (A.S('wyrms')) A.S('wyrms').souls = s.souls;
      const dmg0 = A.totals(null).dmg;
      const hit0 = playerMaxHit(P, g.skills, {});
      if (!A.veilBind(steel, 'frost')) return 'bind';
      if (S().on[steel] !== 'frost') return 'not bound';
      if (Math.abs(A.totals(null).dmg - dmg0) > 1e-9) return 'dmg changed';
      if (playerMaxHit(P, g.skills, {}) !== hit0) return 'max hit changed';
      if (s.souls < 0) return 'souls negative';
      P.gold = Math.max(P.gold || 0, UNBIND_GOLD);
      if (!A.veilUnbind(steel)) return 'unbind';
      if (S().on[steel]) return 'still bound';
      if (!s.known.includes('frost')) return 'lesson lost';
      // Facet / kit helpers still exist for other items.
      if (typeof A.facetOn !== 'function' || typeof A.kitAttach !== 'function') return 'other layers missing';
      // Souls cannot go negative.
      s.souls = 0; if (A.S('wyrms')) A.S('wyrms').souls = 0; s.lesser = 0;
      if (A.veilBind(steel, 'frost')) return 'bound without a soul';
      if (s.souls < 0) return 'souls went negative';
    } finally {
      s.known = snap.known; s.souls = snap.souls; s.lesser = snap.lesser; s.on = snap.on;
      if (A.S('wyrms') && snap.wsouls != null) A.S('wyrms').souls = snap.wsouls;
      P.gold = snap.gold;
      if (wpn0 !== undefined) P.equipment.weapon = wpn0;
    }
    return true;
  };
}
