import type {
  SkillCounter,
  SkillDefinition,
  SkillEvolutionRequirement,
  SkillId,
  SkillProgress,
} from '@frontier/shared-types';

export function xpToNextLevel(def: SkillDefinition, level: number): number {
  return Math.round(def.xpCurve.base * def.xpCurve.growth ** (level - 1));
}

/** Mutates progress; returns levels gained. Skills level through use, not skill points. */
export function grantSkillXp(progress: SkillProgress, def: SkillDefinition, xp: number): number {
  let gained = 0;
  progress.xp += xp;
  while (progress.level < def.maxLevel && progress.xp >= xpToNextLevel(def, progress.level)) {
    progress.xp -= xpToNextLevel(def, progress.level);
    progress.level++;
    gained++;
  }
  if (progress.level >= def.maxLevel) progress.xp = 0;
  return gained;
}

export function incrementCounter(progress: SkillProgress, counter: SkillCounter, by = 1): void {
  progress.counters[counter] = (progress.counters[counter] ?? 0) + by;
}

export function meetsRequirement(
  progress: SkillProgress,
  requirement: SkillEvolutionRequirement,
  titles: readonly string[],
): boolean {
  switch (requirement.kind) {
    case 'counter':
      return (progress.counters[requirement.counter] ?? 0) >= requirement.atLeast;
    case 'level':
      return progress.level >= requirement.atLeast;
    case 'title':
      return titles.includes(requirement.titleId);
  }
}

/** First evolution whose requirements are all met, e.g. Critical Strike → Spiral Slash. */
export function findEvolution(
  progress: SkillProgress,
  def: SkillDefinition,
  titles: readonly string[] = [],
): SkillId | null {
  for (const evolution of def.evolutions) {
    if (evolution.requirements.every((req) => meetsRequirement(progress, req, titles))) return evolution.into;
  }
  return null;
}
