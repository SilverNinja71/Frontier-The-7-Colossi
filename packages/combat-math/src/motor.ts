import { CharacterAction, InputButton, type CharacterActionId, type InputFrame } from '@frontier/shared-types';
import { attackStepTotalTicks, type AttackStep, type MotorTuning, type Moveset } from './frame-data.ts';

/**
 * The character motor: a pure, allocation-free state machine that turns one InputFrame
 * into desired velocity + action state. The client runs it for prediction and the server
 * runs the identical code authoritatively; only collision resolution (Rapier) sits outside.
 */

export const Buffered = { None: 0, Attack: 1, Dodge: 2, Parry: 3 } as const;
export type BufferedId = (typeof Buffered)[keyof typeof Buffered];

export const MotorEvent = {
  AttackStarted: 1 << 0,
  DodgeStarted: 1 << 1,
  Exhausted: 1 << 2,
  ParryStarted: 1 << 3,
} as const;

export interface MotorState {
  action: CharacterActionId;
  /** Index of the tick being simulated within `action`; 0 on the action's first tick. */
  actionTick: number;
  /** Length of untimed-by-frame-data actions (stagger). */
  actionDuration: number;
  comboStep: number;
  comboQueued: boolean;
  /** Increments on every new swing; hit registration dedupes targets per serial. */
  attackSerial: number;
  facingYaw: number;
  dodgeDirX: number;
  dodgeDirZ: number;
  stamina: number;
  maxStamina: number;
  regenDelayTicks: number;
  exhausted: boolean;
  sprinting: boolean;
  buffered: BufferedId;
  bufferTicks: number;
}

export interface MotorContext {
  moveset: Moveset;
  tuning: MotorTuning;
  /** From deriveCombatStats().moveSpeed. Does not scale dodge distance. */
  speedMultiplier: number;
  dt: number;
}

export interface MotorStepResult {
  /** Desired horizontal velocity in m/s; the physics layer resolves collisions. */
  velX: number;
  velZ: number;
  /** MotorEvent bitmask for this tick. */
  events: number;
}

export function createMotorState(maxStamina: number, facingYaw = 0): MotorState {
  return {
    action: CharacterAction.Free,
    actionTick: 0,
    actionDuration: 0,
    comboStep: 0,
    comboQueued: false,
    attackSerial: 0,
    facingYaw,
    dodgeDirX: 0,
    dodgeDirZ: 0,
    stamina: maxStamina,
    maxStamina,
    regenDelayTicks: 0,
    exhausted: false,
    sprinting: false,
    buffered: Buffered.None,
    bufferTicks: 0,
  };
}

export function stepMotor(s: MotorState, input: InputFrame, ctx: MotorContext): MotorStepResult {
  const { moveset, tuning, dt } = ctx;
  let events = 0;

  // Buffer presses so slightly-early inputs still chain. Dodge > parry > attack.
  if (input.pressed & InputButton.Dodge) {
    s.buffered = Buffered.Dodge;
    s.bufferTicks = tuning.inputBufferTicks;
  } else if (input.pressed & InputButton.Parry && s.buffered !== Buffered.Dodge) {
    s.buffered = Buffered.Parry;
    s.bufferTicks = tuning.inputBufferTicks;
  } else if (input.pressed & InputButton.Attack && s.buffered === Buffered.None) {
    s.buffered = Buffered.Attack;
    s.bufferTicks = tuning.inputBufferTicks;
  }
  const locked = (input.held & InputButton.LockOn) !== 0;

  // Camera-relative stick → world: right = (cos, -sin), forward = (-sin, -cos).
  const sinV = Math.sin(input.viewYaw);
  const cosV = Math.cos(input.viewYaw);
  let moveX = input.moveX * cosV - input.moveY * sinV;
  let moveZ = -input.moveX * sinV - input.moveY * cosV;
  let moveMag = Math.hypot(moveX, moveZ);
  if (moveMag > 1) {
    moveX /= moveMag;
    moveZ /= moveMag;
    moveMag = 1;
  }

  if (s.action !== CharacterAction.Free) s.actionTick++;

  switch (s.action) {
    case CharacterAction.Dodge:
      if (s.actionTick >= tuning.dodge.ticks) endAction(s);
      break;
    case CharacterAction.Stagger:
      if (s.actionTick >= s.actionDuration) endAction(s);
      break;
    case CharacterAction.Parry:
      if (s.actionTick >= tuning.parry.ticks) endAction(s);
      break;
    case CharacterAction.Attack: {
      const step = currentStep(s, moveset);
      if (
        s.buffered === Buffered.Attack &&
        s.actionTick >= step.windupTicks &&
        s.comboStep < moveset.steps.length - 1
      ) {
        s.comboQueued = true;
        clearBuffer(s);
      }
      if (s.actionTick >= step.windupTicks + step.activeTicks) {
        // Recovery is the cancel window: dodge, then parry, then combo, else finish.
        if (s.buffered === Buffered.Dodge && canSpend(s)) {
          events |= startDodge(s, moveX, moveZ, moveMag, tuning);
        } else if (s.buffered === Buffered.Parry && canSpend(s)) {
          events |= startParry(s, moveX, moveZ, moveMag, input.viewYaw, locked, tuning);
        } else if (s.comboQueued && canSpend(s)) {
          events |= startAttack(s, s.comboStep + 1, moveX, moveZ, moveMag, input.viewYaw, locked, moveset, tuning);
        } else if (s.actionTick >= attackStepTotalTicks(step)) {
          endAction(s);
        }
      }
      break;
    }
  }

  if (s.action === CharacterAction.Free) {
    if (s.buffered === Buffered.Dodge && canSpend(s)) {
      events |= startDodge(s, moveX, moveZ, moveMag, tuning);
    } else if (s.buffered === Buffered.Parry && canSpend(s)) {
      events |= startParry(s, moveX, moveZ, moveMag, input.viewYaw, locked, tuning);
    } else if (s.buffered === Buffered.Attack && canSpend(s)) {
      events |= startAttack(s, 0, moveX, moveZ, moveMag, input.viewYaw, locked, moveset, tuning);
    }
  }

  let velX = 0;
  let velZ = 0;
  s.sprinting = false;

  switch (s.action) {
    case CharacterAction.Free: {
      const moving = moveMag >= 0.05;
      if (moving) {
        s.sprinting = (input.held & InputButton.Sprint) !== 0 && !s.exhausted && s.stamina > 0;
        const speed = (s.sprinting ? tuning.sprintSpeed : tuning.runSpeed) * moveMag * ctx.speedMultiplier;
        velX = (moveX / moveMag) * speed;
        velZ = (moveZ / moveMag) * speed;
        if (s.sprinting && drain(s, tuning.sprintDrainPerSec * dt, tuning)) events |= MotorEvent.Exhausted;
      }
      // Locked on: strafe while facing the target (sprinting breaks the strafe).
      if (locked && !s.sprinting) {
        s.facingYaw = turnToward(s.facingYaw, input.viewYaw, tuning.turnRate * dt);
      } else if (moving) {
        s.facingYaw = turnToward(s.facingYaw, yawFromDirection(moveX, moveZ), tuning.turnRate * dt);
      }
      break;
    }
    case CharacterAction.Dodge: {
      const metres = tuning.dodge.distance * tickShare(s.actionTick, tuning.dodge.ticks, easeOutRoll);
      velX = (s.dodgeDirX * metres) / dt;
      velZ = (s.dodgeDirZ * metres) / dt;
      break;
    }
    case CharacterAction.Attack: {
      const step = currentStep(s, moveset);
      const lungeTicks = step.windupTicks + step.activeTicks;
      if (s.actionTick < lungeTicks) {
        const metres = step.lunge * tickShare(s.actionTick, lungeTicks, linearDecay);
        velX = (-Math.sin(s.facingYaw) * metres) / dt;
        velZ = (-Math.cos(s.facingYaw) * metres) / dt;
      }
      break;
    }
  }

  if (s.regenDelayTicks > 0) {
    s.regenDelayTicks--;
  } else if (!s.sprinting && (s.action === CharacterAction.Free || s.action === CharacterAction.Stagger)) {
    s.stamina = Math.min(s.maxStamina, s.stamina + tuning.staminaRegenPerSec * dt);
  }
  if (s.exhausted && s.stamina >= s.maxStamina * tuning.exhaustRecoverFraction) s.exhausted = false;

  if (s.bufferTicks > 0 && --s.bufferTicks === 0) s.buffered = Buffered.None;

  return { velX, velZ, events };
}

// ---------------------------------------------------------------------------
// Queries used by hit registration, damage intake and animation.
// ---------------------------------------------------------------------------

/** The attack step whose hitbox is live this tick, or null. */
export function activeAttackStep(s: MotorState, moveset: Moveset): AttackStep | null {
  if (s.action !== CharacterAction.Attack) return null;
  const step = currentStep(s, moveset);
  return s.actionTick >= step.windupTicks && s.actionTick < step.windupTicks + step.activeTicks ? step : null;
}

export type DefenseOutcome = 'dodged' | 'parried' | 'guarded' | 'hit';

export interface IncomingAttack {
  parryable: boolean;
  /** Perfect window override for this attack, in ticks (capped by the motor's own). */
  deflectTicks?: number;
  /** Direction from the defender toward the attack's origin; omit to treat it as frontal. */
  fromX?: number;
  fromZ?: number;
}

/**
 * How the defender's current action meets an incoming blow. Pure: callers then apply
 * applyParrySuccess / applyGuard / damage. Server and client resolve hits identically.
 */
export function resolveIncomingAttack(s: MotorState, tuning: MotorTuning, attack: IncomingAttack): DefenseOutcome {
  if (isInvulnerable(s, tuning)) return 'dodged';
  if (!attack.parryable || s.action !== CharacterAction.Parry || s.actionTick >= tuning.parry.guardTicks) return 'hit';
  if (attack.fromX !== undefined && attack.fromZ !== undefined) {
    const length = Math.hypot(attack.fromX, attack.fromZ);
    if (length > 1e-6) {
      const cosToAttack = (-Math.sin(s.facingYaw) * attack.fromX - Math.cos(s.facingYaw) * attack.fromZ) / length;
      if (cosToAttack < Math.cos((tuning.parry.frontalArcDegrees * Math.PI) / 360)) return 'hit';
    }
  }
  const perfect = Math.min(tuning.parry.perfectTicks, attack.deflectTicks ?? tuning.parry.perfectTicks);
  return s.actionTick < perfect ? 'parried' : 'guarded';
}

/** Perfect parry: refund stamina and free the character to deflect the next blow or counter. */
export function applyParrySuccess(s: MotorState, tuning: MotorTuning): void {
  s.stamina = Math.min(s.maxStamina, s.stamina + tuning.parry.perfectRefund);
  s.exhausted = false;
  endAction(s);
}

/** Late parry: the blow is blocked for stamina. Returns true on guard break (staggered). */
export function applyGuard(s: MotorState, tuning: MotorTuning, staggerTicks = 20): boolean {
  drain(s, tuning.parry.guardStaminaDamage, tuning);
  if (s.stamina > 0) return false;
  applyStagger(s, staggerTicks);
  return true;
}

export function isInvulnerable(s: MotorState, tuning: MotorTuning): boolean {
  return (
    s.action === CharacterAction.Dodge &&
    s.actionTick >= tuning.dodge.iframeStart &&
    s.actionTick < tuning.dodge.iframeEnd
  );
}

export type AttackPhase = 'windup' | 'active' | 'recovery';

/** Phase and 0..1 progress through it, for animation. Null when not attacking. */
export function attackPhase(
  s: MotorState,
  moveset: Moveset,
): { step: AttackStep; phase: AttackPhase; t: number } | null {
  if (s.action !== CharacterAction.Attack) return null;
  const step = currentStep(s, moveset);
  const tick = s.actionTick;
  if (tick < step.windupTicks) return { step, phase: 'windup', t: tick / step.windupTicks };
  const activeTick = tick - step.windupTicks;
  if (activeTick < step.activeTicks) return { step, phase: 'active', t: activeTick / step.activeTicks };
  return { step, phase: 'recovery', t: Math.min(1, (activeTick - step.activeTicks) / step.recoveryTicks) };
}

export function applyStagger(s: MotorState, ticks: number): void {
  if (s.action === CharacterAction.Dead) return;
  s.action = CharacterAction.Stagger;
  s.actionTick = 0;
  s.actionDuration = ticks;
  s.comboQueued = false;
  clearBuffer(s);
}

export function applyDeath(s: MotorState): void {
  s.action = CharacterAction.Dead;
  s.actionTick = 0;
  s.comboQueued = false;
  clearBuffer(s);
}

export function revive(s: MotorState): void {
  endAction(s);
  s.stamina = s.maxStamina;
  s.exhausted = false;
}

export function yawFromDirection(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/** Rotate `from` toward `to` by at most `maxStep` radians along the shortest arc. */
export function turnToward(from: number, to: number, maxStep: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  else if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return to;
  return from + Math.sign(delta) * maxStep;
}

// ---------------------------------------------------------------------------

function currentStep(s: MotorState, moveset: Moveset): AttackStep {
  return moveset.steps[s.comboStep] ?? moveset.steps[0];
}

function canSpend(s: MotorState): boolean {
  return !s.exhausted && s.stamina > 0;
}

/** Returns true if this spend exhausted the character. */
function drain(s: MotorState, amount: number, tuning: MotorTuning): boolean {
  s.stamina = Math.max(0, s.stamina - amount);
  s.regenDelayTicks = tuning.staminaRegenDelayTicks;
  if (s.stamina === 0 && !s.exhausted) {
    s.exhausted = true;
    return true;
  }
  return false;
}

function startDodge(s: MotorState, moveX: number, moveZ: number, moveMag: number, tuning: MotorTuning): number {
  if (moveMag > 0.1) {
    s.dodgeDirX = moveX / moveMag;
    s.dodgeDirZ = moveZ / moveMag;
    s.facingYaw = yawFromDirection(s.dodgeDirX, s.dodgeDirZ);
  } else {
    // Backstep: keep facing, move away from it.
    s.dodgeDirX = Math.sin(s.facingYaw);
    s.dodgeDirZ = Math.cos(s.facingYaw);
  }
  s.action = CharacterAction.Dodge;
  s.actionTick = 0;
  s.comboQueued = false;
  clearBuffer(s);
  return MotorEvent.DodgeStarted | (drain(s, tuning.dodge.staminaCost, tuning) ? MotorEvent.Exhausted : 0);
}

function startParry(
  s: MotorState,
  moveX: number,
  moveZ: number,
  moveMag: number,
  viewYaw: number,
  locked: boolean,
  tuning: MotorTuning,
): number {
  s.action = CharacterAction.Parry;
  s.actionTick = 0;
  s.comboQueued = false;
  if (locked) s.facingYaw = viewYaw;
  else if (moveMag > 0.3) s.facingYaw = yawFromDirection(moveX, moveZ);
  clearBuffer(s);
  return MotorEvent.ParryStarted | (drain(s, tuning.parry.staminaCost, tuning) ? MotorEvent.Exhausted : 0);
}

function startAttack(
  s: MotorState,
  comboStep: number,
  moveX: number,
  moveZ: number,
  moveMag: number,
  viewYaw: number,
  locked: boolean,
  moveset: Moveset,
  tuning: MotorTuning,
): number {
  s.action = CharacterAction.Attack;
  s.actionTick = 0;
  s.comboStep = comboStep;
  s.comboQueued = false;
  s.attackSerial++;
  // Locked on: swing at the target. Otherwise the stick wins, then the camera direction.
  s.facingYaw = locked ? viewYaw : moveMag > 0.3 ? yawFromDirection(moveX, moveZ) : viewYaw;
  clearBuffer(s);
  const cost = currentStep(s, moveset).staminaCost;
  return MotorEvent.AttackStarted | (drain(s, cost, tuning) ? MotorEvent.Exhausted : 0);
}

function endAction(s: MotorState): void {
  s.action = CharacterAction.Free;
  s.actionTick = 0;
  s.comboStep = 0;
  s.comboQueued = false;
}

function clearBuffer(s: MotorState): void {
  s.buffered = Buffered.None;
  s.bufferTicks = 0;
}

/** Share of the total travel covered on tick `k` of `n`, from a cumulative curve F(0)=0, F(1)=1. */
function tickShare(k: number, n: number, cumulative: (u: number) => number): number {
  return cumulative((k + 1) / n) - cumulative(k / n);
}

/** Integral of 1.5(1 − u²): fast start, soft landing. */
function easeOutRoll(u: number): number {
  return (3 * u - u * u * u) / 2;
}

/** Integral of 2(1 − u). */
function linearDecay(u: number): number {
  return 2 * u - u * u;
}
