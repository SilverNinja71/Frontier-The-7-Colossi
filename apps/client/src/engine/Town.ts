import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HeightGrid } from '../world/geography.ts';
import { GATES, HOUSES, KEEP, PROPS, TOWN_CELL, TOWN_Y, WALL, wallCorners, type HouseSpec, type RoofColour } from '../world/town.ts';
import { NatureKit, type KitPart } from './NatureKit.ts';
import type { PhysicsWorld } from './PhysicsWorld.ts';

/** The town's art: kit modules plus the recoloured palettes (cream stucco, terracotta or slate). */
export interface TownArt {
  kit: NatureKit;
  palettes: Partial<Record<RoofColour, THREE.Texture>>;
}

/** Resolves to null (never throws) when the kit is missing; the walls and keep still stand. */
export async function loadTownArt(baseUrl: string): Promise<TownArt | null> {
  const palette = (name: RoofColour) =>
    new THREE.TextureLoader().loadAsync(`${baseUrl}palette-${name}.webp`).then(
      (texture) => [name, texture] as const,
      () => null,
    );
  const [kit, ...palettes] = await Promise.all([NatureKit.load(`${baseUrl}town.glb`), palette('terracotta'), palette('slate')]);
  if (!kit) return null;
  return { kit, palettes: Object.fromEntries(palettes.filter((p) => p !== null)) };
}

type Paint = RoofColour | 'props';

/** One module instance in town space (metres). */
interface Placement {
  model: string;
  matrix: THREE.Matrix4;
  /** Mirrored across local z (gable halves): drawn from a pre-flipped geometry. */
  mirror: boolean;
  paint: Paint;
}

const PI = Math.PI;
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
/** Metres per repeat of the ashlar texture. */
const ASHLAR_M = 4;

/** Kit-local placement: position in grid units, yaw, optional z-mirror. */
function local(x: number, y: number, z: number, rot: number, mirror = false): THREE.Matrix4 {
  return new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(Y, rot), tmpS.set(1, 1, mirror ? -1 : 1));
}

/** House space (grid units, front = +x) → world metres. */
function houseFrame(h: HouseSpec): THREE.Matrix4 {
  return new THREE.Matrix4().compose(tmpP.set(h.x, TOWN_Y, h.z), tmpQ.setFromAxisAngle(Y, h.yaw), tmpS.setScalar(TOWN_CELL));
}

/**
 * A townhouse: 2 cells deep, `width` along the street, stucco on every floor with a door and
 * shuttered windows below, rows of windows above, a steep gable roof (dormers in the front
 * slope), triangular gable walls, an optional chimney and a hanging banner.
 */
function houseModules(h: HouseSpec): Placement[] {
  const out: Placement[] = [];
  const frame = houseFrame(h);
  const add = (model: string, m: THREE.Matrix4, mirror = false, paint: Paint = h.roof) =>
    out.push({ model, matrix: new THREE.Matrix4().multiplyMatrices(frame, m), mirror, paint });
  const W = h.width;
  const z0 = -W / 2 + 0.5;
  const doorAt = Math.floor(W / 2);
  const upper = (f: number) => (f % 2 === 1 ? 'wall-window-round' : 'wall-window-shutters');

  for (let f = 0; f < h.floors; f++) {
    for (let j = 0; j < W; j++) {
      const z = z0 + j;
      add(f === 0 ? (j === doorAt ? 'wall-door' : 'wall-window-shutters') : upper(f), local(0.5, f, z, 0));
      add(f > 0 && (j + f) % 2 === 0 ? 'wall-window-shutters' : 'wall', local(-0.5, f, z, PI));
    }
    for (const x of [-0.5, 0.5]) {
      add(f > 0 && x > 0 ? 'wall-window-round' : 'wall', local(x, f, z0, PI / 2));
      add(f > 0 && x > 0 ? 'wall-window-round' : 'wall', local(x, f, z0 + W - 1, -PI / 2));
    }
  }

  const top = h.floors;
  for (let j = 0; j < W; j++) {
    add('roof-high', local(-0.5, top, z0 + j, 0));
    add(h.dormers && j % 2 === (W > 2 ? 1 : 0) ? 'roof-high-window' : 'roof-high', local(0.5, top, z0 + j, PI));
  }
  add('wall-slope', local(-0.5, top, z0, PI / 2));
  add('wall-slope', local(0.5, top, z0, PI / 2), true);
  add('wall-slope', local(-0.5, top, z0 + W - 1, -PI / 2), true);
  add('wall-slope', local(0.5, top, z0 + W - 1, -PI / 2));

  if (h.chimney) {
    add('chimney-base', local(-0.5, top, z0 + W - 1, PI));
    add('chimney-top', local(-0.5, top + 1, z0 + W - 1, PI));
  }
  if (h.banner) {
    // Hung outside the first-floor front: placed in the neighbouring cell, turned to face out.
    add(h.banner === 'red' ? 'banner-red' : 'banner-green', local(1.5, 1, z0, PI), false, 'props');
  }
  return out;
}

function propPlacement(model: string, x: number, z: number, yaw: number, scale = TOWN_CELL): Placement {
  return {
    model,
    matrix: new THREE.Matrix4().compose(tmpP.set(x, TOWN_Y, z), tmpQ.setFromAxisAngle(Y, yaw), tmpS.setScalar(scale)),
    mirror: false,
    paint: 'props',
  };
}

/** A copy mirrored across z with its triangle winding flipped (so it still faces outward). */
function mirrored(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geometry.clone();
  g.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, -1));
  const index = g.getIndex()!;
  for (let i = 0; i < index.count; i += 3) {
    const b = index.getX(i + 1);
    index.setX(i + 1, index.getX(i + 2));
    index.setX(i + 2, b);
  }
  index.needsUpdate = true;
  g.computeBoundingSphere();
  return g;
}

/** Pale ashlar: offset courses of blocks with soft mortar lines and per-block tone. */
function ashlarTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#b3a07c';
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const course = size / 8; // 0.5 m courses at 4 m per repeat
  for (let row = 0; row < 8; row++) {
    let x = row % 2 ? -course * 1.1 : 0;
    while (x < size) {
      const w = course * (1.6 + rand() * 1.2);
      const tone = 202 + rand() * 30;
      g.fillStyle = `rgb(${tone + 24}, ${tone + 10}, ${tone - 30})`;
      g.fillRect(x + 1.5, row * course + 1.5, w - 3, course - 3);
      // A lighter top edge on every block, as if worn by the weather.
      g.fillStyle = 'rgba(255, 250, 235, 0.18)';
      g.fillRect(x + 1.5, row * course + 1.5, w - 3, 3);
      x += w;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Cobbles: rounded setts in staggered rows, warm grey with dark joints. */
function cobbleTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#5f5446';
  g.fillRect(0, 0, size, size);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const row = size / 10;
  for (let r = 0; r < 10; r++) {
    let x = r % 2 ? -row * 0.6 : 0;
    while (x < size) {
      const w = row * (0.9 + rand() * 0.6);
      const tone = 140 + rand() * 50;
      g.fillStyle = `rgb(${tone + 12}, ${tone + 4}, ${tone - 10})`;
      g.beginPath();
      g.roundRect(x + 1.5, r * row + 1.5, w - 3, row - 3, 5);
      g.fill();
      g.fillStyle = 'rgba(255, 248, 230, 0.12)';
      g.beginPath();
      g.roundRect(x + 3, r * row + 2.5, w - 7, row * 0.35, 4);
      g.fill();
      x += w;
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Flat paving pieces in the XZ plane at the town's ground, UVs in world metres. */
function pavingGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  const shapeToGround = (shape: THREE.Shape) => {
    const g = new THREE.ShapeGeometry(shape, 24);
    g.rotateX(-PI / 2); // shape (x, y) → ground (x, -y): shapes are drawn with y = -z
    pieces.push(g);
  };
  const strip = (ax: number, az: number, bx: number, bz: number, half: number) => {
    const length = Math.hypot(bx - ax, bz - az);
    const nx = (-(bz - az) / length) * half;
    const nz = ((bx - ax) / length) * half;
    const s = new THREE.Shape();
    s.moveTo(ax + nx, -(az + nz));
    s.lineTo(bx + nx, -(bz + nz));
    s.lineTo(bx - nx, -(bz - nz));
    s.lineTo(ax - nx, -(az - nz));
    s.closePath();
    shapeToGround(s);
  };
  const square = new THREE.Shape();
  square.absarc(0, -78, 11.5, 0, PI * 2, false);
  shapeToGround(square);
  strip(0, 41.5, 0, 72, 4.8); // main street, through the north gate
  for (const gate of GATES.slice(1)) {
    const dx = gate.x;
    const dz = gate.z - 78;
    const length = Math.hypot(dx, dz);
    strip(0, 78, gate.x + (dx / length) * 2, gate.z + (dz / length) * 2, 3.3);
  }
  const merged = mergeGeometries(pieces, false)!;
  const position = merged.getAttribute('position') as THREE.BufferAttribute;
  const uv = merged.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) uv.setXY(i, position.getX(i) / 2.5, position.getZ(i) / 2.5);
  merged.translate(0, TOWN_Y + 0.04, 0);
  return merged;
}

/** A box with UVs in world metres (courses line up across pieces), placed and turned. */
function stoneBox(w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z (4 vertices each).
  const dims: [number, number, boolean][] = [
    [d, h, true],
    [d, h, true],
    [w, d, false],
    [w, d, false],
    [w, h, true],
    [w, h, true],
  ];
  for (let f = 0; f < 6; f++) {
    const [du, dv, side] = dims[f]!;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      const v = side ? uv.getY(i) * dv + (y - h / 2) : uv.getY(i) * dv;
      uv.setXY(i, (uv.getX(i) * du) / ASHLAR_M, v / ASHLAR_M);
    }
  }
  g.applyMatrix4(new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(Y, yaw), tmpS.set(1, 1, 1)));
  return g;
}

/** An arched gateway: an inverted U of stone, extruded through the wall. */
function archGeometry(gap: number, height: number, depth: number, x: number, y: number, z: number, yaw: number): THREE.BufferGeometry {
  const outer = gap / 2 + 0.6;
  const spring = height - gap / 2 - 0.9;
  const shape = new THREE.Shape();
  shape.moveTo(-outer, 0);
  shape.lineTo(-outer, height);
  shape.lineTo(outer, height);
  shape.lineTo(outer, 0);
  shape.lineTo(gap / 2, 0);
  shape.lineTo(gap / 2, spring);
  shape.absarc(0, spring, gap / 2, 0, PI, false);
  shape.lineTo(-gap / 2, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / ASHLAR_M, uv.getY(i) / ASHLAR_M);
  g.computeVertexNormals();
  g.applyMatrix4(new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(Y, yaw), tmpS.set(1, 1, 1)));
  return g;
}

/** Yaw that turns local +x towards (dx, dz). */
function yawAlong(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

/**
 * The First Bastion: kit townhouses drawn through one BatchedMesh per material (cream stucco
 * with terracotta or slate roofs; market props keep the kit's own colours), and procedural
 * stonework: the octagonal curtain wall with crenellations, corner towers, arched gates over
 * the roads, and the spired keep. Houses, walls, towers and stalls all collide.
 */
export class Town {
  readonly group = new THREE.Group();

  constructor(art: TownArt | null, grid: HeightGrid, physics: PhysicsWorld) {
    this.group.name = 'First Bastion';
    this.#houseColliders(physics);
    this.#stonework(grid, physics);
    if (!art || !art.kit.has('wall')) return; // no kit: the walls and keep still stand
    const placements: Placement[] = [...HOUSES.flatMap(houseModules), ...PROPS.map((p) => propPlacement(p.model, p.x, p.z, p.yaw, p.scale))];
    this.#batch(art, placements);
  }

  /** Per-frame hook (kept for animated details). */
  update(_seconds: number): void {}

  #batch(art: TownArt, placements: Placement[]): void {
    const flipped = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
    const painted = new Map<string, THREE.Material>();
    const materialFor = (material: THREE.Material, paint: Paint): THREE.Material => {
      const texture = paint === 'props' ? undefined : art.palettes[paint];
      if (!texture || !(material instanceof THREE.MeshStandardMaterial) || !material.map) return material;
      const key = `${material.uuid}:${paint}`;
      let out = painted.get(key);
      if (!out) {
        const source = material.map;
        texture.flipY = source.flipY;
        texture.colorSpace = source.colorSpace;
        texture.wrapS = source.wrapS;
        texture.wrapT = source.wrapT;
        texture.magFilter = source.magFilter;
        texture.minFilter = source.minFilter;
        texture.needsUpdate = true;
        const clone = material.clone();
        clone.map = texture;
        clone.name = `${material.name}-${paint}`;
        out = clone;
        painted.set(key, out);
      }
      return out;
    };

    const batches = new Map<THREE.Material, { geometries: Map<THREE.BufferGeometry, number>; items: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[]; vertices: number; indices: number }>();
    for (const placement of placements) {
      for (const part of art.kit.parts(placement.model) as KitPart[]) {
        let geometry = part.geometry;
        if (placement.mirror) {
          if (!flipped.has(geometry)) flipped.set(geometry, mirrored(geometry));
          geometry = flipped.get(geometry)!;
        }
        const material = materialFor(part.material, placement.paint);
        let batch = batches.get(material);
        if (!batch) {
          batch = { geometries: new Map(), items: [], vertices: 0, indices: 0 };
          batches.set(material, batch);
        }
        if (!batch.geometries.has(geometry)) {
          batch.geometries.set(geometry, -1);
          batch.vertices += geometry.getAttribute('position').count;
          batch.indices += geometry.getIndex()!.count;
        }
        batch.items.push({ geometry, matrix: placement.matrix });
      }
    }
    for (const [material, batch] of batches) {
      const mesh = new THREE.BatchedMesh(batch.items.length, batch.vertices, batch.indices, material);
      for (const geometry of batch.geometries.keys()) batch.geometries.set(geometry, mesh.addGeometry(geometry));
      for (const item of batch.items) mesh.setMatrixAt(mesh.addInstance(batch.geometries.get(item.geometry)!), item.matrix);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `town:${material.name}`;
      this.group.add(mesh);
    }
  }

  /** Walls, towers, gates and keep: merged into one mesh per material. */
  #stonework(grid: HeightGrid, physics: PhysicsWorld): void {
    const R = physics.rapier;
    const stone: THREE.BufferGeometry[] = [];
    const keepStone: THREE.BufferGeometry[] = [];
    const roofs: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const box = (hx: number, hy: number, hz: number, x: number, y: number, z: number, yaw: number) => {
      tmpQ.setFromAxisAngle(Y, yaw);
      physics.addStatic(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }));
    };
    const lowest = (points: [number, number][]) => Math.min(...points.map(([x, z]) => grid.sample(x, z)));
    const top = TOWN_Y + WALL.height;
    const T = WALL.thickness;

    // Crenellations: merlons along the outer edge of a run.
    const merlons = (ax: number, az: number, bx: number, bz: number, outX: number, outZ: number, y: number, offset: number) => {
      const length = Math.hypot(bx - ax, bz - az);
      const yaw = yawAlong(bx - ax, bz - az);
      const count = Math.floor(length / 2.2);
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        stone.push(stoneBox(1.1, 1.05, 0.6, ax + (bx - ax) * t + outX * offset, y + 0.52, az + (bz - az) * t + outZ * offset, yaw));
      }
    };

    // Curtain wall: eight runs between the corner towers, split around the gates.
    const corners = wallCorners();
    for (let k = 0; k < 8; k++) {
      const a = corners[k]!;
      const b = corners[(k + 1) % 8]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      const ux = dx / length;
      const uz = dz / length;
      // Outward normal: away from the town centre.
      let ox = uz;
      let oz = -ux;
      const midX = (a.x + b.x) / 2 - WALL.x;
      const midZ = (a.z + b.z) / 2 - WALL.z;
      if (ox * midX + oz * midZ < 0) [ox, oz] = [-ox, -oz];

      // Pieces along the run, in metres from corner a, leaving room for towers and gates.
      const tower = WALL.towerSize / 2 - 0.3;
      const cuts: [number, number][] = [];
      const along = (g: { x: number; z: number }) => (g.x - a.x) * ux + (g.z - a.z) * uz;
      const gate = GATES.find((g) => Math.abs((g.x - a.x) * ox + (g.z - a.z) * oz) < 1 && along(g) > 0 && along(g) < length);
      if (gate) {
        const s = (gate.x - a.x) * ux + (gate.z - a.z) * uz;
        const half = WALL.gateWidth / 2 + 2.4; // the gate towers flank the opening
        cuts.push([tower, s - half], [s + half, length - tower]);
        this.#gatehouse(gate, ux, uz, ox, oz, grid, stone, roofs, box);
      } else {
        cuts.push([tower, length - tower]);
      }
      for (const [from, to] of cuts) {
        if (to - from < 0.5) continue;
        const ax = a.x + ux * from;
        const az = a.z + uz * from;
        const bx = a.x + ux * to;
        const bz = a.z + uz * to;
        const bottom = lowest([
          [ax, az],
          [bx, bz],
          [(ax + bx) / 2, (az + bz) / 2],
          [ax + ox * T, az + oz * T],
          [bx + ox * T, bz + oz * T],
        ]) - 1.5;
        const h = top - bottom;
        const cx = (ax + bx) / 2;
        const cz = (az + bz) / 2;
        const yaw = yawAlong(ux, uz);
        stone.push(stoneBox(to - from, h, T, cx, bottom + h / 2, cz, yaw));
        // A plinth course: the wall foot steps out a little.
        stone.push(stoneBox(to - from, 1.2, T + 0.6, cx, bottom + 0.6 + Math.max(0, lowest([[cx, cz]]) - bottom), cz, yaw));
        merlons(ax, az, bx, bz, ox, oz, top, T / 2 - 0.3);
        box((to - from) / 2, h / 2, T / 2, cx, bottom + h / 2, cz, yaw);
      }
    }

    // Corner towers, turned to bisect the corner, crenellated.
    for (const [k, c] of corners.entries()) {
      const angle = Math.PI / 8 + (k * Math.PI) / 4;
      const yaw = -angle;
      const s = WALL.towerSize;
      const bottom = lowest([
        [c.x - s / 2, c.z - s / 2],
        [c.x + s / 2, c.z - s / 2],
        [c.x - s / 2, c.z + s / 2],
        [c.x + s / 2, c.z + s / 2],
      ]) - 1.5;
      const towerTop = TOWN_Y + WALL.towerHeight;
      const h = towerTop - bottom;
      stone.push(stoneBox(s, h, s, c.x, bottom + h / 2, c.z, yaw));
      stone.push(stoneBox(s + 0.5, 0.5, s + 0.5, c.x, towerTop - 1.1, c.z, yaw)); // string course
      const ca = Math.cos(yaw);
      const sa = Math.sin(yaw);
      const corner = (lx: number, lz: number): [number, number] => [c.x + lx * ca + lz * sa, c.z - lx * sa + lz * ca];
      const e = s / 2 - 0.3;
      const sides: [[number, number], [number, number], number, number][] = [
        [corner(-e, -e), corner(e, -e), -sa, -ca],
        [corner(e, -e), corner(e, e), ca, -sa],
        [corner(e, e), corner(-e, e), sa, ca],
        [corner(-e, e), corner(-e, -e), -ca, sa],
      ];
      for (const [[ax, az], [bx, bz], nx, nz] of sides) merlons(ax, az, bx, bz, nx, nz, towerTop, 0);
      // Arrow slits on the outward faces.
      for (const y of [TOWN_Y + 3.5, TOWN_Y + 7.5]) {
        const [wx, wz] = corner(s / 2 + 0.02, 0);
        dark.push(stoneBox(0.06, 1.3, 0.35, wx, y, wz, yaw));
      }
      box(s / 2, h / 2, s / 2, c.x, bottom + h / 2, c.z, yaw);
    }

    this.#keep(stone, keepStone, roofs, dark, box);

    // Cobbled streets and the market square (drawn just above the plateau, never z-fighting it).
    const paving = new THREE.Mesh(
      pavingGeometry(),
      new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    paving.receiveShadow = true;
    paving.name = 'town:paving';
    this.group.add(paving);

    const ashlar = ashlarTexture();
    const add = (geometries: THREE.BufferGeometry[], material: THREE.Material, name: string) => {
      if (geometries.length === 0) return;
      const merged = mergeGeometries(
        geometries.map((g) => (g.index ? g.toNonIndexed() : g)),
        false,
      );
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = name;
      this.group.add(mesh);
    };
    add(stone, new THREE.MeshStandardMaterial({ map: ashlar, color: '#fff4e2', roughness: 0.95 }), 'town:walls');
    add(keepStone, new THREE.MeshStandardMaterial({ map: ashlar, color: '#ffffff', roughness: 0.9, emissive: '#2b2618', emissiveIntensity: 0.15 }), 'town:keep');
    add(roofs, new THREE.MeshStandardMaterial({ color: '#c96a36', roughness: 0.75, flatShading: true }), 'town:spires');
    add(dark, new THREE.MeshStandardMaterial({ color: '#2a2520', roughness: 1 }), 'town:slits');
  }

  #gatehouse(
    gate: { x: number; z: number },
    ux: number,
    uz: number,
    ox: number,
    oz: number,
    grid: HeightGrid,
    stone: THREE.BufferGeometry[],
    roofs: THREE.BufferGeometry[],
    box: (hx: number, hy: number, hz: number, x: number, y: number, z: number, yaw: number) => void,
  ): void {
    const yaw = yawAlong(ux, uz);
    const base = grid.sample(gate.x, gate.z);
    const gap = WALL.gateWidth;
    const depth = WALL.thickness + 1.2;
    const archTop = TOWN_Y + WALL.height + 1;
    stone.push(archGeometry(gap, archTop - base, depth, gate.x, base, gate.z, yaw));
    // Flanking towers, a storey above the wall, with pyramid caps.
    for (const side of [-1, 1]) {
      const cx = gate.x + ux * side * (gap / 2 + 1.8);
      const cz = gate.z + uz * side * (gap / 2 + 1.8);
      const bottom = Math.min(grid.sample(cx, cz), grid.sample(cx + ox * 2, cz + oz * 2), grid.sample(cx - ox * 2, cz - oz * 2)) - 1.5;
      const towerTop = TOWN_Y + WALL.height + 4;
      const h = towerTop - bottom;
      stone.push(stoneBox(3.6, h, depth + 0.8, cx, bottom + h / 2, cz, yaw));
      const cap = new THREE.ConeGeometry(2.9, 3.4, 4, 1);
      cap.rotateY(PI / 4);
      cap.applyMatrix4(new THREE.Matrix4().compose(tmpP.set(cx, towerTop + 1.7, cz), tmpQ.setFromAxisAngle(Y, yaw), tmpS.set(1, 1, (depth + 0.8) / 3.6)));
      roofs.push(cap);
      box(1.8, h / 2, (depth + 0.8) / 2, cx, bottom + h / 2, cz, yaw);
    }
  }

  /** The keep: a white tower block under a pyramid spire, with four spired turrets. */
  #keep(
    stone: THREE.BufferGeometry[],
    keepStone: THREE.BufferGeometry[],
    roofs: THREE.BufferGeometry[],
    dark: THREE.BufferGeometry[],
    box: (hx: number, hy: number, hz: number, x: number, y: number, z: number, yaw: number) => void,
  ): void {
    const { x, z, size, height, spire } = KEEP;
    const base = TOWN_Y;
    keepStone.push(stoneBox(size, height, size, x, base + height / 2, z));
    keepStone.push(stoneBox(size + 0.6, 0.6, size + 0.6, x, base + height - 0.3, z)); // cornice
    stone.push(stoneBox(size + 1, 1.4, size + 1, x, base + 0.7, z)); // plinth
    const roof = new THREE.ConeGeometry(size * 0.78, spire, 4, 1);
    roof.rotateY(PI / 4);
    roof.translate(x, base + height + spire / 2, z);
    roofs.push(roof);
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const tx = x + (sx * size) / 2;
      const tz = z + (sz * size) / 2;
      const turret = new THREE.CylinderGeometry(1.35, 1.45, height + 4.5, 12);
      turret.translate(tx, base + (height + 4.5) / 2, tz);
      keepStone.push(turret);
      const cap = new THREE.ConeGeometry(1.9, 5.5, 12, 1);
      cap.translate(tx, base + height + 4.5 + 2.75, tz);
      roofs.push(cap);
      physicsCylinder(box, tx, base + (height + 4.5) / 2, tz, (height + 4.5) / 2);
    }
    // Tall windows on each face, two storeys of them.
    for (const y of [base + 6, base + 11.5]) {
      for (const [dx, dz, yaw] of [
        [0, -size / 2 - 0.03, 0],
        [0, size / 2 + 0.03, 0],
        [-size / 2 - 0.03, 0, PI / 2],
        [size / 2 + 0.03, 0, PI / 2],
      ] as const) {
        for (const off of [-1.4, 1.4]) {
          const ax = yaw === 0 ? off : 0;
          const az = yaw === 0 ? 0 : off;
          dark.push(stoneBox(0.9, 2.2, 0.08, x + dx + ax, y, z + dz + az, yaw));
        }
      }
    }
    // A great door facing the square.
    dark.push(stoneBox(2.2, 3.4, 0.1, x + size / 2 + 0.04, base + 1.7, z, PI / 2));
    box(size / 2, height / 2, size / 2, x, base + height / 2, z, 0);
  }

  #houseColliders(physics: PhysicsWorld): void {
    const R = physics.rapier;
    for (const h of HOUSES) {
      const height = (h.floors + 0.6) * TOWN_CELL;
      tmpQ.setFromAxisAngle(Y, h.yaw);
      physics.addStatic(
        R.ColliderDesc.cuboid(TOWN_CELL, height / 2, (h.width * TOWN_CELL) / 2)
          .setTranslation(h.x, TOWN_Y + height / 2, h.z)
          .setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }),
      );
    }
    for (const p of PROPS) {
      if (p.cylinder) {
        physics.addStatic(R.ColliderDesc.cylinder(1, p.cylinder).setTranslation(p.x, TOWN_Y + 1, p.z));
      } else if (p.box) {
        tmpQ.setFromAxisAngle(Y, p.yaw);
        physics.addStatic(
          R.ColliderDesc.cuboid(...p.box)
            .setTranslation(p.x, TOWN_Y + p.box[1], p.z)
            .setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }),
        );
      }
    }
  }
}

/** Turrets collide as boxes inscribed in their round footprint (close enough at this size). */
function physicsCylinder(
  box: (hx: number, hy: number, hz: number, x: number, y: number, z: number, yaw: number) => void,
  x: number,
  y: number,
  z: number,
  halfHeight: number,
): void {
  box(1.1, halfHeight, 1.1, x, y, z, PI / 4);
}
