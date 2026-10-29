import type { MeleeHit } from '@frontier/combat-math';
import { turnToward, yawFromDirection } from '@frontier/combat-math';
import type { GroundPose, Hurtbox, MonsterDefinition } from '@frontier/shared-types';
import * as THREE from 'three';
import type { PhysicsWorld } from '../engine/PhysicsWorld.ts';

const TRACK_TURN_RATE = (55 * Math.PI) / 180;
const DRILL_INTERVAL_TICKS = 150;
const DRILL_TELEGRAPH_TICKS = 36;
export const DRILL_RADIUS = 4.6;
const REGEN_DELAY_TICKS = 120;

export interface DummyStepResult {
  /** Set on the tick the drill slam lands. */
  slam: boolean;
  reset: boolean;
}

/**
 * Training dummy with spring-driven hit reactions, a directional weak-point core on its
 * back, optional player tracking (forces flanking), and a telegraphed slam drill for
 * practising dodge i-frames.
 */
export class TrainingDummy {
  readonly id = 'training-dummy-1';
  readonly group = new THREE.Group();
  readonly pose: GroundPose;
  readonly hurtboxes: readonly Hurtbox[];
  readonly maxHp: number;
  readonly defense: number;
  readonly slamDamage: number;
  hp: number;
  tracking = true;
  drillEnabled = false;

  readonly #sway = new THREE.Group();
  readonly #flashMaterials: THREE.MeshStandardMaterial[] = [];
  readonly #core: THREE.Mesh;
  readonly #telegraph: THREE.Mesh;
  readonly #shockwave: THREE.Mesh;
  #tiltX = 0;
  #tiltZ = 0;
  #tiltVX = 0;
  #tiltVZ = 0;
  #flash = 0;
  #squash = 0;
  #time = 0;
  #ticksSinceHit = Infinity;
  #drillTick = 0;
  #telegraphProgress = -1;
  #shockwaveAge = -1;
  #prevYaw: number;

  constructor(scene: THREE.Scene, physics: PhysicsWorld, def: MonsterDefinition, position: THREE.Vector3) {
    this.pose = { x: position.x, y: position.y, z: position.z, yaw: 0 };
    this.#prevYaw = 0;
    this.hurtboxes = def.hurtboxes;
    this.maxHp = this.hp = def.stats.maxHp;
    this.defense = def.stats.defense;
    this.slamDamage = def.stats.attack;

    const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...extra });
      this.#flashMaterials.push(m);
      return m;
    };
    const wood = mat('#7a5634');
    const straw = mat('#d8b867');
    const sack = mat('#c9b48e');
    const rope = mat('#5a3e26');

    this.group.position.copy(position);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.0, 6), wood);
    post.position.y = 0.5;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.18, 8), wood);
    base.position.y = 0.09;
    this.group.add(post, base, this.#sway);

    // Upper body pivots at the post top so hits rock it like a spring-mounted dummy.
    this.#sway.position.y = 0.45;
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, y: number, z = 0) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(0, y - 0.45, z);
      this.#sway.add(m);
      return m;
    };
    add(new THREE.CapsuleGeometry(0.3, 0.42, 3, 8), straw, 0.75);
    add(new THREE.CapsuleGeometry(0.4, 0.38, 3, 10), straw, 1.22);
    add(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10), rope, 0.98);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), wood, 1.42).rotation.z = Math.PI / 2;
    add(new THREE.SphereGeometry(0.25, 10, 8), sack, 1.8);
    // Painted "face" marks the front (-Z) so players can read its facing.
    add(new THREE.BoxGeometry(0.26, 0.05, 0.02), rope, 1.83, -0.24);
    add(new THREE.BoxGeometry(0.05, 0.22, 0.02), rope, 1.76, -0.245);

    this.#core = add(
      new THREE.IcosahedronGeometry(0.17, 0),
      new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7a1a', emissiveIntensity: 1.6, flatShading: true }),
      1.25,
      0.36,
    );

    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this.#telegraph = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 64),
      new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.#telegraph.rotation.x = -Math.PI / 2;
    this.#telegraph.position.set(position.x, position.y + 0.04, position.z);
    this.#shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 64),
      new THREE.MeshBasicMaterial({ color: '#ffd7a3', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.#shockwave.rotation.x = -Math.PI / 2;
    this.#shockwave.position.copy(this.#telegraph.position);
    scene.add(this.group, this.#telegraph, this.#shockwave);

    physics.addStatic(physics.rapier.ColliderDesc.cylinder(1.0, 0.45).setTranslation(position.x, position.y + 1.0, position.z));
  }

  /** Sim tick. `target` is the player's feet pose. */
  step(target: GroundPose): DummyStepResult {
    const result: DummyStepResult = { slam: false, reset: false };
    this.#prevYaw = this.pose.yaw;

    if (this.tracking) {
      const desired = yawFromDirection(target.x - this.pose.x, target.z - this.pose.z);
      this.pose.yaw = turnToward(this.pose.yaw, desired, TRACK_TURN_RATE / 30);
    }

    if (++this.#ticksSinceHit > REGEN_DELAY_TICKS && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.02);
    }

    if (this.drillEnabled) {
      this.#drillTick++;
      const telegraphStart = DRILL_INTERVAL_TICKS - DRILL_TELEGRAPH_TICKS;
      if (this.#drillTick >= telegraphStart) this.#telegraphProgress = (this.#drillTick - telegraphStart) / DRILL_TELEGRAPH_TICKS;
      if (this.#drillTick >= DRILL_INTERVAL_TICKS) {
        this.#drillTick = 0;
        this.#telegraphProgress = -1;
        this.#shockwaveAge = 0;
        result.slam = true;
        this.#kick(0, -1.4);
      }
    } else {
      this.#drillTick = 0;
      this.#telegraphProgress = -1;
    }
    return result;
  }

  /** Applies authoritative damage and the visual reaction. Returns true if the dummy reset. */
  receiveHit(hit: MeleeHit, amount: number, impact: number, fromX: number, fromZ: number): boolean {
    this.#ticksSinceHit = 0;
    this.hp -= amount;
    // Push away from the attacker in the dummy's local frame.
    const dx = this.pose.x - fromX;
    const dz = this.pose.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    const cos = Math.cos(this.pose.yaw);
    const sin = Math.sin(this.pose.yaw);
    const localX = (dx * cos - dz * sin) / len;
    const localZ = (dx * sin + dz * cos) / len;
    const strength = impact * (hit.hurtbox.kind === 'weakpoint' ? 1.5 : 1);
    this.#kick(localX * strength, localZ * strength);
    this.#flash = 1;
    this.#squash = 0.12 * strength;
    if (this.hp <= 0) {
      this.hp = this.maxHp;
      return true;
    }
    return false;
  }

  /** Render-rate animation. */
  update(alpha: number, dt: number): void {
    this.#time += dt;
    // Critically-underdamped spring on the tilt angles.
    const stiffness = 90;
    const damping = 7;
    this.#tiltVX += (-stiffness * this.#tiltX - damping * this.#tiltVX) * dt;
    this.#tiltVZ += (-stiffness * this.#tiltZ - damping * this.#tiltVZ) * dt;
    this.#tiltX += this.#tiltVX * dt;
    this.#tiltZ += this.#tiltVZ * dt;
    this.#sway.rotation.set(this.#tiltZ, 0, -this.#tiltX);

    this.group.rotation.y = this.#prevYaw + shortestDelta(this.#prevYaw, this.pose.yaw) * alpha;

    this.#flash = Math.max(0, this.#flash - dt * 7);
    this.#squash = Math.max(0, this.#squash - dt * 1.2);
    const s = 1 + Math.sin(this.#time * 40) * this.#squash;
    this.#sway.scale.set(s, 2 - s, s);
    for (const m of this.#flashMaterials) {
      m.emissive.setRGB(1, 1, 1);
      m.emissiveIntensity = this.#flash * 0.9;
    }
    const pulse = 1 + Math.sin(this.#time * 5) * 0.12;
    this.#core.scale.setScalar(pulse);

    const telegraph = this.#telegraph.material as THREE.MeshBasicMaterial;
    if (this.#telegraphProgress >= 0) {
      const radius = DRILL_RADIUS * (0.15 + 0.85 * this.#telegraphProgress);
      this.#telegraph.scale.setScalar(radius);
      telegraph.opacity = 0.35 + 0.45 * Math.abs(Math.sin(this.#time * 14));
    } else {
      telegraph.opacity = 0;
    }

    const shock = this.#shockwave.material as THREE.MeshBasicMaterial;
    if (this.#shockwaveAge >= 0) {
      this.#shockwaveAge += dt;
      const t = this.#shockwaveAge / 0.45;
      this.#shockwave.scale.setScalar(DRILL_RADIUS * (0.6 + t * 0.6));
      shock.opacity = Math.max(0, 0.9 * (1 - t));
      if (t >= 1) this.#shockwaveAge = -1;
    } else {
      shock.opacity = 0;
    }
  }

  /** World-space centre of the body for camera framing / floating text. */
  headPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pose.x, this.pose.y + 2.25, this.pose.z);
  }

  /** Angular impulse; ~8° rock for a light cut, ~30° for a finisher on the core. */
  #kick(localX: number, localZ: number): void {
    this.#tiltVX += localX * 2.2;
    this.#tiltVZ += localZ * 2.2;
  }
}

function shortestDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
