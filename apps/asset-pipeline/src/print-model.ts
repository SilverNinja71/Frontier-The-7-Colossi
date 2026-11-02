/**
 * Turns 3D-print models (STL / 3MF, as found on MakerWorld, Printables, Thingiverse) into a
 * game-ready statue: Z-up millimetres → Y-up metres on the ground, welded, simplified to a
 * triangle budget, smooth normals, bronze material. Print models have no rig and no UVs, so
 * they become static props (statues, showpieces), never animated characters.
 */
import { Document, type Node, type Primitive } from '@gltf-transform/core';
import { simplify, weld } from '@gltf-transform/functions';
import { strFromU8, unzipSync } from 'fflate';
import type { MeshoptSimplifier as Simplifier } from 'meshoptimizer';

/** Triangle soup: 9 floats (three xyz vertices) per triangle. */
export type Soup = Float32Array;

export interface StatueOptions {
  /** Final height in metres. */
  targetHeight: number;
  maxTriangles: number;
  /** Print files are Z-up; glTF sources are already Y-up. */
  upAxis: 'z' | 'y';
  /** Extra turn about the vertical axis, degrees, if the model faces the wrong way. */
  yawDegrees: number;
}

export function parseStl(data: Uint8Array): Soup {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.byteLength >= 84) {
    const count = view.getUint32(80, true);
    if (84 + count * 50 === data.byteLength) {
      const soup = new Float32Array(count * 9);
      for (let t = 0; t < count; t++) {
        const base = 84 + t * 50 + 12; // skip the facet normal
        for (let k = 0; k < 9; k++) soup[t * 9 + k] = view.getFloat32(base + k * 4, true);
      }
      return soup;
    }
  }
  const text = strFromU8(data);
  const values: number[] = [];
  for (const match of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) {
    values.push(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  if (values.length === 0 || values.length % 9 !== 0) throw new Error('Not a readable STL file');
  return Float32Array.from(values);
}

interface ModelObject {
  vertices?: Float32Array;
  triangles?: Uint32Array;
  components: { objectId: string; path: string | null; transform: number[] | null }[];
}

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

/** 3MF: a zip of XML models; resolves components and build-item transforms. */
export function parse3mf(data: Uint8Array): Soup {
  const files = unzipSync(data);
  const models = new Map<string, Map<string, ModelObject>>();
  let mainPath: string | null = null;
  let mainXml = '';
  for (const [name, bytes] of Object.entries(files)) {
    if (!name.toLowerCase().endsWith('.model')) continue;
    const path = ('/' + name.replace(/^\/+/, '')).toLowerCase();
    const xml = strFromU8(bytes);
    models.set(path, parseModelXml(xml));
    if (/<build[\s>]/.test(xml)) {
      mainPath = path;
      mainXml = xml;
    }
  }
  if (!mainPath) throw new Error('3MF has no <build> section');

  const out: number[] = [];
  const emit = (path: string, objectId: string, transform: number[], depth: number) => {
    if (depth > 16) throw new Error('3MF component nesting too deep');
    const object = models.get(path)?.get(objectId);
    if (!object) throw new Error(`3MF object ${objectId} not found in ${path}`);
    if (object.vertices && object.triangles) {
      const v = object.vertices;
      for (let i = 0; i < object.triangles.length; i++) {
        const k = object.triangles[i]! * 3;
        const [x, y, z] = applyTransform(transform, v[k]!, v[k + 1]!, v[k + 2]!);
        out.push(x, y, z);
      }
    }
    for (const component of object.components) {
      // Component transforms apply first, then the parent's.
      const combined = composeTransforms(component.transform ?? IDENTITY, transform);
      emit(component.path?.toLowerCase() ?? path, component.objectId, combined, depth + 1);
    }
  };

  const build = mainXml.slice(mainXml.search(/<build[\s>]/));
  for (const item of build.matchAll(/<item\b([^>]*)\/?>/g)) {
    const attrs = attributes(item[1]!);
    if (!attrs.objectid) continue;
    emit(attrs['p:path']?.toLowerCase() ?? mainPath, attrs.objectid, parseTransform(attrs.transform) ?? IDENTITY, 0);
  }
  if (out.length === 0) throw new Error('3MF build produced no triangles');
  return Float32Array.from(out);
}

function parseModelXml(xml: string): Map<string, ModelObject> {
  const objects = new Map<string, ModelObject>();
  for (const match of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
    const id = attributes(match[1]!).id;
    if (!id) continue;
    const body = match[2]!;
    const object: ModelObject = { components: [] };
    const vertexBlock = /<vertices>([\s\S]*?)<\/vertices>/.exec(body)?.[1];
    if (vertexBlock) {
      const values: number[] = [];
      for (const v of vertexBlock.matchAll(/<vertex\b([^>]*)\/>/g)) {
        const a = attributes(v[1]!);
        values.push(Number(a.x), Number(a.y), Number(a.z));
      }
      object.vertices = Float32Array.from(values);
      const indices: number[] = [];
      const triangleBlock = /<triangles>([\s\S]*?)<\/triangles>/.exec(body)?.[1] ?? '';
      for (const t of triangleBlock.matchAll(/<triangle\b([^>]*)\/>/g)) {
        const a = attributes(t[1]!);
        indices.push(Number(a.v1), Number(a.v2), Number(a.v3));
      }
      object.triangles = Uint32Array.from(indices);
    }
    for (const c of body.matchAll(/<component\b([^>]*)\/>/g)) {
      const a = attributes(c[1]!);
      if (a.objectid) object.components.push({ objectId: a.objectid, path: a['p:path'] ?? null, transform: parseTransform(a.transform) });
    }
    objects.set(id, object);
  }
  return objects;
}

function attributes(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)) out[m[1]!] = m[2]!;
  return out;
}

/** 3MF transforms are 3×4 row-major "m00 m01 m02 m10 … m32" applied as p' = p · M. */
function parseTransform(value: string | undefined): number[] | null {
  if (!value) return null;
  const numbers = value.trim().split(/\s+/).map(Number);
  return numbers.length === 12 && numbers.every(Number.isFinite) ? numbers : null;
}

function applyTransform(m: readonly number[], x: number, y: number, z: number): [number, number, number] {
  return [
    x * m[0]! + y * m[3]! + z * m[6]! + m[9]!,
    x * m[1]! + y * m[4]! + z * m[7]! + m[10]!,
    x * m[2]! + y * m[5]! + z * m[8]! + m[11]!,
  ];
}

/** Returns the transform equivalent to applying `first` and then `second`. */
function composeTransforms(first: readonly number[], second: readonly number[]): number[] {
  const out: number[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out.push(first[row * 3]! * second[col]! + first[row * 3 + 1]! * second[3 + col]! + first[row * 3 + 2]! * second[6 + col]!);
    }
  }
  const [tx, ty, tz] = applyTransform(second, first[9]!, first[10]!, first[11]!);
  out.push(tx, ty, tz);
  return out;
}

/** Collects every triangle of a glTF document in world space (for .glb/.gltf inputs). */
export function soupFromDocument(doc: Document): Soup {
  const out: number[] = [];
  const visit = (node: Node, parent: number[]) => {
    const world = multiply4(parent, node.getMatrix() as number[]);
    for (const prim of node.getMesh()?.listPrimitives() ?? []) {
      const position = prim.getAttribute('POSITION');
      if (!position) continue;
      const indices = prim.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      const element: number[] = [];
      for (let i = 0; i < count; i++) {
        position.getElement(indices ? indices.getScalar(i) : i, element);
        const [x, y, z] = element as [number, number, number];
        out.push(
          world[0]! * x + world[4]! * y + world[8]! * z + world[12]!,
          world[1]! * x + world[5]! * y + world[9]! * z + world[13]!,
          world[2]! * x + world[6]! * y + world[10]! * z + world[14]!,
        );
      }
    }
    for (const child of node.listChildren()) visit(child, world);
  };
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  for (const node of scene?.listChildren() ?? []) visit(node, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return Float32Array.from(out);
}

function multiply4(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[col * 4 + row]! += a[k * 4 + row]! * b[col * 4 + k]!;
    }
  }
  return out;
}

/**
 * Normalises orientation and scale, welds, simplifies and returns a one-node document
 * ("Statue") with a bronze material. Geometry compression is left to the writer.
 */
export async function buildStatue(
  soup: Soup,
  options: StatueOptions,
  simplifier: typeof Simplifier,
): Promise<{ doc: Document; trianglesBefore: number; trianglesAfter: number }> {
  const positions = new Float32Array(soup.length);
  const yaw = (options.yawDegrees * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  for (let i = 0; i < soup.length; i += 3) {
    let x = soup[i]!;
    let y = soup[i + 1]!;
    let z = soup[i + 2]!;
    if (options.upAxis === 'z') [y, z] = [z, -y]; // Z-up → Y-up
    positions[i] = x * cos + z * sin;
    positions[i + 1] = y;
    positions[i + 2] = -x * sin + z * cos;
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3;
    min[axis] = Math.min(min[axis]!, positions[i]!);
    max[axis] = Math.max(max[axis]!, positions[i]!);
  }
  const height = max[1]! - min[1]!;
  if (!(height > 0)) throw new Error('Model has no height');
  const scale = options.targetHeight / height;
  const centerX = (min[0]! + max[0]!) / 2;
  const centerZ = (min[2]! + max[2]!) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i]! - centerX) * scale;
    positions[i + 1] = (positions[i + 1]! - min[1]!) * scale;
    positions[i + 2] = (positions[i + 2]! - centerZ) * scale;
  }

  const doc = new Document();
  const buffer = doc.createBuffer();
  const material = doc
    .createMaterial('Bronze')
    .setBaseColorFactor([0.62, 0.47, 0.29, 1])
    .setMetallicFactor(0.75)
    .setRoughnessFactor(0.4);
  const primitive = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor('POSITION').setType('VEC3').setArray(positions).setBuffer(buffer))
    .setMaterial(material);
  const mesh = doc.createMesh('Statue').addPrimitive(primitive);
  const scene = doc.createScene('Statue').addChild(doc.createNode('Statue').setMesh(mesh));
  doc.getRoot().setDefaultScene(scene);

  const trianglesBefore = positions.length / 9;
  await doc.transform(weld());
  const ratio = Math.min(1, options.maxTriangles / trianglesBefore);
  if (ratio < 1) await doc.transform(simplify({ simplifier, ratio, error: 0.01 }));
  const welded = doc.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
  addSmoothNormals(welded, doc);
  return { doc, trianglesBefore, trianglesAfter: welded.getIndices()!.getCount() / 3 };
}

/** Area-weighted vertex normals on the welded mesh (gltf-transform's normals() is flat). */
function addSmoothNormals(prim: Primitive, doc: Document): void {
  const position = prim.getAttribute('POSITION')!.getArray()!;
  const index = prim.getIndices()!.getArray()!;
  const normal = new Float32Array(position.length);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i]! * 3;
    const b = index[i + 1]! * 3;
    const c = index[i + 2]! * 3;
    const abx = position[b]! - position[a]!, aby = position[b + 1]! - position[a + 1]!, abz = position[b + 2]! - position[a + 2]!;
    const acx = position[c]! - position[a]!, acy = position[c + 1]! - position[a + 1]!, acz = position[c + 2]! - position[a + 2]!;
    // Cross product length is twice the triangle area: larger faces weigh more.
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const v of [a, b, c]) {
      normal[v]! += nx;
      normal[v + 1]! += ny;
      normal[v + 2]! += nz;
    }
  }
  for (let v = 0; v < normal.length; v += 3) {
    const length = Math.hypot(normal[v]!, normal[v + 1]!, normal[v + 2]!) || 1;
    normal[v]! /= length;
    normal[v + 1]! /= length;
    normal[v + 2]! /= length;
  }
  prim.setAttribute('NORMAL', doc.createAccessor('NORMAL').setType('VEC3').setArray(normal).setBuffer(doc.getRoot().listBuffers()[0]!));
}
