// Ventures (v23): save state for the adaptation systems lives under player.adapt.<feature>.
// Each feature registers a normalizer here at import time, so old saves get defaults and bad data is cleaned.
export const NORM = {};
export function normalizeAdapt(a) {
  a = a && typeof a === 'object' && !Array.isArray(a) ? a : {};
  const out = {};
  for (const [k, f] of Object.entries(NORM)) { try { out[k] = f(a[k]); } catch (e) { out[k] = f(undefined); } }
  for (const k of Object.keys(a)) if (!(k in out)) out[k] = a[k];   // unknown keys from a newer build are kept
  return out;
}
export const num = (v, d = 0, lo = -Infinity, hi = Infinity) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
export const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export const arr = v => (Array.isArray(v) ? v : []);
export const str = (v, ok, d = null) => (typeof v === 'string' && (!ok || ok.includes(v)) ? v : d);
