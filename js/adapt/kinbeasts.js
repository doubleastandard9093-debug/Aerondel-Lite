// Kinbeasts (adapted from Pokémon): catchable, trainable pets that fight beside you. Hunter gates the catch and the training. One Kinbeast or one Ashkin, never both.
import * as THREE from 'three';
import { perk } from '../skills.js';
import { ITEMS } from '../items.js';
import { NORM, obj, arr, num, str } from './state.js';

export const SPECIES = {
  wolf:   { id: 'wolf',   name: 'Wolf',            type: 'Wolf',            hun: 1,  vessel: 1, color: 0x7a7a80, moves: [{ id: 'snap', name: 'Snap', desc: 'A quick nip at the current foe.' }, { id: 'pin', name: 'Pin', desc: 'Briefly holds a foe in place.' }] },
  spider: { id: 'spider', name: 'Giant Spider',    type: 'Giant Spider',    hun: 15, vessel: 1, color: 0x2a2a2a, moves: [{ id: 'snap', name: 'Bite', desc: 'A sharp bite.' }, { id: 'pin', name: 'Web', desc: 'A brief bind.' }] },
  fen:    { id: 'fen',    name: 'Fen Crawler',     type: 'Fen Crawler',     hun: 30, vessel: 2, color: 0x3a4a2a, moves: [{ id: 'snap', name: 'Lunge', desc: 'A wet lunge.' }, { id: 'pin', name: 'Latch', desc: 'Holds on a moment.' }] },
  raider: { id: 'raider', name: 'Ashen raider',    type: 'Ashen raider',    hun: 40, vessel: 2, color: 0x3a3a3a, moves: [{ id: 'snap', name: 'Cut', desc: 'A short cut.' }, { id: 'pin', name: 'Shove', desc: 'A brief stagger.' }] },
  reaver: { id: 'reaver', name: 'Sand Reaver',     type: 'Sand Reaver',     hun: 55, vessel: 2, color: 0x8a6a3a, moves: [{ id: 'snap', name: 'Claw', desc: 'A sandy rake.' }, { id: 'pin', name: 'Dust', desc: 'A brief bind in grit.' }] },
  rime:   { id: 'rime',   name: 'Rime Wraith',     type: 'Rime Wraith',     hun: 70, vessel: 3, color: 0xa8d0e8, moves: [{ id: 'snap', name: 'Chill', desc: 'A cold touch.' }, { id: 'pin', name: 'Frost', desc: 'A short freeze.' }] },
  voidk:  { id: 'voidk',  name: 'Voidborn Knight', type: 'Voidborn Knight', hun: 90, vessel: 3, color: 0x2a1a4a, moves: [{ id: 'snap', name: 'Edge', desc: 'A void-touched cut.' }, { id: 'pin', name: 'Bind', desc: 'A brief hold.' }] }
};
export const VESSELS = {
  'Bind vessel':   { tier: 1, power: 1,    hun: 1,  desc: 'A simple vessel for common beasts.' },
  'Sturdy vessel': { tier: 2, power: 1.45, hun: 30, desc: 'A firmer vessel for harder hunts.' },
  'Fine vessel':   { tier: 3, power: 1.9,  hun: 75, desc: 'A fine vessel for rare frontier beasts.' }
};
const needFor =  (lv) => 40 + lv * 14;
const byType = type => Object.values(SPECIES).find(s => s.type === type || s.name === type);

NORM.kin = v => {
  v = obj(v);
  const roster = [];
  for (const r of arr(v.roster).slice(0, 40)) {
    const sp = SPECIES[r && r.species]; if (!sp) continue;
    const id = typeof r.id === 'string' && /^k\d+$/.test(r.id) ? r.id : ('k' + (roster.length + 1));
    const level = Math.max(1, Math.min(1000, Math.floor(num(r.level, 1, 1))));
    roster.push({ id, species: sp.id, name: (typeof r.name === 'string' && r.name.trim().slice(0, 18)) || sp.name, level, xp: Math.max(0, Math.floor(num(r.xp, 0, 0))), loyalty: Math.max(0, Math.min(100, Math.floor(num(r.loyalty, 20, 0)))), hp: Math.max(0, Math.floor(num(r.hp, 10 + level * 4, 0))), faintUntil: Math.max(0, Math.floor(num(r.faintUntil, 0, 0))) });
  }
  const seen = [...new Set(arr(v.seen).filter(id => SPECIES[id]))];
  const active = roster.some(r => r.id === v.active) ? v.active : (roster[0] ? roster[0].id : null);
  return { roster, seen, active, nextId: Math.max(roster.reduce((n, r) => Math.max(n, parseInt(r.id.slice(1), 10) || 0), 0) + 1, Math.floor(num(v.nextId, 1, 1))), swapAt: 0 };
};

export default function kinbeasts(A) {
  const { ctx, player, skills } = A;
  const K = () => A.S('kin');
  const rec = id => K().roster.find(r => r.id === id);
  const maxHp = r => 10 + r.level * 4;
  const kennelMul = () => {
    const lv = (A.S('hold') && A.S('hold').lv && A.S('hold').lv.kennel) || 0;
    const home = (A.holdHome && A.holdHome()) || (A.greenHome && A.greenHome());
    return 1 + (home ? 0.15 : 0) + lv * 0.25;
  };
  const dropMesh = mesh => { if (mesh && mesh.parent) mesh.parent.remove(mesh); if (mesh && mesh.traverse) mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); };
  const makeMesh = color => {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: ctx.gfxQ && ctx.gfxQ() === 'low' ? 0.85 : 1 });
    const root = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat); body.position.y = 0.38; body.scale.set(1, 0.8, 1.15); root.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat); head.position.set(0, 0.68, 0.12); root.add(head);
    ctx.scene.add(root); return root;
  };

  const inFight = () => (player._inFight || 0) > 0;
  A.kinRecall = (why, silent) => {
    const k = A._kin; if (!k || !k.out) return false;
    if (k.mesh) dropMesh(k.mesh);
    if (k.rec) k.rec.hp = Math.max(0, Math.round(k.hp || k.rec.hp || 0));
    k.out = false; if (k.rec) k.rec.out = false;
    A._kin = { out: false };
    if (!silent) A.log(why || 'You recall your Kinbeast.', 'game');
    A.refreshQuick && A.refreshQuick(); A.dirty(); return true;
  };
  if (A.followers && A.followers.setKin) A.followers.setKin({ recall: why => A.kinRecall(why) });

  const catchChance = (mon, vessel) => {
    const sp = byType(mon.name || mon.type); if (!sp) return 0;
    const hpR = mon.maxHp ? mon.hp / mon.maxHp : 1;
    if (hpR > 0.35) return 0;
    const hun = A.lvl('Hunter');
    if (hun < sp.hun) return 0;
    const v = VESSELS[vessel]; if (!v || v.tier < sp.vessel) return 0;
    const low = hpR <= 0.2 ? 1.2 : 1;
    const skill = 0.5 + Math.min(0.5, hun / 200);
    const perkB = 1 + (perk(skills, 'Hunter', 'catchChance') || 0);
    const ev = 1 - Math.min(0.45, (mon.level || sp.hun) / 900);
    return Math.min(0.92, 0.22 * v.power * skill * perkB * low * ev);
  };
  A.kinChance = (mon, vessel) => catchChance(mon, vessel);
  A.kinCan = mon => {
    if (!mon || !mon.alive || mon.hp <= 0) return null;
    const sp = byType(mon.name || mon.type); if (!sp) return null;
    if (A.lvl('Hunter') < sp.hun) return null;
    if ((mon.maxHp ? mon.hp / mon.maxHp : 1) > 0.35) return null;
    const vessel = Object.keys(VESSELS).find(n => A.count(n) && VESSELS[n].tier >= sp.vessel);
    return vessel || null;
  };

  A.kinThrow = (mon, opts = {}) => {
    const vessel = opts.vessel || A.kinCan(mon);
    if (!mon || !mon.alive) return A.log('There is nothing to bind.', 'warn'), false;
    const sp = byType(mon.name || mon.type);
    if (!sp) return A.log('This creature cannot be bound.', 'warn'), false;
    if (A.lvl('Hunter') < sp.hun) return A.log(`You need Hunter ${sp.hun} to bind a ${sp.name}.`, 'warn'), false;
    if (!vessel || !A.count(vessel)) return A.log('You need a vessel of this height. Craft one, or buy one from Beastbinder Cal.', 'warn'), false;
    if (VESSELS[vessel].tier < sp.vessel) return A.log(`A ${sp.name} needs a stronger vessel.`, 'warn'), false;
    if ((mon.maxHp ? mon.hp / mon.maxHp : 1) > 0.35 && !opts.sure) return A.log('Weaken it first. A Kinbeast is bound when it is low, not at full strength.', 'warn'), false;
    const chance = opts.sure ? 1 : catchChance(mon, vessel);
    A.take(vessel, 1);
    const k = K(); if (!k.seen.includes(sp.id)) k.seen.push(sp.id);
    if (Math.random() > chance) {
      ctx.giveXP('Hunter', 8 + Math.floor(sp.hun / 5));
      A.log(`The ${sp.name} shrugs off the ${vessel}.`, 'warn'); A.dirty(); return false;
    }
    mon.alive = false; mon.state = 'dead'; mon.hp = 0;
    const id = 'k' + k.nextId++;
    const row = { id, species: sp.id, name: sp.name, level: 1, xp: 0, loyalty: 20, hp: maxHp({ level: 1 }), faintUntil: 0 };
    k.roster.push(row); if (!k.active) k.active = id;
    ctx.giveXP('Hunter', 28 + sp.hun);
    A.log(`You bind a ${sp.name}. It is yours to train. (+Hunter)`, 'skill'); A.dirty(); A.refreshQuick && A.refreshQuick();
    return id;
  };

  A.kinSend = id => {
    const r = rec(id || K().active); if (!r) return A.log('Choose a Kinbeast first.', 'warn'), false;
    if (A._kin && A._kin.out && A._kin.id === r.id) return A.kinRecall('You recall your Kinbeast.');
    if (A._kin && A._kin.out) A.kinRecall('You recall the Kinbeast that was out.');
    if (Date.now() < (K().swapAt || 0) && inFight()) return A.log('You can only swap out of a fight, or after a short wait.', 'warn'), false;
    if (r.faintUntil && Date.now() < r.faintUntil) return A.log(`${r.name} is still gathering itself.`, 'warn'), false;
    if (A.followers && A.followers.ashOut && A.followers.ashOut()) A.followers.recallAsh('The Ashkin fades so your Kinbeast can come forth.');
    r.hp = r.hp > 0 ? r.hp : maxHp(r);
    const sp = SPECIES[r.species];
    const mesh = makeMesh(sp.color);
    const p = A.pos(); mesh.position.set(p.x + 1.5, p.y, p.z - 1.1);
    A._kin = { out: true, id: r.id, rec: r, mesh, hp: r.hp, next: 0 };
    K().active = r.id; K().swapAt = Date.now() + 15000;
    A.log(`${r.name} comes to your side.`, 'game'); A.dirty(); A.refreshQuick && A.refreshQuick(); return true;
  };

  A.kinFeed = id => {
    const r = rec(id || (A._kin && A._kin.out && A._kin.id) || K().active); if (!r) return false;
    const name = Object.keys(player.inventory || {}).find(i => ITEMS[i] && ITEMS[i].type === 'food' && player.inventory[i] > 0);
    if (!name || !A.take(name, 1)) return A.log('You have no food to offer.', 'warn'), false;
    const gain = Math.round((6 + Math.floor(r.level / 20)) * (1 + (perk(skills, 'Hunter', 'kinXp') || 0)) * kennelMul());
    r.xp += gain; r.loyalty = Math.min(100, r.loyalty + 4);
    r.hp = Math.min(maxHp(r), r.hp + Math.max(2, Math.round(maxHp(r) * 0.15)));
    if (A._kin && A._kin.id === r.id) A._kin.hp = r.hp;
    let up = 0; while (r.level < 1000 && r.xp >= needFor(r.level)) { r.xp -= needFor(r.level); r.level++; r.hp = maxHp(r); up++; }
    ctx.giveXP('Hunter', 6 + Math.floor(gain / 3));
    A.log(up ? `${r.name} grows to level ${r.level}.` : `You tend ${r.name}.`, 'skill'); A.dirty(); return true;
  };
  A.kinName = (id, name) => { const r = rec(id); if (!r || !name) return false; r.name = String(name).trim().slice(0, 18) || r.name; A.dirty(); return true; };

  ctx.EXT.extFrame.push((dt, now) => {
    const k = A._kin; if (!k || !k.out || !k.mesh) return;
    const r = k.rec; if (!r) return A.kinRecall('Your Kinbeast is gone.');
    if (k.hp <= 0) { r.faintUntil = Date.now() + 20000; r.hp = 0; return A.kinRecall(`${r.name} faints and returns to you.`); }
    const p = A.pos(), o = k.mesh.position, tx = p.x + 1.5, tz = p.z - 1.1;
    const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, (dt || 0.016) * Math.max(3.5, d * 2));
    if (d > 0.05) { o.x += dx / d * step; o.z += dz / d * step; k.mesh.rotation.y = Math.atan2(dx, dz); }
    // Slow training while out.
    k._acc = (k._acc || 0) + (dt || 0.016) * kennelMul();
    if (k._acc > 8) { k._acc = 0; r.xp += Math.round(1 + (perk(skills, 'Hunter', 'kinXp') || 0) * 4); if (r.level < 1000 && r.xp >= needFor(r.level)) { r.xp -= needFor(r.level); r.level++; r.hp = maxHp(r); k.hp = r.hp; A.log(`${r.name} grows to level ${r.level}.`, 'skill'); } }
    const t = ctx.target && ctx.target();
    if (!t || !t.alive || t.hp <= 0) return;
    const ready = (now || performance.now());
    if (ready < (k.next || 0)) return;
    if (Math.random() > 0.4 + r.loyalty / 200) { k.next = ready + 900; return; }
    k.next = ready + 1100;
    const pin = Math.random() < 0.35;
    if (ctx.strike) ctx.strike(t, { acc: 0.2, dmg: -0.35 }, ready, { quiet: true });
    if (pin && !(A.isBossy && A.isBossy(t))) t.stunUntil = Math.max(t.stunUntil || 0, A.tick() + 2);
  });
  // A little of incoming damage can land on the pet instead — behaviour, not a big player shield.
  ctx.EXT.extIncoming.push(d => {
    const k = A._kin; if (!k || !k.out || d <= 0) return d;
    if (Math.random() < 0.25) { const soak = Math.min(k.hp, Math.max(1, Math.round(d * 0.25))); k.hp -= soak; if (k.rec) k.rec.hp = k.hp; return d - soak; }
    return d;
  });

  A.npc('kinbeasts', '🐾', 'Beastbinder Cal', 'Weaken a wild creature and bind it with a vessel. Hunter decides the catch and how fast they train. One Kinbeast or one Ashkin at your side — never both. Companions stay as they are.', 'kin');
  A.guide.push(['Kinbeasts', 'Ventures ✦ → Kinbeasts, or talk to Beastbinder Cal in Larkhaven. Weaken a catchable wild creature (Wolf, Giant Spider, and later frontier beasts) below a third of its health and throw a vessel. Catch chance, vessel tier and training speed follow Hunter (Beastwise at 75 helps). Feed them, tend them at Greenstead or the Hearthhold kennel, and send one out to fight with a very small move set. Swap out of combat or after a short wait. One companion plus one Kinbeast or one Ashkin, never a spirit and a pet together. The pet\'s own level can climb toward 1000.']);
  A.quick(() => {
    const t = ctx.target && ctx.target(), v = t && A.kinCan(t);
    const out = [];
    if (v) out.push(['kincatch', 'Bind Kinbeast', 'Throw a vessel at this weakened foe']);
    if (K().roster.length) out.push(['kin', A._kin && A._kin.out ? 'Recall Kinbeast' : 'Call Kinbeast', A._kin && A._kin.out ? 'Send your pet back' : 'Send your active Kinbeast out']);
    return out;
  });
  A.onQuick('kincatch', () => { const t = ctx.target && ctx.target(); if (t) A.kinThrow(t); });
  A.onQuick('kin', () => { if (A._kin && A._kin.out) A.kinRecall(); else A.kinSend(K().active); });
  A.key && A.key('kinbeast', () => { if (A._kin && A._kin.out) A.kinRecall(); else A.kinSend(K().active); });
  A.tab({ id: 'kin', icon: '🐾', name: 'Kinbeasts', render: () => {
    const k = K(), cur = rec(k.active), out = A._kin && A._kin.out;
    const t = ctx.target && ctx.target(), vessel = t && A.kinCan(t);
    const roster = k.roster.map(r => {
      const sp = SPECIES[r.species], on = r.id === k.active;
      return `<div style="margin:6px 0"><b>${A.esc(r.name)}</b> <small>${sp.name} · lv ${r.level} · loyalty ${r.loyalty}${on ? ' · active' : ''}${out && A._kin.id === r.id ? ' · out' : ''}</small>
        <div class="row" style="flex-wrap:wrap;gap:4px"><button data-a="eq" data-i="${r.id}" style="min-height:36px">${on ? 'Active' : 'Set active'}</button>
        <button data-a="send" data-i="${r.id}" style="min-height:36px">${out && A._kin.id === r.id ? 'Recall' : 'Send out'}</button>
        <button data-a="feed" data-i="${r.id}" style="min-height:36px">Feed</button></div></div>`;
    }).join('') || '<p><small>None bound yet. Weaken a catchable creature and throw a vessel.</small></p>';
    const seen = k.seen.length ? k.seen.map(id => SPECIES[id].name).join(', ') : 'none yet';
    const catchRow = vessel ? `<div class="row"><button data-a="throw" style="min-height:52px;font-size:16px">Bind this ${A.esc(t.name)} (${Math.round(A.kinChance(t, vessel) * 100)}% with ${A.esc(vessel)})</button></div>` : '<p><small>Target a weakened catchable creature (below a third of its health) while you hold a vessel.</small></p>';
    return `<h4>Kinbeasts · Hunter ${A.lvl('Hunter')}</h4>
      <p>Bind a weakened wild creature with a vessel and train it. One Kinbeast or one Ashkin may be out — never both. A companion can still walk with you.</p>
      ${catchRow}${roster}
      <p><small>Seen in the field: ${A.esc(seen)}. Vessels: ${Object.keys(VESSELS).map(n => `${n} ×${A.count(n)}`).join(' · ') || 'none'}. The Hearthhold kennel and Greenstead care speed training a little.</small></p>`;
  }, act: (a, d) => { if (a === 'eq') { K().active = d.i; A.dirty(); } if (a === 'send') A.kinSend(d.i); if (a === 'feed') A.kinFeed(d.i); if (a === 'throw') { const t = ctx.target && ctx.target(); if (t) A.kinThrow(t); } } });

  A.vtests = A.vtests || {};
  A.vtests.kinbeasts = async (g, A) => {
    const k = K(), prev = JSON.parse(JSON.stringify(k)), gold = g.player.gold, inv = { ...g.player.inventory };
    const hun = { level: g.skills.Hunter.level, xp: g.skills.Hunter.xp };
    const ashWas = !!(A._ash);
    try {
      g.skills.Hunter.level = Math.max(g.skills.Hunter.level, 1);
      g.player.inventory['Bind vessel'] = (g.player.inventory['Bind vessel'] || 0) + 3;
      g.player.inventory['Potato'] = (g.player.inventory['Potato'] || 0) + 4;
      const mon = { name: 'Wolf', type: 'Wolf', alive: true, state: 'alive', hp: 20, maxHp: 140, level: 14 };
      if (!A.kinCan(mon)) return 'not catchable when low';
      mon.hp = mon.maxHp; if (A.kinCan(mon)) return 'catchable at full health';
      mon.hp = 20;
      const ch = A.kinChance(mon, 'Bind vessel'); if (!(ch > 0 && ch <= 0.92)) return 'chance ' + ch;
      const id = A.kinThrow(mon, { sure: true, vessel: 'Bind vessel' });
      if (!id || !rec(id) || mon.alive) return 'catch';
      if (!(g.skills.Hunter.level > hun.level || g.skills.Hunter.xp > hun.xp)) return 'no hunter xp';
      if (!k.seen.includes('wolf')) return 'not seen';
      const r0 = rec(id), lv0 = r0.level, xp0 = r0.xp, loy0 = r0.loyalty;
      if (!A.kinFeed(id)) return 'feed';
      if (!(rec(id).xp > xp0 || rec(id).level > lv0) || rec(id).loyalty <= loy0) return 'no train';
      if (!A.kinSend(id)) return 'send';
      if (!(A._kin && A._kin.out && A._kin.mesh)) return 'not out';
      if (A.followers && A.followers.kinOut && !A.followers.kinOut()) return 'cap kinOut';
      // Companion may still be active — we do not touch party.
      const party0 = (g.EXT.party && g.EXT.party.ids && g.EXT.party.ids()) || [];
      // Faint and recall.
      A._kin.hp = 0; A.kinRecall(`${rec(id).name} faints and returns to you.`);
      if (A._kin && A._kin.out) return 'still out after faint';
      rec(id).faintUntil = 0; rec(id).hp = maxHp(rec(id));
      if (!A.kinSend(id)) return 'resend';
      // Ashkin summon should recall the Kinbeast.
      const sAsh = A.S('ashkin');
      const owned0 = (sAsh.owned || []).slice(), eq0 = sAsh.equipped, last0 = sAsh.lastUsed, pp = g.player.prayerPoints;
      g.player.inventory['Bones'] = (g.player.inventory['Bones'] || 0) + 20;
      g.player.gold = Math.max(g.player.gold, 500);
      if (A.ashCraft) A.ashCraft('shades');
      if (sAsh.owned && sAsh.owned.includes('Ember ash')) {
        sAsh.equipped = 'Ember ash'; sAsh.lastUsed = 0;
        g.player.prayerPoints = Math.max(20, 12);
        const ok = A.ashSummon && A.ashSummon('Ember ash');
        if (!ok) return 'ash summon failed';
        if (A._kin && A._kin.out) return 'ash did not recall kin';
        if (!(A._ash)) return 'ash not out';
        A.ashRecall && A.ashRecall('test', true);
      }
      sAsh.owned = owned0; sAsh.equipped = eq0; sAsh.lastUsed = last0; g.player.prayerPoints = pp;
      const party1 = (g.EXT.party && g.EXT.party.ids && g.EXT.party.ids()) || [];
      if (party0.join(',') !== party1.join(',')) return 'party changed';
      A.kinRecall('cleanup', true);
      return true;
    } finally {
      A.kinRecall('cleanup', true);
      Object.keys(k).forEach(n => delete k[n]); Object.assign(k, prev);
      g.player.gold = gold; g.player.inventory = inv;
      g.skills.Hunter.level = hun.level; g.skills.Hunter.xp = hun.xp;
      if (!ashWas && A._ash && A.ashRecall) A.ashRecall('cleanup', true);
    }
  };
}
