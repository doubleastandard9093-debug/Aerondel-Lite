// High-power gear above Emberite, earned from Relicry (restoration and collections) and Delving (bosses, token shop).
// Every piece needs the source skill plus a combat stat. New passive keys are handled here through the EXT hooks:
//   burn  {chance, dmg}  melee: set the target ablaze (damage over time)
//   frost chance         magic: freeze the target in place for 3 seconds
//   chain chance         magic: the bolt arcs to another foe within 6 tiles for 50% damage
//   echo  chance         ranged: loose a free extra arrow at 60% power
//   pierce pct           ranged: bonus damage while the target is above half health
//   dr    pct            any: reduce incoming damage (stacks across pieces, capped at 20%)
// Existing keys (lifesteal, reflect, crit, dmgPct) are handled by gameplay.js already.
import * as THREE from 'three';
import { ITEMS } from './items.js';

export const G = (name, o) => { ITEMS[name] = { value: 1, unique: true, highTier: true, ...o }; };

// ---- Relicry gear ----
export const RELIC_GEAR = [
  ['Sunforged khopesh', { type: 'weapon', atk: 66, str: 62, speed: 4, rarity: 'legendary', glow: 0xffa040, eff: { burn: { chance: 0.25, dmg: 12 } }, special: 'Solar Brand: 25% chance to set the target ablaze (12 damage a tick, 6 ticks)', req: { Attack: 70, Relicry: 60 }, value: 260000 }],
  ['Skyreach warbow', { type: 'weapon', ranged: 78, speed: 4, rarity: 'legendary', glow: 0x9ad8ff, eff: { echo: 0.2 }, special: 'Gale Echo: 20% chance to loose a free second arrow at 60% power', req: { Ranged: 70, Relicry: 55 }, value: 240000 }],
  ['Drowned reliquary staff', { type: 'weapon', atk: 10, str: 6, mag: 26, speed: 5, rarity: 'legendary', glow: 0x60e0c0, eff: { frost: 0.15 }, special: 'Tidelock: 15% chance for spells to freeze the target for 3 seconds', req: { Magic: 70, Relicry: 50 }, value: 240000 }],
  ["Barrow-king's helm", { type: 'head', def: 34, rdef: 30, rarity: 'epic', glow: 0xbfe8ff, eff: { dr: 0.02 }, special: 'Rime Ward: take 2% less damage', req: { Defence: 70, Relicry: 40 }, value: 90000 }],
  ["Barrow-king's cuirass", { type: 'body', def: 80, rdef: 66, rarity: 'legendary', glow: 0xbfe8ff, eff: { dr: 0.04 }, special: 'Rime Ward: take 4% less damage', req: { Defence: 70, Relicry: 65 }, value: 220000 }],
  ["Barrow-king's greaves", { type: 'legs', def: 60, rdef: 50, rarity: 'epic', glow: 0xbfe8ff, eff: { dr: 0.03 }, special: 'Rime Ward: take 3% less damage', req: { Defence: 70, Relicry: 60 }, value: 150000 }],
  ['Sun-disc ward', { type: 'shield', def: 62, rdef: 56, rarity: 'epic', glow: 0xffd860, eff: { reflect: 0.1 }, special: 'Blinding Rebuke: reflects 10% of melee damage taken', req: { Defence: 70, Relicry: 55 }, value: 160000 }],
  ['Ziggurat scale body', { type: 'body', def: 44, rdef: 74, ranged: 14, rarity: 'epic', glow: 0x60d070, eff: { pierce: 0.1 }, special: 'Hunter\'s Glyph: +10% ranged damage while the target is above half health', req: { Ranged: 65, Relicry: 50 }, value: 150000 }],
  ['Mirage silk robe', { type: 'body', def: 30, rdef: 30, mag: 20, rarity: 'epic', glow: 0xffc890, eff: { dr: 0.02, chain: 0.08 }, special: 'Heat Haze: take 2% less damage; 8% chance for spells to arc to a second foe', req: { Magic: 65, Relicry: 45 }, value: 140000 }]
];
RELIC_GEAR.forEach(([n, o]) => G(n, { ...o, source: 'Relicry' }));

function sumEff(player) {
  const o = { dr: 0, echo: 0, pierce: 0, frost: 0, chain: 0, burn: null, glow: 0 };
  for (const slot of ['weapon', 'body', 'shield', 'head', 'legs', 'ring']) {
    const it = player.equipment && player.equipment[slot], I = it && ITEMS[it]; if (!I || !I.highTier) continue;
    const e = I.eff || {};
    for (const k of ['dr', 'echo', 'pierce', 'frost', 'chain']) o[k] += e[k] || 0;
    if (e.burn && (!o.burn || e.burn.dmg > o.burn.dmg)) o.burn = e.burn;
    if (!o.glow && I.glow) o.glow = I.glow;
  }
  o.dr = Math.min(0.2, o.dr);
  return o;
}

// ctx: { EXT, player, pm, gfx, log, monsters, killMonster, tick: () => number }
export function installRelicGear(ctx) {
  const { EXT, player, log } = ctx;
  let cache = null, cacheKey = '';
  const fx = () => { const k = JSON.stringify(player.equipment || {}); if (k !== cacheKey) { cacheKey = k; cache = sumEff(player); } return cache; };
  EXT.extIncoming.push(dmg => { const d = fx().dr; return d ? Math.max(1, Math.round(dmg * (1 - d))) : dmg; });
  EXT.extSwing.push((mon, swings, ranged) => {
    const f = fx(); if (!ranged || !swings.length) return;
    if (f.pierce && mon.hp > mon.maxHp / 2) for (const s of swings) s.dmg = (s.dmg || 0) + f.pierce;
    if (f.echo && Math.random() < f.echo) { swings.push({ ...swings[0], dmg: (swings[0].dmg || 0) - 0.4, extra: true }); log('Echo shot!', 'combat'); }
  });
  EXT.extHit.push((mon, dmg, now, style) => {
    const f = fx(); if (!(dmg > 0) || mon.hp <= 0) return;
    if (!style && f.burn && Math.random() < f.burn.chance) { mon.venom = { dmg: f.burn.dmg, next: 2, left: 6 }; log(`The ${mon.name} is ablaze!`, 'combat'); }
    if (style === 'magic') {
      if (f.frost && Math.random() < f.frost) { mon.stunUntil = ctx.tick() + 5; log(`The ${mon.name} is frozen solid!`, 'combat'); }
      if (f.chain && Math.random() < f.chain) {
        const p = mon.mesh.position, o = ctx.monsters.find(m => m !== mon && m.alive && m.hp > 0 && m.mesh.visible && m.mesh.position.distanceTo(p) < 6);
        if (o) { const d = Math.max(1, Math.round(dmg * 0.5)); o.hp -= d; o.hitT = 1; log(`Your spell arcs to the ${o.name} for ${d}!`, 'combat'); if (o.state !== 'fight') { o.state = 'fight'; o.nextAttackTick = ctx.tick() + 1; } if (o.hp <= 0) ctx.killMonster(o, now); }
      }
    }
  });
  // Cheap glow: a single additive sprite on the player tinted by the strongest high-tier piece. No lights, no shaders.
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g2 = cv.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  spr.name = 'relic-glow'; spr.visible = false; spr.position.set(0, 1.1, 0); ctx.pm.mesh.add(spr);
  let t = 0;
  EXT.extFrame.push(dt => {
    const f = fx(); spr.visible = !!f.glow; if (!f.glow) return;
    t += dt; const low = ctx.gfx.quality === 'low';
    spr.material.color.setHex(f.glow);
    spr.material.opacity = (low ? 0.28 : 0.45) + Math.sin(t * 2.2) * (low ? 0 : 0.12);
    spr.scale.setScalar(low ? 1.3 : 1.9 + Math.sin(t * 2.2) * 0.15);
  });
  return { fx };
}
