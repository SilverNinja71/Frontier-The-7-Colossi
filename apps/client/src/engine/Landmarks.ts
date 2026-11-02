import { DeterministicRng } from '@frontier/combat-math';
import * as THREE from 'three';
import { fbm, ISLE, LAKE, LANDMARKS, STRUCTURES, WATER_LEVEL, type HeightGrid, type Landmark } from '../world/geography.ts';
import type { NatureKit } from './NatureKit.ts';
import type { PhysicsWorld } from './PhysicsWorld.ts';

interface Waystone {
  landmark: Landmark;
  group: THREE.Group;
  crystal: THREE.Mesh;
  glow: THREE.MeshStandardMaterial;
  attuned: boolean;
  phase: number;
}

const ATTUNED = new THREE.Color('#5fe3ff');
const DORMANT = new THREE.Color('#2a3440');

/**
 * Hand-placed structures at each landmark (dock, shrine, lookout, rock arch, colonnade,
 * standing stones, the Elder Oak) and a waystone at every one: the respawn and fast-travel
 * points that light up once discovered.
 */
export class Landmarks {
  readonly group = new THREE.Group();
  readonly #waystones = new Map<string, Waystone>();
  readonly #nightGlow: THREE.MeshStandardMaterial[] = [];
  readonly #flames: THREE.Mesh[] = [];
  readonly #rng = new DeterministicRng(777);
  readonly #stone = new THREE.MeshStandardMaterial({ color: '#b8ae9c', flatShading: true, roughness: 0.88 });
  readonly #darkStone = new THREE.MeshStandardMaterial({ color: '#4a4652', flatShading: true, roughness: 0.92 });
  readonly #wood = new THREE.MeshStandardMaterial({ color: '#6e4b30', flatShading: true, roughness: 0.9 });
  readonly #lacquer = new THREE.MeshStandardMaterial({ color: '#b3362c', flatShading: true, roughness: 0.55 });
  readonly #gold = new THREE.MeshStandardMaterial({ color: '#d9b14c', flatShading: true, roughness: 0.35, metalness: 0.7 });
  readonly #flame = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });

  constructor(
    private readonly grid: HeightGrid,
    private readonly physics: PhysicsWorld,
    kit: NatureKit | null,
  ) {
    for (const landmark of LANDMARKS) this.#buildWaystone(landmark);
    this.#buildDock();
    this.#buildIsleShrine();
    this.#buildLookout();
    this.#buildArch();
    this.#buildColonnade();
    this.#buildStoneCircle();
    this.#buildElderOak(kit);
  }

  setAttuned(id: string, attuned: boolean): void {
    const stone = this.#waystones.get(id);
    if (!stone) return;
    stone.attuned = attuned;
    stone.glow.emissive.copy(attuned ? ATTUNED : DORMANT);
    stone.glow.emissiveIntensity = attuned ? 1.6 : 0.4;
  }

  /** Where a hunter rises or arrives at this landmark's waystone. */
  spawnPoint(id: string): { x: number; y: number; z: number } | null {
    const landmark = LANDMARKS.find((l) => l.id === id);
    if (!landmark) return null;
    if (id === 'firstia') return { x: 0, y: 0, z: 7 };
    const x = landmark.stone.x;
    const z = landmark.stone.z + 2.6;
    return { x, y: this.grid.sample(x, z), z };
  }

  update(time: number, night: number): void {
    for (const stone of this.#waystones.values()) {
      stone.crystal.rotation.y = time * 0.8 + stone.phase;
      stone.crystal.position.y = 3.45 + Math.sin(time * 1.6 + stone.phase) * 0.12;
      stone.crystal.visible = stone.attuned;
    }
    for (const material of this.#nightGlow) material.emissiveIntensity = 0.15 + night * 1.6;
    this.#flame.opacity = night;
    for (const flame of this.#flames) {
      flame.visible = night > 0.02;
      flame.scale.y = 0.7 + Math.sin(time * 9 + flame.id) * 0.08 + Math.sin(time * 17 + flame.id) * 0.06;
    }
  }

  // --- Builders -----------------------------------------------------------------------

  #ground(x: number, z: number): number {
    return this.grid.sample(x, z);
  }

  #mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.group): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  #cylinderCollider(x: number, y: number, z: number, halfHeight: number, radius: number): void {
    this.physics.addStatic(this.physics.rapier.ColliderDesc.cylinder(halfHeight, radius).setTranslation(x, y, z));
  }

  #boxCollider(mesh: THREE.Mesh, hx: number, hy: number, hz: number): void {
    mesh.updateWorldMatrix(true, false);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    mesh.matrixWorld.decompose(p, q, new THREE.Vector3());
    this.physics.addStatic(
      this.physics.rapier.ColliderDesc.cuboid(hx, hy, hz).setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
    );
  }

  #buildWaystone(landmark: Landmark): void {
    const { x, z } = landmark.stone;
    const y = this.#ground(x, z);
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = this.#rng.next() * Math.PI;
    this.#mesh(new THREE.CylinderGeometry(1.0, 1.25, 0.45, 8), this.#stone, 0, 0.1, 0, group);
    const obelisk = this.#mesh(new THREE.CylinderGeometry(0.26, 0.46, 2.7, 4), this.#darkStone, 0, 1.65, 0, group);
    obelisk.rotation.y = Math.PI / 4;
    const glow = new THREE.MeshStandardMaterial({ color: '#1b2430', emissive: DORMANT.clone(), emissiveIntensity: 0.4, flatShading: true });
    const band = this.#mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 20), glow, 0, 1.25, 0, group);
    band.rotation.x = Math.PI / 2;
    const band2 = this.#mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), glow, 0, 2.05, 0, group);
    band2.rotation.x = Math.PI / 2;
    const crystal = this.#mesh(new THREE.OctahedronGeometry(0.3, 0), glow, 0, 3.45, 0, group);
    crystal.scale.y = 1.6;
    crystal.castShadow = false;
    crystal.visible = false;
    this.group.add(group);
    this.#cylinderCollider(x, y + 1.4, z, 1.4, 0.55);
    this.#waystones.set(landmark.id, { landmark, group, crystal, glow, attuned: false, phase: this.#rng.next() * 6 });
  }

  /** A plank dock reaching out from Mirror Lake's western shore. */
  #buildDock(): void {
    const from = LANDMARKS.find((l) => l.id === 'mirror-lake')!.stone;
    const dx = LAKE.x - from.x;
    const dz = LAKE.z - from.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    // Walk towards the water until the bank is low enough.
    let start = 3;
    while (start < len && this.#ground(from.x + ux * start, from.z + uz * start) > WATER_LEVEL + 0.45) start += 0.5;
    const length = 15;
    const deck = WATER_LEVEL + 0.55;
    const cx = from.x + ux * (start + length / 2 - 1);
    const cz = from.z + uz * (start + length / 2 - 1);
    const yaw = Math.atan2(ux, uz);
    const dock = new THREE.Group();
    dock.position.set(cx, deck, cz);
    dock.rotation.y = yaw;
    const plank = new THREE.BoxGeometry(2.6, 0.12, 0.42);
    for (let k = 0; k < length / 0.48; k++) {
      const p = this.#mesh(plank, this.#wood, (this.#rng.next() - 0.5) * 0.08, -0.06, -length / 2 + k * 0.48, dock);
      p.rotation.y = (this.#rng.next() - 0.5) * 0.04;
    }
    const post = new THREE.CylinderGeometry(0.1, 0.12, 2.2, 6);
    for (let k = 0; k <= 4; k++) {
      for (const side of [-1.25, 1.25]) this.#mesh(post, this.#wood, side, -0.75, -length / 2 + (k * length) / 4, dock);
    }
    // Lanterns at the end.
    for (const side of [-1.2, 1.2]) {
      this.#mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), this.#wood, side, 0.7, length / 2 - 0.3, dock);
      const lamp = new THREE.MeshStandardMaterial({ color: '#2a2016', emissive: '#ffb45a', emissiveIntensity: 0.2, flatShading: true });
      this.#nightGlow.push(lamp);
      this.#mesh(new THREE.BoxGeometry(0.3, 0.36, 0.3), lamp, side, 1.55, length / 2 - 0.3, dock);
    }
    this.group.add(dock);
    const collider = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, length));
    collider.position.set(0, -0.12, 0);
    dock.add(collider);
    this.#boxCollider(collider, 1.3, 0.12, length / 2);
    dock.remove(collider);
  }

  /** A vermilion gate and an altar on Moon Isle (with offerings for a certain monkey king). */
  #buildIsleShrine(): void {
    const x = ISLE.x;
    const z = ISLE.z;
    const y = this.#ground(x, z);
    const shrine = new THREE.Group();
    shrine.position.set(x, y, z);
    shrine.rotation.y = -Math.PI / 2; // faces the western shore
    const postGeo = new THREE.CylinderGeometry(0.2, 0.24, 4.2, 8);
    for (const side of [-1.8, 1.8]) {
      this.#mesh(postGeo, this.#lacquer, side, 2.1, 3, shrine);
      this.#mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 8), this.#darkStone, side, 0.1, 3, shrine);
    }
    const kasagi = this.#mesh(new THREE.BoxGeometry(5.4, 0.32, 0.5), this.#darkStone, 0, 4.35, 3, shrine);
    kasagi.rotation.z = 0;
    this.#mesh(new THREE.BoxGeometry(5.0, 0.24, 0.4), this.#lacquer, 0, 4.05, 3, shrine);
    this.#mesh(new THREE.BoxGeometry(4.2, 0.2, 0.26), this.#lacquer, 0, 3.4, 3, shrine);
    // Altar with peaches and a little golden staff.
    const altar = this.#mesh(new THREE.BoxGeometry(1.8, 0.9, 1.0), this.#stone, 0, 0.45, -0.6, shrine);
    const peach = new THREE.MeshStandardMaterial({ color: '#f29a7a', emissive: '#ff8060', emissiveIntensity: 0.08, roughness: 0.6 });
    for (const [px, pz] of [
      [-0.3, -0.55],
      [0.05, -0.75],
      [0.32, -0.5],
    ] as const) {
      this.#mesh(new THREE.SphereGeometry(0.14, 10, 8), peach, px, 1.02, pz, shrine);
    }
    const staff = this.#mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 8), this.#gold, 0, 0.94, -0.35, shrine);
    staff.rotation.z = Math.PI / 2;
    // Stone lanterns.
    for (const side of [-1.6, 1.6]) {
      this.#mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6), this.#stone, side, 0.55, -1.6, shrine);
      const lamp = new THREE.MeshStandardMaterial({ color: '#30261c', emissive: '#ffc070', emissiveIntensity: 0.2, flatShading: true });
      this.#nightGlow.push(lamp);
      this.#mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), lamp, side, 1.3, -1.6, shrine);
      this.#mesh(new THREE.ConeGeometry(0.42, 0.3, 4), this.#stone, side, 1.65, -1.6, shrine).rotation.y = Math.PI / 4;
    }
    this.group.add(shrine);
    shrine.updateMatrixWorld(true);
    this.#boxCollider(altar, 0.9, 0.45, 0.5);
    for (const side of [-1.8, 1.8]) {
      const p = new THREE.Vector3(side, 2.1, 3).applyMatrix4(shrine.matrixWorld);
      this.#cylinderCollider(p.x, p.y, p.z, 2.1, 0.26);
    }
  }

  /** A ring of broken columns and a signal pyre on Howling Ridge's summit. */
  #buildLookout(): void {
    const x = STRUCTURES.RIDGE.x;
    const z = STRUCTURES.RIDGE.z + 6;
    const y = this.#ground(x, z);
    this.#mesh(new THREE.CylinderGeometry(7.5, 7.9, 0.6, 16), this.#stone, x, y + 0.02, z);
    this.#cylinderCollider(x, y + 0.02, z, 0.3, 7.6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const height = 1 + this.#rng.next() * 3;
      const cx = x + Math.sin(a) * 6.8;
      const cz = z + Math.cos(a) * 6.8;
      this.#mesh(new THREE.CylinderGeometry(0.45, 0.52, height, 8), this.#stone, cx, y + 0.3 + height / 2, cz);
      this.#cylinderCollider(cx, y + 0.3 + height / 2, cz, height / 2, 0.52);
    }
    // Pyre: crossed logs with a fire that burns at night.
    for (let i = 0; i < 6; i++) {
      const log = this.#mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.0, 6), this.#wood, x, y + 0.9, z);
      log.rotation.set(0.5, (i / 6) * Math.PI, 0);
    }
    const flame = this.#mesh(new THREE.ConeGeometry(0.8, 2.4, 8, 1, true).translate(0, 1.2, 0), this.#flame, x, y + 0.6, z);
    flame.castShadow = false;
    this.#flames.push(flame);
    this.#cylinderCollider(x, y + 1, z, 1, 0.9);
    // A banner on a tall pole.
    this.#mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), this.#wood, x + 4.5, y + 3.8, z - 4);
    const banner = this.#mesh(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshStandardMaterial({ color: '#b3342c', side: THREE.DoubleSide, flatShading: true }), x + 5.3, y + 5.8, z - 4);
    banner.rotation.y = 0.3;
  }

  /** A natural stone bridge over Windcut Gorge. */
  #buildArch(): void {
    const { from, to, plateau } = STRUCTURES.GORGE;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    const acrossX = -dz / len;
    const acrossZ = dx / len;
    const floor = this.#ground(plateau.x, plateau.z);
    const geometry = new THREE.TorusGeometry(15, 3.4, 9, 26, Math.PI);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const px = position.getX(i);
      const py = position.getY(i);
      const pz = position.getZ(i);
      const n = (fbm(px * 0.25 + 3, py * 0.25 + pz * 0.3) - 0.5) * 2.2;
      position.setXYZ(i, px + n * 0.6, py + n, pz + n * 0.8);
    }
    geometry.computeVertexNormals();
    const rock = new THREE.MeshStandardMaterial({ color: '#9b8f7f', flatShading: true, roughness: 0.95 });
    const arch = this.#mesh(geometry, rock, plateau.x, floor - 3, plateau.z);
    arch.rotation.y = Math.atan2(-acrossZ, acrossX);
    arch.scale.set(1, 1.15, 1);
  }

  /** Two rows of weathered columns on a terrace, half of them fallen. */
  #buildColonnade(): void {
    const { x: cx, z: cz, height } = STRUCTURES.COLONNADE;
    const slab = new THREE.BoxGeometry(2.7, 0.22, 2.7);
    for (let i = -3; i <= 3; i++) {
      for (let j = -6; j <= 6; j++) {
        if (this.#rng.next() < 0.28) continue;
        const s = this.#mesh(slab, this.#stone, cx + i * 2.85, height + 0.05, cz + j * 2.85);
        s.rotation.set((this.#rng.next() - 0.5) * 0.04, (this.#rng.next() - 0.5) * 0.1, (this.#rng.next() - 0.5) * 0.04);
        s.castShadow = false;
      }
    }
    const shaft = (h: number) => new THREE.CylinderGeometry(0.55, 0.62, h, 10);
    const intact: [number, number][] = [];
    for (const side of [-7.5, 7.5]) {
      for (let k = 0; k < 6; k++) {
        const x = cx + side;
        const z = cz - 15 + k * 6;
        const broken = this.#rng.next() < 0.45;
        const h = broken ? 1.2 + this.#rng.next() * 2.8 : 6.4;
        this.#mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), this.#stone, x, height + 0.25, z);
        this.#mesh(shaft(h), this.#stone, x, height + 0.5 + h / 2, z);
        this.#cylinderCollider(x, height + 0.5 + h / 2, z, h / 2 + 0.25, 0.66);
        if (!broken) {
          this.#mesh(new THREE.BoxGeometry(1.5, 0.45, 1.5), this.#stone, x, height + 0.5 + h + 0.22, z);
          intact.push([x, z]);
        } else {
          // Its drums lie where they fell.
          const a = this.#rng.next() * Math.PI * 2;
          for (let d = 0; d < 2; d++) {
            const fx = x + Math.sin(a) * (1.6 + d * 1.3);
            const fz = z + Math.cos(a) * (1.6 + d * 1.3);
            const drum = this.#mesh(shaft(1.2), this.#stone, fx, this.#ground(fx, fz) + 0.55, fz);
            drum.rotation.set(Math.PI / 2, 0, a);
            this.#cylinderCollider(fx, this.#ground(fx, fz) + 0.55, fz, 0.6, 0.6);
          }
        }
      }
    }
    // A lintel still bridges the northernmost pair, if both stand.
    const north = intact.filter(([, z]) => z === cz - 15);
    if (north.length === 2) {
      this.#mesh(new THREE.BoxGeometry(16.6, 0.8, 1.4), this.#stone, cx, height + 0.5 + 6.4 + 0.85, cz - 15);
    }
  }

  /** Nine standing stones in the Gloamwood whose runes wake at night. */
  #buildStoneCircle(): void {
    const { x: cx, z: cz } = STRUCTURES.MOONLESS_CIRCLE;
    const rune = new THREE.MeshStandardMaterial({ color: '#1a1424', emissive: '#a070ff', emissiveIntensity: 0.2, flatShading: true });
    this.#nightGlow.push(rune);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const x = cx + Math.sin(a) * 11;
      const z = cz + Math.cos(a) * 11;
      const h = 3.4 + this.#rng.next() * 1.8;
      const y = this.#ground(x, z);
      const stone = new THREE.Group();
      stone.position.set(x, y, z);
      stone.rotation.set((this.#rng.next() - 0.5) * 0.12, a, (this.#rng.next() - 0.5) * 0.12);
      this.#mesh(new THREE.BoxGeometry(1.5, h, 0.85), this.#darkStone, 0, h / 2 - 0.3, 0, stone);
      this.#mesh(new THREE.BoxGeometry(0.16, h * 0.55, 0.05), rune, 0, h * 0.45, -0.44, stone);
      this.group.add(stone);
      this.#cylinderCollider(x, y + h / 2, z, h / 2, 0.75);
    }
    const y = this.#ground(cx, cz);
    for (const side of [-1.1, 1.1]) this.#mesh(new THREE.BoxGeometry(0.6, 0.8, 1.2), this.#darkStone, cx + side, y + 0.4, cz);
    this.#mesh(new THREE.BoxGeometry(3.2, 0.3, 1.6), this.#darkStone, cx, y + 0.95, cz);
    this.physics.addStatic(this.physics.rapier.ColliderDesc.cuboid(1.6, 0.55, 0.8).setTranslation(cx, y + 0.55, cz));
  }

  /** The oldest tree in the wilds. */
  #buildElderOak(kit: NatureKit | null): void {
    const { x, z } = STRUCTURES.MEADOW_HILL;
    const y = this.#ground(x, z);
    const scale = 3.4;
    if (kit?.has('CommonTree_2')) {
      for (const part of kit.parts('CommonTree_2')) {
        const mesh = new THREE.Mesh(part.geometry, part.material);
        mesh.position.set(x, y - 0.3, z);
        mesh.scale.setScalar(scale);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    } else {
      this.#mesh(new THREE.CylinderGeometry(0.9, 1.3, 9, 8), this.#wood, x, y + 4.5, z);
      this.#mesh(new THREE.IcosahedronGeometry(6, 1), new THREE.MeshStandardMaterial({ color: '#4f7a35', flatShading: true }), x, y + 11, z);
    }
    this.#cylinderCollider(x, y + 4, z, 4, 1.15);
    // A bench of stone in its shade.
    const bx = x + 5;
    const bz = z + 3;
    const by = this.#ground(bx, bz);
    const bench = this.#mesh(new THREE.BoxGeometry(2.6, 0.22, 0.7), this.#stone, bx, by + 0.55, bz);
    bench.rotation.y = 0.5;
    for (const side of [-1, 1]) {
      const leg = this.#mesh(new THREE.BoxGeometry(0.3, 0.5, 0.6), this.#stone, bx + Math.cos(0.5) * side, by + 0.25, bz - Math.sin(0.5) * side);
      leg.rotation.y = 0.5;
    }
  }
}
