// Riven Grafts (adapted from The First Descendant's modules/PSO2 affixing): up to 4 grafts per weapon or armour piece, fused at Graftwright Oren.
import { NORM, obj, arr } from './state.js';
import { GRAFTS, GRAFT_VAL } from './loot.js';
import { ITEMS } from '../items.js';
const TIERS = Object.keys(GRAFT_VAL);
const parse = n => { const m = /^(Lesser|Greater|Exalted) (\w+) graft$/.exec(n || ''); if (!m) return null; const g = m[2][0].toUpperCase() + m[2].slice(1); return GRAFTS[g] ? { tier: m[1], g, stat: GRAFTS[g][0], v: GRAFT_VAL[m[1]] } : null; };
NORM.grafts = v => { v = obj(v); const on = {}; for (const [it, l] of Object.entries(obj(v.on))) { const ok = arr(l).filter(parse).slice(0, 4); if (ok.length) on[it] = ok; } return { on }; };
export default function grafts(A) {
  const { ctx, player } = A, G = () => A.S('grafts');
  const worn = () => Object.values(player.equipment).filter(Boolean);
  A.graftSum = stat => { let t = 0; for (const it of worn()) for (const n of G().on[it] || []) { const p = parse(n); if (p && p.stat === stat) t += p.v; } return t; };
  A.mods.dmg.push(() => A.graftSum('dmg')); A.mods.acc.push(() => A.graftSum('acc')); A.mods.dr.push(() => A.graftSum('dr'));
  if (A.flareGain) A.flareGain.push(() => A.graftSum('flare') * 4);
  let sel = null;
  A.graftOn = (item, g) => { if (!worn().includes(item)) return A.log('Wear the item first.', 'warn'); const l = G().on[item] || (G().on[item] = []); if (l.length >= 4) return A.log('That item has no free graft slots (4 max).', 'warn'); if (!parse(g) || !A.take(g)) return; l.push(g); A.log(`${g} grafted onto your ${item}.`, 'skill'); A.dirty(); return true; };
  A.graftOff = (item, i) => { const l = G().on[item]; if (!l || !l[i]) return; if (player.gold < 500) return A.log('Removing a graft costs 500 coins.', 'warn'); player.gold -= 500; A.give(l.splice(i, 1)[0]); if (!l.length) delete G().on[item]; A.dirty(); };
  A.graftFuse = g => { const p = parse(g); const ti = p ? TIERS.indexOf(p.tier) : -1; if (ti < 0 || ti >= 2) return A.log('Only Lesser and Greater grafts can be fused.', 'warn'); if (A.count(g) < 3) return A.log('Fusing takes 3 matching grafts.', 'warn');
    A.take(g, 3); const chance = 0.65 + Math.min(0.25, A.lvl('Smithing') / 400); if (Math.random() < chance) { const out = `${TIERS[ti + 1]} ${p.g.toLowerCase()} graft`; A.give(out); A.log(`Fusion holds: ${out}!`, 'loot'); } else { A.give(g); A.log('The fusion cracks. One graft survives.', 'warn'); } ctx.giveXP('Smithing', 80 * (ti + 1)); A.dirty(); };
  A.npc('graftwright', '⚙️', 'Graftwright Oren', 'Any blade or plate can take four grafts. Bring three alike and I\'ll try fusing them stronger.', 'grafts');
  A.guide.push(['Riven Grafts', 'Talk to Graftwright Oren in Larkhaven or use Ventures ✦ → Grafts. Each worn item takes 4 grafts (accuracy, damage, damage reduction, Overflare gain). Forge Lesser grafts at an anvil (Smithing 30), get them from bosses, and fuse 3 alike into the next tier (65–90% chance with Smithing).']);
  A.tab({ id: 'grafts', icon: '⚙️', name: 'Grafts', render: () => {
    const held = Object.keys(player.inventory).filter(parse);
    const items = worn().filter(it => ITEMS[it]).map(it => { const l = G().on[it] || [];
      return `<div style="margin:6px 0"><b style="font-size:13px">${A.esc(it)}</b> <small>${l.length}/4</small><div class="row" style="gap:4px;flex-wrap:wrap">${l.map((g, i) => `<button data-a="off" data-it="${A.esc(it)}" data-i="${i}" title="Remove (500 coins)">${GRAFTS[parse(g).g][1]} ${g.split(' ')[0]} ✕</button>`).join('')}${sel && l.length < 4 ? `<button data-a="on" data-it="${A.esc(it)}">＋ ${A.esc(sel)}</button>` : ''}</div></div>`; }).join('');
    return `<h4>Your grafts</h4><div class="row" style="gap:4px;flex-wrap:wrap">${held.length ? held.map(g => `<button data-a="sel" data-g="${A.esc(g)}" class="${g === sel ? 'on' : ''}">${GRAFTS[parse(g).g][1]} ${A.esc(g)} ×${player.inventory[g]}</button>`).join('') : '<small class="muted">None held.</small>'}</div>
      ${sel ? `<div class="row" style="margin:6px 0"><button data-a="fuse">🔥 Fuse 3 ${A.esc(sel)}</button></div>` : '<small>Tap a graft to socket or fuse it.</small>'}<h4>Worn gear</h4>${items || '<small class="muted">Wear something first.</small>'}<p><small>Now: +${Math.round(A.graftSum('dmg') * 100)}% damage, +${Math.round(A.graftSum('acc') * 100)}% accuracy, ${Math.round(A.graftSum('dr') * 100)}% less damage taken.</small></p>`; },
    act: (a, d) => { if (a === 'sel') sel = sel === d.g ? null : d.g; if (a === 'on' && sel) { A.graftOn(d.it, sel); if (!A.count(sel)) sel = null; } if (a === 'off') A.graftOff(d.it, +d.i); if (a === 'fuse' && sel) { A.graftFuse(sel); if (!A.count(sel)) sel = null; } } });
  A.vtests = A.vtests || {};
  A.vtests.grafts = async (g, A) => { const w = g.player.equipment.weapon || Object.values(g.player.equipment).find(Boolean); if (!w) return 'nothing worn'; g.player.inventory['Lesser brutal graft'] = 4; const d0 = A.graftSum('dmg'); A.graftOn(w, 'Lesser brutal graft');
    const ok = Math.abs(A.graftSum('dmg') - d0 - 0.02) < 1e-9; A.graftFuse('Lesser brutal graft'); const gold = g.player.gold; g.player.gold = 1e6; A.graftOff(w, A.S('grafts').on[w].length - 1); g.player.gold = gold; return ok && A.count('Lesser brutal graft') >= 1; };
}
