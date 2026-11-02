/**
 * Builds the terrain texture layers from Poly Haven (CC0, https://polyhaven.com):
 *
 *   npm run terrain -w @frontier/asset-pipeline
 *
 * Downloads each layer's 1k diffuse (cached in --cache) and turns it into soft detail: the
 * micro-contrast is pulled toward the layer's mean and lightly blurred (seam-free, on a wrapped
 * copy), so it reads as painterly variation instead of photo grit next to the low-poly kit. The
 * client divides each layer by its mean and multiplies in the game's own palette, so colour
 * comes from the art direction and only the variation comes from the scan. Layers are packed
 * into one vertical strip, `apps/client/public/assets/terrain/layers.webp`, which the client
 * turns into a texture array (one sampler for every ground layer).
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

/** Order matters: it is the layer index in the terrain shader. */
export const TERRAIN_LAYERS = [
  { id: 'rocky_terrain_02', role: 'grass', contrast: 0.7, blur: 0.8 },
  { id: 'grass_path_2', role: 'dirt', contrast: 0.55, blur: 1.0 },
  { id: 'rock_face_03', role: 'rock', contrast: 0.8, blur: 0.6 },
  { id: 'coast_sand_01', role: 'sand', contrast: 0.6, blur: 1.0 },
  { id: 'snow_02', role: 'snow', contrast: 0.7, blur: 0.8 },
  { id: 'forrest_ground_01', role: 'forest floor', contrast: 0.6, blur: 0.9 },
] as const;

/** Pulls every pixel toward the image mean (per channel) by `amount` (1 = unchanged). */
function softenContrast(rgba: Buffer, amount: number): Buffer {
  const mean = [0, 0, 0];
  const pixels = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) for (let c = 0; c < 3; c++) mean[c]! += rgba[i + c]!;
  for (let c = 0; c < 3; c++) mean[c] = mean[c]! / pixels;
  const out = Buffer.from(rgba);
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(mean[c]! + (rgba[i + c]! - mean[c]!) * amount);
  }
  return out;
}

const SIZE = 512;

const { values } = parseArgs({
  options: {
    cache: { type: 'string', default: path.resolve(import.meta.dirname, '../.cache/polyhaven') },
    out: { type: 'string', default: path.resolve(import.meta.dirname, '../../client/public/assets/terrain') },
  },
});

await mkdir(values.cache!, { recursive: true });
await mkdir(values.out!, { recursive: true });

const strips: Buffer[] = [];
for (const layer of TERRAIN_LAYERS) {
  const file = path.join(values.cache!, `${layer.id}_diff_1k.jpg`);
  const cached = await stat(file).then(
    () => true,
    () => false,
  );
  if (!cached) {
    const url = `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${layer.id}/${layer.id}_diff_1k.jpg`;
    console.log(`Downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  // Blur a wrapped copy and crop the middle, so the tile edges stay seamless.
  const pad = 16;
  const blurred = await sharp(
    await sharp(await readFile(file))
      .resize(SIZE, SIZE, { kernel: 'lanczos3' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, extendWith: 'repeat' })
      .toBuffer(),
  )
    .blur(layer.blur)
    .extract({ left: pad, top: pad, width: SIZE, height: SIZE })
    .ensureAlpha()
    .raw()
    .toBuffer();
  const pixels = softenContrast(blurred, layer.contrast);
  strips.push(pixels);
  console.log(`${layer.id.padEnd(18)} → layer ${strips.length - 1} (${layer.role})`);
}

const out = path.join(values.out!, 'layers.webp');
await sharp(Buffer.concat(strips), { raw: { width: SIZE, height: SIZE * strips.length, channels: 4 } })
  .removeAlpha()
  .webp({ quality: 84 })
  .toFile(out);
await writeFile(
  path.join(values.out!, 'CREDITS.txt'),
  `Terrain textures from Poly Haven (https://polyhaven.com), CC0 1.0:\n${TERRAIN_LAYERS.map((l) => `- ${l.id} (https://polyhaven.com/a/${l.id})`).join('\n')}\nResized to ${SIZE}px, softened and packed by apps/asset-pipeline/src/build-terrain.ts.\n`,
);
const { size } = await stat(out);
console.log(`Wrote ${out} (${(size / 1024).toFixed(0)} KB)`);
