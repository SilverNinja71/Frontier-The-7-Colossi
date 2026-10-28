import type { Vec3 } from './math.ts';
import type { WorldMarkId } from './marks.ts';
import type { StatBlock } from './stats.ts';
import type { MoonPhase, TimeOfDay, ZoneId } from './world.ts';

export type MonsterId = string;

/**
 * Sphere hurtbox in the monster's local space (yaw 0 faces -Z). Capsules and complex
 * silhouettes are authored as several spheres.
 */
export interface Hurtbox {
  id: string;
  kind: 'body' | 'weakpoint';
  offset: Vec3;
  radius: number;
  damageMultiplier: number;
  /** Added to the attacker's crit chance when this hurtbox is struck. */
  critBonus: number;
  /**
   * Directional exposure: the hit only registers on this hurtbox when the attacker is on
   * the side `normal` points to (dot ≥ minDot). Used for back cores, exposed joints, etc.
   */
  exposure?: { normal: Vec3; minDot: number };
}

export interface DropEntry {
  itemId: string;
  chance: number;
  quantity: [min: number, max: number];
}

export interface MonsterDefinition {
  id: MonsterId;
  name: string;
  level: number;
  stats: StatBlock;
  hurtboxes: readonly Hurtbox[];
  drops: readonly DropEntry[];
  /** Seconds; 0 = never respawns (Colossi). */
  respawnSeconds: number;
  modelUrl?: string;
  tags: readonly string[];
}

export const COLOSSUS_IDS = [
  'shadow-stalker',
  'tomb-sentinel',
  'abyssal-leviathan',
  'celestial-dragon',
  'iron-juggernaut',
  'forest-colossus',
  'nether-core',
] as const;
export type ColossusId = (typeof COLOSSUS_IDS)[number];

export type ColossusSpawnRule =
  | { kind: 'roaming'; zones: readonly ZoneId[]; timeOfDay: readonly TimeOfDay[]; moonPhase: readonly MoonPhase[] }
  | { kind: 'lair'; zoneId: ZoneId }
  | { kind: 'naval'; zoneId: ZoneId }
  | { kind: 'aerial'; zoneId: ZoneId; platformCount: number };

/** How the fight is won. `parry-chain` colossi ignore raw damage entirely. */
export type ColossusDefeatCondition =
  | { kind: 'deplete-hp' }
  | { kind: 'parry-chain'; requiredChain: number }
  | { kind: 'break-parts'; partIds: readonly string[] };

export interface ColossusPhase {
  id: string;
  /** Enters this phase at or below this HP fraction. */
  hpThreshold: number;
  /** Telegraphed instant-kill stances, etc. */
  signatureAttacks: readonly string[];
}

export interface ColossusDefinition extends MonsterDefinition {
  colossusId: ColossusId;
  title: string;
  spawnRule: ColossusSpawnRule;
  defeatCondition: ColossusDefeatCondition;
  phases: readonly ColossusPhase[];
  /** Permanent, world-wide consequences once the single instance falls. */
  onDefeat: {
    worldFlag: string;
    announcement: string;
    marksGranted: readonly WorldMarkId[];
  };
  marksOnSurvive: readonly WorldMarkId[];
}

/** Only one instance of each colossus exists across all regional shards. */
export interface ColossusWorldStatus {
  colossusId: ColossusId;
  state: 'dormant' | 'roaming' | 'engaged' | 'defeated';
  zoneId: ZoneId | null;
  shardId: string | null;
  defeatedAt?: string;
  defeatedBy?: readonly string[];
}
