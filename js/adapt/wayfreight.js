// Wayfreight: supply lines between homes you already own. Linked chests share a small freight pool.
// This is not a new house and not a shared multiplayer stash. Construction XP is small.
import { ITEMS } from '../items.js';
import { HOUSES } from './townsteads.js';
import { NORM, obj, arr, num } from './state.js';

export const LINE_GOLD = 200, LINE_XP = 25, STACK_CAP = 50, TYPE_CAP = 12;
export const LINE_CAP_LOW = 3, LINE_CAP_HIGH = 5;

function lineKey(a, b) { return [a, b].sort().join('|'); }

NORM.freight = v => {
  v = obj(v);
  const seen = new Set(), lines = [];
  for (const l of arr(v.lines)) {
    const a = l && (l.a || l[0]), b = l && (l.b || l[1]);
    if (typeof a !== 'string' || typeof b !== 'string' || a === b) continue;
    const k = lineKey(a, b); if (seen.has(k)) continue;
    seen.add(k); lines.push({ a, b });
  }
  const pool = {};
  for (const [it, n] of Object.entries(obj(v.pool))) {
    const q = Math.max(0, Math.min(STACK_CAP, Math.floor(num(n, 0, 0))));
    if (q > 0 && typeof it === 'string') pool[it] = q;
  }
  const keys = Object.keys(pool).slice(0, TYPE_CAP);
  const slim = {}; for (const k of keys) slim[k] = pool[k];
  return { lines, pool: slim };
};

export default function wayfreight(A) {
  const { player, ctx } = A;
  const S = () => A.S('freight');
  const isLow = () => !!(ctx.gfxQ === 'low' || (player.settings && player.settings.gfx === 'low'));
  A.freightCap = () => (isLow() ? LINE_CAP_LOW : LINE_CAP_HIGH);

  const HOME = () => {
    const list = HOUSES.map(h => ({ id: h.id, name: h.name, kind: 'stead' }));
    list.push({ id: 'hold', name: 'Hearthhold', kind: 'hold' });
    list.push({ id: 'green', name: 'Greenstead', kind: 'green' });
    list.push({ id: 'claim', name: 'Claimridge', kind: 'frame' });
    return list;
  };
  A.freightHomes = HOME;
  A.freightOwned = id => {
    const h = HOME().find(x => x.id === id); if (!h) return false;
    if (h.kind === 'stead') return !!(A.steadOwned && A.steadOwned(id));
    if (h.kind === 'hold') return !!(A.S('hold') && A.S('hold').owned);
    if (h.kind === 'green') return !!(A.S('green') && A.S('green').deed);
    if (h.kind === 'frame') return !!(A.frameClaimed && A.frameClaimed());
    return false;
  };
  A.freightLinked = (a, b) => S().lines.some(l => lineKey(l.a, l.b) === lineKey(a, b));
  A.freightPool = () => S().pool;
  A.freightCanPull = () => !!(A._freightForcePull || (A.freightOwned('hold') && S().lines.some(l => l.a === 'hold' || l.b === 'hold') && A.holdHome && A.holdHome()));
  A.freightInv = inv => {
    const out = { ...(inv || {}) };
    if (!A.freightCanPull()) return out;
    for (const [it, n] of Object.entries(S().pool)) out[it] = (out[it] || 0) + n;
    return out;
  };

  A.freightLink = (a, b) => {
    if (a === b) return A.log('Pick two different homes.', 'warn'), false;
    if (!A.freightOwned(a) || !A.freightOwned(b)) return A.log('You can only link homes you already own.', 'warn'), false;
    if (A.freightLinked(a, b)) return A.log('Those homes are already linked.', 'game'), false;
    if (S().lines.length >= A.freightCap()) return A.log(`You can keep at most ${A.freightCap()} freight lines (${isLow() ? 'Low' : 'High'}).`, 'warn'), false;
    if ((player.gold || 0) < LINE_GOLD) return A.log(`A freight line costs ${LINE_GOLD} coins.`, 'warn'), false;
    player.gold -= LINE_GOLD;
    S().lines.push({ a, b });
    if (ctx.giveXP) ctx.giveXP('Construction', LINE_XP);
    const na = (HOME().find(h => h.id === a) || {}).name || a, nb = (HOME().find(h => h.id === b) || {}).name || b;
    A.log(`You string a freight line between the ${na} and the ${nb}. Linked chests share a small pool. +${LINE_XP} Construction XP.`, 'skill');
    A.dirty(); return true;
  };
  A.freightUnlink = (a, b) => {
    const k = lineKey(a, b);
    const before = S().lines.length;
    S().lines = S().lines.filter(l => lineKey(l.a, l.b) !== k);
    if (S().lines.length === before) return false;
    A.log('You take the freight line down. The pool stays; that path is closed.', 'game'); A.dirty(); return true;
  };
  A.freightDeposit = (item, n = 1) => {
    n = Math.max(1, Math.floor(n));
    if (!item || !ITEMS[item]) return A.log('That is not something you can freight.', 'warn'), false;
    if (A.count(item) < n) return A.log(`You do not have ${n} ${item}.`, 'warn'), false;
    const pool = S().pool;
    if (!pool[item] && Object.keys(pool).length >= TYPE_CAP) return A.log('The freight pool has no more item kinds (12).', 'warn'), false;
    const room = STACK_CAP - (pool[item] || 0);
    if (room <= 0) return A.log(`The pool already holds ${STACK_CAP} ${item}.`, 'warn'), false;
    const take = Math.min(n, room);
    A.take(item, take);
    pool[item] = (pool[item] || 0) + take;
    A.log(`You deposit ${take} ${item} into the freight pool.`, 'game'); A.dirty(); return true;
  };
  A.freightConsume = (item, n = 1) => {
    n = Math.max(1, Math.floor(n));
    const have = S().pool[item] || 0;
    if (have < n) return false;
    S().pool[item] = have - n;
    if (S().pool[item] <= 0) delete S().pool[item];
    A.dirty(); return true;
  };
  A.freightTake = (item, n = 1) => {
    if (!A.freightConsume(item, n)) return false;
    A.give(item, n);
    return true;
  };
  A.freightWithdraw = (item, n = 1) => {
    if (!A.freightTake(item, n)) return A.log('The pool does not have that many.', 'warn'), false;
    A.log(`You take ${n} ${item} from the freight pool.`, 'game'); return true;
  };

  A.npc('wayfreight', '🪢', 'Freighter Wend', 'If you own two homes, I can string a freight line between them. Deposit at one, withdraw at the other. The Hold forge can pull from the pool when you are there. This is not a new house, and a Townstead chest stays private until you deposit.', 'freight');
  A.guide.push(['Wayfreight', `Ventures ✦ → Freight, or talk to Freighter Wend in Larkhaven. Link two homes you already own (${LINE_GOLD} coins and a little Construction XP — not the Construction grind). Linked chests share a small pool (stack cap ${STACK_CAP}, ${TYPE_CAP} kinds, ${LINE_CAP_LOW} lines on Low). Breaking a line does not empty the pool. Unowned houses cannot be linked.`]);
  let pick = null;
  A.tab({ id: 'freight', icon: '🪢', name: 'Freight', render: () => {
    const s = S(), cap = A.freightCap();
    const homes = HOME();
    const owned = homes.filter(h => A.freightOwned(h.id));
    const lines = s.lines.map(l => {
      const na = (homes.find(h => h.id === l.a) || {}).name || l.a, nb = (homes.find(h => h.id === l.b) || {}).name || l.b;
      return `<div class="row"><div>${A.esc(na)} ↔ ${A.esc(nb)}</div><button data-a="cut" data-x="${l.a}" data-y="${l.b}">Unlink</button></div>`;
    }).join('') || '<small class="muted">No lines yet.</small>';
    const pool = Object.entries(s.pool).map(([it, n]) => `<div class="row"><div>${A.esc(it)} ×${n}/${STACK_CAP}</div><button data-a="take" data-k="${A.esc(it)}">Withdraw 1</button></div>`).join('') || '<small class="muted">The pool is empty.</small>';
    const pack = Object.keys(player.inventory || {}).filter(it => ITEMS[it] && (player.inventory[it] || 0) > 0 && ITEMS[it].type !== 'unique').slice(0, 16);
    return `<h4>Wayfreight</h4><p>Link homes you already own. Linked chests share this pool. Townstead chests stay private until you deposit. The Hold forge can pull from the pool when you are on the island.</p>
      <p><small>Lines ${s.lines.length}/${cap} · a line costs ${LINE_GOLD} coins and grants ${LINE_XP} Construction XP.</small></p>
      <h4>Your homes</h4>${owned.length ? owned.map(h => `<button data-a="pick" data-k="${h.id}" class="${pick === h.id ? 'on' : ''}">${A.esc(h.name)}</button>`).join(' ') : '<small class="muted">Buy a Townstead, the Hold, Greenstead or Claimridge first.</small>'}
      ${pick ? `<div class="row"><button data-a="link">Link the selected home to another tap</button></div>` : ''}
      <h4>Lines</h4>${lines}
      <h4>Freight pool</h4>${pool}
      <h4>Deposit from pack</h4>${pack.length ? pack.map(it => `<button data-a="put" data-k="${A.esc(it)}">${A.esc(it)} ×${player.inventory[it]}</button>`).join(' ') : '<small class="muted">Your pack is empty.</small>'}`;
  }, act: (a, d) => {
    if (a === 'pick') {
      if (pick && pick !== d.k) { A.freightLink(pick, d.k); pick = null; }
      else pick = pick === d.k ? null : d.k;
    }
    if (a === 'link') { /* pick two via taps */ }
    if (a === 'cut') A.freightUnlink(d.x, d.y);
    if (a === 'put') A.freightDeposit(d.k, 1);
    if (a === 'take') A.freightWithdraw(d.k, 1);
  } });

  A.vtests = A.vtests || {};
  A.vtests.wayfreight = async (g, A) => {
    const P = g.player, s = A.S('freight');
    const gold0 = P.gold, pool0 = { ...s.pool }, lines0 = s.lines.map(l => ({ ...l }));
    const restore = () => { P.gold = gold0; s.pool = pool0; s.lines = lines0; };
    const id = (HOUSES[0] && HOUSES[0].id) || 'lark-e';
    P.gold = Math.max(P.gold || 0, 20000);
    P.inventory['Logs'] = (P.inventory['Logs'] || 0) + 20;
    if (A.steadBuy && !A.freightOwned(id)) A.steadBuy(id);
    if (A.holdBuy && !A.freightOwned('hold')) A.holdBuy();
    if (!A.freightOwned(id) || !A.freightOwned('hold')) { restore(); return 'need two homes'; }
    const other = HOUSES.find(h => h.id !== id && !A.freightOwned(h.id));
    if (other && A.freightLink(id, other.id)) { restore(); return 'linked unowned'; }
    if (!A.freightLinked(id, 'hold') && !A.freightLink(id, 'hold')) { restore(); return 'link'; }
    if (A.steadPlace && !(A.S('steads').furn[id] && A.S('steads').furn[id].chest)) A.steadPlace(id, 'chest');
    P.inventory['Bronze sword'] = (P.inventory['Bronze sword'] || 0) + 1;
    const leaked0 = s.pool['Bronze sword'] || 0;
    if (A.steadStore) A.steadStore(id, 'Bronze sword', 1);
    if ((s.pool['Bronze sword'] || 0) !== leaked0) { restore(); return 'private chest leaked'; }
    P.inventory['Logs'] = (P.inventory['Logs'] || 0) + 5;
    const before = A.count('Logs');
    if (!A.freightDeposit('Logs', 3)) { restore(); return 'deposit'; }
    if ((s.pool.Logs || 0) < 3 || A.count('Logs') !== before - 3) { restore(); return 'pool'; }
    if (!A.freightWithdraw('Logs', 2) || A.count('Logs') !== before - 1) { restore(); return 'withdraw'; }
    A._freightForcePull = true;
    const bag = A.freightInv(P.inventory);
    const merged = (bag.Logs || 0) >= A.count('Logs') + (s.pool.Logs || 0) - (s.pool.Logs || 0) && (bag.Logs || 0) >= A.count('Logs');
    // bag should include the remaining pool log
    const okMerge = (bag.Logs || 0) === A.count('Logs') + (s.pool.Logs || 0);
    const consumed = A.freightConsume('Logs', 1);
    A._freightForcePull = false;
    if (!A.freightUnlink(id, 'hold')) { restore(); return 'unlink'; }
    const leftover = s.pool.Logs || 0; // consume removed the last deposited log
    restore();
    return !!(okMerge && consumed && leftover === 0 && merged);
  };
}
