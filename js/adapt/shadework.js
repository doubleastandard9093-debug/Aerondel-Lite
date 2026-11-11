// Shadework: after you leave a foe's notice you are unseen for a short window.
// The first strike in that window is a Shade hit: a modest named multiplier and a large Guardbreak fill.
// Not a stealth sim. Does not replace pickpocket, Stillwatch or True Aim. Bosses get a smaller benefit.
import { NORM, obj, num } from './state.js';
import { isRangedWeapon } from '../items.js';

export const SHADE_DMG = 0.2, SHADE_DMG_BOSS = 0.08;
export const POISE_FRAC = 0.55, POISE_FRAC_BOSS = 0.15;
export const WINDOW_MS = 2500, NOTICE_R = 9, NOTICE_R_HUSH = 7;
export const MELEE_R = 2.4, RANGE_R = 8;

NORM.shade = v => {
  v = obj(v);
  return {
    hits: Math.max(0, Math.floor(num(v.hits, 0, 0))),
    unseenTime: Math.max(0, Math.floor(num(v.unseenTime, 0, 0))),
    hidePip: !!v.hidePip
  };
};

export default function shadework(A) {
  const { ctx, player, skills } = A;
  const S = () => A.S('shade');
  const state = { unseen: true, until: 0, noticed: false, pending: null, lastDodge: false };
  // Mid-fight unseen is not saved; you load noticed-or-out-of-combat, never mid-Shade.

  const hush = () => !!(A.kitHush && A.kitHush()) || !!(A.veilHush && A.veilHush());
  const noticeR = () => (hush() ? NOTICE_R_HUSH : NOTICE_R);
  const windowMs = () => WINDOW_MS + Math.round(((A.lvl('Agility') || 1) + (A.lvl('Thieving') || 1)) * 12) + (hush() ? 400 : 0);
  const pos = () => (A.pos && A.pos()) || { x: 0, z: 0 };
  const monPos = m => (m.mesh && m.mesh.position) || { x: m.x || 0, z: m.z || 0 };
  const faces = (m, px, pz) => {
    const mp = monPos(m), dx = px - mp.x, dz = pz - mp.z, len = Math.hypot(dx, dz) || 1;
    const yaw = (m.mesh && m.mesh.rotation && Number.isFinite(m.mesh.rotation.y)) ? m.mesh.rotation.y : (m.facing || 0);
    return (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / len > 0.35;
  };
  const occluded = (m, px, pz) => {
    const mp = monPos(m), nodes = ctx.nodes || [];
    const mx = (mp.x + px) / 2, mz = (mp.z + pz) / 2;
    const span = Math.hypot(mp.x - px, mp.z - pz);
    if (span < 2) return false;
    for (const n of nodes) {
      if (!n || (n.type !== 'building' && n.kind !== 'building')) continue;
      const nx = n.x, nz = n.z;
      if (!Number.isFinite(nx) || !Number.isFinite(nz)) continue;
      if (Math.hypot(nx - mx, nz - mz) < Math.min(4, span * 0.35)) return true;
    }
    return false;
  };
  const foesNear = (r) => {
    const p = pos(), list = ctx.monsters || [];
    const out = [];
    for (const m of list) {
      if (!m || !m.alive) continue;
      const mp = monPos(m);
      const d = Math.hypot((mp.x || 0) - p.x, (mp.z || 0) - p.z);
      if (d <= r) out.push({ m, d });
    }
    return out;
  };
  const anyoneNotices = () => {
    const p = pos(), r = noticeR();
    for (const { m, d } of foesNear(r + 1)) {
      if (d > r) continue;
      if (occluded(m, p.x, p.z)) continue;
      const fighting = m.state === 'fight' || m.state === 'attack';
      if ((fighting || d < r * 0.7) && faces(m, p.x, p.z)) return m;
    }
    return null;
  };

  A.shadeUnseen = () => !!state.unseen;
  A.shadeNoticed = () => !!state.noticed;
  A.shadeWindow = windowMs;
  A.shadeHidePip = on => { if (on == null) return !!(player.settings && player.settings.shadePip === false) || S().hidePip; S().hidePip = !!on; if (player.settings) player.settings.shadePip = on ? false : true; A.dirty(); refreshPip(); return S().hidePip; };

  A.shadeEnter = (why) => {
    if (state.unseen) return false;
    state.unseen = true; state.noticed = false; state.until = Date.now() + windowMs();
    S().unseenTime += Math.round(windowMs() / 1000);
    refreshPip(); return true;
  };
  A.shadeNotice = (why) => {
    if (!state.unseen && state.noticed) return false;
    state.unseen = false; state.noticed = true; state.until = 0; state.pending = null;
    refreshPip(); return true;
  };
  A.shadeBreakLine = (why) => {
    A.shadeEnter(why || 'break');
    return true;
  };
  A.shadeStrikeRange = (ranged) => (ranged ? RANGE_R : MELEE_R);
  A.shadeArmed = m => {
    if (!state.unseen || !m) return false;
    const p = pos(), mp = monPos(m);
    const d = Math.hypot((mp.x || 0) - p.x, (mp.z || 0) - p.z);
    const ranged = !!(player.equipment && isRangedWeapon(player.equipment.weapon));
    return d <= A.shadeStrikeRange(ranged) + 0.4;
  };

  A.mods.dmg.push(m => {
    if (!m || !A.shadeArmed(m)) return 0;
    return (A.isBossy && A.isBossy(m)) ? SHADE_DMG_BOSS : SHADE_DMG;
  });
  ctx.EXT.extSwing.push((mon, swings) => {
    if (mon && A.shadeArmed(mon)) state.pending = mon;
  });
  ctx.EXT.extHit.push((mon, d) => {
    if (!mon || mon !== state.pending || !(d > 0)) { if (mon && mon === state.pending) state.pending = null; return; }
    state.pending = null;
    S().hits++;
    const boss = !!(A.isBossy && A.isBossy(mon));
    const max = A.poiseMax ? A.poiseMax(mon) : 24;
    const add = max * (boss ? POISE_FRAC_BOSS : POISE_FRAC);
    if (A.poiseAdd) A.poiseAdd(mon, add);
    else mon._poise = Math.min(max, (mon._poise || 0) + add);
    if (!boss && A.tick) mon._riposteUntil = Math.max(mon._riposteUntil || 0, A.tick() + 3);
    A.log(boss ? `Shade hit on the ${mon.name}. The opening is smaller on a boss — this will not lock them.` : `Shade hit! The ${mon.name} takes a first strike from unseen, and their poise bar fills.`, 'combat');
    A.shadeNotice('strike');
    A.dirty();
  });
  ctx.EXT.extIncoming.push((dmg, mon) => {
    if (dmg > 0) A.shadeNotice('hit');
    return dmg;
  });

  A.every(1, () => {
    const dodging = !!(ctx.pm && ctx.pm.dodge);
    if (dodging && !state.lastDodge) A.shadeBreakLine('roll');
    state.lastDodge = dodging;
    const seer = anyoneNotices();
    if (seer) A.shadeNotice('cone');
    else if (!state.unseen) {
      const closeFight = foesNear(14).some(({ m }) => m.state === 'fight' || m.state === 'attack');
      if (!closeFight) A.shadeEnter('out');
    }
    if (state.unseen && state.until && Date.now() > state.until && anyoneNotices()) A.shadeNotice('window');
    refreshPip();
  });

  let pip = null;
  const refreshPip = () => {
    if (typeof document === 'undefined') return;
    if (!pip) {
      pip = document.getElementById('shadePip');
      if (!pip) {
        pip = document.createElement('div');
        pip.id = 'shadePip';
        pip.style.cssText = 'position:fixed;top:calc(28px + var(--st,0px));left:calc(8px + var(--sl,0px));z-index:40;font-size:18px;line-height:1;text-shadow:0 1px 2px #000;pointer-events:none;';
        document.body.appendChild(pip);
      }
    }
    const hide = A.shadeHidePip();
    pip.style.display = hide ? 'none' : 'block';
    pip.textContent = state.unseen ? '👁' : '✕';
    pip.title = state.unseen ? 'Unseen — a Shade hit is ready' : 'Noticed';
    pip.setAttribute('data-unseen', state.unseen ? '1' : '0');
  };
  A.onReady.push(() => refreshPip());

  A.npc('shadework', '👁', 'Shadeguide Vess', 'Leave a foe\'s notice — a roll, a corner, or simply starting from out of combat — and you are unseen for a short window. The first strike in that window is a Shade hit: a modest extra, and a much larger fill of their Guardbreak bar. Bosses and Colossi only feel a little of it, so you cannot lock them. This is not a sneak through town, and it does not replace a pickpocket, Stillwatch or True Aim.', 'shade');
  A.guide.push(['Shadework', 'Ventures ✦ → Shadework, or talk to Shadeguide Vess in Larkhaven. After you leave a foe\'s notice you are unseen for a short window (Agility and Thieving lengthen it a little; a hush-string or quiet-step veil helps too). The first melee or ranged strike in that window is a Shade hit. An eye pip shows unseen or noticed; hide it in Settings or on this tab. Not a full stealth sim.']);
  A.tab({ id: 'shade', icon: '👁', name: 'Shadework', render: () => {
    const s = S();
    return `<h4>Shadework</h4><p>After you leave a foe's notice you are unseen for a short window. The first strike in that window is a <b>Shade hit</b>: a modest named extra (${Math.round(SHADE_DMG * 100)}%, less on a boss) and a large fill of their Guardbreak bar. Ranged and melee both work, at different ranges. Bosses cannot be locked by repeating this. It does not replace pickpocket, Stillwatch or True Aim.</p>
      <p>You are <b>${state.unseen ? 'unseen' : 'noticed'}</b>. Shade hits landed: ${s.hits}.</p>
      <div class="row"><button data-a="pip">${A.shadeHidePip() ? 'Show the eye pip' : 'Hide the eye pip'}</button></div>
      <p><small>A hush-string kit or a quiet-step veil shortens a foe's notice range a little. Settings also has the pip toggle.</small></p>`;
  }, act: a => { if (a === 'pip') A.shadeHidePip(!A.shadeHidePip()); } });

  A.vtests = A.vtests || {};
  A.vtests.shadework = async (g, A) => {
    const s = S(), hits0 = s.hits;
    const { thieve } = await import('/js/gameplay.js');
    // Pickpocket still fails with a stun (Wardfine may also raise a fine later; the stun remains on the result).
    const fail = thieve('Man', g.skills, g.player, () => 1);
    if (!(fail && fail.fail && fail.stun > 0)) return 'pickpocket stun ' + JSON.stringify(fail);
    const gob = { name: 'Goblin', alive: true, hp: 200, maxHp: 200, maxHit: 8, att: 8, level: 40, state: 'idle', _poise: 0,
      mesh: { position: { x: 2, y: 0, z: 0 }, rotation: { y: Math.PI } } }; // facing away
    const p = A.pos && A.pos();
    if (p && gob.mesh) { gob.mesh.position.x = p.x + 1.4; gob.mesh.position.z = p.z; }
    const list = ctx.monsters || (ctx.monsters = []);
    list.push(gob);
    try {
      A.shadeEnter('test');
      if (!A.shadeUnseen()) return 'not unseen';
      if (!A.shadeArmed(gob)) return 'not armed';
      const bonus = (A.totals(gob).dmg);
      if (bonus < SHADE_DMG - 1e-9) return 'no shade dmg ' + bonus;
      const poise0 = A.poiseOf ? A.poiseOf(gob) : (gob._poise || 0);
      gob.hp = 30;
      for (const f of (g.EXT.extSwing || [])) { try { f(gob, [{ dmg: 0 }]); } catch (e) { /* other hooks */ } }
      for (const f of (g.EXT.extHit || [])) { try { f(gob, 8, 0, false); } catch (e) { /* other hooks */ } }
      if (s.hits !== hits0 + 1) return 'hit not counted';
      if (A.shadeUnseen()) return 'still unseen after strike';
      const poise1 = A.poiseOf ? A.poiseOf(gob) : (gob._poise || 0);
      const opened = !!(A.riposteOpen && A.riposteOpen(gob));
      if (!(poise1 > poise0 || opened)) return 'no poise fill ' + poise0 + ' ' + poise1;
      // Next hit is not a Shade hit (a short riposte window from the fill is ok).
      if (A.shadeArmed(gob) || A.shadeUnseen()) return 'second hit still shaded';
      // Stillwatch still exists.
      if (!(g.EXT && (g.EXT.still || g.player.still))) return 'stillwatch missing';
      // Boss cannot be locked by repeated Shade hits.
      const boss = { name: 'Cinder Warden', alive: true, hp: 400, maxHp: 400, maxHit: 40, att: 40, level: 150, state: 'idle', boss: true, _poise: 0,
        mesh: { position: { x: (p ? p.x : 0) + 1.4, y: 0, z: p ? p.z : 0 }, rotation: { y: Math.PI } } };
      list.push(boss);
      let locked = 0;
      for (let i = 0; i < 6; i++) {
        A.shadeEnter('test-boss');
        for (const f of (g.EXT.extSwing || [])) { try { f(boss, [{ dmg: 0 }]); } catch (e) { /* other */ } }
        for (const f of (g.EXT.extHit || [])) { try { f(boss, 20, 0, false); } catch (e) { /* other */ } }
        if (boss.stunUntil && A.tick && boss.stunUntil - A.tick() > 20) locked++;
      }
      list.splice(list.indexOf(boss), 1);
      if (locked) return 'boss locked';
    } finally {
      const i = list.indexOf(gob); if (i >= 0) list.splice(i, 1);
    }
    return true;
  };
}
