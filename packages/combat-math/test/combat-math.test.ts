import {
  CharacterAction,
  InputButton,
  SIM_DT,
  type Hurtbox,
  type InputFrame,
  type SkillDefinition,
  type StatBlock,
  type WorldMarkDefinition,
} from '@frontier/shared-types';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOTOR_TUNING,
  DUAL_BLADES_MOVESET,
  DeterministicRng,
  MotorEvent,
  activeAttackStep,
  attackStepTotalTicks,
  canEquipSlot,
  computeDamage,
  createMotorState,
  deriveCombatStats,
  findEvolution,
  grantSkillXp,
  isInvulnerable,
  resolveStats,
  stepMotor,
  testMeleeHit,
  type MotorContext,
  type MotorState,
} from '../src/index.ts';

const ctx: MotorContext = {
  moveset: DUAL_BLADES_MOVESET,
  tuning: DEFAULT_MOTOR_TUNING,
  speedMultiplier: 1,
  dt: SIM_DT,
};

function frame(partial: Partial<InputFrame> = {}): InputFrame {
  return { seq: 0, moveX: 0, moveY: 0, viewYaw: 0, held: 0, pressed: 0, ...partial };
}

function run(state: MotorState, ticks: number, input: Partial<InputFrame> = {}) {
  let x = 0;
  let z = 0;
  let events = 0;
  for (let i = 0; i < ticks; i++) {
    const out = stepMotor(state, frame(i === 0 ? input : { ...input, pressed: 0 }), ctx);
    x += out.velX * SIM_DT;
    z += out.velZ * SIM_DT;
    events |= out.events;
  }
  return { x, z, events };
}

describe('DeterministicRng', () => {
  it('reproduces the same sequence for the same seed', () => {
    const a = new DeterministicRng(1337);
    const b = new DeterministicRng(1337);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new DeterministicRng(1338).next()).not.toBe(seqA[0]);
  });
});

describe('computeDamage', () => {
  const attacker = { attack: 100, defense: 0, critChance: 0.1, critDamage: 0.5, moveSpeed: 1 };
  const body = { kind: 'body', damageMultiplier: 1, critBonus: 0 } as const;

  it('applies hyperbolic defense', () => {
    const result = computeDamage({ attacker, defender: { defense: 100 }, motionValue: 1, hurtbox: body, critRoll: 0.99 });
    expect(result).toEqual({ amount: 50, isCritical: false, isWeakPoint: false });
  });

  it('crits below the threshold and adds weak point bonuses', () => {
    const weak = { kind: 'weakpoint', damageMultiplier: 1.3, critBonus: 0.5 } as const;
    const result = computeDamage({ attacker, defender: { defense: 0 }, motionValue: 1, hurtbox: weak, critRoll: 0.55 });
    expect(result).toEqual({ amount: 195, isCritical: true, isWeakPoint: true });
  });

  it('never deals less than 1', () => {
    const weakling = { ...attacker, attack: 1 };
    expect(computeDamage({ attacker: weakling, defender: { defense: 10_000 }, motionValue: 0.1, hurtbox: body, critRoll: 1 }).amount).toBe(1);
  });
});

describe('stats & world marks', () => {
  const base: StatBlock = {
    maxHp: 1000, maxStamina: 100, attack: 50, defense: 20, agility: 100, critChance: 0.05, critDamage: 0.5, moveSpeed: 1,
  };
  const lycaonMark: WorldMarkDefinition = {
    id: 'mark-night-lycaon',
    name: 'Mark of the Night Lycaon',
    description: '',
    source: { colossusId: 'shadow-stalker', outcome: 'survive' },
    modifiers: [
      { stat: 'agility', op: 'percent', value: 0.2, condition: { timeOfDay: ['night'] }, source: 'mark-night-lycaon' },
      { stat: 'critChance', op: 'flat', value: 0.2, condition: { timeOfDay: ['night'] }, source: 'mark-night-lycaon' },
    ],
    forbiddenSlots: ['chest'],
    visual: { kind: 'tattoo' },
  };

  it('applies conditional modifiers only when the world matches', () => {
    const day = resolveStats(base, lycaonMark.modifiers, { timeOfDay: 'day', moonPhase: 'full', zoneTags: [] });
    const night = resolveStats(base, lycaonMark.modifiers, { timeOfDay: 'night', moonPhase: 'new', zoneTags: [] });
    expect(day.agility).toBe(100);
    expect(night.agility).toBeCloseTo(120);
    expect(night.critChance).toBeCloseTo(0.25);
    expect(deriveCombatStats(night).critChance).toBeCloseTo(0.25 + 120 * 0.0005);
  });

  it('forbids chest armor for marked players', () => {
    expect(canEquipSlot('chest', [lycaonMark])).toBe(false);
    expect(canEquipSlot('head', [lycaonMark])).toBe(true);
  });
});

describe('character motor', () => {
  it('dodge covers exactly its tuned distance and grants i-frames only in the window', () => {
    const s = createMotorState(100);
    const iframes: boolean[] = [];
    let x = 0;
    let z = 0;
    for (let t = 0; t < DEFAULT_MOTOR_TUNING.dodge.ticks; t++) {
      const out = stepMotor(s, frame({ moveY: 1, pressed: t === 0 ? InputButton.Dodge : 0 }), ctx);
      x += out.velX * SIM_DT;
      z += out.velZ * SIM_DT;
      iframes.push(isInvulnerable(s, DEFAULT_MOTOR_TUNING));
    }
    expect(Math.hypot(x, z)).toBeCloseTo(DEFAULT_MOTOR_TUNING.dodge.distance, 6);
    expect(z).toBeLessThan(0); // forward at viewYaw 0 is -Z
    expect(iframes.indexOf(true)).toBe(DEFAULT_MOTOR_TUNING.dodge.iframeStart);
    expect(iframes.lastIndexOf(true)).toBe(DEFAULT_MOTOR_TUNING.dodge.iframeEnd - 1);
    expect(s.stamina).toBe(100 - DEFAULT_MOTOR_TUNING.dodge.staminaCost);
    stepMotor(s, frame(), ctx);
    expect(s.action).toBe(CharacterAction.Free);
  });

  it('chains a buffered three-hit combo and exposes hitboxes only on active ticks', () => {
    const s = createMotorState(100);
    const serials = new Set<number>();
    let activeTicks = 0;
    for (let t = 0; t < 80; t++) {
      // Mash attack every 4 ticks, as a player would.
      stepMotor(s, frame({ pressed: t % 4 === 0 ? InputButton.Attack : 0 }), ctx);
      if (s.action === CharacterAction.Attack) serials.add(s.attackSerial * 10 + s.comboStep);
      if (activeAttackStep(s, DUAL_BLADES_MOVESET)) activeTicks++;
    }
    const steps = DUAL_BLADES_MOVESET.steps.map((step) => step.activeTicks);
    expect([...serials].slice(0, 3)).toEqual([10, 21, 32]);
    expect(activeTicks).toBeGreaterThanOrEqual(steps.reduce((a, b) => a + b, 0));
  });

  it('lets dodge cancel attack recovery', () => {
    const s = createMotorState(100);
    stepMotor(s, frame({ pressed: InputButton.Attack }), ctx);
    const first = DUAL_BLADES_MOVESET.steps[0];
    const recoveryStart = first.windupTicks + first.activeTicks;
    for (let t = 1; t < recoveryStart; t++) stepMotor(s, frame(), ctx);
    expect(s.action).toBe(CharacterAction.Attack);
    stepMotor(s, frame({ moveX: 1, pressed: InputButton.Dodge }), ctx);
    expect(s.action).toBe(CharacterAction.Dodge);
    expect(s.actionTick).toBe(0);
  });

  it('finishes an attack and returns to free when nothing is queued', () => {
    const s = createMotorState(100);
    run(s, attackStepTotalTicks(DUAL_BLADES_MOVESET.steps[0]) + 1, { pressed: InputButton.Attack });
    expect(s.action).toBe(CharacterAction.Free);
  });

  it('exhausts on empty stamina and blocks sprint until recovered', () => {
    const s = createMotorState(100);
    const { events } = run(s, 400, { moveY: 1, held: InputButton.Sprint });
    expect(events & MotorEvent.Exhausted).toBeTruthy();
    // Sprinting drains to zero, exhaustion stops sprint, then regen eventually clears it.
    const exhausted = createMotorState(100);
    exhausted.stamina = 0;
    exhausted.exhausted = true;
    const out = stepMotor(exhausted, frame({ moveY: 1, held: InputButton.Sprint }), ctx);
    expect(exhausted.sprinting).toBe(false);
    expect(Math.hypot(out.velX, out.velZ)).toBeCloseTo(DEFAULT_MOTOR_TUNING.runSpeed);
    stepMotor(exhausted, frame({ pressed: InputButton.Dodge }), ctx);
    expect(exhausted.action).toBe(CharacterAction.Free);
  });

  it('moves relative to camera yaw', () => {
    const s = createMotorState(100);
    const out = stepMotor(s, frame({ moveY: 1, viewYaw: Math.PI / 2 }), ctx);
    expect(out.velX).toBeCloseTo(-DEFAULT_MOTOR_TUNING.runSpeed);
    expect(out.velZ).toBeCloseTo(0);
  });
});

describe('testMeleeHit', () => {
  const step = DUAL_BLADES_MOVESET.steps[0];
  const hurtboxes: Hurtbox[] = [
    { id: 'torso', kind: 'body', offset: { x: 0, y: 1.1, z: 0 }, radius: 0.45, damageMultiplier: 1, critBonus: 0 },
    {
      id: 'core',
      kind: 'weakpoint',
      offset: { x: 0, y: 1.25, z: 0.35 },
      radius: 0.2,
      damageMultiplier: 1.3,
      critBonus: 0.5,
      exposure: { normal: { x: 0, y: 0, z: 1 }, minDot: 0.35 },
    },
  ];
  const dummy = { x: 0, y: 0, z: 0, yaw: 0 }; // faces -Z, core on its back (+Z)

  it('hits the body from the front', () => {
    const hit = testMeleeHit({ x: 0, y: 0, z: -1.8, yaw: Math.PI }, step, dummy, hurtboxes);
    expect(hit?.hurtbox.id).toBe('torso');
  });

  it('prefers the exposed weak point from behind', () => {
    const hit = testMeleeHit({ x: 0, y: 0, z: 1.8, yaw: 0 }, step, dummy, hurtboxes);
    expect(hit?.hurtbox.id).toBe('core');
  });

  it('respects the weak point after the target turns', () => {
    const turned = { ...dummy, yaw: Math.PI }; // now faces +Z, core on -Z side
    expect(testMeleeHit({ x: 0, y: 0, z: 1.8, yaw: 0 }, step, turned, hurtboxes)?.hurtbox.id).toBe('torso');
    expect(testMeleeHit({ x: 0, y: 0, z: -1.8, yaw: Math.PI }, step, turned, hurtboxes)?.hurtbox.id).toBe('core');
  });

  it('misses when facing away or out of reach', () => {
    expect(testMeleeHit({ x: 0, y: 0, z: -1.8, yaw: 0 }, step, dummy, hurtboxes)).toBeNull();
    expect(testMeleeHit({ x: 0, y: 0, z: -4, yaw: Math.PI }, step, dummy, hurtboxes)).toBeNull();
  });
});

describe('skill evolution', () => {
  const criticalStrike: SkillDefinition = {
    id: 'critical-strike',
    name: 'Critical Strike',
    description: '',
    kind: 'passive',
    maxLevel: 10,
    xpCurve: { base: 100, growth: 1.5 },
    evolutions: [{ into: 'spiral-slash', requirements: [{ kind: 'counter', counter: 'precisionHits', atLeast: 1000 }] }],
  };

  it('evolves after 1,000 precision hits', () => {
    const progress = { skillId: 'critical-strike', level: 1, xp: 0, counters: { precisionHits: 999 } };
    expect(findEvolution(progress, criticalStrike)).toBeNull();
    progress.counters.precisionHits = 1000;
    expect(findEvolution(progress, criticalStrike)).toBe('spiral-slash');
  });

  it('levels through use with a growth curve', () => {
    const progress = { skillId: 'critical-strike', level: 1, xp: 0, counters: {} };
    expect(grantSkillXp(progress, criticalStrike, 250)).toBe(2); // 100 + 150
    expect(progress).toMatchObject({ level: 3, xp: 0 });
  });
});
