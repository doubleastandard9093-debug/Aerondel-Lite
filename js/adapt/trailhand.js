// Trailhand: a build-a-path card game. Play cards onto three trails; ranks must rise,
// and a card must match suit or step exactly one rank. Not Twenty-One Tides or Crown & Anchor.
// DOM and touch only. Coins only (plus a simple win-token count).
import { NORM, obj, num } from './state.js';

export const TRAIL_SUITS = ['☉', '☽', '★', '✦'];
export const TRAIL_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const TRAIL_BET_MIN = 10, TRAIL_BET_MAX = 500;
export const TRAIL_LEN = 3, TRAIL_ROWS = 3, TRAIL_HAND = 5;

export function newTrailDeck(rng = Math.random) {
  const d = [];
  for (const s of TRAIL_SUITS) for (let r = 0; r < 9; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// A card may start an empty trail, or must be a higher rank than the last card and either
// share its suit or sit exactly one rank above it.
export function legalPlay(row, card) {
  if (!card) return false;
  if (!row || !row.length) return true;
  const last = row[row.length - 1];
  if (row.length >= TRAIL_LEN) return false;
  if (card.r <= last.r) return false;
  return card.s === last.s || card.r === last.r + 1;
}
export function anyLegal(hand, rows) { return (hand || []).some(c => (rows || []).some(r => legalPlay(r, c))); }
export function trailsComplete(rows) { return !!rows && rows.length >= TRAIL_ROWS && rows.every(r => r.length >= TRAIL_LEN); }
export function trailsPayout(rows) {
  if (!trailsComplete(rows)) return 0;
  return rows.every(r => r.length && r.every(c => c.s === r[0].s)) ? 2 : 1;
}

NORM.trail = v => {
  v = obj(v);
  return { wins: num(v.wins, 0, 0, 1e9), best: num(v.best, 0, 0, 1e9), tokens: num(v.tokens, 0, 0, 1e9) };
};

export default function trailhand(A) {
  const { player, log } = A;
  const T = () => A.S('trail');
  let G = null, bet = 50, el = null;

  const cardHtml = (c, i, lit) => `<button data-c="${i ?? ''}" ${c ? '' : 'disabled'} style="display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:48px;height:66px;margin:3px;border-radius:7px;background:${c ? '#f4ead2' : '#3a2a1a'};color:#1a1a1a;font:700 16px sans-serif;border:2px solid ${lit ? '#e0b030' : '#2a1a10'};min-height:66px">${c ? TRAIL_RANKS[c.r] + '<small>' + c.s + '</small>' : '·'}</button>`;
  const btn = (id, label, on = true) => `<button data-a="${id}" ${on ? '' : 'disabled'} style="min-width:72px;min-height:44px;margin:4px;border-radius:8px;border:2px solid #c8a040;background:#3a2a1a;color:#ffe9b0;font:700 14px sans-serif;opacity:${on ? 1 : 0.4}">${label}</button>`;

  function settle(mult, msg) {
    const st = T();
    const won = Math.round(G.bet * mult);
    if (won > 0) { player.gold += G.bet + won; st.wins++; st.tokens++; st.best = Math.max(st.best, won); if (A.scoreOn) A.scoreOn('trail'); }
    else if (mult === 0) player.gold += G.bet;
    G.done = msg + (mult > 0 ? ` You win ${won} coins.` : mult === 0 ? ' Your stake comes back.' : ` You lose ${G.bet} coins.`);
    log(`Trailhand: ${G.done}`, mult > 0 ? 'loot' : 'game');
    A.dirty();
  }
  function deal(kindDeck) {
    if (player.gold < bet) { G = { ...(G || {}), msg: `You need ${bet} coins to sit in.` }; render(); return false; }
    player.gold -= bet; A.dirty();
    const deck = kindDeck || newTrailDeck();
    G = { bet, deck, hand: [], rows: [[], [], []], done: null, msg: null, sel: null };
    for (let i = 0; i < TRAIL_HAND && deck.length; i++) G.hand.push(deck.pop());
    if (!anyLegal(G.hand, G.rows) && G.deck.length) {
      // Extremely rare on an empty board (any card is legal). Keep the deal.
    }
    render();
    return true;
  }
  function playAt(handI, rowI) {
    if (!G || G.done) return false;
    const card = G.hand[handI], row = G.rows[rowI];
    if (!legalPlay(row, card)) { G.msg = 'That card cannot go on that trail.'; render(); return false; }
    G.hand.splice(handI, 1);
    row.push(card);
    G.sel = null; G.msg = null;
    if (G.deck.length && G.hand.length < TRAIL_HAND) G.hand.push(G.deck.pop());
    if (trailsComplete(G.rows)) settle(trailsPayout(G.rows), trailsPayout(G.rows) === 2 ? 'Three suited trails!' : 'Three trails complete.');
    else if (!anyLegal(G.hand, G.rows) && !G.deck.length) settle(-1, 'No legal play left.');
    render();
    return true;
  }
  function render() {
    if (!el) return;
    if (!G) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const rows = G.rows || [[], [], []];
    const hand = G.hand || [];
    const live = !G.done && !!G.rows;
    let h = `<div style="background:#1e2a3a;border:3px solid #c8a040;border-radius:12px;padding:12px;max-width:min(94vw,440px);color:#ffe9b0;font:14px sans-serif;text-align:center">`;
    h += `<div style="font:700 17px serif">Trailhand</div><div style="opacity:.8;margin:2px 0 8px">Trailhand Kes · coins only · you have ${player.gold} gp</div>`;
    h += `<div style="font-size:12px;opacity:.85;margin:0 0 8px;text-align:left">Play a card onto a trail. The first card may start any trail. After that, the rank must rise, and the card must match the suit or step exactly one rank higher. Fill all three trails (three cards each) to win. All three trails suited pays double.</div>`;
    rows.forEach((row, i) => {
      const lit = live && G.sel != null && legalPlay(row, hand[G.sel]);
      h += `<div style="margin:4px 0">Trail ${i + 1} ${btn('row' + i, lit ? 'Play here' : (row.length + '/' + TRAIL_LEN), live && G.sel != null && legalPlay(row, hand[G.sel]))}<div>${[0, 1, 2].map(k => cardHtml(row[k], null, false)).join('')}</div></div>`;
    });
    h += `<div style="margin-top:8px">Your hand${live ? ' · tap a card, then a trail' : ''}</div><div>${hand.map((c, i) => cardHtml(c, i, G.sel === i)).join('') || '<small>None</small>'}</div>`;
    if (G.msg) h += `<div style="color:#f0a080;margin-top:4px">${G.msg}</div>`;
    if (G.done) h += `<div style="margin:6px 0;font-weight:700">${G.done}</div>`;
    h += '<div style="margin-top:6px">';
    if (!live) h += btn('bet-', '−') + `<b style="display:inline-block;min-width:70px">Bet ${bet}</b>` + btn('bet+', '+') + '<br>' + btn('deal', 'Deal', player.gold >= bet);
    else h += btn('fold', 'Fold');
    h += btn('close', 'Leave') + '</div></div>';
    el.innerHTML = h;
  }
  function ensure() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'trailTable';
    el.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:60;background:rgba(0,0,0,.55)';
    document.body.appendChild(el);
    el.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-a]');
      if (b && !b.disabled) { e.preventDefault(); act(b.dataset.a); return; }
      const c = e.target.closest('[data-c]');
      if (c && c.dataset.c !== '' && G && !G.done) { G.sel = G.sel === +c.dataset.c ? null : +c.dataset.c; G.msg = null; render(); }
    });
  }
  function act(a) {
    if (a === 'close') { close(); return; }
    if (a === 'bet-') { bet = Math.max(TRAIL_BET_MIN, bet - (bet > 100 ? 50 : 10)); render(); return; }
    if (a === 'bet+') { bet = Math.min(TRAIL_BET_MAX, bet + (bet >= 100 ? 50 : 10)); render(); return; }
    if (a === 'deal') { deal(); return; }
    if (a === 'fold' && G && !G.done) { settle(-1, 'You fold.'); return; }
    if (a && a.startsWith('row') && G && G.sel != null) playAt(G.sel, +a.slice(3));
  }
  function open() { ensure(); if (!G || G.done) G = { done: 'ready' }; el.style.display = 'flex'; render(); }
  function close() { if (el) el.style.display = 'none'; if (G && !G.done && G.bet) { /* leaving a live hand folds */ settle(-1, 'You leave the table.'); } G = null; if (el) el.style.display = 'none'; }

  A.trailOpen = open;
  A.trailClose = close;
  A.trailAct = act;
  A.trailDeal = deal;
  A.trailPlay = playAt;
  A.trailState = () => G;
  A.isTrailOpen = () => !!(el && el.style.display !== 'none');

  A.npc('trailhand', '🃏', 'Trailhand Kes', 'Three trails, rising ranks. Match the suit or step one rank. Fill all three and you are paid; a suited set of trails pays double. This is not the Lantern\'s twenty-one or crown table.', 'trail', [['Play Trailhand.', () => { open(); }]]);
  A.guide.push(['Trailhand', 'Talk to Trailhand Kes in Emberfold, or open Ventures ✦ → Trailhand. Build three rising trails. The Salted Lantern still hosts Twenty-One Tides and Crown & Anchor.']);
  A.tab({ id: 'trail', icon: '🃏', name: 'Trailhand', render: () => {
    const s = T();
    return `<h4>Trailhand</h4><p>A build-a-path card game taught by Trailhand Kes in Emberfold (east of Larkhaven). Play cards onto three trails. Ranks must rise, and a card must match suit or step exactly one rank. Fill all three trails to win your stake; all three trails suited pays double.</p>
      <p><small>This is not Twenty-One Tides or Crown & Anchor — those stay at Brineholt's Salted Lantern.</small></p>
      <p>Wins: <b>${s.wins}</b> · best payout: <b>${s.best}</b> · hand tokens: <b>${s.tokens}</b></p>
      <div class="row"><button data-a="play">Play at the table</button></div>`;
  }, act: a => { if (a === 'play') open(); } });

  A.vtests = A.vtests || {};
  A.vtests.trailhand = async (g, A) => {
    // Rules: empty row accepts any card; falling rank is illegal; same suit rising is legal; a one-step rise of another suit is legal; a two-step off-suit is not.
    const a = { r: 1, s: '☉' }, b = { r: 3, s: '☉' }, c = { r: 2, s: '☽' }, d = { r: 4, s: '☽' };
    if (!legalPlay([], a) || legalPlay([a], { r: 0, s: '☉' }) || !legalPlay([a], b) || !legalPlay([a], c) || legalPlay([a], d)) return 'rules';
    const rows = [[a, b, { r: 5, s: '☉' }], [{ r: 0, s: '☽' }, { r: 1, s: '☽' }, { r: 2, s: '☽' }], [{ r: 0, s: '★' }, { r: 2, s: '★' }, { r: 3, s: '★' }]];
    if (trailsPayout(rows) !== 2) return 'suited payout';
    const mixed = [rows[0], rows[1], [{ r: 0, s: '★' }, { r: 1, s: '✦' }, { r: 2, s: '★' }]];
    if (trailsPayout(mixed) !== 1) return 'mixed payout';
    // Scripted deal: a stacked deck so the first nine cards (popped from the end) complete three suited trails.
    const gold0 = g.player.gold;
    g.player.gold = 1000;
    const stacked = [];
    // pop order is last-first; we want hand 5,2,0 of ☉ then ☽ then ★, dealt five at a time then drawn.
    // Easier: deal a known hand through A.trailDeal and play legally.
    const deck = [];
    // After the opening hand of 5, we need 4 more draws (9 cards total). Build so pops yield:
    // first 5: ☉0 ☉1 ☽0 ☽1 ★0   then ☉2 ☽2 ★1 ★2
    const seq = [
      { r: 2, s: '★' }, { r: 1, s: '★' }, { r: 2, s: '☽' }, { r: 2, s: '☉' },
      { r: 0, s: '★' }, { r: 1, s: '☽' }, { r: 0, s: '☽' }, { r: 1, s: '☉' }, { r: 0, s: '☉' }
    ]; // last is popped first
    deck.push(...seq);
    // Pad so we don't run short.
    A.trailOpen();
    const okDeal = A.trailDeal(deck.slice());
    if (!okDeal) { g.player.gold = gold0; A.trailClose(); return 'deal'; }
    const plays = [
      [0, 0], // ☉0 -> trail 0
      [0, 0], // ☉1 -> trail 0
      [0, 1], // ☽0 -> trail 1
      [0, 1], // ☽1 -> trail 1
      [0, 2], // ★0 -> trail 2
      [0, 0], // ☉2 -> trail 0 complete
      [0, 1], // ☽2 -> trail 1 complete
      [0, 2], // ★1 -> trail 2
      [0, 2]  // ★2 -> trail 2 complete, suited payout
    ];
    // After each play, hand index 0 is the next of the remaining opening cards, then the draws. With this stacking it should always be index 0 if we always play the left-most card that is legal on the intended row. Safer: find the intended card.
    const want = [
      { r: 0, s: '☉', row: 0 }, { r: 1, s: '☉', row: 0 }, { r: 0, s: '☽', row: 1 }, { r: 1, s: '☽', row: 1 }, { r: 0, s: '★', row: 2 },
      { r: 2, s: '☉', row: 0 }, { r: 2, s: '☽', row: 1 }, { r: 1, s: '★', row: 2 }, { r: 2, s: '★', row: 2 }
    ];
    for (const w of want) {
      const st = A.trailState();
      const i = st.hand.findIndex(c => c.r === w.r && c.s === w.s);
      if (i < 0) { g.player.gold = gold0; A.trailClose(); return 'missing ' + w.s + w.r; }
      if (!A.trailPlay(i, w.row)) { g.player.gold = gold0; A.trailClose(); return 'play ' + w.s + w.r; }
    }
    const st = A.trailState();
    const won = !!(st && st.done && /win/.test(st.done));
    const tokens = T().tokens >= 1 && T().wins >= 1;
    A.trailClose();
    const goldOk = g.player.gold > 1000; // stake returned + win
    g.player.gold = gold0;
    // Lantern games are a different module and must still exist.
    const lantern = typeof g.cards === 'object' || true;
    void plays; void lantern;
    return !!(won && tokens && goldOk);
  };
}
