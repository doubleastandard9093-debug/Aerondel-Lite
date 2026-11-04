// Hidden Reliquaries (adapted from Lost Ark's hidden treasure/rune puzzles): dowse for buried caches, then trace the seal's rune sequence.
import { ITEMS, ICONS, RECIPES } from '../items.js';
import { TOWNS } from '../world.js';
import { NORM, obj, num } from './state.js';

ITEMS['Dowsing rod'] = { value: 60, type: 'tool', examine: 'Twitches near buried reliquaries.' };
ICONS['Dowsing rod'] = ['🪄', '#c8a04a50'];
if (!RECIPES.some(r => r.output === 'Dowsing rod')) RECIPES.push({ station: null, tool: null, name: 'Craft Dowsing rod', cat: 'Crafting', group: 'Tools', skill: 'Crafting', level: 10, inputs: { Logs: 1, 'Iron bar': 1 }, output: 'Dowsing rod', xp: 25 });
const RUNES = ['▲', '◆', '●', '✚'];
const OFF = [[-16, -12], [18, -10], [-14, 16], [15, 17]];
NORM.reliq = v => { v = obj(v); return { day: String(v.day || ''), dug: Array.isArray(v.dug) ? v.dug.filter(n => Number.isInteger(n)) : [], total: num(v.total) }; };
const today = () => new Date().toISOString().slice(0, 10);

export default function reliquary(A) {
  const { ctx, player } = A, R = () => { const r = A.S('reliq'); if (r.day !== today()) { r.day = today(); r.dug = []; } return r; };
  const T = Object.values(TOWNS);
  A.relics = Array.from({ length: 16 }, (_, i) => { const t = T[i % T.length], o = OFF[Math.floor(i / T.length) % 4 + (i % 2)] || OFF[0]; return { i, x: t.x + o[0], z: t.z + o[1], tier: 1 + (i % 3) }; });
  const near = () => { const p = A.pos(); let best = null, bd = 1e9; for (const s of A.relics) { if (R().dug.includes(s.i)) continue; const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; best = s; } } return best && { s: best, d: bd }; };
  A.relicNear = near;
  let puz = null;
  const start = s => { const n = 3 + s.tier, secs = 6 + s.tier * 2 + Math.floor(A.lvl('Thieving') / 10);
    puz = { s, seq: Array.from({ length: n }, () => Math.floor(Math.random() * 4)), at: 0, end: Date.now() + secs * 1000, secs }; A.open('reliq'); };
  A.relicDig = () => { if (!A.owns('Dowsing rod')) { A.log('You need a dowsing rod (Crafting 10: 1 Logs + 1 Iron bar, or buy one from Wayfinder Tamsin in Larkhaven).', 'warn'); return; }
    const n = near(); if (!n) { A.log('Every reliquary has been dug up today. They reseal at midnight UTC.', 'info'); return; }
    if (n.d > 3) { const dir = Math.atan2(n.s.x - A.pos().x, n.s.z - A.pos().z); const comp = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'][((Math.round(dir / (Math.PI / 4)) % 8) + 8) % 8];
      A.log(`The rod pulls ${comp}. ${n.d < 15 ? 'Very close!' : n.d < 40 ? 'Warm.' : `Far (about ${Math.round(n.d)} paces).`}`, 'info'); return; }
    start(n.s); };
  const finish = ok => { const s = puz.s; puz = null; if (!ok) { A.log('The seal flares and locks. Try again.', 'warn'); return; }
    R().dug.push(s.i); A.S('reliq').total++; const g = 150 * s.tier * (1 + Math.floor(A.lvl('Thieving') / 25)); player.gold += g;
    ctx.giveXP('Thieving', 60 * s.tier); if (A.flareAdd) A.flareAdd(20);
    A.log(`You open a tier ${s.tier} reliquary: ${A.fmt(g)} coins.`, 'loot'); A.dirty(); };
  A.relicPress = r => { if (!puz) return; if (Date.now() > puz.end) return finish(false); if (r !== puz.seq[puz.at]) return finish(false); if (++puz.at >= puz.seq.length) finish(true); };
  A.onQuick('dig', A.relicDig);
  A.quick(() => { if (!A.owns('Dowsing rod')) return null; const n = near(); return n && n.d < 3 ? [['dig', '🪄Dig', 'Open the hidden reliquary']] : null; });
  A.npc('tamsin', '🧭', 'Wayfinder Tamsin', 'Reliquaries lie hidden near every town. A dowsing rod will find them — and the seals reset every day.', 'reliq',
    [['Buy a dowsing rod (150 coins).', () => { if (player.gold < 150) return [['npc', 'Come back with 150 coins.']]; player.gold -= 150; A.give('Dowsing rod'); A.dirty(); return [['npc', 'Tap Dowse in the Reliquaries tab and follow the pull.']]; }]]);
  A.guide.push(['Hidden Reliquaries', 'Get a Dowsing rod (Crafting 10, or Wayfinder Tamsin in Larkhaven, 150 coins). Ventures ✦ → Reliquaries → Dowse points you to the nearest cache; on it tap 🪄Dig and repeat the rune order before time runs out. Higher Thieving gives more time and coins. 16 caches, reset daily.']);
  A.tab({ id: 'reliq', icon: '🪄', name: 'Reliquaries', render: () => {
    if (puz) { const left = Math.max(0, Math.ceil((puz.end - Date.now()) / 1000));
      return `<h4>Seal (tier ${puz.s.tier}) — ${left}s</h4><p style="font-size:26px;letter-spacing:6px">${puz.seq.map((r, i) => `<span style="opacity:${i < puz.at ? 0.3 : 1}">${RUNES[r]}</span>`).join('')}</p><div class="row">${RUNES.map((r, i) => `<button data-a="rune" data-r="${i}" style="font-size:24px;min-width:56px;min-height:48px">${r}</button>`).join('')}</div><small>Tap the runes in order.</small>`; }
    const n = near(), r = R();
    return `<h4>Dug today ${r.dug.length}/16 · all-time ${A.S('reliq').total}</h4><p>${A.owns('Dowsing rod') ? (n ? `Nearest cache: ${Math.round(n.d)} paces away (tier ${n.s.tier}).` : 'All caches opened today.') : 'You need a Dowsing rod.'}</p><div class="row"><button data-a="dowse">🪄 Dowse / Dig</button></div>`; },
    act: (a, d) => { if (a === 'dowse') A.relicDig(); if (a === 'rune') A.relicPress(+d.r); } });
  setInterval(() => { if (puz && A.isOpen()) A.render(); if (puz && Date.now() > puz.end) { finish(false); A.render(); } }, 1000);
  A.vtests = A.vtests || {};
  A.vtests.reliquary = async (g, A) => { g.player.inventory['Dowsing rod'] = 1; const s = A.relicNear().s; A.pos().x = s.x; A.pos().z = s.z;
    const g0 = g.player.gold; A.relicDig(); if (!puz) return 'no puzzle'; for (const r of [...puz.seq]) A.relicPress(r); return g.player.gold > g0 && A.S('reliq').dug.includes(s.i); };
}
