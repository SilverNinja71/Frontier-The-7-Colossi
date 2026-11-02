import { biomeAt, CELL_SIZE, inLake, roadAt, WATER_LEVEL, WORLD_HALF, type Biome, type HeightGrid } from './geography.ts';

/**
 * Paints the world map (RGBA, north up) from the height grid: hypsometric tints, hill
 * shading from the north-west, roads and water. Pure, so it runs in tests and tools too.
 */
export function renderMapPixels(grid: HeightGrid, size: number): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const biome: Biome = { forest: 0, gloam: 0, highland: 0, amber: 0, mesa: 0 };
  const road = { weight: 0, x: 0, z: 0 };
  const step = (WORLD_HALF * 2) / size;
  for (let py = 0; py < size; py++) {
    const z = -WORLD_HALF + (py + 0.5) * step;
    for (let px = 0; px < size; px++) {
      const x = -WORLD_HALF + (px + 0.5) * step;
      const h = grid.sample(x, z);
      const shade = hillShade(grid, x, z);
      let r: number;
      let g: number;
      let b: number;
      if (h < WATER_LEVEL - 0.05 && inLake(x, z)) {
        const depth = Math.min(1, (WATER_LEVEL - h) / 1.4);
        r = 70 - depth * 30;
        g = 135 - depth * 35;
        b = 165 - depth * 20;
      } else {
        biomeAt(x, z, h, biome);
        // Meadow → forest → gloam → amber, then rock and snow with height.
        r = 128;
        g = 160;
        b = 84;
        r = lerp(r, 82, biome.forest);
        g = lerp(g, 128, biome.forest);
        b = lerp(b, 70, biome.forest);
        r = lerp(r, 70, biome.gloam);
        g = lerp(g, 90, biome.gloam);
        b = lerp(b, 88, biome.gloam);
        r = lerp(r, 190, biome.amber);
        g = lerp(g, 170, biome.amber);
        b = lerp(b, 88, biome.amber);
        const rock = Math.max(biome.mesa * 0.7, smoothstep(14, 30, h));
        r = lerp(r, 150, rock);
        g = lerp(g, 140, rock);
        b = lerp(b, 124, rock);
        const snow = smoothstep(38, 52, h);
        r = lerp(r, 240, snow);
        g = lerp(g, 242, snow);
        b = lerp(b, 246, snow);
        if (Math.hypot(x, z) < 31.5) {
          r = 214;
          g = 190;
          b = 140;
        }
        const w = roadAt(x, z, road).weight;
        if (w > 0.4) {
          r = lerp(r, 196, w);
          g = lerp(g, 160, w);
          b = lerp(b, 112, w);
        }
        const shore = inLake(x, z) ? 1 - smoothstep(WATER_LEVEL, WATER_LEVEL + 0.5, h) : 0;
        r = lerp(r, 212, shore);
        g = lerp(g, 196, shore);
        b = lerp(b, 150, shore);
      }
      const i = (py * size + px) * 4;
      pixels[i] = r * shade;
      pixels[i + 1] = g * shade;
      pixels[i + 2] = b * shade;
      pixels[i + 3] = 255;
    }
  }
  return pixels;
}

function hillShade(grid: HeightGrid, x: number, z: number): number {
  const e = CELL_SIZE * 1.5;
  const dx = grid.sample(x + e, z) - grid.sample(x - e, z);
  const dz = grid.sample(x, z + e) - grid.sample(x, z - e);
  // Light from the north-west, slightly exaggerated relief.
  const nx = -dx * 1.6;
  const nz = -dz * 1.6;
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz);
  const lit = (nx * -0.5 + ny * 0.7 + nz * -0.5) / len;
  return Math.max(0.55, Math.min(1.15, 0.45 + lit * 0.75));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
