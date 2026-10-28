import type { EquipSlot } from './items.ts';
import type { ColossusId } from './monsters.ts';
import type { StatModifier } from './stats.ts';

export type WorldMarkId = string;

/**
 * A permanent curse/blessing left by a Unique Colossus, e.g. "Mark of the Night Lycaon":
 * chest armor forbidden, +agility and crit at night. Marks are never removable.
 */
export interface WorldMarkDefinition {
  id: WorldMarkId;
  name: string;
  description: string;
  source: { colossusId: ColossusId; outcome: 'defeat' | 'survive' | 'witness' };
  modifiers: readonly StatModifier[];
  forbiddenSlots: readonly EquipSlot[];
  visual: { kind: 'tattoo' | 'aura' | 'scar' | 'eyes'; decalUrl?: string; tint?: string };
}
