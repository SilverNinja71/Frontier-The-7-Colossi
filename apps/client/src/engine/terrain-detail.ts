import * as THREE from 'three';

const SIZE = 256;

/**
 * One tileable RGBA detail texture, generated at load (zero download):
 * R grass clumps, G dirt with pebbles, B cracked rock, A rippled sand. The terrain shader uses
 * each channel as both a brightness pattern and a height for blending and bump.
 */
export function createTerrainDetailTexture(renderer: THREE.WebGLRenderer): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const i = (y * SIZE + x) * 4;

      // Grass: soft clumps plus fine blade noise.
      const clumps = periodicFbm(u, v, 6, 4, 1);
      const blades = periodicNoise(u * 64, v * 22, 64, 22, 5);
      data[i] = byte(0.24 + clumps * 0.6 + blades * 0.16);

      // Dirt: mottling with scattered pebbles (raised, lighter).
      const mottle = periodicFbm(u, v, 8, 4, 2);
      const [p1] = worley(u, v, 18, 11);
      const pebble = 1 - smoothstep(0.012, 0.03, p1);
      data[i + 1] = byte(0.26 + mottle * 0.5 + pebble * 0.22);

      // Rock: plates split by dark cracks, with grain.
      const [f1, f2] = worley(u, v, 9, 23);
      const crack = smoothstep(0.0, 0.035, f2 - f1);
      const grain = periodicFbm(u, v, 12, 4, 3);
      data[i + 2] = byte(0.1 + crack * 0.55 + grain * 0.38);

      // Sand: wind ripples warped by noise.
      const warp = periodicFbm(u, v, 4, 3, 4);
      const ripple = Math.sin((v * 9 + warp * 2.2) * Math.PI * 2) * 0.5 + 0.5;
      const grains = periodicFbm(u, v, 24, 3, 6);
      data[i + 3] = byte(0.32 + ripple * 0.16 + grains * 0.4);
    }
  }
  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value * 255)));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise that tiles with the given integer periods. */
function periodicNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % px) + px) % px;
  const y0 = ((iy % py) + py) % py;
  const x1 = (x0 + 1) % px;
  const y1 = (y0 + 1) % py;
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function periodicFbm(u: number, v: number, base: number, octaves: number, seed: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let norm = 0;
  let period = base;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * periodicNoise(u * period, v * period, period, period, seed + o * 17);
    norm += amplitude;
    amplitude *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

/** Nearest and second-nearest feature distances (one jittered point per cell, tiling). */
function worley(u: number, v: number, cells: number, seed: number): [number, number] {
  const gx = u * cells;
  const gy = v * cells;
  const cx = Math.floor(gx);
  const cy = Math.floor(gy);
  let f1 = Infinity;
  let f2 = Infinity;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const nx = cx + ox;
      const ny = cy + oy;
      const wx = ((nx % cells) + cells) % cells;
      const wy = ((ny % cells) + cells) % cells;
      const dx = nx + hash(wx, wy, seed) - gx;
      const dy = ny + hash(wx, wy, seed + 1) - gy;
      const d = dx * dx + dy * dy;
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return [Math.sqrt(f1) / cells, Math.sqrt(f2) / cells];
}
