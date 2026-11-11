// Wardfine: a failed pickpocket raises a town fine, then a guard stop: pay, wait at the keep, or resist.
// Larkhaven is always solvable (pay, wait, or walk to the bank). Unique and quest items are never taken.
// This is not a prison-crawl. Crossed Banners may make a Wary town quicker to fine, but the fine stays payable.
import { ITEMS } from '../items.js';
import { isUniqueGear } from './kitwright.js';
import { TOWNS } from '../world.js';
import { nearestTown } from './banners.js';
import { factionForTown } from '../standing.js';
import { NORM, obj, num } from './state.js';

export const TOWN_R = 16, WAIT_MS = 1400, UNWELCOME_MS = 10 * 60 * 1000, FLEE_R = 28;
export const KEEPS = {
  Larkhaven: { x: -6, z: -3.5 },
  Emberfold: { x: 48, z: -23 },
  Saltreach: { x: -80, z: 53 },
  Highcrest: { x: 124, z: -25 },
  Whitecairn: { x: -56, z: -73 }
};
export const FINE_OF = { Man: 20, Woman: 20, Farmer: 25, Sailor: 35, Warrior: 40, Guard: 60, Knight: 80, Paladin: 90, Hero: 120 };

NORM.keep = v => {
  v = obj(v);
  const fines = {}, heat = {}, unwelcome = {};
  for (const n of Object.keys(KEEPS)) {
    const f = Math.max(0, Math.floor(num((v.fines || {})[n], 0, 0)));
    if (f) fines[n] = f;
    const h = Math.max(0, Math.floor(num((v.heat || {})[n], 0, 0)));
    if (h) heat[n] = h;
    const u = Math.max(0, Math.floor(num((v.unwelcome || {})[n], 0, 0)));
    if (u) unwelcome[n] = u;
  }
  const held = {};
  for (const [it, n] of Object.entries(obj(v.held))) {
    const q = Math.max(0, Math.floor(num(n, 0, 0, 1e6)));
    if (q > 0 && typeof it === 'string') held[it] = q;
  }
  return { fines, heat, unwelcome, held, heldTown: typeof v.heldTown === 'string' && KEEPS[v.heldTown] ? v.heldTown : '', jailUntil: Math.max(0, Math.floor(num(v.jailUntil, 0, 0))) };
};

export default function wardfine(A) {
  const { ctx, player } = A;
  const S = () => A.S('keep');
  const state = { stop: null, resist: null };

  A.townAt = (x, z) => {
    const n = nearestTown(x, z);
    const t = TOWNS[n];
    if (!t || Math.hypot((t.x || 0) - x, (t.z || 0) - z) > TOWN_R) return null;
    return n;
  };
  A.keepPos = town => KEEPS[town] || KEEPS.Larkhaven;
  A.fineOf = town => (S().fines[town] || 0);
  A.fineTotal = () => Object.values(S().fines).reduce((a, b) => a + b, 0);
  A.fineUnwelcome = town => (S().unwelcome[town] || 0) > Date.now();
  const waryTown = town => {
    const f = factionForTown && factionForTown(town);
    return !!(f && A.bannerWary && A.bannerWary(f.id));
  };

  const protectedItem = it => {
    const info = ITEMS[it] || {};
    return !!(isUniqueGear(it) || info.quest || info.questItem || info.questCape || info.type === 'quest');
  };

  const closeStop = () => {
    state.stop = null;
    const el = typeof document !== 'undefined' && document.getElementById('keepStop');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };
  const renderStop = () => {
    if (typeof document === 'undefined' || !state.stop) return;
    let el = document.getElementById('keepStop');
    if (!el) {
      el = document.createElement('div');
      el.id = 'keepStop';
      el.style.cssText = 'position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;';
      document.body.appendChild(el);
    }
    const st = state.stop, s = S(), town = st.town, amt = s.fines[town] || st.amount;
    const canPay = (player.gold || 0) >= amt;
    const later = town === 'Larkhaven'
      ? `<button data-k="later" style="min-height:44px">Go to the bank</button>`
      : '';
    el.innerHTML = `<div style="background:#1c1e23;color:#f0e6d0;border:1px solid #c8a050;border-radius:10px;padding:16px;max-width:360px;width:100%;font-size:15px;">
      <h3 style="margin:0 0 8px">A guard stops you</h3>
      <p>You were caught in <b>${A.esc(town)}</b>. The fine is <b>${amt} coins</b>. You may pay, wait at the keep (ordinary items are held and returned; uniques stay with you), or resist. Larkhaven is always solvable: you can also walk to the bank and pay.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button data-k="pay" style="min-height:44px"${canPay ? '' : ' disabled'}>Pay ${amt}c</button>
        <button data-k="wait" style="min-height:44px">Wait at the keep</button>
        <button data-k="resist" style="min-height:44px">Resist</button>
        ${later}
      </div>
      ${canPay ? '' : `<p><small>You do not have enough coins on you. Wait, or${town === 'Larkhaven' ? ' go to the bank' : ' come back to pay'}.</small></p>`}
    </div>`;
    el.onclick = ev => {
      const b = ev.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'pay') A.finePay(town);
      if (k === 'wait') A.fineWait(town);
      if (k === 'resist') A.fineResist(town);
      if (k === 'later') { closeStop(); A.log('The fine still stands. The bank is open.', 'game'); }
    };
  };

  A.fineIssue = (town, amount, opts = {}) => {
    if (!KEEPS[town]) return false;
    let amt = Math.max(10, Math.floor(amount));
    if (waryTown(town)) amt = Math.ceil(amt * 1.25);
    S().fines[town] = (S().fines[town] || 0) + amt;
    S().heat[town] = (S().heat[town] || 0) + (waryTown(town) ? 2 : 1);
    A.dirty();
    return S().fines[town];
  };
  A.fineOnFail = (node, targetType) => {
    const p = (node && Number.isFinite(node.x)) ? node : (A.pos && A.pos()) || {};
    const town = A.townAt(p.x, p.z);
    if (!town) return false;
    const amt = FINE_OF[targetType] || 25;
    A.fineIssue(town, amt);
    state.stop = { town, amount: S().fines[town], from: { x: p.x, z: p.z } };
    A.log(`A guard stops you in ${town}. The fine is ${S().fines[town]} coins — pay, wait at the keep, or resist. This is no longer only a stun.`, 'warn');
    renderStop();
    A.dirty();
    return true;
  };
  A.finePay = town => {
    town = town || (state.stop && state.stop.town);
    const amt = S().fines[town] || 0;
    if (!amt) return A.log('You owe no fine there.', 'game'), false;
    if ((player.gold || 0) < amt) return A.log('You do not have enough coins on you. The bank is still open in Larkhaven.', 'warn'), false;
    player.gold -= amt;
    delete S().fines[town];
    delete S().unwelcome[town];
    closeStop();
    A.log(`You pay the ${amt} coin fine in ${town}. The mark is cleared.`, 'game');
    A.dirty(); return true;
  };
  const giveBack = () => {
    const s = S();
    for (const [it, n] of Object.entries(s.held)) A.give(it, n);
    s.held = {}; s.heldTown = ''; s.jailUntil = 0;
  };
  A.fineWake = (opts = {}) => {
    const s = S();
    const town = s.heldTown || (state.stop && state.stop.town) || 'Larkhaven';
    const k = A.keepPos(town);
    if (ctx.travelTo && !opts.noTravel) ctx.travelTo(k.x, k.z);
    giveBack();
    if (s.fines[town]) delete s.fines[town];
    delete s.unwelcome[town];
    closeStop();
    A.log(`You wake at the ${town} keep door. Ordinary items are returned. Unique and quest items were never taken.`, 'game');
    A.dirty(); return true;
  };
  A.fineWait = (town, opts = {}) => {
    town = town || (state.stop && state.stop.town);
    if (!KEEPS[town]) return false;
    const s = S();
    // Hold ordinary pack items; uniques and quest items stay.
    s.held = {};
    for (const [it, n] of Object.entries(player.inventory || {})) {
      if (!n || protectedItem(it)) continue;
      s.held[it] = n;
      A.take(it, n);
    }
    s.heldTown = town;
    s.jailUntil = Date.now() + (opts.instant ? 0 : WAIT_MS);
    closeStop();
    A.log('You agree to wait at the keep. Ordinary items are held and will be returned. Unique and quest items stay with you.', 'game');
    A.dirty();
    const finish = () => A.fineWake({ noTravel: !!opts.noTravel && !opts.travel, ...(opts.instant ? {} : {}) });
    if (opts.instant) return A.fineWake({ noTravel: opts.noTravel });
    if (typeof setTimeout === 'function') setTimeout(() => { if (S().jailUntil) A.fineWake(); }, WAIT_MS);
    return true;
  };
  A.fineResist = town => {
    town = town || (state.stop && state.stop.town);
    if (!KEEPS[town]) return false;
    const extra = Math.max(40, Math.round((S().fines[town] || 40) * 0.5));
    S().fines[town] = (S().fines[town] || 0) + extra;
    closeStop();
    const p = (A.pos && A.pos()) || A.keepPos(town);
    const spawn = ctx.spawnMonster || ctx.addMonster;
    let g = null;
    if (spawn) {
      g = spawn.call(ctx, 'Guard', p.x + 2, p.z + 1, 2);
      if (g) { g.name = 'Town guard'; g.keepGuard = true; g.keepTown = town; g.respawn = 1e12; g.level = Math.max(g.level || 1, 20); }
    }
    state.resist = { town, guard: g, at: { x: p.x, z: p.z }, start: Date.now() };
    A.log(`You resist! A town guard steps in, and the fine in ${town} rises to ${S().fines[town]}. Fleeing will leave you unwelcome until you pay or time passes.`, 'warn');
    A.dirty(); return true;
  };
  A.fineFlee = town => {
    town = town || (state.resist && state.resist.town) || (state.stop && state.stop.town);
    if (!KEEPS[town]) return false;
    S().unwelcome[town] = Date.now() + UNWELCOME_MS;
    if (state.resist && state.resist.guard) {
      const g = state.resist.guard;
      if (g) { g.alive = false; g.state = 'dead'; g.respawn = 1e12; if (g.mesh) g.mesh.visible = false; }
    }
    state.resist = null;
    A.log(`You flee ${town}. You are unwelcome there until the fine is paid, or a little time passes. Larkhaven's bank stays open.`, 'warn');
    A.dirty(); return true;
  };

  A.onReady.push(() => { if (S().jailUntil) A.fineWake(); });
  ctx.EXT.extTick.push(() => {
    if (S().jailUntil && Date.now() >= S().jailUntil) A.fineWake();
    if (state.resist) {
      const p = A.pos && A.pos();
      if (p && Math.hypot(p.x - state.resist.at.x, p.z - state.resist.at.z) > FLEE_R) A.fineFlee(state.resist.town);
    }
    const now = Date.now();
    for (const [t, until] of Object.entries(S().unwelcome)) if (until && until < now) delete S().unwelcome[t];
  });
  ctx.EXT.extKill.push(m => {
    if (m && m.keepGuard && state.resist && state.resist.guard === m) {
      state.resist = null;
      A.log('The guard falls. The fine still stands — pay it at Ventures ✦ → Wardfine, or at the keep.', 'warn');
    }
  });

  A.npc('wardfine', '⚖️', 'Wardclerk Penn', 'A failed pocket in town is no longer only a stun. A guard will stop you: pay the fine, wait at the keep, or resist. Unique and quest items are never taken. Larkhaven is always solvable — you can pay, wait, or walk to the bank. A Wary banner may make a town quicker to stop you, but the fine is always payable.', 'keep');
  A.guide.push(['Wardfine', 'Ventures ✦ → Wardfine, or talk to Wardclerk Penn by the Larkhaven bank. A failed pickpocket in a town raises a fine and a guard stop: Pay, Wait, or Resist. Waiting is a short fade; you wake at the keep door and ordinary items are returned. Unique and quest items are never taken. Resisting starts a short fight and a larger fine; fleeing leaves you unwelcome until you pay or time passes. Larkhaven, the bank and the Saga stay open.']);
  A.tab({ id: 'keep', icon: '⚖️', name: 'Wardfine', render: () => {
    const s = S(), total = A.fineTotal();
    const rows = Object.keys(KEEPS).map(t => {
      const f = s.fines[t] || 0, u = A.fineUnwelcome(t);
      return `<div class="row"><div><b>${A.esc(t)}</b> ${f ? `fine ${f}c` : 'clear'}${u ? ' · unwelcome' : ''}</div>${f ? `<button data-a="pay" data-k="${t}">Pay</button>` : ''}</div>`;
    }).join('');
    return `<h4>Wardfine</h4><p>A failed pickpocket in a town raises a fine. A guard will stop you: pay, wait at the keep, or resist. Unique and quest items are never taken. Larkhaven is always solvable. Total owed: <b>${total} coins</b>.</p>${rows}`;
  }, act: (a, d) => { if (a === 'pay') A.finePay(d.k); } });

  A.vtests = A.vtests || {};
  A.vtests.wardfine = async (g, A) => {
    const s = S();
    const snap = JSON.parse(JSON.stringify({ fines: s.fines, heat: s.heat, unwelcome: s.unwelcome, held: s.held, heldTown: s.heldTown, jailUntil: s.jailUntil, gold: g.player.gold, inv: { ...g.player.inventory } }));
    try {
      s.fines = {}; s.heat = {}; s.unwelcome = {}; s.held = {}; s.heldTown = ''; s.jailUntil = 0;
      const { thieve } = await import('/js/gameplay.js');
      const fail = thieve('Man', g.skills, g.player, () => 1);
      if (!(fail && fail.fail && fail.stun > 0)) return 'stun lost ' + JSON.stringify(fail);
      const p = A.pos && A.pos();
      if (p && (p.x !== 0 || p.z !== 0) && ctx.travelTo) { /* stay; tests issue directly */ }
      // Fail a pocket in Larkhaven (issued at the keep / bank).
      const node = { x: 0, z: 0, name: 'Man' };
      if (!A.fineOnFail(node, 'Man')) return 'no fine in Larkhaven';
      if (!A.fineOf('Larkhaven')) return 'fine not recorded';
      const total = A.fineTotal();
      g.player.gold = Math.max(g.player.gold || 0, total);
      if (!A.finePay('Larkhaven')) return 'pay';
      if (A.fineOf('Larkhaven') || A.fineTotal() !== 0) return 'mark not cleared';
      // Wait: unique stays, ordinary items return, wake at the keep.
      g.player.inventory['Logs'] = (g.player.inventory['Logs'] || 0) + 3;
      const uniq = 'Emberfang katana';
      g.player.inventory[uniq] = (g.player.inventory[uniq] || 0) + 1;
      const logs0 = A.count('Logs'), u0 = A.count(uniq);
      if (!A.fineOnFail(node, 'Man')) return 'reissue';
      if (!A.fineWait('Larkhaven', { instant: true, noTravel: true })) return 'wait';
      if (A.count(uniq) !== u0) return 'unique taken';
      if (A.count('Logs') !== logs0) return 'logs not returned ' + A.count('Logs') + ' ' + logs0;
      if (A.fineOf('Larkhaven')) return 'fine after wait';
      if (s.jailUntil || Object.keys(s.held).length) return 'held leftover';
      // Resist, flee, then pay later.
      g.player.gold = Math.max(g.player.gold || 0, 400);
      if (!A.fineOnFail(node, 'Guard')) return 'guard fail';
      const owed = A.fineOf('Larkhaven');
      if (!A.fineResist('Larkhaven')) return 'resist';
      if (A.fineOf('Larkhaven') <= owed) return 'fine did not rise';
      if (!A.fineFlee('Larkhaven')) return 'flee';
      if (!A.fineUnwelcome('Larkhaven')) return 'not unwelcome';
      g.player.gold = Math.max(g.player.gold || 0, A.fineOf('Larkhaven'));
      if (!A.finePay('Larkhaven')) return 'pay later';
      if (A.fineOf('Larkhaven') || A.fineUnwelcome('Larkhaven')) return 'still marked after late pay';
    } finally {
      s.fines = snap.fines; s.heat = snap.heat; s.unwelcome = snap.unwelcome; s.held = snap.held; s.heldTown = snap.heldTown; s.jailUntil = snap.jailUntil;
      g.player.gold = snap.gold;
      closeStop();
      state.resist = null; state.stop = null;
    }
    return true;
  };
}
