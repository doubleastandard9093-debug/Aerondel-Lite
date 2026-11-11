// Facet Stones (adapted from PoE skill gems): socketed stones that change how a skill or technique behaves.
// Grafts stay flat stats. Sigils stay toggle perks. Facets must not add a large damage percent.
import { ITEMS, FACET_STONES } from '../items.js';
import { NORM, obj, arr } from './state.js';

const IDS = new Set(Object.keys(FACET_STONES));
const WEAPON_SLOTS = 2, FRAME_SLOTS = 2;

NORM.facets = v => {
  v = obj(v);
  const on = {};
  for (const [it, l] of Object.entries(obj(v.on))) {
    const ok = arr(l).filter(n => IDS.has(n)).slice(0, WEAPON_SLOTS);
    if (ok.length) on[it] = ok;
  }
  const frame = arr(v.frame).filter(n => IDS.has(n)).slice(0, FRAME_SLOTS);
  return { on, frame, hasFrame: !!v.hasFrame };
};

export default function facets(A) {
  const { ctx, player } = A;
  const S = () => A.S('facets');
  const wornWeapon = () => player.equipment && player.equipment.weapon;
  const allSocketed = () => {
    const s = S(), out = [];
    const w = wornWeapon();
    if (w) out.push(...(s.on[w] || []));
    if (s.hasFrame) out.push(...s.frame);
    return out;
  };
  A.facetOn = id => allSocketed().some(n => FACET_STONES[n] && FACET_STONES[n].id === id);
  A.facetList = allSocketed;
  A.facetStun = () => A.facetOn('stun') ? 3 : 0;        // extra ticks on bash / gale (~1.8s)
  A.facetWhirlR = () => A.facetOn('whirl') ? 2 : 0;     // metres added to Reaping Whirl

  A.facetSocket = (where, stone) => {
    if (!IDS.has(stone) || A.count(stone) < 1) return A.log('You do not have that Facet Stone.', 'warn');
    if (allSocketed().includes(stone) || allSocketed().some(n => FACET_STONES[n].id === FACET_STONES[stone].id))
      return A.log('That kind of Facet is already socketed.', 'warn');
    const s = S();
    if (where === 'frame') {
      if (!s.hasFrame) return A.log('Install a Facet frame first.', 'warn');
      if (s.frame.length >= FRAME_SLOTS) return A.log('The frame has no free sockets.', 'warn');
      A.take(stone, 1); s.frame.push(stone);
    } else {
      const w = wornWeapon();
      if (!w) return A.log('Wear a weapon first.', 'warn');
      const l = s.on[w] || (s.on[w] = []);
      if (l.length >= WEAPON_SLOTS) return A.log('That weapon has no free Facet sockets (2).', 'warn');
      A.take(stone, 1); l.push(stone);
    }
    A.log(`You socket the ${stone}. ${FACET_STONES[stone].desc}`, 'skill'); A.dirty();
    return true;
  };
  A.facetUnsocket = (where, i) => {
    const s = S();
    const list = where === 'frame' ? s.frame : (s.on[wornWeapon()] || []);
    if (!list[i]) return;
    const stone = list.splice(i, 1)[0];
    A.give(stone, 1);
    if (where !== 'frame' && !list.length) delete s.on[wornWeapon()];
    A.log(`You unsocket the ${stone}. The skill behaves as it used to.`, 'game'); A.dirty();
    return true;
  };
  A.facetInstall = () => {
    if (S().hasFrame) return A.log('A Facet frame is already installed.', 'game');
    if (A.count('Facet frame') < 1) return A.log('Craft or find a Facet frame first.', 'warn');
    A.take('Facet frame', 1); S().hasFrame = true;
    A.log('You install a Facet frame. It holds two more stones beside your weapon.', 'skill'); A.dirty();
    return true;
  };

  let last = null, trails = [];
  ctx.EXT.extSwing.push((mon, swings, ranged, special) => {
    last = { mon, special, ranged };
    if (A.facetOn('echo') && special) swings.push({ acc: 0, dmg: -0.25, extra: true, facet: 'echo' });
  });
  ctx.EXT.extHit.push((mon, dmg, now) => {
    if (!mon || dmg <= 0 || !last || last.mon !== mon) return;
    if (A.facetOn('frost') && last.special) {
      mon.stunUntil = Math.max(mon.stunUntil || 0, A.tick() + 2);
      mon._facetFrost = A.tick() + 4;
    }
    if (A.facetOn('stun') && (last.special === 'bash' || last.special === 'gale')) {
      mon.stunUntil = Math.max(mon.stunUntil || 0, (mon.stunUntil || A.tick()) + A.facetStun());
    }
    if (A.facetOn('trail') && (last.special === 'ricochet' || ((A.weapon && A.weapon().cls) === 'chakram'))) {
      trails.push({ mon, due: (now || 0) + 350 });
    }
  });
  ctx.EXT.extTick.push(() => {
    if (!trails.length) return;
    const now = performance.now(), left = [];
    for (const t of trails) {
      if (now < t.due) { left.push(t); continue; }
      if (t.mon && t.mon.alive && t.mon.hp > 0 && ctx.strike) {
        ctx.strike(t.mon, { dmg: -0.35, acc: 0.1 }, now, { quiet: true });
        A.log('The disc trail cuts again.', 'combat');
      }
    }
    trails = left;
  });

  ctx.EXT.extKill.push(m => {
    if (A.isBossy(m) && Math.random() < 0.22) { A.give('Dull facet'); A.log('A Dull facet falls from the fight. Cut it with Glyphcraft or Crafting.', 'loot'); }
  });

  A.npc('facetier', '💎', 'Facetier Vesa', 'I cut Facet Stones and socket them into a weapon or a small frame. They change how a skill behaves — they are not grafts, and they will not make the blade simply hit harder.', 'facets');
  A.guide.push(['Facet Stones', 'Ventures ✦ → Facets, or talk to Facetier Vesa in Larkhaven (near Graftwright Oren). Bosses sometimes drop a Dull facet; cut it with Glyphcraft or Crafting into a named stone. Socket up to two in your worn weapon, and two more in a Facet frame. Each stone changes how a skill behaves (a second hit, a frost bind, a longer stun, a wider Reaping Whirl, a chakram trail) — not a big damage percent. Unsocketing puts the stone back in your pack.']);
  let sel = null;
  A.tab({ id: 'facets', icon: '💎', name: 'Facets', render: () => {
    const s = S(), w = wornWeapon(), held = Object.keys(player.inventory || {}).filter(n => IDS.has(n));
    const weaponSlots = w ? (s.on[w] || []) : [];
    const frameSlots = s.hasFrame ? s.frame : [];
    const slotRow = (title, list, cap, where) => `<div style="margin:8px 0"><b>${A.esc(title)}</b> <small>${list.length}/${cap}</small>
      <div class="row" style="flex-wrap:wrap;gap:4px">${list.map((n, i) => `<button data-a="off" data-w="${where}" data-i="${i}">${FACET_STONES[n].icon} ${A.esc(n)} ✕</button>`).join('')}
      ${sel && list.length < cap ? `<button data-a="on" data-w="${where}">＋ ${A.esc(sel)}</button>` : ''}</div></div>`;
    return `<h4>Facet Stones</h4>
      <p><small>These change how a skill behaves. Grafts still add stats; Sigils are still your toggles. A stone does not add a large damage percent.</small></p>
      <div class="row" style="flex-wrap:wrap;gap:4px">${held.length ? held.map(n => `<button data-a="sel" data-k="${A.esc(n)}" class="${n === sel ? 'on' : ''}">${FACET_STONES[n].icon} ${A.esc(n)} ×${A.count(n)}</button>`).join('') : '<small class="muted">Cut a Dull facet (Glyphcraft or Crafting) or take one from a boss.</small>'}</div>
      ${slotRow(w ? `Weapon · ${w}` : 'Weapon (wear one first)', weaponSlots, WEAPON_SLOTS, 'weapon')}
      ${s.hasFrame ? slotRow('Facet frame', frameSlots, FRAME_SLOTS, 'frame') : `<div class="row"><button data-a="frame">${A.count('Facet frame') ? 'Install Facet frame (2 more sockets)' : 'Craft a Facet frame (Crafting 30) to add 2 sockets'}</button></div>`}
      <p><small>Now: ${allSocketed().length ? allSocketed().map(n => FACET_STONES[n].desc).join(' ') : 'no stones socketed.'}</small></p>`;
  }, act: (a, d) => { if (a === 'sel') sel = sel === d.k ? null : d.k; if (a === 'on' && sel) { A.facetSocket(d.w, sel); if (!A.count(sel)) sel = null; } if (a === 'off') A.facetUnsocket(d.w, +d.i); if (a === 'frame') A.facetInstall(); } });

  A.vtests = A.vtests || {};
  A.vtests.facets = async (g, A) => {
    const s = S(), prev = JSON.parse(JSON.stringify(s));
    const inv = { ...g.player.inventory };
    const weap = g.player.equipment.weapon;
    const worn = weap || 'Bronze sword';
    try {
      if (!g.player.equipment.weapon) g.player.equipment.weapon = worn;
      if ((g.player.inventory[worn] || 0) < 1) g.player.inventory[worn] = 1;
      g.player.inventory['Twin-cut Facet'] = (g.player.inventory['Twin-cut Facet'] || 0) + 1;
      g.player.inventory['Wide-reap Facet'] = (g.player.inventory['Wide-reap Facet'] || 0) + 1;
      g.player.inventory['Facet frame'] = (g.player.inventory['Facet frame'] || 0) + 1;
      const swings = [{ acc: 0, dmg: 0 }];
      // no stone: extSwing should not add an echo
      const hook = ctx.EXT.extSwing;
      if (A.facetOn('echo')) return 'already on';
      if (A.facetWhirlR() !== 0) return 'whirl before';
      if (!A.facetSocket('weapon', 'Twin-cut Facet')) return 'socket echo';
      if (!A.facetOn('echo')) return 'echo not active';
      // simulate a skill swing
      for (const f of hook) f({ name: 'dummy' }, swings, false, 'power');
      if (!swings.some(x => x.facet === 'echo')) return 'no echo hit';
      if (!A.facetUnsocket('weapon', 0)) return 'unsocket';
      if (A.facetOn('echo')) return 'echo lingered';
      const swings2 = [{ acc: 0, dmg: 0 }];
      for (const f of hook) f({ name: 'dummy' }, swings2, false, 'power');
      if (swings2.some(x => x.facet === 'echo')) return 'echo after unsocket';
      if (!A.facetSocket('weapon', 'Wide-reap Facet')) return 'socket whirl';
      if (A.facetWhirlR() !== 2) return 'whirl r ' + A.facetWhirlR();
      A.facetUnsocket('weapon', 0);
      if (A.facetWhirlR() !== 0) return 'whirl lingered';
      if (!A.facetInstall()) return 'frame';
      if (!S().hasFrame) return 'no frame';
      return true;
    } finally {
      g.player.inventory = inv;
      if (!weap) g.player.equipment.weapon = weap;
      Object.keys(s).forEach(k => delete s[k]); Object.assign(s, prev);
    }
  };
}
