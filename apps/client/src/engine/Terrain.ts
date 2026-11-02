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
import { createTerrainDetailTexture } from './terrain-detail.ts';

const CHUNK_CELLS = 64;
const CHUNKS = GRID_CELLS / CHUNK_CELLS;
const SKIRT_DEPTH = 4;

/** Grass tints per biome (sRGB). */
const GRASS = {
  meadow: [0.43, 0.6, 0.27],
  forest: [0.3, 0.47, 0.21],
  gloam: [0.22, 0.32, 0.29],
  highland: [0.42, 0.53, 0.33],
  amber: [0.72, 0.63, 0.29],
} as const;

const VERTEX_PARS = /* glsl */ `
attribute vec4 splat;
varying vec4 vSplat;
varying vec3 vTerrainPos;
`;

const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uDetail;
uniform vec3 uDirt;
uniform vec3 uRock;
uniform vec3 uSand;
uniform vec3 uSnow;
varying vec4 vSplat;
varying vec3 vTerrainPos;

// Screen-space bump from a scalar height (same math as three's bump map).
vec3 terrainBump(vec3 surfPos, vec3 surfNorm, float height, float strength, float faceDir) {
  vec3 sigmaX = dFdx(surfPos);
  vec3 sigmaY = dFdy(surfPos);
  vec3 r1 = cross(sigmaY, surfNorm);
  vec3 r2 = cross(surfNorm, sigmaX);
  float det = dot(sigmaX, r1) * faceDir;
  vec2 dh = vec2(dFdx(height), dFdy(height)) * strength;
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

const FRAGMENT_COLOR = /* glsl */ `
vec2 wp = vTerrainPos.xz;
vec4 dNear = texture2D(uDetail, wp * 0.23);
vec4 dFar = texture2D(uDetail, wp * 0.041 + vec2(0.37, 0.61));
vec4 det = mix(dNear, dFar, 0.38);
// Steep rock reads better projected sideways (cliff strata instead of stretched plates).
vec4 dSide = texture2D(uDetail, vec2(wp.x + wp.y, vTerrainPos.y * 1.6) * 0.16);
det.b = mix(det.b, dSide.b, clamp(vSplat.y * 1.2, 0.0, 1.0));
float macro = texture2D(uDetail, wp * 0.0063 + 0.13).r;

float grassW = clamp(1.0 - vSplat.x - vSplat.y - vSplat.z - vSplat.w, 0.0, 1.0);
// Height-based blending: each layer's own detail decides who wins at the borders.
vec4 hw = vSplat * (vec4(0.55) + vec4(det.g, det.b, det.a, 0.4 + 0.3 * det.r));
float gw = grassW * (0.55 + det.r);
float top = max(max(max(hw.x, hw.y), max(hw.z, hw.w)), gw) - 0.22;
hw = max(hw - top, 0.0);
gw = max(gw - top, 0.0);
float total = max(hw.x + hw.y + hw.z + hw.w + gw, 1e-4);

vec3 grassCol = diffuseColor.rgb * (0.8 + 0.4 * det.r);
vec3 dirtCol = uDirt * (0.8 + 0.4 * det.g);
vec3 rockCol = uRock * (0.7 + 0.5 * det.b);
vec3 sandCol = uSand * (0.9 + 0.18 * det.a);
vec3 snowCol = uSnow * (0.95 + 0.08 * det.r);
vec3 terrainCol = (grassCol * gw + dirtCol * hw.x + rockCol * hw.y + sandCol * hw.z + snowCol * hw.w) / total;
terrainCol *= 0.88 + 0.24 * macro;
diffuseColor.rgb = terrainCol;
float terrainHeight = (det.r * gw * 0.7 + det.g * hw.x + det.b * hw.y * 1.3 + det.a * hw.z * 0.4 + det.r * hw.w * 0.15) / total;
`;

const FRAGMENT_NORMAL = /* glsl */ `
normal = terrainBump(-vViewPosition, normal, terrainHeight, 0.55, faceDirection);
`;

/**
 * The Bramble Primeval' ground: 8×8 chunks (96 m) with two levels of detail and skirts, a
 * splat shader that blends grass, dirt, rock, sand and snow with procedural detail and bump,
 * and a single Rapier heightfield for collision.
 */
export class Terrain {
  readonly group = new THREE.Group();
  readonly material: THREE.MeshStandardMaterial;

  constructor(
    private readonly grid: HeightGrid,
    physics: PhysicsWorld,
    renderer: THREE.WebGLRenderer,
    lowPower: boolean,
  ) {
    const detail = createTerrainDetailTexture(renderer);
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
    const uniforms = {
      uDetail: { value: detail },
      uDirt: { value: new THREE.Color().setRGB(0.55, 0.42, 0.29, THREE.SRGBColorSpace) },
      uRock: { value: new THREE.Color().setRGB(0.56, 0.54, 0.5, THREE.SRGBColorSpace) },
      uSand: { value: new THREE.Color().setRGB(0.83, 0.75, 0.56, THREE.SRGBColorSpace) },
      uSnow: { value: new THREE.Color().setRGB(0.93, 0.95, 0.98, THREE.SRGBColorSpace) },
    };
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSplat = splat;\nvTerrainPos = (modelMatrix * vec4(position, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_COLOR}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAGMENT_NORMAL}`);
    };
    this.material.customProgramCacheKey = () => 'frontier-terrain';

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
  #vertexFields(): { normals: Float32Array; colors: Uint8Array; splats: Uint8Array } {
    const n = this.grid.size;
    const normals = new Float32Array(n * n * 3);
    const colors = new Uint8Array(n * n * 3);
    const splats = new Uint8Array(n * n * 4);
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
        dirt += biome.gloam * smoothstep(0.55, 0.7, patch) * 0.8;
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
      }
    }
    return { normals, colors, splats };
  }

  #chunkMesh(
    fields: { normals: Float32Array; colors: Uint8Array; splats: Uint8Array },
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
    const copy = (dst: number, ix: number, iz: number, drop: number) => {
      const src = iz * n + ix;
      positions[dst * 3] = -WORLD_HALF + ix * CELL_SIZE - centerX;
      positions[dst * 3 + 1] = this.grid.heights[src]! - drop;
      positions[dst * 3 + 2] = -WORLD_HALF + iz * CELL_SIZE - centerZ;
      normals.set(fields.normals.subarray(src * 3, src * 3 + 3), dst * 3);
      colors.set(fields.colors.subarray(src * 3, src * 3 + 3), dst * 3);
      splats.set(fields.splats.subarray(src * 4, src * 4 + 4), dst * 4);
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
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

function mixInto(out: number[], a: readonly number[], b: readonly number[], t: number): void {
  for (let k = 0; k < 3; k++) out[k] = a[k]! + (b[k]! - a[k]!) * t;
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}
