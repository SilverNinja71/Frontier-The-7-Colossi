export type SkillId = string;

/** Usage counters tracked per skill; evolutions are gated on these. */
export type SkillCounter = 'uses' | 'hits' | 'precisionHits' | 'perfectDodges' | 'perfectParries' | 'kills';

export type SkillEvolutionRequirement =
  | { kind: 'counter'; counter: SkillCounter; atLeast: number }
  | { kind: 'level'; atLeast: number }
  | { kind: 'title'; titleId: string };

/** e.g. Critical Strike → Spiral Slash after 1,000 precision hits. */
export interface SkillEvolution {
  into: SkillId;
  requirements: readonly SkillEvolutionRequirement[];
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  kind: 'active' | 'passive';
  maxLevel: number;
  /** XP to go from level n to n+1 = base × growth^(n-1). Skills level through use. */
  xpCurve: { base: number; growth: number };
  staminaCost?: number;
  cooldownTicks?: number;
  evolutions: readonly SkillEvolution[];
}

export interface SkillProgress {
  skillId: SkillId;
  level: number;
  xp: number;
  counters: Partial<Record<SkillCounter, number>>;
}
