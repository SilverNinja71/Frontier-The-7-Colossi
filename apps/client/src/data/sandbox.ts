import { DUAL_BLADES_MOVESET, STALKER_ATTACKS, STALKER_TUNING } from '@frontier/combat-math';
import type {
  ColossusDefinition,
  Hurtbox,
  MonsterDefinition,
  SkillDefinition,
  StatBlock,
  WeaponDefinition,
  WorldConditions,
  WorldMarkDefinition,
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

/** Player hurtboxes, used when enemies swing at the local player. */
export const PLAYER_HURTBOXES: readonly Hurtbox[] = [
  { id: 'legs', kind: 'body', offset: { x: 0, y: 0.5, z: 0 }, radius: 0.34, damageMultiplier: 1, critBonus: 0 },
  { id: 'torso', kind: 'body', offset: { x: 0, y: 1.1, z: 0 }, radius: 0.38, damageMultiplier: 1, critBonus: 0 },
  { id: 'head', kind: 'body', offset: { x: 0, y: 1.65, z: 0 }, radius: 0.22, damageMultiplier: 1, critBonus: 0 },
];

export const MARK_OF_THE_NIGHT_LYCAON: WorldMarkDefinition = {
  id: 'mark-night-lycaon',
  name: 'Mark of the Night Lycaon',
  description: 'Branded by the Shadow Stalker. Chest armor can never be worn; under the night sky, +20% agility and +20% critical rate.',
  source: { colossusId: 'shadow-stalker', outcome: 'survive' },
  modifiers: [
    { stat: 'agility', op: 'percent', value: 0.2, condition: { timeOfDay: ['night'] }, source: 'mark-night-lycaon' },
    { stat: 'critChance', op: 'flat', value: 0.2, condition: { timeOfDay: ['night'] }, source: 'mark-night-lycaon' },
  ],
  forbiddenSlots: ['chest'],
  visual: { kind: 'tattoo', tint: '#8b6bff' },
};

export const SHADOW_STALKER: ColossusDefinition = {
  id: 'colossus-shadow-stalker',
  colossusId: 'shadow-stalker',
  name: 'The Shadow Stalker',
  title: 'Unique Colossus · Hunter of the Moonless Night',
  level: 40,
  stats: {
    maxHp: STALKER_TUNING.maxResolve,
    maxStamina: 0,
    attack: 160,
    defense: 40,
    agility: 0,
    critChance: 0,
    critDamage: 0,
    moveSpeed: 1,
  },
  // Local space, facing -Z; origin at the feet under the body's centre.
  hurtboxes: [
    { id: 'head', kind: 'body', offset: { x: 0, y: 1.75, z: -2.0 }, radius: 0.5, damageMultiplier: 1, critBonus: 0 },
    {
      // The heart only shows when it collapses Exposed; it faces forward.
      id: 'heart',
      kind: 'weakpoint',
      offset: { x: 0, y: 1.15, z: -1.25 },
      radius: 0.45,
      damageMultiplier: 1.3,
      critBonus: 0.35,
      exposure: { normal: { x: 0, y: 0, z: -1 }, minDot: 0.1 },
    },
    { id: 'body', kind: 'body', offset: { x: 0, y: 1.35, z: -0.2 }, radius: 0.85, damageMultiplier: 1, critBonus: 0 },
    { id: 'haunch', kind: 'body', offset: { x: 0, y: 1.15, z: 1.2 }, radius: 0.7, damageMultiplier: 1, critBonus: 0 },
  ],
  drops: [],
  respawnSeconds: 0,
  tags: ['colossus', 'night', 'beast'],
  spawnRule: { kind: 'roaming', zones: ['firstia-training-grounds'], timeOfDay: ['night'], moonPhase: ['new'] },
  defeatCondition: { kind: 'parry-chain', requiredChain: STALKER_TUNING.exposeChain },
  phases: [{ id: 'hunt', hpThreshold: 1, signatureAttacks: Object.keys(STALKER_ATTACKS) }],
  onDefeat: {
    worldFlag: 'shadow-stalker-subdued',
    announcement: 'The Shadow Stalker has been subdued beneath the moonless sky.',
    marksGranted: [MARK_OF_THE_NIGHT_LYCAON.id],
  },
  marksOnSurvive: [MARK_OF_THE_NIGHT_LYCAON.id],
};
