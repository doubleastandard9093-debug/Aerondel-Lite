// Holdraids (adapted from Valheim raids): occasional PvE attacks on your claimed wild plot, never on a town house or the farm. Repairing afterward trains Construction.
import { PLOT } from './freeframe.js';
import { NORM, obj, num } from './state.js';

const FOES = ['Goblin', 'Wolf', 'Ashen raider', 'Sand Reaver'];
NORM.raids = v => {
  v = obj(v);
  return { next: Math.max(0, Math.floor(num(v.next, 0, 0))), runs: Math.max(0, Math.floor(num(v.runs, 0, 0))), skipped: Math.max(0, Math.floor(num(v.skipped, 0, 0))), delayed: Math.max(0, Math.floor(num(v.delayed, 0, 0))) };
};

export default function holdraids(A) {
  const { ctx, player } = A;
  const R = () => A.S('raids');
  const state = { active: null, warned: null };
  const delayMs = 8 * 60 * 1000;
  const warnMs = 45 * 1000;
  if (!R().next) R().next = Date.now() + delayMs + Math.random() * delayMs;

  const clearMobs = () => {
    if (!state.active) return;
    for (const m of state.active.mobs) {
      if (!m) continue;
      m.alive = false; m.state = 'dead'; m.respawn = 1e12;
      if (m.mesh) m.mesh.visible = false;
    }
    state.active.mobs = [];
  };

  A.raidStart = (opts = {}) => {
    if (!A.frameClaimed || !A.frameClaimed()) return A.log('Raids only come for a claimed wild plot. Claim Claimridge first. Town houses and the farm are never raided.', 'warn'), false;
    if (state.active) return A.log('A raid is already on the plot.', 'warn'), false;
    const L = A.vLevel ? A.vLevel() : 20;
    const n = Math.min(A.cap ? A.cap(15) : 8, ctx.gfxQ && ctx.gfxQ() === 'low' ? 6 : 10);
    const mobs = [];
    const spawn = ctx.spawnMonster || ctx.addMonster;
    for (let i = 0; i < n; i++) {
      const type = FOES[Math.min(FOES.length - 1, Math.floor(L / 80 + i * 0.2))];
      const a = (i / n) * Math.PI * 2, rad = PLOT.half + 2;
      const x = PLOT.x + Math.cos(a) * rad, z = PLOT.z + Math.sin(a) * rad;
      let m = null;
      if (spawn) m = spawn.call(ctx, type, x, z, 2);
      if (m) { m.raidFoe = true; m.respawn = 1e12; m.level = Math.max(m.level || 1, L); mobs.push(m); }
    }
    state.active = { start: Date.now(), mobs, hits: 0, L };
    state.warned = null; R().next = Date.now() + delayMs * 2; R().runs++;
    A.log('A Holdraid falls on Claimridge! Defend your builds. Town and farm are left alone.', 'warn');
    A.dirty(); A.refreshQuick && A.refreshQuick();
    if (opts.sure && !mobs.length) {
      // Headless tests may lack spawnMonster; still open a raid so end/repair can be exercised.
      state.active.mobs = [];
    }
    return true;
  };
  A.raidEnd = (win) => {
    if (!state.active) return false;
    clearMobs();
    const hits = state.active.hits; state.active = null;
    A.log(win ? 'The raid breaks. Repair what they broke — that trains Construction.' : 'The raid fades. Repair any damage on the plot.', 'skill');
    A.dirty(); A.refreshQuick && A.refreshQuick(); return true;
  };
  A.raidDelay = () => {
    if (state.active) return A.log('Too late — the raid is already here. Fight or wait it out.', 'warn'), false;
    R().next = Date.now() + 5 * 60 * 1000; R().delayed++; state.warned = null;
    A.log('You put the raid off for a few minutes.', 'game'); A.dirty(); return true;
  };
  A.raidSkip = () => {
    if (state.active) return false;
    R().next = Date.now() + delayMs * 2; R().skipped++; state.warned = null;
    A.log('You let this raid pass. The next one will come later.', 'game'); A.dirty(); return true;
  };
  A.raidActive = () => !!state.active;

  ctx.EXT.extTick.push(() => {
    const now = Date.now();
    if (!A.frameClaimed || !A.frameClaimed()) return;
    if (!state.active && !state.warned && now > R().next - warnMs && now < R().next) {
      state.warned = now;
      A.log('A Holdraid is gathering on Claimridge. You can delay or skip it from Ventures ✦ → Holdraids.', 'warn');
    }
    if (!state.active && now >= R().next) A.raidStart();
    if (!state.active) return;
    const live = state.active.mobs.filter(m => m && m.alive);
    // Foes chip a nearby piece at most once every 8s, so the first piece is not shredded every tick. They never march into town or the farm.
    const CHIP_MS = 8000;
    if (A.framePieces && A.framePieces().length && live.length && Date.now() - (state.active.lastChip || 0) >= CHIP_MS) {
      const p = A.framePieces()[0];
      const x = PLOT.x + p.gx * 1.5, z = PLOT.z + p.gz * 1.5;
      if (A.frameDamage) { A.frameDamage(x, z, 1); state.active.hits++; state.active.lastChip = Date.now(); }
    }
    if (Date.now() - state.active.start > 3 * 60 * 1000 || (state.active.mobs.length && !live.length)) A.raidEnd(true);
  });
  ctx.EXT.extKill.push(m => { if (m && m.raidFoe && state.active) { /* counted via live check */ } });

  A.npc('holdraids', '🛡️', 'Ward-captain Rhee', 'If you have claimed a wild plot, occasional raids will try the walls. They are telegraphed, you can delay or skip them, and they never come for a town house or the farm. Repairing afterward trains Construction.', 'raids');
  A.guide.push(['Holdraids', 'Ventures ✦ → Holdraids, or talk to Ward-captain Rhee in Larkhaven. Occasional PvE attacks on Claimridge only, after you have claimed the plot. A warning comes first; you can delay or skip so you are never punished for not being ready. Foes chip your builds; repair them afterward for Construction XP. Never on a Townstead or Greenstead. Same foe cap as a Breach on Low.']);
  A.quick(() => (state.active ? [['raids', '🛡️Raid', 'A Holdraid is on your plot']] : state.warned ? [['raids', '🛡️Raid coming', 'Delay or skip from the Holdraids tab']] : []));
  A.onQuick('raids', () => A.open('raids'));
  A.tab({ id: 'raids', icon: '🛡️', name: 'Holdraids', render: () => {
    if (!A.frameClaimed || !A.frameClaimed()) return `<h4>Holdraids</h4><p>Raids only come for a claimed wild plot. Claim Claimridge (Freeframe) first. Town houses and the farm are never raided, and nothing will punish you for not having a plot.</p>`;
    if (state.active) {
      const n = state.active.mobs.filter(m => m && m.alive).length;
      return `<h4>Raid on Claimridge</h4><p>${n} foes remain. They will chip your builds if left alone. Repair afterward for Construction XP.</p><div class="row"><button data-a="end" style="min-height:40px">The raid has passed</button></div>`;
    }
    const mins = Math.max(0, Math.ceil((R().next - Date.now()) / 60000));
    return `<h4>Claimridge is quiet</h4><p>Next raid in about ${mins || 'less than a'} minute${mins === 1 ? '' : 's'}. A warning comes first. You can delay or skip so a raid never jumps you unprepared.</p>
      <p><small>Raids stood: ${R().runs} · delayed ${R().delayed} · skipped ${R().skipped}</small></p>
      <div class="row"><button data-a="delay" style="min-height:40px">Delay a few minutes</button><button data-a="skip" style="min-height:40px">Skip this one</button></div>`;
  }, act: (a) => { if (a === 'delay') A.raidDelay(); if (a === 'skip') A.raidSkip(); if (a === 'end' && state.active) A.raidEnd(true); } });

  A.vtests = A.vtests || {};
  A.vtests.holdraids = async (g, A) => {
    const r = R(), prevR = JSON.parse(JSON.stringify(r));
    const frame = A.S('frame'), prevF = JSON.parse(JSON.stringify(frame));
    const gold = g.player.gold, inv = { ...g.player.inventory };
    const con = { level: g.skills.Construction.level, xp: g.skills.Construction.xp };
    try {
      if (A.raidStart()) return 'raid without a plot';
      g.player.gold = Math.max(g.player.gold, 4000);
      g.player.inventory['Logs'] = (g.player.inventory['Logs'] || 0) + 30;
      g.skills.Construction.level = Math.max(1, g.skills.Construction.level);
      if (!A.frameClaimed()) { if (!A.frameBuy()) return 'buy plot'; }
      const fid = A.framePlace('foundation', 0, 0); if (!fid) return 'need a piece';
      const hp0 = A.framePieces().find(p => p.id === fid).hp;
      // Delay / skip do not start a raid.
      const t0 = r.next;
      if (!A.raidDelay()) return 'delay';
      if (A.raidActive()) return 'delay started a raid';
      if (r.delayed < 1) return 'delay not saved';
      if (!A.raidSkip()) return 'skip';
      if (A.raidStart({ sure: true }) !== true) return 'no start';
      if (!A.raidActive()) return 'not active';
      // A burst of ticks should chip at most once (not every tick), and never a town house.
      if (ctx.EXT.extTick) for (let i = 0; i < 20; i++) for (const f of ctx.EXT.extTick) { try { f(); } catch (e) {} }
      const piece = A.framePieces().find(p => p.id === fid);
      if (piece && piece.hp > hp0) return 'hp went up';
      if (piece && hp0 - piece.hp > 1) return 'chipped too fast';
      // Town was not targeted — no pieces exist there.
      if (A.frameOn && A.frameOn(13, -6)) return 'town raided';
      A.raidEnd(true);
      if (A.raidActive()) return 'still active';
      const xp0 = g.skills.Construction.xp;
      if (piece && piece.hp < (hp0 || 40)) A.frameRepair(fid);
      if (g.skills.Construction.xp < xp0) return 'repair lost xp';
      return true;
    } finally {
      if (A.raidActive()) A.raidEnd(false);
      if (A.frameRemove) for (const p of (A.framePieces() || []).slice()) A.frameRemove(p.id);
      Object.keys(r).forEach(k => delete r[k]); Object.assign(r, prevR);
      Object.keys(frame).forEach(k => delete frame[k]); Object.assign(frame, prevF);
      g.player.gold = gold; g.player.inventory = inv;
      g.skills.Construction.level = con.level; g.skills.Construction.xp = con.xp;
    }
  };
}
