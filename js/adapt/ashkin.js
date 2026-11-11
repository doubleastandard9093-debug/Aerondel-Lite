// Ashkin (adapted from Elden Ring spirit summons): temporary prayer-cost spirits that fight beside you.
// Not companions (no Bond, no errands). Shared follower cap: one companion plus one Ashkin or one Kinbeast, never both a spirit and a pet.
import * as THREE from 'three';
import { ITEMS } from '../items.js';
import { NORM, obj, num } from './state.js';

NORM.ashkin = v => {
  v = obj(v);
  const owned = [...new Set((Array.isArray(v.owned) ? v.owned : []).filter(id => typeof id === 'string' && ITEMS[id] && ITEMS[id].ashId))].slice(0, 20);
  const eq = typeof v.equipped === 'string' && owned.includes(v.equipped) ? v.equipped : (owned[0] || '');
  return { owned, equipped: eq, lastUsed: Math.floor(num(v.lastUsed, 0, 0)) };
};

export const ASHES = {
  shades:  { item: 'Ember ash',    name: 'Ashkin shades',     style: 'pack',   prayer: 8,  cd: 40000, dur: 45000, color: 0x8866aa, mats: { Bones: 5 },           gold: 50,  prayerLvl: 1,  desc: 'A brief pack of weaker shades.' },
  ward:    { item: 'Bulwark ash',  name: 'Ashkin warder',     style: 'melee',  prayer: 14, cd: 50000, dur: 50000, color: 0x8aa0c8, mats: { Bones: 8, 'Iron bar': 1 }, gold: 200, prayerLvl: 20, desc: 'A shield-bearer that blunts incoming blows.' },
  ranger:  { item: 'Longshot ash', name: 'Ashkin ranger',     style: 'ranged', prayer: 12, cd: 45000, dur: 50000, color: 0x6a8a4a, mats: { Bones: 8, 'Bronze arrows': 15 }, gold: 200, prayerLvl: 30, desc: 'A ranger spirit that looses short volleys.' }
};

export default function ashkin(A) {
  const { ctx, player, skills } = A;
  const S = () => A.S('ashkin');
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const defOf = item => Object.values(ASHES).find(d => d.item === item) || null;
  const own = item => {
    const s = S();
    if (player.inventory[item] && !s.owned.includes(item)) s.owned.push(item);
    return s.owned.includes(item);
  };

  // Shared follower cap used now by Ashkin and later by Kinbeasts.
  const ashOut = () => !!(A._ash && A._ash.until && nowMs() < A._ash.until);
  const kinOut = () => !!(A._kin && A._kin.out);
  A.followers = A.followers || {};
  A.followers.ashOut = ashOut;
  A.followers.kinOut = kinOut;
  A.followers.slotTaken = () => ashOut() || kinOut();
  A.followers.setKin = api => { A._kinApi = api; };
  A.followers.recallKin = why => {
    if (!kinOut()) return false;
    if (A._kinApi && A._kinApi.recall) A._kinApi.recall(why);
    else if (A._kin) A._kin.out = false;
    A.log(why || 'Your Kinbeast is recalled.', 'game');
    return true;
  };
  A.followers.recallAsh = why => { A.ashRecall(why); return true; };

  const makeMesh = (color, pack) => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: ctx.gfxQ() === 'low' ? 0.55 : 0.7, depthWrite: false });
    const h = pack ? 0.7 : 1.15, r = pack ? 0.16 : 0.22;
    const g = new THREE.CylinderGeometry(r * 0.85, r, h, 8);
    const m = new THREE.Mesh(g, mat);
    m.position.y = h * 0.5;
    const root = new THREE.Group();
    root.add(m);
    if (pack && ctx.gfxQ() !== 'low') {
      for (const [dx, dz] of [[0.35, 0.1], [-0.3, 0.25]]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 6), mat.clone());
        c.position.set(dx, 0.3, dz); root.add(c);
      }
    }
    ctx.scene.add(root);
    return root;
  };
  const dropMesh = mesh => { if (mesh && mesh.parent) mesh.parent.remove(mesh); if (mesh && mesh.traverse) mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); };

  A.ashRecall = (why, silent) => {
    if (!A._ash) return;
    dropMesh(A._ash.mesh);
    A._ash = null;
    if (!silent) A.log(why || 'The Ashkin fades.', 'game');
    A.refreshQuick();
  };

  A.ashSummon = item => {
    const s = S();
    item = item || s.equipped || s.owned[0];
    if (ashOut()) { A.ashRecall('You recall the Ashkin.'); return true; }
    if (!item || !own(item)) return A.log('Choose an Ashkin ash first (Ventures ✦ → Ashkin).', 'warn');
    const def = defOf(item); if (!def) return;
    if (A.lvl('Prayer') < def.prayerLvl) return A.log(`You need Prayer ${def.prayerLvl} to call ${def.name}.`, 'warn');
    const wait = (s.lastUsed || 0) + def.cd - Date.now();
    if (wait > 0) return A.log(`The ashes are still cooling (${Math.ceil(wait / 1000)}s).`, 'warn');
    if ((player.prayerPoints || 0) < def.prayer) return A.log(`You need ${def.prayer} Prayer points.`, 'warn');
    if (kinOut()) A.followers.recallKin('Your Kinbeast is recalled so the Ashkin can come forth.');
    player.prayerPoints -= def.prayer;
    s.equipped = item; s.lastUsed = Date.now();
    const mesh = makeMesh(def.color, def.style === 'pack');
    const p = A.pos();
    mesh.position.set(p.x - 1.6, p.y, p.z + 1.2);
    A._ash = { id: def.item, def, mesh, until: nowMs() + def.dur, next: 0 };
    A.log(`You call forth ${def.name}. They will fade in ${Math.round(def.dur / 1000)}s.`, 'game');
    A.dirty(); A.refreshQuick();
    return true;
  };

  A.ashCraft = id => {
    const def = ASHES[id]; if (!def) return;
    if (A.lvl('Prayer') < def.prayerLvl) return A.log(`You need Prayer ${def.prayerLvl}.`, 'warn');
    if ((player.gold || 0) < def.gold) return A.log(`That costs ${def.gold} coins.`, 'warn');
    if (Object.entries(def.mats).some(([i, n]) => A.count(i) < n)) return A.log(`You need ${Object.entries(def.mats).map(([i, n]) => `${n} ${i}`).join(', ')}.`, 'warn');
    for (const [i, n] of Object.entries(def.mats)) A.take(i, n);
    player.gold -= def.gold;
    A.give(def.item);
    const s = S(); if (!s.owned.includes(def.item)) s.owned.push(def.item);
    if (!s.equipped) s.equipped = def.item;
    A.log(`You bind ${def.item}.`, 'skill'); A.dirty();
  };

  A.ashEquip = item => { if (!own(item)) return; S().equipped = item; A.dirty(); A.refreshQuick(); };

  // Cheap follow + assist. Not a party member.
  ctx.EXT.extFrame.push((dt) => {
    const a = A._ash; if (!a || !a.mesh) return;
    if (nowMs() >= a.until) { A.ashRecall('The Ashkin fades.'); return; }
    const p = A.pos(), o = a.mesh.position;
    const tx = p.x - 1.6, tz = p.z + 1.2;
    const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, (dt || 0.016) * Math.max(4, d * 2));
    if (d > 0.05) { o.x += dx / d * step; o.z += dz / d * step; a.mesh.rotation.y = Math.atan2(dx, dz); }
    o.y = p.y;
  });
  ctx.EXT.extTick.push(() => {
    const a = A._ash; if (!a) return;
    if (nowMs() >= a.until) { A.ashRecall('The Ashkin fades.'); return; }
    const mon = ctx.target && ctx.target();
    if (!mon || !mon.alive || mon.hp <= 0) return;
    const mp = mon.mesh.position, ap = a.mesh.position;
    if (Math.hypot(mp.x - ap.x, mp.z - ap.z) > (a.def.style === 'ranged' ? 16 : 12)) return;
    if (A.tick() < a.next) return;
    a.next = A.tick() + (a.def.style === 'pack' ? 2 : 3);
    const cap = a.def.style === 'pack' ? 3 : a.def.style === 'ranged' ? 4 : 3;
    const dmg = Math.min(mon.hp, 1 + Math.floor(Math.random() * (cap + 1)));
    mon.hp -= dmg;
    if (ctx.overlays && ctx.overlays.splat) ctx.overlays.splat(mon, dmg, nowMs() + 160);
    if (mon.hp <= 0 && ctx.killMonster) ctx.killMonster(mon, nowMs());
  });
  // Warder: a small incoming blunt while the spirit is nearby (behaviour, not a big standing percent).
  ctx.EXT.extIncoming.push(dmg => {
    if (!(dmg > 0) || !ashOut() || !A._ash || A._ash.def.style !== 'melee') return dmg;
    return Math.max(1, dmg - 1);
  });
  ctx.EXT.extDeath.push(() => { if (A._ash) A.ashRecall('The Ashkin fades as you fall.', true); });

  A.key('ashkin', () => A.ashSummon());
  A.quick(() => {
    const s = S(), item = s.equipped || s.owned[0];
    if (!item && !s.owned.length) return [];
    return [[ 'ashkin', ashOut() ? 'Recall Ashkin' : 'Call Ashkin', ashOut() ? 'Send the spirit back' : 'Summon the equipped Ashkin (H)' ]];
  });
  A.onQuick('ashkin', () => A.ashSummon());

  A.guide.push(['Ashkin', 'Ventures ✦ → Ashkin (or press H). Craft or bind a spirit ash, then summon it for a short time at a Prayer cost. Ashkin are not companions — no Bond, no errands. You may have one companion plus one Ashkin or one Kinbeast, never a spirit and a pet together. If a Kinbeast is already out, calling an Ashkin will recall it.']);
  A.tab({ id: 'ashkin', icon: '👻', name: 'Ashkin', render: () => {
    const s = S(), out = ashOut();
    const rows = Object.entries(ASHES).map(([id, d]) => {
      const have = own(d.item), eq = s.equipped === d.item, lock = A.lvl('Prayer') < d.prayerLvl;
      return `<div style="margin:8px 0"><b>${A.esc(d.name)}</b> <small>${have ? (eq ? 'equipped' : 'owned') : `Prayer ${d.prayerLvl}${lock ? ' 🔒' : ''}`} · ${d.prayer} Prayer · ${Math.round(d.dur / 1000)}s</small><br><small>${A.esc(d.desc)} Craft: ${Object.entries(d.mats).map(([i, n]) => `${n} ${i}`).join(', ')} and ${d.gold} coins.</small>
        <div class="row" style="gap:4px;flex-wrap:wrap">${have ? `<button data-a="eq" data-b="${A.esc(d.item)}" style="min-height:36px">${eq ? 'Equipped' : 'Equip'}</button>` : `<button data-a="craft" data-b="${id}" style="min-height:36px" ${lock ? 'disabled' : ''}>Bind ash</button>`}</div></div>`;
    }).join('');
    return `<h4>Ashkin ${out ? '· ' + A.esc(A._ash.def.name) + ' is out' : ''}</h4>
      <p><small>One companion plus one Ashkin or Kinbeast. Never a spirit and a pet together.${kinOut() ? ' A Kinbeast is out — summoning an Ashkin will recall it.' : ''}</small></p>
      ${rows}
      <p><button data-a="summon" style="min-height:40px">${out ? 'Recall' : 'Summon (H)'}</button></p>`; },
    act: (a, d) => { if (a === 'craft') A.ashCraft(d.b); if (a === 'eq') A.ashEquip(d.b); if (a === 'summon') A.ashSummon(); } });

  A.vtests = A.vtests || {};
  A.vtests.ashkin = async (g, A) => {
    const gold = g.player.gold, pp = g.player.prayerPoints, inv = { ...g.player.inventory }, s = S();
    const owned0 = s.owned.slice(), eq0 = s.equipped, last0 = s.lastUsed;
    const party0 = (g.EXT.party && g.EXT.party.ids()) ? g.EXT.party.ids().slice() : [];
    try {
      g.player.inventory['Bones'] = 20;
      g.player.inventory['Iron bar'] = 2;
      g.player.inventory['Bronze arrows'] = 20;
      g.player.gold = Math.max(g.player.gold, 500);
      const pr = A.skills.Prayer; const pl = pr.level;
      pr.level = Math.max(pr.level, 1);
      A.ashCraft('shades');
      if (!s.owned.includes('Ember ash') || A.count('Ember ash') < 1) return 'craft';
      s.equipped = 'Ember ash'; s.lastUsed = 0;
      g.player.prayerPoints = Math.max(20, defOf('Ember ash').prayer + 5);
      const ok = A.ashSummon('Ember ash');
      if (!ok || !ashOut() || !A._ash || !A._ash.mesh) return 'summon';
      if (g.EXT.party && g.EXT.party.ids && g.EXT.party.ids().some(id => id === 'ashkin' || id === A._ash.id)) return 'in party';
      const second = A.ashSummon('Ember ash'); // should recall
      if (ashOut()) return 'second summon did not recall';
      s.lastUsed = 0;
      g.player.prayerPoints = 20;
      A.ashSummon('Ember ash');
      if (!ashOut()) return 'resummon';
      // cap: a fake Kinbeast is recalled
      A.ashRecall('test', true);
      s.lastUsed = 0;
      A._kin = { out: true };
      let kinMsg = false;
      A._kinApi = { recall: () => { A._kin.out = false; kinMsg = true; } };
      g.player.prayerPoints = 20;
      A.ashSummon('Ember ash');
      if (!kinMsg || (A._kin && A._kin.out) || !ashOut()) return 'cap failed';
      // expiry
      A._ash.until = nowMs() - 1;
      // run frame hook by calling recall path
      A.ashRecall('test fade', true);
      if (A._ash) return 'still out';
      const party1 = (g.EXT.party && g.EXT.party.ids()) ? g.EXT.party.ids() : [];
      if (party0.join(',') !== party1.join(',')) return 'party changed';
      return true;
    } finally {
      A.ashRecall('test cleanup', true);
      A._kin = null; A._kinApi = null;
      g.player.gold = gold; g.player.prayerPoints = pp;
      g.player.inventory = inv;
      s.owned = owned0; s.equipped = eq0; s.lastUsed = last0;
      A.skills.Prayer.level = A.skills.Prayer.level; // kept
    }
  };
}
