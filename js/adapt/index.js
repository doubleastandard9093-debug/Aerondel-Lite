// Ventures: systems adapted from PSO2, Lost Ark, The First Descent and Destiny 2 (original names, PvE only).
// Each feature lives in its own file and registers itself on the shared core (hub window, quick buttons, combat mods).
import { installCore } from './core.js';
import overflare from './overflare.js';
import wardrobe from './wardrobe.js';
import ledger from './ledger.js';
import reliquary from './reliquary.js';
import loot from './loot.js';
import crestbreak from './crestbreak.js';
import sigils from './sigils.js';
import grafts from './grafts.js';
import twinstance from './twinstance.js';
import zone from './zone.js';
import tides from './tides.js';
import breach from './breach.js';
import tether from './tether.js';
const FEATURES = [overflare, wardrobe, ledger, reliquary, loot, crestbreak, sigils, grafts, twinstance, zone, tides, breach, tether];
export function installAdapt(ctx) {
  const A = installCore(ctx);
  for (const f of FEATURES) { try { f(A); } catch (e) { console.error('Ventures feature failed to start', e); } }
  A.ready();
  return A;
}
