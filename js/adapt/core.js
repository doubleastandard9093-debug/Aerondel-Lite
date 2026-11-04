// Ventures core: shared hub window, quick buttons, keys, combat bonus totals and helpers for every adaptation system.
import { ITEMS } from '../items.js';
import { weaponClass, isBlade } from '../arsenal.js';
import { normalizeAdapt } from './state.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CSS = `
#advWin{position:fixed;z-index:40;top:calc(8px + env(safe-area-inset-top));left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));max-height:min(66vh,560px);display:none;flex-direction:column;
 background:rgba(24,22,20,.97);border:2px solid #8a6a2a;border-radius:10px;color:#f2e6c8;font:13px/1.35 sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.6)}
#advWin.on{display:flex}
#advWin .vh{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #5a4a26}
#advWin .vh b{flex:1;font-size:15px;color:#ffd780}
#advWin .vh button{min-width:44px;min-height:36px;font-size:16px}
#advWin .vt{display:flex;gap:4px;overflow-x:auto;padding:6px 8px;border-bottom:1px solid #3a3020;-webkit-overflow-scrolling:touch;scrollbar-width:none}
#advWin .vt button{flex:0 0 auto;padding:6px 9px;font-size:12px;white-space:nowrap;min-height:34px}
#advWin .vt button.on{background:linear-gradient(180deg,#7a5a1e,#4a3510);color:#fff}
#advWin .vb{overflow-y:auto;padding:8px 10px 12px;-webkit-overflow-scrolling:touch}
#advWin .vb h4{margin:8px 0 4px;color:#ffd780;font-size:13px}
#advWin .vb p{margin:4px 0}
#advWin .vb .row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #2e2618}
#advWin .vb .row>div{flex:1;min-width:0}
#advWin .vb small{color:#c8b890}
#advWin .vb button{min-height:36px;padding:5px 10px;font-size:12px}
#advWin .vb button.on{background:linear-gradient(180deg,#7a5a1e,#4a3510);color:#fff}
#advWin .bar{height:8px;background:#2a2218;border-radius:4px;overflow:hidden;margin:3px 0}
#advWin .bar i{display:block;height:100%;background:linear-gradient(90deg,#c08a20,#ffd780)}
#advWin .grid{display:flex;flex-wrap:wrap;gap:6px}
#advWin .grid button{flex:1 0 40%}
#advWin .muted{opacity:.5}
@media (min-width:900px){#advWin{left:50%;right:auto;width:480px;transform:translateX(-50%);top:70px}}
`;

export function installCore(ctx) {
  const { player, skills, EXT, log } = ctx;
  player.adapt = normalizeAdapt(player.adapt);
  const A = { ctx, player, skills, EXT, log, esc, tabs: [], mods: { dmg: [], acc: [], dr: [], xp: [] }, onReady: [] };
  A.S = key => { if (!player.adapt || typeof player.adapt !== 'object') player.adapt = normalizeAdapt(player.adapt); if (!player.adapt[key]) player.adapt = normalizeAdapt(player.adapt); return player.adapt[key]; };
  A.tick = () => ctx.tick();
  A.dirty = () => ctx.markDirty();
  A.pos = () => ctx.pm.mesh.position;
  A.dist = (x, z) => { const p = A.pos(); return Math.hypot(p.x - x, p.z - z); };
  A.lvl = s => (skills[s] ? skills[s].level : 1);
  A.fmt = n => Math.floor(n).toLocaleString('en-US');
  A.count = item => (player.inventory[item] || 0);
  A.take = (item, n = 1) => { if (A.count(item) < n) return false; player.inventory[item] -= n; if (player.inventory[item] <= 0) delete player.inventory[item]; return true; };
  A.give = (item, n = 1) => ctx.giveItem(item, n);
  A.owns = item => !!(player.inventory[item] || player.bank[item] || Object.values(player.equipment).includes(item));
  A.weapon = () => { const n = player.equipment.weapon, info = (n && ITEMS[n]) || {}; const cls = n ? (info.wclass || weaponClass(n)) : null;
    const ranged = !!(n && ctx.isRangedWeapon(n)), magic = !!(player.settings.autocast || /staff|wand/i.test(n || ''));
    return { name: n, info, cls, ranged, magic, blade: !!(n && isBlade(n)) }; };
  // The four disciplines used by Twin Stance, the Anima Lattice and Overflare.
  A.style = () => { const w = A.weapon(); return w.magic ? 'Magic' : w.ranged ? 'Ranged' : (w.blade || w.cls === 'warfan' || w.cls === 'chakram') ? 'Swordsmanship' : 'Melee'; };
  A.STYLES = ['Melee', 'Ranged', 'Magic', 'Swordsmanship'];
  A.styleSkill = s => ({ Melee: 'Attack', Ranged: 'Ranged', Magic: 'Magic', Swordsmanship: 'Swordsmanship' }[s]);
  A.monsNear = (x, z, r, cap = 6) => ctx.monsters.filter(m => m.alive && m.hp > 0 && !m.dying && Math.hypot(m.mesh.position.x - x, m.mesh.position.z - z) < r).slice(0, cap);
  A.isBossy = m => !!(m && (m.boss || m.siegeBoss || m.colossus || m.frontierBoss || m.vigil || (m.level || 0) >= 140 && /Warden|Colossus|Behemoth|Warlord|Revenant|Tyrant|Archon|Knight|Sunderlord/.test(m.name || '')));
  A.every = (n, fn) => EXT.extTick.push(now => { if (A.tick() % n === 0) fn(now); });
  A.key = (act, fn) => { (EXT.keys = EXT.keys || {})[act] = fn; };
  A.quick = fn => { (EXT.quickX = EXT.quickX || []).push(fn); };
  A.onQuick = (id, fn) => { (EXT.quick = EXT.quick || {})[id] = fn; };
  let lastQ = '';
  A.refreshQuick = () => ctx.refreshQuick();
  EXT.extTick.push(() => { if (A.tick() % 2) return; const sig = (EXT.quickX || []).map(f => JSON.stringify(f() || [])).join('|'); if (sig !== lastQ) { lastQ = sig; ctx.refreshQuick(); } });
  // Talkers: an NPC that opens the hub on its tab (plus any custom lines).
  A.npc = (ext, face, name, line, tab, more = []) => { EXT.extTalk[ext] = { face, talk: () => [['npc', `${name}: ${line}`], { choose: [...more.map(([l, fn]) => [l, [{ run: () => fn() || [] }]]), ['Show me.', [{ run: () => { A.open(tab); return []; } }]], ['Goodbye.', []]] }] }; };

  // ---- combat bonus totals (fractions) ----
  const sum = (list, ...a) => { let t = 0; for (const f of list) { try { t += f(...a) || 0; } catch (e) { /* bad mod */ } } return t; };
  A.totals = (mon, ranged, special) => ({ dmg: Math.min(1.5, sum(A.mods.dmg, mon, ranged, special)), acc: Math.min(0.6, sum(A.mods.acc, mon, ranged, special)), dr: Math.min(0.6, sum(A.mods.dr, mon)) });
  EXT.extSwing.push((mon, swings, ranged, special) => { const t = A.totals(mon, ranged, special); if (t.dmg || t.acc) for (const s of swings) { s.dmg = (s.dmg || 0) + t.dmg; s.acc = (s.acc || 0) + t.acc; } });
  EXT.extIncoming.push((dmg, mon) => { const r = A.totals(mon).dr; return r > 0 ? Math.max(dmg > 0 ? 1 : 0, Math.round(dmg * (1 - r))) : dmg; });
  EXT.extXp.push(skill => 1 + Math.min(1, sum(A.mods.xp, skill)));

  // ---- hub window ----
  if (!document.getElementById('advCss')) { const st = document.createElement('style'); st.id = 'advCss'; st.textContent = CSS; document.head.appendChild(st); }
  const win = document.createElement('div'); win.id = 'advWin';
  win.innerHTML = `<div class="vh"><b>✦ Ventures</b><button data-x="1" aria-label="Close">✕</button></div><div class="vt"></div><div class="vb"></div>`;
  document.body.appendChild(win);
  const tabsEl = win.querySelector('.vt'), body = win.querySelector('.vb');
  let cur = 'overview', openNow = false;
  A.tab = t => { A.tabs.push(t); };
  A.isOpen = () => openNow;
  A.open = id => { if (id) cur = id; openNow = true; win.classList.add('on'); A.render(true); };
  A.close = () => { openNow = false; win.classList.remove('on'); };
  A.toggle = id => (openNow && (!id || id === cur) ? A.close() : A.open(id));
  A.render = force => {
    if (!openNow) return;
    const vis = A.tabs.filter(t => !t.hidden || !t.hidden());
    const th = vis.map(t => `<button data-t="${t.id}" class="${t.id === cur ? 'on' : ''}">${t.icon} ${esc(t.name)}</button>`).join('');
    if (tabsEl._h !== th) { tabsEl._h = th; tabsEl.innerHTML = th; }
    const t = vis.find(x => x.id === cur) || vis[0]; if (!t) return;
    let h; try { h = t.render(); } catch (e) { console.warn(e); h = '<p>Something went wrong showing this page.</p>'; }
    if (force || body._h !== h) { const y = body.scrollTop; body._h = h; body.innerHTML = h; body.scrollTop = force ? 0 : y; }
  };
  win.addEventListener('click', e => {
    if (e.target.closest('[data-x]')) return A.close();
    const tb = e.target.closest('[data-t]'); if (tb) { cur = tb.dataset.t; tabsEl.querySelector('.on')?.classList.remove('on'); tb.classList.add('on'); A.render(true); tb.scrollIntoView({ inline: 'nearest', block: 'nearest' }); return; }
    const b = e.target.closest('[data-a]'); if (!b) return;
    const t = A.tabs.find(x => x.id === cur); if (t && t.act) { try { t.act(b.dataset.a, b.dataset); } catch (er) { console.warn(er); } A.dirty(); A.render(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openNow) A.close(); });
  setInterval(() => A.render(), 1000);
  A.key('ventures', () => A.toggle());
  A.quick(() => [['ventures', '✦', 'Ventures: Overflare, Ledger, Reliquaries and the other new systems (J)']]);
  A.onQuick('ventures', () => A.toggle());

  // Overview tab: every system and where to find it.
  A.guide = [];
  A.tab({ id: 'overview', icon: '✦', name: 'Overview', render: () => {
    const t = A.totals(null), x = Math.min(1, sum(A.mods.xp, 'Attack'));
    return `<p>New systems inspired by other games, reworked for Aerondel. Tap a tab above, or press J to open and close this window.</p>
      <p><small>Your Ventures bonuses right now: +${Math.round(t.dmg * 100)}% damage, +${Math.round(t.acc * 100)}% accuracy, ${Math.round(t.dr * 100)}% less damage taken, +${Math.round(x * 100)}% combat XP.</small></p>
      ${A.guide.map(([n, how]) => `<div class="row"><div><b>${esc(n)}</b><br><small>${esc(how)}</small></div></div>`).join('')}`;
  } });
  A.ready = () => { for (const f of A.onReady) f(); };
  return A;
}
