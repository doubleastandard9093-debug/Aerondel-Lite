// Twin Stance (adapted from PSO2's main/sub class): choose a main and a support combat discipline, swapped at any bank.
// Main: its skill perks +20%. Support: its perks +10% and, while fighting in your main style, +4% accuracy and +4% damage.
import { setPerkBoost } from '../skills.js';
import { NORM, obj, str } from './state.js';
const ST = ['Melee', 'Ranged', 'Magic', 'Swordsmanship'];
const SK = { Melee: ['Attack', 'Strength'], Ranged: ['Ranged'], Magic: ['Magic'], Swordsmanship: ['Swordsmanship'] };
NORM.stance = v => { v = obj(v); const main = str(v.main, ST), sub = str(v.sub, ST); return { main, sub: sub !== main ? sub : null }; };
export default function twinstance(A) {
  const { ctx, skills } = A, S = () => A.S('stance');
  let mine = null, base = null;
  const apply = () => { const cur = skills._boost; if (cur !== mine) base = cur; const b = { ...(base || {}) }, s = S();
    for (const k of SK[s.main] || []) b[k] = (b[k] || 0) + 0.2; for (const k of SK[s.sub] || []) b[k] = (b[k] || 0) + 0.1; mine = b; setPerkBoost(skills, b); };
  A.every(5, () => { if (skills._boost !== mine) apply(); });
  const on = () => { const s = S(); return s.main && s.sub && A.style() === s.main; };
  A.mods.acc.push(() => (on() ? 0.04 : 0)); A.mods.dmg.push(() => (on() ? 0.04 : 0));
  A.nearBank = () => { const p = A.pos(); return ctx.nodes.some(n => n && n.type === 'bank' && Math.hypot((n.x ?? n.mesh?.position.x) - p.x, (n.z ?? n.mesh?.position.z) - p.z) < 8); };
  A.setStance = (slot, st) => { if (!A.nearBank()) return A.log('You can only change stance beside a bank.', 'warn'); const s = S(); s[slot] = st; if (s.main === s.sub) s[slot === 'main' ? 'sub' : 'main'] = null; apply(); A.log(`Stance: ${s.main || '—'} with ${s.sub || '—'} support.`, 'skill'); A.dirty(); };
  A.guide.push(['Twin Stance', 'Ventures ✦ → Stance, beside any bank. Pick a main discipline (its perks +20%) and a support (its perks +10%). Fighting in your main style with a support set gives +4% accuracy and damage.']);
  A.tab({ id: 'stance', icon: '☯️', name: 'Stance', render: () => { const s = S(), bank = A.nearBank();
    const row = slot => `<div class="row" style="gap:4px;flex-wrap:wrap">${ST.map(x => `<button data-a="${slot}" data-s="${x}" class="${s[slot] === x ? 'on' : ''}" ${bank ? '' : 'disabled'} style="min-height:40px">${x}</button>`).join('')}</div>`;
    return `<h4>Main: ${s.main || '—'} · Support: ${s.sub || '—'}</h4>${bank ? '' : '<p class="muted"><small>Stand beside a bank to change stance.</small></p>'}<p><small>Main discipline perks +20%:</small></p>${row('main')}<p><small>Support discipline perks +10%, and +4% accuracy and damage while you fight in your main style:</small></p>${row('sub')}<p><small>Right now: ${on() ? 'active (+4% accuracy and damage)' : 'not active — use your main style'}.</small></p>`; },
    act: (a, d) => { if (a === 'main' || a === 'sub') A.setStance(a, d.s); } });
  A.vtests = A.vtests || {};
  A.vtests.stance = async (g, A) => { const b = g.EXT.adapt.ctx.nodes.find(n => n.type === 'bank'); if (!b) return 'no bank'; const p = A.pos(), o = [p.x, p.z]; p.x = b.x ?? b.mesh.position.x; p.z = (b.z ?? b.mesh.position.z) + 2;
    A.setStance('main', 'Magic'); A.setStance('sub', 'Ranged'); const ok = Math.abs((g.skills || A.skills)._boost.Magic - 0.2 - ((A.skills._boost.Magic || 0) - 0.2)) < 1 && A.skills._boost.Magic >= 0.2 && A.skills._boost.Ranged >= 0.1; p.x = o[0]; p.z = o[1]; return ok; };
}
