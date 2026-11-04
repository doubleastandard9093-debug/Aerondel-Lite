// Ascent Rolls (adapted from Destiny 2's weapon perks and crafting patterns): ordinary weapons roll 2 perks per weapon name.
// Dismantle 5 copies of a weapon to learn its pattern, then choose its perks exactly. Uniques are never touched.
import { ITEMS } from '../items.js';
import { NORM, obj, arr } from './state.js';
export const PERKS = {
  honed: ['Honed', 'dmg', 0.03, '+3% damage'], steady: ['Steady', 'acc', 0.04, '+4% accuracy'], warded: ['Warded', 'dr', 0.03, '3% less damage taken'],
  hunter: ['Bosshunter', 'boss', 0.05, '+5% damage to bosses'], scholar: ['Studious', 'xp', 0.04, '+4% combat XP'], kindled: ['Kindled', 'flare', 0.1, '+10% Overflare gain'],
  brutal: ['Brutal', 'stag', 0.15, '+15% stagger']
};
const K = Object.keys(PERKS);
NORM.ascent = v => { v = obj(v); const rolls = {}, dis = {}, pat = [];
  for (const [n, l] of Object.entries(obj(v.rolls))) { const p = arr(l).filter(k => PERKS[k]).slice(0, 2); if (p.length) rolls[n] = p; }
  for (const [n, c] of Object.entries(obj(v.dis))) dis[n] = Math.max(0, Math.min(99, Math.floor(+c || 0)));
  for (const n of arr(v.pat)) if (typeof n === 'string') pat.push(n); return { rolls, dis, pat }; };
export default function ascent(A) {
  const { ctx, player } = A, S = () => A.S('ascent');
  const ok = n => { const i = ITEMS[n]; return !!(i && (i.type === 'weapon' || i.slot === 'weapon') && !i.unique && !i.rarity); };
  const roll = () => { const a = K[Math.floor(Math.random() * K.length)]; let b; do b = K[Math.floor(Math.random() * K.length)]; while (b === a); return [a, b]; };
  A.ascentOf = n => S().rolls[n] || [];
  const cur = (stat) => { const w = player.equipment.weapon; return w ? A.ascentOf(w).filter(k => PERKS[k][1] === stat).reduce((t, k) => t + PERKS[k][2], 0) : 0; };
  A.mods.dmg.push(m => cur('dmg') + (A.isBossy(m) ? cur('boss') : 0)); A.mods.acc.push(() => cur('acc')); A.mods.dr.push(() => cur('dr')); A.mods.xp.push(() => cur('xp'));
  if (A.flareGain) A.flareGain.push(() => cur('flare')); if (A.stagMul) A.stagMul.push(() => cur('stag'));
  A.ascentScan = () => { for (const n of [...Object.keys(player.inventory), player.equipment.weapon]) if (n && ok(n) && !S().rolls[n]) { S().rolls[n] = roll(); A.log(`Your ${n} rolls Ascent perks: ${S().rolls[n].map(k => PERKS[k][0]).join(' + ')}.`, 'loot'); A.dirty(); } };
  A.every(10, A.ascentScan);
  const cost = n => Math.max(200, Math.round((ITEMS[n].value || 50) * 2));
  A.ascentReroll = n => { if (!ok(n)) return; const c = cost(n); if (player.gold < c) return A.log(`Rerolling costs ${A.fmt(c)} coins.`, 'warn'); player.gold -= c; S().rolls[n] = roll(); A.log(`Rerolled: ${S().rolls[n].map(k => PERKS[k][0]).join(' + ')}.`, 'skill'); A.dirty(); };
  A.ascentDismantle = n => { if (!ok(n) || player.equipment.weapon === n && !A.count(n)) return A.log('Dismantle a spare copy from your pack (not the one you wield).', 'warn'); if (!A.take(n)) return;
    const d = S().dis; d[n] = (d[n] || 0) + 1; ctx.giveXP('Smithing', 20 + (ITEMS[n].value || 0) / 20); if (d[n] >= 5 && !S().pat.includes(n)) { S().pat.push(n); A.log(`Pattern learned: ${n}. You can now pick its perks exactly.`, 'skill'); } else A.log(`Dismantled ${n} (${Math.min(5, d[n])}/5 toward its pattern).`, 'game'); A.dirty(); };
  A.ascentSet = (n, i, k) => { if (!S().pat.includes(n) || !PERKS[k]) return; const r = S().rolls[n] || roll(); r[i] = k; if (r[0] === r[1]) r[1 - i] = K.find(x => x !== k); S().rolls[n] = r; A.dirty(); };
  let sel = null;
  A.guide.push(['Ascent Rolls', 'Ordinary weapons roll 2 perks (Ventures ✦ → Ascent). Reroll for coins, or dismantle 5 spare copies to learn the pattern and choose perks exactly. Uniques are unaffected.']);
  A.tab({ id: 'ascent', icon: '🎲', name: 'Ascent', render: () => { const list = [...new Set([player.equipment.weapon, ...Object.keys(player.inventory)].filter(n => n && ok(n)))]; if (!sel || !list.includes(sel)) sel = list[0] || null;
    if (!sel) return '<p>No ordinary weapon in your pack or hands. (Uniques never roll.)</p>';
    const r = A.ascentOf(sel), pat = S().pat.includes(sel);
    return `<div class="row" style="gap:4px;flex-wrap:wrap">${list.map(n => `<button data-a="sel" data-n="${A.esc(n)}" class="${n === sel ? 'on' : ''}">${A.esc(n)}</button>`).join('')}</div><h4>${A.esc(sel)}</h4>
      ${r.map((k, i) => `<p>${PERKS[k][0]}: <small>${PERKS[k][3]}</small>${pat ? `<br>${K.map(x => `<button data-a="set" data-n="${A.esc(sel)}" data-i="${i}" data-k="${x}" class="${x === k ? 'on' : ''}" style="font-size:11px">${PERKS[x][0]}</button>`).join(' ')}` : ''}</p>`).join('') || '<p class="muted">Not rolled yet.</p>'}
      <div class="row" style="gap:4px"><button data-a="re" data-n="${A.esc(sel)}">🎲 Reroll (${A.fmt(cost(sel))})</button><button data-a="dis" data-n="${A.esc(sel)}">♻️ Dismantle a copy (${Math.min(5, S().dis[sel] || 0)}/5)</button></div><p><small>${pat ? 'Pattern known: tap perks to choose them.' : 'Dismantle 5 spare copies to learn the pattern.'}</small></p>`; },
    act: (a, d) => { if (a === 'sel') sel = d.n; if (a === 're') A.ascentReroll(d.n); if (a === 'dis') A.ascentDismantle(d.n); if (a === 'set') A.ascentSet(d.n, +d.i, d.k); } });
  A.vtests = A.vtests || {};
  A.vtests.ascent = async (g, A) => { const n = Object.keys(ITEMS).find(ok); g.player.inventory[n] = 5; A.ascentScan(); const rolled = A.ascentOf(n).length === 2; for (let i = 0; i < 5; i++) A.ascentDismantle(n); A.ascentSet(n, 0, 'honed');
    const uniq = Object.keys(ITEMS).find(x => ITEMS[x].unique && ITEMS[x].type === 'weapon'); g.player.inventory[uniq] = 1; A.ascentScan(); const ok2 = !A.S('ascent').rolls[uniq]; delete g.player.inventory[uniq]; return rolled && A.ascentOf(n)[0] === "honed" && ok2 || `r${rolled} u${ok2} n=${n} ${JSON.stringify(A.S("ascent")).slice(0,200)}`; };
}
