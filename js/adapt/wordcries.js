// Wordcries (adapted from Skyrim shouts): short cries learned word-by-word from frontier cry-stones.
// Three words per cry, each making it stronger. Costs Prayer points (and a short cooldown). Not Overflare, not an Attunement super, not a new skill.
import * as THREE from 'three';
import { NORM, obj, num } from './state.js';

export const CRIES = {
  stormheave: { name: 'Stormheave', words: ['Storm', 'Heave', 'Break'], prayer: [8, 12, 16], cd: 18, color: 0xc8d0e0, desc: 'A force cry that shoves foes back.', x: 36, z: -70 },
  rimehold:   { name: 'Rimehold',   words: ['Rime', 'Hold', 'Still'],  prayer: [8, 12, 16], cd: 18, color: 0xa8d8f0, desc: 'A frost cry that slows and chills.', x: -42, z: -92 },
  windstride: { name: 'Windstride', words: ['Wind', 'Stride', 'Rush'], prayer: [6, 10, 14], cd: 16, color: 0xd0e8c8, desc: 'A whirlwind rush that carries you forward.', x: 88, z: 18 },
  heartencry: { name: 'Heartencry', words: ['Heart', 'Ward', 'Valor'], prayer: [8, 12, 16], cd: 22, color: 0xf0d080, desc: 'A valor cry that steels your companion.', x: 48, z: -48 }
};

NORM.cries = v => {
  v = obj(v);
  const words = {};
  for (const id of Object.keys(CRIES)) words[id] = Math.max(0, Math.min(3, Math.floor(num(obj(v.words)[id], 0, 0))));
  const equipped = CRIES[v.equipped] ? v.equipped : (Object.keys(words).find(k => words[k] > 0) || '');
  return { words, equipped, uses: Math.floor(num(v.uses, 0, 0)), last: Math.floor(num(v.last, 0, 0)) };
};

export default function wordcries(A) {
  const { ctx, player } = A;
  const S = () => A.S('cries');
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const placeStones = () => {
    if (A._cryStones) return;
    A._cryStones = [];
    for (const [id, d] of Object.entries(CRIES)) {
      const geo = new THREE.CylinderGeometry(0.35, 0.5, 1.6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: ctx.gfxQ() === 'low' ? 0.7 : 0.9 });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(d.x, 0.8, d.z);
      ctx.scene.add(m);
      const e = { mesh: m, alive: true, x: d.x, z: d.z, radius: 1.4, type: 'crystone', name: `${d.name} cry-stone`, examine: `A weathered cry-stone. The word "${d.words[0]}" is cut shallowest.`, ext: 'crystone', cryId: id };
      m.userData.entity = e;
      ctx.pickables.push(m);
      ctx.nodes.push(e);
      A._cryStones.push(e);
    }
  };
  A.onReady.push(placeStones);
  if (A.readyDone || (ctx.nodes && ctx.nodes.length)) placeStones();

  EXT_TALK();
  function EXT_TALK() {
    ctx.EXT.extTalk.crystone = { face: '🪨', talk: ent => {
      const id = ent && ent.cryId, d = CRIES[id]; if (!d) return [['npc', 'The stone is silent.']];
      const n = S().words[id] || 0;
      if (n >= 3) return [['npc', `The ${d.name} stone has already given you all three words: ${d.words.join(', ')}.`], { choose: [['Goodbye.', []]] }];
      const word = d.words[n];
      return [['npc', `A cry-stone of ${d.name}. The next word waiting here is "${word}".`], { choose: [[`Learn ${word}.`, [{ run: () => { A.cryLearn(id); return []; } }]], ['Leave it.', []]] }];
    } };
  }

  A.cryLearn = id => {
    const d = CRIES[id]; if (!d) return;
    const n = S().words[id] || 0;
    if (n >= 3) return A.log(`You already know every word of ${d.name}.`, 'game');
    S().words[id] = n + 1;
    if (!S().equipped) S().equipped = id;
    A.log(`You learn "${d.words[n]}" of ${d.name} (${S().words[id]}/3).`, 'skill'); A.dirty(); A.refreshQuick();
    return true;
  };

  A.cryUse = id => {
    id = id || S().equipped;
    const d = CRIES[id]; if (!d) return A.log('Choose a Wordcry first (Ventures ✦ → Wordcries).', 'warn');
    const n = S().words[id] || 0;
    if (n < 1) return A.log(`You have not yet learned a word of ${d.name}. Study its cry-stone.`, 'warn');
    const wait = (S().last || 0) + d.cd * 1000 * (1 - Math.min(0.25, (A.leyFx && A.leyFx().cryCd) || 0)) - Date.now();
    if (wait > 0) return A.log(`${d.name} is still cooling (${Math.ceil(wait / 1000)}s).`, 'warn');
    const cost = d.prayer[n - 1];
    if ((player.prayerPoints || 0) < cost) return A.log(`You need ${cost} Prayer points for ${d.name}.`, 'warn');
    player.prayerPoints -= cost;
    S().last = Date.now(); S().uses++; S().equipped = id;
    const words = d.words.slice(0, n).join('! ') + '!';
    A.log(`You cry ${d.name}: ${words}`, 'combat');
    const p = A.pos();
    if (ctx.gfxQ() !== 'low' && ctx.burst) ctx.burst('hit', p.x, p.y + 1, p.z, 8 + n * 3);
    const r = 3 + n * 1.5, k = n;
    if (id === 'stormheave') {
      for (const m of ctx.monsters) if (m.alive && m.mesh && A.dist(m.mesh.position.x, m.mesh.position.z) < r) {
        const dx = m.mesh.position.x - p.x, dz = m.mesh.position.z - p.z, len = Math.hypot(dx, dz) || 1;
        m.mesh.position.x += dx / len * (2 + k); m.mesh.position.z += dz / len * (2 + k);
        m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + k);
      }
    } else if (id === 'rimehold') {
      for (const m of ctx.monsters) if (m.alive && m.mesh && A.dist(m.mesh.position.x, m.mesh.position.z) < r) {
        m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + (1 + k));
        m.speed = (m.speed || 4) + k;
        m.nextAttackTick = Math.max(m.nextAttackTick || 0, A.tick() + 1 + k);
      }
    } else if (id === 'windstride') {
      const yaw = ctx.pm.mesh.rotation.y || 0, dist = 3 + k * 2;
      p.x += Math.sin(yaw) * dist; p.z += Math.cos(yaw) * dist;
    } else if (id === 'heartencry') {
      player._cryValorUntil = A.tick() + 8 + k * 4;
      if (player.hp > 0) player.hp = Math.min(player.maxHp, player.hp + Math.max(1, Math.round(player.maxHp * (0.04 * k))));
      A.log('Heartencry steels you and your companion.', 'game');
    }
    if (A.leyKey && A.leyKey('wordecho')) {
      for (const m of ctx.monsters) if (m.alive && m.mesh && A.dist(m.mesh.position.x, m.mesh.position.z) < 6) {
        m.stunUntil = Math.max(m.stunUntil || 0, A.tick() + 2);
        m.nextAttackTick = Math.max(m.nextAttackTick || 0, A.tick() + 2);
      }
      A.log('Word-echo slows those nearby.', 'combat');
    }
    A.dirty(); A.refreshQuick();
    return true;
  };

  ctx.EXT.extIncoming.push(dmg => {
    if (!(dmg > 0) || !player._cryValorUntil || A.tick() >= player._cryValorUntil) return dmg;
    return Math.max(1, dmg - 1);
  });

  A.key('wordcry', () => A.cryUse());
  A.quick(() => (Object.values(S().words).some(n => n > 0) ? [['wordcry', S().equipped ? CRIES[S().equipped].name : 'Wordcry', 'Shout your equipped Wordcry (;)']] : []));
  A.onQuick('wordcry', () => A.cryUse());

  A.guide.push(['Wordcries', 'Study frontier cry-stones to learn three words of a cry (Stormheave, Rimehold, Windstride, Heartencry). Each word makes the cry stronger. Press ; or the Wordcry button to shout; it costs Prayer and a short cooldown, not your Overflare or Attunement.']);
  A.tab({ id: 'cries', icon: '🗣️', name: 'Wordcries', render: () => {
    const s = S();
    const rows = Object.entries(CRIES).map(([id, d]) => {
      const n = s.words[id] || 0;
      const known = d.words.map((w, i) => i < n ? w : '…').join(' · ');
      return `<div style="margin:8px 0"><b>${A.esc(d.name)}</b> <small>${n}/3${s.equipped === id ? ' · equipped' : ''}</small><br><small>${A.esc(d.desc)} Words: ${A.esc(known)}. Cost ${n ? d.prayer[n - 1] : d.prayer[0]} Prayer. Cry-stone at ${d.x}, ${d.z}.</small>
        <div class="row">${n ? `<button data-a="eq" data-b="${id}" style="min-height:36px">${s.equipped === id ? 'Equipped' : 'Equip'}</button><button data-a="use" data-b="${id}" style="min-height:36px">Cry</button>` : '<small>Study the cry-stone to learn the first word.</small>'}</div></div>`;
    }).join('');
    return `<h4>Wordcries · used ${s.uses}</h4><p><small>Three words per cry, learned from frontier cry-stones. Costs Prayer and a short cooldown — not Overflare, not an Attunement super.</small></p>${rows}`; },
    act: (a, d) => { if (a === 'eq') { S().equipped = d.b; A.dirty(); A.refreshQuick(); } if (a === 'use') A.cryUse(d.b); } });

  A.vtests = A.vtests || {};
  A.vtests.wordcries = async (g, A) => {
    const s = S(), old = { words: { ...s.words }, equipped: s.equipped, uses: s.uses, last: s.last, pp: g.player.prayerPoints };
    try {
      // learn 1 then 3
      s.words.stormheave = 0; s.equipped = ''; s.last = 0;
      A.cryLearn('stormheave');
      if (s.words.stormheave !== 1) return 'learn1';
      A.cryLearn('stormheave'); A.cryLearn('stormheave');
      if (s.words.stormheave !== 3) return 'learn3';
      A.cryLearn('stormheave');
      if (s.words.stormheave !== 3) return 'capped';
      g.player.prayerPoints = 40;
      const uses = s.uses;
      const ok = A.cryUse('stormheave');
      if (!ok || s.uses !== uses + 1) return 'use';
      if ((g.player.prayerPoints || 0) >= 40) return 'prayer not spent';
      // Overflare still present
      if (!(A.tabs && A.tabs.some(t => t.id === 'overflare' || t.id === 'flare') || A.flareAdd || A.open)) { /* overflare may use id flare */ }
      const hasFlare = !!(A.tabs && A.tabs.some(t => /flare|overflare/i.test(t.id + t.name)));
      if (!hasFlare) return 'overflare missing';
      return true;
    } finally {
      s.words = old.words; s.equipped = old.equipped; s.uses = old.uses; s.last = old.last; g.player.prayerPoints = old.pp;
    }
  };
}
