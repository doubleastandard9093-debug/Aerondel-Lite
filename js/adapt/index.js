// Ventures: systems adapted from PSO2, Lost Ark, The First Descent and Destiny 2 (original names, PvE only).
// Each feature lives in its own file and registers itself on the shared core (hub window, quick buttons, combat mods).
import { installCore } from './core.js';
import overflare from './overflare.js';
import wardrobe from './wardrobe.js';
import ledger from './ledger.js';
import reliquary from './reliquary.js';
import loot from './loot.js';
import crestbreak from './crestbreak.js';
const FEATURES = [overflare, wardrobe, ledger, reliquary, loot, crestbreak];
export function installAdapt(ctx) {
  const A = installCore(ctx);
  for (const f of FEATURES) { try { f(A); } catch (e) { console.error('Ventures feature failed to start', e); } }
  A.ready();
  return A;
}
