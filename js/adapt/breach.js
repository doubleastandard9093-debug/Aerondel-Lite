// Breach Runs (adapted from Destiny 2 strikes / The First Descendant missions): short instanced objectives with a random modifier and a grade.
import * as THREE from 'three';
import { NORM, obj, num } from './state.js';
export const MODES = {
  ward: ['Hold the Ward', 'Keep the ward standing through 3 waves. Every foe alive drains it.'],
  nodes: ['Sever the Nodes', 'Stand on each of 3 breach nodes until it closes. Foes guard them.'],
  purge: ['Purge', 'Defeat 24 foes as fast as you can.']
};
export const MODS = {
  burning: ['Burning ground', 'You lose 1% health every 3 ticks', 1.25],
  shielded: ['Elites shielded', 'Foes have +50% health', 1.2],
  frenzy: ['Frenzy', 'Foes hit 30% harder', 1.2],
  gilded: ['Gilded', '+50% coins', 1],
  calm: ['Calm', 'No twist', 1]
};
const FOES = [['Ashen raider', 'Sand Reaver', 'Rime Wraith'], ['Canopy Stalker', 'Magma Brute', 'Barrow Ghoul'], ['Thornback Prowler', 'Hoarfrost Stalker', 'Storm Gryphon'], ['Murk Leech', 'Glass Scorpion', 'Voidborn Knight']];
NORM.breach = v => { v = obj(v); const best = {}; for (const k of Object.keys(MODES)) { const g = obj(v.best)[k]; if (typeof g === 'string' && /^[SABC]$/.test(g)) best[k] = g; } return { runs: Math.floor(num(v.runs, 0, 0)), best, anima: Math.floor(num(v.anima, 0, 0)) }; };
const pick = a => a[Math.floor(Math.random() * a.length)];
export default function breach(A) {
  const { ctx, player } = A, B = () => A.S('breach');
  A.breachStart = (mode, hard) => {
    if (!MODES[mode]) return; if (hard && A.vLevel() < 500) return A.log('Hard breaches open at an average combat level of 500.', 'warn');
    const mod = pick(Object.keys(MODS)), L = Math.round(A.vLevel() * (hard ? 1.5 : 1)), set = FOES[Math.min(3, Math.floor(A.vLevel() / 150))];
    const ok = A.runStart('breach', { kind: 'breach', mode, mod, hard, L, set, wave: 0, kills: 0, ward: 100, nodes: [], tick: step, end: finish });
    if (ok) A.log(`${MODES[mode][0]}${hard ? ' (Hard)' : ''}. Twist: ${MODS[mod][0]} — ${MODS[mod][1]}.`, 'warn');
    if (ok) setup(A.run); return ok;
  };
  const spawnSome = (r, n, near) => { const room = A.cap(15) - A.zoneAlive('breach').length; for (let i = 0; i < Math.min(n, room); i++) {
    const [dx, dz] = near || [(Math.random() - 0.5) * 20, -4 - Math.random() * 8]; A.zoneSpawn('breach', pick(r.set), dx + (Math.random() - 0.5) * 3, dz + (Math.random() - 0.5) * 3, r.L, { hpMul: r.mod === 'shielded' ? 1.5 : 1, breachFoe: true }); } };
  function setup(r) {
    if (r.mode === 'ward') { r.wardE = A.zoneProp('breach', 0, 0, new THREE.CylinderGeometry(0.8, 1, 2.2, 8), 0x6ad0ff, { ext: 'breachward', name: 'Breach ward', temp: true }); r.wave = 1; spawnSome(r, 5); }
    if (r.mode === 'nodes') { for (const [dx, dz] of [[-8, -6], [8, -6], [0, -11]]) { r.nodes.push({ e: A.zoneProp('breach', dx, dz, new THREE.OctahedronGeometry(0.9), 0xd04aff, { ext: 'breachnode', name: 'Breach node', temp: true }), dx, dz, p: 0 }); spawnSome(r, 2, [dx, dz]); } }
    if (r.mode === 'purge') { r.goal = 24; spawnSome(r, 8); }
  }
  function step(r) {
    const alive = A.zoneAlive('breach').length, p = A.pos();
    if (r.mod === 'burning' && A.tick() % 3 === 0 && player.hp > 1) player.hp = Math.max(1, player.hp - Math.ceil(player.maxHp * 0.01));
    if (Date.now() - r.start > 8 * 60000) { A.log('The breach collapses — out of time.', 'warn'); return A.runEnd(false); }
    if (r.mode === 'ward') { r.ward -= alive * 0.25; if (r.ward <= 0) { A.log('The ward shatters!', 'warn'); return A.runEnd(false); }
      if (!alive) { if (r.wave >= 3) return A.runEnd(true); r.wave++; A.log(`Wave ${r.wave}/3.`, 'combat'); spawnSome(r, 4 + r.wave * 2); } }
    if (r.mode === 'nodes') { for (const n of r.nodes) if (n.p < 100 && Math.hypot(p.x - n.e.x, p.z - n.e.z) < 3) { n.p += 8; if (n.p >= 100) { A.zonePropRemove(n.e); A.log('A breach node closes.', 'skill'); if (r.nodes.some(q => q.p < 100)) spawnSome(r, 3); } }
      if (r.nodes.every(n => n.p >= 100)) return A.runEnd(true); if (A.tick() % 12 === 0 && alive < 4) spawnSome(r, 2); }
    if (r.mode === 'purge') { if (r.kills >= r.goal) return A.runEnd(true); if (alive < 4 && r.kills + alive < r.goal) spawnSome(r, Math.min(5, r.goal - r.kills - alive)); }
  }
  ctx.EXT.extKill.push(m => { if (m.breachFoe && A.run && A.run.kind === 'breach') A.run.kills++; });
  ctx.EXT.extIncoming.push(d => (A.run && A.run.kind === 'breach' && A.run.mod === 'frenzy' ? Math.round(d * 1.3) : d));
  function finish(win, r) {
    if (!win) return A.log('The breach run failed. No reward.', 'warn');
    const secs = (Date.now() - r.start) / 1000, par = { ward: 150, nodes: 120, purge: 140 }[r.mode];
    const grade = secs < par ? 'S' : secs < par * 1.5 ? 'A' : secs < par * 2.2 ? 'B' : 'C', gm = { S: 2, A: 1.5, B: 1.2, C: 1 }[grade] * MODS[r.mod][2] * (r.hard ? 2 : 1);
    const coins = Math.round((200 + r.L * 6) * gm * (r.mod === 'gilded' ? 1.5 : 1)), xp = Math.round((60 + r.L * 4) * gm), anima = Math.round(2 * gm);
    player.gold += coins; ctx.giveXP(A.styleSkill(A.style()), xp); ctx.giveXP('Hitpoints', xp / 3); B().runs++; B().anima += anima;
    if (!B().best[r.mode] || 'SABC'.indexOf(grade) < 'SABC'.indexOf(B().best[r.mode])) B().best[r.mode] = grade;
    A.log(`Breach cleared in ${Math.round(secs)}s — grade ${grade}! +${A.fmt(coins)} coins, +${anima} Anima.`, 'loot');
    if (grade === 'S' || r.hard || Math.random() < 0.35) A.bonusDrop && A.bonusDrop({ level: r.L }, 'the breach');
    if (A.onBreachClear) for (const f of A.onBreachClear) f(r, grade);
  }
  A.onBreachClear = [];
  ctx.EXT.extTalk.breachward = { face: '🔷', talk: () => [['npc', `The ward hums. Integrity ${Math.max(0, Math.round(A.run && A.run.ward || 0))}%.`]] };
  ctx.EXT.extTalk.breachnode = { face: '🔮', talk: () => [['npc', 'Stand close to the node to close it.']] };
  A.npc('breachwarden', '🛡️', 'Breachwarden Kael', 'Rifts open out past the western mists. Short runs, odd twists, good pay. Pick one.', 'breach');
  A.guide.push(['Breach Runs', 'Breachwarden Kael in Larkhaven, or Ventures ✦ → Breach. Short instanced runs (Hold the Ward, Sever the Nodes, Purge) with a random twist and an S–C grade. Rewards coins, XP, Anima and sometimes a tome or graft. Hard breaches unlock at average combat level 500. At most 15 foes at once (8 on Low).']);
  A.tab({ id: 'breach', icon: '🌀', name: 'Breach', render: () => { const r = A.run && A.run.kind === 'breach' ? A.run : null, b = B();
    if (r) { const st = r.mode === 'ward' ? `Ward ${Math.max(0, Math.round(r.ward))}% · wave ${r.wave}/3` : r.mode === 'nodes' ? `Nodes closed ${r.nodes.filter(n => n.p >= 100).length}/3` : `Kills ${r.kills}/${r.goal}`;
      return `<h4>${MODES[r.mode][0]} — ${MODS[r.mod][0]}</h4><p>${st} · ${Math.round((Date.now() - r.start) / 1000)}s</p><p><small>${MODES[r.mode][1]}</small></p><div class="row"><button data-a="leave">Abandon run</button></div>`; }
    return `<h4>Runs ${b.runs} · Anima ${b.anima}</h4>` + Object.entries(MODES).map(([k, [n, d]]) => `<div style="margin:6px 0"><b>${n}</b> <small>best ${b.best[k] || '—'}</small><br><small>${d}</small><div class="row" style="gap:4px"><button data-a="go" data-m="${k}" style="min-height:40px">Start</button>${A.vLevel() >= 500 ? `<button data-a="hard" data-m="${k}" style="min-height:40px">Hard</button>` : ''}</div></div>`).join('') + `<p><small>Foes match your level (${A.vLevel()}). Time limit 8 minutes.</small></p>`; },
    act: (a, d) => { if (a === 'go') { A.breachStart(d.m, false); A.close(); } if (a === 'hard') { A.breachStart(d.m, true); A.close(); } if (a === 'leave') A.runEnd(false); } });
  A.vtests = A.vtests || {};
  A.vtests.breach = async (g, A) => { if (!A.breachStart('purge', false)) return 'no start'; await new Promise(r => setTimeout(r, 400)); const n = A.zoneAlive('breach').length, inZone = A.pos().x < -900;
    A.run.kills = 24; for (const m of A.zoneAlive('breach')) { m.alive = false; m.state = 'dead'; } await new Promise(r => setTimeout(r, 1500)); const runs = A.S('breach').runs; await new Promise(r => setTimeout(r, 2000));
    return n > 0 && n <= A.cap(15) && inZone && runs >= 1 && A.pos().x > -700 || `n${n} z${inZone} r${runs} x${Math.round(A.pos().x)}`; };
}
