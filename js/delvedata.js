// Delving save state (pure; used by save.js). stash holds your gear while you are on a floor.
export function normalizeDelving(d) {
  const o = d && typeof d === 'object' ? d : {}, num = v => Math.max(0, Math.floor(Number(v) || 0));
  const out = { tokens: num(o.tokens), floors: num(o.floors), best: num(o.best), deepest: num(o.deepest), stash: null };
  const s = o.stash;
  if (s && typeof s === 'object' && s.inventory && typeof s.inventory === 'object' && s.equipment && typeof s.equipment === 'object')
    out.stash = { inventory: s.inventory, equipment: s.equipment, ammoCount: num(s.ammoCount) };
  return out;
}
