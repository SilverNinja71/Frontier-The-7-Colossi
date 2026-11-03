import * as THREE from 'three';
import { FENCES, HOUSES, PROPS, TOWN_CELL, TOWN_Y, type HouseSpec } from '../world/town.ts';
import type { KitPart, NatureKit } from './NatureKit.ts';
import type { PhysicsWorld } from './PhysicsWorld.ts';

/** One module instance in town space (metres). */
interface Placement {
  model: string;
  matrix: THREE.Matrix4;
  /** Mirrored across local z (gable halves): drawn from a pre-flipped geometry. */
  mirror: boolean;
}

const PI = Math.PI;
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** Kit-local placement: position in grid units, yaw, optional z-mirror. */
function local(x: number, y: number, z: number, rot: number, mirror = false): THREE.Matrix4 {
  return new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ.setFromAxisAngle(Y, rot), tmpS.set(1, 1, mirror ? -1 : 1));
}

/** House space (grid units, front = +x) → world metres. */
function houseFrame(h: HouseSpec): THREE.Matrix4 {
  return new THREE.Matrix4().compose(tmpP.set(h.x, TOWN_Y, h.z), tmpQ.setFromAxisAngle(Y, h.yaw), tmpS.setScalar(TOWN_CELL));
}

/**
 * A house from wall, gable and roof modules: 2 cells deep, `width` cells along the front,
 * walls on every outer cell edge per floor (door and windows on the front), a steep gable
 * roof whose ridge runs along the front, triangular gable walls at both ends.
 */
function houseModules(h: HouseSpec): Placement[] {
  const out: Placement[] = [];
  const frame = houseFrame(h);
  const add = (model: string, m: THREE.Matrix4, mirror = false) => out.push({ model, matrix: new THREE.Matrix4().multiplyMatrices(frame, m), mirror });
  const W = h.width;
  const z0 = -W / 2 + 0.5;
  const doorAt = Math.floor(W / 2);
  const wallKind = (floor: number) => (h.style === 'wood' || (h.style === 'timber' && floor > 0) ? 'wall-wood' : 'wall');
  const windowKind = (floor: number) => (wallKind(floor) === 'wall-wood' ? 'wall-wood-window-shutters' : floor > 0 ? 'wall-window-round' : 'wall-window-shutters');

  for (let f = 0; f < h.floors; f++) {
    const plain = wallKind(f);
    for (let j = 0; j < W; j++) {
      const z = z0 + j;
      // Front: the door on the ground floor, windows elsewhere.
      const front = f === 0 && j === doorAt ? (plain === 'wall-wood' ? 'wall-wood-door' : 'wall-door') : f > 0 || j % 2 === 1 || W === 2 ? windowKind(f) : plain;
      add(front, local(0.5, f, z, 0));
      // Back: mostly plain, a window on upper floors.
      add(f > 0 && j === doorAt ? windowKind(f) : plain, local(-0.5, f, z, PI));
    }
    for (const x of [-0.5, 0.5]) {
      add(f > 0 && x > 0 ? windowKind(f) : plain, local(x, f, z0, PI / 2));
      add(plain, local(x, f, z0 + W - 1, -PI / 2));
    }
  }

  const top = h.floors;
  const gable = wallKind(h.floors - 1) === 'wall-wood' ? 'wall-wood-slope' : 'wall-slope';
  for (let j = 0; j < W; j++) {
    add('roof-high', local(-0.5, top, z0 + j, 0));
    add('roof-high', local(0.5, top, z0 + j, PI));
  }
  add(gable, local(-0.5, top, z0, PI / 2));
  add(gable, local(0.5, top, z0, PI / 2), true);
  add(gable, local(-0.5, top, z0 + W - 1, -PI / 2), true);
  add(gable, local(0.5, top, z0 + W - 1, -PI / 2));

  if (h.chimney) {
    add('chimney-base', local(-0.5, top, z0 + W - 1, PI));
    add('chimney-top', local(-0.5, top + 1, z0 + W - 1, PI));
  }
  if (h.banner) {
    // Hung outside the upper front wall: placed in the neighbouring cell, turned to face out.
    const banner = h.banner === 'red' ? 'banner-red' : 'banner-green';
    add(banner, local(1.5, Math.min(1, h.floors - 1), z0, PI));
    if (W > 2) add(banner, local(1.5, Math.min(1, h.floors - 1), z0 + W - 1, PI));
  }
  return out;
}

function propMatrix(model: string, x: number, z: number, yaw: number, scale = TOWN_CELL): Placement {
  return {
    model,
    matrix: new THREE.Matrix4().compose(tmpP.set(x, TOWN_Y, z), tmpQ.setFromAxisAngle(Y, yaw), tmpS.setScalar(scale)),
    mirror: false,
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

/**
 * The First Bastion: every module drawn through one BatchedMesh per material (the kit shares a
 * single colour map, so the whole town is ~2 draw calls), houses as box colliders, props as
 * boxes or cylinders, and the mill's sails turning in the wind.
 */
export class Town {
  readonly group = new THREE.Group();
  readonly #sails: THREE.Object3D[] = [];

  constructor(kit: NatureKit | null, physics: PhysicsWorld) {
    this.group.name = 'First Bastion';
    this.#colliders(physics);
    if (!kit || !kit.has('wall')) return; // no art: the colliders still keep the street walkable
    const placements: Placement[] = [
      ...HOUSES.flatMap(houseModules),
      ...PROPS.map((p) => propMatrix(p.model, p.x, p.z, p.yaw, p.scale)),
      // Fence slabs sit on a cell's +x edge: shift back so the slab lies on the given line.
      ...FENCES.map((f) => propMatrix('fence', f.x - 0.46 * TOWN_CELL * Math.cos(f.yaw), f.z + 0.46 * TOWN_CELL * Math.sin(f.yaw), f.yaw)),
    ];
    this.#batch(kit, placements);
    this.#buildSails(kit);
  }

  /** Turn the mill's sails; call once per rendered frame. */
  update(seconds: number): void {
    for (const sails of this.#sails) sails.rotation.x = seconds * 0.6;
  }

  #batch(kit: NatureKit, placements: Placement[]): void {
    const flipped = new Map<THREE.BufferGeometry, THREE.BufferGeometry>();
    const batches = new Map<THREE.Material, { geometries: Map<THREE.BufferGeometry, number>; items: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[]; vertices: number; indices: number }>();
    for (const placement of placements) {
      for (const part of kit.parts(placement.model) as KitPart[]) {
        let geometry = part.geometry;
        if (placement.mirror) {
          if (!flipped.has(geometry)) flipped.set(geometry, mirrored(geometry));
          geometry = flipped.get(geometry)!;
        }
        let batch = batches.get(part.material);
        if (!batch) {
          batch = { geometries: new Map(), items: [], vertices: 0, indices: 0 };
          batches.set(part.material, batch);
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

  #buildSails(kit: NatureKit): void {
    for (const h of HOUSES.filter((house) => house.windmill)) {
      const hub = new THREE.Group();
      for (const part of kit.parts('windmill')) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.castShadow = true;
        hub.add(mesh);
      }
      // On the north gable (local -z end), just under the ridge, spinning about the gable's normal.
      const mount = new THREE.Group();
      mount.matrixAutoUpdate = false;
      mount.matrix.multiplyMatrices(houseFrame(h), local(0, h.floors + 0.55, -h.width / 2 - 0.3, PI / 2));
      mount.add(hub);
      this.group.add(mount);
      this.#sails.push(hub);
    }
  }

  #colliders(physics: PhysicsWorld): void {
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
    for (const f of FENCES) {
      tmpQ.setFromAxisAngle(Y, f.yaw);
      physics.addStatic(
        R.ColliderDesc.cuboid(0.12, 0.6, TOWN_CELL / 2)
          .setTranslation(f.x, TOWN_Y + 0.6, f.z)
          .setRotation({ x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w }),
      );
    }
  }
}
