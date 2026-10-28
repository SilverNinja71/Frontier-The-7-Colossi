export type ZoneId = string;
export type ScenarioId = string;

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type MoonPhase = 'new' | 'waxing' | 'full' | 'waning';

export type BiomeId =
  | 'plains'
  | 'mining-bastion'
  | 'overgrown-ruins'
  | 'mechanical-metropolis'
  | 'abyssal-coast'
  | 'sky-ruins'
  | 'ancient-forest'
  | 'nether-depths';

/** Environmental state that conditional modifiers (marks, buffs) and spawn rules read. */
export interface WorldConditions {
  timeOfDay: TimeOfDay;
  moonPhase: MoonPhase;
  zoneTags: readonly string[];
}

/**
 * A zone in the overworld graph. There is no global fast travel: players move between
 * zones only along `connections` (on foot / mount) or along hidden routes they have
 * personally unlocked through a Unique Scenario.
 */
export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  biome: BiomeId;
  /** Contiguous neighbours reachable by traversal. */
  connections: readonly ZoneId[];
  /** Secret subterranean warps; usable only by players who completed `unlockedBy`. */
  hiddenRoutes: readonly HiddenRoute[];
  isSafeZone: boolean;
  /** Edge length of a streamed terrain cell, metres. */
  chunkSize: number;
  recommendedLevel: [min: number, max: number];
  tags: readonly string[];
}

export interface HiddenRoute {
  id: string;
  to: ZoneId;
  unlockedBy: ScenarioId;
}

export type ScenarioTrigger =
  | { kind: 'survive-encounter'; monsterId: string; withoutSlots?: readonly string[]; timeOfDay?: TimeOfDay }
  | { kind: 'defeat-monster'; monsterId: string; count: number }
  | { kind: 'speak-to-npc'; npcId: string; requiredTitle?: string }
  | { kind: 'enter-area'; zoneId: ZoneId; areaId: string; timeOfDay?: TimeOfDay };

export type ScenarioReward =
  | { kind: 'hidden-route'; routeId: string }
  | { kind: 'title'; titleId: string }
  | { kind: 'item'; itemId: string; quantity: number }
  | { kind: 'mark'; markId: string };

/** A one-off, player-specific storyline (e.g. the hidden Warrens) unlocked by an in-world feat. */
export interface UniqueScenarioDefinition {
  id: ScenarioId;
  name: string;
  /** All triggers must be satisfied, in order. */
  triggers: readonly ScenarioTrigger[];
  rewards: readonly ScenarioReward[];
  repeatable: false;
}
