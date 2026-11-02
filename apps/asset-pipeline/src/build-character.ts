/**
 * Turns a single-mesh statue (a 3D-print model) into a rigid-part character for the client's
 * PlayerRig: it cuts the mesh into torso+head, two arms, two legs and the weapon, removes the
 * display base, straightens each limb into the rig's standing pose (blending across elbows and
 * knees so the bends stay smooth), scales it to the rig and writes a private .glb.
 *
 *   npm run character -w @frontier/asset-pipeline -- --input hero.glb --rig hero.rig.json --name hero
 *
 * Output: apps/client/private-assets/<name>.rig.glb (git-ignored; served by the dev server only).
 */
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { parse3mf, parseStl, soupFromDocument } from './print-model.ts';
import { buildCharacter, type RigSpec } from './character.ts';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    rig: { type: 'string' },
    name: { type: 'string', default: 'character' },
    'out-dir': { type: 'string', default: path.resolve(import.meta.dirname, '../../client/private-assets') },
  },
});
if (!values.input || !values.rig) {
  console.error('Usage: --input <model.glb|.stl|.3mf> --rig <rig.json> [--name hero]');
  process.exit(1);
}

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const input = path.resolve(values.input);
const ext = path.extname(input).toLowerCase();
const soup =
  ext === '.stl' ? parseStl(await readFile(input)) : ext === '.3mf' ? parse3mf(await readFile(input)) : soupFromDocument(await io.read(input));
const spec = JSON.parse(await readFile(path.resolve(values.rig), 'utf8')) as RigSpec;

const result = buildCharacter(soup, spec);
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene(values.name);
doc.getRoot().setDefaultScene(scene);
for (const part of result.parts) {
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(part.positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(part.normals).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(part.indices).setBuffer(buffer));
  if (part.colors) prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(part.colors).setBuffer(buffer));
  scene.addChild(doc.createNode(part.name).setMesh(doc.createMesh(part.name).addPrimitive(prim)));
}
scene.setExtras({ rig: result.rig });

const outDir = values['out-dir']!;
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${values.name}.rig.glb`);
await io.write(out, doc);
const { size } = await stat(out);
for (const part of result.parts) console.log(`${part.name.padEnd(6)} ${String(part.indices.length / 3).padStart(6)} triangles`);
console.log(`dropped ${result.dropped} base triangles`);
console.log(`Wrote ${out} (${(size / 1024).toFixed(0)} KB)`);
