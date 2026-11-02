import type { GroundPose, Hurtbox } from '@frontier/shared-types';
import type { DefenseOutcome } from './motor.ts';
import { turnToward, yawFromDirection } from './motor.ts';
import type { DeterministicRng } from './rng.ts';
import type { EnemyAttack } from './shadow-stalker.ts';

/**
 * The Gluttonous Serpent — gate guardian of the Bramble Primeval. A thirty-metre constrictor
 * coiled in the Gullet in front of the Thornpass Gate. Unlike the Shadow Stalker it bleeds
 * normally, but its scales shrug off most of a blade (body ×0.5): the fight is won at the
 * head. Parry its Fang Lunge to stun the head (×2 damage), stay off the tail, keep out of the
 * acid, and never stand in front of it when it starts to inhale.
 *
 * Pure and deterministic (seeded RNG, fixed ticks) so the server can run the same brain.
 * The head moves freely; the body follows the head's path, so the coils stay where it has been.
 */

export type SerpentAttackKind = 'bite' | 'tail' | 'spit' | 'devour';

export interface SerpentAttack extends EnemyAttack {
  kind: SerpentAttackKind;
}

const attack = (a: Omit<SerpentAttack, 'heightMin' | 'heightMax' | 'travelLeadTicks' | 'commitTicks' | 'feintTicks'> & Partial<SerpentAttack>): SerpentAttack => ({
  heightMin: 0,
  heightMax: 2.4,
  travelLeadTicks: 0,
  commitTicks: 0,
  feintTicks: 0,
  ...a,
});

export const SERPENT_ATTACKS: Readonly<Record<string, SerpentAttack>> = {
  'fang-lunge': attack({
    id: 'fang-lunge',
    name: 'Fang Lunge',
    kind: 'bite',
    windupTicks: 15,
    feintTicks: 8,
    activeTicks: 4,
    recoveryTicks: 16,
    parryable: true,
    motionValue: 1.5,
    origin: 'self',
    reach: 3.4,
    arcDegrees: 70,
    travel: 5,
    travelLeadTicks: 4,
    deflectTicks: 5,
    commitTicks: 5,
    minRange: 2.5,
    maxRange: 9.5,
    cooldownTicks: 30,
    weight: 4,
    staggerTicks: 18,
    recoilOnParry: true,
  }),
  // Frenzy only: the second bite comes before you have finished breathing out.
  'fang-lunge-2': attack({
    id: 'fang-lunge-2',
    name: 'Fang Lunge',
    kind: 'bite',
    windupTicks: 9,
    feintTicks: 4,
    activeTicks: 4,
    recoveryTicks: 18,
    parryable: true,
    motionValue: 1.4,
    origin: 'self',
    reach: 3.4,
    arcDegrees: 70,
    travel: 4,
    travelLeadTicks: 3,
    deflectTicks: 5,
    commitTicks: 4,
    minRange: 0,
    maxRange: 12,
    cooldownTicks: 0,
    weight: 0,
    staggerTicks: 18,
    recoilOnParry: true,
  }),
  'tail-scythe': attack({
    id: 'tail-scythe',
    name: 'Tail Scythe',
    kind: 'tail',
    windupTicks: 24,
    feintTicks: 6,
    activeTicks: 5,
    recoveryTicks: 18,
    parryable: false,
    motionValue: 1.3,
    origin: 'self',
    reach: 5.2,
    arcDegrees: 360,
    travel: 0,
    deflectTicks: 0,
    minRange: 0,
    maxRange: 6,
    cooldownTicks: 120,
    weight: 3,
    staggerTicks: 26,
  }),
  'bile-spit': attack({
    id: 'bile-spit',
    name: 'Bile Spit',
    kind: 'spit',
    windupTicks: 18,
    activeTicks: 3,
    recoveryTicks: 14,
    parryable: false,
    motionValue: 0.7,
    origin: 'target',
    reach: 2,
    arcDegrees: 360,
    travel: 0,
    deflectTicks: 0,
    commitTicks: 6,
    minRange: 6,
    maxRange: 18,
    cooldownTicks: 150,
    weight: 2.5,
    staggerTicks: 10,
  }),
  devour: attack({
    id: 'devour',
    name: 'Devour',
    kind: 'devour',
    windupTicks: 22,
    activeTicks: 50,
    recoveryTicks: 26,
    parryable: false,
    motionValue: 0,
    origin: 'self',
    reach: 13,
    arcDegrees: 70,
    travel: 0,
    deflectTicks: 0,
    minRange: 3,
    maxRange: 14,
    cooldownTicks: 300,
    weight: 2,
    staggerTicks: 0,
  }),
};

export const SERPENT_TUNING = {
  maxHp: 8000,
  segments: 26,
  /** Metres between body segments along the path. */
  spacing: 0.95,
  headRadius: 1.15,
  /** Body radius at the neck; it tapers towards the tail. */
  neckRadius: 0.95,
  tailRadius: 0.35,
  speed: 3.6,
  frenzySpeed: 5.0,
  turnRate: 1.9,
  frenzyTurnRate: 2.6,
  /** It circles its prey at about this distance between attacks. */
  orbit: 7,
  hesitationTicks: 26,
  frenzyHesitationTicks: 14,
  frenzyWindupScale: 0.8,
  /** Below this share of HP it enters Frenzy. */
  frenzyAt: 0.5,
  headStunTicks: 75,
  /** Extra damage to the head while it is stunned (stacks with the head's own multiplier). */
  stunnedHeadMultiplier: 2,
  risingTicks: 60,
  retreatTicks: 60,
  /** The prey left the Gullet for this long: it burrows back and heals. */
  leashTicks: 90,
  leashMargin: 10,
  devourPull: 4.4,
  swallowRange: 2.3,
  /** Share of its max HP regained by swallowing. */
  swallowHeal: 0.04,
  spitTicks: 8,
  spitSpeed: 9,
  poolRadius: 2.1,
  poolTicks: 180,
  /** Acid burns every this many ticks while the prey stands in it. */
  acidEveryTicks: 15,
  /** Prey is pushed out of the coils with this much clearance. */
  bodyPad: 0.45,
} as const;

export const SerpentPhase = {
  Dormant: 0,
  Rising: 1,
  Hunt: 2,
  Attack: 3,
  Stunned: 4,
  Retreating: 5,
  Slain: 6,
} as const;
export type SerpentPhaseId = (typeof SerpentPhase)[keyof typeof SerpentPhase];

export const SerpentEvent = {
  Awoke: 1 << 0,
  TelegraphParryable: 1 << 1,
  TelegraphPerilous: 1 << 2,
  HeadStunned: 1 << 3,
  Frenzy: 1 << 4,
  Swallowed: 1 << 5,
  Slain: 1 << 6,
  Spat: 1 << 7,
  Retreated: 1 << 8,
  Inhale: 1 << 9,
} as const;

export interface AcidPool {
  x: number;
  z: number;
  ticks: number;
}

export interface SerpentState {
  phase: SerpentPhaseId;
  phaseTick: number;
  /** Head position, heading and the arena floor height. */
  x: number;
  z: number;
  y: number;
  yaw: number;
  /** Lair centre and leash radius. */
  homeX: number;
  homeZ: number;
  arenaRadius: number;
  /** Head path, newest first: x0, z0, x1, z1, … spaced about TRAIL_STEP apart. */
  trail: number[];
  hp: number;
  frenzy: boolean;
  attack: SerpentAttack | null;
  windupTicks: number;
  attackSerial: number;
  aimX: number;
  aimZ: number;
  travelPerTick: number;
  cooldowns: Record<string, number>;
  idleTicks: number;
  circleDir: 1 | -1;
  pools: AcidPool[];
  spitTicks: number;
  outsideTicks: number;
  ticks: number;
}

export interface SerpentContext {
  target: GroundPose;
  targetAlive: boolean;
  /** Mid-dodge: a roll at the last moment slips out of its jaws. */
  targetInvulnerable: boolean;
  rng: DeterministicRng;
  dt: number;
}

export interface SerpentStepResult {
  events: number;
  /** Live melee hitbox this tick (bite, tail, bile impact), for the shared hit resolution. */
  hit: { attack: SerpentAttack; serial: number; pose: GroundPose } | null;
  /** Metres to move the prey this tick (devour pull, spit-out, pushed off the coils). */
  shoveX: number;
  shoveZ: number;
  /** The prey stood in acid on a burn tick. */
  acid: boolean;
}

const TRAIL_STEP = 0.32;
const TRAIL_LENGTH = Math.ceil((SERPENT_TUNING.segments * SERPENT_TUNING.spacing) / TRAIL_STEP) + 4;

export function createSerpentState(homeX: number, homeZ: number, y: number, arenaRadius: number): SerpentState {
  const s: SerpentState = {
    phase: SerpentPhase.Dormant,
    phaseTick: 0,
    x: homeX,
    z: homeZ,
    y,
    yaw: 0,
    homeX,
    homeZ,
    arenaRadius,
    trail: [],
    hp: SERPENT_TUNING.maxHp,
    frenzy: false,
    attack: null,
    windupTicks: 0,
    attackSerial: 0,
    aimX: 0,
    aimZ: 0,
    travelPerTick: 0,
    cooldowns: {},
    idleTicks: 0,
    circleDir: 1,
    pools: [],
    spitTicks: 0,
    outsideTicks: 0,
    ticks: 0,
  };
  coil(s);
  return s;
}

/** Lay the body in a resting spiral around the head. */
function coil(s: SerpentState): void {
  s.trail = [];
  for (let i = 0; i < TRAIL_LENGTH; i++) {
    const d = i * TRAIL_STEP;
    const angle = s.yaw + Math.PI + d / 3.2;
    const radius = 1.4 + d * 0.13;
    s.trail.push(s.homeX + Math.sin(angle) * radius * (i ? 1 : 0), s.homeZ + Math.cos(angle) * radius * (i ? 1 : 0));
  }
  s.x = s.trail[0]!;
  s.z = s.trail[1]!;
}

export function serpentActive(s: SerpentState): boolean {
  return s.phase !== SerpentPhase.Dormant && s.phase !== SerpentPhase.Slain;
}

/** Can blades reach it (it is above ground and alive)? */
export function serpentTargetable(s: SerpentState): boolean {
  return s.phase === SerpentPhase.Hunt || s.phase === SerpentPhase.Attack || s.phase === SerpentPhase.Stunned;
}

/** Prey entered the Gullet: it rises from the gravel, facing them. */
export function wakeSerpent(s: SerpentState, target: GroundPose): number {
  if (s.phase !== SerpentPhase.Dormant) return 0;
  s.yaw = yawFromDirection(target.x - s.homeX, target.z - s.homeZ);
  coil(s);
  setPhase(s, SerpentPhase.Rising);
  return SerpentEvent.Awoke;
}

/** Back to full strength and asleep (a new day, or after it was slain). */
export function reviveSerpent(s: SerpentState): void {
  const fresh = createSerpentState(s.homeX, s.homeZ, s.y, s.arenaRadius);
  Object.assign(s, fresh, { attackSerial: s.attackSerial });
}

export function stepSerpent(s: SerpentState, ctx: SerpentContext): SerpentStepResult {
  const T = SERPENT_TUNING;
  const result: SerpentStepResult = { events: 0, hit: null, shoveX: 0, shoveZ: 0, acid: false };
  s.ticks++;
  s.phaseTick++;
  for (const id of Object.keys(s.cooldowns)) if (s.cooldowns[id]! > 0) s.cooldowns[id] = s.cooldowns[id]! - 1;
  for (const pool of s.pools) pool.ticks--;
  s.pools = s.pools.filter((p) => p.ticks > 0);

  if (s.phase === SerpentPhase.Dormant || s.phase === SerpentPhase.Slain) return result;

  const target = ctx.target;
  const dx = target.x - s.x;
  const dz = target.z - s.z;
  const distance = Math.hypot(dx, dz);

  // Leash: prey gone (dead or fled the Gullet) → burrow and heal.
  const fromHome = Math.hypot(target.x - s.homeX, target.z - s.homeZ);
  s.outsideTicks = !ctx.targetAlive || fromHome > s.arenaRadius + T.leashMargin ? s.outsideTicks + 1 : 0;
  if (s.phase !== SerpentPhase.Retreating && (s.outsideTicks > T.leashTicks || (!ctx.targetAlive && s.outsideTicks > 30))) {
    s.attack = null;
    setPhase(s, SerpentPhase.Retreating);
  }

  switch (s.phase) {
    case SerpentPhase.Rising:
      if (s.phaseTick >= T.risingTicks) setPhase(s, SerpentPhase.Hunt);
      break;
    case SerpentPhase.Retreating:
      if (s.phaseTick >= T.retreatTicks) {
        reviveSerpent(s);
        result.events |= SerpentEvent.Retreated;
      }
      return result;
    case SerpentPhase.Stunned:
      if (s.phaseTick >= T.headStunTicks) setPhase(s, SerpentPhase.Hunt);
      break;
    case SerpentPhase.Hunt:
      hunt(s, ctx, dx, dz, distance);
      if (++s.idleTicks > (s.frenzy ? T.frenzyHesitationTicks : T.hesitationTicks) && ctx.targetAlive) {
        const next = chooseAttack(s, target, distance, ctx.rng);
        if (next) result.events |= startAttack(s, next, ctx.rng);
      }
      break;
    case SerpentPhase.Attack:
      attackTick(s, ctx, dx, dz, distance, result);
      break;
  }

  // Spat-out prey flies clear of the jaws.
  if (s.spitTicks > 0) {
    s.spitTicks--;
    result.shoveX += -Math.sin(s.yaw) * T.spitSpeed * ctx.dt;
    result.shoveZ += -Math.cos(s.yaw) * T.spitSpeed * ctx.dt;
  }

  // Acid underfoot.
  if (s.ticks % T.acidEveryTicks === 0 && ctx.targetAlive) {
    result.acid = s.pools.some((p) => Math.hypot(target.x - p.x, target.z - p.z) < T.poolRadius);
  }

  // Coils are solid: push the prey out of the body (not while it is inhaling them).
  const inhaling = s.attack?.kind === 'devour' && s.phaseTick >= s.windupTicks;
  if (serpentTargetable(s) && s.spitTicks === 0 && !inhaling) pushOut(s, target, result);
  return result;
}

function setPhase(s: SerpentState, phase: SerpentPhaseId): void {
  s.phase = phase;
  s.phaseTick = 0;
  if (phase === SerpentPhase.Hunt) s.idleTicks = 0;
}

function hunt(s: SerpentState, ctx: SerpentContext, dx: number, dz: number, distance: number): void {
  const T = SERPENT_TUNING;
  // Circle at orbit range; close in when far. Stay inside the Gullet.
  let wantX = dx;
  let wantZ = dz;
  if (distance < T.orbit + 3 && distance > 1e-3) {
    wantX = dx / distance + (-dz / distance) * s.circleDir * 1.4;
    wantZ = dz / distance + (dx / distance) * s.circleDir * 1.4;
    if (distance < T.orbit - 2) {
      wantX -= dx / distance;
      wantZ -= dz / distance;
    }
  }
  const homeDx = s.homeX - s.x;
  const homeDz = s.homeZ - s.z;
  const fromHome = Math.hypot(homeDx, homeDz);
  const edge = Math.max(0, (fromHome - (s.arenaRadius - 5)) / 4);
  if (edge > 0) {
    wantX = wantX * (1 - Math.min(1, edge)) + (homeDx / fromHome) * Math.min(1, edge) * 2;
    wantZ = wantZ * (1 - Math.min(1, edge)) + (homeDz / fromHome) * Math.min(1, edge) * 2;
  }
  if (s.ticks % 240 === 0 && ctx.rng.next() < 0.5) s.circleDir = s.circleDir === 1 ? -1 : 1;
  const turn = (s.frenzy ? T.frenzyTurnRate : T.turnRate) * ctx.dt;
  s.yaw = turnToward(s.yaw, yawFromDirection(wantX, wantZ), turn);
  const speed = s.frenzy ? T.frenzySpeed : T.speed;
  moveHead(s, -Math.sin(s.yaw) * speed * ctx.dt, -Math.cos(s.yaw) * speed * ctx.dt);
}

function chooseAttack(s: SerpentState, target: GroundPose, distance: number, rng: DeterministicRng): SerpentAttack | null {
  const tail = segmentPosition(s, SERPENT_TUNING.segments - 1);
  const tailDistance = Math.hypot(target.x - tail.x, target.z - tail.z);
  const facing = Math.cos(yawFromDirection(target.x - s.x, target.z - s.z) - s.yaw);
  const options: SerpentAttack[] = [];
  for (const a of Object.values(SERPENT_ATTACKS)) {
    if (a.weight <= 0 || (s.cooldowns[a.id] ?? 0) > 0) continue;
    const d = a.kind === 'tail' ? tailDistance : distance;
    if (d < a.minRange || d > a.maxRange) continue;
    if ((a.kind === 'bite' || a.kind === 'devour') && facing < 0.2) continue;
    options.push(a);
  }
  if (!options.length) return null;
  let roll = rng.next() * options.reduce((sum, a) => sum + a.weight, 0);
  for (const a of options) {
    roll -= a.weight;
    if (roll <= 0) return a;
  }
  return options[options.length - 1]!;
}

function startAttack(s: SerpentState, a: SerpentAttack, rng: DeterministicRng): number {
  s.attack = a;
  s.attackSerial++;
  const scale = s.frenzy ? SERPENT_TUNING.frenzyWindupScale : 1;
  s.windupTicks = Math.round((a.windupTicks + Math.floor(rng.next() * (a.feintTicks + 1))) * scale);
  s.cooldowns[a.id] = a.cooldownTicks;
  setPhase(s, SerpentPhase.Attack);
  return a.parryable ? SerpentEvent.TelegraphParryable : SerpentEvent.TelegraphPerilous;
}

function attackTick(s: SerpentState, ctx: SerpentContext, dx: number, dz: number, distance: number, result: SerpentStepResult): void {
  const T = SERPENT_TUNING;
  const a = s.attack!;
  const t = s.phaseTick;
  const windup = s.windupTicks;

  // Track the prey until committing.
  if (t < windup - a.commitTicks) {
    if (a.kind !== 'tail') s.yaw = turnToward(s.yaw, yawFromDirection(dx, dz), 2.6 * ctx.dt);
    s.aimX = ctx.target.x;
    s.aimZ = ctx.target.z;
  }
  if (a.kind === 'devour' && t === windup) result.events |= SerpentEvent.Inhale;

  // Bite: the head launches forward.
  if (a.kind === 'bite' && typeof a.travel === 'number') {
    const start = windup - a.travelLeadTicks;
    if (t === start) s.travelPerTick = a.travel / (a.travelLeadTicks + a.activeTicks);
    if (t >= start && t < windup + a.activeTicks) moveHead(s, -Math.sin(s.yaw) * s.travelPerTick, -Math.cos(s.yaw) * s.travelPerTick);
  }

  if (t >= windup && t < windup + a.activeTicks) {
    if (a.kind === 'bite') {
      result.hit = { attack: a, serial: s.attackSerial, pose: { x: s.x, y: s.y, z: s.z, yaw: s.yaw } };
    } else if (a.kind === 'tail') {
      const tail = segmentPosition(s, T.segments - 1);
      result.hit = { attack: a, serial: s.attackSerial, pose: { x: tail.x, y: s.y, z: tail.z, yaw: s.yaw } };
    } else if (a.kind === 'spit') {
      if (t === windup) {
        s.pools.push({ x: s.aimX, z: s.aimZ, ticks: T.poolTicks });
        if (s.frenzy) {
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + s.ticks;
            s.pools.push({ x: s.aimX + Math.sin(angle) * 3.2, z: s.aimZ + Math.cos(angle) * 3.2, ticks: T.poolTicks });
          }
        }
        result.events |= SerpentEvent.Spat;
      }
      result.hit = { attack: a, serial: s.attackSerial, pose: { x: s.aimX, y: s.y, z: s.aimZ, yaw: 0 } };
    } else if (a.kind === 'devour' && ctx.targetAlive) {
      // Inhale: drag the prey in; at the jaws, swallow it whole.
      const facing = distance > 1e-3 ? (-Math.sin(s.yaw) * dx - Math.cos(s.yaw) * dz) / distance : 1;
      const inCone = distance <= a.reach && facing >= Math.cos((a.arcDegrees * Math.PI) / 360);
      if (inCone && distance > 1e-3) {
        const pull = T.devourPull * ctx.dt * (1.3 - 0.6 * (distance / a.reach));
        result.shoveX -= (dx / distance) * pull;
        result.shoveZ -= (dz / distance) * pull;
      }
      if (inCone && distance < T.swallowRange && !ctx.targetInvulnerable) {
        s.hp = Math.min(T.maxHp, s.hp + T.maxHp * T.swallowHeal);
        s.spitTicks = T.spitTicks;
        result.events |= SerpentEvent.Swallowed;
        s.phaseTick = windup + a.activeTicks; // straight into recovery
      }
    }
  }

  if (s.phaseTick >= windup + a.activeTicks + a.recoveryTicks) {
    const chain = s.frenzy && a.id === 'fang-lunge' ? SERPENT_ATTACKS['fang-lunge-2'] : undefined;
    s.attack = null;
    if (chain && ctx.targetAlive) result.events |= startAttack(s, chain, ctx.rng);
    else setPhase(s, SerpentPhase.Hunt);
  }
}

/** Report how a blow it threw was met. A parried Fang Lunge stuns the head. */
export function serpentAttackResolved(s: SerpentState, outcome: DefenseOutcome): number {
  if (outcome !== 'parried' || !s.attack?.recoilOnParry) return 0;
  s.attack = null;
  // Recoil: the head is knocked back a little.
  moveHead(s, Math.sin(s.yaw) * 1.2, Math.cos(s.yaw) * 1.2);
  setPhase(s, SerpentPhase.Stunned);
  return SerpentEvent.HeadStunned;
}

/** Damage from the prey. Returns what was removed and any events (Frenzy, Slain). */
export function serpentStruck(s: SerpentState, hurtboxKind: 'body' | 'weakpoint', damage: number): { applied: number; events: number } {
  if (!serpentTargetable(s)) return { applied: 0, events: 0 };
  const T = SERPENT_TUNING;
  const applied = Math.round(hurtboxKind === 'weakpoint' && s.phase === SerpentPhase.Stunned ? damage * T.stunnedHeadMultiplier : damage);
  s.hp = Math.max(0, s.hp - applied);
  let events = 0;
  if (!s.frenzy && s.hp <= T.maxHp * T.frenzyAt) {
    s.frenzy = true;
    events |= SerpentEvent.Frenzy;
  }
  if (s.hp === 0) {
    s.attack = null;
    s.pools = [];
    setPhase(s, SerpentPhase.Slain);
    events |= SerpentEvent.Slain;
  }
  return { applied, events };
}

// --- Body ------------------------------------------------------------------------------

function moveHead(s: SerpentState, mx: number, mz: number): void {
  s.x += mx;
  s.z += mz;
  // Record the path: insert points every TRAIL_STEP so the body can follow it.
  let lastX = s.trail[0]!;
  let lastZ = s.trail[1]!;
  let gap = Math.hypot(s.x - lastX, s.z - lastZ);
  while (gap >= TRAIL_STEP) {
    const k = TRAIL_STEP / gap;
    lastX += (s.x - lastX) * k;
    lastZ += (s.z - lastZ) * k;
    s.trail.unshift(lastX, lastZ);
    gap = Math.hypot(s.x - lastX, s.z - lastZ);
  }
  if (s.trail.length > TRAIL_LENGTH * 2) s.trail.length = TRAIL_LENGTH * 2;
}

/** Position of body segment `i` (0 = just behind the head), following the head's path. */
export function segmentPosition(s: SerpentState, i: number, out = { x: 0, z: 0 }): { x: number; z: number } {
  let remaining = (i + 1) * SERPENT_TUNING.spacing;
  let px = s.x;
  let pz = s.z;
  for (let k = 0; k < s.trail.length; k += 2) {
    const qx = s.trail[k]!;
    const qz = s.trail[k + 1]!;
    const d = Math.hypot(qx - px, qz - pz);
    if (d >= remaining && d > 1e-6) {
      out.x = px + ((qx - px) * remaining) / d;
      out.z = pz + ((qz - pz) * remaining) / d;
      return out;
    }
    remaining -= d;
    px = qx;
    pz = qz;
  }
  out.x = px;
  out.z = pz;
  return out;
}

export function segmentRadius(i: number): number {
  const T = SERPENT_TUNING;
  const t = i / (T.segments - 1);
  // A slight bulge behind the neck (it has eaten well), tapering to the tail.
  const bulge = Math.sin(Math.min(1, t * 2.2) * Math.PI) * 0.18;
  return T.neckRadius + bulge + (T.tailRadius - T.neckRadius) * t * t;
}

function pushOut(s: SerpentState, target: GroundPose, result: SerpentStepResult): void {
  const T = SERPENT_TUNING;
  const p = { x: 0, z: 0 };
  let sx = 0;
  let sz = 0;
  const check = (cx: number, cz: number, radius: number) => {
    const ox = target.x + result.shoveX - cx;
    const oz = target.z + result.shoveZ - cz;
    const d = Math.hypot(ox, oz);
    const min = radius + T.bodyPad;
    if (d < min && d > 1e-4) {
      sx += (ox / d) * (min - d);
      sz += (oz / d) * (min - d);
    }
  };
  check(s.x, s.z, T.headRadius);
  for (let i = 0; i < T.segments; i += 1) {
    segmentPosition(s, i, p);
    check(p.x, p.z, segmentRadius(i));
  }
  const length = Math.hypot(sx, sz);
  const max = 0.35;
  if (length > max) {
    sx = (sx / length) * max;
    sz = (sz / length) * max;
  }
  result.shoveX += sx;
  result.shoveZ += sz;
}

/**
 * World-space hurtboxes (use with an identity target pose): the head is the weak point, the
 * armoured body takes half damage. Written into `out` to avoid allocation.
 */
export function serpentHurtboxes(s: SerpentState, out: Hurtbox[]): Hurtbox[] {
  const T = SERPENT_TUNING;
  out.length = 0;
  out.push({
    id: 'head',
    kind: 'weakpoint',
    offset: { x: s.x, y: s.y + 1.1, z: s.z },
    radius: T.headRadius,
    damageMultiplier: 1.5,
    critBonus: 0.25,
  });
  const p = { x: 0, z: 0 };
  for (let i = 1; i < T.segments; i += 2) {
    segmentPosition(s, i, p);
    const r = segmentRadius(i);
    out.push({ id: `body-${i}`, kind: 'body', offset: { x: p.x, y: s.y + r, z: p.z }, radius: r + 0.15, damageMultiplier: 0.5, critBonus: 0 });
  }
  return out;
}
