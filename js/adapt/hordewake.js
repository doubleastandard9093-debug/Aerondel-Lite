// Hordewake (adapted from Vampire Survivors): a short, phone-friendly horde arena. You move, your weapons fire on their own, and you pick a reward as you level.
import { NORM, obj, arr, num } from './state.js';

const FOES = ['Goblin', 'Wolf', 'Ashen raider', 'Sand Reaver', 'Ember Imp', 'Magma Brute'];
const GOAL_MS = 8 * 60 * 1000; // 8 minutes (tests can shorten r.goal)
const WEAPONS = {
  wand: { name: 'Ash Wand', desc: 'A slow pulse at the nearest foe.', ms: 700 },
  blade: { name: 'Orbit Blade', desc: 'Blades cut anyone who steps close.', ms: 500 },
  bow: { name: 'Quick Bow', desc: 'Shoots where you face.', ms: 550 },
  stormrod: { name: 'Storm Rod', desc: 'A pulse that arcs to a second foe.', ms: 650, combo: true },
  orbitflare: { name: 'Orbit Flare', desc: 'Orbiting blades that also pulse outward.', ms: 480, combo: true },
  seeker: { name: 'Seeker Fan', desc: 'Shots fan toward the nearest pack.', ms: 520, combo: true }
};
const COMBOS = { 'blade+wand': 'orbitflare', 'wand+bow': 'stormrod', 'blade+bow': 'seeker' };
const UNLOCKS = { blade: 'Start with an Orbit Blade', slot: 'A third weapon slot', bow: 'Start with a Quick Bow' };

NORM.horde = v => {
  v = obj(v);
  const unlocks = arr(v.unlocks).filter(id => UNLOCKS[id]);
  return { bestTime: Math.max(0, Math.floor(num(v.bestTime, 0, 0))), bestLevel: Math.max(0, Math.floor(num(v.bestLevel, 0, 0))), unlocks: [...new Set(unlocks)], runs: Math.max(0, Math.floor(num(v.runs, 0, 0))) };
};

export default function hordewake(A) {
  const { ctx, player } = A;
  const H = () => A.S('horde');
  const cap = () => (ctx.gfxQ && ctx.gfxQ() === 'low' ? 20 : 35);
  const foeFor = L => FOES[Math.min(FOES.length - 1, Math.max(0, Math.floor(L / 80)))];
  const nearest = (r = 99) => {
    const p = A.pos(); let best = null, bd = r;
    for (const m of A.zoneAlive('horde')) { const d = Math.hypot(m.mesh.position.x - p.x, m.mesh.position.z - p.z); if (d < bd) { bd = d; best = m; } }
    return best;
  };
  const facing = () => {
    const p = A.pos(), yaw = (ctx.pm && ctx.pm.mesh && ctx.pm.mesh.rotation.y) || 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let best = null, bd = 12;
    for (const m of A.zoneAlive('horde')) {
      const dx = m.mesh.position.x - p.x, dz = m.mesh.position.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (d < bd && (dx * fx + dz * fz) / d > 0.2) { bd = d; best = m; }
    }
    return best || nearest(12);
  };

  const fireWeapon = (r, id, now) => {
    const w = WEAPONS[id]; if (!w) return;
    const last = r.shot[id] || 0, haste = 1 - Math.min(0.35, (r.haste || 0) * 0.08);
    if (now - last < w.ms * haste) return;
    r.shot[id] = now;
    const strike = (m, mods) => { if (m && m.alive && ctx.strike) ctx.strike(m, { acc: 0.25, dmg: -0.15, ...mods }, now, { quiet: true }); };
    if (id === 'blade' || id === 'orbitflare') {
      const p = A.pos(); let n = 0;
      for (const m of A.zoneAlive('horde')) if (Math.hypot(m.mesh.position.x - p.x, m.mesh.position.z - p.z) < (id === 'orbitflare' ? 5 : 3.2)) { strike(m); n++; }
      if (id === 'orbitflare') { const m = nearest(10); if (m) strike(m, { dmg: -0.25 }); }
    } else if (id === 'bow' || id === 'seeker') {
      const m = facing(); if (m) strike(m);
      if (id === 'seeker') { const p = A.pos(); let c = 0; for (const q of A.zoneAlive('horde')) if (q !== m && c < 2 && Math.hypot(q.mesh.position.x - p.x, q.mesh.position.z - p.z) < 8) { strike(q, { dmg: -0.3 }); c++; } }
    } else {
      const m = nearest(11); if (m) strike(m);
      if (id === 'stormrod') { const m2 = A.zoneAlive('horde').find(q => q !== m && q.alive); if (m2) strike(m2, { dmg: -0.3 }); }
    }
  };

  const deck = r => {
    const opts = [];
    const have = new Set(r.weapons);
    for (const id of ['wand', 'blade', 'bow']) if (!have.has(id) && r.weapons.length < r.slots) opts.push({ t: 'wep', id, name: WEAPONS[id].name, desc: 'Add this weapon. It fires on its own.' });
    for (const id of r.weapons) if (!WEAPONS[id].combo) opts.push({ t: 'haste', id, name: `Tune ${WEAPONS[id].name}`, desc: 'It fires a little more often.' });
    const keys = Object.keys(COMBOS);
    for (const k of keys) { const [a, b] = k.split('+'); if (have.has(a) && have.has(b) && !have.has(COMBOS[k])) opts.push({ t: 'combo', id: COMBOS[k], from: k, name: `Combine into ${WEAPONS[COMBOS[k]].name}`, desc: WEAPONS[COMBOS[k]].desc }); }
    opts.push({ t: 'mag', name: 'Wide Wake', desc: 'Pickups and orbit reach a little farther.' });
    opts.push({ t: 'heart', name: 'Hearth sip', desc: 'Restore a little health (not a damage bonus).' });
    const out = [];
    const bag = opts.slice();
    while (out.length < 3 && bag.length) out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
    return out;
  };

  A.hordeStart = () => {
    const L = A.vLevel(), h = H();
    const start = [];
    start.push('wand');
    if (h.unlocks.includes('blade')) start.push('blade');
    if (h.unlocks.includes('bow') && start.length < 3) start.push('bow');
    const slots = 2 + (h.unlocks.includes('slot') ? 1 : 0);
    const ok = A.runStart('horde', { kind: 'horde', L, weapons: start.slice(0, slots), slots, xp: 0, level: 1, kills: 0, shot: {}, paused: false, cards: null, haste: 0, mag: 0, goal: GOAL_MS, tick: step, end: finish });
    if (ok) { A.zoneBuild('horde', 0x2a1a22, 0x8a4a3a); A.log('Hordewake begins. Move — your weapons fire on their own. Survive the timer.', 'warn'); spawn(A.run, 6); }
    return ok;
  };

  function spawn(r, n) {
    const room = cap() - A.zoneAlive('horde').length;
    const type = foeFor(r.L + r.level * 8);
    for (let i = 0; i < Math.min(n, room); i++) {
      const a = Math.random() * Math.PI * 2, rad = 8 + Math.random() * 4;
      A.zoneSpawn('horde', type, Math.cos(a) * rad, Math.sin(a) * rad - 2, Math.max(2, r.L + r.level), { hordeFoe: true, hpMul: 0.55 + r.level * 0.03 });
    }
  }
  function step(r) {
    if (r.paused) return;
    const now = Date.now();
    if (now - r.start >= (r.goal || GOAL_MS)) return A.runEnd(true);
    const alive = A.zoneAlive('horde').length;
    if (alive < Math.min(cap(), 6 + Math.floor(r.level / 2))) spawn(r, 4);
  }
  ctx.EXT.extFrame.push((dt, now) => {
    const r = A.run; if (!r || r.kind !== 'horde' || r.paused) return;
    for (const id of r.weapons) fireWeapon(r, id, now || performance.now());
  });
  ctx.EXT.extKill.push(m => {
    const r = A.run; if (!r || r.kind !== 'horde' || !m.hordeFoe) return;
    r.kills++; r.xp += 8 + Math.floor(r.level / 2);
    const need = 20 + r.level * 12;
    if (r.xp >= need) { r.xp -= need; r.level++; r.paused = true; r.cards = deck(r); A.log(`Hordewake level ${r.level}. Pick a reward.`, 'skill'); A.dirty(); if (A.isOpen && A.isOpen()) A.render(); else A.open('horde'); }
  });

  A.hordePick = i => {
    const r = A.run; if (!r || r.kind !== 'horde' || !r.cards || !r.cards[i]) return;
    const c = r.cards[i];
    if (c.t === 'wep' && r.weapons.length < r.slots && !r.weapons.includes(c.id)) r.weapons.push(c.id);
    if (c.t === 'haste') r.haste = (r.haste || 0) + 1;
    if (c.t === 'combo') {
      const [a, b] = c.from.split('+');
      r.weapons = r.weapons.filter(w => w !== a && w !== b);
      if (!r.weapons.includes(c.id)) r.weapons.push(c.id);
    }
    if (c.t === 'mag') r.mag = (r.mag || 0) + 1;
    if (c.t === 'heart' && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + Math.max(1, Math.round(player.maxHp * 0.15)));
    r.cards = null; r.paused = false;
    A.log(`You take ${c.name}.`, 'game'); A.dirty();
    return true;
  };

  function finish(win, r) {
    const h = H(), t = Date.now() - r.start;
    h.runs++;
    if (win) {
      if (!h.bestTime || t > h.bestTime) h.bestTime = t;
      if (r.level > h.bestLevel) h.bestLevel = r.level;
      // First win unlocks a starting Orbit Blade; later wins can unlock a slot or a bow.
      if (!h.unlocks.includes('blade')) { h.unlocks.push('blade'); A.log('Unlock: you will start the next Hordewake with an Orbit Blade.', 'skill'); }
      else if (!h.unlocks.includes('slot') && r.level >= 6) { h.unlocks.push('slot'); A.log('Unlock: a third weapon slot in Hordewake.', 'skill'); }
      else if (!h.unlocks.includes('bow')) { h.unlocks.push('bow'); A.log('Unlock: you can start with a Quick Bow.', 'skill'); }
      const coins = Math.round(80 + r.L * 2 + r.kills * 3); player.gold += coins;
      A.log(`Hordewake held for ${Math.round(t / 1000)}s (level ${r.level}). +${A.fmt(coins)} coins.`, 'loot');
    } else A.log(`Hordewake ends at level ${r.level}. The overworld is as you left it.`, 'warn');
  }

  A.npc('hordewake', '🌊', 'Wakekeeper Brin', 'A short arena of waves. You just move — your weapons fire on their own. Built to feel good on a phone. It is not a Proving Grounds duel and not a Burst Tide.', 'horde');
  A.guide.push(['Hordewake', 'Ventures ✦ → Hordewake, or talk to Wakekeeper Brin in Larkhaven. A short instanced horde: move, weapons auto-fire, pick a reward as you level, and some weapons combine. Survive the timer. At most 20 foes on Low. Unlocks (a starting weapon, a slot) persist between runs. Leaving mid-run does not change your overworld save beyond the attempt itself.']);
  A.tab({ id: 'horde', icon: '🌊', name: 'Hordewake', render: () => {
    const r = A.run && A.run.kind === 'horde' ? A.run : null, h = H();
    if (r && r.cards) return `<h4>Level ${r.level} — pick a reward</h4>${r.cards.map((c, i) => `<div class="row" style="margin:8px 0"><button data-a="pick" data-i="${i}" style="min-height:56px;flex:1;font-size:15px;text-align:left"><b>${A.esc(c.name)}</b><br><small>${A.esc(c.desc)}</small></button></div>`).join('')}`;
    if (r) {
      const left = Math.max(0, (r.goal || GOAL_MS) - (Date.now() - r.start));
      return `<h4>Hordewake · ${Math.ceil(left / 1000)}s · lv ${r.level}</h4>
        <p><small>Weapons: ${r.weapons.map(id => WEAPONS[id].name).join(', ')} · kills ${r.kills} · foes ${A.zoneAlive('horde').length}/${cap()}</small></p>
        <div class="row"><button data-a="leave">Abandon run</button></div>`;
    }
    return `<h4>Best ${h.bestLevel ? `level ${h.bestLevel}` : '—'} · runs ${h.runs}</h4>
      <p>A short horde arena. You move; your weapons fire on their own. Pick a reward as you level. Some weapons combine into a stronger form. Waves scale with you, but a low-level run stays fair.</p>
      <p><small>Unlocks: ${h.unlocks.length ? h.unlocks.map(u => UNLOCKS[u]).join(' · ') : 'none yet. Survive a run to earn a starting blade.'}</small></p>
      <div class="row"><button data-a="go" style="min-height:44px">Start Hordewake</button></div>`;
  }, act: (a, d) => { if (a === 'go') { A.hordeStart(); } if (a === 'pick') A.hordePick(+d.i); if (a === 'leave') A.runEnd(false); } });

  A.vtests = A.vtests || {};
  A.vtests.hordewake = async (g, A) => {
    const h = H(), prev = JSON.parse(JSON.stringify(h));
    const gold = g.player.gold, hx = A.pos().x;
    try {
      if (!A.hordeStart()) return 'no start';
      await new Promise(r => setTimeout(r, 400));
      const r = A.run;
      if (!r || r.kind !== 'horde') return 'not in run';
      if (!(A.pos().x < -900)) return 'not in arena';
      const n = A.zoneAlive('horde').length;
      if (!(n > 0 && n <= cap())) return 'cap ' + n;
      // Auto-fire: simulate a frame.
      for (const f of ctx.EXT.extFrame) { try { f(0.016, performance.now()); } catch (e) {} }
      // Force a level-up card, pick a haste or weapon, then try a combo path.
      r.xp = 999; r.level = 1;
      const dummy = A.zoneAlive('horde')[0];
      if (dummy) { dummy.hordeFoe = true; dummy.hp = 0; dummy.alive = false; dummy.state = 'dead'; for (const f of ctx.EXT.extKill) f(dummy); }
      if (!r.cards) return 'no cards';
      const pickAt = Math.max(0, r.cards.findIndex(c => c.t === 'haste' || c.t === 'wep' || c.t === 'combo' || c.t === 'mag' || c.t === 'heart'));
      if (!A.hordePick(pickAt)) return 'pick';
      if (r.paused) return 'still paused';
      // Combine: grant both parts and offer the combo card directly (the random deck may not include it).
      if (!r.weapons.includes('blade')) r.weapons.push('blade');
      if (!r.weapons.includes('wand')) r.weapons.push('wand');
      r.slots = Math.max(r.slots, 3);
      r.cards = [{ t: 'combo', id: 'orbitflare', from: 'blade+wand', name: 'Combine into Orbit Flare', desc: WEAPONS.orbitflare.desc }];
      r.paused = true;
      if (!A.hordePick(0) || !r.weapons.includes('orbitflare')) return 'combo missing';
      // Leave mid-run without corrupting the overworld.
      A.runEnd(false);
      await new Promise(r => setTimeout(r, 80));
      // Win path: start again, wait until we are in the arena, finish, then wait to return.
      if (!A.hordeStart()) return 'restart';
      for (let i = 0; i < 25 && !(A.pos().x < -900); i++) await new Promise(r => setTimeout(r, 200));
      if (!A.run || A.run.kind !== 'horde' || !(A.pos().x < -900)) return 'restart not in arena';
      A.run.level = 8; A.run.kills = 12;
      A.runEnd(true);
      for (let i = 0; i < 25 && A.pos().x < -700; i++) await new Promise(r => setTimeout(r, 200));
      if (!H().unlocks.includes('blade') && !H().unlocks.includes('slot') && !H().unlocks.includes('bow')) return 'no unlock';
      if (H().runs < 1) return 'runs not saved';
      if (A.pos().x < -700) return 'stuck in instance';
      return true;
    } finally {
      if (A.run && A.run.kind === 'horde') A.runEnd(false);
      Object.keys(h).forEach(k => delete h[k]); Object.assign(h, prev);
      g.player.gold = gold;
    }
  };
}
