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
  stalkerAttackResolved,
  testMeleeHit,
  type DamageResult,
  type MeleeHit,
  type MotorTuning,
  type Moveset,
  type StalkerHit,
} from '@frontier/combat-math';
import type { GroundPose, Hurtbox, SkillDefinition, SkillProgress, StatBlock } from '@frontier/shared-types';
import { PLAYER_HURTBOXES } from '../data/sandbox.ts';
import type { GameEvents } from '../engine/events.ts';
import type { PlayerCharacter } from '../engine/PlayerCharacter.ts';
import type { ShadowStalker } from './ShadowStalker.ts';

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
  #lastEnemySerial = -1;
  #evolutionAnnounced = false;

  constructor(
    private readonly player: PlayerCharacter,
    private readonly moveset: Moveset,
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

  /** The Stalker's live hitbox this tick, if any, against the player. */
  resolveEnemyHit(stalker: ShadowStalker, hit: StalkerHit | null, attackerStats: StatBlock): void {
    if (!hit || hit.serial === this.#lastEnemySerial || this.player.dead) return;
    const pose = this.player.pose();
    if (!testMeleeHit(hit.pose, hit.attack, pose, PLAYER_HURTBOXES)) return;
    this.#lastEnemySerial = hit.serial;
    if (this.player.spawnProtected) return;

    const motor = this.player.motor;
    const outcome = resolveIncomingAttack(motor, this.tuning, {
      parryable: hit.attack.parryable,
      deflectTicks: hit.attack.deflectTicks,
      fromX: stalker.pose.x - pose.x,
      fromZ: stalker.pose.z - pose.z,
    });
    const contact = { x: (pose.x * 2 + stalker.pose.x) / 3, y: pose.y + 1.3, z: (pose.z * 2 + stalker.pose.z) / 3 };
    const { resolveDamage, events } = stalkerAttackResolved(stalker.brain, outcome);

    switch (outcome) {
      case 'parried':
        applyParrySuccess(motor, this.tuning);
        incrementCounter(this.skill, 'perfectParries');
        this.events.emit('parry', { ...contact, chain: stalker.brain.parryChain, resolveDamage });
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
          if (this.player.dead) this.events.emit('toast', { text: 'Knocked out — respawning', tone: 'danger' });
        }
        break;
      }
    }
    if (events) this.events.emit('stalker', { flags: events });
  }

  #enemyDamage(hit: StalkerHit, attackerStats: StatBlock): number {
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
