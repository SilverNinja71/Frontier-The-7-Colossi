import { DUAL_BLADES_MOVESET } from '@frontier/combat-math';
import type {
  MonsterDefinition,
  SkillDefinition,
  StatBlock,
  WeaponDefinition,
  WorldConditions,
} from '@frontier/shared-types';

/**
 * Phase 1 sandbox content, typed against the shared contracts. In later phases these move to
 * JSON registries that the server, wiki generator and client all load.
 */

export const SANDBOX_WORLD: WorldConditions = { timeOfDay: 'day', moonPhase: 'waxing', zoneTags: ['firstia', 'safe'] };

export const PLAYER_BASE_STATS: StatBlock = {
  maxHp: 1000,
  maxStamina: 100,
  attack: 46,
  defense: 20,
  agility: 50,
  critChance: 0.08,
  critDamage: 0.6,
  moveSpeed: 1,
};

export const FIRSTIA_TWIN_FANGS: WeaponDefinition = {
  id: 'weapon-firstia-twin-fangs',
  kind: 'weapon',
  name: 'Firstia Twin Fangs',
  description: 'Balanced practice blades issued at the Firstia training grounds.',
  rarity: 'common',
  weaponClass: 'dual-blades',
  slot: 'mainHand',
  occupiesOffHand: true,
  stats: { attack: 18, agility: 10 },
  modifiers: [],
  movesetId: DUAL_BLADES_MOVESET.id,
  sources: [{ kind: 'quest', questId: 'quest-firstia-orientation' }],
};

export const TRAINING_DUMMY: MonsterDefinition = {
  id: 'monster-training-dummy',
  name: 'Firstia Training Dummy',
  level: 1,
  stats: {
    maxHp: 6000,
    maxStamina: 0,
    attack: 180,
    defense: 30,
    agility: 0,
    critChance: 0,
    critDamage: 0,
    moveSpeed: 0,
  },
  hurtboxes: [
    { id: 'head', kind: 'body', offset: { x: 0, y: 1.78, z: 0 }, radius: 0.24, damageMultiplier: 1.1, critBonus: 0 },
    { id: 'torso', kind: 'body', offset: { x: 0, y: 1.2, z: 0 }, radius: 0.42, damageMultiplier: 1, critBonus: 0 },
    { id: 'waist', kind: 'body', offset: { x: 0, y: 0.7, z: 0 }, radius: 0.32, damageMultiplier: 0.9, critBonus: 0 },
    {
      // Glowing core on the dummy's back — only exposed from behind.
      id: 'core',
      kind: 'weakpoint',
      offset: { x: 0, y: 1.25, z: 0.36 },
      radius: 0.2,
      damageMultiplier: 1.35,
      critBonus: 0.55,
      exposure: { normal: { x: 0, y: 0, z: 1 }, minDot: 0.35 },
    },
  ],
  drops: [],
  respawnSeconds: 0,
  tags: ['training', 'firstia'],
};

export const CRITICAL_STRIKE: SkillDefinition = {
  id: 'skill-critical-strike',
  name: 'Critical Strike',
  description: 'Precise blows to exposed weak points crit more often.',
  kind: 'passive',
  maxLevel: 10,
  xpCurve: { base: 120, growth: 1.45 },
  evolutions: [
    {
      into: 'skill-spiral-slash',
      requirements: [{ kind: 'counter', counter: 'precisionHits', atLeast: 1000 }],
    },
  ],
};
