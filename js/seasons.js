// Seasons of Aerondel: the world follows the real-world (northern) season, or a season you pick from the Seasonkeeper.
// Look swaps are cheap on every quality: a grass tint and light snow cover (two terrain uniforms) and a foliage tint
// (one material colour). High also swaps the grass photo-detail set for a CC0 seasonal set (textures/season_*.webp).
export const SEASONS = {
  spring: { name: 'Spring', icon: '🌸', grass: [1.0, 1.1, 0.96], leaf: 0xeefbe2, snow: 0 },
  summer: { name: 'Summer', icon: '☀️', grass: [1, 1, 1], leaf: 0xffffff, snow: 0 },
  autumn: { name: 'Autumn', icon: '🍂', grass: [1.16, 0.94, 0.62], leaf: 0xffa860, snow: 0 },
  winter: { name: 'Winter', icon: '❄️', grass: [0.84, 0.9, 0.96], leaf: 0xc4d0d6, snow: 0.7 }
};
export const SEASON_IDS = Object.keys(SEASONS);
export function realSeason(d = new Date()) { const m = d.getMonth(); return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter'; }
export function currentSeason(player, d) { const o = player && player.settings && player.settings.season; return SEASONS[o] ? o : realSeason(d); }

import { applyLeafTint } from './assets.js';
export function installSeasons(ctx) {
  const { player, gfx, setSeasonDetail, SEASON_GRASS, SEASON_SNOW, foliageMat } = ctx;
  let applied = null, appliedQ = null;
  function apply(force) {
    const s = currentSeason(player), S = SEASONS[s];
    if (!force && s === applied && gfx.quality === appliedQ) return s;
    applied = s; appliedQ = gfx.quality;
    SEASON_GRASS.value.set(S.grass[0], S.grass[1], S.grass[2]);
    SEASON_SNOW.value = S.snow;
    if (foliageMat && foliageMat.color) foliageMat.color.setHex(S.leaf);
    applyLeafTint(S.leaf);
    setSeasonDetail(gfx.quality === 'low' ? 'summer' : s);
    return s;
  }
  function setOverride(id) { player.settings = player.settings || {}; player.settings.season = SEASONS[id] ? id : 'auto'; apply(true); if (ctx.markDirty) ctx.markDirty(); }
  apply(true);
  let acc = 0;
  ctx.EXT.extFrame.push(dt => { acc += dt; if (acc > 5) { acc = 0; apply(false); } });
  const api = { current: () => currentSeason(player), apply, setOverride, SEASONS };
  ctx.EXT.seasons = api;
  return api;
}
