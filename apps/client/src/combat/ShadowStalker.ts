import type RAPIER from '@dimforge/rapier3d-compat';
import {
  createStalkerState,
  stalkerPresent,
  stalkerStruck,
  stalkerTargetable,
  StalkerPhase,
  STALKER_TUNING,
  stepStalker,
  summonStalker,
  type DamageResult,
  type MeleeHit,
  type StalkerContext,
  type StalkerState,
  type StalkerStepResult,
} from '@frontier/combat-math';
import type { GroundPose } from '@frontier/shared-types';
import * as THREE from 'three';
import { SHADOW_STALKER } from '../data/sandbox.ts';
import type { PhysicsWorld } from '../engine/PhysicsWorld.ts';
import { lerpAngle } from '../engine/PlayerCharacter.ts';
import type { CombatTarget, HitReceipt } from './CombatSystem.ts';
import { softDotTexture } from './textures.ts';

const COLLIDER_CENTER = 1.5;
const IDLE_RESULT: StalkerStepResult = { velX: 0, velZ: 0, events: 0, hit: null };
const MIST_COUNT = 110;
const EYE_IDLE = new THREE.Color('#6fd8ff');
const EYE_PARRY = new THREE.Color('#fff2b0');
const EYE_PERIL = new THREE.Color('#ff2a2a');

interface LegRig {
  hip: THREE.Group;
  knee: THREE.Group;
  side: number;
  front: boolean;
}

interface Pose {
  spinePitch: number;
  spineY: number;
  spineRoll: number;
  headPitch: number;
  legPitch: [number, number, number, number];
  legSplay: [number, number, number, number];
}

/**
 * Client wrapper around the shared Shadow Stalker brain: Rapier movement, a procedural
 * shadow-wolf model, and readable telegraphs (gold glint = parry it, red 危 = get out).
 */
export class ShadowStalker implements CombatTarget {
  readonly id = 'shadow-stalker';
  readonly brain: StalkerState = createStalkerState();
  readonly pose: GroundPose = { x: 0, y: 0, z: 0, yaw: 0 };
  readonly hurtboxes = SHADOW_STALKER.hurtboxes;
  readonly defense = SHADOW_STALKER.stats.defense;
  readonly root = new THREE.Group();
  readonly collider: RAPIER.Collider;

  readonly #body: RAPIER.RigidBody;
  readonly #controller: RAPIER.KinematicCharacterController;
  readonly #prev = { x: 0, z: 0, yaw: 0 };
  readonly #rise = new THREE.Group();
  readonly #spine = new THREE.Group();
  readonly #head = new THREE.Group();
  readonly #tail: THREE.Group[] = [];
  readonly #legs: LegRig[] = [];
  readonly #eyeMaterial = new THREE.MeshBasicMaterial({ color: EYE_IDLE.clone() });
  readonly #heartMaterial: THREE.MeshStandardMaterial;
  readonly #hideMaterial: THREE.MeshStandardMaterial;
  readonly #glint: THREE.Sprite;
  readonly #ring: THREE.Mesh;
  readonly #shock: THREE.Mesh;
  readonly #mist: THREE.Points;
  readonly #mistPos = new Float32Array(MIST_COUNT * 3);
  readonly #mistCol = new Float32Array(MIST_COUNT * 3);
  readonly #mistLife = new Float32Array(MIST_COUNT);
  readonly #perilIcon: HTMLDivElement;
  readonly #pose: Pose = neutral();
  readonly #tmp = new THREE.Vector3();
  readonly #iconOffset = new THREE.Vector3(0, 1.4, 0);
  #gait = 0;
  #glintAge = 1;
  #shockAge = 1;
  #flinch = 0;
  #mistBoost = 0;
  #lastSerialShown = -1;

  constructor(
    scene: THREE.Scene,
    physics: PhysicsWorld,
    overlay: HTMLElement,
  ) {
    const { rapier, world } = physics;
    this.#body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
    this.collider = world.createCollider(rapier.ColliderDesc.capsule(0.4, 1.1), this.#body);
    this.collider.setEnabled(false);
    this.#controller = world.createCharacterController(0.05);
    this.#controller.setUp({ x: 0, y: 1, z: 0 });
    this.#controller.enableSnapToGround(0.6);
    this.#controller.setApplyImpulsesToDynamicBodies(false);

    this.#hideMaterial = new THREE.MeshStandardMaterial({
      color: '#16121f',
      roughness: 0.5,
      metalness: 0.15,
      flatShading: true,
      emissive: '#2a1150',
      emissiveIntensity: 0.3,
    });
    const spikeMaterial = new THREE.MeshStandardMaterial({
      color: '#0c0a12',
      flatShading: true,
      emissive: '#5b2bd6',
      emissiveIntensity: 0.7,
    });
    this.#heartMaterial = new THREE.MeshStandardMaterial({
      color: '#2a0f3a',
      emissive: '#b07bff',
      emissiveIntensity: 0.4,
      flatShading: true,
    });
    this.#buildModel(spikeMaterial);

    this.#glint = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glintTexture(), color: '#fff3c4', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    this.#glint.visible = false;

    const ringMaterial = (color: string) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.#ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72), ringMaterial('#ff2a3a'));
    this.#ring.rotation.x = -Math.PI / 2;
    this.#shock = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 72), ringMaterial('#c9a6ff'));
    this.#shock.rotation.x = -Math.PI / 2;

    const mistGeometry = new THREE.BufferGeometry();
    mistGeometry.setAttribute('position', new THREE.BufferAttribute(this.#mistPos, 3).setUsage(THREE.DynamicDrawUsage));
    mistGeometry.setAttribute('color', new THREE.BufferAttribute(this.#mistCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.#mist = new THREE.Points(
      mistGeometry,
      new THREE.PointsMaterial({
        size: 0.55,
        map: softDotTexture(),
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.#mist.frustumCulled = false;

    this.#perilIcon = document.createElement('div');
    this.#perilIcon.className =
      'pointer-events-none fixed left-0 top-0 hidden font-black text-red-500 text-5xl [text-shadow:0_0_14px_rgb(255_0_0/0.9),0_2px_0_#000]';
    this.#perilIcon.textContent = '危';
    overlay.appendChild(this.#perilIcon);

    this.root.visible = false;
    scene.add(this.root, this.#glint, this.#ring, this.#shock, this.#mist);
  }

  get present(): boolean {
    return stalkerPresent(this.brain);
  }

  get targetable(): boolean {
    return stalkerTargetable(this.brain);
  }

  get exposed(): boolean {
    return this.brain.phase === StalkerPhase.Exposed;
  }

  summon(x: number, z: number, yaw: number): number {
    const events = summonStalker(this.brain, x, z, yaw);
    this.#body.setTranslation({ x, y: COLLIDER_CENTER, z }, true);
    this.collider.setEnabled(true);
    Object.assign(this.pose, { x, y: 0, z, yaw });
    Object.assign(this.#prev, { x, z, yaw });
    this.root.visible = true;
    this.#mistBoost = 1;
    return events;
  }

  step(ctx: StalkerContext): StalkerStepResult {
    if (!this.present) return IDLE_RESULT;
    Object.assign(this.#prev, { x: this.pose.x, z: this.pose.z, yaw: this.pose.yaw });
    const result = stepStalker(this.brain, ctx);
    this.#controller.computeColliderMovement(this.collider, { x: result.velX * ctx.dt, y: -0.2, z: result.velZ * ctx.dt });
    const move = this.#controller.computedMovement();
    const t = this.#body.translation();
    this.#body.setNextKinematicTranslation({ x: t.x + move.x, y: t.y + move.y, z: t.z + move.z });
    return result;
  }

  syncFromPhysics(): void {
    if (!this.present) {
      if (this.collider.isEnabled()) this.collider.setEnabled(false);
      return;
    }
    const t = this.#body.translation();
    this.brain.x = this.pose.x = t.x;
    this.brain.z = this.pose.z = t.z;
    this.pose.yaw = this.brain.yaw;
  }

  receiveHit(hit: MeleeHit, damage: DamageResult): HitReceipt {
    const { resolveDamage, events } = stalkerStruck(this.brain, hit.hurtbox.kind, damage.amount);
    if (resolveDamage > 0) this.#flinch = 1;
    return { applied: resolveDamage, immune: resolveDamage === 0, reset: false, events };
  }

  lockPoint(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.pose.x, this.exposed ? 0.9 : 1.6, this.pose.z);
  }

  headPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.#head.getWorldPosition(out);
  }

  /** Render-rate animation and telegraph visuals. `target` is the player's render position. */
  update(alpha: number, dt: number, camera: THREE.Camera, target: THREE.Vector3): void {
    this.#updateMist(dt);
    this.#updateEffects(dt);
    if (!this.present) {
      this.root.visible = false;
      this.#perilIcon.classList.add('hidden');
      return;
    }
    this.root.visible = true;
    const b = this.brain;
    const x = this.#prev.x + (this.pose.x - this.#prev.x) * alpha;
    const z = this.#prev.z + (this.pose.z - this.#prev.z) * alpha;
    const speed = Math.hypot(this.pose.x - this.#prev.x, this.pose.z - this.#prev.z) * 30;
    this.root.position.set(x, 0, z);
    this.root.rotation.y = lerpAngle(this.#prev.yaw, this.pose.yaw, alpha);

    const t = Math.max(0, b.phaseTick - 1 + alpha);
    const target_ = neutral();
    let rise = 0;
    let rate = 10;
    let eye = EYE_IDLE;
    let peril = false;
    this.#gait += dt * (2 + speed * 1.3);
    const stride = Math.min(1.2, speed / 5);
    for (let i = 0; i < 4; i++) {
      const leg = this.#legs[i]!;
      const phase = leg.front === (leg.side > 0) ? 0 : Math.PI; // trot: diagonal pairs
      target_.legPitch[i] = Math.sin(this.#gait + phase) * 0.55 * stride;
    }

    switch (b.phase) {
      case StalkerPhase.Emerging:
        rise = -2.6 * (1 - easeOut(Math.min(1, t / STALKER_TUNING.emergeTicks)));
        target_.headPitch = 0.5;
        this.#mistBoost = Math.max(this.#mistBoost, 0.8);
        break;
      case StalkerPhase.Prowl:
        target_.spineY = -0.08;
        target_.headPitch = -0.12;
        break;
      case StalkerPhase.Attack: {
        const a = b.attack!;
        const wind = Math.min(1, t / a.windupTicks);
        const active = clamp01((t - a.windupTicks) / a.activeTicks);
        const recovery = clamp01((t - a.windupTicks - a.activeTicks) / a.recoveryTicks);
        const inWindup = t < a.windupTicks;
        eye = inWindup ? (a.parryable ? EYE_PARRY : EYE_PERIL) : EYE_IDLE;
        peril = inWindup && !a.parryable;
        rate = 18;
        if (a.id.startsWith('rending-claw')) {
          const sides = a.id.endsWith('3') ? [1, -1] : a.id.endsWith('2') ? [-1] : [1];
          target_.spinePitch = inWindup ? 0.38 * easeOut(wind) : 0.38 - 0.55 * active + 0.17 * recovery;
          for (const side of sides) {
            const i = side > 0 ? 0 : 1; // front-right, front-left
            target_.legPitch[i] = inWindup ? 1.7 * easeOut(wind) : 1.7 - 1.5 * easeOut(active) - 0.2 * recovery;
            target_.legSplay[i] = inWindup ? side * 0.7 * wind : side * (0.7 - 1.3 * easeOut(active)) * (1 - recovery);
          }
          rate = active > 0 && active < 1 ? 40 : 16;
        } else if (a.id === 'shadow-lunge') {
          target_.spineY = inWindup ? -0.38 * wind : -0.1 * (1 - recovery);
          target_.headPitch = inWindup ? -0.25 : 0.1;
          target_.legPitch = inWindup ? [0.4, 0.4, -0.6, -0.6] : [1.1, 1.1, -1.1, -1.1];
          if (!inWindup && active < 1) this.#mistBoost = 1;
          rate = 30;
        } else if (a.id === 'moonless-howl') {
          target_.spinePitch = 0.3 * wind * (1 - recovery);
          target_.headPitch = 1.0 * wind * (1 - recovery);
        } else {
          // Shade Pounce: coil, then arc through the air to the marked ground.
          const travelTicks = a.windupTicks + a.activeTicks - a.travelStartTick;
          const u = clamp01((t - a.travelStartTick) / travelTicks);
          target_.spineY = t < a.travelStartTick ? -0.42 * Math.min(1, t / a.travelStartTick) : 0;
          rise = u > 0 && u < 1 ? 3.2 * Math.sin(Math.PI * u) : 0;
          if (u > 0 && u < 1) target_.legPitch = [1.2, 1.2, -1.2, -1.2];
          rate = 24;
        }
        this.#updateRing(a, t, target);
        break;
      }
      case StalkerPhase.Recoil:
        target_.spinePitch = 0.45;
        target_.headPitch = 0.4;
        rate = 20;
        break;
      case StalkerPhase.Exposed: {
        const breathe = Math.sin(t * 0.25) * 0.04;
        target_.spineY = -0.62 + breathe;
        target_.spinePitch = -0.28;
        target_.headPitch = -0.35;
        target_.legPitch = [-0.9, -0.9, 0.7, 0.7];
        target_.legSplay = [0.4, -0.4, 0.3, -0.3];
        rate = 8;
        break;
      }
      case StalkerPhase.Subdued:
        target_.spineRoll = 1.35;
        target_.spineY = -0.75;
        rise = t > 60 ? -2.6 * easeOut(clamp01((t - 60) / 60)) : 0;
        this.#mistBoost = Math.max(this.#mistBoost, 0.6);
        rate = 4;
        break;
      case StalkerPhase.Dissolving:
        rise = -2.6 * easeOut(clamp01(t / STALKER_TUNING.dissolveTicks));
        this.#mistBoost = 1;
        break;
    }
    if (b.phase !== StalkerPhase.Attack) this.#ring.visible = false;

    // Hit flinch on exposed strikes.
    this.#flinch = Math.max(0, this.#flinch - dt * 5);
    target_.spineRoll += Math.sin(this.#flinch * 20) * 0.08 * this.#flinch;

    dampPose(this.#pose, target_, rate, dt);
    const p = this.#pose;
    this.#rise.position.y = rise;
    this.#spine.position.y = 1.35 + p.spineY;
    this.#spine.rotation.set(p.spinePitch, 0, p.spineRoll);
    this.#head.rotation.x = p.headPitch;
    this.#legs.forEach((leg, i) => {
      leg.hip.rotation.set(p.legPitch[i]!, 0, p.legSplay[i]!);
      leg.knee.rotation.x = -Math.max(0, p.legPitch[i]!) * 0.7;
    });
    this.#tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(this.#gait * 0.6 + i * 0.8) * 0.25;
      seg.rotation.x = -0.25 + i * 0.12;
    });

    this.#eyeMaterial.color.lerp(eye, 1 - Math.exp(-dt * 20));
    const heartGlow = b.phase === StalkerPhase.Exposed ? 3 + Math.sin(t * 0.5) * 0.8 : 0.4;
    this.#heartMaterial.emissiveIntensity += (heartGlow - this.#heartMaterial.emissiveIntensity) * (1 - Math.exp(-dt * 6));
    this.#heartMaterial.emissive.set(b.phase === StalkerPhase.Exposed ? '#ffd27a' : '#b07bff');
    this.#hideMaterial.emissiveIntensity = 0.3 + this.#flinch * 1.2;

    // Telegraph cues fire once per attack instance.
    if (b.phase === StalkerPhase.Attack && b.attackSerial !== this.#lastSerialShown) {
      this.#lastSerialShown = b.attackSerial;
      if (b.attack?.parryable) this.#glintAge = 0;
    }
    this.root.updateMatrixWorld(true);
    if (this.#glintAge < 0.35) this.#head.getWorldPosition(this.#glint.position).add(this.#tmp.set(0, 0.5, 0));

    this.#perilIcon.classList.toggle('hidden', !peril);
    if (peril) {
      this.#head.getWorldPosition(this.#tmp).add(this.#iconOffset).project(camera);
      const px = (this.#tmp.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-this.#tmp.y * 0.5 + 0.5) * window.innerHeight;
      const pulse = 1 + Math.sin(performance.now() * 0.03) * 0.12;
      this.#perilIcon.style.transform = `translate(-50%, -50%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${pulse.toFixed(3)})`;
      this.#perilIcon.style.display = this.#tmp.z > 1 ? 'none' : '';
    }
  }

  /** Expanding shockwave at a world point (howl / pounce landing). */
  shockwave(x: number, z: number, radius: number): void {
    this.#shock.position.set(x, 0.06, z);
    this.#shock.userData.radius = radius;
    this.#shockAge = 0;
    this.#mistBoost = 1;
  }

  dispose(): void {
    this.#perilIcon.remove();
  }

  // --------------------------------------------------------------------------

  #updateRing(a: NonNullable<StalkerState['attack']>, t: number, target: THREE.Vector3): void {
    const material = this.#ring.material as THREE.MeshBasicMaterial;
    const inWindup = t < a.windupTicks;
    if (a.parryable || !inWindup) {
      this.#ring.visible = false;
      return;
    }
    this.#ring.visible = true;
    const committed = t >= a.windupTicks - a.commitTicks;
    if (a.origin === 'target') {
      this.#ring.position.set(committed ? this.brain.aimX : target.x, 0.05, committed ? this.brain.aimZ : target.z);
    } else {
      this.#ring.position.set(this.pose.x, 0.05, this.pose.z);
    }
    const grow = 0.25 + 0.75 * (t / a.windupTicks);
    this.#ring.scale.setScalar(a.reach * grow);
    material.opacity = 0.35 + 0.4 * Math.abs(Math.sin(performance.now() * 0.018));
  }

  #updateEffects(dt: number): void {
    this.#glintAge += dt;
    const glint = this.#glint.material as THREE.SpriteMaterial;
    this.#glint.visible = this.#glintAge < 0.35;
    if (this.#glint.visible) {
      const k = this.#glintAge / 0.35;
      const s = 2.4 * Math.sin(Math.PI * k);
      this.#glint.scale.set(s, s, 1);
      glint.rotation = k * 1.2;
      glint.opacity = 1 - k * 0.5;
    }
    this.#shockAge += dt;
    const shock = this.#shock.material as THREE.MeshBasicMaterial;
    this.#shock.visible = this.#shockAge < 0.5;
    if (this.#shock.visible) {
      const k = this.#shockAge / 0.5;
      this.#shock.scale.setScalar(((this.#shock.userData.radius as number) ?? 4) * (0.5 + 0.7 * k));
      shock.opacity = 0.9 * (1 - k);
    }
  }

  #updateMist(dt: number): void {
    this.#mistBoost = Math.max(0, this.#mistBoost - dt * 0.8);
    const present = this.present && this.root.visible;
    const rate = present ? 0.35 + this.#mistBoost * 1.4 : 0;
    for (let i = 0; i < MIST_COUNT; i++) {
      let life = this.#mistLife[i]! - dt * (0.8 + (i % 5) * 0.1);
      const k = i * 3;
      if (life <= 0) {
        if (present && Math.random() < rate * dt * 12) {
          life = 1;
          const a = Math.random() * Math.PI * 2;
          const along = (Math.random() - 0.5) * 3.6;
          const cos = Math.cos(this.pose.yaw);
          const sin = Math.sin(this.pose.yaw);
          this.#mistPos[k] = this.pose.x + Math.cos(a) * 0.7 + along * sin;
          this.#mistPos[k + 1] = 0.3 + Math.random() * 1.6;
          this.#mistPos[k + 2] = this.pose.z + Math.sin(a) * 0.7 + along * cos;
        } else {
          this.#mistLife[i] = 0;
          this.#mistCol.fill(0, k, k + 3);
          continue;
        }
      }
      this.#mistLife[i] = life;
      this.#mistPos[k + 1]! += dt * 0.9;
      const glow = Math.sin(Math.PI * life) * 0.4;
      this.#mistCol[k] = 0.28 * glow;
      this.#mistCol[k + 1] = 0.1 * glow;
      this.#mistCol[k + 2] = 0.6 * glow;
    }
    this.#mist.geometry.attributes.position!.needsUpdate = true;
    this.#mist.geometry.attributes.color!.needsUpdate = true;
  }

  #buildModel(spikeMaterial: THREE.Material): void {
    const hide = this.#hideMaterial;
    const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    this.root.add(this.#rise);
    this.#rise.add(this.#spine);
    this.#spine.position.y = 1.35;

    add(this.#spine, new THREE.CapsuleGeometry(0.62, 1.9, 4, 10), hide, 0, 0, 0.15).rotation.x = Math.PI / 2;
    add(this.#spine, new THREE.SphereGeometry(0.8, 10, 8), hide, 0, 0.08, -0.85).scale.set(1, 1.05, 1.1);
    add(this.#spine, new THREE.IcosahedronGeometry(0.24, 0), this.#heartMaterial, 0, -0.2, -1.55);

    this.#head.position.set(0, 0.4, -1.6);
    this.#spine.add(this.#head);
    add(this.#head, new THREE.SphereGeometry(0.44, 10, 8), hide).scale.set(0.9, 0.85, 1.15);
    add(this.#head, new THREE.ConeGeometry(0.27, 0.95, 7), hide, 0, -0.08, -0.6).rotation.x = -Math.PI / 2;
    for (const side of [-1, 1]) {
      const ear = add(this.#head, new THREE.ConeGeometry(0.11, 0.42, 5), spikeMaterial, side * 0.24, 0.4, 0.08);
      ear.rotation.set(0.5, 0, side * -0.25);
      add(this.#head, new THREE.SphereGeometry(0.07, 6, 5), this.#eyeMaterial, side * 0.17, 0.1, -0.34).castShadow = false;
    }
    for (let i = 0; i < 9; i++) {
      const spike = add(this.#spine, new THREE.ConeGeometry(0.1 + (i % 3) * 0.03, 0.55 + Math.sin(i * 0.9) * 0.25 + 0.2, 5), spikeMaterial, 0, 0.55, -1.2 + i * 0.28);
      spike.rotation.x = -0.65;
    }

    for (const [front, z] of [
      [true, -1.0],
      [false, 1.05],
    ] as const) {
      for (const side of [1, -1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.45, -0.25, z);
        add(hip, new THREE.CapsuleGeometry(0.17, 0.3, 3, 6), hide, 0, -0.25, 0);
        const knee = new THREE.Group();
        knee.position.y = -0.5;
        hip.add(knee);
        add(knee, new THREE.CapsuleGeometry(0.11, 0.35, 3, 6), hide, 0, -0.27, 0);
        add(knee, new THREE.BoxGeometry(0.24, 0.08, 0.34), spikeMaterial, 0, -0.55, -0.06);
        this.#spine.add(hip);
        this.#legs.push({ hip, knee, side, front });
      }
    }

    let parent: THREE.Object3D = this.#spine;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.2 : 0, i === 0 ? 1.25 : 0.55);
      add(seg, new THREE.ConeGeometry(0.16 - i * 0.04, 0.7, 6), i === 2 ? spikeMaterial : hide, 0, 0, 0.3).rotation.x = Math.PI / 2;
      parent.add(seg);
      this.#tail.push(seg);
      parent = seg;
    }
  }
}

function neutral(): Pose {
  return { spinePitch: 0, spineY: 0, spineRoll: 0, headPitch: 0, legPitch: [0, 0, 0, 0], legSplay: [0, 0, 0, 0] };
}

function dampPose(current: Pose, target: Pose, rate: number, dt: number): void {
  const k = 1 - Math.exp(-rate * dt);
  current.spinePitch += (target.spinePitch - current.spinePitch) * k;
  current.spineY += (target.spineY - current.spineY) * k;
  current.spineRoll += (target.spineRoll - current.spineRoll) * k;
  current.headPitch += (target.headPitch - current.headPitch) * k;
  for (let i = 0; i < 4; i++) {
    current.legPitch[i]! += (target.legPitch[i]! - current.legPitch[i]!) * k;
    current.legSplay[i]! += (target.legSplay[i]! - current.legSplay[i]!) * k;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function glintTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const c = size / 2;
  const radial = g.createRadialGradient(c, c, 0, c, c, c);
  radial.addColorStop(0, 'rgba(255,255,255,1)');
  radial.addColorStop(0.15, 'rgba(255,240,200,0.8)');
  radial.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = radial;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [
    [size, 6],
    [6, size],
  ] as const) {
    const ray = g.createLinearGradient(c - w / 2, c - h / 2, c + w / 2, c + h / 2);
    ray.addColorStop(0, 'rgba(255,255,255,0)');
    ray.addColorStop(0.5, 'rgba(255,255,255,1)');
    ray.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = ray;
    g.fillRect(c - w / 2, c - h / 2, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
