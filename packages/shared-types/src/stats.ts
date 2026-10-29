import type { MoonPhase, TimeOfDay } from './world.ts';

export const STAT_IDS = [
  'maxHp',
  'maxStamina',
  'attack',
  'defense',
  'agility',
  /** 0..1 probability. */
  'critChance',
  /** Bonus multiplier on crit, e.g. 0.5 → crits deal 150%. */
  'critDamage',
  /** Multiplier on locomotion speed, 1 = baseline. */
  'moveSpeed',
] as const;

export type StatId = (typeof STAT_IDS)[number];
export type StatBlock = Record<StatId, number>;

/**
 * `flat` adds to the base value; `percent` scales the (base + flat) total.
 * final = (base + Σflat) × (1 + Σpercent)
 */
export type ModifierOp = 'flat' | 'percent';

/** Every present field must match for the modifier to apply. */
export interface ModifierCondition {
  timeOfDay?: readonly TimeOfDay[];
  moonPhase?: readonly MoonPhase[];
  /** Applies only in zones carrying at least one of these tags. */
  zoneTags?: readonly string[];
}

export interface StatModifier {
  stat: StatId;
  op: ModifierOp;
  value: number;
  condition?: ModifierCondition;
  /** Item, mark, skill or buff id — used for tooltips and the wiki. */
  source: string;
}
