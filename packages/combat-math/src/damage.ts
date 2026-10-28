import type { Hurtbox } from '@frontier/shared-types';
import { clamp01, type CombatStats } from './stats.ts';

/** Defense softens damage hyperbolically: 100 defense halves it, 300 quarters it. */
export const DEFENSE_CONSTANT = 100;

export interface DamageInput {
  attacker: CombatStats;
  defender: Pick<CombatStats, 'defense'>;
  /** Per-move scalar from frame data. */
  motionValue: number;
  hurtbox: Pick<Hurtbox, 'kind' | 'damageMultiplier' | 'critBonus'>;
  /** Uniform [0, 1) from DeterministicRng; injected so the formula stays pure. */
  critRoll: number;
}

export interface DamageResult {
  amount: number;
  isCritical: boolean;
  isWeakPoint: boolean;
}

/** Only +, ×, ÷ and Math.round on the hot path, which are exact across JS engines. */
export function computeDamage(input: DamageInput): DamageResult {
  const { attacker, defender, motionValue, hurtbox, critRoll } = input;
  const mitigation = DEFENSE_CONSTANT / (DEFENSE_CONSTANT + Math.max(0, defender.defense));
  const critChance = clamp01(attacker.critChance + hurtbox.critBonus);
  const isCritical = critRoll < critChance;
  const critMultiplier = isCritical ? 1 + attacker.critDamage : 1;
  const raw = attacker.attack * motionValue * mitigation * hurtbox.damageMultiplier * critMultiplier;
  return {
    amount: Math.max(1, Math.round(raw)),
    isCritical,
    isWeakPoint: hurtbox.kind === 'weakpoint',
  };
}
