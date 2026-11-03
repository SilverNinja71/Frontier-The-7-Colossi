import { DeterministicRng } from '@frontier/combat-math';
import * as THREE from 'three';
import {
  ARENA_RADIUS,
  biomeAt,
  inLake,
  LANDMARKS,
  PLAYABLE_RADIUS,
  roadAt,
  ROADS,
  STRUCTURES,
  WATER_LEVEL,
  WORLD_HALF,
  type Biome,
  type HeightGrid,
} from '../world/geography.ts';
import type { NatureKit } from './NatureKit.ts';
import type { PhysicsWorld } from './PhysicsWorld.ts';

const BROADLEAF = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'];
const PINES = ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'];
const DEAD_TREES = ['DeadTree_1', 'DeadTree_2', 'DeadTree_3'];
const TWISTED = ['TwistedTree_1', 'TwistedTree_2', 'TwistedTree_3'];
const ROCKS = ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'];
const SHORT_GRASS = ['Grass_Common_Short', 'Grass_Wispy_Short'];
const TALL_GRASS = ['Grass_Common_Tall', 'Grass_Wispy_Tall'];
const FLOWERS = ['Flower_3_Group', 'Flower_4_Group'];
const PATH_STONES = ['RockPath_Round_Wide', 'RockPath_Square_Wide', 'RockPath_Round_Small_1', 'RockPath_Round_Small_2'];
const SHADOW_CASTERS = new Set([...BROADLEAF, ...PINES, ...DEAD_TREES, ...TWISTED, ...ROCKS, 'Bush_Common', 'Bush_Common_Flowers']);

/** Small props are only drawn within these distances (metres) of the player. */
const DETAIL_RANGE: Record<string, number> = {
  Grass_Common_Short: 62,
  Grass_Wispy_Short: 62,
  Grass_Common_Tall: 75,
  Grass_Wispy_Tall: 75,
  Clover_1: 55,
  Flower_3_Group: 85,
  Flower_4_Group: 85,
  Fern_1: 80,
  Plant_1: 70,
  Plant_7: 70,
  Mushroom_Common: 50,
  Mushroom_Laetiporus: 50,
  Pebble_Round_1: 45,
  Pebble_Round_2: 45,
  Pebble_Round_3: 45,
  RockPath_Round_Small_1: 90,
  RockPath_Round_Small_2: 90,
};

/** Clearings kept free around landmarks so structures stand in the open. */
const CLEARINGS = [
  ...LANDMARKS.map((l) => ({ x: l.stone.x, z: l.stone.z, r: 5 })),
  { x: STRUCTURES.COLONNADE.x, z: STRUCTURES.COLONNADE.z, r: STRUCTURES.COLONNADE.radius },
  { x: STRUCTURES.MOONLESS_CIRCLE.x, z: STRUCTURES.MOONLESS_CIRCLE.z, r: 15 },
  { x: STRUCTURES.MEADOW_HILL.x, z: STRUCTURES.MEADOW_HILL.z, r: 16 },
  { x: STRUCTURES.RIDGE.x, z: STRUCTURES.RIDGE.z + 6, r: 14 },
  { x: STRUCTURES.GULLET.x, z: STRUCTURES.GULLET.z, r: STRUCTURES.GULLET.radius + 3 },
  { x: STRUCTURES.FIRST_BASTION.x, z: STRUCTURES.FIRST_BASTION.z, r: STRUCTURES.FIRST_BASTION.radius + 6 },
];

interface Placement {
  matrix: THREE.Matrix4;
  x: number;
  z: number;
}

interface DetailBatch {
  mesh: THREE.BatchedMesh;
  ids: number[];
  xs: Float32Array;
  zs: Float32Array;
  range2: number;
}

/**
 * Everything that grows or lies on the Bramble Primeval: forests by biome, rocks on slopes and
 * the mesa, meadow grass and flowers, reeds at the lake, stones along the roads. Instanced
 * per material through BatchedMesh (one draw call each, per-instance frustum culling), with
 * small props switched off beyond a short range of the player.
 */
export class WorldScatter {
  readonly group = new THREE.Group();
  readonly #placements = new Map<string, Placement[]>();
  readonly #details: DetailBatch[] = [];
  readonly #rng = new DeterministicRng(4242);
  readonly #biome: Biome = { forest: 0, gloam: 0, highland: 0, amber: 0, mesa: 0 };
  readonly #normal = { x: 0, y: 1, z: 0 };
  readonly #road = { weight: 0, x: 0, z: 0 };
  #lastCullX = Infinity;
  #lastCullZ = Infinity;

  constructor(
    private readonly grid: HeightGrid,
    private readonly physics: PhysicsWorld,
    kit: NatureKit | null,
    lowPower: boolean,
  ) {
    if (kit) {
      this.#scatterKit(lowPower);
      this.#build(kit);
    } else {
      this.#buildFallback();
    }
  }

  /** Re-cull small props when the player has moved a few metres. */
  update(x: number, z: number): void {
    if ((x - this.#lastCullX) ** 2 + (z - this.#lastCullZ) ** 2 < 9) return;
    this.#lastCullX = x;
    this.#lastCullZ = z;
    for (const batch of this.#details) {
      for (let i = 0; i < batch.ids.length; i++) {
        const dx = batch.xs[i]! - x;
        const dz = batch.zs[i]! - z;
        batch.mesh.setVisibleAt(batch.ids[i]!, dx * dx + dz * dz < batch.range2);
      }
    }
  }

  // --------------------------------------------------------------------------

  #scatterKit(lowPower: boolean): void {
    const rng = this.#rng;
    const b = this.#biome;
    const pick = (models: readonly string[]) => models[Math.floor(rng.next() * models.length)]!;
    const density = lowPower ? 0.45 : 1;

    // Trees on an 8 m jittered grid.
    this.#eachCell(8, (x, z, h, up) => {
      if (up < 0.8 || this.#cleared(x, z, 3) || this.#road.weight > 0.05) return;
      if (Math.hypot(x, z) < ARENA_RADIUS + 13) return;
      const meadow = Math.max(0, 1 - b.forest - b.gloam - b.highland - b.amber);
      const chance = b.forest * 0.62 + b.gloam * 0.72 + b.highland * 0.3 + meadow * 0.035 + b.amber * 0.02 + b.mesa * 0.05;
      if (rng.next() > chance * (lowPower ? 0.6 : 1)) return;
      let model: string;
      if (b.gloam > 0.5) {
        const roll = rng.next();
        model = roll < 0.55 ? pick(TWISTED) : roll < 0.8 ? pick(DEAD_TREES) : pick(PINES);
      } else if (b.highland > 0.5 || b.mesa > 0.5) {
        model = pick(PINES);
      } else {
        model = rng.next() < 0.72 ? pick(BROADLEAF) : pick(PINES);
      }
      const s = 0.85 + rng.next() * 0.5;
      this.#place(model, x, z, h, s, 0.05);
      const radius = model.startsWith('Twisted') ? 0.45 : model.startsWith('Dead') ? 0.35 : 0.32;
      this.physics.addStatic(
        this.physics.rapier.ColliderDesc.cylinder(1.5 * s, radius * s).setTranslation(x, h + 1.5 * s, z),
      );
    });

    // Rocks: slopes, the mesa and the high ground.
    this.#eachCell(11, (x, z, h, up) => {
      if (this.#cleared(x, z, 2) || this.#road.weight > 0.2 || Math.hypot(x, z) < ARENA_RADIUS + 5) return;
      const slope = 1 - up;
      const chance = 0.06 + b.mesa * 0.35 + b.highland * 0.25 + slope * 0.9 + b.gloam * 0.08;
      if (rng.next() > chance) return;
      const big = b.mesa + b.highland + slope > 0.5;
      const s = 0.45 + rng.next() * rng.next() * (big ? 2.6 : 1.3);
      this.#place(pick(ROCKS), x, z, h, s, 0.18);
      if (s > 0.8) this.physics.addStatic(this.physics.rapier.ColliderDesc.ball(1.05 * s).setTranslation(x, h + 0.45 * s, z));
    });

    // Bushes.
    this.#eachCell(9, (x, z, h, up) => {
      if (up < 0.85 || this.#cleared(x, z, 2) || this.#road.weight > 0.1 || Math.hypot(x, z) < ARENA_RADIUS + 4) return;
      const meadow = Math.max(0, 1 - b.forest - b.gloam - b.highland - b.amber);
      const chance = b.forest * 0.32 + b.gloam * 0.18 + meadow * 0.07 + b.amber * 0.12;
      if (rng.next() > chance * density) return;
      this.#place(b.amber > 0.4 || rng.next() < 0.2 ? 'Bush_Common_Flowers' : 'Bush_Common', x, z, h, 0.8 + rng.next() * 0.5);
    });

    // Undergrowth under the canopy.
    this.#eachCell(5.5, (x, z, h, up) => {
      if (up < 0.82 || this.#cleared(x, z, 1) || this.#road.weight > 0.2) return;
      const chance = b.forest * 0.38 + b.gloam * 0.5 + b.highland * 0.06;
      if (rng.next() > chance * density) return;
      const roll = rng.next();
      const model =
        b.gloam > 0.5
          ? roll < 0.45
            ? 'Fern_1'
            : roll < 0.7
              ? 'Plant_7'
              : roll < 0.88
                ? 'Mushroom_Laetiporus'
                : 'Mushroom_Common'
          : roll < 0.55
            ? 'Fern_1'
            : roll < 0.85
              ? 'Plant_1'
              : 'Mushroom_Common';
      this.#place(model, x, z, h, 0.8 + rng.next() * 0.6);
    });

    // Grass and clover.
    this.#eachCell(3.4, (x, z, h, up) => {
      if (up < 0.8 || this.#road.weight > 0.25 || this.#cleared(x, z, 0.5)) return;
      if (inLake(x, z) && h < WATER_LEVEL + 0.5) return;
      const r = Math.hypot(x, z);
      if (r < ARENA_RADIUS + 2.5) return;
      const meadow = Math.max(0, 1 - b.forest - b.gloam - b.highland - b.amber);
      const chance = meadow * 0.42 + b.amber * 0.6 + b.forest * 0.16 + b.gloam * 0.14 + b.highland * 0.18 - b.mesa * 0.3;
      if (rng.next() > chance * density) return;
      const tall = b.amber > 0.35 || b.gloam > 0.5 || rng.next() < 0.18;
      const model = rng.next() < meadow * 0.12 ? 'Clover_1' : pick(tall ? TALL_GRASS : SHORT_GRASS);
      this.#place(model, x, z, h, 0.75 + rng.next() * 0.65);
    });

    // Flowers: the Amber Meadow blooms.
    this.#eachCell(4.5, (x, z, h, up) => {
      if (up < 0.85 || this.#road.weight > 0.2 || this.#cleared(x, z, 1) || Math.hypot(x, z) < ARENA_RADIUS + 4) return;
      const meadow = Math.max(0, 1 - b.forest - b.gloam - b.highland - b.amber);
      if (rng.next() > (b.amber * 0.5 + meadow * 0.06) * density) return;
      this.#place(pick(FLOWERS), x, z, h, 0.8 + rng.next() * 0.5);
    });

    // Reeds along Mirror Lake's shore, and pebbles in the shallows.
    this.#eachCell(2.2, (x, z, h) => {
      if (!inLake(x, z) || h > WATER_LEVEL + 0.55 || h < WATER_LEVEL - 0.45) return;
      if (rng.next() > 0.45 * density) return;
      if (h < WATER_LEVEL) this.#place(pick(['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Round_3']), x, z, h, 0.8 + rng.next());
      else this.#place(pick(TALL_GRASS), x, z, h, 1 + rng.next() * 0.6);
    });

    // Stepping stones along the roads.
    for (const road of ROADS) {
      for (let i = 0; i < road.length - 1; i++) {
        const a = road[i]!;
        const c = road[i + 1]!;
        const length = Math.hypot(c.x - a.x, c.z - a.z);
        for (let d = 2; d < length; d += 2.6) {
          if (rng.next() > 0.3) continue;
          const t = d / length;
          const side = (rng.next() - 0.5) * 3.2;
          const nx = -(c.z - a.z) / length;
          const nz = (c.x - a.x) / length;
          const x = a.x + (c.x - a.x) * t + nx * side;
          const z = a.z + (c.z - a.z) * t + nz * side;
          if (Math.hypot(x, z) < ARENA_RADIUS + 2) continue;
          this.#place(pick(PATH_STONES), x, z, this.grid.sample(x, z), 0.7 + rng.next() * 0.5, 0.06);
        }
      }
    }
  }

  /** Visit one jittered point per cell across the playable land. */
  #eachCell(cell: number, visit: (x: number, z: number, h: number, up: number) => void): void {
    const rng = this.#rng;
    const limit = PLAYABLE_RADIUS + 20;
    const cells = Math.floor((WORLD_HALF * 2) / cell);
    for (let j = 0; j < cells; j++) {
      for (let i = 0; i < cells; i++) {
        const x = -WORLD_HALF + (i + rng.next()) * cell;
        const z = -WORLD_HALF + (j + rng.next()) * cell;
        if (x * x + z * z > limit * limit) continue;
        const h = this.grid.sample(x, z);
        if (inLake(x, z) && h < WATER_LEVEL + 0.15 && cell > 3) continue;
        const up = this.grid.normal(x, z, this.#normal).y;
        biomeAt(x, z, h, this.#biome);
        roadAt(x, z, this.#road);
        visit(x, z, h, up);
      }
    }
  }

  #cleared(x: number, z: number, margin: number): boolean {
    for (const c of CLEARINGS) {
      if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + margin) ** 2) return true;
    }
    return false;
  }

  #place(model: string, x: number, z: number, h: number, scale: number, sink = 0.05): void {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, h - sink * scale, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.#rng.next() * Math.PI * 2),
      new THREE.Vector3(scale, scale, scale),
    );
    const list = this.#placements.get(model) ?? [];
    list.push({ matrix, x, z });
    this.#placements.set(model, list);
  }

  /** One BatchedMesh per (material, near-only) pair. */
  #build(kit: NatureKit): void {
    interface Batch {
      geometries: Map<THREE.BufferGeometry, number>;
      instances: { geometry: THREE.BufferGeometry; placement: Placement }[];
      vertices: number;
      indices: number;
      castShadow: boolean;
      range: number;
    }
    const batches = new Map<string, Batch & { material: THREE.Material }>();
    for (const [model, placements] of this.#placements) {
      const range = DETAIL_RANGE[model] ?? 0;
      for (const part of kit.parts(model)) {
        const key = `${part.material.uuid}:${range}`;
        let batch = batches.get(key);
        if (!batch) {
          batch = { material: part.material, geometries: new Map(), instances: [], vertices: 0, indices: 0, castShadow: false, range };
          batches.set(key, batch);
        }
        if (!batch.geometries.has(part.geometry)) {
          batch.geometries.set(part.geometry, -1);
          batch.vertices += part.geometry.getAttribute('position').count;
          batch.indices += part.geometry.getIndex()!.count;
        }
        batch.castShadow ||= SHADOW_CASTERS.has(model);
        for (const placement of placements) batch.instances.push({ geometry: part.geometry, placement });
      }
    }
    for (const batch of batches.values()) {
      const mesh = new THREE.BatchedMesh(batch.instances.length, batch.vertices, batch.indices, batch.material);
      for (const geometry of batch.geometries.keys()) batch.geometries.set(geometry, mesh.addGeometry(geometry));
      const ids: number[] = [];
      for (const { geometry, placement } of batch.instances) {
        const id = mesh.addInstance(batch.geometries.get(geometry)!);
        mesh.setMatrixAt(id, placement.matrix);
        ids.push(id);
      }
      mesh.castShadow = batch.castShadow;
      mesh.receiveShadow = true;
      if (batch.range > 0) {
        mesh.sortObjects = false;
        this.#details.push({
          mesh,
          ids,
          xs: Float32Array.from(batch.instances, (i) => i.placement.x),
          zs: Float32Array.from(batch.instances, (i) => i.placement.z),
          range2: batch.range * batch.range,
        });
      }
      this.group.add(mesh);
    }
  }

  /** Procedural stand-ins when the art kit failed to load. */
  #buildFallback(): void {
    const trees: Placement[] = [];
    const b = this.#biome;
    this.#eachCell(9, (x, z, h, up) => {
      if (up < 0.8 || this.#road.weight > 0.05 || this.#cleared(x, z, 3) || Math.hypot(x, z) < ARENA_RADIUS + 13) return;
      if (this.#rng.next() > b.forest * 0.5 + b.gloam * 0.5 + b.highland * 0.3 + 0.03) return;
      const s = 0.8 + this.#rng.next() * 0.8;
      trees.push({
        matrix: new THREE.Matrix4().compose(new THREE.Vector3(x, h - 0.1, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)),
        x,
        z,
      });
      this.physics.addStatic(this.physics.rapier.ColliderDesc.cylinder(1.2 * s, 0.3 * s).setTranslation(x, h + 1.2 * s, z));
    });
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6).translate(0, 1.2, 0),
      new THREE.MeshStandardMaterial({ color: '#6b4c33', flatShading: true }),
      trees.length,
    );
    const crowns = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1.7, 4.2, 7).translate(0, 4.0, 0),
      new THREE.MeshStandardMaterial({ color: '#3f6b35', flatShading: true }),
      trees.length,
    );
    trees.forEach((t, i) => {
      trunks.setMatrixAt(i, t.matrix);
      crowns.setMatrixAt(i, t.matrix);
    });
    trunks.castShadow = crowns.castShadow = true;
    this.group.add(trunks, crowns);
  }
}
