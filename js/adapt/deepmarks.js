// Deepmarks (adapted from PoE maps / Destiny nightfalls): a climbing instanced dungeon ladder with stacking modifiers. Tiers past 1000 scale with Lumen.
import { NORM, obj, arr, num } from './state.js';

const FOES = ['Ashen raider', 'Sand Reaver', 'Canopy Stalker', 'Magma Brute', 'Ember Imp', 'Rime Wraith', 'Thornback Prowler', 'Hoarfrost Stalker', 'Murk Leech', 'Glass Scorpion', 'Voidborn Knight'];
const MODS = {
  burning: ['Burning ground', 'You lose a little health every few ticks.'],
  shielded: ['Elites shielded', 'Foes take a little more killing (more health, not more damage).'],
  frenzy: ['Frenzy', 'Foes wind up a little faster — they do not hit much harder.'],
  echo: ['Echo pack', 'A second foe can appear near a kill.'],
  hush: ['Hush', 'Prayer feels slower to recover in this mark (rules, not raw damage).'],
  drift: ['Drift', 'Foes wander in from a wider angle.']
};
const MAX_TIER = 14;
const week = () => { const d = new Date(); const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x.toISOString().slice(0, 10); };
const gate = t => (t <= 4 ? 500 : t <= 8 ? 750 : 1000);
const modsFor = t => (t <= 4 ? 2 : t <= 8 ? 3 : 4);
const needLumen = t => t >= 11;

NORM.marks = v => {
  v = obj(v);
  const clears = {};
  for (const [k, n] of Object.entries(obj(v.clears))) {
    const t = +k; if (t >= 1 && t <= MAX_TIER) clears[t] = Math.max(0, Math.floor(num(n, 0, 0)));
  }
  const stash = arr(v.stash).map(s => String(s)).filter(s => /^t([1-9]|1[0-4])$/.test(s)).slice(0, 24);
  return { tierUnlocked: Math.max(1, Math.min(MAX_TIER, Math.floor(num(v.tierUnlocked, 1, 1)))), clears, stash, weekPinn: typeof v.weekPinn === 'string' ? v.weekPinn : '' };
};

export default function deepmarks(A) {
  const { ctx, player } = A;
  const M = () => A.S('marks');
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const levelFor = t => {
    const base = Math.round(A.vLevel() * (t <= 4 ? 1 : t <= 8 ? 1.15 : 1.3));
    const over = t > 10 ? (t - 10) * 40 + (A.lumenOn && A.lumenOn() ? Math.max(0, (A.S('lumen').score - 1000) * 2) : 0) : 0;
    return Math.min(2000, base + over);
  };

  const clearRoom = () => { for (const m of A.zoneAlive('marks')) { m.alive = false; m.state = 'dead'; } };
  const spawnRoom = r => {
    const n = r.room === 3 ? 1 : (r.room === 1 ? 4 : 5);
    const type = r.room === 3 ? 'Voidborn Knight' : pick(FOES);
    const hpMul = (r.mods.includes('shielded') ? 1.4 : 1) * (r.room === 3 ? 1.8 : 1);
    const room = A.cap(15) - A.zoneAlive('marks').length;
    for (let i = 0; i < Math.min(n, room); i++) {
      const a = Math.random() * Math.PI * 2, rad = 4 + Math.random() * (r.mods.includes('drift') ? 6 : 4);
      A.zoneSpawn('marks', type, Math.cos(a) * rad, Math.sin(a) * rad - 3, r.L, { markFoe: true, hpMul, markBoss: r.room === 3 && i === 0 });
    }
  };

  A.markStart = (tier) => {
    const t = Math.max(1, Math.min(MAX_TIER, Math.floor(+tier || 1))), m = M();
    if (A.vLevel() < gate(t)) return A.log(`Deepmarks of this height open at an average combat level of ${gate(t)}.`, 'warn'), false;
    if (needLumen(t) && !(A.lumenOn && A.lumenOn())) return A.log('Tiers past 1000 need Lumen Rise (a combat skill at 1000).', 'warn'), false;
    if (t > m.tierUnlocked) return A.log('You have not opened this Deepmark height yet.', 'warn'), false;
    const i = m.stash.indexOf('t' + t); if (i < 0) return A.log('You need a mark of this height in your stash. Breach clears can award a low-tier mark.', 'warn'), false;
    m.stash.splice(i, 1);
    const keys = Object.keys(MODS), chosen = [];
    while (chosen.length < modsFor(t) && keys.length) chosen.push(keys.splice(Math.floor(Math.random() * keys.length), 1)[0]);
    const L = levelFor(t);
    const ok = A.runStart('marks', { kind: 'marks', t, L, mods: chosen, room: 1, kills: 0, tick: step, end: finish });
    if (ok) { A.zoneBuild('marks', 0x1a2232, 0x5a7aaa); A.log(`Deepmark height ${t}. ${chosen.map(k => MODS[k][0]).join(' · ')}. Three rooms, one at a time.`, 'warn'); spawnRoom(A.run); }
    return ok;
  };

  function step(r) {
    if (r.mods.includes('burning') && A.tick() % 3 === 0 && player.hp > 1) player.hp = Math.max(1, player.hp - Math.ceil(player.maxHp * 0.01));
    if (Date.now() - r.start > 10 * 60000) { A.log('The mark collapses — out of time.', 'warn'); return A.runEnd(false); }
    if (!A.zoneAlive('marks').length) {
      if (r.room >= 3) return A.runEnd(true);
      r.room++; r.kills = 0;
      A.log(r.room === 3 ? 'The last chamber — a guardian.' : `Room ${r.room} of 3.`, 'combat');
      spawnRoom(r);
    }
  }
  ctx.EXT.extKill.push(m => {
    const r = A.run; if (!r || r.kind !== 'marks' || !m.markFoe) return;
    r.kills++;
    if (r.mods.includes('echo') && Math.random() < 0.25 && A.zoneAlive('marks').length < A.cap(15)) {
      A.zoneSpawn('marks', pick(FOES), (Math.random() - 0.5) * 8, -4, r.L, { markFoe: true, hpMul: r.mods.includes('shielded') ? 1.4 : 0.8 });
    }
  });
  ctx.EXT.extIncoming.push(d => (A.run && A.run.kind === 'marks' && A.run.mods.includes('frenzy') ? Math.round(d * 1.12) : d));
  A.prayerRegenMul = () => (A.run && A.run.kind === 'marks' && A.run.mods.includes('hush') ? 0.35 : 1);

  function finish(win, r) {
    const m = M();
    if (!win) { A.log('The Deepmark fails. The height stays as it was, and the spent mark is gone.', 'warn'); return; }
    m.clears[r.t] = (m.clears[r.t] || 0) + 1;
    if (r.t >= m.tierUnlocked && r.t < MAX_TIER) m.tierUnlocked = r.t + 1;
    // Return a same-height mark and often the next height.
    m.stash.push('t' + r.t);
    if (r.t < MAX_TIER && Math.random() < 0.7) m.stash.push('t' + (r.t + 1));
    const coins = Math.round(120 + r.L * 3 + r.t * 20); player.gold += coins;
    A.log(`Deepmark height ${r.t} is clear. +${A.fmt(coins)} coins. A mark returns to your stash.`, 'loot');
    const w = week();
    if (r.t >= 5 && m.weekPinn !== w) {
      m.weekPinn = w;
      if (A.pinnacle) A.pinnacle('Deepmark');
      else A.log('A weekly Deepmark pinnacle is noted.', 'skill');
    }
  }

  A.onBreachClear = A.onBreachClear || [];
  A.onBreachClear.push((r, grade) => {
    if (grade === 'S' || (r && r.hard) || Math.random() < 0.4) {
      const m = M();
      if (m.stash.filter(x => x === 't1').length < 6) { m.stash.push('t1'); A.log('A low-tier Deepmark settles into your stash.', 'loot'); }
    }
  });

  A.npc('deepmarks', '🜁', 'Markwarden Sera', 'Deepmarks are a climbing ladder of instanced rooms with stacking twists. A Breach clear can leave you a low-tier mark. Highest tiers need Lumen.', 'marks');
  A.guide.push(['Deepmarks', 'Ventures ✦ → Deepmarks, or talk to Markwarden Sera in Larkhaven. A climbing instanced dungeon: spend a mark from your stash, walk three streamed rooms with stacked modifiers, and climb past height 10 (level 1000) with Lumen. Same foe cap as a Breach. A weekly pinnacle is shared with Vigil and Burst Tides. Breach itself stays the short objective and can award a low-tier mark.']);
  A.tab({ id: 'marks', icon: '🜁', name: 'Deepmarks', render: () => {
    const r = A.run && A.run.kind === 'marks' ? A.run : null, m = M();
    if (r) return `<h4>Height ${r.t} · room ${r.room}/3</h4><p>${r.mods.map(k => `<b>${MODS[k][0]}</b> — ${MODS[k][1]}`).join('<br>')}</p><p><small>Foes ${A.zoneAlive('marks').length}/${A.cap(15)}</small></p><div class="row"><button data-a="leave">Abandon run</button></div>`;
    const stash = {}; for (const s of m.stash) stash[s] = (stash[s] || 0) + 1;
    const rows = [];
    for (let t = 1; t <= Math.min(MAX_TIER, m.tierUnlocked); t++) {
      const have = stash['t' + t] || 0, locked = A.vLevel() < gate(t) || (needLumen(t) && !(A.lumenOn && A.lumenOn()));
      rows.push(`<div style="margin:6px 0"><b>Height ${t}</b> <small>cleared ${m.clears[t] || 0} · marks ${have} · opens at ${gate(t)}${needLumen(t) ? ' + Lumen' : ''}</small>
        <div class="row"><button data-a="go" data-t="${t}" style="min-height:40px" ${!have || locked ? 'disabled' : ''}>Enter</button></div></div>`);
    }
    return `<h4>Open to height ${m.tierUnlocked} · your level ${A.vLevel()}</h4>
      <p>Spend a mark to walk three rooms, one at a time, with stacked twists. Clearing a height opens the next and often leaves a higher mark. Breach clears can award a low-tier mark.</p>${rows.join('')}`;
  }, act: (a, d) => { if (a === 'go') { A.markStart(+d.t); } if (a === 'leave') A.runEnd(false); } });

  A.vtests = A.vtests || {};
  A.vtests.deepmarks = async (g, A) => {
    const m = M(), prev = JSON.parse(JSON.stringify(m)), gold = g.player.gold;
    const snap = {};
    for (const s of ['Attack', 'Strength', 'Defence', 'Hitpoints', 'Ranged']) snap[s] = { level: g.skills[s].level, xp: g.skills[s].xp };
    const bump = (s, lv) => { g.skills[s].level = lv; if (g.skills[s].xp != null) g.skills[s].xp = g.skills[s].xp; };
    try {
      bump('Attack', 600); bump('Strength', 600); bump('Defence', 600); bump('Hitpoints', 600); bump('Ranged', 600);
      if (A.vLevel() < 500) return 'gate ' + A.vLevel();
      m.stash.push('t1'); m.tierUnlocked = Math.max(m.tierUnlocked, 1);
      if (!A.markStart(1)) return 'no start t1';
      await new Promise(r => setTimeout(r, 400));
      const r = A.run;
      if (!r || r.kind !== 'marks') return 'not in run';
      if (!(A.pos().x < -900)) return 'not in dungeon';
      if (r.mods.length !== 2) return 'mods ' + r.mods.length;
      if (!r.mods.includes('hush')) r.mods = r.mods.slice(0, 1).concat(['hush']);
      if (!(A.prayerRegenMul && A.prayerRegenMul() < 1)) return 'hush not slowing prayer';
      const mulClear = (() => { const keep = r.mods; r.mods = r.mods.filter(m => m !== 'hush'); const v = A.prayerRegenMul(); r.mods = keep; return v; })();
      if (mulClear !== 1) return 'hush stuck on';
      const n = A.zoneAlive('marks').length;
      if (!(n > 0 && n <= A.cap(15))) return 'cap ' + n;
      // Spider-shaped marks (Murk Leech, Glass Scorpion) must roll an eye colour so hi-LOD paint does not crash.
      const Cr = await import('/js/creatures.js'), Gp = await import('/js/gameplay.js');
      for (const name of ['Murk Leech', 'Glass Scorpion']) {
        const typ = Gp.MONSTER_TYPES[name]; if (!typ || typ.shape !== 'spider') return 'missing '+name;
        const v = Cr.rollVariant(name, typ, 0.42);
        if (v.eye == null) return 'no eye '+name;
        try { const rig = Cr.buildCreatureRig(name, typ, v); if (rig && rig.traverse) rig.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } catch (e) { return 'rig '+name+' '+e.message; }
      }
      // Stream three rooms: clear each and let the tick advance.
      for (let room = 1; room <= 3; room++) {
        if (!A.run || A.run.kind !== 'marks') return 'lost run at room ' + room;
        clearRoom();
        if (A.run && A.run.tick) A.run.tick(A.run);
      }
      if (A.run && A.run.kind === 'marks') A.runEnd(true);
      for (let i = 0; i < 20 && A.pos().x < -700; i++) await new Promise(r => setTimeout(r, 200));
      if (!(m.clears[1] >= 1)) return 'clear not saved';
      if (m.tierUnlocked < 2) return 'next height not opened';
      if (!m.stash.includes('t1') && !m.stash.includes('t2')) return 'no mark returned';
      if (A.pos().x < -700) return 'stuck after win';

      // Leave / fail mid-run does not change clears.
      const c1 = m.clears[1]; m.stash.push('t1');
      if (!A.markStart(1)) return 'restart';
      await new Promise(r => setTimeout(r, 400));
      A.runEnd(false);
      await new Promise(r => setTimeout(r, 80));
      if (m.clears[1] !== c1) return 'fail changed clears';

      // High tier (cheated unlock + Lumen) and weekly pinnacle once.
      bump('Attack', 1000); bump('Strength', 1000); bump('Defence', 1000); bump('Hitpoints', 1000); bump('Ranged', 1000);
      m.tierUnlocked = 11; m.stash.push('t11');
      if (!(A.lumenOn && A.lumenOn())) return 'lumen should be on';
      if (!A.markStart(11)) return 'no start t11';
      await new Promise(r => setTimeout(r, 400));
      if (!A.run || A.run.mods.length !== 4) return 'high mods ' + ((A.run && A.run.mods.length) || 0);
      const p0 = (A.S('lumen') && A.S('lumen').pinn) || 0;
      A.run.t = 11; A.runEnd(true);
      for (let i = 0; i < 20 && A.pos().x < -700; i++) await new Promise(r => setTimeout(r, 200));
      if (m.weekPinn !== week()) return 'week pinn not noted';
      // Second clear the same week should not take another shared pinnacle.
      m.stash.push('t11');
      if (!A.markStart(11)) return 'no second t11';
      await new Promise(r => setTimeout(r, 400));
      A.runEnd(true);
      for (let i = 0; i < 20 && A.pos().x < -700; i++) await new Promise(r => setTimeout(r, 200));
      const p1 = (A.S('lumen') && A.S('lumen').pinn) || 0;
      if (p1 - p0 > 1) return 'pinnacle twice ' + p0 + '->' + p1;

      // Breach still starts and stays its own short objective.
      if (A.run) A.runEnd(false);
      await new Promise(r => setTimeout(r, 80));
      if (!A.breachStart('purge', false)) return 'breach broken';
      await new Promise(r => setTimeout(r, 400));
      const bn = A.zoneAlive('breach').length;
      if (!(bn > 0 && bn <= A.cap(15))) { A.runEnd(false); return 'breach cap ' + bn; }
      A.runEnd(false);
      await new Promise(r => setTimeout(r, 80));
      return true;
    } finally {
      if (A.run) A.runEnd(false);
      Object.keys(m).forEach(k => delete m[k]); Object.assign(m, prev);
      g.player.gold = gold;
      for (const [s, v] of Object.entries(snap)) { g.skills[s].level = v.level; if (v.xp != null) g.skills[s].xp = v.xp; }
    }
  };
}
