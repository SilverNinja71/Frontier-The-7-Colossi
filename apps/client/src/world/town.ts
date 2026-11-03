/**
 * The First Bastion's layout: the first town, just outside the arena's south gate.
 *
 * A walled town in the old-European manner: tall cream-stucco townhouses with terracotta (and
 * a few slate) roofs packed shoulder to shoulder along a main street, a market square with a
 * fountain at the fork, an octagonal curtain wall of pale ashlar with square towers at every
 * corner and arched gates wherever a road passes, and a white keep with spired turrets above
 * the south gate. The layout is original to Sovereign Frontier.
 *
 * Pure data in world metres (no three.js) so the server can rebuild the same colliders.
 * Houses are assembled from Kenney's Fantasy Town Kit modules (CC0) on a 3 m grid.
 */
import { FIRST_BASTION } from './geography.ts';

/** Metres per kit grid unit: one wall module is one 3 m storey. */
export const TOWN_CELL = 3;

/** Ground height inside the walls (the plateau is flat). */
export const TOWN_Y = FIRST_BASTION.level;

export type RoofColour = 'terracotta' | 'slate';

export interface HouseSpec {
  /** Footprint centre. */
  x: number;
  z: number;
  /** The front (door side) faces local +x: 0 = east, π = west, π/2 = north, -π/2 = south. */
  yaw: number;
  /** Cells along the front (the ridge runs this way); depth is always 2 cells. */
  width: number;
  floors: number;
  roof: RoofColour;
  chimney?: boolean;
  /** Dormer windows in the front roof slope. */
  dormers?: boolean;
  banner?: 'red' | 'green';
}

export interface PropSpec {
  model: string;
  x: number;
  z: number;
  yaw: number;
  /** Metres per kit unit (default TOWN_CELL); street furniture reads better a little smaller. */
  scale?: number;
  /** Collider: half extents (m) of a box, or a cylinder radius; none for small clutter. */
  box?: [number, number, number];
  cylinder?: number;
}

const EAST = 0;
const WEST = Math.PI;
const NORTH = Math.PI / 2;
/** Street lamps at 1.7 m per unit stand ~2.6 m tall. */
const LAMP = 1.7;

export const HOUSES: readonly HouseSpec[] = [
  // Main street, west row: fronts on the street, shoulder to shoulder.
  { x: -8, z: 49.5, yaw: EAST, width: 3, floors: 3, roof: 'terracotta', chimney: true, dormers: true },
  { x: -8, z: 57, yaw: EAST, width: 2, floors: 4, roof: 'slate', banner: 'red' },
  { x: -8, z: 64.5, yaw: EAST, width: 3, floors: 3, roof: 'terracotta', dormers: true },
  // Main street, east row.
  { x: 8, z: 48, yaw: WEST, width: 2, floors: 4, roof: 'terracotta', chimney: true },
  { x: 8, z: 55.5, yaw: WEST, width: 3, floors: 3, roof: 'terracotta', dormers: true, banner: 'green' },
  { x: 8, z: 63, yaw: WEST, width: 2, floors: 4, roof: 'slate' },
  // Back rows, facing the alleys under the walls.
  { x: -16, z: 58.5, yaw: WEST, width: 3, floors: 3, roof: 'terracotta', chimney: true },
  { x: -16, z: 66, yaw: WEST, width: 2, floors: 4, roof: 'terracotta' },
  { x: 16, z: 58.5, yaw: EAST, width: 3, floors: 3, roof: 'slate', chimney: true },
  // Around the market square.
  { x: -15, z: 76, yaw: EAST, width: 3, floors: 3, roof: 'terracotta', chimney: true, dormers: true, banner: 'green' },
  { x: 15, z: 70, yaw: WEST, width: 3, floors: 4, roof: 'terracotta', dormers: true, banner: 'red' },
  { x: 8, z: 88, yaw: NORTH, width: 3, floors: 3, roof: 'slate', chimney: true, dormers: true },
  { x: 20, z: 79, yaw: WEST, width: 2, floors: 3, roof: 'terracotta' },
];

export const PROPS: readonly PropSpec[] = [
  // Market square
  { model: 'fountain-round-detail', x: 0, z: 78, yaw: 0, cylinder: 3 },
  { model: 'stall-red', x: -7.5, z: 70.5, yaw: EAST, box: [1.5, 1.8, 1.5] },
  { model: 'stall-green', x: -5.5, z: 80, yaw: EAST, box: [1.5, 1.8, 1.5] },
  { model: 'stall-bench', x: -4.9, z: 70.5, yaw: 0 },
  { model: 'stall-stool', x: -3.4, z: 80.6, yaw: 0.4 },
  { model: 'cart', x: 9.5, z: 74, yaw: 0.35, box: [1.4, 0.9, 2.1] },
  // Lamps along the street and round the square
  ...[47, 55, 63].flatMap((z) => [
    { model: 'lantern', x: -4.2, z, yaw: 0, scale: LAMP, cylinder: 0.2 },
    { model: 'lantern', x: 4.2, z, yaw: Math.PI, scale: LAMP, cylinder: 0.2 },
  ]),
  { model: 'lantern', x: 5, z: 74, yaw: 0, scale: LAMP, cylinder: 0.2 },
  { model: 'lantern', x: -4.5, z: 85, yaw: 0, scale: LAMP, cylinder: 0.2 },
  { model: 'lantern', x: 3.6, z: 84, yaw: 0, scale: LAMP, cylinder: 0.2 },
];

// --- The curtain wall --------------------------------------------------------------------

/** An octagon round the plateau, flat faces north/east/south/west. */
export const WALL = {
  x: FIRST_BASTION.x,
  z: FIRST_BASTION.z,
  /** Centre to corner (tower centres). */
  radius: 29,
  thickness: 2.4,
  /** Wall-walk height above the town. */
  height: 8,
  towerSize: 5.2,
  towerHeight: 11.5,
  gateWidth: 6,
} as const;

export interface WallPoint {
  x: number;
  z: number;
}

/** The eight corners, clockwise from east-south-east (angle 22.5° from +x towards +z). */
export function wallCorners(): WallPoint[] {
  return Array.from({ length: 8 }, (_, k) => {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    return { x: WALL.x + Math.cos(a) * WALL.radius, z: WALL.z + Math.sin(a) * WALL.radius };
  });
}

/** Gates where the roads cross the wall: the arena road (north), the south road, the meadow road. */
export const GATES: readonly { x: number; z: number; name: string }[] = [
  { x: 0, z: 43.21, name: 'North Gate' },
  { x: -5.5, z: 96.79, name: 'South Gate' },
  { x: 20.48, z: 87.42, name: 'Meadow Gate' },
];

/** The keep: a white tower with four spired turrets, above the south gate. */
export const KEEP = { x: -11, z: 85, size: 8, height: 17, spire: 9 } as const;

// --- Queries -----------------------------------------------------------------------------

/** Signed distance from (x, z) to the wall's centre line (negative = inside the town). */
export function wallDistance(x: number, z: number): number {
  const dx = x - WALL.x;
  const dz = z - WALL.z;
  const apothem = WALL.radius * Math.cos(Math.PI / 8);
  let worst = -Infinity;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4; // face normals: east, south-east, south, …
    worst = Math.max(worst, dx * Math.cos(a) + dz * Math.sin(a) - apothem);
  }
  return worst;
}

/** What the map paints at (x, z): roofs, the keep, the walls, the fountain. */
export function townFeatureAt(x: number, z: number): 'roof' | 'slate' | 'keep' | 'wall' | 'fountain' | null {
  for (const h of HOUSES) {
    const dx = x - h.x;
    const dz = z - h.z;
    const c = Math.cos(h.yaw);
    const s = Math.sin(h.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) <= TOWN_CELL + 0.3 && Math.abs(lz) <= (h.width * TOWN_CELL) / 2 + 0.3) return h.roof === 'slate' ? 'slate' : 'roof';
  }
  if (Math.abs(x - KEEP.x) <= KEEP.size / 2 + 1.5 && Math.abs(z - KEEP.z) <= KEEP.size / 2 + 1.5) return 'keep';
  if (Math.abs(wallDistance(x, z)) <= WALL.thickness / 2 + 0.6 && !GATES.some((g) => Math.hypot(x - g.x, z - g.z) < WALL.gateWidth / 2)) return 'wall';
  if (wallCorners().some((c) => Math.hypot(x - c.x, z - c.z) < WALL.towerSize * 0.6)) return 'wall';
  const fountain = PROPS.find((p) => p.model.startsWith('fountain'));
  if (fountain && Math.hypot(x - fountain.x, z - fountain.z) < 3) return 'fountain';
  return null;
}

/** Every building's footprint as a circle, for keeping scenery and spawns out. */
export function townFootprints(): { x: number; z: number; r: number }[] {
  return HOUSES.map((h) => ({ x: h.x, z: h.z, r: (Math.hypot(h.width, 2) * TOWN_CELL) / 2 + 1 }));
}
