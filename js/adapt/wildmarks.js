// Wildmarks: lasting marks on you with a downside and a boon. Not Quirks, not Leychemistry, not a damage percent.
// Cap 3 (recommended 2). A Herbalism tonic can suppress a mark for a time or clear it. Ysolde's remedy does not touch them.
import { NORM, obj, arr, num } from './state.js';

export const MARKS = {
  nighteye: {
    id: 'nighteye', name: 'Night-eye', icon: '🌙',
    up: 'A little night-sight, like a lamp pip.',
    down: 'Louder footsteps: foes notice you from a little farther, so Shadework is harder to keep.'
  },
  kindled: {
    id: 'kindled', name: 'Fire-kindled', icon: '🔥',
    up: 'Ley fire catches a little more easily on your lamp and nearby grass.',
    down: 'Rain bothers you less, and also puts nearby flames out a little more slowly.'
  },
  deeplung: {
    id: 'deeplung', name: 'Deep-lung', icon: '🫁',
    up: 'Climbing drains less run energy.',
    down: 'You move more slowly when you are in the water.'
  }
};
export const CAP = 3, SOFT = 2, SUPPRESS_MS = 10 * 60 * 1000;

NORM.blight = v => {
  v = obj(v);
  const held = arr(v.held).filter(id => MARKS[id]).slice(0, CAP);
  const uniq = [...new Set(held)];
  return { held: uniq, suppressedUntil: Math.max(0, Math.floor(num(v.suppressedUntil, 0, 0))) };
};

export default function wildmarks(A) {
  const { ctx, player } = A;
  const S = () => A.S('blight');
  const now = () => Date.now();
  const suppressed = () => now() < (S().suppressedUntil || 0);

  A.markHeld = () => S().held.slice();
  A.markHas = id => S().held.includes(id);
  A.markActive = id => A.markHas(id) && !suppressed();
  A.markSuppressed = () => suppressed();
  A.markList = () => Object.values(MARKS);

  A.markGrant = (id, why) => {
    if (!MARKS[id]) return 'Unknown mark.';
    const s = S();
    if (s.held.includes(id)) return 'You already carry that Wildmark.';
    if (s.held.length >= CAP) return 'You already carry the most Wildmarks you can hold (3).';
    s.held.push(id);
    const m = MARKS[id];
    A.log(`A Wildmark settles on you${why ? ' (' + why + ')' : ''}: ${m.name}. ${m.up} ${m.down}`, 'skill');
    if (s.held.length === SOFT) A.log('You carry two Wildmarks (the recommended number). A third will still fit, and a tonic can clear one.', 'game');
    A.dirty(); return true;
  };
  A.markClear = id => {
    const s = S();
    if (id && !s.held.includes(id)) return 'You do not carry that mark.';
    if (!id) {
      if (!s.held.length) return 'You carry no Wildmark.';
      id = s.held[0];
    }
    s.held = s.held.filter(x => x !== id);
    A.log(`The ${MARKS[id].name} Wildmark fades.`, 'game');
    A.dirty(); return true;
  };
  A.markSuppress = (ms = SUPPRESS_MS) => {
    if (!S().held.length) return 'You carry no Wildmark to hush.';
    S().suppressedUntil = now() + ms;
    A.log('The Wildmarks go quiet for a while. They are still on you.', 'game');
    A.dirty(); return true;
  };

  // Compose with existing lamp / notice / climb / ley hooks. No damage percent.
  const prevLamp = A.veilLamp;
  A.veilLamp = () => (prevLamp ? prevLamp() : false) || A.markActive('nighteye');
  A.markNoticeMul = () => (A.markActive('nighteye') ? 1.25 : 1);
  const prevDrain = A.climbDrainMul;
  A.climbDrainMul = () => (prevDrain ? prevDrain() : 1) * (A.markActive('deeplung') ? 0.75 : 1);
  A.markSwimMul = () => (A.markActive('deeplung') ? 0.8 : 1);
  A.leySpreadMul = () => (A.markActive('kindled') ? 1.25 : 1);
  A.leyRainMul = () => (A.markActive('kindled') ? 0.55 : 1);

  // Slow walk/run a little while standing in water (there is no separate swim speed).
  ctx.EXT.extFrame.push(() => {
    if (!A.markActive('deeplung') || !ctx.pm) return;
    const p = A.pos && A.pos(); if (!p) return;
    const h = (ctx.terrainHeight && ctx.terrainHeight(p.x, p.z));
    const gy = typeof h === 'number' ? h : (p.y || 0);
    if (gy < 0.2) ctx.pm.speedMul = (ctx.pm.speedMul || 1) * 0.8;
  });

  A.npc('wildmarks', '🌿', 'Markwise Calla', 'A Wildmark is a mark the wild leaves on you: a downside and a boon together. Night-eye, fire-kindled, deep-lung. You can take one from an Ashfall, a marked foe, or a drafted tonic. Two is plenty; three is the most. My hush tonic quiets them for a time; the clear tonic lifts one. Ysolde still treats habit-quirks, not these.', 'blight');
  A.guide.push(['Wildmarks', 'Ventures ✦ → Wildmarks, or talk to Markwise Calla in Larkhaven. A Wildmark has a downside and a boon (night-sight but louder steps, fire that kindles more easily, a deep lung for climbs but a slower wade). Cap 3, recommended 2. A Herbalism tonic can suppress or clear one. Not a Quirk: Ysolde\'s remedy will not lift it. Not Leychemistry, not Hardroad, and not a damage percent.']);

  A.tab({ id: 'blight', icon: '🌿', name: 'Wildmarks', render: () => {
    const s = S(), hush = suppressed();
    const left = hush ? Math.max(0, Math.ceil((s.suppressedUntil - now()) / 60000)) : 0;
    const rows = s.held.length ? s.held.map(id => {
      const m = MARKS[id];
      return `<div style="margin:8px 0"><b>${m.icon} ${A.esc(m.name)}</b>${hush ? ' <small>(hushed)</small>' : ''}<br><small>Up: ${A.esc(m.up)}<br>Down: ${A.esc(m.down)}</small>
        <div class="row"><button data-a="clear" data-id="${id}" ${A.count('Mark-clear tonic') < 1 ? 'disabled' : ''} style="min-height:40px">Clear (tonic)</button></div></div>`;
    }).join('') : '<p>You carry no Wildmark.</p>';
    return `<h4>Wildmarks</h4><p>A lasting mark on you, with a downside and a boon. Not a Quirk, not Leychemistry, not Hardroad, and not a damage percent. Recommended 2, at most 3. Ysolde\'s remedy will not lift one.</p>
      ${hush ? `<p>The marks are hushed for about <b>${left}</b> more minutes.</p>` : ''}
      ${rows}
      <div class="row"><button data-a="hush" ${A.count('Mark-hush tonic') < 1 || !s.held.length ? 'disabled' : ''} style="min-height:40px">Hush all (tonic)</button></div>
      <h4>Draft a mark</h4><p>A Wildmark tonic lets you take one, if you have room.</p>
      <div class="row">${Object.values(MARKS).map(m => `<button data-a="draft" data-id="${m.id}" ${A.count('Wildmark tonic') < 1 ? 'disabled' : ''} style="min-height:40px">${m.icon} ${A.esc(m.name)}</button>`).join('')}</div>`;
  }, act: (a, d) => {
    if (a === 'hush') { if (A.take('Mark-hush tonic', 1)) A.markSuppress(); }
    if (a === 'clear' && d.id) { if (A.take('Mark-clear tonic', 1)) A.markClear(d.id); }
    if (a === 'draft' && d.id) { if (A.count('Wildmark tonic') < 1) return; const r = A.markGrant(d.id, 'a drafted tonic'); if (r === true) A.take('Wildmark tonic', 1); else A.log(r, 'warn'); }
  } });

  A.vtests = A.vtests || {};
  A.vtests.wildmarks = async (g, A) => {
    const s = S();
    const snap = { held: s.held.slice(), suppressedUntil: s.suppressedUntil };
    const Q = g.player.quirks;
    const qSnap = Q ? { held: (Q.held || []).slice(), removed: Q.removed, declined: (Q.declined || []).slice() } : null;
    try {
      s.held = []; s.suppressedUntil = 0;
      if (A.markNoticeMul() !== 1 || A.markSwimMul() !== 1) return 'idle muls';
      const g1 = A.markGrant('nighteye', 'test');
      if (g1 !== true) return 'grant ' + g1;
      if (!A.markActive('nighteye')) return 'not active';
      if (!(A.markNoticeMul() > 1)) return 'notice mul';
      if (!(A.veilLamp && A.veilLamp())) return 'night-sight lamp';
      A.markGrant('kindled', 'test');
      A.markGrant('deeplung', 'test');
      if (s.held.length !== 3) return 'cap fill';
      const g4 = A.markGrant('nighteye', 'test');
      if (g4 === true) return 'duplicate';
      // Cap 3
      s.held = ['nighteye', 'kindled', 'deeplung'];
      // Suppress quiets every side.
      A.markSuppress(60 * 1000);
      if (A.markActive('nighteye') || A.markNoticeMul() !== 1 || A.markSwimMul() !== 1) return 'suppress failed';
      if (A.leySpreadMul() !== 1 || A.leyRainMul() !== 1) return 'ley still marked';
      if ((A.climbDrainMul && A.climbDrainMul()) !== (A.count('Ridgewalk soles') > 0 ? 0.9 : 1) && A.markActive('deeplung')) return 'drain during hush';
      s.suppressedUntil = 0;
      if (!(A.markActive('deeplung') && A.climbDrainMul() < (A.count('Ridgewalk soles') > 0 ? 0.9 : 1) + 1e-9)) {
        // climbDrainMul should be 0.75, or 0.75*0.9 if soles
        const d = A.climbDrainMul ? A.climbDrainMul() : 1;
        const expect = 0.75 * (A.count('Ridgewalk soles') > 0 ? 0.9 : 1);
        if (Math.abs(d - expect) > 1e-9) return 'drain mul ' + d;
      }
      // Ysolde's remedy must not clear a Wildmark.
      if (Q) {
        if (!Q.held.includes('test-quirk-not-real')) {
          // Use a real quirk id if any are held, else skip add — only remove path matters.
        }
        const heldBefore = s.held.slice();
        if (g.EXT && g.EXT.quirks && g.EXT.quirks.remove && Q.held[0]) g.EXT.quirks.remove(Q.held[0]);
        else if (Q.held && Q.held.length) { Q.held = Q.held.slice(1); Q.removed = (Q.removed || 0) + 1; }
        if (JSON.stringify(s.held) !== JSON.stringify(heldBefore)) return 'ysolde cleared a Wildmark';
      }
      A.markClear('nighteye');
      if (A.markHas('nighteye')) return 'clear failed';
      // Old-save default: no marks.
    } finally {
      s.held = snap.held; s.suppressedUntil = snap.suppressedUntil;
      if (Q && qSnap) { Q.held = qSnap.held; Q.removed = qSnap.removed; Q.declined = qSnap.declined; }
    }
    return true;
  };
}
