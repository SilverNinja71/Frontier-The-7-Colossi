/**
 * Builds the particle atlas from Kenney's CC0 Particle Pack and Smoke Particles
 * (https://kenney.nl):
 *
 *   npm run vfx -w @frontier/asset-pipeline -- \
 *     --particles "<Particle Pack>/PNG (Transparent)" --smoke "<Smoke Particles>/PNG"
 *
 * The raw packs stay out of the repo. Each chosen sprite is fitted into a 128 px cell of a 4×4
 * grid (`apps/client/public/assets/vfx/particles.webp`); `particles.json` maps sprite names to
 * cells so the client never hard-codes the layout.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

/** name → source (pack, file). Order = cell index, row-major. */
export const VFX_SPRITES = [
  ['star4', 'particles', 'star_06.png'],
  ['starX', 'particles', 'star_08.png'],
  ['burst', 'particles', 'star_09.png'],
  ['glint', 'particles', 'flare_01.png'],
  ['ring', 'particles', 'circle_03.png'],
  ['dot', 'particles', 'circle_05.png'],
  ['streak', 'particles', 'trace_02.png'],
  ['slash', 'particles', 'slash_02.png'],
  ['impact', 'particles', 'scorch_02.png'],
  ['compass', 'particles', 'magic_03.png'],
  ['runes', 'particles', 'magic_02.png'],
  ['halo', 'particles', 'light_02.png'],
  ['debris', 'particles', 'dirt_02.png'],
  ['puffA', 'smoke', 'White puff/whitePuff02.png'],
  ['puffB', 'smoke', 'White puff/whitePuff09.png'],
  ['puffC', 'smoke', 'White puff/whitePuff16.png'],
] as const;

const CELL = 128;
const GRID = 4;

const { values } = parseArgs({
  options: {
    particles: { type: 'string' },
    smoke: { type: 'string' },
    out: { type: 'string', default: path.resolve(import.meta.dirname, '../../client/public/assets/vfx') },
  },
});
if (!values.particles || !values.smoke) throw new Error('Pass --particles "<Particle Pack>/PNG (Transparent)" --smoke "<Smoke Particles>/PNG"');
const dirs = { particles: values.particles, smoke: values.smoke };

const cells = await Promise.all(
  VFX_SPRITES.map(async ([, pack, file], i) => ({
    input: await sharp(path.join(dirs[pack], file))
      .ensureAlpha()
      .resize(CELL - 4, CELL - 4, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: 2, bottom: 2, left: 2, right: 2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
    left: (i % GRID) * CELL,
    top: Math.floor(i / GRID) * CELL,
  })),
);

await mkdir(values.out!, { recursive: true });
const out = path.join(values.out!, 'particles.webp');
await sharp({ create: { width: GRID * CELL, height: GRID * CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(cells)
  .webp({ quality: 90, alphaQuality: 100 })
  .toFile(out);
await writeFile(
  path.join(values.out!, 'particles.json'),
  `${JSON.stringify({ grid: GRID, sprites: Object.fromEntries(VFX_SPRITES.map(([name], i) => [name, i])) })}\n`,
);
await writeFile(
  path.join(values.out!, 'CREDITS.txt'),
  `Particle sprites by Kenney (https://kenney.nl), CC0 1.0:\n- Particle Pack\n- Smoke Particles\n${VFX_SPRITES.map(([name, pack, file]) => `- ${name}: ${pack === 'smoke' ? 'Smoke Particles' : 'Particle Pack'} ${file}`).join('\n')}\nPacked into a 4×4 atlas by apps/asset-pipeline/src/build-vfx.ts.\n`,
);
console.log(`Wrote ${out} (${VFX_SPRITES.length} sprites)`);
