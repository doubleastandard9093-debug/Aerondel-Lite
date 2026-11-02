// Builds models/ from downloaded CC0 Kenney packs (see CREDITS.md).
// Usage: node tools/build-models.mjs /path/to/packs   (packs unzipped as <pack>/Models/GLB format/*.glb)
// Each output is optimised: dedup, weld, simplify (static only), webp textures <=512, meshopt-compressed.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, textureCompress, meshopt, mergeDocuments, flatten, join, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'node:fs'; import path from 'node:path';

const PACKS = process.argv[2] || '/tmp/packs';
const OUT = path.resolve(process.argv[3] || 'models');
await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const src = (pack, name) => { const d = path.join(PACKS, pack, 'Models'); const f = ['GLB format', 'GLTF format'].map(s => path.join(d, s, name + '.glb')).find(fs.existsSync); if (!f) throw new Error('missing ' + pack + '/' + name); return f; };
const N = 'nature-kit', T = 'fantasy-town-kit', S = 'survival-kit', Y = 'graveyard-kit', C = 'mini-characters';

// out name -> [pack, source]
const SINGLE = {
  nature: {
    broadleaf_a: [N, 'tree_default'], broadleaf_b: [N, 'tree_oak'], broadleaf_c: [N, 'tree_detailed'], broadleaf_d: [N, 'tree_fat'],
    autumn_a: [N, 'tree_default_fall'], autumn_b: [N, 'tree_oak_fall'], autumn_c: [N, 'tree_detailed_fall'],
    pine_a: [N, 'tree_pineTallA'], pine_b: [N, 'tree_pineRoundB'], pine_c: [N, 'tree_pineDefaultA'], pine_d: [N, 'tree_cone'],
    palm_a: [N, 'tree_palm'], palm_b: [N, 'tree_palmTall'], palm_c: [N, 'tree_palmDetailedShort'],
    dead_a: [Y, 'pine-crooked'], dead_b: [Y, 'pine-fall-crooked'], dead_c: [N, 'tree_thin_dark'],
    cactus_a: [N, 'cactus_tall'], cactus_b: [N, 'cactus_short'], cactus_c: [N, 'cactus_tall'],
    rock_a: [N, 'rock_largeA'], rock_b: [N, 'rock_largeB'], rock_c: [N, 'rock_tallE'], rock_d: [N, 'stone_largeC'],
    bush_a: [N, 'plant_bush'], bush_b: [N, 'plant_bushLarge'], bush_c: [N, 'plant_bushDetailed'],
  },
  props: {
    fence_a: [N, 'fence_simple'], fence_b: [N, 'fence_planks'], fence_c: [T, 'fence'],
    crate_a: [S, 'box'], crate_b: [S, 'box-large'], crate_c: [S, 'barrel'],
    campfire_a: [N, 'campfire_stones'], campfire_b: [S, 'campfire-pit'], campfire_c: [N, 'campfire_planks'],
    stall_a: [T, 'stall'], stall_b: [T, 'stall-red'], cart_a: [T, 'cart'],
    pillar_a: [N, 'statue_column'], pillar_b: [N, 'statue_columnDamaged'], pillar_c: [Y, 'pillar-large'],
  },
  buildings: {
    gob_a: [S, 'tent'], gob_b: [S, 'tent-canvas'], gob_c: [S, 'structure-canvas'],
    ogre_a: [Y, 'crypt-large'], ogre_b: [Y, 'crypt-a'], ogre_c: [Y, 'crypt-b'],
  },
  characters: Object.fromEntries([['folk_m_a', 'character-male-a'], ['folk_m_b', 'character-male-b'], ['folk_m_c', 'character-male-c'],
    ['folk_f_a', 'character-female-a'], ['folk_f_b', 'character-female-b'], ['folk_f_c', 'character-female-c']].map(([k, v]) => [k, [C, v]])),
};
// Composed houses from Fantasy Town Kit modules (1 unit cells). Wall pieces sit on the cell's +x face; rotY turns them.
const R = Math.PI / 2, F = -R /* +z front */, B = R /* -z */, Lx = Math.PI /* -x */, Rx = 0 /* +x */;
const cell = (x, y, z, walls, roof) => [...walls.map(([p, r]) => [p, x, y, z, r]), ...(roof ? [[roof, x, y + 1, z, 0]] : [])];
const HOUSES = {
  human_a: cell(0, 0, 0, [['wall-wood-door', F], ['wall-wood-window-shutters', Rx], ['wall-wood', B], ['wall-wood-window-small', Lx]], 'roof-high-point'),
  human_b: [...cell(0, 0, 0, [['wall-door', F], ['wall-window-glass', Rx], ['wall', B], ['wall-window-stone', Lx]]),
            ...cell(0, 1, 0, [['wall-wood-window-shutters', F], ['wall-wood', Rx], ['wall-wood-window-small', B], ['wall-wood', Lx]], 'roof-high-point')],
  human_c: [...cell(-0.5, 0, 0, [['wall-wood-door', F], ['wall-wood', B], ['wall-wood-window-shutters', Lx]], 'roof-high-point'),
            ...cell(0.5, 0, 0, [['wall-wood-window-small', F], ['wall-wood-window-shutters', B], ['wall-wood', Rx]], 'roof-point')],
  elf_a: [...cell(0, 0, 0, [['wall-doorway-round', F], ['wall-window-round', Rx], ['wall', B], ['wall-window-round', Lx]]),
          ...cell(0, 1, 0, [['wall-window-round', F], ['wall', Rx], ['wall-window-round', B], ['wall', Lx]]),
          ...cell(0, 2, 0, [['wall-window-round', F], ['wall-window-round', Rx], ['wall-window-round', B], ['wall-window-round', Lx]], 'roof-high-point')],
  elf_b: [...cell(0, 0, 0, [['wall-arch', F], ['wall-window-round', Rx], ['wall-window-round', B], ['wall-window-round', Lx]], 'roof-high-point'),
          ['hedge-large-curved', 1.2, 0, 0.8, 0]],
  elf_c: [...cell(0, 0, 0, [['wall-doorway-round', F], ['wall', Rx], ['wall', B], ['wall', Lx]]),
          ...cell(0, 1, 0, [['wall-window-round', F], ['wall-window-round', Rx], ['wall-window-round', B], ['wall-window-round', Lx]], 'roof-point')],
};

async function finish(doc, out, { static: isStatic = true } = {}) {
  await doc.transform(
    dedup(), flatten(), ...(isStatic ? [join()] : []), weld(),
    ...(isStatic ? [simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 0.002 })] : []),
    prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await io.write(out, doc);
}
const sizes = {};
for (const [cat, list] of Object.entries(SINGLE)) for (const [name, [pack, file]] of Object.entries(list)) {
  const out = path.join(OUT, cat, name + '.glb');
  await finish(await io.read(src(pack, file)), out, { static: cat !== 'characters' });
  sizes[cat] = (sizes[cat] || 0) + fs.statSync(out).size;
}
for (const [name, parts] of Object.entries(HOUSES)) {
  const doc = await io.read(src(T, parts[0][0]));
  const root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0];
  const wrap = (nodes, [_, x, y, z, r]) => { const g = doc.createNode('part').setTranslation([x, y, z]).setRotation([0, Math.sin(r / 2), 0, Math.cos(r / 2)]); for (const n of nodes) { scene.removeChild(n); g.addChild(n); } scene.addChild(g); };
  wrap(scene.listChildren(), parts[0]);
  for (const p of parts.slice(1)) {
    const before = new Set(scene.listChildren());
    const other = await io.read(src(T, p[0]));
    const map = mergeDocuments(doc, other);
    const os = map.get(other.getRoot().listScenes()[0]);
    const kids = os.listChildren(); for (const k of kids) os.removeChild(k);
    os.dispose();
    for (const k of kids) scene.addChild(k);
    wrap(kids, p);
  }
  const out = path.join(OUT, 'buildings', name + '.glb');
  await finish(doc, out);
  sizes.buildings = (sizes.buildings || 0) + fs.statSync(out).size;
}
console.log(Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, (v / 1024).toFixed(0) + ' KB'])));
