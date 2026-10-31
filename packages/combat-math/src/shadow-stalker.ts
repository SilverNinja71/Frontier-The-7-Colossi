import type { GroundPose } from '@frontier/shared-types';
import type { MeleeShape } from './frame-data.ts';
import type { DefenseOutcome } from './motor.ts';
import { turnToward, yawFromDirection } from './motor.ts';
import type { DeterministicRng } from './rng.ts';

/**
 * The Shadow Stalker — Unique Colossus #1. Roams only on new-moon nights and cannot be
 * worn down by raw damage: perfect parries build a chain, five in a row leave it Exposed,
 * and only then do blades bite. Tuned to be brutal but fair: tight deflect windows and
 * hesitating windups demand reading each strike, and below half Resolve it enters Eclipse.
 * Pure and deterministic like the player motor, so the authoritative server runs this
 * exact brain; the client only renders it.
 */

export interface EnemyAttack extends MeleeShape {
  id: string;
  name: string;
  windupTicks: number;
  activeTicks: number;
  recoveryTicks: number;
  /** Unparryable ("perilous") attacks must be dodged or outrun. */
  parryable: boolean;
  motionValue: number;
  /** `self`: hitbox rides the attacker. `target`: ring where the target stood at commit. */
  origin: 'self' | 'target';
  /** Metres travelled from `travelLeadTicks` before the strike to the end of the active frames. */
  travel: number | 'to-target';
  travelLeadTicks: number;
  /** Perfect-parry window against this attack, in ticks; tighter than the player's default. */
  deflectTicks: number;
  /** Up to this many extra windup ticks, rolled per attack: timing must be read, not memorised. */
  feintTicks: number;
  /** Stops tracking the target this many ticks before the windup ends. */
  commitTicks: number;
  minRange: number;
  maxRange: number;
  cooldownTicks: number;
  /** Selection weight for openers; 0 = only reachable through `next`. */
  weight: number;
  staggerTicks: number;
  /** Chains straight into this attack after recovery (combos). */
  next?: string;
  /** A parried attack knocks the stalker back (lunges). */
  recoilOnParry?: boolean;
}

const claw = (overrides: Partial<EnemyAttack> & Pick<EnemyAttack, 'id' | 'name'>): EnemyAttack => ({
  windupTicks: 10,
  activeTicks: 3,
  recoveryTicks: 5,
  parryable: true,
  motionValue: 0.9,
  origin: 'self',
  reach: 3.2,
  arcDegrees: 130,
  heightMin: 0,
  heightMax: 2.2,
  travel: 1.2,
  travelLeadTicks: 6,
  deflectTicks: 5,
  feintTicks: 6,
  commitTicks: 3,
  minRange: 0,
  maxRange: 4.2,
  cooldownTicks: 0,
  weight: 0,
  // Shorter than the gap to the next claw, so a hit player can still parry or roll out.
  staggerTicks: 8,
  ...overrides,
});

export const STALKER_ATTACKS: Readonly<Record<string, EnemyAttack>> = {
  'rending-claw-1': claw({ id: 'rending-claw-1', name: 'Rending Claws', cooldownTicks: 75, weight: 3, next: 'rending-claw-2' }),
  'rending-claw-2': claw({ id: 'rending-claw-2', name: 'Rending Claws', windupTicks: 7, next: 'rending-claw-3' }),
  'rending-claw-3': claw({
    id: 'rending-claw-3',
    name: 'Rending Claws',
    windupTicks: 9,
    recoveryTicks: 22,
    motionValue: 1.25,
    travel: 1.6,
    feintTicks: 8,
    staggerTicks: 18,
  }),
  'shadow-lunge': {
    id: 'shadow-lunge',
    name: 'Shadow Lunge',
    windupTicks: 16,
    activeTicks: 7,
    recoveryTicks: 22,
    parryable: true,
    motionValue: 1.4,
    origin: 'self',
    reach: 2.6,
    arcDegrees: 90,
    heightMin: 0,
    heightMax: 2.2,
    travel: 8,
    travelLeadTicks: 0,
    deflectTicks: 4,
    feintTicks: 10,
    commitTicks: 5,
    minRange: 4.5,
    maxRange: 12,
    cooldownTicks: 100,
    weight: 2,
    staggerTicks: 20,
    recoilOnParry: true,
  },
  'moonless-howl': {
    id: 'moonless-howl',
    name: 'Moonless Howl',
    windupTicks: 28,
    activeTicks: 3,
    recoveryTicks: 28,
    parryable: false,
    motionValue: 1.8,
    origin: 'self',
    reach: 6.5,
    arcDegrees: 360,
    heightMin: 0,
    heightMax: 3,
    travel: 0,
    travelLeadTicks: 0,
    deflectTicks: 0,
    feintTicks: 0,
    commitTicks: 0,
    minRange: 0,
    maxRange: 5.5,
    cooldownTicks: 300,
    weight: 1.2,
    staggerTicks: 28,
  },
  'shade-pounce': {
    id: 'shade-pounce',
    name: 'Shade Pounce',
    windupTicks: 24,
    activeTicks: 3,
    recoveryTicks: 26,
    parryable: false,
    motionValue: 1.6,
    origin: 'target',
    reach: 3.2,
    arcDegrees: 360,
    heightMin: 0,
    heightMax: 3,
    travel: 'to-target',
    travelLeadTicks: 10,
    deflectTicks: 0,
    feintTicks: 6,
    commitTicks: 10,
    minRange: 6,
    maxRange: 18,
    cooldownTicks: 220,
    weight: 1.5,
    staggerTicks: 28,
  },
};

const OPENERS = Object.values(STALKER_ATTACKS).filter((a) => a.weight > 0);

export const STALKER_TUNING = {
  maxResolve: 5000,
  /** Consecutive perfect parries that leave it Exposed. */
  exposeChain: 5,
  exposedTicks: 75,
  recoilTicks: 20,
  emergeTicks: 60,
  dissolveTicks: 60,
  subdueTicks: 120,
  prowlSpeed: 3.6,
  chaseSpeed: 7,
  turnRate: 3.6,
  /** Preferred circling band while waiting between attacks, metres. */
  bandMin: 4.5,
  bandMax: 7.5,
  /** Gives up approaching for an attack after this long and re-picks. */
  intentTimeoutTicks: 90,
  leashRadius: 27,
  /** Resolve lost per perfect parry: base × (1 + 0.5 × (chain − 1)). */
  parryResolveDamage: 40,
  /** Share of blade damage that lands on resolve outside the heart while Exposed. */
  exposedBodyFactor: 0.25,
  /** Below this share of Resolve it enters Eclipse: faster, relentless. */
  eclipseAt: 0.5,
  eclipseWindupFactor: 0.8,
  eclipseSpeedFactor: 1.2,
  eclipseIdleFactor: 0.5,
  /** Share of max Resolve it regains each time it kills its target. */
  feedOnFall: 0.35,
} as const;

export const StalkerPhase = {
  Dormant: 0,
  Emerging: 1,
  Prowl: 2,
  Attack: 3,
  Recoil: 4,
  Exposed: 5,
  Dissolving: 6,
  Subdued: 7,
} as const;
export type StalkerPhaseId = (typeof StalkerPhase)[keyof typeof StalkerPhase];

export const StalkerEvent = {
  Emerged: 1 << 0,
  /** Windup of a parryable attack began: show the parry cue. */
  TelegraphParryable: 1 << 1,
  /** Windup of an unparryable attack began: show the peril cue. */
  TelegraphPerilous: 1 << 2,
  Exposed: 1 << 3,
  Subdued: 1 << 4,
  /** Dawn broke and it dissolved with the player still standing. */
  Survived: 1 << 5,
  Recoiled: 1 << 6,
  /** Crossed into Eclipse (second phase). */
  Eclipsed: 1 << 7,
} as const;

export interface StalkerState {
  phase: StalkerPhaseId;
  phaseTick: number;
  x: number;
  z: number;
  yaw: number;
  attack: EnemyAttack | null;
  /** Effective windup of the current attack after Eclipse speed-up and the rolled feint. */
  windupTicks: number;
  /** Increments per attack instance; resolve each instance against a target once. */
  attackSerial: number;
  /** Target snapshot at commit: pounce landing point / lunge heading. */
  aimX: number;
  aimZ: number;
  travelPerTick: number;
  travelDirX: number;
  travelDirZ: number;
  intent: EnemyAttack | null;
  intentTicks: number;
  idleTicks: number;
  circleDir: 1 | -1;
  cooldowns: Record<string, number>;
  resolve: number;
  parryChain: number;
  eclipsed: boolean;
}

export interface StalkerContext {
  /** Target feet pose (the player). */
  target: GroundPose;
  targetAlive: boolean;
  isNight: boolean;
  rng: DeterministicRng;
  dt: number;
}

export interface StalkerHit {
  attack: EnemyAttack;
  serial: number;
  pose: GroundPose;
}

export interface StalkerStepResult {
  velX: number;
  velZ: number;
  events: number;
  /** Live hitbox this tick, or null. */
  hit: StalkerHit | null;
}

export function createStalkerState(): StalkerState {
  return {
    phase: StalkerPhase.Dormant,
    phaseTick: 0,
    x: 0,
    z: 0,
    yaw: 0,
    attack: null,
    windupTicks: 0,
    attackSerial: 0,
    aimX: 0,
    aimZ: 0,
    travelPerTick: 0,
    travelDirX: 0,
    travelDirZ: 0,
    intent: null,
    intentTicks: 0,
    idleTicks: 0,
    circleDir: 1,
    cooldowns: {},
    resolve: STALKER_TUNING.maxResolve,
    parryChain: 0,
    eclipsed: false,
  };
}

export function summonStalker(s: StalkerState, x: number, z: number, yaw: number): number {
  Object.assign(s, createStalkerState(), { x, z, yaw, attackSerial: s.attackSerial });
  setPhase(s, StalkerPhase.Emerging);
  return StalkerEvent.Emerged;
}

/** Present in the world (renders, collides, can be locked on). */
export function stalkerPresent(s: StalkerState): boolean {
  return s.phase !== StalkerPhase.Dormant;
}

/** Can it be struck at all (even if immune)? */
export function stalkerTargetable(s: StalkerState): boolean {
  return s.phase !== StalkerPhase.Dormant && s.phase !== StalkerPhase.Subdued && s.phase !== StalkerPhase.Dissolving;
}

export function stepStalker(s: StalkerState, ctx: StalkerContext): StalkerStepResult {
  const T = STALKER_TUNING;
  let velX = 0;
  let velZ = 0;
  let events = 0;
  let hit: StalkerHit | null = null;

  for (const id in s.cooldowns) if (s.cooldowns[id]! > 0) s.cooldowns[id]!--;

  const dx = ctx.target.x - s.x;
  const dz = ctx.target.z - s.z;
  const dist = Math.hypot(dx, dz);
  const toTargetYaw = yawFromDirection(dx, dz);
  const speed = s.eclipsed ? T.eclipseSpeedFactor : 1;
  const maxTurn = T.turnRate * speed * ctx.dt;

  // Dawn ends every encounter that is still going.
  const engaged = s.phase === StalkerPhase.Prowl || s.phase === StalkerPhase.Attack || s.phase === StalkerPhase.Recoil;
  if (!ctx.isNight && (engaged || s.phase === StalkerPhase.Emerging || s.phase === StalkerPhase.Exposed)) {
    setPhase(s, StalkerPhase.Dissolving);
    if (ctx.targetAlive) events |= StalkerEvent.Survived;
  }

  switch (s.phase) {
    case StalkerPhase.Emerging:
      s.yaw = turnToward(s.yaw, toTargetYaw, maxTurn);
      if (s.phaseTick >= T.emergeTicks) startProwl(s, ctx, 20);
      break;

    case StalkerPhase.Prowl: {
      s.yaw = turnToward(s.yaw, toTargetYaw, maxTurn);
      if (!ctx.targetAlive) break;
      if (s.idleTicks > 0) {
        s.idleTicks--;
      } else {
        if (!s.intent || s.intentTicks++ > T.intentTimeoutTicks) pickIntent(s, ctx.rng);
        const intent = s.intent;
        if (intent && dist >= intent.minRange && dist <= intent.maxRange) {
          events |= startAttack(s, intent, ctx.rng);
          break;
        }
      }
      // Circle the target inside the preferred band, closing in when an attack needs it.
      const want = s.idleTicks === 0 && s.intent ? s.intent : null;
      let radial = 0;
      const chasing = want !== null && dist > want.maxRange;
      if (chasing) radial = T.chaseSpeed * speed;
      else if (want && dist < want.minRange) radial = -T.prowlSpeed * speed;
      else if (dist > T.bandMax) radial = T.prowlSpeed * speed;
      else if (dist < T.bandMin) radial = -T.prowlSpeed * 0.8 * speed;
      if (dist > 1e-3) {
        const ux = dx / dist;
        const uz = dz / dist;
        const tangential = chasing ? 0 : T.prowlSpeed * 0.65 * speed * s.circleDir;
        velX = ux * radial - uz * tangential;
        velZ = uz * radial + ux * tangential;
      }
      if (ctx.rng.next() < 0.008) s.circleDir = s.circleDir === 1 ? -1 : 1;
      break;
    }

    case StalkerPhase.Attack: {
      const a = s.attack!;
      const t = s.phaseTick;
      const windup = s.windupTicks;
      const commitTick = windup - a.commitTicks;
      const travelStart = windup - a.travelLeadTicks;
      if (t < commitTick) {
        s.yaw = turnToward(s.yaw, toTargetYaw, maxTurn * 1.5);
      } else if (t === commitTick) {
        s.aimX = ctx.target.x;
        s.aimZ = ctx.target.z;
      }
      if (t === travelStart) beginTravel(s, a);
      if (t >= travelStart && t < windup + a.activeTicks && s.travelPerTick > 0) {
        velX = (s.travelDirX * s.travelPerTick) / ctx.dt;
        velZ = (s.travelDirZ * s.travelPerTick) / ctx.dt;
      }
      if (t >= windup && t < windup + a.activeTicks) {
        const pose =
          a.origin === 'target'
            ? { x: s.aimX, y: 0, z: s.aimZ, yaw: s.yaw }
            : { x: s.x + velX * ctx.dt, y: 0, z: s.z + velZ * ctx.dt, yaw: s.yaw };
        hit = { attack: a, serial: s.attackSerial, pose };
      }
      if (t >= windup + a.activeTicks + a.recoveryTicks) {
        // In Eclipse an unparried lunge flows straight into the claw combo.
        const nextId = a.next ?? (s.eclipsed && a.id === 'shadow-lunge' ? 'rending-claw-1' : undefined);
        const next = nextId ? STALKER_ATTACKS[nextId] : undefined;
        if (next && ctx.targetAlive) events |= startAttack(s, next, ctx.rng);
        else startProwl(s, ctx, 14 + Math.floor(ctx.rng.next() * 22));
      }
      break;
    }

    case StalkerPhase.Recoil: {
      const k = 1 - s.phaseTick / T.recoilTicks;
      velX = Math.sin(s.yaw) * 6 * k;
      velZ = Math.cos(s.yaw) * 6 * k;
      if (s.phaseTick >= T.recoilTicks) startProwl(s, ctx, 6);
      break;
    }

    case StalkerPhase.Exposed:
      if (s.phaseTick >= T.exposedTicks) {
        s.parryChain = 0;
        startProwl(s, ctx, 10);
      }
      break;

    case StalkerPhase.Dissolving:
      if (s.phaseTick >= T.dissolveTicks) setPhase(s, StalkerPhase.Dormant);
      break;

    case StalkerPhase.Subdued:
      if (s.phaseTick >= T.subdueTicks) setPhase(s, StalkerPhase.Dormant);
      break;
  }

  // Leash to the arena (Rapier walls are the hard limit; this keeps the AI honest).
  const r = Math.hypot(s.x + velX * ctx.dt, s.z + velZ * ctx.dt);
  if (r > T.leashRadius && s.phase !== StalkerPhase.Attack) {
    velX -= (s.x / r) * T.prowlSpeed;
    velZ -= (s.z / r) * T.prowlSpeed;
  }

  s.phaseTick++;
  return { velX, velZ, events, hit };
}

/**
 * Feed back how the target met the attack in `hit`. Returns resolve damage dealt by a
 * perfect parry (for floating text) and any StalkerEvent flags raised.
 */
export function stalkerAttackResolved(s: StalkerState, outcome: DefenseOutcome): { resolveDamage: number; events: number } {
  if (outcome === 'dodged') return { resolveDamage: 0, events: 0 };
  if (outcome !== 'parried') {
    s.parryChain = 0;
    return { resolveDamage: 0, events: 0 };
  }
  s.parryChain++;
  const damage = Math.round(STALKER_TUNING.parryResolveDamage * (1 + 0.5 * (s.parryChain - 1)));
  const events = damageResolve(s, damage);
  if (events) return { resolveDamage: damage, events };
  if (s.parryChain >= STALKER_TUNING.exposeChain) {
    setPhase(s, StalkerPhase.Exposed);
    return { resolveDamage: damage, events: StalkerEvent.Exposed };
  }
  if (s.attack?.recoilOnParry) {
    setPhase(s, StalkerPhase.Recoil);
    return { resolveDamage: damage, events: StalkerEvent.Recoiled };
  }
  return { resolveDamage: damage, events: 0 };
}

/**
 * The target fell to it: it feeds, regaining part of its Resolve, and the chain is lost.
 * Returns the Resolve regained.
 */
export function stalkerTargetFell(s: StalkerState): number {
  if (!stalkerTargetable(s)) return 0;
  const before = s.resolve;
  s.resolve = Math.min(STALKER_TUNING.maxResolve, s.resolve + STALKER_TUNING.maxResolve * STALKER_TUNING.feedOnFall);
  s.parryChain = 0;
  return s.resolve - before;
}

/**
 * A blade connected. Raw damage is ignored unless Exposed; then the heart (weak point)
 * takes it in full and the body a share. Returns resolve actually removed (0 = immune).
 */
export function stalkerStruck(s: StalkerState, hurtboxKind: 'body' | 'weakpoint', damage: number): { resolveDamage: number; events: number } {
  if (s.phase !== StalkerPhase.Exposed) return { resolveDamage: 0, events: 0 };
  const amount = hurtboxKind === 'weakpoint' ? damage : Math.max(1, Math.round(damage * STALKER_TUNING.exposedBodyFactor));
  return { resolveDamage: amount, events: damageResolve(s, amount) };
}

// ---------------------------------------------------------------------------

function damageResolve(s: StalkerState, amount: number): number {
  s.resolve = Math.max(0, s.resolve - amount);
  if (s.resolve <= 0) {
    setPhase(s, StalkerPhase.Subdued);
    return StalkerEvent.Subdued;
  }
  if (!s.eclipsed && s.resolve <= STALKER_TUNING.maxResolve * STALKER_TUNING.eclipseAt) {
    s.eclipsed = true;
    return StalkerEvent.Eclipsed;
  }
  return 0;
}

function setPhase(s: StalkerState, phase: StalkerPhaseId): void {
  s.phase = phase;
  // stepStalker increments after processing, so a phase set mid-step starts at tick 0 next step.
  s.phaseTick = -1;
  if (phase !== StalkerPhase.Attack) s.attack = null;
}

function startProwl(s: StalkerState, ctx: StalkerContext, idleTicks: number): void {
  setPhase(s, StalkerPhase.Prowl);
  s.idleTicks = s.eclipsed ? Math.round(idleTicks * STALKER_TUNING.eclipseIdleFactor) : idleTicks;
  s.intent = null;
  if (ctx.rng.next() < 0.5) s.circleDir = s.circleDir === 1 ? -1 : 1;
}

function pickIntent(s: StalkerState, rng: DeterministicRng): void {
  const ready = OPENERS.filter((a) => (s.cooldowns[a.id] ?? 0) <= 0);
  s.intentTicks = 0;
  if (ready.length === 0) {
    s.intent = null;
    s.idleTicks = 10;
    return;
  }
  let roll = rng.next() * ready.reduce((sum, a) => sum + a.weight, 0);
  s.intent = ready[ready.length - 1]!;
  for (const a of ready) {
    roll -= a.weight;
    if (roll < 0) {
      s.intent = a;
      break;
    }
  }
}

function startAttack(s: StalkerState, attack: EnemyAttack, rng: DeterministicRng): number {
  setPhase(s, StalkerPhase.Attack);
  s.attack = attack;
  const base = s.eclipsed ? Math.round(attack.windupTicks * STALKER_TUNING.eclipseWindupFactor) : attack.windupTicks;
  s.windupTicks = base + Math.floor(rng.next() * (attack.feintTicks + 1));
  s.attackSerial++;
  s.intent = null;
  s.travelPerTick = 0;
  if (attack.cooldownTicks > 0) s.cooldowns[attack.id] = attack.cooldownTicks;
  return attack.parryable ? StalkerEvent.TelegraphParryable : StalkerEvent.TelegraphPerilous;
}

function beginTravel(s: StalkerState, a: EnemyAttack): void {
  const ticks = a.travelLeadTicks + a.activeTicks;
  if (ticks <= 0) return;
  let distance: number;
  if (a.travel === 'to-target') {
    const dx = s.aimX - s.x;
    const dz = s.aimZ - s.z;
    distance = Math.hypot(dx, dz);
    if (distance < 1e-3) return;
    s.travelDirX = dx / distance;
    s.travelDirZ = dz / distance;
    s.yaw = yawFromDirection(dx, dz);
  } else {
    distance = a.travel;
    s.travelDirX = -Math.sin(s.yaw);
    s.travelDirZ = -Math.cos(s.yaw);
  }
  s.travelPerTick = distance / ticks;
}
