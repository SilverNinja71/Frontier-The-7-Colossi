/**
 * Converts a 3D-print model (or any .glb/.gltf) into a statue for the client's private,
 * git-ignored asset slot. Files there are only served by the local dev server.
 *
 *   npm run statue -w @frontier/asset-pipeline -- --input ~/Downloads/wukong.3mf
 *
 * Options: --name (default: input file name), --height metres (3.4), --triangles (40000),
 * --up z|y (z for print files), --yaw degrees (turn it if it faces the wrong way),
 * --out-dir (default: apps/client/private-assets).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildStatue, parse3mf, parseStl, soupFromDocument } from './print-model.ts';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    name: { type: 'string' },
    height: { type: 'string', default: '3.4' },
    triangles: { type: 'string', default: '40000' },
    up: { type: 'string' },
    yaw: { type: 'string', default: '0' },
    'out-dir': { type: 'string', default: path.resolve(import.meta.dirname, '../../client/private-assets') },
  },
});
if (!values.input) {
  console.error('Missing --input <model.stl | model.3mf | model.glb>');
  process.exit(1);
}

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const input = path.resolve(values.input);
const extension = path.extname(input).toLowerCase();
const isPrintFile = extension === '.stl' || extension === '.3mf';
console.log(`Reading ${input}…`);
const soup =
  extension === '.stl'
    ? parseStl(await readFile(input))
    : extension === '.3mf'
      ? parse3mf(await readFile(input))
      : soupFromDocument(await io.read(input));

const name = (values.name ?? path.basename(input, extension)).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
const { doc, trianglesBefore, trianglesAfter } = await buildStatue(
  soup,
  {
    targetHeight: Number(values.height),
    maxTriangles: Number(values.triangles),
    upAxis: (values.up as 'z' | 'y' | undefined) ?? (isPrintFile ? 'z' : 'y'),
    yawDegrees: Number(values.yaw),
  },
  MeshoptSimplifier,
);
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));

const outDir = values['out-dir']!;
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${name}.glb`);
await io.write(out, doc);
const { size } = await stat(out);
console.log(`${trianglesBefore.toLocaleString()} → ${trianglesAfter.toLocaleString()} triangles`);
console.log(`Wrote ${out} (${(size / 1024).toFixed(0)} KB). Run \`npm run dev\` and open the game.`);
