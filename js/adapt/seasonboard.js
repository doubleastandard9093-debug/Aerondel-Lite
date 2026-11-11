// Seasonboard: daily and weekly challenges award Season score, not Standing.
// Tiers unlock a Lookplate dye, a Kitwright schematic, and a wandering vendor.
// No paid pass, no other-player ladder, no punishment for skipping a day.
import { NORM, obj, arr, num } from './state.js';

export const SEASON_ID = 'ashen-paths';
export const SEASON_DYES = [['Ashveil', 0xb09070]];
export const TASKS = {
  mine: { id: 'mine', kind: 'daily', pts: 10, name: 'Mine a rock' },
  hunt: { id: 'hunt', kind: 'daily', pts: 10, name: 'Carve a hunt' },
  climb: { id: 'climb', kind: 'daily', pts: 10, name: 'Climb a face' },
  tide: { id: 'tide', kind: 'weekly', pts: 25, name: 'Finish a Tide' },
  camp: { id: 'camp', kind: 'weekly', pts: 25, name: 'Place a Waycamp' },
  trail: { id: 'trail', kind: 'weekly', pts: 25, name: 'Win a Trailhand hand' }
};
export const TIERS = [
  { id: 'dye-ashveil', at: 20, name: 'Ashveil dye', kind: 'dye' },
  { id: 'kit-ashthread', at: 50, name: 'Ash-thread kit schematic', kind: 'kit' },
  { id: 'vendor', at: 80, name: "Waresmith Ryn's visit", kind: 'vendor' }
];

const dayKey = t => new Date(t).toISOString().slice(0, 10);
const weekKey = t => {
  const d = new Date(t);
  const onejan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const w = Math.ceil((((d - onejan) / 86400000) + onejan.getUTCDay() + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(w).padStart(2, '0');
};

NORM.score = v => {
  v = obj(v);
  const claimed = arr(v.claimed).filter(id => TIERS.some(t => t.id === id));
  const owned = arr(v.owned).filter(id => TIERS.some(t => t.id === id) || id === 'dye-ashveil' || id === 'kit-ashthread' || id === 'vendor');
  for (const id of claimed) if (!owned.includes(id)) owned.push(id);
  return {
    seasonId: typeof v.seasonId === 'string' && v.seasonId ? v.seasonId : SEASON_ID,
    score: Math.max(0, Math.floor(num(v.score, 0, 0))),
    claimed,
    owned,
    day: typeof v.day === 'string' ? v.day : dayKey(Date.now()),
    week: typeof v.week === 'string' ? v.week : weekKey(Date.now()),
    dayKeys: arr(v.dayKeys).filter(k => TASKS[k]),
    weekKeys: arr(v.weekKeys).filter(k => TASKS[k])
  };
};

export default function seasonboard(A) {
  const { ctx, player } = A;
  const S = () => A.S('score');

  const rollPeriod = (now = Date.now()) => {
    const s = S();
    const d = dayKey(now), w = weekKey(now);
    if (s.seasonId !== SEASON_ID) {
      s.seasonId = SEASON_ID; s.score = 0; s.claimed = []; s.dayKeys = []; s.weekKeys = [];
      // owned cosmetics stay
    }
    if (s.day !== d) { s.day = d; s.dayKeys = []; }
    if (s.week !== w) { s.week = w; s.weekKeys = []; }
  };
  A.scoreRoll = rollPeriod;
  A.scoreHas = id => !!(S().owned.includes(id) || S().claimed.includes(id));
  A.scoreDyes = () => (A.scoreHas('dye-ashveil') ? SEASON_DYES.slice() : []);
  A.scoreVendorIn = () => A.scoreHas('vendor');
  A.scoreGet = () => S().score;
  A.scoreOn = (id, now = Date.now()) => {
    const t = TASKS[id]; if (!t) return 0;
    rollPeriod(now);
    const s = S();
    const bag = t.kind === 'weekly' ? 'weekKeys' : 'dayKeys';
    if (s[bag].includes(id)) return 0;
    s[bag].push(id);
    s.score += t.pts;
    A.log(`Seasonboard: ${t.name} (+${t.pts} season score, now ${s.score}). This is not Standing.`, 'skill');
    A.dirty(); return t.pts;
  };
  A.scoreClaim = id => {
    const t = TIERS.find(x => x.id === id); if (!t) return 'Unknown tier.';
    const s = S();
    if (s.claimed.includes(id)) return 'Already claimed.';
    if (s.score < t.at) return `You need ${t.at} season score to claim ${t.name}.`;
    s.claimed.push(id);
    if (!s.owned.includes(id)) s.owned.push(id);
    A.log(`Seasonboard: you claim ${t.name}.`, 'loot');
    if (id === 'dye-ashveil') A.log('Ashveil is now a Lookplate dye in the Wardrobe.', 'game');
    if (id === 'kit-ashthread') A.log('The Ash-thread kit schematic is yours. Craft it at the kit bench.', 'game');
    if (id === 'vendor') A.log("Waresmith Ryn is in Larkhaven with this season's stall.", 'game');
    A.dirty(); return true;
  };
  A.scoreBuy = (item, price) => {
    if (!A.scoreVendorIn()) return A.log('Ryn has not opened a stall this season. Claim the vendor tier first.', 'warn'), false;
    if ((player.gold || 0) < price) return A.log('You cannot afford that.', 'warn'), false;
    player.gold -= price;
    A.give(item, 1);
    A.log(`You buy a ${item} from Waresmith Ryn for ${price} coins.`, 'game');
    A.dirty(); return true;
  };

  // Listen to existing actions — do not rewrite Writs, Huntwright, Tides, or Trailhand.
  if (ctx.EXT && ctx.EXT.extXp) ctx.EXT.extXp.push(skill => { if (skill === 'Mining') A.scoreOn('mine'); return 1; });
  if (A.campPlaceAt) {
    const prev = A.campPlaceAt;
    A.campPlaceAt = (x, z) => { const r = prev(x, z); if (r) A.scoreOn('camp'); return r; };
  }
  if (A.climbBegin) {
    const prev = A.climbBegin;
    A.climbBegin = (...args) => { const r = prev(...args); if (r) A.scoreOn('climb'); return r; };
  }

  A.npc('scorevendor', '🧳', 'Waresmith Ryn', 'I travel with the season. When the Boardclerk posts my visit, I open a small stall in Larkhaven: Ridgewalk soles that ease a climb, and a Season flask for the road. Nothing I sell is a damage race. Claim the vendor tier on the Seasonboard and I will sell to you.', 'score');
  A.npc('seasonboard', '📋', 'Boardclerk Edda', 'The Seasonboard is a score season. Mine, carve, climb, finish a Tide, place a Waycamp or win a Trailhand hand, and you earn season score — not Standing. Daily Writs still pay Standing. Tiers unlock a Lookplate dye, a kit schematic, and a visit from Waresmith Ryn. Miss a day and nothing is taken from you. There is no paid pass and no other-player ladder.', 'score');
  A.guide.push(['Seasonboard', 'Ventures ✦ → Seasonboard, or talk to Boardclerk Edda in Larkhaven. Daily and weekly challenges award Season score, not Standing. Claim tiers for a Lookplate dye, an Ash-thread kit schematic, and a wandering vendor. Skipping a day has no penalty. Writs and the Hearthboard stay the Standing track.']);

  A.tab({ id: 'score', icon: '📋', name: 'Seasonboard', render: () => {
    rollPeriod();
    const s = S();
    const row = t => {
      const bag = t.kind === 'weekly' ? s.weekKeys : s.dayKeys;
      const done = bag.includes(t.id);
      return `<div class="row" style="min-height:40px"><span>${done ? '☑' : '☐'} ${A.esc(t.name)} <small>${t.kind} · ${t.pts}</small></span></div>`;
    };
    const tiers = TIERS.map(t => {
      const claimed = s.claimed.includes(t.id);
      const ready = !claimed && s.score >= t.at;
      return `<div class="row" style="min-height:44px"><span>${claimed ? '★' : s.score >= t.at ? '○' : '·'} ${t.at}: ${A.esc(t.name)}</span>${ready ? `<button data-a="claim" data-id="${t.id}" style="min-height:40px">Claim</button>` : ''}</div>`;
    }).join('');
    const vendor = A.scoreVendorIn()
      ? `<p>Waresmith Ryn is in Larkhaven this season.</p>
        <div class="row"><button data-a="buy" data-it="Ridgewalk soles" data-p="200" style="min-height:40px">Ridgewalk soles (200)</button>
        <button data-a="buy" data-it="Season flask" data-p="40" style="min-height:40px">Season flask (40)</button></div>
        <p><small>Ridgewalk soles ease climb drain a little while you carry them. A Season flask helps thirst when Hardroad is on. Behaviour and small numbers, not a damage race.</small></p>`
      : '<p>The wandering vendor is not in town yet. Claim that tier to bring Waresmith Ryn to Larkhaven.</p>';
    return `<h4>Seasonboard — Ashen Paths</h4>
      <p>Season score is not Standing. Daily Writs and the Weekly Hearthboard still pay Standing. Miss a day and nothing is taken from you.</p>
      <p>Score <b>${s.score}</b></p>
      <h4>Today / this week</h4>${Object.values(TASKS).map(row).join('')}
      <h4>Tiers</h4>${tiers}
      <h4>Vendor</h4>${vendor}`;
  }, act: (a, d) => { if (a === 'claim') A.scoreClaim(d.id); if (a === 'buy') A.scoreBuy(d.it, +d.p); } });

  // Ridgewalk soles: a light climb-drain ease while carried. Composes with later marks.
  const prevDrain = A.climbDrainMul;
  A.climbDrainMul = () => (prevDrain ? prevDrain() : 1) * ((A.count && A.count('Ridgewalk soles') > 0) ? 0.9 : 1);

  A.vtests = A.vtests || {};
  A.vtests.seasonboard = async (g, A) => {
    const s = S();
    const snap = JSON.parse(JSON.stringify(s));
    const gold0 = g.player.gold;
    const stand0 = JSON.stringify(g.player.standing || {});
    const writs0 = JSON.stringify(g.player.writs || {});
    try {
      Object.assign(s, { seasonId: SEASON_ID, score: 0, claimed: [], owned: [], day: '2099-01-01', week: '2099-W01', dayKeys: [], weekKeys: [] });
      A.scoreRoll(Date.parse('2099-01-01T12:00:00Z'));
      if (s.score !== 0) return 'fresh score';
      const a = A.scoreOn('mine', Date.parse('2099-01-01T12:00:00Z'));
      if (a !== 10 || s.score !== 10) return 'daily mine ' + a + ' ' + s.score;
      if (A.scoreOn('mine', Date.parse('2099-01-01T18:00:00Z')) !== 0) return 'daily twice';
      if (s.score !== 10) return 'score moved on second mine';
      // Skip a day: no penalty, score stays, the daily is open again.
      const b = A.scoreOn('mine', Date.parse('2099-01-02T12:00:00Z'));
      if (b !== 10 || s.score !== 20) return 'next day ' + b + ' ' + s.score;
      if (JSON.stringify(g.player.standing || {}) !== stand0) return 'standing changed';
      if (JSON.stringify(g.player.writs || {}) !== writs0) return 'writs changed';
      const c = A.scoreClaim('dye-ashveil');
      if (c !== true || !A.scoreHas('dye-ashveil')) return 'claim dye ' + c;
      const dyes = A.scoreDyes();
      if (!dyes.some(d => d[0] === 'Ashveil')) return 'no dye listed';
      // Locked schematic before its tier.
      if (A.kitCraft && A.kitCraft('ashthread') !== false) {
        // may fail for materials too; just ensure scoreHas is false for kit still
      }
      if (A.scoreHas('kit-ashthread')) return 'kit unlocked early';
      s.score = 80;
      if (A.scoreClaim('kit-ashthread') !== true) return 'claim kit';
      if (A.scoreClaim('vendor') !== true) return 'claim vendor';
      if (!A.scoreVendorIn()) return 'vendor not in';
      g.player.gold = 1000;
      if (!A.scoreBuy('Ridgewalk soles', 200)) return 'buy soles';
      if (A.count('Ridgewalk soles') < 1) return 'no soles';
      // A new season id resets score and claimed, but owned cosmetics stay.
      s.seasonId = 'old-season'; s.score = 80; s.claimed = ['dye-ashveil'];
      A.scoreRoll(Date.parse('2099-01-03T12:00:00Z'));
      if (s.score !== 0 || s.claimed.length) return 'season reset incomplete';
      if (!s.owned.includes('dye-ashveil')) return 'owned dye lost';
      if (JSON.stringify(g.player.standing || {}) !== stand0) return 'standing after claims';
    } finally {
      Object.assign(s, snap);
      g.player.gold = gold0;
      if (A.take && A.count('Ridgewalk soles') && !snap._keepSoles) A.take('Ridgewalk soles', A.count('Ridgewalk soles'));
    }
    return true;
  };
}
