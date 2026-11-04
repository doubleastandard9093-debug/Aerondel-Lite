// Kitbash Wardrobe (adapted from PSO2's fashion layer): wear any unlocked look over your real gear and dye each slot.
// Stats always come from your real gear. Builds on the Stable Codex wardrobe (codex.looks / codex.seen).
import { ITEMS } from '../items.js';
import { LOOK_SLOTS } from '../codex.js';
import { NORM, obj, arr } from './state.js';
export const DYES = [['Emberglow', 0xc0401a], ['Rimefrost', 0xa8d8f0], ['Mossbank', 0x4a7a3a], ['Duskviolet', 0x5a3a8a], ['Saltwhite', 0xe8e4d8], ['Ironsoot', 0x2a2a2e],
  ['Goldleaf', 0xd4a830], ['Tidewater', 0x2a6a8a], ['Bloodroot', 0x7a1a24], ['Ashgrey', 0x7a7a78], ['Sunflax', 0xe0c870], ['Nightjet', 0x14141c]];
const DYE_IDS = DYES.map(d => d[0]);
NORM.wardrobe = v => { v = obj(v); const dyes = {}; for (const s of LOOK_SLOTS) if (DYE_IDS.includes(obj(v.dyes)[s])) dyes[s] = v.dyes[s];
  const outfits = arr(v.outfits).slice(0, 3).map(o => (o && typeof o === 'object' ? { looks: obj(o.looks), dyes: obj(o.dyes) } : null));
  while (outfits.length < 3) outfits.push(null); return { dyes, outfits }; };
const MAT = { head: 'helmMat', body: 'bodyMat', legs: 'legMat', shield: 'shieldMat', cape: 'capeMat' };
const NAME = { head: 'Head', body: 'Body', legs: 'Legs', shield: 'Shield', cape: 'Cape' };

export default function wardrobe(A) {
  const { ctx, player } = A, W = () => A.S('wardrobe'), C = () => player.codex || (player.codex = { looks: {}, seen: [] });
  const looksFor = s => { const seen = C().seen || []; return seen.filter(i => ITEMS[i] && ITEMS[i].type === s); };
  const applyDyes = () => { const p = ctx.pm.parts; if (!p) return; const d = W().dyes;
    for (const s of LOOK_SLOTS) { const m = p[MAT[s]]; if (!m || !d[s] || !player.equipment[s]) continue; const hex = DYES.find(x => x[0] === d[s])[1]; if (m.color.getHex() !== hex) m.color.setHex(hex); } };
  A.applyDyes = applyDyes;
  let f = 0; ctx.EXT.extFrame.push(() => { if (++f % 15 === 0) applyDyes(); });
  // Unique sets and every armour piece you own unlock as looks (not only pieces you've worn).
  A.every(25, () => { const S = C().seen || (C().seen = []); for (const bag of [player.inventory, player.bank]) for (const i of Object.keys(bag)) { const t = ITEMS[i] && ITEMS[i].type; if (LOOK_SLOTS.includes(t) && !S.includes(i) && S.length < 400) S.push(i); } });
  const refresh = () => { ctx.applyLook(); applyDyes(); A.dirty(); };
  A.guide.push(['Kitbash Wardrobe', 'Ventures ✦ → Wardrobe. Show any armour you have owned or worn over your real gear and dye each slot with 12 dyes; save up to 3 outfits. Stats never change.']);
  A.tab({ id: 'wardrobe', icon: '👘', name: 'Wardrobe', render: () => { const w = W(), L = C().looks || {};
    return `<p><small>Looks show over a slot you are wearing something in. Your stats always come from your real gear.</small></p>` + LOOK_SLOTS.map(s => { const list = looksFor(s), cur = L[s];
      return `<h4>${NAME[s]}: ${A.esc(cur || 'your real gear')}${w.dyes[s] ? ` · ${w.dyes[s]}` : ''}</h4><div class="grid"><button data-a="prev" data-s="${s}" ${list.length ? '' : 'disabled'}>◀ Look</button><button data-a="next" data-s="${s}" ${list.length ? '' : 'disabled'}>Look ▶</button><button data-a="real" data-s="${s}">Real gear</button></div>
        <div class="grid" style="margin-top:4px">${DYES.map(([n, h]) => `<button data-a="dye" data-s="${s}" data-d="${n}" title="${n}" class="${w.dyes[s] === n ? 'on' : ''}" style="flex:0 0 38px;min-height:30px;background:#${h.toString(16).padStart(6, '0')}"></button>`).join('')}<button data-a="undye" data-s="${s}" style="flex:0 0 auto">No dye</button></div>`; }).join('') +
      `<h4>Outfits</h4>${w.outfits.map((o, i) => `<div class="row"><div>Outfit ${i + 1} <small>${o ? Object.values(o.looks).length + ' looks, ' + Object.values(o.dyes).length + ' dyes' : 'empty'}</small></div><button data-a="save" data-i="${i}">Save</button><button data-a="wear" data-i="${i}" ${o ? '' : 'disabled'}>Wear</button></div>`).join('')}`; },
    act: (a, d) => { const w = W(), L = (C().looks = C().looks || {}), s = d.s;
      if (a === 'prev' || a === 'next') { const list = looksFor(s); if (!list.length) return; let i = list.indexOf(L[s]); i = a === 'next' ? (i + 1) % list.length : (i <= 0 ? list.length - 1 : i - 1); L[s] = list[i]; }
      else if (a === 'real') delete L[s];
      else if (a === 'dye') w.dyes[s] = d.d;
      else if (a === 'undye') delete w.dyes[s];
      else if (a === 'save') { w.outfits[+d.i] = { looks: { ...L }, dyes: { ...w.dyes } }; A.log(`Outfit ${+d.i + 1} saved.`, 'game'); }
      else if (a === 'wear') { const o = w.outfits[+d.i]; if (!o) return; C().looks = { ...o.looks }; w.dyes = { ...o.dyes }; A.log(`You change into outfit ${+d.i + 1}.`, 'game'); }
      refresh(); } });
  A.vtests = A.vtests || {};
  A.vtests.wardrobe = async (g, A, near, T) => { const P = g.player; P.equipment.body = 'Steel platebody'; g.applyLook(); const atk0 = JSON.stringify(P.equipment);
    A.S('wardrobe').dyes.body = 'Emberglow'; A.applyDyes(); const ok1 = g.pm.parts.bodyMat.color.getHex() === 0xc0401a;
    P.codex.seen.push('Rimeplate cuirass'); P.codex.looks.body = 'Rimeplate cuirass'; g.applyLook(); A.applyDyes(); return ok1 && JSON.stringify(P.equipment) === atk0 && P.equipment.body === 'Steel platebody'; };
}
