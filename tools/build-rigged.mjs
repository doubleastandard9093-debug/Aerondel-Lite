// Build rigged CC0 (Quaternius, via poly.pizza) characters into models/rigged/*.glb
// usage: node tools/build-rigged.mjs <srcDir> <outDir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, quantize, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import path from 'path';
const [, , SRC, OUT] = process.argv;
export const RIGGED = {
  goblin: 'c_OdCOFSmEhl', orc_enemy: 'c_Q3z8ZX4kUy', orc: 'c_5vO2YJsPEf', giant: 'c_BldaiPtyJa', yeti: 'c_S1E7idPFhe',
  skeleton: 'c_DM4QScSmbS', skeleton_sword: 'c_1XZD9GK6Kj', zombie: 'c_JoBvxIUpZP', ghost: 'c_Iip30bDHmu',
  dragon: 'c_3rUm1cN3yp', demon: 'c_LnfIziKv4o', demon_blue: 'c_S7jYW6Amye', cow: 'c_26zM1outCr', wolf: 'wolf', spider: 'spider',
  matt: 'c_66kQ4dBBC7', sam: 'c_UcLErL2W37', adventurer: 'c_5EGWBMpuXq', hooded: 'c_ZwF0K7WBmu', wizard: 'c_o87Upt5uHX'
};
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const [name, file] of Object.entries(RIGGED)) {
  const doc = await io.read(path.join(SRC, file + '.glb'));
  const seen = new Set();   // de-dupe duplicated clip sets (keep first of each short name)
  for (const a of doc.getRoot().listAnimations()) { const k = a.getName().split('|').pop(); if (seen.has(k)) a.dispose(); else { seen.add(k); a.setName(k); } }
  await doc.transform(dedup(), prune(), resample({ tolerance: 2e-3 }), weld(), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(path.join(OUT, name + '.glb'), doc);
  console.log(name, [...seen].join(','));
}
