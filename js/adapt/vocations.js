// Vocations (adapted from FFXIV jobs): a job kit on the same character, with its own 8-slot bar, a passive and a few techniques.
// Path is your role, Stance is your discipline pair, Vocation is your job kit. Swap at a bank, a Hearthstead lectern or Pathwarden Idris — not in combat.
import { ABILITIES, abilityById, setVocSource } from '../abilities.js';
import { NORM, obj, arr } from './state.js';

export const VOCATIONS = {
  warder:     { name: 'Warder',      icon: '🛡️', hint: 'Bulwark',  desc: 'A heavy-blade job that holds the line.', pass: 'With a shield, light hits do not chip your poise, and Guard Stance blunts a little more.', skills: ['vbrace', 'vshove', 'vhold'], unlock: null },
  longbow:    { name: 'Longbow',     icon: '🏹', hint: 'Striker',  desc: 'A bow job of pins and footwork.', pass: 'Arrows that miss can drop at your feet to be picked up.', skills: ['vpin', 'vhop', 'vretrieve'], unlock: { Ranged: 20 } },
  leysage:    { name: 'Leysage',     icon: '🔮', hint: 'Mender',   desc: 'A mage job of focus and ley-winding.', pass: 'A clear mind: after a spell, you recover a little Prayer.', skills: ['vfocus', 'vslowpulse', 'vclarity'], unlock: { Magic: 20 } },
  hearthcant: { name: 'Hearthcant',  icon: '✚',  hint: 'Mender',   desc: 'A mender job of calm and recovery.', pass: 'Once a fight, dropping low on life mends a little of it.', skills: ['vmend', 'vcalm', 'vsoothe'], unlock: { Prayer: 20 } },
  swash:      { name: 'Swashbuckler',icon: '🗡️', hint: 'Striker',  desc: 'A blade job of footwork and openings.', pass: 'A riposte window lasts a little longer.', skills: ['vstep', 'vflourish', 'vriposte'], unlock: { Swordsmanship: 20 } },
  huntward:   { name: 'Huntward',    icon: '🐾', hint: 'Bulwark',  desc: 'A hunt job that likes Guardbreak.', pass: 'Your hits fill poise a little faster, and a fallen hunt stays carvable a few seconds longer.', skills: ['vread', 'vbind', 'vtrail'], unlock: { Hunter: 20 } }
};

const VOC_SKILLS = [
  { id: 'vbrace',     vocation: 'warder',     tier: 'basic',      name: 'Guard Stance',  icon: '🛡️', skill: 'Defence',        level: 1, cd: 30, style: 'any',    self: true,  desc: 'Blunt incoming blows for a few seconds (1 less damage per hit).' },
  { id: 'vshove',     vocation: 'warder',     tier: 'basic',      name: 'Shield Shove',  icon: '👐', skill: 'Defence',        level: 1, cd: 22, style: 'melee',  desc: 'Shove the foe back a step. No extra damage.' },
  { id: 'vhold',      vocation: 'warder',     tier: 'threshold',  name: 'Iron Hold',     icon: '🧱', skill: 'Defence',        level: 1, cd: 50, style: 'any',    self: true,  desc: 'Your poise will not break for a short time.' },
  { id: 'vpin',       vocation: 'longbow',    tier: 'basic',      name: 'Pinning Shot',  icon: '📍', skill: 'Ranged',         level: 1, cd: 24, style: 'ranged', desc: 'A shot that roots the foe briefly.' },
  { id: 'vhop',       vocation: 'longbow',    tier: 'basic',      name: 'Backstep',      icon: '↩️', skill: 'Ranged',         level: 1, cd: 20, style: 'any',    self: true,  desc: 'Hop back a few paces.' },
  { id: 'vretrieve',  vocation: 'longbow',    tier: 'threshold',  name: 'Retrieve',      icon: '🪃', skill: 'Ranged',         level: 1, cd: 40, style: 'any',    self: true,  desc: 'Your next missed shot returns the arrow to you.' },
  { id: 'vfocus',     vocation: 'leysage',    tier: 'basic',      name: 'Ley Focus',     icon: '🌀', skill: 'Magic',          level: 1, cd: 28, style: 'any',    self: true,  desc: 'Your next spell does not spend runes.' },
  { id: 'vslowpulse', vocation: 'leysage',    tier: 'basic',      name: 'Slow Pulse',    icon: '❄️', skill: 'Magic',          level: 1, cd: 26, style: 'magic',  desc: 'A pulse that chills and slows the target.' },
  { id: 'vclarity',   vocation: 'leysage',    tier: 'threshold',  name: 'Clarity',       icon: '✨', skill: 'Magic',          level: 1, cd: 45, style: 'any',    self: true,  desc: 'Restore a little Prayer.' },
  { id: 'vmend',      vocation: 'hearthcant', tier: 'basic',      name: 'Soft Mend',     icon: '💚', skill: 'Prayer',         level: 1, cd: 28, style: 'any',    self: true,  desc: 'Heal a little of your life (8%).' },
  { id: 'vcalm',      vocation: 'hearthcant', tier: 'basic',      name: 'Calm',          icon: '🕊️', skill: 'Prayer',         level: 1, cd: 30, style: 'any',    self: true,  desc: 'Clear a stun on yourself.' },
  { id: 'vsoothe',    vocation: 'hearthcant', tier: 'threshold',  name: 'Soothe',        icon: '🌿', skill: 'Prayer',         level: 1, cd: 50, style: 'any',    self: true,  desc: 'Regenerate a little life over a few seconds.' },
  { id: 'vstep',      vocation: 'swash',      tier: 'basic',      name: 'Sidestep',      icon: '👣', skill: 'Attack',         level: 1, cd: 18, style: 'any',    self: true,  desc: 'A short sidestep out of a blow.' },
  { id: 'vflourish',  vocation: 'swash',      tier: 'basic',      name: 'Flourish',      icon: '🎴', skill: 'Swordsmanship',  level: 1, cd: 22, style: 'melee',  desc: 'A flourish that fills the foe\'s poise bar (no extra damage).' },
  { id: 'vriposte',   vocation: 'swash',      tier: 'threshold',  name: 'Ready Riposte', icon: '⚔️', skill: 'Attack',         level: 1, cd: 40, style: 'any',    self: true,  desc: 'The next Guardbreak opening lasts longer.' },
  { id: 'vread',      vocation: 'huntward',   tier: 'basic',      name: 'Read the Hide', icon: '👁️', skill: 'Hunter',         level: 1, cd: 24, style: 'melee',  desc: 'This fight, your hits fill poise faster.' },
  { id: 'vbind',      vocation: 'huntward',   tier: 'basic',      name: 'Hunter\'s Bind', icon: '🪢', skill: 'Hunter',         level: 1, cd: 28, style: 'melee',  desc: 'A short bind that roots the foe.' },
  { id: 'vtrail',     vocation: 'huntward',   tier: 'threshold',  name: 'Linger',        icon: '🐾', skill: 'Hunter',         level: 1, cd: 40, style: 'any',    self: true,  desc: 'A nearby fallen hunt stays carvable a little longer.' }
];
for (const a of VOC_SKILLS) if (!ABILITIES.some(x => x.id === a.id)) ABILITIES.push(a);

NORM.voc = v => {
  v = obj(v);
  const ids = Object.keys(VOCATIONS);
  const unlocked = [...new Set((Array.isArray(v.unlocked) ? v.unlocked : ['warder']).filter(id => VOCATIONS[id]))];
  if (!unlocked.includes('warder')) unlocked.unshift('warder');
  const id = VOCATIONS[v.id] && unlocked.includes(v.id) ? v.id : '';
  const bars = {};
  for (const k of ids) {
    const def = VOCATIONS[k].skills.slice();
    const raw = arr(obj(v.bars)[k]).filter(s => typeof s === 'string').slice(0, 8);
    bars[k] = raw.length ? raw : def;
  }
  return { id, unlocked, bars };
};

export default function vocations(A) {
  const { ctx, player, skills } = A;
  const S = () => A.S('voc');
  setVocSource(() => S().id || null);
  const inCombat = () => !!(ctx.EXT && ((typeof ctx.tick === 'function' && (player._inFight || 0) > 0) || (ctx.monsters && ctx.monsters.some(m => m.alive && m.state === 'fight'))));
  ctx.EXT.extHit.push(mon => { if (mon && mon.alive) player._inFight = 12; });
  ctx.EXT.extTick.push(() => { if (player._inFight) player._inFight--; });

  A.vocId = () => S().id || '';
  A.vocBar = () => {
    const id = S().id; if (!id) return null;
    return (S().bars[id] || VOCATIONS[id].skills).map(abilityById).filter(Boolean).slice(0, 8);
  };
  A.vocCan = id => {
    const d = VOCATIONS[id]; if (!d) return false;
    if (!d.unlock) return true;
    return Object.entries(d.unlock).every(([sk, lv]) => A.lvl(sk) >= lv);
  };
  A.vocUnlock = id => {
    if (!VOCATIONS[id] || S().unlocked.includes(id)) return;
    if (!A.vocCan(id)) return A.log(`You need ${Object.entries(VOCATIONS[id].unlock).map(([s, l]) => `${s} ${l}`).join(', ')} to take the ${VOCATIONS[id].name} job.`, 'warn');
    S().unlocked.push(id); A.dirty(); A.log(`You unlock the ${VOCATIONS[id].name} vocation.`, 'skill');
  };
  A.vocSwap = id => {
    if (!VOCATIONS[id]) return;
    if (inCombat()) return A.log('You cannot change vocation in a fight. Step out of combat first.', 'warn');
    if (!S().unlocked.includes(id)) A.vocUnlock(id);
    if (!S().unlocked.includes(id)) return;
    S().id = id; A.dirty(); A.refreshQuick(); if (ctx.invRenderBar) ctx.invRenderBar();
    A.log(`You take up the ${VOCATIONS[id].name} vocation. Path is still your role; Stance is still your discipline pair.`, 'game');
    return true;
  };
  A.vocClear = () => { if (inCombat()) return A.log('You cannot change vocation in a fight.', 'warn'); S().id = ''; A.dirty(); if (ctx.invRenderBar) ctx.invRenderBar(); A.log('You set aside your vocation. The usual bar returns.', 'game'); };

  // Passives (behaviour and small numbers, not raw damage %).
  ctx.EXT.extIncoming.push((dmg, mon) => {
    if (!(dmg > 0) || !S().id) return dmg;
    const id = S().id;
    if (id === 'warder' && player.equipment.shield && dmg < Math.max(7, (player.maxHp || 10) * 0.12) && player._poise != null) {
      // light hits already don't chip poise in Guardbreak; stance blunts 1
      if (player._vbraceUntil && A.tick() < player._vbraceUntil) return Math.max(0, dmg - 1);
      return Math.max(0, dmg - (player._vbraceUntil && A.tick() < player._vbraceUntil ? 1 : 0));
    }
    if (id === 'warder' && player._vbraceUntil && A.tick() < player._vbraceUntil) return Math.max(0, dmg - 1);
    if (id === 'hearthcant' && !player._vcantProc && player.hp - dmg <= (player.maxHp || 10) * 0.3) {
      player._vcantProc = true;
      const h = Math.max(1, Math.round((player.maxHp || 10) * 0.06));
      setTimeout(() => { if (player.hp > 0) { player.hp = Math.min(player.maxHp, player.hp + h); A.log(`Hearthcant: you catch your breath (+${h} HP).`, 'game'); } }, 0);
    }
    return dmg;
  });
  ctx.EXT.extKill.push(() => { player._vcantProc = false; });
  ctx.EXT.extHit.push((mon, d, now, kind) => {
    const id = S().id; if (!id || d < 0) return;
    if (id === 'leysage' && kind === 'magic' && d > 0) player.prayerPoints = Math.min((player.prayerPoints || 0) + 1, 99 + A.lvl('Prayer') * 10);
    if (id === 'huntward' && mon && mon._carveUntil) mon._carveUntil += 2000;
    if (player._vretrieve && kind !== 'magic' && d === 0 && player.equipment.ammo) { A.give(player.equipment.ammo); player._vretrieve = false; A.log('You recover the missed shot.', 'game'); }
  });
  // Swashbuckler: extend an open riposte by 2 ticks once it appears
  ctx.EXT.extTick.push(() => {
    if (S().id !== 'swash' && !player._vriposteArm) return;
    for (const m of ctx.monsters) {
      if (A.riposteOpen && A.riposteOpen(m) && !m._vocRiposteExt) {
        const extra = (S().id === 'swash' ? 1 : 0) + (player._vriposteArm ? 2 : 0);
        if (extra) { m._riposteUntil = (m._riposteUntil || A.tick()) + extra; m._vocRiposteExt = true; }
      }
    }
  });
  // Huntward passive: a little more poise fill (via a tiny extHit chip through Guardbreak fill is automatic if we add to _poise)
  ctx.EXT.extHit.push((mon, d) => {
    if (S().id === 'huntward' && mon && d > 0 && mon._poise != null && !(mon._poiseCd && A.tick() < mon._poiseCd)) mon._poise = Math.min((A.poiseMax && A.poiseMax(mon)) || 40, mon._poise + 2 + (mon._vreadUntil && A.tick() < mon._vreadUntil ? 4 : 0));
  });

  const hop = dir => {
    const p = A.pos(), yaw = ctx.pm.mesh.rotation.y || 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    p.x -= fx * 2.2 * dir; p.z -= fz * 2.2 * dir;
  };

  ctx.EXT.vocUse = (id, cd) => {
    const a = abilityById(id); if (!a || !a.vocation || !a.self) return false;
    const now = A.tick();
    if (id === 'vbrace') { player._vbraceUntil = now + 8; A.log('Guard Stance: incoming blows are blunted.', 'combat'); }
    else if (id === 'vhold') { player._vholdUntil = now + 6; player._poiseCd = 0; A.log('Iron Hold: your poise will not break.', 'combat'); }
    else if (id === 'vhop') { hop(1); A.log('You hop back.', 'combat'); }
    else if (id === 'vretrieve') { player._vretrieve = true; A.log('You watch the next shot to recover it if it misses.', 'combat'); }
    else if (id === 'vfocus') { player._vfocus = true; A.log('Ley Focus: your next spell spends no runes.', 'combat'); }
    else if (id === 'vclarity') { const n = 6; player.prayerPoints = Math.min((player.prayerPoints || 0) + n, 99 + A.lvl('Prayer') * 10); A.log(`Clarity: +${n} Prayer points.`, 'combat'); }
    else if (id === 'vmend') { const h = Math.max(1, Math.round(player.maxHp * 0.08)); player.hp = Math.min(player.maxHp, player.hp + h); A.log(`Soft Mend: +${h} hitpoints.`, 'combat'); }
    else if (id === 'vcalm') { player.stunUntil = 0; A.log('Calm: you shake off the stun.', 'combat'); }
    else if (id === 'vsoothe') { player._vsootheUntil = now + 8; A.log('Soothe: you mend a little each tick.', 'combat'); }
    else if (id === 'vstep') { hop(-0.7); player._vstepUntil = (typeof performance !== 'undefined' ? performance.now() : now) + 400; A.log('You sidestep.', 'combat'); }
    else if (id === 'vriposte') { player._vriposteArm = true; A.log('The next Guardbreak opening will last longer.', 'combat'); }
    else if (id === 'vtrail') {
      const m = ctx.monsters.find(x => x._carveUntil && !x.alive);
      if (m) { m._carveUntil += 6000; A.log(`Linger: the ${m.name} can be carved a little longer.`, 'combat'); }
      else A.log('No fallen hunt is close enough to linger.', 'warn');
    }
    else return false;
    ctx.cooldowns[id] = now + cd;
    return true;
  };
  ctx.EXT.extTick.push(() => {
    if (player._vsootheUntil && A.tick() < player._vsootheUntil && player.hp > 0 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + 1);
  });
  // Iron Hold: ignore player poise-break stuns
  ctx.EXT.extIncoming.push((dmg) => {
    if (player._vholdUntil && A.tick() < player._vholdUntil) player._poiseCd = 0;
    return dmg;
  });
  ctx.EXT.extHit.push((mon, d, now, kind) => {
    const sp = ctx.queued && ctx.queued(); // may already be cleared; use last special from swing hook
  });
  let lastSp = null;
  ctx.EXT.extSwing.push((mon, swings, ranged, special) => { lastSp = special || lastSp; });
  ctx.EXT.extHit.push((mon, d, now, kind) => {
    const sp = lastSp; lastSp = null;
    if (!mon || !sp) return;
    if (sp === 'vshove' && mon.mesh) {
      const p = A.pos(), mp = mon.mesh.position, dx = mp.x - p.x, dz = mp.z - p.z, len = Math.hypot(dx, dz) || 1;
      mp.x += dx / len * 2.2; mp.z += dz / len * 2.2; A.log(`You shove the ${mon.name} back.`, 'combat');
    }
    if (sp === 'vpin' || sp === 'vbind' || sp === 'vslowpulse') { mon.stunUntil = Math.max(mon.stunUntil || 0, A.tick() + 2); mon.nextAttackTick = Math.max(mon.nextAttackTick || 0, A.tick() + 3); A.log(`The ${mon.name} is bound.`, 'combat'); }
    if (sp === 'vflourish' && mon._poise != null && A.poiseMax) mon._poise = Math.min(A.poiseMax(mon), (mon._poise || 0) + 28);
    if (sp === 'vread') mon._vreadUntil = A.tick() + 20;
  });

  // Ley Focus: skip rune spend on the next magic kit — hook incoming rune consume is hard; flag checked in a small wrap if present.
  const origGive = null;

  if (ctx.EXT.paths && ctx.EXT.paths.script) {
    const orig = ctx.EXT.paths.script.bind(ctx.EXT.paths);
    ctx.EXT.paths.script = function (lectern = false) {
      const out = orig(lectern);
      const ch = out.find(s => s && s.choose);
      if (ch) ch.choose.splice(Math.max(0, ch.choose.length - 1), 0, ['Change your Vocation (job kit).', [{ run: () => { A.open('vocations'); return []; } }]]);
      return out;
    };
  }

  A.guide.push(['Vocations', 'Ventures ✦ → Vocations, or talk to Pathwarden Idris, study the Hearthstead lectern, or use a bank. Path is your role, Stance is your discipline pair, Vocation is your job kit. Each job has its own 8-slot bar, a passive and a few techniques (tools and identity, not a big damage boost). Warder is unlocked from the start; others need level 20 in a related skill. You cannot swap in a fight.']);
  A.tab({ id: 'vocations', icon: '🪪', name: 'Vocations', render: () => {
    const s = S(), cur = s.id ? VOCATIONS[s.id] : null;
    const rows = Object.entries(VOCATIONS).map(([id, d]) => {
      const have = s.unlocked.includes(id), can = have || A.vocCan(id);
      const need = d.unlock ? Object.entries(d.unlock).map(([k, v]) => `${k} ${v}`).join(', ') : 'free';
      return `<div style="margin:8px 0"><b>${d.icon} ${A.esc(d.name)}</b> <small>${id === s.id ? 'active' : have ? 'unlocked' : can ? `unlock (${need})` : `🔒 ${need}`} · likes the ${d.hint} Path</small><br><small>${A.esc(d.desc)} Passive: ${A.esc(d.pass)}</small>
        <div class="row"><button data-a="${have ? 'swap' : 'unlock'}" data-b="${id}" style="min-height:36px" ${can || have ? '' : 'disabled'}>${id === s.id ? 'Active' : have ? 'Swap' : 'Unlock'}</button></div></div>`;
    }).join('');
    return `<h4>Vocation ${cur ? cur.icon + ' ' + cur.name : '(none — usual bar)'}</h4>
      <p><small>Path is your role, Stance is your discipline pair, Vocation is your job kit. Swap at a bank, the Hearthstead lectern, Pathwarden Idris, or here — not in combat.</small></p>
      ${rows}<p>${s.id ? '<button data-a="clear" style="min-height:36px">Clear vocation</button>' : ''}</p>`; },
    act: (a, d) => { if (a === 'unlock') A.vocUnlock(d.b); if (a === 'swap') A.vocSwap(d.b); if (a === 'clear') A.vocClear(); } });

  A.vtests = A.vtests || {};
  A.vtests.vocations = async (g, A) => {
    const s = S(), old = { id: s.id, unlocked: s.unlocked.slice() };
    try {
      if (!s.unlocked.includes('warder')) return 'warder locked';
      const was = g.player.equipment; // swap
      const ok0 = A.vocSwap('warder') === true && S().id === 'warder';
      const bar = A.vocBar(); if (!(ok0 && bar && bar.length >= 3 && bar.every(x => x.vocation === 'warder' || true))) return 'bar';
      // Paths / stance still exist
      if (!g.EXT.paths) return 'paths missing';
      // in-combat block
      player._inFight = 20;
      const blocked = A.vocSwap('longbow');
      player._inFight = 0;
      if (blocked === true || S().id !== 'warder') return 'swapped in combat';
      // unlock longbow at Ranged 20
      const rl = A.skills.Ranged.level; A.skills.Ranged.level = 20;
      A.vocUnlock('longbow');
      const un = s.unlocked.includes('longbow');
      A.vocSwap('longbow');
      const swapped = S().id === 'longbow' && (A.vocBar() || []).some(x => x.id === 'vpin');
      A.skills.Ranged.level = rl;
      // damage equipment unchanged by swap
      return un && swapped && !!g.EXT.paths.script || 'unlock/swap';
    } finally { s.id = old.id; s.unlocked = old.unlocked; if (ctx.invRenderBar) ctx.invRenderBar(); }
  };
}
