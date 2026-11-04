// Elemental Attunements (adapted from Destiny 2 subclasses): pick Ember, Rime, Storm or Void for a super (key N), a class move, and 2 of 3 fragments.
import { NORM, obj, str, arr } from './state.js';
export const ELEM = {
  ember: { name: 'Ember', icon: '🔥', super: 'Pyre Bloom', move: 'Kindled blows: +5% damage', frags: { kindling: ['Kindling', 'kills heal 2% health'], searing: ['Searing', '+6% damage to bosses'], blaze: ['Blaze', 'Pyre Bloom hits 2 more times'] }, gear: /ember|cinder|flame|fire/i },
  rime: { name: 'Rime', icon: '❄️', super: 'Winter Seal', move: 'Frost skin: 5% less damage taken', frags: { frostbite: ['Frostbite', '10% of hits freeze a non-boss foe'], glacial: ['Glacial', '4% more damage reduction'], shatter: ['Shatter', '+15% damage to frozen foes'] }, gear: /rime|frost|glacier|ice/i },
  storm: { name: 'Storm', icon: '⚡', super: 'Thunderline', move: 'Static hands: +5% accuracy', frags: { arc: ['Arc chain', '15% of hits arc to a nearby foe'], static: ['Static', '+5% more accuracy'], surge: ['Surge', 'Thunderline chains to 3 more foes'] }, gear: /storm|thunder|gale|sky/i },
  void: { name: 'Void', icon: '🌑', super: 'Hollow Well', move: 'Void hunger: +4% combat XP', frags: { orb: ['Void orb', 'kills add 5% Overflare'], hollow: ['Hollow', '+6% more combat XP'], well: ['Deep well', 'Hollow Well heals 25% instead of 12%'] }, gear: /void|null|eclipse|shadow/i }
};
NORM.attune = v => { v = obj(v); const el = str(v.el, Object.keys(ELEM)); return { el, frags: el ? arr(v.frags).filter(f => ELEM[el].frags[f]).slice(0, 2) : [], supers: Math.floor(+v.supers || 0) }; };
export default function attune(A) {
  const { ctx, player } = A, S = () => A.S('attune'), E = () => S().el && ELEM[S().el], has = f => S().frags.includes(f);
  let ready = 0; const CD = 90000;
  const gearMatch = () => { const e = E(); return e && Object.values(player.equipment).some(n => n && e.gear.test(n)); };
  A.mods.dmg.push(m => { const e = S().el; if (!e) return 0; let t = gearMatch() ? 0.05 : 0; if (e === 'ember') t += 0.05 + (has('searing') && A.isBossy(m) ? 0.06 : 0); if (e === 'rime' && has('shatter') && m && m.stunUntil > A.tick()) t += 0.15; return t; });
  A.mods.dr.push(() => (S().el === 'rime' ? 0.05 + (has('glacial') ? 0.04 : 0) : 0));
  A.mods.acc.push(() => (S().el === 'storm' ? 0.05 + (has('static') ? 0.05 : 0) : 0));
  A.mods.xp.push(() => (S().el === 'void' ? 0.04 + (has('hollow') ? 0.06 : 0) : 0));
  let arcing = false;
  ctx.EXT.extHit.push((m, d, now, kind) => { if (d <= 0 || arcing) return; const e = S().el;
    if (e === 'rime' && has('frostbite') && !A.isBossy(m) && Math.random() < 0.1) m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + 2);
    if (e === 'storm' && has('arc') && Math.random() < 0.15) { const p = m.mesh.position, o = A.monsNear(p.x, p.z, 6, 3).find(x => x !== m); if (o) { arcing = true; try { ctx.strike(o, { dmg: -0.3 }, now, { quiet: true }); } finally { arcing = false; } } } });
  ctx.EXT.extKill.push(() => { const e = S().el; if (e === 'ember' && has('kindling') && player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * 0.02)); if (e === 'void' && has('orb') && A.flareAdd) A.flareAdd(5); if (e) ready -= 3000; });
  A.superUse = () => { const e = E(); if (!e) return A.log('Choose an attunement first (Ventures ✦ → Attune).', 'warn'); if (Date.now() < ready) return A.log(`${e.super} recharging (${Math.ceil((ready - Date.now()) / 1000)}s).`, 'game');
    const p = A.pos(), t = ctx.target(), foes = A.monsNear(p.x, p.z, 7, 6); if (t && t.alive && !foes.includes(t)) foes.unshift(t); if (!foes.length && S().el !== 'void') return A.log('No foes close enough.', 'warn');
    ready = Date.now() + CD; S().supers++; A.log(`${e.icon} ${e.super}!`, 'combat'); const now = performance.now();
    if (S().el === 'ember') { const n = has('blaze') ? 5 : 3; for (let h = 0; h < n; h++) setTimeout(() => { for (const m of foes) if (m.alive) ctx.strike(m, { dmg: 0.3, acc: 0.3 }, performance.now(), { quiet: true }); }, h * 200); }
    if (S().el === 'rime') for (const m of foes) { if (!A.isBossy(m)) m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + 5); ctx.strike(m, { dmg: 0.5, acc: 0.4 }, now, { quiet: true }); }
    if (S().el === 'storm') { const more = has('surge') ? A.monsNear(p.x, p.z, 12, 9).filter(m => !foes.includes(m)).slice(0, 3) : []; for (const m of [...foes, ...more]) ctx.strike(m, { dmg: 0.6, acc: 0.5 }, now, { quiet: true }); }
    if (S().el === 'void') { for (const m of foes) ctx.strike(m, { dmg: 0.4, acc: 0.4 }, now, { quiet: true }); player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * (has('well') ? 0.25 : 0.12))); }
    if (ctx.gfxQ() !== 'low') ctx.burst('hit', p.x, p.y + 1, p.z, 18); A.dirty(); return true; };
  A.key('attune', A.superUse); A.onQuick('super', A.superUse);
  A.quick(() => (E() && Date.now() >= ready && A.monsNear(A.pos().x, A.pos().z, 7, 1).length ? [['super', `${E().icon}Super`, `${E().super} (N)`]] : null));
  A.attuneSet = el => { if (!ELEM[el]) return; if (A.monsNear(A.pos().x, A.pos().z, 10, 1).some(m => m.state === 'fight')) return A.log('Not in the middle of a fight.', 'warn'); S().el = el; S().frags = Object.keys(ELEM[el].frags).slice(0, 2); A.dirty(); };
  A.fragToggle = f => { const s = S(); if (!s.el || !ELEM[s.el].frags[f]) return; if (s.frags.includes(f)) s.frags = s.frags.filter(x => x !== f); else if (s.frags.length < 2) s.frags.push(f); else A.log('Two fragments at a time. Remove one first.', 'warn'); A.dirty(); };
  A.guide.push(['Elemental Attunements', 'Ventures ✦ → Attune. Pick Ember, Rime, Storm or Void: a super on N (or the Super button near foes, 90 s cooldown, kills shorten it), a passive class move, and 2 of 3 fragments. Matching gear (Emberfang, Nulledge and similar) adds +5% damage.']);
  A.tab({ id: 'attune', icon: '🌗', name: 'Attune', render: () => { const s = S();
    return `<div class="row" style="gap:4px;flex-wrap:wrap">${Object.entries(ELEM).map(([k, e]) => `<button data-a="el" data-e="${k}" class="${s.el === k ? 'on' : ''}" style="min-height:40px">${e.icon} ${e.name}</button>`).join('')}</div>` +
      (s.el ? (() => { const e = ELEM[s.el]; return `<h4>${e.icon} ${e.name}</h4><p>Super: <b>${e.super}</b> (N) ${Date.now() < ready ? `— ${Math.ceil((ready - Date.now()) / 1000)}s` : '— ready'}<br>Class move: ${e.move}${gearMatch() ? '<br>Matching gear: +5% damage' : ''}</p><p><small>Fragments (pick 2):</small></p>${Object.entries(e.frags).map(([f, [n, d]]) => `<div class="row" style="align-items:center;gap:6px"><span style="flex:1;font-size:13px"><b>${n}</b> <small>${d}</small></span><button data-a="fr" data-f="${f}" style="min-height:38px">${s.frags.includes(f) ? '✔ On' : 'Off'}</button></div>`).join('')}<p><small>Supers used: ${s.supers}</small></p>`; })() : '<p>Choose an element.</p>'); },
    act: (a, d) => { if (a === 'el') A.attuneSet(d.e); if (a === 'fr') A.fragToggle(d.f); } });
  A.vtests = A.vtests || {};
  A.vtests.attune = async (g, A) => { A.attuneSet('void'); const hp = g.player.hp; g.player.hp = Math.max(1, Math.floor(g.player.maxHp / 2)); const h0 = g.player.hp; const ok = A.superUse(); const healed = g.player.hp > h0; g.player.hp = hp; return !!ok && healed && A.totals().dr >= 0; };
}
