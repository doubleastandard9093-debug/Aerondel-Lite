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
import geodes from './geodes.js';
import ascent from './ascent.js';
import lumen from './lumen.js';
import lattice from './lattice.js';
import vigil from './vigil.js';
import attune from './attune.js';
import hearthhold from './hearthhold.js';
import chronicle from './chronicle.js';
import glidewalk from './glidewalk.js';
import huntwright from './huntwright.js';
import guardbreak from './guardbreak.js';
import ashkin from './ashkin.js';
import vocations from './vocations.js';
import wordcries from './wordcries.js';
import townsteads from './townsteads.js';
import townties from './townties.js';
import greenstead from './greenstead.js';
import facets from './facets.js';
import leyweave from './leyweave.js';
import hordewake from './hordewake.js';
import deepmarks from './deepmarks.js';
import ashspire from './ashspire.js';
import kinbeasts from './kinbeasts.js';
import freeclimb from './freeclimb.js';
import leychem from './leychem.js';
import freeframe from './freeframe.js';
import holdraids from './holdraids.js';
import trailhand from './trailhand.js';
import skillwords from './skillwords.js';
const FEATURES = [overflare, wardrobe, ledger, reliquary, loot, crestbreak, sigils, grafts, twinstance, zone, tides, breach, tether, geodes, ascent, lumen, lattice, vigil, attune, hearthhold, chronicle, glidewalk, huntwright, guardbreak, ashkin, vocations, wordcries, townsteads, townties, greenstead, facets, leyweave, hordewake, deepmarks, ashspire, kinbeasts, freeclimb, leychem, freeframe, holdraids, trailhand, skillwords];
export function installAdapt(ctx) {
  const A = installCore(ctx);
  for (const f of FEATURES) { try { f(A); } catch (e) { console.error('Ventures feature failed to start', e); } }
  A.ready();
  return A;
}
