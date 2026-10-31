import { CharacterAction, InputButton, SIM_DT, type Hurtbox, type InputFrame } from '@frontier/shared-types';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOTOR_TUNING,
  DUAL_BLADES_MOVESET,
  DeterministicRng,
  StalkerEvent,
  StalkerPhase,
  STALKER_ATTACKS,
  STALKER_TUNING,
  SANDBOX_DAY_SECONDS,
  DAY_PERIODS,
  applyGuard,
  applyParrySuccess,
  createMotorState,
  createStalkerState,
  moonPhaseAt,
  nextNewMoonNight,
  resolveIncomingAttack,
  stalkerAttackResolved,
  stalkerStruck,
  stalkerTargetFell,
  stepMotor,
  stepStalker,
  summonStalker,
  testMeleeHit,
  timeOfDayAt,
  type DefenseOutcome,
  type MotorContext,
} from '../src/index.ts';

const ctx: MotorContext = { moveset: DUAL_BLADES_MOVESET, tuning: DEFAULT_MOTOR_TUNING, speedMultiplier: 1, dt: SIM_DT };
const frame = (partial: Partial<InputFrame> = {}): InputFrame => ({
  seq: 0,
  moveX: 0,
  moveY: 0,
  viewYaw: 0,
  held: 0,
  pressed: 0,
  ...partial,
});
const parryable = { parryable: true };

describe('parry', () => {
  it('deflects in the perfect window, guards late, and fails after', () => {
    const outcomes: DefenseOutcome[] = [];
    const s = createMotorState(100);
    stepMotor(s, frame({ pressed: InputButton.Parry }), ctx);
    for (let t = 0; t < DEFAULT_MOTOR_TUNING.parry.ticks; t++) {
      outcomes.push(resolveIncomingAttack(s, DEFAULT_MOTOR_TUNING, parryable));
      stepMotor(s, frame(), ctx);
    }
    const { perfectTicks, guardTicks, ticks } = DEFAULT_MOTOR_TUNING.parry;
    expect(outcomes.slice(0, perfectTicks).every((o) => o === 'parried')).toBe(true);
    expect(outcomes.slice(perfectTicks, guardTicks).every((o) => o === 'guarded')).toBe(true);
    expect(outcomes.slice(guardTicks, ticks).every((o) => o === 'hit')).toBe(true);
    expect(s.action).toBe(CharacterAction.Free);
  });

  it('honours a tighter per-attack deflect window', () => {
    const s = createMotorState(100);
    stepMotor(s, frame({ pressed: InputButton.Parry }), ctx);
    for (let t = 0; t < 4; t++) stepMotor(s, frame(), ctx); // actionTick 4
    expect(resolveIncomingAttack(s, DEFAULT_MOTOR_TUNING, { parryable: true })).toBe('parried');
    expect(resolveIncomingAttack(s, DEFAULT_MOTOR_TUNING, { parryable: true, deflectTicks: 4 })).toBe('guarded');
  });

  it('cannot deflect perilous attacks or blows from behind', () => {
    const s = createMotorState(100);
    stepMotor(s, frame({ pressed: InputButton.Parry }), ctx); // facing -Z
    expect(resolveIncomingAttack(s, DEFAULT_MOTOR_TUNING, { parryable: false })).toBe('hit');
    expect(resolveIncomingAttack(s, DEFAULT_MOTOR_TUNING, { parryable: true, fromX: 0, fromZ: 1 })).toBe('hit');
    expect(resolveIncomingAttack(s, DEFAULT_MOTOR_TUNING, { parryable: true, fromX: 0.3, fromZ: -1 })).toBe('parried');
  });

  it('treats i-frames as a dodge regardless of parryability', () => {
    const s = createMotorState(100);
    stepMotor(s, frame({ moveY: 1, pressed: InputButton.Dodge }), ctx);
    stepMotor(s, frame(), ctx);
    expect(resolveIncomingAttack(s, DEFAULT_MOTOR_TUNING, { parryable: false })).toBe('dodged');
  });

  it('frees the character and refunds stamina on success, so chains are sustainable', () => {
    const s = createMotorState(100);
    stepMotor(s, frame({ pressed: InputButton.Parry }), ctx);
    const afterCost = s.stamina;
    applyParrySuccess(s, DEFAULT_MOTOR_TUNING);
    expect(s.action).toBe(CharacterAction.Free);
    expect(s.stamina).toBe(Math.min(100, afterCost + DEFAULT_MOTOR_TUNING.parry.perfectRefund));
    stepMotor(s, frame({ pressed: InputButton.Parry }), ctx);
    expect(s.action).toBe(CharacterAction.Parry);
  });

  it('breaks the guard when a late parry empties stamina', () => {
    const s = createMotorState(100);
    stepMotor(s, frame({ pressed: InputButton.Parry }), ctx);
    s.stamina = 10;
    expect(applyGuard(s, DEFAULT_MOTOR_TUNING)).toBe(true);
    expect(s.action).toBe(CharacterAction.Stagger);
  });

  it('cancels attack recovery', () => {
    const s = createMotorState(100);
    stepMotor(s, frame({ pressed: InputButton.Attack }), ctx);
    const first = DUAL_BLADES_MOVESET.steps[0];
    for (let t = 1; t < first.windupTicks + first.activeTicks; t++) stepMotor(s, frame(), ctx);
    stepMotor(s, frame({ pressed: InputButton.Parry }), ctx);
    expect(s.action).toBe(CharacterAction.Parry);
  });
});

describe('lock-on', () => {
  it('strafes while facing the camera direction', () => {
    const s = createMotorState(100, 0);
    let out = stepMotor(s, frame({ moveX: 1, held: InputButton.LockOn }), ctx);
    for (let i = 0; i < 10; i++) out = stepMotor(s, frame({ moveX: 1, held: InputButton.LockOn }), ctx);
    expect(out.velX).toBeGreaterThan(0);
    expect(s.facingYaw).toBeCloseTo(0);
  });

  it('swings at the target even with the stick held sideways', () => {
    const s = createMotorState(100, 0);
    stepMotor(s, frame({ moveX: 1, viewYaw: 0.4, held: InputButton.LockOn, pressed: InputButton.Attack }), ctx);
    expect(s.action).toBe(CharacterAction.Attack);
    expect(s.facingYaw).toBeCloseTo(0.4);
  });
});

describe('world clock', () => {
  it('maps day fractions to periods', () => {
    expect(timeOfDayAt(3.5)).toBe('day');
    expect(timeOfDayAt(3.25)).toBe('dawn');
    expect(timeOfDayAt(3.75)).toBe('dusk');
    expect(timeOfDayAt(3.9)).toBe('night');
    expect(timeOfDayAt(4.1)).toBe('night');
  });

  it('keeps one moon phase through midnight and cycles every four nights', () => {
    expect(moonPhaseAt(1.85)).toBe(moonPhaseAt(2.15));
    expect(moonPhaseAt(1.85)).toBe(moonPhaseAt(5.85));
    expect(moonPhaseAt(1.85)).not.toBe(moonPhaseAt(2.85));
  });

  it('finds the next new-moon night', () => {
    const t = nextNewMoonNight(1.55);
    expect(moonPhaseAt(t)).toBe('new');
    expect(timeOfDayAt(t)).toBe('night');
    expect(nextNewMoonNight(t + 0.1)).toBeCloseTo(t + 0.1); // already inside it
  });
});

// ---------------------------------------------------------------------------
// Simulated encounters against a stationary target.
// ---------------------------------------------------------------------------

const PLAYER_HURTBOXES: Hurtbox[] = [
  { id: 'body', kind: 'body', offset: { x: 0, y: 1.0, z: 0 }, radius: 0.45, damageMultiplier: 1, critBonus: 0 },
  { id: 'head', kind: 'body', offset: { x: 0, y: 1.65, z: 0 }, radius: 0.22, damageMultiplier: 1, critBonus: 0 },
];

type Policy = 'perfect' | 'passive';

function simulate(policy: Policy, ticks: number, seed = 7, dawnAtTick = Infinity) {
  const s = createStalkerState();
  summonStalker(s, 0, -9, 0);
  const rng = new DeterministicRng(seed);
  const target = { x: 0, y: 0, z: 0, yaw: Math.PI };
  const resolved = new Set<number>();
  const log = { telegraphs: 0, parried: 0, hitsTaken: 0, exposures: 0, events: 0, trace: [] as number[] };

  for (let t = 0; t < ticks && s.phase !== StalkerPhase.Dormant; t++) {
    const out = stepStalker(s, { target, targetAlive: true, isNight: t < dawnAtTick, rng, dt: SIM_DT });
    s.x += out.velX * SIM_DT;
    s.z += out.velZ * SIM_DT;
    log.events |= out.events;
    if (out.events & (StalkerEvent.TelegraphParryable | StalkerEvent.TelegraphPerilous)) log.telegraphs++;
    if (out.hit && !resolved.has(out.hit.serial) && testMeleeHit(out.hit.pose, out.hit.attack, target, PLAYER_HURTBOXES)) {
      resolved.add(out.hit.serial);
      const outcome: DefenseOutcome = policy === 'passive' ? 'hit' : out.hit.attack.parryable ? 'parried' : 'dodged';
      if (outcome === 'parried') log.parried++;
      if (outcome === 'hit') log.hitsTaken++;
      const r = stalkerAttackResolved(s, outcome);
      log.events |= r.events;
      if (r.events & StalkerEvent.Exposed) log.exposures++;
    }
    if (policy === 'perfect' && s.phase === StalkerPhase.Exposed && t % 10 === 0) {
      log.events |= stalkerStruck(s, 'weakpoint', 150).events;
    }
    log.trace.push(Math.round(s.x * 1000), Math.round(s.z * 1000));
  }
  return { s, log };
}

describe('Shadow Stalker', () => {
  it('shrugs off raw damage until exposed', () => {
    const s = createStalkerState();
    summonStalker(s, 0, -9, 0);
    expect(stalkerStruck(s, 'weakpoint', 999).resolveDamage).toBe(0);
    expect(s.resolve).toBe(STALKER_TUNING.maxResolve);
  });

  it('is subdued by a player who parries perfectly and punishes exposures', () => {
    const { s, log } = simulate('perfect', 30 * 60 * 5);
    expect(log.parried).toBeGreaterThanOrEqual(STALKER_TUNING.exposeChain);
    expect(log.exposures).toBeGreaterThanOrEqual(1);
    expect(log.events & StalkerEvent.Subdued).toBeTruthy();
    expect(log.hitsTaken).toBe(0);
    expect([StalkerPhase.Subdued, StalkerPhase.Dormant]).toContain(s.phase);
  });

  it('keeps attacking a passive player and never becomes exposed', () => {
    const { s, log } = simulate('passive', 30 * 60);
    expect(log.hitsTaken).toBeGreaterThan(3);
    expect(log.exposures).toBe(0);
    expect(s.resolve).toBe(STALKER_TUNING.maxResolve);
    expect(log.telegraphs).toBeGreaterThan(log.hitsTaken - 1);
  });

  it('dissolves at dawn and credits the survivor', () => {
    const { s, log } = simulate('passive', 30 * 30, 7, 300);
    expect(log.events & StalkerEvent.Survived).toBeTruthy();
    expect(s.phase).toBe(StalkerPhase.Dormant);
  });

  it('is deterministic for a given seed', () => {
    const a = simulate('perfect', 900, 42).log.trace;
    const b = simulate('perfect', 900, 42).log.trace;
    const c = simulate('perfect', 900, 43).log.trace;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });
});

// ---------------------------------------------------------------------------
// Difficulty envelope: brutal, but beatable with near-flawless reads.
// ---------------------------------------------------------------------------

const NIGHT_TICKS = Math.round(SANDBOX_DAY_SECONDS * (1 - DAY_PERIODS.night + DAY_PERIODS.dawn) * 30);

/** One new-moon night against a player who reads `skill` of strikes correctly. */
function fightNight(skill: number, seed: number): { subdued: boolean; died: boolean } {
  const s = createStalkerState();
  summonStalker(s, 0, -9, 0);
  const rng = new DeterministicRng(1000 + seed);
  const luck = new DeterministicRng(9000 + seed);
  const target = { x: 0, y: 0, z: 0, yaw: 0 };
  const resolved = new Set<number>();
  let hp = 1000;
  let downTicks = 0;
  let died = false;
  for (let t = 0; t < NIGHT_TICKS; t++) {
    const out = stepStalker(s, { target, targetAlive: downTicks === 0, isNight: true, rng, dt: SIM_DT });
    s.x += out.velX * SIM_DT;
    s.z += out.velZ * SIM_DT;
    if (downTicks > 0) {
      if (--downTicks === 0) hp = 1000;
      continue;
    }
    if (out.hit && !resolved.has(out.hit.serial) && testMeleeHit(out.hit.pose, out.hit.attack, target, PLAYER_HURTBOXES)) {
      resolved.add(out.hit.serial);
      const read = luck.next() < skill;
      const outcome: DefenseOutcome = read ? (out.hit.attack.parryable ? 'parried' : 'dodged') : 'hit';
      if (stalkerAttackResolved(s, outcome).events & StalkerEvent.Subdued) return { subdued: true, died };
      if (outcome === 'hit') {
        hp -= Math.round((260 * out.hit.attack.motionValue * 100) / 120);
        if (hp <= 0) {
          died = true;
          downTicks = 135;
          stalkerTargetFell(s);
        }
      }
    }
    // A strong punisher: ~70 on the heart every half second while it is Exposed.
    if (s.phase === StalkerPhase.Exposed && t % 15 === 0 && luck.next() < skill) {
      if (stalkerStruck(s, 'weakpoint', 70).events & StalkerEvent.Subdued) return { subdued: true, died };
    }
  }
  return { subdued: false, died };
}

describe('Shadow Stalker difficulty', () => {
  const nights = (skill: number) => Array.from({ length: 24 }, (_, seed) => fightNight(skill, seed));

  it('stays beatable for a flawless player within one night', () => {
    expect(nights(1).filter((n) => n.subdued).length).toBeGreaterThanOrEqual(22);
  });

  it('is out of reach for a player who misreads one strike in five', () => {
    const results = nights(0.8);
    expect(results.filter((n) => n.subdued).length).toBe(0);
    expect(results.filter((n) => !n.died).length).toBeLessThanOrEqual(1);
  });

  it('rolls hesitations so the same attack is not always timed alike', () => {
    const s = createStalkerState();
    summonStalker(s, 0, -3, 0);
    const rng = new DeterministicRng(3);
    const windups = new Set<number>();
    for (let t = 0; t < 30 * 120; t++) {
      stepStalker(s, { target: { x: 0, y: 0, z: 0, yaw: 0 }, targetAlive: true, isNight: true, rng, dt: SIM_DT });
      if (s.attack?.id === 'rending-claw-1') windups.add(s.windupTicks);
    }
    expect(windups.size).toBeGreaterThan(2);
    const base = STALKER_ATTACKS['rending-claw-1']!;
    for (const w of windups) expect(w).toBeLessThanOrEqual(base.windupTicks + base.feintTicks);
  });

  it('enters Eclipse below half Resolve and feeds when its target falls', () => {
    const s = createStalkerState();
    summonStalker(s, 0, -3, 0);
    s.phase = StalkerPhase.Exposed;
    const half = STALKER_TUNING.maxResolve * STALKER_TUNING.eclipseAt;
    const { events } = stalkerStruck(s, 'weakpoint', STALKER_TUNING.maxResolve - half + 1);
    expect(events & StalkerEvent.Eclipsed).toBeTruthy();
    expect(s.eclipsed).toBe(true);
    s.parryChain = 4;
    const regained = stalkerTargetFell(s);
    expect(regained).toBeCloseTo(STALKER_TUNING.maxResolve * STALKER_TUNING.feedOnFall);
    expect(s.parryChain).toBe(0);
  });
});
