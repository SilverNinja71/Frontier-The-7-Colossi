import {
  STAT_IDS,
  type ArmorDefinition,
  type EquipSlot,
  type ModifierCondition,
  type StatBlock,
  type StatId,
  type StatModifier,
  type WeaponDefinition,
  type WorldConditions,
  type WorldMarkDefinition,
} from '@frontier/shared-types';

/** Each point of agility adds this much crit chance (100 agility → +5%). */
export const AGILITY_CRIT_PER_POINT = 0.0005;
/** Each point of agility adds this much move-speed multiplier (100 agility → +10%). */
export const AGILITY_SPEED_PER_POINT = 0.001;

export function conditionMatches(condition: ModifierCondition | undefined, world: WorldConditions): boolean {
  if (!condition) return true;
  if (condition.timeOfDay && !condition.timeOfDay.includes(world.timeOfDay)) return false;
  if (condition.moonPhase && !condition.moonPhase.includes(world.moonPhase)) return false;
  if (condition.zoneTags && !condition.zoneTags.some((tag) => world.zoneTags.includes(tag))) return false;
  return true;
}

/** final = (base + Σflat) × (1 + Σpercent), considering only modifiers whose condition holds. */
export function resolveStats(base: StatBlock, modifiers: readonly StatModifier[], world: WorldConditions): StatBlock {
  const flat = {} as StatBlock;
  const percent = {} as StatBlock;
  for (const id of STAT_IDS) {
    flat[id] = 0;
    percent[id] = 0;
  }
  for (const mod of modifiers) {
    if (!conditionMatches(mod.condition, world)) continue;
    if (mod.op === 'flat') flat[mod.stat] += mod.value;
    else percent[mod.stat] += mod.value;
  }
  const out = {} as StatBlock;
  for (const id of STAT_IDS) {
    out[id] = (base[id] + flat[id]) * (1 + percent[id]);
  }
  return out;
}

/** Equipment base stats become flat modifiers; item-authored modifiers pass through. */
export function equipmentModifiers(items: readonly (WeaponDefinition | ArmorDefinition)[]): StatModifier[] {
  const out: StatModifier[] = [];
  for (const item of items) {
    for (const [stat, value] of Object.entries(item.stats) as [StatId, number][]) {
      out.push({ stat, op: 'flat', value, source: item.id });
    }
    out.push(...item.modifiers);
  }
  return out;
}

export interface CombatStats {
  attack: number;
  defense: number;
  /** 0..1 after agility contribution. */
  critChance: number;
  critDamage: number;
  /** Locomotion multiplier after agility contribution. */
  moveSpeed: number;
}

export function deriveCombatStats(stats: StatBlock): CombatStats {
  return {
    attack: stats.attack,
    defense: stats.defense,
    critChance: clamp01(stats.critChance + stats.agility * AGILITY_CRIT_PER_POINT),
    critDamage: Math.max(0, stats.critDamage),
    moveSpeed: Math.max(0, stats.moveSpeed * (1 + stats.agility * AGILITY_SPEED_PER_POINT)),
  };
}

export function forbiddenSlots(marks: readonly WorldMarkDefinition[]): ReadonlySet<EquipSlot> {
  return new Set(marks.flatMap((mark) => mark.forbiddenSlots));
}

export function canEquipSlot(slot: EquipSlot, marks: readonly WorldMarkDefinition[]): boolean {
  return !forbiddenSlots(marks).has(slot);
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
