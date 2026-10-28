import type { StatBlock, StatModifier } from './stats.ts';
import type { ScenarioId } from './world.ts';

export type ItemId = string;

export type EquipSlot = 'mainHand' | 'offHand' | 'head' | 'chest' | 'legs' | 'feet' | 'accessory';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'unique';
export type WeaponClass = 'dual-blades' | 'katana' | 'greatsword' | 'spear' | 'bow' | 'staff' | 'harpoon';

/**
 * Fair-economy rule, enforced by the type system: anything that carries stats can only
 * enter the world through play. There is intentionally no `store` / `premium` variant.
 */
export type ItemSource =
  | { kind: 'drop'; monsterId: string; chance: number }
  | { kind: 'craft'; recipeId: string }
  | { kind: 'scenario'; scenarioId: ScenarioId }
  | { kind: 'quest'; questId: string };

interface ItemBase {
  id: ItemId;
  name: string;
  description: string;
  rarity: ItemRarity;
  /** Draco + KTX2 compressed glTF produced by apps/asset-pipeline. */
  modelUrl?: string;
  iconUrl?: string;
  sources: readonly [ItemSource, ...ItemSource[]];
}

export interface WeaponDefinition extends ItemBase {
  kind: 'weapon';
  weaponClass: WeaponClass;
  slot: 'mainHand';
  /** Dual blades and two-handers lock the off-hand slot. */
  occupiesOffHand: boolean;
  stats: Partial<StatBlock>;
  modifiers: readonly StatModifier[];
  movesetId: string;
}

export interface ArmorDefinition extends ItemBase {
  kind: 'armor';
  slot: Exclude<EquipSlot, 'mainHand'>;
  stats: Partial<StatBlock>;
  modifiers: readonly StatModifier[];
}

export interface MaterialDefinition extends ItemBase {
  kind: 'material';
  stackSize: number;
}

export interface ConsumableDefinition extends ItemBase {
  kind: 'consumable';
  stackSize: number;
  effect: { kind: 'heal'; amount: number } | { kind: 'stamina'; amount: number } | { kind: 'buff'; buffId: string };
}

export type ItemDefinition = WeaponDefinition | ArmorDefinition | MaterialDefinition | ConsumableDefinition;

export type Equipment = Partial<Record<EquipSlot, ItemId>>;

export type CosmeticSlot = 'outfit' | 'mask' | 'weapon-skin' | 'emote' | 'trail' | 'banner';
export type CosmeticAcquisition = 'doubloons' | 'battle-pass' | 'event' | 'achievement';

/** Cosmetics are the only things purchasable with ad-earned or paid currency. They never carry stats. */
export interface CosmeticDefinition {
  id: string;
  name: string;
  slot: CosmeticSlot;
  acquisition: CosmeticAcquisition;
  priceDoubloons?: number;
  stats?: never;
  modifiers?: never;
}
