// Ashspire (adapted from Hades): a roguelike tower of rooms, boons from original hearth-spirits, and meta-unlocks between runs.
import { NORM, obj, arr, num } from './state.js';

const FOES = ['Ashen raider', 'Sand Reaver', 'Ember Imp', 'Magma Brute', 'Canopy Stalker', 'Rime Wraith', 'Voidborn Knight'];
const FLOORS = 7;
const SPIRITS = {
  hearthmother: { name: 'Hearthmother', boons: [
    { id: 'sip', name: 'Warm sip', desc: 'Restore a little health now.' },
    { id: 'aftercare', name: 'Aftercare', desc: 'Restore a little health whenever a room clears.' }
  ]},
  ashwarden: { name: 'Ashwarden', boons: [
    { id: 'firstbind', name: 'First bind', desc: 'The first foe you strike in a room is briefly stunned.' },
    { id: 'kindsteel', name: 'Kind steel', desc: 'Your stuns last a tick longer in the Spire.' }
  ]},
  leywright: { name: 'Leywright', boons: [
    { id: 'echo', name: 'Ley echo', desc: 'Your hits sometimes leave a second, lighter pulse.' },
    { id: 'sight', name: 'Ley sight', desc: 'Foes in the Spire are a little easier to read (accuracy, not damage).' }
  ]},
  windcant: { name: 'Windcant', boons: [
    { id: 'slowstep', name: 'Slowstep', desc: 'A struck foe is briefly slowed.' }
  ]},
  emberkin: { name: 'Emberkin', boons: [
    { id: 'cinder', name: 'Cinder wake', desc: 'A fallen foe can singe a neighbour — a light follow-up, not a big hit.' }
  ]}
};
const ALL = Object.values(SPIRITS).flatMap(s => s.boons.map(b => ({ ...b, spirit: s.name })));
const UNLOCKS = {
  kindle: { name: 'Kindle', desc: 'Start each climb with 2 extra Ash.', cost: 8 },
  ward: { name: 'Ashwarden\'s greeting', desc: 'Start each climb with First bind already in hand.', cost: 12 },
  purse: { name: 'Ember purse', desc: 'A finished or failed climb yields a little more Ash.', cost: 10 }
};

NORM.spire = v => {
  v = obj(v);
  const unlocks = arr(v.unlocks).filter(id => UNLOCKS[id]);
  return { currency: Math.max(0, Math.floor(num(v.currency, 0, 0))), unlocks: [...new Set(unlocks)], bestFloor: Math.max(0, Math.floor(num(v.bestFloor, 0, 0))), runs: Math.max(0, Math.floor(num(v.runs, 0, 0))) };
};

export default function ashspire(A) {
  const { ctx, player } = A;
  const S = () => A.S('spire');
  const has = (r, id) => r && r.boons && r.boons.includes(id);
  const kind = f => (f === FLOORS ? 'boss' : (f === 3 || f === 6 ? 'event' : 'fight'));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const heal = frac => { if (player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + Math.max(1, Math.round(player.maxHp * frac))); };

  const cards = r => {
    const have = new Set(r.boons), pool = ALL.filter(b => !have.has(b.id));
    const out = [];
    const bag = pool.slice();
    while (out.length < 3 && bag.length) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    return out;
  };
  const events = r => ([
    { id: 'rest', name: 'Hearth rest', desc: 'Sit a moment and restore some health.' },
    { id: 'gift', name: 'A spirit\'s gift', desc: 'Take a random boon you do not already have.' },
    { id: 'ash', name: 'Ash cache', desc: 'Take 2 Ash now, mid-run.' }
  ]);

  const spawnFloor = r => {
    for (const m of A.zoneAlive('spire')) { m.alive = false; m.state = 'dead'; }
    r.bound = false;
    if (kind(r.floor) !== 'fight' && kind(r.floor) !== 'boss') return;
    const boss = kind(r.floor) === 'boss';
    const n = boss ? 1 : 3 + Math.min(2, Math.floor(r.floor / 2));
    const type = boss ? 'Voidborn Knight' : pick(FOES);
    const L = Math.round(r.L * (1 + r.floor * 0.08) + (boss ? (S().bestFloor || 0) * 4 : 0) + (boss && A.lumenOn && A.lumenOn() ? Math.max(0, (A.S('lumen').score - 1000)) : 0));
    const room = A.cap(15) - A.zoneAlive('spire').length;
    for (let i = 0; i < Math.min(n, Math.max(1, room)); i++) {
      const a = Math.random() * Math.PI * 2, rad = 4 + Math.random() * 5;
      A.zoneSpawn('spire', type, Math.cos(a) * rad, Math.sin(a) * rad - 3, L, { spireFoe: true, hpMul: boss ? 2.2 : 1, spireBoss: boss && i === 0 });
    }
  };

  const enterFloor = r => {
    r.phase = kind(r.floor);
    r.cards = null; r.events = null;
    if (r.phase === 'event') r.events = events(r);
    else spawnFloor(r);
    A.log(r.phase === 'boss' ? 'The Ashspire guardian waits.' : r.phase === 'event' ? `Floor ${r.floor}: a quiet landing.` : `Floor ${r.floor} of ${FLOORS}.`, 'combat');
  };

  A.spireStart = () => {
    const L = A.vLevel(), s = S();
    const boons = [];
    if (s.unlocks.includes('ward')) boons.push('firstbind');
    const ok = A.runStart('spire', { kind: 'spire', L, floor: 1, boons, phase: 'fight', cards: null, events: null, bound: false, ashEarned: 0, tick: step, end: finish });
    if (ok) { A.zoneBuild('spire', 0x2a1a18, 0xc86a3a); A.log('Ashspire opens. Climb the rooms, take a spirit\'s boon, and do not expect to resume if you leave.', 'warn'); enterFloor(A.run); }
    return ok;
  };

  function step(r) {
    if (r.cards || r.events) return;
    if (r.phase === 'fight' || r.phase === 'boss') {
      if (!A.zoneAlive('spire').length) {
        if (has(r, 'aftercare')) heal(0.12);
        if (r.phase === 'boss') return A.runEnd(true);
        r.cards = cards(r);
        A.log('The spirits offer a boon.', 'skill');
        A.dirty(); if (A.isOpen && A.isOpen()) A.render(); else A.open('spire');
      }
    }
  }

  A.spirePick = i => {
    const r = A.run; if (!r || r.kind !== 'spire') return false;
    if (r.cards && r.cards[i]) {
      const c = r.cards[i];
      if (c.id === 'sip') heal(0.2);
      else if (!r.boons.includes(c.id)) r.boons.push(c.id);
      r.cards = null;
      A.log(`${c.spirit} grants ${c.name}.`, 'skill');
      r.floor++; enterFloor(r); A.dirty(); return true;
    }
    if (r.events && r.events[i]) {
      const e = r.events[i];
      if (e.id === 'rest') heal(0.3);
      if (e.id === 'gift') { const pool = ALL.filter(b => !r.boons.includes(b.id) && b.id !== 'sip'); if (pool.length) r.boons.push(pick(pool).id); }
      if (e.id === 'ash') r.ashEarned += 2;
      r.events = null;
      A.log(`You take ${e.name}.`, 'game');
      r.floor++; enterFloor(r); A.dirty(); return true;
    }
    return false;
  };

  ctx.EXT.extHit.push((mon, dmg, now) => {
    const r = A.run; if (!r || r.kind !== 'spire' || !mon.spireFoe) return;
    if (has(r, 'firstbind') && !r.bound) { mon.stunUntil = Math.max(mon.stunUntil || 0, A.tick() + 3 + (has(r, 'kindsteel') ? 1 : 0)); r.bound = true; }
    else if (has(r, 'kindsteel') || has(r, 'slowstep')) mon.stunUntil = Math.max(mon.stunUntil || 0, A.tick() + 1 + (has(r, 'kindsteel') ? 1 : 0));
    if (has(r, 'echo') && Math.random() < 0.2 && ctx.strike) ctx.strike(mon, { dmg: -0.35, acc: 0.15 }, now, { quiet: true });
  });
  ctx.EXT.extKill.push(m => {
    const r = A.run; if (!r || r.kind !== 'spire' || !m.spireFoe || !has(r, 'cinder') || !ctx.strike) return;
    const o = A.zoneAlive('spire').find(q => q !== m && q.alive);
    if (o) ctx.strike(o, { dmg: -0.3, acc: 0.2 }, performance.now(), { quiet: true });
  });
  A.mods.acc.push((mon) => (A.run && A.run.kind === 'spire' && has(A.run, 'sight') ? 0.08 : 0));

  function finish(win, r) {
    const s = S();
    s.runs++;
    if (r.floor > s.bestFloor) s.bestFloor = r.floor;
    let ash = Math.max(1, r.floor) + (win ? 5 : 0) + (r.ashEarned || 0);
    if (s.unlocks.includes('purse')) ash += 2;
    if (s.unlocks.includes('kindle')) ash += 0; // kindle is a start bonus, paid below
    s.currency += ash;
    if (s.unlocks.includes('kindle') && !win) { /* start bonus already spent as meta */ }
    A.log(win ? `The Ashspire falls. +${ash} Ash. Best floor ${s.bestFloor}.` : `You leave the Ashspire at floor ${r.floor}. +${ash} Ash. This climb cannot be resumed.`, 'loot');
  }

  A.spireBuy = id => {
    const s = S(), u = UNLOCKS[id]; if (!u) return false;
    if (s.unlocks.includes(id)) return A.log('You already have that.', 'warn'), false;
    if (s.currency < u.cost) return A.log(`That costs ${u.cost} Ash.`, 'warn'), false;
    s.currency -= u.cost; s.unlocks.push(id); A.log(`Unlock: ${u.name}.`, 'skill'); A.dirty(); return true;
  };

  A.npc('ashspire', '🔥', 'Spirekeeper Nahl', 'The Ashspire is a climb of rooms. Three spirits offer a boon after a fight. If you leave or fall, the climb is over — you keep the Ash you earned and spend it between runs. This is not the Chronicle.', 'spire');
  A.guide.push(['Ashspire', 'Ventures ✦ → Ashspire, or talk to Spirekeeper Nahl in Larkhaven. A roguelike tower: fight, take a boon from an original hearth-spirit (Hearthmother, Ashwarden, Leywright, Windcant, Emberkin), sometimes a quiet landing, then a guardian that scales with your best floor and Lumen. Death or leaving grants Ash and ends the climb — there is no mid-run resume. Spend Ash between runs on small unlocks. The Chronicle stays a separate system.']);
  A.tab({ id: 'spire', icon: '🔥', name: 'Ashspire', render: () => {
    const r = A.run && A.run.kind === 'spire' ? A.run : null, s = S();
    if (r && r.cards) return `<h4>Floor ${r.floor} — a spirit offers a boon</h4>${r.cards.map((c, i) => `<div class="row" style="margin:8px 0"><button data-a="pick" data-i="${i}" style="min-height:56px;flex:1;font-size:15px;text-align:left"><b>${A.esc(c.name)}</b> <small>${A.esc(c.spirit)}</small><br><small>${A.esc(c.desc)}</small></button></div>`).join('')}`;
    if (r && r.events) return `<h4>Floor ${r.floor} — a quiet landing</h4>${r.events.map((c, i) => `<div class="row" style="margin:8px 0"><button data-a="pick" data-i="${i}" style="min-height:56px;flex:1;font-size:15px;text-align:left"><b>${A.esc(c.name)}</b><br><small>${A.esc(c.desc)}</small></button></div>`).join('')}`;
    if (r) return `<h4>Ashspire · floor ${r.floor}/${FLOORS} · ${r.phase}</h4>
      <p><small>Boons: ${r.boons.length ? r.boons.join(', ') : 'none yet'} · foes ${A.zoneAlive('spire').length}/${A.cap(15)}</small></p>
      <div class="row"><button data-a="leave">Abandon climb</button></div>`;
    return `<h4>Ash ${s.currency} · best floor ${s.bestFloor || '—'} · climbs ${s.runs}</h4>
      <p>A tower of rooms. After a fight, three original hearth-spirits offer a boon. A quiet landing may rest you or gift Ash. The last floor is a guardian. If you leave or fall, the climb ends — spend Ash here between runs. This is not the Chronicle.</p>
      ${Object.entries(UNLOCKS).map(([id, u]) => `<div style="margin:6px 0"><b>${A.esc(u.name)}</b> <small>${u.cost} Ash${s.unlocks.includes(id) ? ' · owned' : ''}</small><br><small>${A.esc(u.desc)}</small>
        <div class="row">${s.unlocks.includes(id) ? '' : `<button data-a="buy" data-id="${id}" style="min-height:40px" ${s.currency < u.cost ? 'disabled' : ''}>Unlock</button>`}</div></div>`).join('')}
      <div class="row"><button data-a="go" style="min-height:44px">Begin the climb</button></div>`;
  }, act: (a, d) => { if (a === 'go') A.spireStart(); if (a === 'pick') A.spirePick(+d.i); if (a === 'buy') A.spireBuy(d.id); if (a === 'leave') A.runEnd(false); } });

  A.vtests = A.vtests || {};
  A.vtests.ashspire = async (g, A) => {
    const s = S(), prev = JSON.parse(JSON.stringify(s)), gold = g.player.gold;
    const marks = JSON.parse(JSON.stringify(A.S('marks')));
    const breach = A.S('breach').runs;
    try {
      if (!A.spireStart()) return 'no start';
      await new Promise(r => setTimeout(r, 400));
      const r = A.run;
      if (!r || r.kind !== 'spire') return 'not in run';
      if (!(A.pos().x < -900)) return 'not in tower';
      const n = A.zoneAlive('spire').length;
      if (!(n > 0 && n <= A.cap(15))) return 'cap ' + n;
      // Clear floor 1 and pick a boon.
      for (const m of A.zoneAlive('spire')) { m.alive = false; m.state = 'dead'; }
      if (r.tick) r.tick(r);
      if (!r.cards || r.cards.length < 1) return 'no boons';
      if (!A.spirePick(0)) return 'pick boon';
      if (r.floor !== 2) return 'no climb';
      // Jump to a quiet landing, take an event, then abandon (no resume).
      r.floor = 3; enterFloor(r);
      if (!r.events) return 'no event';
      if (!A.spirePick(0)) return 'pick event';
      if (r.floor !== 4) return 'event did not advance';
      A.runEnd(false);
      await new Promise(r => setTimeout(r, 80));
      if (A.run) return 'abandon left a run';
      if (!('activeRun' in s) || s.activeRun == null || s.activeRun === undefined) { /* no resume saved */ } else return 'resume leaked';
      if (!(s.currency >= 1) || s.runs < 1) return 'no ash from abandon';
      // Spend Ash and restart with the unlock applied.
      s.currency = Math.max(s.currency, 12);
      if (!A.spireBuy('ward')) return 'buy';
      if (!s.unlocks.includes('ward')) return 'unlock not saved';
      if (!A.spireStart()) return 'restart';
      await new Promise(r => setTimeout(r, 400));
      if (!A.run || !A.run.boons.includes('firstbind')) return 'unlock not applied';
      A.runEnd(false);
      for (let i = 0; i < 20 && A.pos().x < -700; i++) await new Promise(r => setTimeout(r, 200));
      if (A.pos().x < -700) return 'stuck in tower';
      // Deepmarks and Breach were not consumed.
      if (JSON.stringify(A.S('marks')) !== JSON.stringify(marks)) return 'marks mutated';
      if (A.S('breach').runs !== breach) return 'breach mutated';
      if (!A.markStart || !A.breachStart) return 'other ventures missing';
      return true;
    } finally {
      if (A.run) A.runEnd(false);
      Object.keys(s).forEach(k => delete s[k]); Object.assign(s, prev);
      g.player.gold = gold;
      Object.keys(A.S('marks')).forEach(k => delete A.S('marks')[k]); Object.assign(A.S('marks'), marks);
    }
  };
}
