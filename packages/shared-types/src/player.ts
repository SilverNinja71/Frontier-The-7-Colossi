import type { Equipment } from './items.ts';
import type { WorldMarkId } from './marks.ts';
import type { SkillProgress } from './skills.ts';
import type { StatBlock } from './stats.ts';
import type { ZoneId } from './world.ts';

/** Numeric so it packs into a single uint8 in Colyseus schema. */
export const CharacterAction = {
  Free: 0,
  Dodge: 1,
  Attack: 2,
  Stagger: 3,
  Dead: 4,
} as const;
export type CharacterActionId = (typeof CharacterAction)[keyof typeof CharacterAction];

/** Persistent character record (PostgreSQL). Never trusted from the client. */
export interface PlayerProfile {
  id: string;
  displayName: string;
  level: number;
  baseStats: StatBlock;
  equipment: Equipment;
  skills: readonly SkillProgress[];
  marks: readonly WorldMarkId[];
  titles: readonly string[];
  unlockedScenarios: readonly string[];
  cosmetics: readonly string[];
  /** Cosmetic-only currency (ads / battle pass). Cannot buy stats. */
  doubloons: number;
  lastZoneId: ZoneId;
}
