/**
 * Builds the player character, `apps/client/public/assets/characters/hunter.glb`, from
 * Quaternius' CC0 packs (https://quaternius.com): the Ranger outfit from Modular Character
 * Outfits - Fantasy, the face and eyes from Universal Base Characters, and clips from the
 * Universal Animation Library 1 and 2 (all on the same 65-bone skeleton):
 *
 *   npm run hunter -w @frontier/asset-pipeline -- \
 *     --outfit "<Outfits>/Exports/glTF (Godot-Unreal)/Outfits/Male_Ranger.gltf" \
 *     --base "<Base Characters>/Godot - UE/Superhero_Male_FullBody.gltf" \
 *     --ual1 "<UAL1>/Unreal-Godot/UAL1_Standard.glb" --ual2 "<UAL2>/Unreal-Godot/UAL2_Standard.glb"
 *
 * The outfit has no face: the head and eyes are cut out of the base body by bone weight (the
 * two share bind poses) and re-bound to the outfit's skeleton by joint name. The chosen clips
 * are copied onto the outfit's joints by name. The cloth is recoloured to the Bastion hunter's
 * own teal (an original colourway), meshes are simplified per part to a web budget, normal and
 * ORM maps are dropped (the game is lit flat), textures become WebP, geometry is meshopt-packed.
 */
import { Document, NodeIO, type Accessor, type Node, type Primitive, type Skin } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune, resample, simplifyPrimitive, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

/** Clip name in the library → name the client asks for. */
export const HUNTER_CLIPS: Record<'ual1' | 'ual2', Record<string, string>> = {
  ual1: {
    Idle_Loop: 'idle',
    Sword_Idle: 'guard',
    Walk_Loop: 'walk',
    Jog_Fwd_Loop: 'jog',
    Sprint_Loop: 'sprint',
    Roll: 'roll',
    Hit_Chest: 'hit',
    Death01: 'death',
    Sword_Attack: 'slash-heavy',
  },
  ual2: {
    Sword_Regular_A: 'slash-a',
    Sword_Regular_A_Rec: 'slash-a-rec',
    Sword_Regular_B: 'slash-b',
    Sword_Regular_B_Rec: 'slash-b-rec',
    Sword_Regular_C: 'slash-c',
    Sword_Block: 'block',
    Hit_Knockback: 'knockback',
    Sword_Dash: 'dash',
  },
};

/** Triangle budgets per outfit mesh (by name prefix); unlisted meshes keep 60 %. */
const BUDGET: [RegExp, number][] = [
  [/Feet_Boots/, 1500],
  [/Arms_Bracer/, 900],
  [/Arms/, 1400],
  [/Body_Belt/, 400],
  [/Body/, 2000],
  [/Head_Hood/, 1500],
  [/Legs/, 900],
  [/Pauldron/, 700],
  [/Face_Head/, 2400],
  [/Face_Eyes/, 300],
];

const { values } = parseArgs({
  options: {
    outfit: { type: 'string' },
    base: { type: 'string' },
    ual1: { type: 'string' },
    ual2: { type: 'string' },
    out: { type: 'string', default: path.resolve(import.meta.dirname, '../../client/public/assets/characters/hunter.glb') },
  },
});
for (const key of ['outfit', 'base', 'ual1', 'ual2'] as const) {
  if (!values[key]) throw new Error(`Missing --${key}`);
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

/** Reads a .gltf whose image URIs may be misnamed (the base pack has `_png.png` typos). */
async function readGltfLenient(file: string): Promise<Document> {
  const json = JSON.parse(await readFile(file, 'utf8'));
  const dir = path.dirname(file);
  const resources: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (const buffer of json.buffers ?? []) if (buffer.uri) resources[buffer.uri] = new Uint8Array(await readFile(path.join(dir, buffer.uri)));
  for (const image of json.images ?? []) {
    if (!image.uri) continue;
    let uri = image.uri as string;
    if (!existsSync(path.join(dir, uri))) uri = uri.replace(/_png\.png$/, '.png');
    resources[image.uri] = new Uint8Array(
      existsSync(path.join(dir, uri)) ? await readFile(path.join(dir, uri)) : await sharp({ create: { width: 4, height: 4, channels: 3, background: '#808080' } }).png().toBuffer(),
    );
  }
  return io.readJSON({ json, resources });
}

const doc = await io.read(values.outfit!);
const root = doc.getRoot();
const buffer = root.listBuffers()[0]!;
const skin = root.listSkins()[0]!;
const jointIndex = new Map(skin.listJoints().map((j, i) => [j.getName(), i] as const));
const nodeByName = new Map(root.listNodes().map((n) => [n.getName(), n] as const));
const outfitMeshNode = root.listNodes().find((n) => n.getSkin() === skin && n.getMesh())!;
const meshParent = outfitMeshNode.getParentNode();

// --- Face and eyes from the base body ------------------------------------------------------
{
  const base = await readGltfLenient(values.base!);
  const baseSkin = base.getRoot().listSkins()[0]!;
  const baseJoints = baseSkin.listJoints().map((j) => j.getName());
  const keep = new Set(['Head', 'neck_01']);
  for (const mesh of base.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const material = prim.getMaterial();
      const name = material?.getName() ?? '';
      if (/Hair/.test(name)) continue; // the hood covers the hair
      const isEyes = /Eye/.test(name);
      const out = copyPrimitive(prim, baseJoints, isEyes ? null : keep, doc, buffer, jointIndex);
      if (!out) continue;
      // Material: the base skin / eye textures, copied over.
      const srcTexture = material?.getBaseColorTexture();
      const mat = doc.createMaterial(isEyes ? 'Hunter_Eyes' : 'Hunter_Skin').setRoughnessFactor(0.8).setMetallicFactor(0);
      if (srcTexture) {
        const texture = doc.createTexture(srcTexture.getName()).setImage(srcTexture.getImage()!).setMimeType(srcTexture.getMimeType());
        mat.setBaseColorTexture(texture);
      }
      out.setMaterial(mat);
      const newMesh = doc.createMesh(isEyes ? 'Face_Eyes' : 'Face_Head').addPrimitive(out);
      const node = doc.createNode(newMesh.getName()).setMesh(newMesh).setSkin(skin);
      (meshParent ?? root.getDefaultScene()!).addChild(node);
      console.log(`${newMesh.getName().padEnd(12)} ${out.getIndices()!.getCount() / 3} tris from the base body`);
    }
  }
}

/** Copies a skinned primitive into `target`, keeping only triangles weighted to `keep` joints. */
function copyPrimitive(
  prim: Primitive,
  joints: string[],
  keep: Set<string> | null,
  target: Document,
  targetBuffer: ReturnType<Document['createBuffer']>,
  targetJoints: Map<string, number>,
): Primitive | null {
  const pos = prim.getAttribute('POSITION')!;
  const nrm = prim.getAttribute('NORMAL');
  const uv = prim.getAttribute('TEXCOORD_0');
  const jnt = prim.getAttribute('JOINTS_0')!;
  const wgt = prim.getAttribute('WEIGHTS_0')!;
  const idx = prim.getIndices()!;
  const dominant = (v: number) => {
    const j = jnt.getElement(v, []);
    const w = wgt.getElement(v, []);
    let best = 0;
    for (let k = 1; k < 4; k++) if (w[k]! > w[best]!) best = k;
    return joints[j[best]!]!;
  };
  const remap = new Map<number, number>();
  const order: number[] = [];
  const tris: number[] = [];
  for (let t = 0; t < idx.getCount(); t += 3) {
    const vs = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)];
    if (keep && !vs.every((v) => keep.has(dominant(v)))) continue;
    for (const v of vs) {
      if (!remap.has(v)) {
        remap.set(v, order.length);
        order.push(v);
      }
      tris.push(remap.get(v)!);
    }
  }
  if (tris.length === 0) return null;
  const take = (accessor: Accessor, size: number) => {
    const out = new Float32Array(order.length * size);
    order.forEach((v, i) => out.set(accessor.getElement(v, []).slice(0, size), i * size));
    return out;
  };
  const joints4 = new Uint16Array(order.length * 4);
  order.forEach((v, i) => {
    const j = jnt.getElement(v, []);
    for (let k = 0; k < 4; k++) joints4[i * 4 + k] = targetJoints.get(joints[j[k]!]!) ?? 0;
  });
  const acc = (type: 'VEC2' | 'VEC3' | 'VEC4' | 'SCALAR', array: Float32Array | Uint16Array | Uint32Array) =>
    target.createAccessor().setType(type).setArray(array).setBuffer(targetBuffer);
  const out = target.createPrimitive().setIndices(acc('SCALAR', new Uint32Array(tris)));
  out.setAttribute('POSITION', acc('VEC3', take(pos, 3)));
  if (nrm) out.setAttribute('NORMAL', acc('VEC3', take(nrm, 3)));
  if (uv) out.setAttribute('TEXCOORD_0', acc('VEC2', take(uv, 2)));
  out.setAttribute('JOINTS_0', acc('VEC4', joints4));
  out.setAttribute('WEIGHTS_0', acc('VEC4', take(wgt, 4)));
  return out;
}

// --- Animation clips -----------------------------------------------------------------------
for (const [lib, clips] of Object.entries(HUNTER_CLIPS) as ['ual1' | 'ual2', Record<string, string>][]) {
  const source = await io.read(values[lib]!);
  for (const anim of source.getRoot().listAnimations()) {
    const name = clips[anim.getName()];
    if (!name) continue;
    const out = doc.createAnimation(name);
    let channels = 0;
    for (const channel of anim.listChannels()) {
      const targetName = channel.getTargetNode()?.getName();
      const target = targetName ? nodeByName.get(targetName) : undefined;
      if (!target || !(skin.listJoints() as Node[]).includes(target)) continue;
      const sampler = channel.getSampler()!;
      const input = doc.createAccessor().setType('SCALAR').setArray(sampler.getInput()!.getArray()!.slice()).setBuffer(buffer);
      const output = doc
        .createAccessor()
        .setType(sampler.getOutput()!.getType())
        .setArray(sampler.getOutput()!.getArray()!.slice())
        .setBuffer(buffer);
      const s = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(sampler.getInterpolation());
      out.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(channel.getTargetPath()!).setSampler(s));
      channels++;
    }
    console.log(`clip ${anim.getName().padEnd(20)} → ${name.padEnd(12)} ${channels} channels`);
  }
}

// --- Slim down -----------------------------------------------------------------------------
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    for (const semantic of ['COLOR_0', 'COLOR_1', 'TEXCOORD_1']) prim.setAttribute(semantic, null);
  }
}
for (const material of root.listMaterials()) {
  material.setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null).setMetallicFactor(0).setRoughnessFactor(0.85);
}
await doc.transform(weld());
let before = 0;
let after = 0;
for (const mesh of root.listMeshes()) {
  const budget = BUDGET.find(([re]) => re.test(mesh.getName()))?.[1];
  for (const prim of mesh.listPrimitives()) {
    const count = prim.getIndices()!.getCount() / 3;
    before += count;
    const target = budget ?? count * 0.6;
    if (count > target) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: target / count, error: 0.01 });
    after += prim.getIndices()!.getCount() / 3;
  }
}
console.log(`triangles ${Math.round(before)} → ${Math.round(after)}`);

// Recolour the cloth: green hues become the hunter's deep teal; leather and metal stay.
for (const texture of root.listTextures()) {
  if (!/Ranger_BaseColor/.test(texture.getName() + (texture.getURI() ?? ''))) continue;
  const { data, info } = await sharp(texture.getImage()!).resize(1024, 1024).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min < 0.06 || g < r || g < b) continue; // only greens
    const v = max;
    const s = (max - min) / max;
    // Teal-blue at the same value, a touch less saturated.
    const hue = 196 / 360;
    const [nr, ng, nb] = hsvToRgb(hue, s * 0.8, Math.min(1, v * 1.15));
    data[i] = nr * 255;
    data[i + 1] = ng * 255;
    data[i + 2] = nb * 255;
  }
  // Lift the whole outfit a little: at gameplay distance the pack's dark leathers read as black.
  texture.setImage(await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).modulate({ brightness: 1.18 }).png().toBuffer()).setMimeType('image/png');
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  return ([[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]] as const)[i % 6] as [number, number, number];
}

await doc.transform(
  resample({ tolerance: 1e-4 }),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [1024, 1024], pattern: /Ranger/ }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [512, 512] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await mkdir(path.dirname(values.out!), { recursive: true });
await io.write(values.out!, doc);
await writeFile(
  path.join(path.dirname(values.out!), 'CREDITS.txt'),
  `hunter.glb: models and animations by Quaternius (https://quaternius.com), CC0 1.0:\n- Modular Character Outfits - Fantasy (Ranger outfit, recoloured)\n- Universal Base Characters (face and eyes)\n- Universal Animation Library 1 and 2 (clips)\nAssembled by apps/asset-pipeline/src/build-hunter.ts.\n`,
);
const { size } = await stat(values.out!);
console.log(`Wrote ${path.relative(process.cwd(), values.out!)} · ${(size / 1024).toFixed(0)} KB · ${root.listAnimations().length} clips`);

export type { Skin };
