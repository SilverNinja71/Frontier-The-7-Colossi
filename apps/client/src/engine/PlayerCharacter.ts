import type RAPIER from '@dimforge/rapier3d-compat';
import {
  applyDeath,
  applyStagger,
  createMotorState,
  isInvulnerable,
  revive,
  stepMotor,
  type CombatStats,
  type MotorContext,
  type MotorState,
  type MotorStepResult,
} from '@frontier/combat-math';
import { CharacterAction, type GroundPose, type InputFrame, type Vec3 } from '@frontier/shared-types';
import * as THREE from 'three';
import type { PhysicsWorld } from './PhysicsWorld.ts';

const CAPSULE_RADIUS = 0.38;
const CAPSULE_HALF_HEIGHT = 0.52;
/** Body origin sits at the capsule centre; gameplay poses use the feet. */
const FEET_OFFSET = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS;
const GRAVITY = 28;
const RESPAWN_TICKS = 75;
const HP_REGEN_DELAY_TICKS = 150;
const HP_REGEN_PER_TICK = 0.004;

/**
 * Local player: shared motor (prediction-ready) + Rapier kinematic character controller.
 * Keeps previous/current poses so rendering can interpolate between 30 Hz sim ticks.
 */
export class PlayerCharacter {
  readonly motor: MotorState;
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly #controller: RAPIER.KinematicCharacterController;
  readonly #prev: GroundPose;
  readonly #curr: GroundPose;
  hp: number;
  readonly maxHp: number;
  #verticalVelocity = 0;
  #grounded = false;
  #ticksSinceDamage = Infinity;
  #lastStep: MotorStepResult = { velX: 0, velZ: 0, events: 0 };

  constructor(
    private readonly physics: PhysicsWorld,
    private readonly spawn: Vec3,
    readonly stats: CombatStats,
    maxHp: number,
    maxStamina: number,
    private readonly motorContext: MotorContext,
  ) {
    const { rapier, world } = physics;
    this.motor = createMotorState(maxStamina, 0);
    this.maxHp = this.hp = maxHp;

    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + FEET_OFFSET, spawn.z),
    );
    this.collider = world.createCollider(rapier.ColliderDesc.capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS), this.body);

    this.#controller = world.createCharacterController(0.02);
    this.#controller.setUp({ x: 0, y: 1, z: 0 });
    this.#controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.#controller.setMinSlopeSlideAngle((35 * Math.PI) / 180);
    this.#controller.enableAutostep(0.35, 0.2, false);
    this.#controller.enableSnapToGround(0.4);
    this.#controller.setApplyImpulsesToDynamicBodies(false);

    this.#curr = { x: spawn.x, y: spawn.y, z: spawn.z, yaw: 0 };
    this.#prev = { ...this.#curr };
  }

  get lastStep(): MotorStepResult {
    return this.#lastStep;
  }

  get invulnerable(): boolean {
    return isInvulnerable(this.motor, this.motorContext.tuning);
  }

  get dead(): boolean {
    return this.motor.action === CharacterAction.Dead;
  }

  /** Simulate one tick. Call PhysicsWorld.step() and then syncFromPhysics() afterwards. */
  step(input: InputFrame): MotorStepResult {
    const dt = this.motorContext.dt;
    Object.assign(this.#prev, this.#curr);

    if (this.dead) {
      if (this.motor.actionTick++ >= RESPAWN_TICKS) this.#respawn();
      this.#lastStep = { velX: 0, velZ: 0, events: 0 };
      return this.#lastStep;
    }

    const result = stepMotor(this.motor, input, this.motorContext);
    this.#lastStep = result;

    this.#verticalVelocity = this.#grounded ? -2 : Math.max(-40, this.#verticalVelocity - GRAVITY * dt);
    this.#controller.computeColliderMovement(this.collider, {
      x: result.velX * dt,
      y: this.#verticalVelocity * dt,
      z: result.velZ * dt,
    });
    const movement = this.#controller.computedMovement();
    this.#grounded = this.#controller.computedGrounded();
    const t = this.body.translation();
    this.body.setNextKinematicTranslation({ x: t.x + movement.x, y: t.y + movement.y, z: t.z + movement.z });

    if (++this.#ticksSinceDamage > HP_REGEN_DELAY_TICKS) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * HP_REGEN_PER_TICK);
    }
    return result;
  }

  syncFromPhysics(): void {
    const t = this.body.translation();
    this.#curr.x = t.x;
    this.#curr.y = t.y - FEET_OFFSET;
    this.#curr.z = t.z;
    this.#curr.yaw = this.motor.facingYaw;
    if (this.#curr.y < -30) this.#respawn();
  }

  /** Authoritative-style damage intake. Returns false when i-frames negated the hit. */
  takeDamage(amount: number, staggerTicks: number): boolean {
    if (this.dead || this.invulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.#ticksSinceDamage = 0;
    if (this.hp === 0) applyDeath(this.motor);
    else if (staggerTicks > 0) applyStagger(this.motor, staggerTicks);
    return true;
  }

  pose(): GroundPose {
    return this.#curr;
  }

  /** Interpolated render position (feet) and yaw. */
  renderPose(alpha: number, out: THREE.Vector3): number {
    out.set(
      this.#prev.x + (this.#curr.x - this.#prev.x) * alpha,
      this.#prev.y + (this.#curr.y - this.#prev.y) * alpha,
      this.#prev.z + (this.#curr.z - this.#prev.z) * alpha,
    );
    return lerpAngle(this.#prev.yaw, this.#curr.yaw, alpha);
  }

  /** Horizontal speed over the last tick, m/s. */
  get groundSpeed(): number {
    return Math.hypot(this.#curr.x - this.#prev.x, this.#curr.z - this.#prev.z) / this.motorContext.dt;
  }

  #respawn(): void {
    this.body.setTranslation({ x: this.spawn.x, y: this.spawn.y + FEET_OFFSET, z: this.spawn.z }, true);
    this.#verticalVelocity = 0;
    this.hp = this.maxHp;
    revive(this.motor);
    this.motor.facingYaw = 0;
    Object.assign(this.#curr, { x: this.spawn.x, y: this.spawn.y, z: this.spawn.z, yaw: 0 });
    Object.assign(this.#prev, this.#curr);
  }
}

export function lerpAngle(a: number, b: number, t: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  else if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}
