import {
  activeAttackStep,
  applyGuard,
  applyParrySuccess,
  computeDamage,
  deriveCombatStats,
  DeterministicRng,
  findEvolution,
  grantSkillXp,
  incrementCounter,
  resolveIncomingAttack,
  testMeleeHit,
  type DamageResult,
  type DefenseOutcome,
  type EnemyHit,
  type MeleeHit,
  type MotorTuning,
  type Moveset,
} from '@frontier/combat-math';
import { CharacterAction, SIM_DT } from '@frontier/shared-types';
import type { GroundPose, Hurtbox, SkillDefinition, SkillProgress, StatBlock } from '@frontier/shared-types';
import { PLAYER_HURTBOXES } from '../data/sandbox.ts';
import type { GameEvents } from '../engine/events.ts';
import type { PlayerCharacter } from '../engine/PlayerCharacter.ts';

/** Anything that throws EnemyHits at the player (the Stalker, the dummy's parry drill). */
export interface EnemySource {
  readonly id: string;
  readonly pose: GroundPose;
}

const TICK_MS = Math.round(SIM_DT * 1000);
/** A parry pressed this many ticks after an unparried blow still gets LATE feedback. */
const LATE_FEEDBACK_TICKS = 10;
/** A blow landing this long after a parry press reads as an EARLY press. */
const EARLY_FEEDBACK_TICKS = 24;

export interface HitReceipt {
  /** Damage (or colossus resolve) actually removed. */
  applied: number;
  /** The blow landed but did nothing (colossus not exposed). */
  immune: boolean;
  /** Target was depleted and reset (training dummy). */
  reset: boolean;
  /** StalkerEvent flags raised by the hit, if any. */
  events: number;
}

export interface CombatTarget {
  readonly id: string;
  readonly pose: GroundPose;
  readonly hurtboxes: readonly Hurtbox[];
  readonly defense: number;
  readonly targetable: boolean;
  receiveHit(hit: MeleeHit, damage: DamageResult, impact: number, fromX: number, fromZ: number): HitReceipt;
}

const PRECISION_XP = 12;
const GUARD_DAMAGE_FACTOR = 0.5;

/**
 * Resolves blows both ways each sim tick: the player's swings against targets, and the
 * Shadow Stalker's attacks against the player's dodge / parry / guard. In Phase 2 this
 * code runs on the server; the client keeps it for instant feedback.
 */
export class CombatSystem {
  readonly skill: SkillProgress;
  readonly #rng = new DeterministicRng(0xf1257);
  /** attackSerial that last landed on each target — one hit per swing per target. */
  readonly #lastSerial = new Map<string, number>();
  readonly #lastEnemySerial = new Map<string, number>();
  #lastUnparried: { tick: number } | null = null;
  #evolutionAnnounced = false;

  constructor(
    private readonly player: PlayerCharacter,
    /** The equipped weapon's moveset; swapped by the game only while the player is free. */
    public moveset: Moveset,
    private readonly tuning: MotorTuning,
    private readonly targets: readonly CombatTarget[],
    private readonly events: GameEvents,
    private readonly skillDef: SkillDefinition,
  ) {
    this.skill = { skillId: skillDef.id, level: 1, xp: 0, counters: {} };
  }

  /** The player's swing this tick. */
  step(): void {
    const step = activeAttackStep(this.player.motor, this.moveset);
    if (!step) return;
    const serial = this.player.motor.attackSerial;
    const attacker = this.player.pose();

    for (const target of this.targets) {
      if (!target.targetable || this.#lastSerial.get(target.id) === serial) continue;
      const hit = testMeleeHit(attacker, step, target.pose, target.hurtboxes);
      if (!hit) continue;
      this.#lastSerial.set(target.id, serial);

      const damage = computeDamage({
        attacker: this.player.stats,
        defender: { defense: target.defense },
        motionValue: step.motionValue,
        hurtbox: hit.hurtbox,
        critRoll: this.#rng.next(),
      });
      const receipt = target.receiveHit(hit, damage, step.impact, attacker.x, attacker.z);

      if (!receipt.immune) {
        incrementCounter(this.skill, 'hits');
        if (damage.isWeakPoint && damage.isCritical) this.#precisionHit();
      }

      this.events.emit('hit', {
        targetId: target.id,
        amount: receipt.applied,
        immune: receipt.immune,
        isCritical: damage.isCritical,
        isWeakPoint: damage.isWeakPoint,
        comboStep: this.player.motor.comboStep,
        x: hit.pointX,
        y: hit.pointY,
        z: hit.pointZ,
      });
      if (receipt.events) this.events.emit('stalker', { flags: receipt.events });
      if (receipt.reset) this.events.emit('toast', { text: 'Dummy shattered — reset', tone: 'info' });
    }
  }

  /**
   * An enemy's live hitbox this tick, if any, against the player. Returns how the player met
   * it (once per attack instance), or null when nothing connected this tick.
   */
  resolveEnemyHit(source: EnemySource, hit: EnemyHit | null, attackerStats: StatBlock): DefenseOutcome | null {
    if (!hit || hit.serial === this.#lastEnemySerial.get(source.id) || this.player.dead) return null;
    const pose = this.player.pose();
    if (!testMeleeHit(hit.pose, hit.attack, pose, PLAYER_HURTBOXES)) return null;
    this.#lastEnemySerial.set(source.id, hit.serial);
    if (this.player.spawnProtected) return null;

    const motor = this.player.motor;
    const parryActive = motor.action === CharacterAction.Parry ? motor.actionTick : -1;
    const outcome = resolveIncomingAttack(motor, this.tuning, {
      parryable: hit.attack.parryable,
      deflectTicks: hit.attack.deflectTicks,
      fromX: source.pose.x - pose.x,
      fromZ: source.pose.z - pose.z,
    });
    if (hit.attack.parryable) this.#parryFeedback(outcome, hit, parryActive);
    const contact = { x: (pose.x * 2 + source.pose.x) / 3, y: pose.y + 1.3, z: (pose.z * 2 + source.pose.z) / 3 };

    switch (outcome) {
      case 'parried':
        applyParrySuccess(motor, this.tuning);
        incrementCounter(this.skill, 'perfectParries');
        this.events.emit('parry', { ...contact, sourceId: source.id });
        break;
      case 'dodged':
        this.events.emit('perfectDodge', { x: pose.x, y: pose.y + 1.2, z: pose.z });
        break;
      case 'guarded': {
        const amount = Math.max(1, Math.round(this.#enemyDamage(hit, attackerStats) * GUARD_DAMAGE_FACTOR));
        const broken = applyGuard(motor, this.tuning);
        this.player.applyDamage(amount);
        this.events.emit('guard', { ...contact, amount, broken });
        break;
      }
      case 'hit': {
        const amount = this.#enemyDamage(hit, attackerStats);
        if (this.player.takeDamage(amount, hit.attack.staggerTicks)) {
          this.events.emit('playerDamaged', { amount, staggered: !this.player.dead });
        }
        break;
      }
    }
    return outcome;
  }

  /** Call when the player starts a parry: a press just after a blow landed reads as LATE. */
  onParryStarted(): void {
    const last = this.#lastUnparried;
    if (!last) return;
    const late = this.player.tick - last.tick;
    if (late > 0 && late <= LATE_FEEDBACK_TICKS) this.events.emit('parryTiming', { kind: 'late', ms: late * TICK_MS });
    this.#lastUnparried = null;
  }

  /**
   * Teach the timing. A deflect lands only if the blow arrives within the first few ticks of
   * the parry stance: arriving later means the button went down too early.
   */
  #parryFeedback(outcome: DefenseOutcome, hit: EnemyHit, stanceTick: number): void {
    const window = Math.min(this.tuning.parry.perfectTicks, hit.attack.deflectTicks);
    const sincePress = this.player.tick - this.player.lastParryStartTick;
    this.#lastUnparried = null;
    if (outcome === 'parried') {
      this.events.emit('parryTiming', { kind: 'perfect', ms: sincePress * TICK_MS });
    } else if (outcome === 'guarded' || (outcome === 'hit' && sincePress < EARLY_FEEDBACK_TICKS && stanceTick < 0)) {
      this.events.emit('parryTiming', { kind: 'early', ms: (sincePress - window + 1) * TICK_MS });
    } else if (outcome === 'hit' && stanceTick >= 0 && stanceTick < window) {
      this.events.emit('parryTiming', { kind: 'angle', ms: 0 });
    } else if (outcome === 'hit') {
      this.#lastUnparried = { tick: this.player.tick };
    }
  }

  #enemyDamage(hit: EnemyHit, attackerStats: StatBlock): number {
    return computeDamage({
      attacker: deriveCombatStats(attackerStats),
      defender: this.player.stats,
      motionValue: hit.attack.motionValue,
      hurtbox: { kind: 'body', damageMultiplier: 1, critBonus: 0 },
      critRoll: 1,
    }).amount;
  }

  #precisionHit(): void {
    incrementCounter(this.skill, 'precisionHits');
    if (grantSkillXp(this.skill, this.skillDef, PRECISION_XP) > 0) {
      this.events.emit('toast', { text: `${this.skillDef.name} Lv.${this.skill.level}`, tone: 'gold' });
    }
    if (!this.#evolutionAnnounced && findEvolution(this.skill, this.skillDef)) {
      this.#evolutionAnnounced = true;
      this.events.emit('toast', { text: 'Skill evolution unlocked!', tone: 'gold' });
    }
  }
}
