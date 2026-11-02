import * as THREE from 'three';
import {
  ARENA_RADIUS,
  biomeAt,
  CELL_SIZE,
  fbm,
  GRID_CELLS,
  GULLET,
  inLake,
  roadAt,
  smoothstep,
  WATER_LEVEL,
  WORLD_HALF,
  WORLD_SIZE,
  type Biome,
  type HeightGrid,
} from '../world/geography.ts';
import type { PhysicsWorld } from './PhysicsWorld.ts';

const CHUNK_CELLS = 64;
const CHUNKS = GRID_CELLS / CHUNK_CELLS;
const SKIRT_DEPTH = 4;

/** Grass tints per biome (sRGB). */
const GRASS = {
  meadow: [0.42, 0.54, 0.28],
  forest: [0.31, 0.43, 0.23],
  gloam: [0.23, 0.31, 0.28],
  highland: [0.44, 0.5, 0.35],
  amber: [0.6, 0.56, 0.32],
} as const;

const VERTEX_PARS = /* glsl */ `
attribute vec4 splat;
attribute float forestFloor;
varying vec4 vSplat;
varying float vFloor;
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
`;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2DArray uLayers;
uniform vec3 uMean[6];
uniform vec3 uDirt;
uniform vec3 uRock;
uniform vec3 uSand;
uniform vec3 uSnow;
uniform vec3 uFloor;
varying vec4 vSplat;
varying float vFloor;
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;

float terrainLum(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

// A layer's variation around 1.0 (texture / its mean). Two scales, rotated against each other,
// so the tiling never lines up.
vec3 terrainDetail(int layer, vec2 uv) {
  vec3 a = texture(uLayers, vec3(uv, float(layer))).rgb;
  vec3 b = texture(uLayers, vec3(mat2(0.8, -0.6, 0.6, 0.8) * uv * 0.37 + 0.31, float(layer))).rgb;
  return mix(a, b, 0.4) / uMean[layer];
}

// The palette colour, varied by the scan: mostly in brightness, a little in hue.
vec3 terrainPaint(vec3 palette, vec3 detail, float hue) {
  return palette * mix(vec3(terrainLum(detail)), detail, hue);
}
`;

const FRAGMENT_COLOR = /* glsl */ `
vec2 wp = vTerrainPos.xz;
vec2 uv = wp * 0.13;
vec3 gD = terrainDetail(0, uv);
vec3 dD = terrainDetail(1, uv * 1.1);
vec3 sD = terrainDetail(3, uv);
vec3 nD = terrainDetail(4, uv * 0.8);
vec3 fD = terrainDetail(5, uv * 1.2);
// Rock is projected from three sides so cliffs never stretch.
vec3 tri = pow(abs(normalize(vTerrainNormal)), vec3(4.0));
tri /= tri.x + tri.y + tri.z;
vec3 rD = (texture(uLayers, vec3(vTerrainPos.zy * 0.09, 2.0)).rgb * tri.x
  + texture(uLayers, vec3(wp * 0.09, 2.0)).rgb * tri.y
  + texture(uLayers, vec3(vTerrainPos.xy * 0.09, 2.0)).rgb * tri.z) / uMean[2];

// Colour comes from the palette (grass from the per-biome vertex tint); the scans add variation.
vec3 grassT = terrainPaint(diffuseColor.rgb, gD, 0.45);
vec3 dirtT = terrainPaint(uDirt, dD, 0.5);
vec3 rockT = terrainPaint(uRock, rD, 0.6);
vec3 sandT = terrainPaint(uSand, sD, 0.4);
vec3 snowT = terrainPaint(uSnow, nD, 0.2);
vec3 floorT = terrainPaint(mix(uFloor, diffuseColor.rgb, 0.3), fD, 0.6);

// Height-based blending: each layer's own texture decides who wins along the borders.
float hG = clamp(terrainLum(gD) * 0.5, 0.0, 1.0);
float hD = clamp(terrainLum(dD) * 0.5, 0.0, 1.0);
float hR = clamp(terrainLum(rD) * 0.5, 0.0, 1.0);
float hS = clamp(terrainLum(sD) * 0.5, 0.0, 1.0);
float hN = clamp(terrainLum(nD) * 0.5, 0.0, 1.0);
float hF = clamp(terrainLum(fD) * 0.5, 0.0, 1.0);
float grassW = clamp(1.0 - vSplat.x - vSplat.y - vSplat.z - vSplat.w, 0.0, 1.0);
vec4 hw = vSplat * (vec4(0.6) + vec4(hD, hR, hS, hN) * 0.9);
float gw = grassW * (1.0 - vFloor) * (0.6 + hG * 0.9);
float fw = grassW * vFloor * (0.6 + hF * 0.9);
float top = max(max(max(hw.x, hw.y), max(hw.z, hw.w)), max(gw, fw)) - 0.2;
hw = max(hw - top, 0.0);
gw = max(gw - top, 0.0);
fw = max(fw - top, 0.0);
float total = max(hw.x + hw.y + hw.z + hw.w + gw + fw, 1e-4);
vec3 terrainCol = (grassT * gw + floorT * fw + dirtT * hw.x + rockT * hw.y + sandT * hw.z + snowT * hw.w) / total;
// Broad light/dark patches break up the field at a distance.
float macro = terrainLum(texture(uLayers, vec3(wp * 0.0097, 0.0)).rgb / uMean[0]);
terrainCol *= mix(1.0, clamp(macro, 0.6, 1.4), 0.55);
diffuseColor.rgb = terrainCol;
`;

/**
 * The Bramble Primeval's ground: 8×8 chunks (96 m) with three levels of detail and skirts, a
 * splat shader blending six ground layers (grass, dirt, rock, sand, snow, forest floor) by
 * slope, height, roads and biome: the colours are the game's palette and CC0 photo scans (one
 * texture array) supply the variation. Plus one Rapier heightfield.
 */
export class Terrain {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;

  constructor(
    private readonly grid: HeightGrid,
    physics: PhysicsWorld,
    layers: THREE.DataArrayTexture,
    layerMeans: readonly THREE.Vector3[],
    lowPower: boolean,
  ) {
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    const uniforms = {
      uLayers: { value: layers },
      uMean: { value: Array.from({ length: 6 }, (_, i) => layerMeans[i] ?? new THREE.Vector3(0.5, 0.5, 0.5)) },
      uDirt: { value: new THREE.Color().setRGB(0.55, 0.43, 0.3, THREE.SRGBColorSpace) },
      uRock: { value: new THREE.Color().setRGB(0.55, 0.52, 0.47, THREE.SRGBColorSpace) },
      uSand: { value: new THREE.Color().setRGB(0.8, 0.72, 0.54, THREE.SRGBColorSpace) },
      uSnow: { value: new THREE.Color().setRGB(0.93, 0.95, 0.98, THREE.SRGBColorSpace) },
      uFloor: { value: new THREE.Color().setRGB(0.36, 0.3, 0.2, THREE.SRGBColorSpace) },
    };
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSplat = splat;\nvFloor = forestFloor;\nvTerrainNormal = normal;\nvTerrainPos = (modelMatrix * vec4(position, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_COLOR}`);
    };
    this.material.customProgramCacheKey = () => 'frontier-terrain-layers';

    const fields = this.#vertexFields();
    const lodDistance = lowPower ? 110 : 190;
    for (let cz = 0; cz < CHUNKS; cz++) {
      for (let cx = 0; cx < CHUNKS; cx++) {
        const lod = new THREE.LOD();
        const centerX = -WORLD_HALF + (cx + 0.5) * CHUNK_CELLS * CELL_SIZE;
        const centerZ = -WORLD_HALF + (cz + 0.5) * CHUNK_CELLS * CELL_SIZE;
        lod.position.set(centerX, 0, centerZ);
        lod.addLevel(this.#chunkMesh(fields, cx, cz, 1, centerX, centerZ), 0);
        lod.addLevel(this.#chunkMesh(fields, cx, cz, 4, centerX, centerZ), lodDistance);
        lod.addLevel(this.#chunkMesh(fields, cx, cz, 16, centerX, centerZ), lodDistance * 2.6);
        this.group.add(lod);
      }
    }

    physics.addStatic(
      physics.rapier.ColliderDesc.heightfield(GRID_CELLS, GRID_CELLS, grid.toRapierHeights(), {
        x: WORLD_SIZE,
        y: 1,
        z: WORLD_SIZE,
      }).setFriction(0.8),
    );
  }

  /** Per-grid-vertex normal, grass tint and splat weights, shared by every LOD. */
  #vertexFields(): TerrainFields {
    const n = this.grid.size;
    const normals = new Float32Array(n * n * 3);
    const colors = new Uint8Array(n * n * 3);
    const splats = new Uint8Array(n * n * 4);
    const floors = new Uint8Array(n * n);
    const biome: Biome = { forest: 0, gloam: 0, highland: 0, amber: 0, mesa: 0 };
    const road = { weight: 0, x: 0, z: 0 };
    const tint = new THREE.Color();
    const c = [0, 0, 0];
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        const x = -WORLD_HALF + ix * CELL_SIZE;
        const z = -WORLD_HALF + iz * CELL_SIZE;
        const h = this.grid.at(ix, iz);
        const dx = this.grid.at(ix + 1, iz) - this.grid.at(ix - 1, iz);
        const dz = this.grid.at(ix, iz + 1) - this.grid.at(ix, iz - 1);
        const nx = -dx;
        const ny = 2 * CELL_SIZE;
        const nz = -dz;
        const len = Math.hypot(nx, ny, nz);
        normals[i * 3] = nx / len;
        normals[i * 3 + 1] = ny / len;
        normals[i * 3 + 2] = nz / len;
        const up = ny / len;

        biomeAt(x, z, h, biome);
        const patch = fbm(x * 0.045 + 9, z * 0.045 - 4);
        mixInto(c, GRASS.meadow, GRASS.forest, biome.forest);
        mixInto(c, c, GRASS.amber, biome.amber);
        mixInto(c, c, GRASS.highland, biome.highland);
        mixInto(c, c, GRASS.gloam, biome.gloam);
        const v = 0.86 + patch * 0.3;
        tint.setRGB(c[0]! * v, c[1]! * (0.92 + patch * 0.2), c[2]! * v, THREE.SRGBColorSpace);
        colors[i * 3] = byte(tint.r);
        colors[i * 3 + 1] = byte(tint.g);
        colors[i * 3 + 2] = byte(tint.b);

        const r = Math.hypot(x, z);
        const slope = 1 - up;
        let rock = smoothstep(0.2, 0.38, slope) + biome.mesa * smoothstep(0.08, 0.2, slope);
        rock += smoothstep(22, 34, h) * smoothstep(0.55, 0.7, fbm(x * 0.06, z * 0.06 + 5));
        let dirt = roadAt(x, z, road).weight * 0.95;
        dirt += biome.gloam * smoothstep(0.62, 0.75, patch) * 0.6;
        dirt += smoothstep(ARENA_RADIUS + 9, ARENA_RADIUS + 1.5, r) * 0.5; // trampled ground at the wall
        dirt += 1 - smoothstep(GULLET.radius - 1, GULLET.radius + 2, Math.hypot(x - GULLET.x, z - GULLET.z)); // the Gullet's gravel
        let sand = 1 - smoothstep(ARENA_RADIUS + 0.5, ARENA_RADIUS + 2.5, r);
        if (inLake(x, z)) sand += 1 - smoothstep(WATER_LEVEL + 0.35, WATER_LEVEL + 1.1, h);
        const snow = smoothstep(40, 50, h + patch * 6) * smoothstep(0.12, 0.3, up - 0.55);
        rock = Math.min(1, rock) * (1 - snow);
        sand = Math.min(1, sand);
        dirt = Math.min(1, dirt) * (1 - sand);
        splats[i * 4] = byte(dirt);
        splats[i * 4 + 1] = byte(rock);
        splats[i * 4 + 2] = byte(sand);
        splats[i * 4 + 3] = byte(snow);
        // Leaf litter and mud under the trees, darkest in the Gloamwood.
        floors[i] = byte(Math.min(1, biome.gloam * 0.85 + biome.forest * 0.55 * smoothstep(0.4, 0.62, patch)));
      }
    }
    return { normals, colors, splats, floors };
  }

  #chunkMesh(
    fields: TerrainFields,
    cx: number,
    cz: number,
    step: number,
    centerX: number,
    centerZ: number,
  ): THREE.Mesh {
    const n = this.grid.size;
    const side = CHUNK_CELLS / step + 1;
    const ix0 = cx * CHUNK_CELLS;
    const iz0 = cz * CHUNK_CELLS;
    const vertexCount = side * side + side * 4;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Uint8Array(vertexCount * 3);
    const splats = new Uint8Array(vertexCount * 4);
    const floors = new Uint8Array(vertexCount);
    const copy = (dst: number, ix: number, iz: number, drop: number) => {
      const src = iz * n + ix;
      positions[dst * 3] = -WORLD_HALF + ix * CELL_SIZE - centerX;
      positions[dst * 3 + 1] = this.grid.heights[src]! - drop;
      positions[dst * 3 + 2] = -WORLD_HALF + iz * CELL_SIZE - centerZ;
      normals.set(fields.normals.subarray(src * 3, src * 3 + 3), dst * 3);
      colors.set(fields.colors.subarray(src * 3, src * 3 + 3), dst * 3);
      splats.set(fields.splats.subarray(src * 4, src * 4 + 4), dst * 4);
      floors[dst] = fields.floors[src]!;
    };
    for (let j = 0; j < side; j++) {
      for (let i = 0; i < side; i++) copy(j * side + i, ix0 + i * step, iz0 + j * step, 0);
    }
    const indices: number[] = [];
    for (let j = 0; j < side - 1; j++) {
      for (let i = 0; i < side - 1; i++) {
        const a = j * side + i;
        const b = a + 1;
        const c = a + side;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    // Skirts: a curtain hanging from each edge hides cracks between levels of detail.
    const edges: [number, number][][] = [
      Array.from({ length: side }, (_, k) => [k, 0]),
      Array.from({ length: side }, (_, k) => [side - 1, k]),
      Array.from({ length: side }, (_, k) => [side - 1 - k, side - 1]),
      Array.from({ length: side }, (_, k) => [0, side - 1 - k]),
    ];
    let next = side * side;
    for (const edge of edges) {
      const start = next;
      for (const [i, j] of edge) copy(next++, ix0 + i * step, iz0 + j * step, SKIRT_DEPTH);
      for (let k = 0; k < side - 1; k++) {
        const top0 = edge[k]![1] * side + edge[k]![0];
        const top1 = edge[k + 1]![1] * side + edge[k + 1]![0];
        const bottom0 = start + k;
        const bottom1 = start + k + 1;
        indices.push(top0, bottom0, top1, top1, bottom0, bottom1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.setAttribute('splat', new THREE.BufferAttribute(splats, 4, true));
    geometry.setAttribute('forestFloor', new THREE.BufferAttribute(floors, 1, true));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

interface TerrainFields {
  normals: Float32Array;
  colors: Uint8Array;
  splats: Uint8Array;
  floors: Uint8Array;
}

function mixInto(out: number[], a: readonly number[], b: readonly number[], t: number): void {
  for (let k = 0; k < 3; k++) out[k] = a[k]! + (b[k]! - a[k]!) * t;
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}
