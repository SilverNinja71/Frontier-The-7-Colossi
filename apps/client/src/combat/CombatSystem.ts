import {
  activeAttackStep,
  computeDamage,
  DeterministicRng,
  findEvolution,
  grantSkillXp,
  incrementCounter,
  testMeleeHit,
  type MeleeHit,
  type Moveset,
} from '@frontier/combat-math';
import type { GroundPose, Hurtbox, SkillDefinition, SkillProgress } from '@frontier/shared-types';
import type { GameEvents } from '../engine/events.ts';
import type { PlayerCharacter } from '../engine/PlayerCharacter.ts';

export interface CombatTarget {
  readonly id: string;
  readonly pose: GroundPose;
  readonly hurtboxes: readonly Hurtbox[];
  readonly defense: number;
  /** Returns true when the target was depleted and reset. */
  receiveHit(hit: MeleeHit, amount: number, impact: number, fromX: number, fromZ: number): boolean;
}

const PRECISION_XP = 12;

/**
 * Resolves the local player's swings against targets each sim tick. In Phase 2 this exact
 * code runs on the server, and the client keeps it only for instant VFX while it waits for
 * HitConfirm packets.
 */
export class CombatSystem {
  readonly skill: SkillProgress;
  readonly #rng = new DeterministicRng(0xf1257);
  /** attackSerial that last landed on each target — one hit per swing per target. */
  readonly #lastSerial = new Map<string, number>();
  #evolutionAnnounced = false;

  constructor(
    private readonly player: PlayerCharacter,
    private readonly moveset: Moveset,
    private readonly targets: readonly CombatTarget[],
    private readonly events: GameEvents,
    private readonly skillDef: SkillDefinition,
  ) {
    this.skill = { skillId: skillDef.id, level: 1, xp: 0, counters: {} };
  }

  step(): void {
    const step = activeAttackStep(this.player.motor, this.moveset);
    if (!step) return;
    const serial = this.player.motor.attackSerial;
    const attacker = this.player.pose();

    for (const target of this.targets) {
      if (this.#lastSerial.get(target.id) === serial) continue;
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
      const reset = target.receiveHit(hit, damage.amount, step.impact, attacker.x, attacker.z);

      incrementCounter(this.skill, 'hits');
      if (damage.isWeakPoint && damage.isCritical) {
        incrementCounter(this.skill, 'precisionHits');
        if (grantSkillXp(this.skill, this.skillDef, PRECISION_XP) > 0) {
          this.events.emit('toast', { text: `${this.skillDef.name} Lv.${this.skill.level}`, tone: 'gold' });
        }
        const evolved = findEvolution(this.skill, this.skillDef);
        if (evolved && !this.#evolutionAnnounced) {
          this.#evolutionAnnounced = true;
          this.events.emit('toast', { text: 'Skill evolution unlocked!', tone: 'gold' });
        }
      }

      this.events.emit('hit', {
        targetId: target.id,
        amount: damage.amount,
        isCritical: damage.isCritical,
        isWeakPoint: damage.isWeakPoint,
        comboStep: this.player.motor.comboStep,
        x: hit.pointX,
        y: hit.pointY,
        z: hit.pointZ,
      });
      if (reset) this.events.emit('toast', { text: 'Dummy shattered — reset', tone: 'info' });
    }
  }
}
