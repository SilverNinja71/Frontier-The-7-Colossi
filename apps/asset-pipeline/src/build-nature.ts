/**
 * Builds `apps/client/public/assets/nature/nature.glb` from Quaternius' Stylized Nature
 * MegaKit (CC0, https://quaternius.com/packs/stylizednaturemegakit.html).
 *
 *   npm run nature -w @frontier/asset-pipeline -- --source "<pack>/glTF"
 *
 * The raw pack (~118 MB, 2048 px textures, up to 9.5k-triangle trees) stays out of the repo.
 * This picks the models the client scatters, simplifies them to the web budget, shrinks
 * textures to WebP, drops normal maps (the look is flat-shaded), quantises and
 * meshopt-compresses geometry, and packs everything into one .glb whose top-level nodes are
 * named after the source models.
 */
import { Document, NodeIO, type Node } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, meshopt, normals, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

interface KitEntry {
  /** Source file name without extension. */
  model: string;
  /** Triangle budget after simplification. */
  maxTriangles: number;
  /**
   * Simplifier error bound relative to the model's size. Trees are seen from afar and can
   * lose more; small props keep their silhouettes.
   */
  error?: number;
}

const TREES = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'];

export const NATURE_KIT: readonly KitEntry[] = [
  ...TREES.map((model) => ({ model, maxTriangles: 1200, error: 0.08 })),
  { model: 'DeadTree_1', maxTriangles: 1200, error: 0.08 },
  { model: 'DeadTree_2', maxTriangles: 1200, error: 0.08 },
  { model: 'DeadTree_3', maxTriangles: 1200, error: 0.08 },
  { model: 'TwistedTree_1', maxTriangles: 1400, error: 0.08 },
  { model: 'TwistedTree_2', maxTriangles: 1400, error: 0.08 },
  { model: 'TwistedTree_3', maxTriangles: 1400, error: 0.08 },
  { model: 'Rock_Medium_1', maxTriangles: 400 },
  { model: 'Rock_Medium_2', maxTriangles: 400 },
  { model: 'Rock_Medium_3', maxTriangles: 400 },
  { model: 'Bush_Common', maxTriangles: 450 },
  { model: 'Bush_Common_Flowers', maxTriangles: 600 },
  { model: 'Fern_1', maxTriangles: 300 },
  { model: 'Plant_1', maxTriangles: 200 },
  { model: 'Grass_Common_Short', maxTriangles: 200 },
  { model: 'Grass_Wispy_Short', maxTriangles: 250 },
  { model: 'Grass_Common_Tall', maxTriangles: 300 },
  { model: 'Grass_Wispy_Tall', maxTriangles: 300 },
  { model: 'Clover_1', maxTriangles: 200 },
  { model: 'Plant_7', maxTriangles: 300 },
  { model: 'Mushroom_Laetiporus', maxTriangles: 250 },
  { model: 'RockPath_Round_Wide', maxTriangles: 260, error: 0.05 },
  { model: 'RockPath_Square_Wide', maxTriangles: 260, error: 0.05 },
  { model: 'RockPath_Round_Small_1', maxTriangles: 120, error: 0.05 },
  { model: 'RockPath_Round_Small_2', maxTriangles: 120, error: 0.05 },
  { model: 'Flower_3_Group', maxTriangles: 400 },
  { model: 'Flower_4_Group', maxTriangles: 450 },
  { model: 'Mushroom_Common', maxTriangles: 250 },
  { model: 'Pebble_Round_1', maxTriangles: 150 },
  { model: 'Pebble_Round_2', maxTriangles: 150 },
  { model: 'Pebble_Round_3', maxTriangles: 150 },
  { model: 'Pebble_Square_1', maxTriangles: 150 },
];

/** Small on screen: bark, petals, grass, mushrooms. Everything else gets 512 px. */
const SMALL_TEXTURES = /Bark|Flowers|Grass|Mushrooms|PathRocks/;

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    out: { type: 'string', default: path.resolve(import.meta.dirname, '../../client/public/assets/nature/nature.glb') },
  },
});
if (!values.source) {
  console.error('Missing --source <path to the pack\'s glTF folder>');
  process.exit(1);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const kit = new Document();
kit.createBuffer();
const scene = kit.createScene('NatureKit');
kit.getRoot().setDefaultScene(scene);

for (const entry of NATURE_KIT) {
  const doc = await io.read(path.join(values.source, `${entry.model}.gltf`));
  const before = countTriangles(doc);
  if (entry.error) {
    // Faceted source normals give every triangle its own vertices, which the simplifier
    // treats as islands it may not collapse. Drop them, weld, simplify, rebuild smooth ones.
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) prim.setAttribute('NORMAL', null);
    }
  }
  await doc.transform(weld());
  const ratio = Math.min(1, entry.maxTriangles / before);
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: entry.error ?? 0.02 }));
  if (entry.error) await doc.transform(normals({ overwrite: true }));
  const after = countTriangles(doc);

  // Wrap the model's roots in one node named after it, so the client can find it by name.
  const sourceScene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]!;
  const wrapper = doc.createNode(entry.model);
  for (const child of sourceScene.listChildren()) {
    sourceScene.removeChild(child);
    wrapper.addChild(child);
  }
  sourceScene.addChild(wrapper);

  const map = mergeDocuments(kit, doc);
  const merged = map.get(wrapper) as Node;
  scene.addChild(merged);
  console.log(`${entry.model.padEnd(22)} ${String(before).padStart(5)} → ${String(after).padStart(5)} tris`);
}

// One scene, one buffer, shared materials and textures.
for (const s of kit.getRoot().listScenes()) if (s !== scene) s.dispose();
const buffer = kit.getRoot().listBuffers()[0]!;
for (const accessor of kit.getRoot().listAccessors()) accessor.setBuffer(buffer);
for (const extra of kit.getRoot().listBuffers().slice(1)) extra.dispose();
for (const material of kit.getRoot().listMaterials()) material.setNormalTexture(null);

await kit.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [256, 256], pattern: SMALL_TEXTURES }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [512, 512] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);

await mkdir(path.dirname(values.out!), { recursive: true });
await io.write(values.out!, kit);
const { size } = await stat(values.out!);
console.log(`\nWrote ${path.relative(process.cwd(), values.out!)} · ${(size / 1024).toFixed(0)} KB · ${countTriangles(kit)} triangles total`);

function countTriangles(doc: Document): number {
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      triangles += (indices ? indices.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0)) / 3;
    }
  }
  return Math.round(triangles);
}
