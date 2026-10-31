/**
 * Frame data in simulation ticks (SIM_TICK_HZ = 30, so 1 tick ≈ 33 ms). Authored here
 * rather than in assets so the server validates exactly what the client animates.
 */

/** Melee hitbox: a horizontal sector (reach × arc) extruded over a height band. */
export interface MeleeShape {
  /** Horizontal reach from the attack's origin, metres. */
  reach: number;
  /** Full sweep angle in degrees; ≥360 hits all around. */
  arcDegrees: number;
  /** Vertical band of the hitbox relative to the attacker's feet. */
  heightMin: number;
  heightMax: number;
}

export interface AttackStep extends MeleeShape {
  id: string;
  name: string;
  windupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  staminaCost: number;
  motionValue: number;
  /** Forward travel during windup + active, metres. */
  lunge: number;
  /** Impulse applied to the target's hit reaction (visual on client, poise on server). */
  impact: number;
}

export interface Moveset {
  id: string;
  steps: readonly [AttackStep, ...AttackStep[]];
}

export const DUAL_BLADES_MOVESET: Moveset = {
  id: 'dual-blades-light',
  steps: [
    {
      id: 'twin-cut-1',
      name: 'Twin Cut',
      windupTicks: 4,
      activeTicks: 3,
      recoveryTicks: 8,
      staminaCost: 7,
      motionValue: 0.9,
      reach: 2.4,
      arcDegrees: 110,
      heightMin: 0.3,
      heightMax: 1.9,
      lunge: 0.6,
      impact: 0.6,
    },
    {
      id: 'twin-cut-2',
      name: 'Return Cut',
      windupTicks: 3,
      activeTicks: 3,
      recoveryTicks: 8,
      staminaCost: 7,
      motionValue: 1.0,
      reach: 2.4,
      arcDegrees: 120,
      heightMin: 0.3,
      heightMax: 1.9,
      lunge: 0.6,
      impact: 0.7,
    },
    {
      id: 'crosswind-finisher',
      name: 'Crosswind Finisher',
      windupTicks: 6,
      activeTicks: 5,
      recoveryTicks: 12,
      staminaCost: 12,
      motionValue: 1.8,
      reach: 2.8,
      arcDegrees: 360,
      heightMin: 0.2,
      heightMax: 2.0,
      lunge: 1.4,
      impact: 1.6,
    },
  ],
};

export interface MotorTuning {
  /** m/s at full stick, before moveSpeed multiplier. */
  runSpeed: number;
  sprintSpeed: number;
  /** Max facing change while moving freely, rad/s. */
  turnRate: number;
  dodge: {
    ticks: number;
    /** Invulnerable for actionTick in [iframeStart, iframeEnd). */
    iframeStart: number;
    iframeEnd: number;
    distance: number;
    staminaCost: number;
  };
  parry: {
    ticks: number;
    /** actionTick < perfectTicks: deflect (no damage, builds parry chains). */
    perfectTicks: number;
    /** actionTick < guardTicks: late parry, blocks part of the damage for stamina. */
    guardTicks: number;
    staminaCost: number;
    /** Stamina returned on a perfect parry so chains stay sustainable. */
    perfectRefund: number;
    guardStaminaDamage: number;
    /** Attacks from outside ± this angle (degrees) of facing cannot be parried. */
    frontalArcDegrees: number;
  };
  sprintDrainPerSec: number;
  staminaRegenPerSec: number;
  /** Ticks after any stamina spend before regen resumes. */
  staminaRegenDelayTicks: number;
  /** Fraction of max stamina needed to recover from exhaustion. */
  exhaustRecoverFraction: number;
  /** How long an early press is remembered (input buffering). */
  inputBufferTicks: number;
}

export const DEFAULT_MOTOR_TUNING: MotorTuning = {
  runSpeed: 5.5,
  sprintSpeed: 9,
  turnRate: Math.PI * 4,
  dodge: {
    ticks: 12,
    iframeStart: 1,
    iframeEnd: 9,
    distance: 4.2,
    staminaCost: 22,
  },
  parry: {
    ticks: 16,
    perfectTicks: 6,
    guardTicks: 11,
    staminaCost: 8,
    perfectRefund: 10,
    guardStaminaDamage: 24,
    frontalArcDegrees: 200,
  },
  sprintDrainPerSec: 16,
  staminaRegenPerSec: 32,
  staminaRegenDelayTicks: 24,
  exhaustRecoverFraction: 0.3,
  inputBufferTicks: 6,
};

export function attackStepTotalTicks(step: AttackStep): number {
  return step.windupTicks + step.activeTicks + step.recoveryTicks;
}
