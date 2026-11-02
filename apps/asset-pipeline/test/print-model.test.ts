import { strToU8, zipSync } from 'fflate';
import { MeshoptSimplifier } from 'meshoptimizer';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildStatue, parse3mf, parseStl } from '../src/print-model.ts';

beforeAll(async () => {
  await MeshoptSimplifier.ready;
});

/** A Z-up UV sphere in millimetres sitting on the build plate, as a binary STL. */
function sphereStl(segments: number, radius = 40): Uint8Array {
  const tris: number[][] = [];
  const point = (i: number, j: number) => {
    const theta = (i / segments) * Math.PI;
    const phi = (j / segments) * Math.PI * 2;
    return [radius * Math.sin(theta) * Math.cos(phi) + 100, radius * Math.sin(theta) * Math.sin(phi) - 30, radius * Math.cos(theta) + radius];
  };
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < segments; j++) {
      const a = point(i, j), b = point(i + 1, j), c = point(i + 1, j + 1), d = point(i, j + 1);
      tris.push([...a, ...b, ...c], [...a, ...c, ...d]);
    }
  }
  const bytes = new Uint8Array(84 + tris.length * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, tris.length, true);
  tris.forEach((t, n) => t.forEach((v, k) => view.setFloat32(84 + n * 50 + 12 + k * 4, v, true)));
  return bytes;
}

describe('print model conversion', () => {
  it('reads binary and ASCII STL', () => {
    expect(parseStl(sphereStl(8)).length).toBe(8 * 8 * 2 * 9);
    const ascii = `solid t
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
endsolid t`;
    expect(Array.from(parseStl(new TextEncoder().encode(ascii)))).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  it('resolves 3MF components and build transforms', () => {
    const objects = `<?xml version="1.0"?><model xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>
      <object id="1" type="model"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices>
      <triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources></model>`;
    const main = `<?xml version="1.0"?><model xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"><resources>
      <object id="2" type="model"><components><component p:path="/3D/Objects/part.model" objectid="1" transform="2 0 0 0 2 0 0 0 2 10 0 0"/></components></object>
      </resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 5"/></build></model>`;
    const zip = zipSync({ '3D/3dmodel.model': strToU8(main), '3D/Objects/part.model': strToU8(objects) });
    // Component: scale 2 then +10 x; item: +5 z.
    expect(Array.from(parse3mf(zip))).toEqual([10, 0, 5, 12, 0, 5, 10, 2, 5]);
  });

  it('stands a Z-up print model upright, scales it to height, and meets the triangle budget', async () => {
    const soup = parseStl(sphereStl(120)); // 28,800 triangles
    const { doc, trianglesBefore, trianglesAfter } = await buildStatue(
      soup,
      { targetHeight: 3.4, maxTriangles: 2000, upAxis: 'z', yawDegrees: 0 },
      MeshoptSimplifier,
    );
    expect(trianglesBefore).toBe(28_800);
    expect(trianglesAfter).toBeLessThanOrEqual(2000);
    const position = doc.getRoot().listAccessors().find((a) => a.getType() === 'VEC3' && a.getCount() > 0)!;
    const [minX, minY, minZ] = position.getMin([]);
    const [maxX, maxY, maxZ] = position.getMax([]);
    expect(minY).toBeCloseTo(0, 3);
    expect(maxY).toBeCloseTo(3.4, 1);
    expect((minX! + maxX!) / 2).toBeCloseTo(0, 2);
    expect((minZ! + maxZ!) / 2).toBeCloseTo(0, 2);
  });
});
