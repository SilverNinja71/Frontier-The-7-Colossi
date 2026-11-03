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
 *
 * Every module colours itself by sampling swatches of one palette texture. Two recoloured
 * palettes give the Bastion its look (cream stucco, pale limestone trim, warm stone, and
 * terracotta or slate roofs): `palette-terracotta.webp` and `palette-slate.webp`. The client
 * draws buildings with them and keeps the original palette for market props.
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
  'roof-high-window',
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

/** Palette swatches (16 columns × 4 rows of 32×128 px vertical gradients) and their new colours. */
const SWATCHES = {
  plaster: { col: 3, row: 2, top: '#f3e9d2', bottom: '#d9c8a6' },
  trim: { col: 9, row: 3, top: '#f1ebdd', bottom: '#cdbfa0' },
  stone: { col: 15, row: 3, top: '#c9bc9c', bottom: '#9d9078' },
} as const;
const ROOFS = {
  terracotta: { top: '#e9814a', bottom: '#b4502a' },
  slate: { top: '#7f97c9', bottom: '#4c5f92' },
} as const;
const ROOF_SWATCH = { col: 1, row: 3 };

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Paints one swatch as a vertical gradient, like the kit's own. */
function paint(pixels: Buffer, width: number, col: number, row: number, top: string, bottom: string): void {
  const [a, b] = [rgb(top), rgb(bottom)];
  for (let y = 0; y < 128; y++) {
    const t = y / 127;
    for (let x = 0; x < 32; x++) {
      const i = ((row * 128 + y) * width + col * 32 + x) * 4;
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(a[c]! + (b[c]! - a[c]!) * t);
      pixels[i + 3] = 255;
    }
  }
}

async function writePalettes(source: string, outDir: string): Promise<void> {
  const { data, info } = await sharp(path.join(source, 'Textures/colormap.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const [name, roof] of Object.entries(ROOFS)) {
    const pixels = Buffer.from(data);
    for (const s of Object.values(SWATCHES)) paint(pixels, info.width, s.col, s.row, s.top, s.bottom);
    paint(pixels, info.width, ROOF_SWATCH.col, ROOF_SWATCH.row, roof.top, roof.bottom);
    await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
      .removeAlpha()
      .webp({ quality: 95 })
      .toFile(path.join(outDir, `palette-${name}.webp`));
  }
}

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
await writePalettes(values.source, path.dirname(values.out!));
const { size } = await stat(values.out!);
console.log(`Wrote ${path.relative(process.cwd(), values.out!)} · ${TOWN_KIT.length} modules · ${Math.round(triangles)} triangles · ${(size / 1024).toFixed(0)} KB`);
console.log(`Materials: ${kit.getRoot().listMaterials().map((m) => m.getName()).join(', ')}`);
