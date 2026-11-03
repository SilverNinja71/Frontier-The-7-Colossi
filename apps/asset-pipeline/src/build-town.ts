/**
 * Builds `apps/client/public/assets/town/town.glb` from Kenney's Fantasy Town Kit (CC0,
 * https://kenney.nl/assets/fantasy-town-kit):
 *
 *   npm run town -w @frontier/asset-pipeline -- --source "<kit>/Models/GLB format"
 *
 * The kit is already low-poly and shares one small colour-map texture, so this only picks the
 * modules the First Bastion is built from, welds, dedups, converts the texture to WebP and
 * meshopt-compresses geometry into one .glb whose top-level nodes are named after the modules
 * (the same layout NatureKit reads). Modules sit on a 1-unit grid; walls are slabs on a
 * cell's +x edge; the client scales the grid to 3 m.
 */
import { Document, NodeIO, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

export const TOWN_KIT = [
  // Building shells
  'wall',
  'wall-door',
  'wall-window-shutters',
  'wall-window-round',
  'wall-wood',
  'wall-wood-door',
  'wall-wood-window-shutters',
  'wall-slope',
  'wall-wood-slope',
  'wall-arch',
  'wall-arch-top',
  'roof-high',
  'chimney-base',
  'chimney',
  'chimney-top',
  'overhang',
  'balcony-wall',
  'stairs-stone',
  'pillar-stone',
  'pillar-wood',
  'planks',
  // Market and street
  'stall-red',
  'stall-green',
  'stall-bench',
  'stall-stool',
  'fountain-round-detail',
  'lantern',
  'cart',
  'cart-high',
  'banner-red',
  'banner-green',
  'fence',
  'fence-gate',
  'hedge',
  'hedge-large',
  'windmill',
  'wheel',
  'poles',
] as const;

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    out: { type: 'string', default: path.resolve(import.meta.dirname, '../../client/public/assets/town/town.glb') },
  },
});
if (!values.source) {
  console.error('Missing --source "<Fantasy Town Kit>/Models/GLB format"');
  process.exit(1);
}

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const kit = new Document();
kit.createBuffer();
const scene = kit.createScene('TownKit');
kit.getRoot().setDefaultScene(scene);

let triangles = 0;
for (const model of TOWN_KIT) {
  const doc = await io.read(path.join(values.source, `${model}.glb`));
  await doc.transform(weld());
  const sourceScene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]!;
  const wrapper = doc.createNode(model);
  for (const child of sourceScene.listChildren()) {
    sourceScene.removeChild(child);
    wrapper.addChild(child);
  }
  sourceScene.addChild(wrapper);
  const map = mergeDocuments(kit, doc);
  scene.addChild(map.get(wrapper) as Node);
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) triangles += (prim.getIndices()?.getCount() ?? 0) / 3;
  }
}

for (const s of kit.getRoot().listScenes()) if (s !== scene) s.dispose();
const buffer = kit.getRoot().listBuffers()[0]!;
for (const accessor of kit.getRoot().listAccessors()) accessor.setBuffer(buffer);
for (const extra of kit.getRoot().listBuffers().slice(1)) extra.dispose();

await kit.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 90 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

await mkdir(path.dirname(values.out!), { recursive: true });
await io.write(values.out!, kit);
const { size } = await stat(values.out!);
console.log(`Wrote ${path.relative(process.cwd(), values.out!)} · ${TOWN_KIT.length} modules · ${Math.round(triangles)} triangles · ${(size / 1024).toFixed(0)} KB`);
console.log(`Materials: ${kit.getRoot().listMaterials().map((m) => m.getName()).join(', ')}`);
