/**
 * The First Bastion's layout: the first town, just outside the arena's south gate. One main
 * street (the south road) runs from the gate up onto a levelled plateau and opens into a
 * market square at the fork, with a fountain, stalls and a windmill behind the west row.
 *
 * Pure data in world metres (no three.js) so the server can rebuild the same colliders.
 * Buildings are assembled from Kenney's Fantasy Town Kit modules (CC0) on a 3 m grid.
 */
import { FIRST_BASTION } from './geography.ts';

/** Metres per kit grid unit: one wall module is one 3 m storey. */
export const TOWN_CELL = 3;

/** Ground height of the whole town (the plateau is flat). */
export const TOWN_Y = FIRST_BASTION.level;

export type HouseStyle = 'plaster' | 'timber' | 'wood';

export interface HouseSpec {
  /** Footprint centre. */
  x: number;
  z: number;
  /** The front (door side) faces local +x: 0 = east, π = west, π/2 = north, -π/2 = south. */
  yaw: number;
  /** Cells along the front (the ridge runs this way); depth is always 2 cells. */
  width: number;
  floors: number;
  style: HouseStyle;
  chimney?: boolean;
  banner?: 'red' | 'green';
  /** Sails on the north gable end. */
  windmill?: boolean;
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

/** Street lamps at 1.7 m per unit stand ~2.6 m tall. */
const LAMP = 1.7;
const EAST = 0;
const WEST = Math.PI;
const NORTH = Math.PI / 2;

export const HOUSES: readonly HouseSpec[] = [
  // Main street, west row (fronts face the street, east).
  { x: -8, z: 50, yaw: EAST, width: 3, floors: 2, style: 'timber', chimney: true, banner: 'red' },
  { x: -8, z: 61, yaw: EAST, width: 2, floors: 2, style: 'plaster' },
  // Main street, east row.
  { x: 8, z: 49, yaw: WEST, width: 2, floors: 1, style: 'wood', chimney: true },
  { x: 8, z: 59, yaw: WEST, width: 3, floors: 2, style: 'timber', banner: 'green' },
  // Around the market square.
  { x: -15, z: 77, yaw: EAST, width: 3, floors: 2, style: 'plaster', chimney: true, banner: 'green' },
  { x: 15, z: 70, yaw: WEST, width: 3, floors: 2, style: 'timber', banner: 'red' },
  { x: 10, z: 93, yaw: NORTH, width: 3, floors: 2, style: 'plaster', chimney: true },
  // The mill behind the west row.
  { x: -19, z: 60, yaw: EAST, width: 2, floors: 3, style: 'wood', windmill: true },
];

export const PROPS: readonly PropSpec[] = [
  // Market square
  { model: 'fountain-round-detail', x: 0, z: 78, yaw: 0, cylinder: 3 },
  { model: 'stall-red', x: -7, z: 70, yaw: EAST, box: [1.5, 1.8, 1.5] },
  { model: 'stall-green', x: 7, z: 85, yaw: WEST, box: [1.5, 1.8, 1.5] },
  { model: 'stall-red', x: -7.5, z: 81, yaw: EAST, box: [1.5, 1.8, 1.5] },
  { model: 'stall-bench', x: -4.6, z: 70, yaw: 0 },
  { model: 'stall-stool', x: -4.8, z: 81.6, yaw: 0.4 },
  { model: 'stall-stool', x: 4.8, z: 84.5, yaw: -0.3 },
  // Carts
  { model: 'cart', x: 13, z: 55, yaw: 0.35, box: [1.4, 0.9, 2.1] },
  { model: 'cart-high', x: -13.5, z: 67, yaw: -0.5, box: [1.4, 1.2, 2.1] },
  // Lanterns along the street and round the square
  ...[46, 54, 62].flatMap((z) => [
    { model: 'lantern', x: -4.4, z, yaw: 0, scale: LAMP, cylinder: 0.2 },
    { model: 'lantern', x: 4.4, z, yaw: Math.PI, scale: LAMP, cylinder: 0.2 },
  ]),
  { model: 'lantern', x: -4.4, z: 69, yaw: 0, scale: LAMP, cylinder: 0.2 },
  { model: 'lantern', x: 6.5, z: 75.5, yaw: 0, scale: LAMP, cylinder: 0.2 },
  { model: 'lantern', x: -5.5, z: 88, yaw: 0, scale: LAMP, cylinder: 0.2 },
  { model: 'lantern', x: 4.5, z: 90, yaw: 0, scale: LAMP, cylinder: 0.2 },
];

/** Fence runs (each a list of 3 m segments along a line), keeping gardens behind the rows. */
export const FENCES: readonly { x: number; z: number; yaw: number }[] = [
  // East row back gardens
  { x: 12.5, z: 44.5, yaw: 0 },
  { x: 12.5, z: 47.5, yaw: 0 },
  { x: 12.5, z: 50.5, yaw: 0 },
  // Around the mill
  { x: -23.5, z: 56.5, yaw: 0 },
  { x: -23.5, z: 59.5, yaw: 0 },
  { x: -23.5, z: 62.5, yaw: 0 },
  { x: -23.5, z: 65.5, yaw: 0 },
];

/** Whether (x, z) lies under a roof or the fountain (the map paints them). */
export function townFeatureAt(x: number, z: number): 'roof' | 'fountain' | null {
  for (const h of HOUSES) {
    const dx = x - h.x;
    const dz = z - h.z;
    const c = Math.cos(h.yaw);
    const s = Math.sin(h.yaw);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) <= TOWN_CELL + 0.3 && Math.abs(lz) <= (h.width * TOWN_CELL) / 2 + 0.3) return 'roof';
  }
  const fountain = PROPS.find((p) => p.model.startsWith('fountain'));
  if (fountain && Math.hypot(x - fountain.x, z - fountain.z) < 3) return 'fountain';
  return null;
}

/** Every building's footprint as a circle, for keeping scenery and spawns out. */
export function townFootprints(): { x: number; z: number; r: number }[] {
  return HOUSES.map((h) => ({ x: h.x, z: h.z, r: (Math.hypot(h.width, 2) * TOWN_CELL) / 2 + 1 }));
}
