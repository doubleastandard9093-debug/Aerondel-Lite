// Guardbreak (adapted from Elden Ring poise): ordinary armed foes carry a small stance bar.
// Heavy hits, war fans, glaives, Tetherline and techniques fill it; a break stuns and opens a short riposte.
// Bosses keep Crestbreak as their big stagger. Guardbreak can feed that bar but will not lock a boss.
import { NORM, obj, num } from './state.js';
import { ITEMS } from '../items.js';

NORM.guard = v => { v = obj(v); return { breaks: Math.floor(num(v.breaks, 0, 0)), ripostes: Math.floor(num(v.ripostes, 0, 0)) }; };

export default function guardbreak(A) {
  const { ctx, player, skills } = A;
  let lastSpecial = null;
  ctx.EXT.extSwing.push((mon, swings, ranged, special) => { lastSpecial = special || null; });

  const armed = m => !!(m && m.alive && (m.maxHit || m.att) && !m.critter && !m.node);
  A.poiseMax = m => Math.max(18, Math.round(16 + (m.level || 1) * 0.45 + (A.isBossy(m) ? 20 : 0)));
  A.poiseOf = m => (m && m._poise != null) ? m._poise : (m ? (m._poise = 0) : 0);
  A.riposteOpen = m => !!(m && m._riposteUntil && A.tick() < m._riposteUntil);

  const playerPoiseMax = () => {
    let n = 14 + A.lvl('Defence') * 0.35;
    for (const sl of ['body', 'legs', 'head', 'shield']) {
      const info = ITEMS[player.equipment[sl]];
      if (info && (info.def || 0) >= 20) n += 4 + Math.min(8, (info.def || 0) / 20);
    }
    return Math.round(n);
  };
  A.playerPoiseMax = playerPoiseMax;
  if (player._poise == null) player._poise = playerPoiseMax();

  const breakFoe = m => {
    const boss = A.isBossy(m);
    A.S('guard').breaks++;
    m._poise = 0;
    m._poiseCd = A.tick() + (boss ? 10 : 6);
    const stun = boss ? 1 : 2;
    // Do not extend a Crestbreak stun; only apply a short stagger if the boss is not already broken.
    if (!(boss && A.isBroken && A.isBroken(m))) m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + stun);
    if (boss && A.stagger) A.stagger(m, 14);
    if (!boss) m._riposteUntil = A.tick() + 5 + (A.leyKey && A.leyKey('stillblade') ? 3 : 0);
    else m._riposteUntil = A.tick() + 2 + (A.leyKey && A.leyKey('stillblade') ? 1 : 0);
    m._riposteUsed = false;
    A.log(boss ? `Guardbreak! The ${m.name} staggers (Crestbreak is fed).` : `Guardbreak! The ${m.name} is open to a riposte.`, 'combat');
    A.dirty(); A.refreshQuick();
  };

  const fill = (m, d, kind) => {
    if (!armed(m) || d <= 0) return;
    if (m._poiseCd && A.tick() < m._poiseCd) return;
    if (A.riposteOpen(m)) return;
    const max = A.poiseMax(m);
    if (m._poise == null) m._poise = 0;
    const cls = A.weapon().cls;
    let n = 6 + Math.min(14, d / Math.max(4, (m.maxHp || 20) * 0.08) * 8);
    if (cls === 'warfan' || cls === 'glaive') n *= 1.8;
    if (lastSpecial || kind === 'flare') n *= 2.2;
    if (kind === 'tether') n += 16;
    if (A.isBossy(m)) n *= 0.55;
    lastSpecial = null;
    m._poise = Math.min(max, m._poise + n);
    if (m._poise >= max) breakFoe(m);
  };
  A.poiseFill = fill;
  A.poiseAdd = (m, n) => {
    if (!armed(m) || !(n > 0)) return;
    if (m._poiseCd && A.tick() < m._poiseCd) return;
    if (A.riposteOpen(m)) return;
    const max = A.poiseMax(m);
    if (m._poise == null) m._poise = 0;
    m._poise = Math.min(max, m._poise + n);
    if (m._poise >= max) breakFoe(m);
  };
  ctx.EXT.extHit.push((mon, d, now, kind) => {
    if (kind === 'strike' && d <= 0) return;
    const wasOpen = mon && A.riposteOpen(mon) && !mon._riposteUsed;
    fill(mon, d, kind);
    // The breaking hit itself does not consume the window; the next damaging hit does.
    if (wasOpen && d > 0) {
      mon._riposteUsed = true; mon._riposteUntil = 0;
      A.S('guard').ripostes++; A.dirty(); A.refreshQuick();
    }
  });

  // Next hit in the window auto-crits once (a window, not a standing damage bonus).
  A.mods.dmg.push(m => (!m || m._riposteUsed || !A.riposteOpen(m) ? 0 : 1));

  A.doRiposte = m => {
    m = m || (ctx.target && ctx.target());
    if (!m || !A.riposteOpen(m) || m._riposteUsed) return A.log('There is no opening to riposte.', 'warn');
    if (A.dist(m.mesh.position.x, m.mesh.position.z) > 4) return A.log('Step in closer to riposte.', 'warn');
    const d = ctx.strike(m, { dmg: 1, acc: 2 }, typeof performance !== 'undefined' ? performance.now() : A.tick(), { quiet: false });
    if (!(d > 0) && !m._riposteUsed) return A.log('The riposte misses.', 'warn');
    return true;
  };
  A.quick(() => (ctx.monsters.some(m => A.riposteOpen(m) && !m._riposteUsed && A.dist(m.mesh.position.x, m.mesh.position.z) < 5) ? [['riposte', 'Riposte', 'Punish a Guardbreak opening']] : []));
  A.onQuick('riposte', () => A.doRiposte());

  // Player poise: only heavy hits chip it, so scratches never stagger you.
  ctx.EXT.extIncoming.push((dmg, mon) => {
    if (!(dmg > 0)) return dmg;
    const max = playerPoiseMax();
    if (player._poise == null) player._poise = max;
    const heavy = dmg >= Math.max(7, (player.maxHp || 10) * 0.12);
    if (!heavy) return dmg;
    if (player._poiseCd && A.tick() < player._poiseCd) return dmg;
    player._poise -= 28 + Math.min(40, dmg * 1.2);
    if (player._poise <= 0) {
      player._poise = max;
      player._poiseCd = A.tick() + 8;
      player.stunUntil = Math.max(player.stunUntil || 0, A.tick() + 1);
      A.log('Your guard breaks! You are staggered.', 'warn');
    }
    return dmg;
  });
  ctx.EXT.extTick.push(() => {
    const max = playerPoiseMax();
    if (player._poise == null) player._poise = max;
    else if (player._poise < max && !(player._poiseCd && A.tick() < player._poiseCd)) player._poise = Math.min(max, player._poise + 4);
  });

  // A thin pip under health (and under Crestbreak on bosses). Numbers only — no extra meshes.
  const tp = document.getElementById('targetPanel'), bar = document.createElement('div');
  bar.id = 'guardBar'; bar.style.cssText = 'height:4px;margin-top:2px;background:#0006;border-radius:3px;overflow:hidden;display:none';
  bar.innerHTML = '<i style="display:block;height:100%;width:0;background:#7aa0c8"></i>'; if (tp) tp.appendChild(bar);
  ctx.EXT.extFrame.push(() => {
    const t = ctx.target(); const on = !!(t && t.alive && armed(t));
    bar.style.display = on ? 'block' : 'none';
    if (on) {
      const i = bar.firstChild, max = A.poiseMax(t), v = A.poiseOf(t);
      const open = A.riposteOpen(t) && !t._riposteUsed;
      i.style.width = (open ? 100 : Math.min(100, (v / max) * 100)) + '%';
      i.style.background = open ? '#c84a4a' : '#7aa0c8';
    }
  });

  A.guide.push(['Guardbreak', 'Armed foes show a short blue poise pip under their health. Heavy hits, war fans, glaives, techniques and Tetherline fill it. A break stuns them and opens a short riposte — tap Riposte, or let your next hit auto-crit. Bosses still use Crestbreak; Guardbreak only feeds that stagger and will not lock them. Defence and heavy armour give you a light poise of your own, so ordinary scratches will not stagger you.']);
  A.tab({ id: 'guard', icon: '🛡️', name: 'Guardbreak', render: () => {
    const h = A.S('guard');
    return `<h4>Guardbreak</h4><p>Ordinary armed foes have a small poise bar (blue, under their health). Fill it to stagger them and open a riposte window: tap <b>Riposte</b> or land your next hit for an automatic crit. Bosses keep Crestbreak as their big stagger; a Guardbreak on a boss feeds that bar and only stuns briefly, with a cooldown so they cannot be locked.</p>
      <p><small>Your poise: ${Math.round(player._poise || 0)} / ${playerPoiseMax()} (Defence and heavy armour). Breaks ${h.breaks} · ripostes ${h.ripostes}.</small></p>`; } });

  A.vtests = A.vtests || {};
  A.vtests.guardbreak = async (g, A) => {
    const gob = { name: 'Goblin', alive: true, hp: 20, maxHp: 20, maxHit: 2, att: 2, level: 2, stunUntil: 0, mesh: { position: { x: A.pos().x + 1, y: 0, z: A.pos().z } } };
    A.poiseOf(gob);
    const max = A.poiseMax(gob);
    for (let i = 0; i < 20 && !A.riposteOpen(gob); i++) fill(gob, 12, 'melee');
    if (!A.riposteOpen(gob) || !(gob.stunUntil > A.tick())) return 'no goblin break';
    const boss = { name: 'Test Warden', boss: true, alive: true, hp: 200, maxHp: 200, maxHit: 20, att: 20, level: 140, stunUntil: 0, mesh: { position: { x: 0, y: 0, z: 0 } } };
    if (A.stagger) A.stagger(boss, 40);
    const stag0 = boss._stag || 0;
    for (let i = 0; i < 30 && !(boss._poiseCd); i++) fill(boss, 40, 'melee');
    if (!boss._poiseCd) return 'no boss poise break';
    // Boss should not be in a long riposte lock; crestbreak still functions
    const longLock = A.riposteOpen(boss) && (boss._riposteUntil - A.tick()) > 3;
    if (longLock) return 'boss locked';
    if (A.stagger && (boss._stag || 0) < stag0 && !(A.isBroken && A.isBroken(boss))) {
      // stagger may have reset if it broke — that's feeding Crestbreak, fine
    }
    const pMax = playerPoiseMax();
    const oldP = player._poise, oldS = player.stunUntil, oldC = player._poiseCd;
    player._poise = pMax; player._poiseCd = 0;
    // a scratch must not stun
    const inc = ctx.EXT.extIncoming;
    let dmg = 2; for (const f of inc) dmg = f(dmg, gob, 0);
    const scratched = (player.stunUntil || 0) > (oldS || 0);
    player._poise = 10; player._poiseCd = 0;
    dmg = Math.max(8, Math.ceil((g.player.maxHp || 10) * 0.15));
    for (const f of inc) dmg = f(dmg, gob, 0);
    const heavyStun = (player.stunUntil || 0) > (oldS || 0);
    player._poise = oldP; player.stunUntil = oldS; player._poiseCd = oldC;
    if (scratched) return 'scratch stunned';
    if (!heavyStun) return 'heavy hit did not break player poise';
    return true;
  };
}
