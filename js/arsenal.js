// Arsenal (v22): high-level combat techniques, the Swordsmanship skill and weapon-class styles.
// main.js calls arsenalSwing() from its swing hook and arsenalXp() after each melee hit.
import { ITEMS } from './items.js';
import { perk } from './skills.js';

// Blade weapons train Swordsmanship: swords, longswords, daggers, cutlasses and the v22 classes.
export const BLADE_RE = /sword|blade|dagger|cutlass|katana|scimitar|glaive|odachi|tachi/i;
export function weaponClass(name) {
  const it = name && ITEMS[name];
  if (!it) return null;
  if (it.wclass) return it.wclass;
  if (it.cutlass) return 'cutlass';
  return BLADE_RE.test(name) ? 'blade' : null;
}
export const isBlade = name => { const c = weaponClass(name); return !!c && c !== 'warfan' && c !== 'chakram'; };

// Techniques: [id] -> how they change this attack's swings. ctx = { mon, tick, cls, log }
const TECH = {
  iaido: (sw, c) => { sw[0].dmg += c.cls === 'katana' ? 2.5 : 1.5; sw[0].acc += 0.4; },
  crescent: (sw, c) => { sw[0].dmg += 0.2; const n = c.cls === 'scimitar' ? 2 : 1; for (let i = 0; i < n; i++) sw.push({ ...sw[0], extra: true }); },
  whirl: (sw, c) => { sw[0].dmg -= 0.1; const n = c.cls === 'glaive' ? 4 : 3; for (let i = 0; i < n; i++) sw.push({ ...sw[0], extra: true }); },
  gale: (sw, c) => { sw[0].acc += 0.3; c.mon.stunUntil = c.tick + (c.cls === 'warfan' ? 8 : 5); c.log(`A gale pins the ${c.mon.name} in place!`); },
  ricochet: (sw, c) => { const bonus = c.cls === 'chakram' ? 0.4 : 0.25; sw.push({ ...sw[0], dmg: sw[0].dmg + bonus, extra: true }, { ...sw[0], dmg: sw[0].dmg + bonus * 2, extra: true }); },
  starfall: (sw, c) => { sw[0].dmg += 0.3; for (let i = 0; i < 3; i++) if (!c.useArrow || c.useArrow()) sw.push({ ...sw[0], extra: true }); }, // each extra shot uses ammo
  eclipse: (sw, c) => { sw[0].dmg += c.mon.hp < c.mon.maxHp * 0.15 ? 9 : 4; sw[0].acc += 0.5; },
  thousand: (sw) => { sw[0].dmg += 0.1; sw[0].acc += 0.2; for (let i = 0; i < 5; i++) sw.push({ ...sw[0], extra: true }); }
};

// Weapon-class passives on every attack.
const CLASS = {
  katana: (sw, c, st) => { if (st.mon !== c.mon) { st.mon = c.mon; st.n = 0; sw[0].dmg += 0.4; c.log('Iaido opening!'); } st.n++; },
  scimitar: (sw, c, st) => { st.n = st.mon === c.mon ? st.n + 1 : 1; st.mon = c.mon; if (st.n % 4 === 0) { sw.push({ ...sw[0], dmg: sw[0].dmg - 0.2, extra: true }); c.log('Scimitar flourish!'); } },
  glaive: (sw, c) => { if (Math.random() < 0.2) { sw.push({ ...sw[0], dmg: sw[0].dmg - 0.3, extra: true }); c.log('Glaive sweep!'); } },
  warfan: (sw, c) => { c.gain && c.gain(3); if (Math.random() < 0.1) { c.mon.stunUntil = c.tick + 3; c.log('A gust staggers the foe!'); } },
  chakram: (sw, c) => { if (Math.random() < 0.25) { sw.push({ ...sw[0], dmg: sw[0].dmg - 0.2, extra: true }); c.log('The chakram returns for another cut!'); } }
};
const state = {};

export function arsenalSwing(player, skills, mon, swings, ranged, special, ctx) {
  if (!swings.length) return;
  for (const s of swings) { s.acc = s.acc || 0; s.dmg = s.dmg || 0; }
  const w = player.equipment && player.equipment.weapon;
  const cls = weaponClass(w);
  const c = { mon, tick: ctx.tick, cls, log: m => ctx.log(m, 'combat'), gain: ctx.gain, useArrow: ctx.useArrow };
  if (special && TECH[special]) TECH[special](swings, c);
  if (!ranged && cls && CLASS[cls]) CLASS[cls](swings, c, state[cls] || (state[cls] = { n: 0 }));
  if (!ranged && isBlade(w)) {
    const a = perk(skills, 'Swordsmanship', 'bladeAcc'), d = perk(skills, 'Swordsmanship', 'bladeDmg');
    if (a || d) for (const s of swings) { s.acc += a; s.dmg += d; }
  }
}
// Swordsmanship XP: a share of melee damage dealt with a blade.
export function arsenalXp(player, dmg, ranged) {
  return !ranged && dmg > 0 && isBlade(player.equipment && player.equipment.weapon) ? dmg * 0.6 : 0;
}
