import { attackStepTotalTicks, type AttackStep, type MotorState, type MotorTuning, type Moveset } from '@frontier/combat-math';
import { CharacterAction } from '@frontier/shared-types';
import * as THREE from 'three';

/**
 * Procedurally animated stand-in for the glTF player model (the asset pipeline replaces the
 * meshes, not this rig's interface). Bare-chested, bird-masked dual-blader. Faces -Z.
 */

interface ArmPose {
  pitch: number;
  yaw: number;
  roll: number;
}

interface Pose {
  right: ArmPose;
  left: ArmPose;
  legR: number;
  legL: number;
  lean: number;
  twist: number;
  crouch: number;
}

export interface RigFrame {
  motor: MotorState;
  moveset: Moveset;
  tuning: MotorTuning;
  /** Sim interpolation factor, so 30 Hz frame data animates smoothly at any refresh rate. */
  alpha: number;
  groundSpeed: number;
  invulnerable: boolean;
}

const SKIN = '#e2ad84';
const HALF_PI = Math.PI / 2;

export class PlayerRig {
  readonly root = new THREE.Group();
  /** World-space trail anchors on each blade. */
  readonly bladeAnchors: { base: THREE.Object3D; tip: THREE.Object3D }[] = [];

  readonly #spin = new THREE.Group();
  readonly #rollPivot = new THREE.Group();
  readonly #hips = new THREE.Group();
  readonly #torso = new THREE.Group();
  readonly #shoulderR = new THREE.Group();
  readonly #shoulderL = new THREE.Group();
  readonly #hipR = new THREE.Group();
  readonly #hipL = new THREE.Group();
  readonly #scarfTails: THREE.Object3D[] = [];
  readonly #glowMaterials: THREE.MeshStandardMaterial[] = [];
  readonly #bladeMaterial: THREE.MeshStandardMaterial;
  readonly #pose: Pose = neutralPose();
  #gaitPhase = 0;
  #time = 0;
  #freeze = 0;

  constructor() {
    const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75, ...extra });
      this.#glowMaterials.push(m);
      return m;
    };
    const skin = mat(SKIN);
    const shorts = mat('#2c3a52');
    const boots = mat('#3a2a1f');
    const cloth = mat('#c23a2e');
    const mask = mat('#efe6d2');
    const beak = mat('#e08a2a');
    const dark = mat('#1b1b1f');
    this.#bladeMaterial = new THREE.MeshStandardMaterial({
      color: '#dfe7ef',
      metalness: 0.85,
      roughness: 0.25,
      emissive: '#5fd3ff',
      emissiveIntensity: 0,
    });

    this.root.add(this.#spin);
    this.#spin.add(this.#rollPivot);
    this.#rollPivot.position.y = 0.6;
    this.#rollPivot.add(this.#hips);
    this.#hips.position.y = 0.35;
    this.#hips.add(this.#torso);

    // Torso, belt, head with bird mask, scarf.
    this.#torso.add(mesh(new THREE.CapsuleGeometry(0.21, 0.34, 3, 8), skin, 0, 0.32, 0));
    this.#torso.add(mesh(new THREE.CylinderGeometry(0.23, 0.22, 0.1, 8), boots, 0, 0.06, 0));
    const head = new THREE.Group();
    head.position.y = 0.78;
    this.#torso.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.19, 10, 8), mask, 0, 0, 0, [1, 1.05, 1.1]));
    const beakMesh = mesh(new THREE.ConeGeometry(0.07, 0.32, 6), beak, 0, -0.03, -0.3);
    beakMesh.rotation.x = -HALF_PI;
    head.add(beakMesh);
    for (const side of [-1, 1]) {
      head.add(mesh(new THREE.BoxGeometry(0.07, 0.025, 0.02), dark, side * 0.08, 0.04, -0.19));
      const feather = mesh(new THREE.ConeGeometry(0.035, 0.26, 4), cloth, side * 0.05, 0.2, 0.05);
      feather.rotation.set(0.9, 0, side * 0.3);
      head.add(feather);
    }
    this.#torso.add(mesh(new THREE.TorusGeometry(0.13, 0.05, 5, 10), cloth, 0, 0.64, 0, undefined, HALF_PI));
    for (const side of [-1, 1]) {
      const tail = new THREE.Group();
      tail.position.set(side * 0.06, 0.64, 0.12);
      tail.add(mesh(new THREE.BoxGeometry(0.09, 0.62, 0.02), cloth, 0, -0.31, 0));
      this.#torso.add(tail);
      this.#scarfTails.push(tail);
    }

    // Arms with blades. Shoulder Euler 'YXZ': pitch raises the arm forward, yaw sweeps it.
    for (const [shoulder, side] of [
      [this.#shoulderR, 1],
      [this.#shoulderL, -1],
    ] as const) {
      shoulder.rotation.order = 'YXZ';
      shoulder.position.set(side * 0.29, 0.52, 0);
      shoulder.add(mesh(new THREE.CapsuleGeometry(0.065, 0.42, 3, 6), skin, 0, -0.27, 0));
      shoulder.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 6), cloth, 0, -0.44, 0));
      const hand = new THREE.Group();
      hand.position.y = -0.56;
      shoulder.add(hand);
      hand.add(mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), dark, 0, -0.02, 0));
      hand.add(mesh(new THREE.BoxGeometry(0.035, 0.8, 0.012), this.#bladeMaterial, 0, -0.43, 0));
      const base = new THREE.Object3D();
      base.position.y = -0.08;
      const tip = new THREE.Object3D();
      tip.position.y = -0.83;
      hand.add(base, tip);
      this.bladeAnchors.push({ base, tip });
      this.#torso.add(shoulder);
    }

    // Legs: thigh (shorts) + boot.
    for (const [hip, side] of [
      [this.#hipR, 1],
      [this.#hipL, -1],
    ] as const) {
      hip.position.set(side * 0.12, 0, 0);
      hip.add(mesh(new THREE.CapsuleGeometry(0.09, 0.3, 3, 6), shorts, 0, -0.2, 0));
      hip.add(mesh(new THREE.CapsuleGeometry(0.08, 0.36, 3, 6), boots, 0, -0.62, 0));
      this.#hips.add(hip);
    }

    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
  }

  /** Hitstop: freeze the pose briefly when a blow lands. */
  hitstop(seconds: number): void {
    this.#freeze = Math.max(this.#freeze, seconds);
  }

  update(frame: RigFrame, frameDt: number): void {
    if (this.#freeze > 0) {
      this.#freeze -= frameDt;
      return;
    }
    this.#time += frameDt;
    const { motor, moveset, tuning } = frame;
    // Rendering lags the sim by one tick (prev→curr interpolation), so does animation time.
    const tickTime = Math.max(0, motor.actionTick - 1 + frame.alpha);
    const target = neutralPose();
    let roll = 0;
    let spin = 0;
    let rate = 14;

    switch (motor.action) {
      case CharacterAction.Free:
        this.#locomotionPose(target, frame.groundSpeed, motor.sprinting, frameDt);
        break;
      case CharacterAction.Dodge: {
        const u = Math.min(1, tickTime / tuning.dodge.ticks);
        const forward = -Math.sin(motor.facingYaw) * motor.dodgeDirX - Math.cos(motor.facingYaw) * motor.dodgeDirZ;
        if (forward > 0) {
          roll = -Math.PI * 2 * easeInOut(u);
          target.crouch = -0.28 * Math.sin(Math.PI * u);
          target.right = { pitch: 1.4, yaw: 0.2, roll: 0.1 };
          target.left = { pitch: 1.4, yaw: -0.2, roll: -0.1 };
          target.legR = target.legL = 1.2 * Math.sin(Math.PI * u); // knees tucked
        } else {
          target.lean = 0.4 * Math.sin(Math.PI * u);
          target.crouch = -0.18 * Math.sin(Math.PI * u);
          target.legR = 0.5;
          target.legL = -0.3;
        }
        rate = 30;
        break;
      }
      case CharacterAction.Attack: {
        const step = moveset.steps[motor.comboStep] ?? moveset.steps[0];
        spin = this.#attackPose(target, step, Math.min(tickTime, attackStepTotalTicks(step)));
        rate = tickTime >= step.windupTicks && tickTime < step.windupTicks + step.activeTicks ? 45 : 18;
        break;
      }
      case CharacterAction.Stagger:
        target.lean = 0.45;
        target.right = { pitch: 2.3, yaw: 0, roll: 0.6 };
        target.left = { pitch: 2.1, yaw: 0, roll: -0.6 };
        target.legR = 0.3;
        rate = 20;
        break;
      case CharacterAction.Dead:
        target.lean = HALF_PI;
        target.crouch = -0.42;
        target.right = { pitch: 2.8, yaw: 0, roll: 0.3 };
        target.left = { pitch: 2.8, yaw: 0, roll: -0.3 };
        rate = 6;
        break;
    }

    dampPose(this.#pose, target, rate, frameDt);
    const p = this.#pose;
    this.#spin.rotation.y = spin;
    this.#rollPivot.rotation.x = roll + p.lean;
    this.#rollPivot.position.y = 0.6 + p.crouch;
    this.#torso.rotation.y = p.twist;
    applyArm(this.#shoulderR, p.right);
    applyArm(this.#shoulderL, p.left);
    this.#hipR.rotation.x = p.legR;
    this.#hipL.rotation.x = p.legL;

    const sway = Math.sin(this.#time * 7) * 0.08;
    const trail = Math.min(1.25, frame.groundSpeed / 7);
    // Negative pitch streams the scarf backwards (+Z).
    for (const [i, tail] of this.#scarfTails.entries()) tail.rotation.x = -(0.15 + trail) + sway * (i ? 1 : -1);

    const glow = frame.invulnerable ? 0.55 : 0;
    for (const m of this.#glowMaterials) {
      m.emissive.setRGB(0.25, 0.55, 1);
      m.emissiveIntensity = glow;
    }
    this.#bladeMaterial.emissiveIntensity = motor.action === CharacterAction.Attack ? 0.9 : 0.08;
  }

  #locomotionPose(target: Pose, speed: number, sprinting: boolean, frameDt: number): void {
    const runAmount = Math.min(1.3, speed / 5.5);
    this.#gaitPhase += frameDt * (4 + speed * 1.45);
    const swing = Math.sin(this.#gaitPhase);
    if (speed < 0.3) {
      // Idle guard: blades low and forward, slow breathing.
      const breathe = Math.sin(this.#time * 2.2) * 0.03;
      target.right = { pitch: 0.55 + breathe, yaw: -0.25, roll: 0.15 };
      target.left = { pitch: 0.5 - breathe, yaw: 0.3, roll: -0.15 };
      target.crouch = -0.03 + breathe * 0.5;
      return;
    }
    target.legR = swing * 0.75 * runAmount;
    target.legL = -swing * 0.75 * runAmount;
    target.crouch = -Math.abs(Math.cos(this.#gaitPhase)) * 0.07 * runAmount;
    if (sprinting) {
      // Blades trail behind in a low sprint.
      target.lean = -0.42;
      target.right = { pitch: -1.05, yaw: -0.1, roll: 0.35 };
      target.left = { pitch: -1.05, yaw: 0.1, roll: -0.35 };
    } else {
      target.lean = -0.12 * runAmount;
      target.right = { pitch: 0.35 - swing * 0.55 * runAmount, yaw: -0.15, roll: 0.15 };
      target.left = { pitch: 0.35 + swing * 0.55 * runAmount, yaw: 0.15, roll: -0.15 };
    }
  }

  /** Writes the slash pose; returns the body spin angle (finisher). */
  #attackPose(target: Pose, step: AttackStep, tick: number): number {
    const windEnd = step.windupTicks;
    const activeEnd = windEnd + step.activeTicks;
    const total = attackStepTotalTicks(step);
    const phaseT = (from: number, to: number) => Math.min(1, Math.max(0, (tick - from) / (to - from)));
    const windup = phaseT(0, windEnd);
    const active = phaseT(windEnd, activeEnd);
    const recovery = phaseT(activeEnd, total);
    const guardR: ArmPose = { pitch: 0.55, yaw: -0.25, roll: 0.15 };
    const guardL: ArmPose = { pitch: 0.5, yaw: 0.3, roll: -0.15 };
    target.legR = 0.35;
    target.legL = -0.45;
    target.lean = -0.15;

    if (step.arcDegrees >= 360) {
      const spread = (s: number): ArmPose => ({ pitch: 1.5, yaw: s * 1.45, roll: 0 });
      target.right = blendArm(blendArm(guardR, spread(-1), windup), guardR, recovery);
      target.left = blendArm(blendArm(guardL, spread(1), windup), guardL, recovery);
      target.crouch = -0.22 * windup * (1 - recovery);
      return tick < windEnd ? 0.5 * windup : tick < activeEnd ? 0.5 - (Math.PI * 2 + 0.5) * easeOut(active) : 0;
    }

    // Twin Cut swings right-to-left with the right blade; Return Cut mirrors it.
    const side = step.id.endsWith('2') ? -1 : 1;
    const wound: ArmPose = { pitch: 1.45, yaw: -side * 1.7, roll: side * 0.2 };
    const swung: ArmPose = { pitch: 1.35, yaw: side * 1.1, roll: -side * 0.1 };
    const lead = tick < windEnd
      ? blendArm(side > 0 ? guardR : guardL, wound, easeOut(windup))
      : tick < activeEnd
        ? blendArm(wound, swung, easeOut(active))
        : blendArm(swung, side > 0 ? guardR : guardL, recovery);
    const off: ArmPose = side > 0 ? { pitch: 0.2, yaw: 0.6, roll: -0.3 } : { pitch: 0.2, yaw: -0.6, roll: 0.3 };
    if (side > 0) {
      target.right = lead;
      target.left = off;
    } else {
      target.left = lead;
      target.right = off;
    }
    target.twist = tick < windEnd ? -side * 0.35 * windup : tick < activeEnd ? side * 0.45 * active : side * 0.45 * (1 - recovery);
    return 0;
  }
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  scale?: [number, number, number],
  rotX = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  if (scale) m.scale.set(...scale);
  m.rotation.x = rotX;
  return m;
}

function neutralPose(): Pose {
  return {
    right: { pitch: 0, yaw: 0, roll: 0.1 },
    left: { pitch: 0, yaw: 0, roll: -0.1 },
    legR: 0,
    legL: 0,
    lean: 0,
    twist: 0,
    crouch: 0,
  };
}

/** pitch +π/2 = arm forward (-Z); yaw + = toward the character's left (-X); roll + = hand toward +X. */
function applyArm(shoulder: THREE.Object3D, arm: ArmPose): void {
  shoulder.rotation.set(arm.pitch, arm.yaw, arm.roll);
}

function blendArm(a: ArmPose, b: ArmPose, t: number): ArmPose {
  return { pitch: a.pitch + (b.pitch - a.pitch) * t, yaw: a.yaw + (b.yaw - a.yaw) * t, roll: a.roll + (b.roll - a.roll) * t };
}

function dampPose(current: Pose, target: Pose, rate: number, dt: number): void {
  const k = 1 - Math.exp(-rate * dt);
  for (const arm of ['right', 'left'] as const) {
    current[arm].pitch += (target[arm].pitch - current[arm].pitch) * k;
    current[arm].yaw += (target[arm].yaw - current[arm].yaw) * k;
    current[arm].roll += (target[arm].roll - current[arm].roll) * k;
  }
  current.legR += (target.legR - current.legR) * k;
  current.legL += (target.legL - current.legL) * k;
  current.lean += (target.lean - current.lean) * k;
  current.twist += (target.twist - current.twist) * k;
  current.crouch += (target.crouch - current.crouch) * k;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
