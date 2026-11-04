// Vigil Gates (adapted from Lost Ark legion raids / Destiny 2 dungeons): 3-phase boss trials with read-able telegraphs, normal and hard tiers,
// and a weekly loot lockout per gate and tier.
import * as THREE from 'three';
import { NORM, obj } from './state.js';
export const GATES = {
  vexmar: { name: "Vexmar's Vigil", boss: 'Sunderlord Vexmar', adds: 'Voidborn Knight', min: 120, color: 0x2a2440, edge: 0x6a4aa0 },
  archon: { name: "Archon's Vigil", boss: 'Molten Archon', adds: 'Ember Imp', min: 60, color: 0x3a2420, edge: 0xa04a2a }
};
const week = () => Math.floor((Date.now() / 86400000 + 3) / 7);
NORM.vigil = v => { v = obj(v); const lock = {}; for (const [k, w] of Object.entries(obj(v.lock))) if (/^(vexmar|archon):(normal|hard)$/.test(k) && Number.isInteger(w)) lock[k] = w; const clears = {}; for (const [k, n] of Object.entries(obj(v.clears))) if (GATES[k]) clears[k] = Math.max(0, Math.floor(+n || 0)); return { lock, clears }; };
export default function vigil(A) {
  const { ctx, player } = A, V = () => A.S('vigil');
  let mark = null;
  const ringGeo = new THREE.RingGeometry(2.6, 3.5, 24), ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  A.vigilStart = (id, hard) => { const G = GATES[id]; if (!G) return false; if (A.vLevel() < G.min) { A.log(`${G.name} needs an average combat level of ${G.min}.`, 'warn'); return false; }
    A.zoneBuild('vigil', G.color, G.edge);
    const ok = A.runStart('vigil', { kind: 'vigil', gate: id, hard, phase: 1, next: A.tick() + 6, tick: step, end: finish }); if (!ok) return false;
    const L = Math.round(A.vLevel() * (hard ? 1.4 : 1.05)); A.run.L = L;
    A.run.boss = A.zoneSpawn('vigil', G.boss, 0, -6, L, { vigil: true, hpMul: hard ? 4 : 2.5, title: `${G.name}${hard ? ' (Hard)' : ''}` });
    A.log(`${G.name}${hard ? ' — Hard' : ''}. Watch for red rings on the ground and step out of them!`, 'warn'); return true; };
  function telegraph(r) { const p = A.pos(); if (!mark) { mark = new THREE.Mesh(ringGeo, ringMat); mark.rotation.x = -Math.PI / 2; ctx.scene.add(mark); }
    mark.position.set(p.x, 0.06, p.z); mark.visible = true; mark.scale.setScalar(1); r.blast = { x: p.x, z: p.z, at: A.tick() + 3 }; }
  function step(r) { const b = r.boss; if (!b) return;
    if (!b.alive && !b.dying) return A.runEnd(true);
    const f = b.hp / b.maxHp;
    if (r.phase === 1 && f < 0.66) { r.phase = 2; A.log(`${b.name} calls its guard!`, 'combat'); for (let i = 0; i < (ctx.gfxQ() === 'low' ? 2 : 4); i++) A.zoneSpawn('vigil', GATES[r.gate].adds, -8 + i * 5, -2, r.L * 0.7, { vigilAdd: true }); }
    if (r.phase === 2 && f < 0.33) { r.phase = 3; A.log(`${b.name} is enraged! Rings come faster.`, 'combat'); }
    if (r.blast && A.tick() >= r.blast.at) { const p = A.pos(); if (mark) mark.visible = false; if (Math.hypot(p.x - r.blast.x, p.z - r.blast.z) < 3.5 && player.hp > 0 && !ctx.pm.dodge) {
      let x = Math.round(player.maxHp * (r.hard ? 0.35 : 0.22)); for (const fn of ctx.EXT.extIncoming) x = fn(x, { name: 'Vigil blast', vigil: true }); player.hp = Math.max(0, player.hp - x); A.log(`The blast hits you for ${x}!`, 'warn'); if (player.hp <= 0) ctx.playerDied(); }
      else A.log('You slip the blast.', 'game'); r.blast = null; }
    if (!r.blast && A.tick() >= r.next) { telegraph(r); r.next = A.tick() + (r.phase === 3 ? 6 : 9); }
    if (mark && mark.visible && r.blast) mark.material.opacity = 0.35 + 0.25 * Math.sin(Date.now() / 90); }
  function finish(win, r) { if (mark) mark.visible = false; if (!win) return A.log('The Vigil holds. Try again.', 'warn');
    const key = `${r.gate}:${r.hard ? 'hard' : 'normal'}`, V0 = V(); V0.clears[r.gate] = (V0.clears[r.gate] || 0) + 1;
    if (V0.lock[key] === week()) { player.gold += 500; return A.log('Vigil cleared! Weekly loot already claimed for this tier: +500 coins.', 'loot'); }
    V0.lock[key] = week(); const coins = Math.round((1500 + r.L * 20) * (r.hard ? 2.5 : 1)); player.gold += coins; ctx.giveXP(A.styleSkill(A.style()), r.L * 25); ctx.giveXP('Hitpoints', r.L * 8);
    A.log(`Vigil cleared! +${A.fmt(coins)} coins.`, 'loot'); if (A.bonusDrop) { A.bonusDrop({ level: 400 }, 'the Vigil'); if (r.hard) A.bonusDrop({ level: 400 }, 'the Vigil'); } if (A.give && r.hard) A.give('Greater brutal graft');
    if (A.pinnacle) A.pinnacle('Vigil Gate'); }
  ctx.EXT.extTalk.vigilgate = { face: '⛩️', talk: () => [['npc', 'A gate of cold light hums here.'], { choose: [...Object.entries(GATES).map(([id, G]) => [`${G.name} (normal)`, [{ run: () => { A.vigilStart(id, false); return []; } }]]), ...Object.entries(GATES).map(([id, G]) => [`${G.name} (hard)`, [{ run: () => { A.vigilStart(id, true); return []; } }]]), ['Leave it.', []]] }] };
  A.guide.push(['Vigil Gates', "Ventures ✦ → Vigil. Boss trials (Vexmar's Vigil, Archon's Vigil) in three phases: guards join at 66%, rings come faster below 33%. Step out of red rings (or dodge). Normal and Hard tiers; full loot once per tier each week (Monday UTC), including a Pinnacle chest for Lumen."]);
  A.tab({ id: 'vigil', icon: '⛩️', name: 'Vigil', render: () => { const r = A.run && A.run.kind === 'vigil' ? A.run : null;
    if (r) return `<h4>${GATES[r.gate].name} — phase ${r.phase}/3</h4><p>${r.boss ? `${r.boss.name}: ${Math.max(0, Math.round(r.boss.hp / r.boss.maxHp * 100))}%` : ''}</p><div class="row"><button data-a="leave">Abandon</button></div>`;
    return Object.entries(GATES).map(([id, G]) => { const l = t => (V().lock[`${id}:${t}`] === week() ? ' <small>(looted this week)</small>' : '');
      return `<div style="margin:6px 0"><b>${G.name}</b> <small>needs level ${G.min} · cleared ${V().clears[id] || 0}</small><div class="row" style="gap:4px"><button data-a="go" data-g="${id}" style="min-height:40px">Normal${l('normal')}</button><button data-a="hard" data-g="${id}" style="min-height:40px">Hard${l('hard')}</button></div></div>`; }).join('') + `<p><small>Your level ${A.vLevel()}. Foes scale to you.</small></p>`; },
    act: (a, d) => { if (a === 'go' && A.vigilStart(d.g, false)) A.close(); if (a === 'hard' && A.vigilStart(d.g, true)) A.close(); if (a === 'leave') A.runEnd(false); } });
  A.vtests = A.vtests || {};
  A.vtests.vigil = async (g, A) => { const sk = A.skills; const old = ['Attack', 'Strength', 'Defence', 'Hitpoints'].map(s => sk[s].level); ['Attack', 'Strength', 'Defence', 'Hitpoints'].forEach(s => sk[s].level = 200);
    try { if (!A.vigilStart('archon', false)) return 'no start'; await new Promise(r => setTimeout(r, 300)); const b = A.run.boss; b.hp = b.maxHp * 0.5; await new Promise(r => setTimeout(r, 1500)); const ph = A.run.phase, adds = A.zoneAlive('vigil').length;
      b.hp = 0; b.alive = false; b.state = 'dead'; await new Promise(r => setTimeout(r, 1500)); return ph === 2 && adds >= 3 && A.S('vigil').clears.archon >= 1 || `ph${ph} a${adds}`; }
    finally { ['Attack', 'Strength', 'Defence', 'Hitpoints'].forEach((s, i) => sk[s].level = old[i]); if (A.run) A.runEnd(false); } };
}
