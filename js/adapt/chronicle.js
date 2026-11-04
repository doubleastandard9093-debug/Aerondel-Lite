// Season Chronicle: each season (real or picked at the Seasonkeeper) opens a short story chapter and a seasonal artifact.
// Artifact levels come from kills, boss kills, breaches and Tides; each level unlocks a mod. Everything resets each season.
import { NORM, obj, num, arr, str } from './state.js';
import { SEASONS, currentSeason } from '../seasons.js';
const CH = {
  spring: ['The Thawbound Pact', ['Wake the river spirits: defeat 25 foes', 'Break a boss crest or slay a boss', 'Clear a Breach Run', 'Finish a Burst Tide'], 'Bloomward Seal'],
  summer: ['Embers of Solmere', ['Drive back the sun-touched: defeat 25 foes', 'Slay a boss', 'Clear a Breach Run', 'Finish a Burst Tide'], 'Sunforged Seal'],
  autumn: ['The Harrowing Lanterns', ['Gather the lantern-wraiths: defeat 25 foes', 'Slay a boss', 'Clear a Breach Run', 'Finish a Burst Tide'], 'Harvestmoon Seal'],
  winter: ['Song of the Long Night', ['Hold the snowline: defeat 25 foes', 'Slay a boss', 'Clear a Breach Run', 'Finish a Burst Tide'], 'Rimeheart Seal']
};
const MODS = [
  ['breaker', 'Ward-breaker', 2, '+12% damage to bosses and elites'],
  ['overload', 'Overload', 4, 'Hits have a 6% chance to stun a foe for 2 ticks'],
  ['steadfast', 'Steadfast', 6, '6% less damage taken'],
  ['tidecall', 'Tidecaller', 8, '+8% XP'],
  ['radiant', 'Radiant', 10, '+5% accuracy and damage']
];
const FOR = lv => 100 + lv * 60;
NORM.chron = v => { v = obj(v); return { key: str(v.key, null, ''), step: arr(v.step).slice(0, 4).map(n => num(n, 0, 0, 999)), lv: num(v.lv, 0, 0, 20), xp: num(v.xp, 0, 0), on: arr(v.on).filter(x => MODS.some(m => m[0] === x)).slice(0, 3), done: !!v.done }; };
export default function chronicle(A) {
  const { ctx } = A;
  const key = () => `${currentSeason(A.player)}-${new Date().getFullYear()}`;
  const C = () => { const c = A.S('chron'); if (c.key !== key()) { Object.assign(c, { key: key(), step: [0, 0, 0, 0], lv: 0, xp: 0, on: [], done: false }); A.dirty(); } return c; };
  const ch = () => CH[currentSeason(A.player)] || CH.summer;
  const need = [25, 1, 1, 1];
  const on = id => C().on.includes(id) && C().lv >= MODS.find(m => m[0] === id)[2];
  const gain = n => { const c = C(); if (c.lv >= 20) return; c.xp += n; while (c.lv < 20 && c.xp >= FOR(c.lv)) { c.xp -= FOR(c.lv); c.lv++; A.log(`${ch()[2]} rises to level ${c.lv}.`, 'level'); const m = MODS.find(m => m[2] === c.lv); if (m) A.log(`Artifact mod unlocked: ${m[1]} (pick it in Ventures → Chronicle).`, 'level'); } A.dirty(); };
  const step = (i, n = 1) => { const c = C(); if (c.done) return; const cur = c.step.findIndex((s, j) => s < need[j]); if (cur !== i) return; c.step[i] = Math.min(need[i], c.step[i] + n);
    if (c.step[i] >= need[i]) { gain(80); A.log(`Chronicle — ${ch()[0]}: "${ch()[1][i]}" complete.`, 'level');
      if (i === 3) { c.done = true; A.give(ch()[2] + ' fragment', 1) || (A.player.gold += 5000); A.player.gold += 5000; A.log(`Chapter complete! You earn 5,000 coins and a ${ch()[2]} fragment.`, 'loot'); } } A.dirty(); };
  A.chronStep = step; A.chronGain = gain;
  ctx.EXT.extKill.push(m => { gain(A.isBossy(m) ? 25 : 3); step(0); if (A.isBossy(m)) step(1); if (m.tideBoss) step(3); });
  if (A.onBreachClear) A.onBreachClear.push(() => { gain(40); step(2); });
  A.mods.dmg.push(m => (on('breaker') && m && (A.isBossy(m) || m.elite) ? 0.12 : 0) + (on('radiant') ? 0.05 : 0));
  A.mods.acc.push(() => (on('radiant') ? 0.05 : 0));
  A.mods.dr.push(() => (on('steadfast') ? 0.06 : 0));
  A.mods.xp.push(() => (on('tidecall') ? 0.08 : 0));
  ctx.EXT.extHit.push((m, d) => { if (d > 0 && on('overload') && m && m.alive && Math.random() < 0.06) { m.stunUntil = A.tick() + 2; A.log('Overload! The foe is stunned.', 'game'); } });
  A.tab({ id: 'chron', icon: '📜', name: 'Chronicle', render: () => { const c = C(), s = SEASONS[currentSeason(A.player)], [t, steps, art] = ch(), cur = c.step.findIndex((v, j) => v < need[j]);
      const st = steps.map((x, j) => `<div class="row"><div>${j < cur || c.done ? '✅' : j === cur ? '▶️' : '🔒'} ${A.esc(x)} <small>${j === cur ? `${c.step[j]}/${need[j]}` : ''}</small></div></div>`).join('');
      const md = MODS.map(([id, n, lv, d]) => `<div class="row"><div><b>${n}</b> <small>lv ${lv} — ${d}</small></div>${c.lv >= lv ? `<button data-a="mod" data-m="${id}" class="${c.on.includes(id) ? 'on' : ''}">${c.on.includes(id) ? 'On' : 'Off'}</button>` : '<small>🔒</small>'}</div>`).join('');
      return `<h4>${s.icon} ${s.name} chapter: ${A.esc(t)}</h4>${st}<h4>${A.esc(art)} — level ${c.lv}/20</h4><div class="bar"><i style="width:${c.lv >= 20 ? 100 : Math.round(c.xp / FOR(c.lv) * 100)}%"></i></div><small>Up to 3 mods at once. The chapter, artifact and mods reset when the season changes.</small>${md}`; },
    act: (a, d) => { if (a !== 'mod') return; const c = C(), i = c.on.indexOf(d.m); if (i >= 0) c.on.splice(i, 1); else if (c.on.length < 3) c.on.push(d.m); else A.log('Only 3 artifact mods can be on at once.', 'game'); A.dirty(); A.render(); } });
  A.guide.push(['Season Chronicle', 'Each season brings a 4-step story chapter and a seasonal artifact. Kills, bosses, Breaches and Tides level it; levels 2–10 unlock mods (pick up to 3). It all resets when the season changes. Ventures (J) → 📜 Chronicle.']);
  A.vtests = A.vtests || {};
  A.vtests.chron = async (g, A) => { const c = C(); c.key = 'old'; const c2 = C(); if (c2.lv !== 0) return 'no reset'; gain(2000); c2.on = []; for (let i = 0; i < 25; i++) step(0); step(1); step(2); step(3);
    const r = c2.lv >= 6 && c2.done; c2.on.push('steadfast'); const dr = A.mods.dr.reduce((s, f) => s + f(), 0) > 0; c2.on = []; return r && dr || `lv${c2.lv} done${c2.done} dr${dr}`; };
}
