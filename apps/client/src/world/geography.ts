/**
 * The Bramble Wilds: a deterministic, seed-free description of the explorable world.
 *
 * Pure math (no three.js) so the server can rebuild identical collision later. Everything the
 * client renders or collides with derives from `baseHeight`/`heightAt` and the tables below.
 * Axes: +x east, -z north (north is "up" on the map).
 */

export const WORLD_SIZE = 768;
export const WORLD_HALF = WORLD_SIZE / 2;
/** Height samples per side minus one (1.5 m spacing). */
export const GRID_CELLS = 512;
export const CELL_SIZE = WORLD_SIZE / GRID_CELLS;
export const ARENA_RADIUS = 30;
/** Past this the land climbs into impassable mountains. */
export const PLAYABLE_RADIUS = 300;
export const WATER_LEVEL = 0.6;

export interface Point {
  x: number;
  z: number;
}

// --- Regions ---------------------------------------------------------------------

export const LAKE = { x: 178, z: 32, radius: 60 };
export const ISLE = { x: 186, z: 38, radius: 11 };
const RIDGE = { x: -30, z: -238, height: 46 };
const GORGE = { from: { x: 112, z: -104 }, to: { x: 214, z: -214 }, plateau: { x: 162, z: -160, radius: 78 }, depth: 19 };
const COLONNADE = { x: -24, z: 192, radius: 30, height: 3.2 };
const GLOAM = { x: -212, z: -18, radius: 105 };
const MOONLESS_CIRCLE = { x: -214, z: -20, radius: 16 };
const MEADOW_HILL = { x: 168, z: 176, radius: 46, height: 6 };

/** Dirt roads from the arena gates out to the landmarks. */
export const ROADS: readonly (readonly Point[])[] = [
  // North gate → Howling Ridge
  [{ x: 0, z: -31 }, { x: 2, z: -70 }, { x: -12, z: -122 }, { x: -22, z: -178 }, { x: -29, z: -226 }],
  // East gate → Mirror Lake
  [{ x: 31, z: 0 }, { x: 64, z: 4 }, { x: 98, z: 16 }, { x: 112, z: 24 }],
  // East fork → Windcut Gorge
  [{ x: 64, z: 4 }, { x: 92, z: -48 }, { x: 112, z: -104 }, { x: 162, z: -160 }, { x: 204, z: -204 }],
  // South gate → Fallen Colonnade
  [{ x: 0, z: 31 }, { x: 0, z: 74 }, { x: -14, z: 132 }, { x: -22, z: 172 }],
  // South fork → Amber Meadow
  [{ x: 0, z: 74 }, { x: 58, z: 112 }, { x: 118, z: 158 }, { x: 150, z: 172 }],
  // West gate → Gloamwood
  [{ x: -31, z: 0 }, { x: -72, z: -6 }, { x: -140, z: -14 }, { x: -196, z: -20 }],
];
const ROAD_HALF_WIDTH = 2.6;
const ROAD_BLEND = 4.5;

// --- Landmarks ------------------------------------------------------------------------

export interface Landmark {
  id: string;
  name: string;
  /** One line shown when it is discovered. */
  blurb: string;
  x: number;
  z: number;
  /** Discovery radius. */
  radius: number;
  /** Waystone position (respawn / fast-travel point). */
  stone: Point;
}

export const LANDMARKS: readonly Landmark[] = [
  {
    id: 'firstia',
    name: 'Bastion Training Grounds',
    blurb: 'Where every hunter learns the rhythm.',
    x: 0,
    z: 0,
    radius: 34,
    stone: { x: 6, z: 42 },
  },
  {
    id: 'mirror-lake',
    name: 'Mirror Lake',
    blurb: 'Still water that remembers the moon.',
    x: 116,
    z: 26,
    radius: 22,
    stone: { x: 112, z: 30 },
  },
  {
    id: 'moon-isle',
    name: 'Moon Isle Shrine',
    blurb: 'Wade out. Someone left offerings for a monkey king.',
    x: ISLE.x,
    z: ISLE.z,
    radius: 12,
    stone: { x: ISLE.x + 2.5, z: ISLE.z + 5 },
  },
  {
    id: 'howling-ridge',
    name: 'Howling Ridge Lookout',
    blurb: 'The whole frontier, laid out below.',
    x: RIDGE.x,
    z: RIDGE.z + 6,
    radius: 18,
    stone: { x: RIDGE.x + 5, z: RIDGE.z + 12 },
  },
  {
    id: 'windcut-arch',
    name: 'Windcut Arch',
    blurb: 'The gorge sings when the wind turns north.',
    x: GORGE.plateau.x,
    z: GORGE.plateau.z,
    radius: 20,
    stone: { x: GORGE.plateau.x - 9, z: GORGE.plateau.z + 7 },
  },
  {
    id: 'fallen-colonnade',
    name: 'Fallen Colonnade',
    blurb: 'An older order trained here, long before the First Bastion.',
    x: COLONNADE.x,
    z: COLONNADE.z,
    radius: 26,
    stone: { x: COLONNADE.x + 3, z: COLONNADE.z - 22 },
  },
  {
    id: 'moonless-circle',
    name: 'The Moonless Circle',
    blurb: 'Nothing grows straight in the Gloamwood. Something sleeps here.',
    x: MOONLESS_CIRCLE.x,
    z: MOONLESS_CIRCLE.z,
    radius: 24,
    stone: { x: MOONLESS_CIRCLE.x + 17, z: MOONLESS_CIRCLE.z + 3 },
  },
  {
    id: 'elder-oak',
    name: 'The Elder Oak',
    blurb: 'The oldest tree in the wilds, and the widest shade.',
    x: MEADOW_HILL.x,
    z: MEADOW_HILL.z,
    radius: 22,
    stone: { x: MEADOW_HILL.x - 16, z: MEADOW_HILL.z - 2 },
  },
];

export const STRUCTURES = { RIDGE, GORGE, COLONNADE, GLOAM, MOONLESS_CIRCLE, MEADOW_HILL };

// --- Height --------------------------------------------------------------------------

/** Terrain height before roads are cut in. */
export function baseHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);

  // Rolling hills, calm near the arena and growing with distance.
  const wild = smoothstep(ARENA_RADIUS + 6, 120, r);
  let h = ((fbm(x * 0.011, z * 0.011) - 0.47) * 15 + (fbm(x * 0.034 + 11, z * 0.034 - 7) - 0.5) * 3.5) * (0.25 + 0.75 * wild) + 2.6 * wild;
  h += smoothstep(ARENA_RADIUS + 2, ARENA_RADIUS + 22, r) * 1.2; // a low rise around the ring

  // Howling Ridge: a long east-west ridge with ridged crags.
  {
    const dx = (x - RIDGE.x) / 1.7;
    const dz = z - RIDGE.z;
    const d2 = dx * dx + dz * dz;
    const ridge = Math.exp(-d2 / (2 * 58 * 58));
    if (ridge > 0.002) {
      const crag = 1 - Math.abs(fbm(x * 0.03 - 5, z * 0.03 + 9) * 2 - 1);
      h += ridge * (RIDGE.height + crag * 9 * smoothstep(0.25, 0.7, ridge));
    }
    // A flat summit for the lookout.
    const summit = 1 - smoothstep(9, 16, Math.hypot(x - RIDGE.x, z - (RIDGE.z + 6)));
    if (summit > 0) h = mix(h, summitHeight(), summit);
  }

  // Windcut: a raised mesa split by a narrow gorge.
  {
    const p = GORGE.plateau;
    const near = Math.hypot(x - p.x, z - p.z);
    const plateau = near > p.radius + 12 ? 0 : 1 - smoothstep(p.radius * 0.55, p.radius, near + (fbm(x * 0.04, z * 0.04) - 0.5) * 22);
    if (plateau > 0) {
      const d = distanceToSegment(x, z, GORGE.from, GORGE.to) + (fbm(x * 0.09 + 3, z * 0.09) - 0.5) * 5;
      const cut = 1 - smoothstep(6, 13, d);
      h += plateau * GORGE.depth * (1 - cut) + plateau * (fbm(x * 0.06 + 2, z * 0.06 + 4) - 0.5) * 6 * (1 - cut);
    }
  }

  // Fallen Colonnade: a raised terrace.
  {
    const d = Math.hypot(x - COLONNADE.x, z - COLONNADE.z);
    h = mix(h, COLONNADE.height, 1 - smoothstep(COLONNADE.radius, COLONNADE.radius + 16, d));
  }

  // Gloamwood: a low, damp hollow with knolls; a flat clearing at the stone circle.
  {
    const g = 1 - smoothstep(GLOAM.radius * 0.5, GLOAM.radius, Math.hypot(x - GLOAM.x, z - GLOAM.z));
    if (g > 0) h += g * ((fbm(x * 0.05 + 21, z * 0.05 - 13) - 0.5) * 5 - 1.5);
    const clearing = 1 - smoothstep(MOONLESS_CIRCLE.radius, MOONLESS_CIRCLE.radius + 10, Math.hypot(x - MOONLESS_CIRCLE.x, z - MOONLESS_CIRCLE.z));
    if (clearing > 0) h = mix(h, -0.5, clearing);
  }

  // Amber Meadow: a gentle dome crowned by the Elder Oak.
  {
    const d = Math.hypot(x - MEADOW_HILL.x, z - MEADOW_HILL.z);
    const dome = 1 - smoothstep(0, MEADOW_HILL.radius, d);
    h += dome * dome * (3 - 2 * dome) * MEADOW_HILL.height;
    const top = 1 - smoothstep(8, 18, d);
    if (top > 0) h = mix(h, meadowTopHeight(), top);
  }

  // Mirror Lake: a raised rim, a shallow wading bed, and the isle.
  const lakeDistance = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (lakeDistance < LAKE.radius * 1.7 + 14) {
    const warp = (fbm(x * 0.025 + 40, z * 0.025 - 40) - 0.5) * 26;
    const d = lakeDistance + warp;
    const rim = 1 - smoothstep(LAKE.radius * 1.1, LAKE.radius * 1.7, d);
    if (rim > 0) h = mix(h, Math.max(h, WATER_LEVEL + 1.1), rim);
    const bowl = 1 - smoothstep(LAKE.radius * 0.72, LAKE.radius * 1.04, d);
    if (bowl > 0) {
      const bed = WATER_LEVEL - 0.25 - 1.0 * smoothstep(LAKE.radius * 0.95, LAKE.radius * 0.55, d);
      h = mix(h, bed, bowl);
      const isle = 1 - smoothstep(ISLE.radius * 0.35, ISLE.radius, Math.hypot(x - ISLE.x, z - ISLE.z));
      h += isle * isle * (3 - 2 * isle) * 2.6;
    }
  }

  // The world's edge: mountains that cannot be climbed.
  const edge = smoothstep(PLAYABLE_RADIUS - 10, PLAYABLE_RADIUS + 70, r);
  if (edge > 0) h += edge * (48 + fbm(x * 0.02 + 70, z * 0.02 + 30) * 40) + edge * edge * 20;

  // The arena floor is exactly level (gameplay assumes y = 0 inside the ring).
  const arena = 1 - smoothstep(ARENA_RADIUS + 2.5, ARENA_RADIUS + 14, r);
  return mix(h, 0, arena);
}

function summitHeight(): number {
  return RIDGE.height + 4;
}

function meadowTopHeight(): number {
  return MEADOW_HILL.height + 1.2;
}

export interface RoadSample {
  /** 0..1 road surface weight (1 on the carriageway). */
  weight: number;
  /** Nearest centreline point. */
  x: number;
  z: number;
}

const ROAD_REACH = ROAD_HALF_WIDTH + ROAD_BLEND + 1;
const SEGMENTS = ROADS.flatMap((road) =>
  road.slice(1).map((b, i) => {
    const a = road[i]!;
    return {
      a,
      b,
      minX: Math.min(a.x, b.x) - ROAD_REACH,
      maxX: Math.max(a.x, b.x) + ROAD_REACH,
      minZ: Math.min(a.z, b.z) - ROAD_REACH,
      maxZ: Math.max(a.z, b.z) + ROAD_REACH,
    };
  }),
);

/** Nearest road and how strongly it shapes this point. */
export function roadAt(x: number, z: number, out: RoadSample = { weight: 0, x: 0, z: 0 }): RoadSample {
  let best = Infinity;
  for (const { a, b, minX, maxX, minZ, maxZ } of SEGMENTS) {
    if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
    {
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const d = Math.hypot(x - px, z - pz);
      if (d < best) {
        best = d;
        out.x = px;
        out.z = pz;
      }
    }
  }
  if (best === Infinity) {
    out.weight = 0;
    return out;
  }
  // Gentle meander so roads do not look ruled.
  const wobble = (valueNoise(x * 0.08, z * 0.08) - 0.5) * 1.6;
  out.weight = 1 - smoothstep(ROAD_HALF_WIDTH, ROAD_HALF_WIDTH + ROAD_BLEND, best + wobble);
  return out;
}

const roadScratch: RoadSample = { weight: 0, x: 0, z: 0 };

/** Final terrain height: roads level the ground across their width. */
export function heightAt(x: number, z: number): number {
  const h = baseHeight(x, z);
  const road = roadAt(x, z, roadScratch);
  if (road.weight <= 0) return h;
  const centre = baseHeight(road.x, road.z);
  return mix(h, centre, road.weight * 0.9);
}

// --- Height grid -----------------------------------------------------------------------

/** Heights at every grid vertex, row-major by z then x: index = iz * (GRID_CELLS + 1) + ix. */
export class HeightGrid {
  readonly size = GRID_CELLS + 1;
  readonly heights: Float32Array;

  constructor(heights?: Float32Array) {
    if (heights) {
      this.heights = heights;
      return;
    }
    this.heights = new Float32Array(this.size * this.size);
    for (let iz = 0; iz < this.size; iz++) {
      const z = -WORLD_HALF + iz * CELL_SIZE;
      for (let ix = 0; ix < this.size; ix++) {
        this.heights[iz * this.size + ix] = heightAt(-WORLD_HALF + ix * CELL_SIZE, z);
      }
    }
  }

  at(ix: number, iz: number): number {
    const n = this.size - 1;
    return this.heights[Math.max(0, Math.min(n, iz)) * this.size + Math.max(0, Math.min(n, ix))]!;
  }

  /**
   * Height matching the collision surface: the heightfield splits each cell into two
   * triangles, so interpolate within the triangle rather than bilinearly.
   */
  sample(x: number, z: number): number {
    const fx = (x + WORLD_HALF) / CELL_SIZE;
    const fz = (z + WORLD_HALF) / CELL_SIZE;
    const ix = Math.max(0, Math.min(GRID_CELLS - 1, Math.floor(fx)));
    const iz = Math.max(0, Math.min(GRID_CELLS - 1, Math.floor(fz)));
    const u = Math.max(0, Math.min(1, fx - ix));
    const v = Math.max(0, Math.min(1, fz - iz));
    const h00 = this.at(ix, iz);
    const h10 = this.at(ix + 1, iz);
    const h01 = this.at(ix, iz + 1);
    const h11 = this.at(ix + 1, iz + 1);
    // Bilinear is within a few centimetres of either triangulation at 1.5 m spacing.
    return h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
  }

  /** Unit surface normal (y-up) from central differences. */
  normal(x: number, z: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const e = CELL_SIZE;
    const dx = this.sample(x + e, z) - this.sample(x - e, z);
    const dz = this.sample(x, z + e) - this.sample(x, z - e);
    const nx = -dx;
    const ny = 2 * e;
    const nz = -dz;
    const len = Math.hypot(nx, ny, nz);
    out.x = nx / len;
    out.y = ny / len;
    out.z = nz / len;
    return out;
  }

  /** Column-major heights for Rapier (rows along z, columns along x). */
  toRapierHeights(): Float32Array {
    const n = this.size;
    const out = new Float32Array(n * n);
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) out[iz + ix * n] = this.heights[iz * n + ix]!;
    }
    return out;
  }
}

// --- Biomes ------------------------------------------------------------------------

export interface Biome {
  /** Broadleaf groves. */
  forest: number;
  /** The dark western wood. */
  gloam: number;
  /** Cool, high ground. */
  highland: number;
  /** Golden south-east meadow. */
  amber: number;
  /** Bare rock walls of the gorge mesa. */
  mesa: number;
}

export function biomeAt(x: number, z: number, h: number, out: Biome): Biome {
  out.gloam = 1 - smoothstep(GLOAM.radius * 0.55, GLOAM.radius * 1.05, Math.hypot(x - GLOAM.x, z - GLOAM.z));
  out.highland = smoothstep(9, 20, h) * (1 - out.gloam);
  out.amber = (1 - smoothstep(30, 95, Math.hypot(x - MEADOW_HILL.x, z - MEADOW_HILL.z))) * (1 - out.highland);
  const p = GORGE.plateau;
  out.mesa = 1 - smoothstep(p.radius * 0.6, p.radius * 1.05, Math.hypot(x - p.x, z - p.z));
  out.forest = smoothstep(0.5, 0.6, fbm(x * 0.009 + 3.1, z * 0.009 - 5.7)) * (1 - out.amber) * (1 - out.mesa);
  return out;
}

/** Inside the lake basin (water is only drawn here). */
export function inLake(x: number, z: number): boolean {
  return Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius * 1.35;
}

export function nearestLandmark(x: number, z: number, filter: (l: Landmark) => boolean = () => true): Landmark | null {
  let best: Landmark | null = null;
  let bestD = Infinity;
  for (const l of LANDMARKS) {
    if (!filter(l)) continue;
    const d = Math.hypot(l.stone.x - x, l.stone.z - z);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

// --- Noise ---------------------------------------------------------------------------

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function distanceToSegment(x: number, z: number, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));
}

function hash2(ix: number, iz: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, z: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < 4; i++) {
    sum += amplitude * valueNoise(x * frequency, z * frequency);
    frequency *= 2;
    amplitude *= 0.5;
  }
  return sum;
}
