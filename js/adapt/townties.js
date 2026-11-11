// Town Ties (adapted from Stardew / Animal Crossing friendships): friendship ranks on ordinary townsfolk, not the four Sworn Companions.
import { ITEMS } from '../items.js';
import { QUEST_NPCS } from '../questnpcs.js';
import { NORM, obj, num } from './state.js';

export const TIE_MAX = 5;
export const TIE_GIFT_MS = 10 * 60 * 1000;
export const TIE_RANKS = ['Stranger', 'Acquaintance', 'Friendly', 'Trusted', 'Close', 'Kindred'];
const COMPANIONS = new Set(['tamsin', 'ysolde', 'brannoc', 'mirelle']);

// Home-grown produce (Greenstead fills the bag; unknown names are ignored until those items exist).
export const FARM_PRODUCE = ['Potato', 'Cabbage', 'Wheat', 'Tomato', 'Pumpkin', 'Winterroot', 'Egg', 'Milk', 'Wool', 'Farm preserves'];

const LOOK_GIFT = {
  granny: { love: /Bread|Cake|Pie|Stew|^Cooked /, hate: /Bones|ore$|bar$/ },
  cook: { love: /Bread|Cake|Pie|Stew|^Cooked |Beer|Ale/, hate: /Bones|Grimy / },
  kid: { love: /Cake|Bread|Cooked shrimp|Pie/, hate: /Bones|bar$|ore$/ },
  worker: { love: /Logs|Flax|Soft leather|Wool/, hate: /Bones/ },
  scholar: { love: / rune$|Feather|Book/, hate: /Bones|Beer/ },
  soldier: { love: / bar$|Cooked meat|Bread/, hate: /Cake/ },
  knight: { love: / bar$|Cooked meat|Wine/, hate: /Bones/ },
  priest: { love: /Bones|Bread|Cake/, hate: /Beer|Ale/ },
  ranger: { love: /arrows$|Feather|hide|leather/i, hate: /Bones/ },
  sailor: { love: /Cooked shrimp|Cooked lobster|Cooked swordfish|Cooked shark/, hate: /Bones/ },
  pirate: { love: /Beer|Ale|Cooked shrimp|Cooked lobster/, hate: /Bread/ },
  smith: { love: / bar$| ore$|Coal/, hate: /Cake|Pie/ },
  farmer: { love: /Potato|Cabbage|Wheat|Tomato|Pumpkin|Winterroot|Egg|Milk/, hate: /Bones/ },
  noble: { love: /Cake|Wine|Pie/, hate: /Bones|ore$/ },
  wizard: { love: / rune$|Grimy |leaf$|Marshmint|Tallowroot/, hate: /Beer|Ale/ },
  dwarf: { love: /Pie| bar$|Coal/, hate: /Bones/ },
  herbal: { love: /Grimy |leaf$|Marshmint|Tallowroot|Cabbage/, hate: /Beer/ },
  hermit: { love: /Bread|Cooked meat|Cake/, hate: /Wine/ },
  thief: { love: /Cake|Gold|ring|gem/i, hate: /Bread/ }
};
const ID_GIFT = {
  thurgo: { love: /Pie/, hate: /Bones/ },
  bram: { love: /Wheat|Barley|Logs/, hate: /Bones/ },
  wydin: { love: /Potato|Cabbage|Wheat|Tomato|Cooked /, hate: /Bones/ },
  sarah: { love: /Potato|Cabbage|Wheat|Egg|Milk/, hate: /Bones/ }
};

function lookOf(n) {
  const L = n && n.look;
  if (!L || typeof L === 'string') return L || 'worker';
  // QUEST_NPCS already resolved string looks to objects; recover the preset name when we can.
  return n._lookName || 'worker';
}

export const FOLK = QUEST_NPCS.filter(n => n && n.id && !COMPANIONS.has(n.id)).map(n => {
  const lookName = typeof n.look === 'string' ? n.look : (n.look && n.look._name) || guessLook(n);
  const g = ID_GIFT[n.id] || LOOK_GIFT[lookName] || LOOK_GIFT.worker;
  const h = hash(n.id);
  return { id: n.id, name: n.name, face: n.face || '🙂', look: lookName, love: g.love, hate: g.hate, bMonth: h % 12, bDay: (h % 28) + 1, shop: !!n.shop };
});
const FOLK_BY = Object.fromEntries(FOLK.map(f => [f.id, f]));

function guessLook(n) {
  const face = n.face || '';
  if (/👵|👩‍🌾/.test(face)) return 'granny';
  if (/🧑‍🍳|🍲|🍻|🍺/.test(face)) return 'cook';
  if (/🧒|👦|📮/.test(face)) return 'kid';
  if (/📚|📖|🗺️/.test(face)) return 'scholar';
  if (/🛡️|⚔️|💂/.test(face)) return 'soldier';
  if (/🙏/.test(face)) return 'priest';
  if (/🏹|🏃|🎯/.test(face)) return 'ranger';
  if (/🏴‍☠️|⚓|🎣/.test(face)) return 'sailor';
  if (/🔨|⛏️|🧔/.test(face)) return 'smith';
  if (/🧙/.test(face)) return 'wizard';
  if (/💰|🎉|🌹/.test(face)) return 'noble';
  if (/🌿|⚗️/.test(face)) return 'herbal';
  if (/🥷/.test(face)) return 'thief';
  return 'worker';
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

NORM.ties = v => {
  v = obj(v);
  const out = {};
  for (const [id, rec] of Object.entries(v)) {
    if (!FOLK_BY[id] || !rec || typeof rec !== 'object') continue;
    const flags = obj(rec.flags);
    out[id] = {
      rank: Math.max(0, Math.min(TIE_MAX, Math.floor(num(rec.rank, 0)))),
      giftAt: num(rec.giftAt, 0, 0),
      talkAt: String(rec.talkAt || ''),
      flags: { heart: !!flags.heart, errand: !!flags.errand }
    };
  }
  return out;
};

function isGrownItem(item, A) { return FARM_PRODUCE.includes(item) && !!(A && A.grew && A.grew(item)); }
function isBday(folk, d = new Date()) { return d.getMonth() === folk.bMonth && d.getDate() === folk.bDay; }
function giftKind(folk, item, A) {
  if (!item || !ITEMS[item]) return 'none';
  const grown = isGrownItem(item, A);
  const bday = isBday(folk);
  if (folk.hate && folk.hate.test(item) && !grown && !bday) return 'hate';
  if ((folk.love && folk.love.test(item)) || bday || grown) return grown || bday ? 'loveplus' : 'love';
  return 'ok';
}

export default function townties(A) {
  const { ctx, player, skills } = A;
  const S = () => A.S('ties');
  const rec = id => { const s = S(); if (!s[id]) s[id] = { rank: 0, giftAt: 0, talkAt: '', flags: { heart: false, errand: false } }; return s[id]; };
  const folkOf = id => FOLK_BY[id];
  const bump = (id, n) => { const r = rec(id); const was = r.rank; r.rank = Math.max(0, Math.min(TIE_MAX, r.rank + n)); if (r.rank >= 2 && was < 2) A.log(`${folkOf(id).name} will give you a modest shop discount when you trade with them.`, 'skill'); if (r.rank >= 4 && !r.flags.heart) { r.flags.heart = true; A.log(`${folkOf(id).name} shares a short, private word with you. You have become close.`, 'skill'); } if (r.rank >= 3 && !r.flags.errand) r.flags.errand = true; return r.rank; };

  A.tieFolk = () => FOLK;
  A.tieOf = id => folkOf(id) && rec(id);
  A.tieDiscount = id => { const f = folkOf(id), r = S()[id]; return !!(f && r && r.rank >= 2); };

  A.tieTalk = id => {
    const f = folkOf(id); if (!f) return;
    const r = rec(id), day = new Date().toDateString();
    if (r.talkAt === day) return A.log(`${f.name} already had a proper chat with you today.`, 'game');
    r.talkAt = day;
    const n = bump(id, 1);
    A.log(`You talk with ${f.name}. Town Tie: ${TIE_RANKS[n]} (${n}/${TIE_MAX}).`, 'game');
    A.dirty();
    return true;
  };

  A.tieGift = (id, item) => {
    const f = folkOf(id); if (!f) return;
    if (!ITEMS[item] || A.count(item) < 1) return A.log(`You do not have a ${item}.`, 'warn');
    const r = rec(id), now = Date.now();
    if (now - r.giftAt < TIE_GIFT_MS) return A.log(`${f.name} already received a gift recently. Try again in a little while.`, 'warn');
    const kind = giftKind(f, item, A);
    A.take(item, 1);
    if (A.grew && kind !== 'hate') A.grew(item, -1);
    r.giftAt = now;
    let msg, xp = 0;
    if (kind === 'hate') { msg = `${f.name} does not care for the ${item}. (Town Tie unchanged.)`; }
    else if (kind === 'loveplus') { const n = bump(id, 1); xp = 15; msg = `${f.name} is delighted with the ${item}${isGrownItem(item, A) || FARM_PRODUCE.includes(item) ? ' — especially since you grew it' : isBday(f) ? " — and on their birthday, no less" : ''}. Town Tie: ${TIE_RANKS[n]} (${n}/${TIE_MAX}).`; }
    else if (kind === 'love') { const n = bump(id, 1); msg = `${f.name} loves the ${item}. Town Tie: ${TIE_RANKS[n]} (${n}/${TIE_MAX}).`; }
    else { msg = `${f.name} accepts the ${item} politely. Town Tie stays at ${TIE_RANKS[r.rank]} (${r.rank}/${TIE_MAX}).`; }
    if (xp && skills.Farming) { ctx.giveXP('Farming', xp); msg += ` (+${xp} Farming)`; }
    A.log(msg, kind === 'hate' ? 'warn' : 'skill'); A.dirty();
    return kind;
  };

  A.tieWrap = (ent, script) => {
    const id = ent && ent.npc; if (!id || !folkOf(id) || ent.companion) return script;
    rec(id); // meeting them starts a record at rank 0
    const f = folkOf(id), r = rec(id), items = Object.keys(player.inventory || {}).filter(i => ITEMS[i] && (player.inventory[i] || 0) > 0).slice(0, 10);
    const giftChoices = items.length ? items.map(i => [`Give ${i}`, [{ run: () => { A.tieGift(id, i); return []; } }]]) : [['I have nothing to give right now.', []]];
    const extra = { choose: [
      [`Chat with ${f.name} (Town Ties).`, [{ run: () => { A.tieTalk(id); return [['npc', r.talkAt === new Date().toDateString() ? `Always good to see you. We're ${TIE_RANKS[r.rank]}.` : 'It was good to talk.']]; } }]],
      [`Give a gift.`, [{ choose: [...giftChoices, ['Never mind.', []]] }]],
      ...(r.rank >= 2 && (ent.shop || ent.npc === 'bob') ? [[`Trade (Friendly discount).`, [{ run: () => { player._tieShop = id; ctx.invUI && ctx.invUI.open(ent.shop || 'tools'); return []; } }]]] : [])
    ] };
    return Array.isArray(script) ? [...script, extra] : script;
  };

  A.tieOptions = ent => {
    const id = ent && ent.npc; if (!id || !folkOf(id) || ent.companion) return [];
    return [{ action: 'Town Ties', target: folkOf(id).name, color: '#c8a050', fn: () => { const r = rec(id); A.log(`${folkOf(id).name}: ${TIE_RANKS[r.rank]} (${r.rank}/${TIE_MAX}). Chat or gift them when you talk.`, 'game'); } }];
  };

  A.tiesData = () => {
    const s = S(), met = FOLK.filter(f => s[f.id]).map(f => {
      const r = rec(f.id);
      return { id: f.id, name: f.name, face: f.face, rank: r.rank, label: TIE_RANKS[r.rank], bday: isBday(f), heart: !!r.flags.heart, discount: r.rank >= 2 };
    });
    return { intro: '<div class="b-s">Town Ties are friendships with ordinary townsfolk and shopkeepers — not your Sworn Companions. Chat once a day and give a gift (loved gifts, and produce you grew, mean more). Ranks cap at Kindred (5), smaller than companion Bond. Friendly townsfolk offer a modest shop discount. Open Bonds (B) → Town Ties, or talk to them in town.</div>', folk: met };
  };

  A.guide.push(['Town Ties', 'Ordinary townsfolk and shopkeepers keep a friendship rank, separate from Sworn Companion Bond. Talk once a day and give gifts (press B → Town Ties, or Talk-to them). Produce you grew on the farm makes a better gift and trains a little Farming. Ranks cap at 5. Companions are unchanged.']);
  A.tab({ id: 'ties', icon: '💞', name: 'Town Ties', render: () => {
    const d = A.tiesData();
    if (!d.folk.length) return `<h4>Town Ties</h4>${d.intro}<p><small>Talk to townsfolk in Larkhaven, Emberfold, Saltreach, Highcrest or Whitecairn to start a Tie.</small></p>`;
    return `<h4>Town Ties</h4>${d.intro}` + d.folk.map(f => `<div style="margin:8px 0"><b>${f.face} ${A.esc(f.name)}</b> <small>${f.label} (${f.rank}/${TIE_MAX})${f.discount ? ' · shop discount' : ''}${f.heart ? ' · close' : ''}${f.bday ? ' · birthday today' : ''}</small></div>`).join('');
  }, act: () => {} });

  A.vtests = A.vtests || {};
  A.vtests.townties = async (g, A) => {
    const id = 'hilda', itemLove = 'Cooked shrimp', itemHate = 'Copper ore';
    const s = S(), prev = s[id] ? { ...s[id], flags: { ...(s[id].flags || {}) } } : null;
    const inv = { ...g.player.inventory };
    const comps = JSON.parse(JSON.stringify(g.player.companions || {}));
    const farm = g.skills.Farming, xp0 = farm ? farm.xp : 0, lv0 = farm ? farm.level : 0;
    try {
      if (COMPANIONS.has('hilda')) return 'hilda is a companion';
      if (!folkOf(id)) return 'no hilda';
      g.player.inventory['Cooked shrimp'] = (g.player.inventory['Cooked shrimp'] || 0) + 2;
      g.player.inventory['Copper ore'] = (g.player.inventory['Copper ore'] || 0) + 1;
      delete s[id];
      if (!A.tieTalk(id)) return 'talk';
      const r = rec(id); if (r.rank !== 1) return 'talk rank ' + r.rank;
      if (!A.tieTalk(id)) { /* second talk same day should no-op */ } else return 'talk twice';
      if (r.rank !== 1) return 'double talk';
      const kind = A.tieGift(id, itemLove); if (kind !== 'love' && kind !== 'loveplus') return 'love gift ' + kind;
      if (r.rank !== 2) return 'gift rank ' + r.rank;
      if (!A.tieDiscount(id)) return 'no discount at friendly';
      // cooldown: second gift should fail
      const before = A.count('Copper ore');
      const hated = A.tieGift(id, itemHate);
      if (hated) return 'gift on cooldown';
      if (A.count('Copper ore') !== before) return 'cooldown consumed';
      r.giftAt = 0;
      const hateKind = A.tieGift(id, itemHate);
      if (hateKind !== 'hate') return 'hate ' + hateKind;
      if (r.rank !== 2) return 'hate changed rank';
      // grown produce: only when Farming / grew() exist
      if (farm && ITEMS['Potato'] && A.grew) {
        g.player.inventory['Potato'] = (g.player.inventory['Potato'] || 0) + 1;
        A.grew('Potato', 1);
        r.giftAt = 0;
        const gkind = A.tieGift(id, 'Potato');
        if (gkind !== 'loveplus' && gkind !== 'love') return 'grown ' + gkind;
        if (farm.xp <= xp0) return 'no farming xp';
      }
      const afterComps = JSON.stringify(g.player.companions || {});
      if (afterComps !== JSON.stringify(comps)) return 'companions changed';
      return true;
    } finally {
      g.player.inventory = inv;
      g.player.companions = comps;
      if (prev) s[id] = prev; else delete s[id];
      if (farm) { farm.xp = xp0; farm.level = lv0; }
    }
  };
}
