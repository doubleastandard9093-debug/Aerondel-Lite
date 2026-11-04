// Anima Lattice (adapted from PSO2's skill tree / Lost Ark's ark passive): after 1000 in a style's skill, that style gets a 19-node hex board.
// Spend Anima (Breach Runs, bosses) on nodes linked to filled ones; matching neighbours strengthen each other. Each style keeps its own board.
import { NORM, obj, arr, num } from './state.js';
const HEX = []; for (let q = -2; q <= 2; q++) for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) HEX.push([q, r]);
const TYPES = ['dmg', 'acc', 'dr', 'xp', 'flare', 'stag'];
const LBL = { dmg: ['🗡️', 'damage', 0.015], acc: ['🎯', 'accuracy', 0.02], dr: ['🛡️', 'less damage taken', 0.012], xp: ['📘', 'combat XP', 0.02], flare: ['⚡', 'Overflare gain', 0.05], stag: ['💥', 'stagger', 0.06] };
const nodeType = i => (i === HEX.findIndex(([q, r]) => !q && !r) ? 'dmg' : TYPES[(i * 7 + HEX[i][0] * 3) % TYPES.length]);
const ring = i => Math.max(Math.abs(HEX[i][0]), Math.abs(HEX[i][1]), Math.abs(HEX[i][0] + HEX[i][1]));
const adj = (a, b) => { const dq = HEX[a][0] - HEX[b][0], dr = HEX[a][1] - HEX[b][1]; return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)) === 1; };
const STY = ['Melee', 'Ranged', 'Magic', 'Swordsmanship'];
NORM.lattice = v => { v = obj(v); const boards = {}; for (const s of STY) boards[s] = [...new Set(arr(obj(v.boards)[s]).filter(i => Number.isInteger(i) && i >= 0 && i < HEX.length))]; return { boards, spent: Math.floor(num(v.spent, 0, 0)) }; };
export default function lattice(A) {
  const { ctx } = A, L = () => A.S('lattice'), anima = () => A.S('breach') ? A.S('breach').anima : 0;
  const board = () => { const s = (A.S('stance') && A.S('stance').main) || A.style(); return s; };
  A.latticeOpen = s => A.lvl(A.styleSkill(s)) >= 1000 || (s === 'Melee' && A.lvl('Strength') >= 1000);
  A.latticeSum = (k, s = board()) => { if (!A.latticeOpen(s)) return 0; const b = L().boards[s]; let t = 0; for (const i of b) if (nodeType(i) === k) { const link = b.some(j => j !== i && adj(i, j) && nodeType(j) === k); t += LBL[k][2] * (link ? 1.5 : 1); } return t; };
  A.mods.dmg.push(() => A.latticeSum('dmg')); A.mods.acc.push(() => A.latticeSum('acc')); A.mods.dr.push(() => A.latticeSum('dr')); A.mods.xp.push(() => A.latticeSum('xp'));
  if (A.flareGain) A.flareGain.push(() => A.latticeSum('flare')); if (A.stagMul) A.stagMul.push(() => A.latticeSum('stag'));
  ctx.EXT.extKill.push(m => { if (A.isBossy(m) && STY.some(A.latticeOpen) && A.S('breach')) A.S('breach').anima += 1; });
  const centre = HEX.findIndex(([q, r]) => !q && !r), cost = i => 3 + ring(i) * 3;
  A.latticeFill = (s, i) => { if (!A.latticeOpen(s)) return A.log(`Reach 1000 ${A.styleSkill(s)} to open the ${s} lattice.`, 'warn'); const b = L().boards[s]; if (b.includes(i)) return;
    if (i !== centre && !b.some(j => adj(i, j))) return A.log('Fill a node next to one you already have (start at the centre).', 'warn'); const c = cost(i); if (anima() < c) return A.log(`That node costs ${c} Anima (you have ${anima()}).`, 'warn');
    A.S('breach').anima -= c; L().spent += c; b.push(i); A.dirty(); };
  A.latticeReset = s => { const b = L().boards[s], back = b.reduce((t, i) => t + cost(i), 0); A.S('breach').anima += back; L().spent = Math.max(0, L().spent - back); L().boards[s] = []; A.log(`${s} lattice reset; ${back} Anima refunded.`, 'game'); A.dirty(); };
  let view = null;
  A.guide.push(['Anima Lattice', 'After 1000 in a style\'s skill, Ventures ✦ → Lattice opens that style\'s 19-node hex board. Spend Anima (Breach Runs, bosses) on nodes linked to ones you have; matching neighbours count 1.5×. The board used is your Twin Stance main (or your current style). Reset any time for a full refund.']);
  A.tab({ id: 'lattice', icon: '🔷', name: 'Lattice', render: () => { view = view || board(); const open = A.latticeOpen(view), b = L().boards[view], S = 40;
    const cells = HEX.map(([q, r], i) => { const x = 150 + S * 1.5 * q * 0.9, y = 120 + S * Math.sqrt(3) * (r + q / 2) * 0.9, t = nodeType(i), on = b.includes(i), can = !on && (i === centre || b.some(j => adj(i, j)));
      return `<button data-a="fill" data-i="${i}" style="position:absolute;left:${x - 21}px;top:${y - 21}px;width:42px;height:42px;border-radius:50%;padding:0;font-size:17px;opacity:${on ? 1 : can ? 0.85 : 0.35};${on ? 'background:#3a6aa0;' : ''}" title="${LBL[t][1]} (${cost(i)} Anima)">${LBL[t][0]}</button>`; }).join('');
    return `<div class="row" style="gap:4px;flex-wrap:wrap">${STY.map(s => `<button data-a="view" data-s="${s}" class="${s === view ? 'on' : ''}">${s}${A.latticeOpen(s) ? '' : ' 🔒'}</button>`).join('')}</div>
      <p><small>Anima ${anima()} · ${open ? `active board: ${board()}` : `needs ${A.styleSkill(view)} 1000`}</small></p>${open ? `<div style="position:relative;width:300px;height:240px;margin:auto">${cells}</div>
      <p><small>${TYPES.map(k => `${LBL[k][0]} +${Math.round(A.latticeSum(k, view) * 1000) / 10}%`).join(' · ')}</small></p><div class="row"><button data-a="reset">Reset (refund)</button></div>` : ''}`; },
    act: (a, d) => { if (a === 'view') view = d.s; if (a === 'fill') A.latticeFill(view, +d.i); if (a === 'reset') A.latticeReset(view); } });
  A.vtests = A.vtests || {};
  A.vtests.lattice = async (g, A) => { const sk = A.skills.Magic, old = sk.level; sk.level = 1000; try { return await Tlattice(g, A); } finally { sk.level = old; } };
  const Tlattice = async (g, A) => { const s = STY.find(A.latticeOpen); if (!s) return 'locked (ok: needs 1000)'; A.S('breach').anima += 100; A.latticeFill(s, centre); const n = HEX.findIndex((h, i) => i !== centre && adj(i, centre)); A.latticeFill(s, n); const ok = L().boards[s].length === 2; A.latticeReset(s); return ok && !L().boards[s].length; };
}
