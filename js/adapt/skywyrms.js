// Skywyrms: occasional overworld flyers you can fight or leave. A kill yields a soul for Veilcraft.
// Not a Colossus and not a weekly chest. Ashwyrm stays on its Contested Wilds route. At most one sighting at a time.
import { REGION_DATA } from '../regiondata.js';
import { TOWNS } from '../world.js';
import { NORM, obj, num } from './state.js';

export const SOUL_CAP = 8, HUNTER_XP = 30, PRAYER_XP = 8;
export const CADENCE_MIN = 18 * 60 * 1000, CADENCE_SPAN = 10 * 60 * 1000, WARN_MS = 3 * 60 * 1000;
export const MAIN_TOWNS = ['Larkhaven', 'Emberfold', 'Saltreach', 'Highcrest', 'Whitecairn'];

NORM.wyrms = v => {
  v = obj(v);
  return {
    seen: Math.max(0, Math.floor(num(v.seen, 0, 0))),
    souls: Math.max(0, Math.min(SOUL_CAP, Math.floor(num(v.souls, 0, 0)))),
    last: Math.max(0, Math.floor(num(v.last, 0, 0))),
    best: Math.max(0, Math.floor(num(v.best, 0, 0))),
    next: Math.max(0, Math.floor(num(v.next, 0, 0)))
  };
};

const wildRegions = () => REGION_DATA.filter(R => {
  for (const n of MAIN_TOWNS) {
    const t = TOWNS[n]; if (t && Math.hypot(R.x - t.x, R.z - t.z) < (R.r || 40) + 30) return false;
  }
  return true;
});

export default function skywyrms(A) {
  const { ctx, player } = A;
  const S = () => A.S('wyrms');
  const isLow = () => !!(ctx.gfxQ === 'low' || (typeof ctx.gfxQ === 'function' && ctx.gfxQ() === 'low') || (player.settings && player.settings.gfx === 'low'));
  const state = { offered: null, active: null };
  if (!S().last) S().next = Date.now() + CADENCE_MIN + Math.random() * CADENCE_SPAN;
  else S().next = S().next || (S().last + CADENCE_MIN);

  const clearFoe = m => {
    if (!m) return;
    m.alive = false; m.state = 'dead'; m.respawn = 1e12;
    if (m.mesh) m.mesh.visible = false;
  };
  const clearActive = () => {
    if (!state.active) return;
    clearFoe(state.active.wyrm);
    for (const a of state.active.atts || []) clearFoe(a);
    state.active = null;
  };
  const pickRegion = pref => pref || wildRegions()[Math.floor(Math.random() * Math.max(1, wildRegions().length))] || REGION_DATA[1] || REGION_DATA[0];
  const campOf = R => ({ x: R.x + (R.camp ? R.camp.dx : 0) + 10, z: R.z + (R.camp ? R.camp.dz : 0) + 8 });

  A.wyrmSouls = () => S().souls;
  A.wyrmGrantSoul = (n = 1) => {
    n = Math.max(0, Math.floor(n));
    const before = S().souls;
    S().souls = Math.min(SOUL_CAP, S().souls + n);
    if (A.veilGrantSoul && A.veilGrantSoul !== A.wyrmGrantSoul) { /* Veilcraft may own a mirror later */ }
    A.dirty();
    return S().souls - before;
  };
  A.wyrmSpendSoul = (n = 1) => {
    n = Math.max(1, Math.floor(n));
    if (S().souls < n) return false;
    S().souls -= n; A.dirty(); return true;
  };
  A.wyrmActive = () => !!(state.active && state.active.wyrm && state.active.wyrm.alive);
  A.wyrmOffered = () => !!state.offered;

  A.wyrmOffer = (reg) => {
    if (state.active || state.offered) return false;
    const R = pickRegion(reg);
    if (!R) return false;
    state.offered = { region: R, at: Date.now(), until: Date.now() + WARN_MS };
    S().seen++; S().last = Date.now();
    S().next = Date.now() + CADENCE_MIN + Math.random() * CADENCE_SPAN;
    A.log(`A Skywyrm is sighted over ${R.name}. You can fly or travel to it, or leave it. Ventures ✦ → Skywyrms.`, 'warn');
    A.refreshQuick && A.refreshQuick();
    A.dirty(); return true;
  };
  A.wyrmPass = () => {
    if (state.active) return A.log('The Skywyrm is already on the ground. Fight or walk away; it will leave in time.', 'game'), false;
    if (!state.offered) return false;
    const name = state.offered.region.name;
    state.offered = null;
    A.log(`You let the Skywyrm over ${name} pass. It was not a Colossus, and nothing is owed.`, 'game');
    A.refreshQuick && A.refreshQuick();
    A.dirty(); return true;
  };
  A.wyrmFight = (x, z, opts = {}) => {
    if (state.active && state.active.wyrm && state.active.wyrm.alive) return A.log('A Skywyrm is already circling. There is never more than one at a time.', 'warn'), false;
    const R = (state.offered && state.offered.region) || opts.region || pickRegion();
    const at = (Number.isFinite(x) && Number.isFinite(z)) ? { x, z } : campOf(R);
    const spawn = ctx.spawnMonster || ctx.addMonster;
    const L = Math.max(25, (A.vLevel ? A.vLevel() : 20) + ((A.lumenOn && A.lumenOn()) ? 8 : 0));
    let wyrm = null;
    if (spawn) {
      wyrm = spawn.call(ctx, 'Green Dragon', at.x, at.z, 2);
      if (wyrm) {
        wyrm.name = 'Skywyrm';
        wyrm.title = 'Skywyrm';
        wyrm.wyrmFoe = true;
        wyrm.colossus = null;
        wyrm.colossusId = null;
        wyrm.respawn = 1e12;
        wyrm.level = Math.max(wyrm.level || 1, L);
        wyrm.hp = wyrm.maxHp = Math.round((wyrm.maxHp || 80) * (isLow() ? 0.7 : 0.9));
        if (wyrm.mesh && wyrm.mesh.scale) {
          const s = isLow() ? 1.05 : 1.35;
          wyrm.mesh.scale.set(s, s, s);
        }
      }
    }
    if (!wyrm) {
      // Headless tests may lack a live spawn; still open a fight record so a kill can be simulated.
      wyrm = { name: 'Skywyrm', title: 'Skywyrm', wyrmFoe: true, alive: true, hp: 80, maxHp: 80, level: L, respawn: 1e12, mesh: { visible: true, scale: { set() {} } } };
    }
    const atts = [];
    if (!isLow() && spawn && !opts.noAttendants) {
      const a = spawn.call(ctx, 'Wolf', at.x + 3, at.z + 2, 2);
      if (a) { a.wyrmAttendant = true; a.respawn = 1e12; atts.push(a); }
    }
    state.offered = null;
    state.active = { wyrm, atts, region: R, at, start: Date.now() };
    A.log(`The Skywyrm over ${R.name} comes down to fight. This is not Ashwyrm, and there is no weekly chest — only a soul if you prevail.`, 'warn');
    A.refreshQuick && A.refreshQuick();
    A.dirty(); return true;
  };
  A.wyrmGo = () => {
    if (!state.offered) return A.log('No Skywyrm is sighted right now.', 'game'), false;
    const R = state.offered.region, c = campOf(R);
    if (ctx.travelTo) ctx.travelTo(c.x, c.z);
    return A.wyrmFight(c.x, c.z, { region: R });
  };
  A.wyrmLeave = () => {
    if (!state.active) return false;
    clearActive();
    A.log('The Skywyrm wheels off. You can meet another later.', 'game');
    A.refreshQuick && A.refreshQuick();
    A.dirty(); return true;
  };

  const onKill = m => {
    if (!m) return;
    if (m.wyrmAttendant && state.active) {
      state.active.atts = (state.active.atts || []).filter(a => a && a.alive && a !== m);
      return;
    }
    if (!m.wyrmFoe) return;
    const gained = A.wyrmGrantSoul(1);
    if (S().souls > S().best) S().best = S().souls;
    if (ctx.giveXP) { ctx.giveXP('Hunter', HUNTER_XP); ctx.giveXP('Prayer', PRAYER_XP); }
    A.log(gained ? `The Skywyrm falls. A soul settles in your pouch (${S().souls}/${SOUL_CAP}). +${HUNTER_XP} Hunter, +${PRAYER_XP} Prayer. This was not a Colossus chest.` : `The Skywyrm falls, but your soul pouch is full (${SOUL_CAP}).`, 'skill');
    if (state.active && state.active.wyrm === m) {
      for (const a of state.active.atts || []) clearFoe(a);
      state.active = null;
    }
    A.refreshQuick && A.refreshQuick();
    A.dirty();
  };
  ctx.EXT.extKill.push(onKill);

  A.every(10, () => {
    const now = Date.now();
    if (!state.offered && !state.active && now > (S().next || 0)) A.wyrmOffer();
    if (state.offered && now > state.offered.until) A.wyrmPass();
    if (state.active && Date.now() - state.active.start > 8 * 60 * 1000) A.wyrmLeave();
    if (state.active && state.active.wyrm && !state.active.wyrm.alive && state.active.wyrm !== 'pending') {
      // Kill hook may have already cleared it.
    }
  });

  A.npc('skywyrms', '🐉', 'Wyrmwatcher Cald', 'Now and then a Skywyrm is sighted over the high wilds. You can go to it or let it pass. It is one foe, not a Colossus, and not Ashwyrm on the Contested Wilds route. A kill yields a soul for the veil bench, and a little Hunter or Prayer. There is never more than one sighting at a time.', 'wyrms');
  A.guide.push(['Skywyrms', 'Ventures ✦ → Skywyrms, or talk to Wyrmwatcher Cald in Larkhaven. A warning appears when one is sighted over a wild region. Go and fight, or let it pass — you are not punished for leaving it. A kill yields a soul for Veilcraft, not a weekly Colossus chest. Ashwyrm stays on its route. At most one Skywyrm at a time. On Low the fight is a landed stand-in, not a huge flying mesh.']);
  A.quick(() => state.active ? [['wyrms', '🐉Wyrm', 'A Skywyrm is on the ground']] : state.offered ? [['wyrms', '🐉Sighted', 'A Skywyrm is sighted — Go or Not now']] : []);
  A.onQuick('wyrms', () => A.open('wyrms'));
  A.tab({ id: 'wyrms', icon: '🐉', name: 'Skywyrms', render: () => {
    const s = S();
    let body = `<h4>Skywyrms</h4><p>Occasional flyers over the wilds. Fighting is optional. A kill yields a soul for Veilcraft, a little Hunter or Prayer, and nothing like a Colossus chest. Ashwyrm stays a Colossus on the Contested Wilds. At most one sighting at a time.</p>
      <p>Soul pouch: <b>${s.souls}/${SOUL_CAP}</b> · Sightings: ${s.seen}</p>`;
    if (state.active) body += `<p>A Skywyrm is down over ${A.esc(state.active.region.name)}. Walk away if you want — it will leave in time.</p><div class="row"><button data-a="leave">Let it leave</button></div>`;
    else if (state.offered) body += `<p>A Skywyrm is sighted over <b>${A.esc(state.offered.region.name)}</b>. You can go to it, or let it pass. Nothing is owed if you leave it.</p>
      <div class="row"><button data-a="go" style="min-height:40px">Go</button><button data-a="pass" style="min-height:40px">Not now</button></div>`;
    else {
      const mins = Math.max(0, Math.ceil(((s.next || 0) - Date.now()) / 60000));
      body += `<p>No sighting right now. The next one comes in about ${mins || 'a'} minute${mins === 1 ? '' : 's'} of play.</p>`;
    }
    return body;
  }, act: a => { if (a === 'go') A.wyrmGo(); if (a === 'pass') A.wyrmPass(); if (a === 'leave') A.wyrmLeave(); } });

  A.vtests = A.vtests || {};
  A.vtests.skywyrms = async (g, A) => {
    const s = S();
    const snap = { seen: s.seen, souls: s.souls, last: s.last, best: s.best, next: s.next };
    const hadOff = !!state.offered, hadAct = state.active;
    try {
      // Clear any live sighting so the script is deterministic.
      if (state.active) A.wyrmLeave();
      if (state.offered) A.wyrmPass();
      s.souls = 0;
      const R = wildRegions().find(r => r.id === 'skyreach') || wildRegions()[0] || REGION_DATA[1];
      if (!A.wyrmOffer(R)) return 'offer';
      if (!state.offered) return 'no offer';
      if (A.wyrmOffer(R)) return 'second offer';
      if (!A.wyrmPass()) return 'pass';
      if (state.offered || state.active) return 'still offered after pass';
      if (s.souls !== 0) return 'soul on ignore';
      if (!A.wyrmOffer(R)) return 'reoffer';
      if (!A.wyrmFight(R.x + 10, R.z + 8, { region: R, noAttendants: true })) return 'fight';
      if (A.wyrmFight(R.x + 12, R.z + 8, { region: R, noAttendants: true })) return 'two at once';
      const wyrm = state.active && state.active.wyrm;
      if (!wyrm || !wyrm.wyrmFoe) return 'no foe';
      if (wyrm.colossus) return 'flagged as colossus';
      const souls0 = s.souls;
      wyrm.alive = false; wyrm.hp = 0; wyrm.state = 'dead';
      for (const f of (g.EXT.extKill || [])) { try { f(wyrm); } catch (e) { /* other hooks */ } }
      if (s.souls !== souls0 + 1) return 'no soul on kill ' + s.souls;
      if (state.active) return 'active after kill';
      const list = (g.EXT.colossi && g.EXT.colossi.list && g.EXT.colossi.list()) || [];
      if (!list.some(c => c.id === 'ashwyrm' || (c.name && /Ashwyrm/.test(c.name)))) return 'ashwyrm missing';
    } finally {
      if (state.active) A.wyrmLeave();
      state.offered = hadOff ? state.offered : null;
      s.seen = snap.seen; s.souls = snap.souls; s.last = snap.last; s.best = snap.best; s.next = snap.next;
    }
    return true;
  };
}
