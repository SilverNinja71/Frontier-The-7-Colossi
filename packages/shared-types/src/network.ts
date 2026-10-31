import type { ColossusId } from './monsters.ts';
import type { CharacterActionId } from './player.ts';
import type { MoonPhase, TimeOfDay, ZoneId } from './world.ts';

/**
 * Fixed simulation rate shared by client prediction and the authoritative server. Both
 * sides step identical rules (packages/combat-math) at this rate, which is what makes
 * reconciliation by input replay possible. Frame data is authored in these ticks.
 */
export const SIM_TICK_HZ = 30;
export const SIM_DT = 1 / SIM_TICK_HZ;
/** How often the server broadcasts state patches. */
export const SERVER_PATCH_HZ = 20;
/** Remote entities are rendered this far in the past for smooth interpolation. */
export const INTERPOLATION_DELAY_MS = 100;
/** Unacknowledged inputs re-sent with every packet to survive loss. */
export const INPUT_REDUNDANCY = 4;

export const RoomName = {
  WorldZone: 'world_zone',
  ColossusRaid: 'colossus_raid',
  Dungeon: 'dungeon',
} as const;
export type RoomNameId = (typeof RoomName)[keyof typeof RoomName];

export const InputButton = {
  Sprint: 1 << 0,
  Dodge: 1 << 1,
  Attack: 1 << 2,
  Jump: 1 << 3,
  Parry: 1 << 4,
  Interact: 1 << 5,
  /** Held while locked on: the character strafes and swings toward viewYaw. */
  LockOn: 1 << 6,
} as const;
export type InputButtonFlag = (typeof InputButton)[keyof typeof InputButton];

/**
 * One tick of player intent. This exact struct feeds local prediction and is sent to the
 * server, so the client never sends positions — only intent.
 */
export interface InputFrame {
  /** Monotonic per-connection sequence; the server acks the last applied one. */
  seq: number;
  /** -1..1, camera-relative strafe. */
  moveX: number;
  /** -1..1, camera-relative forward. */
  moveY: number;
  /** Camera yaw in radians at sample time; movement and attacks are relative to it. */
  viewYaw: number;
  /** Buttons held this tick (InputButton bitmask). */
  held: number;
  /** Buttons that went down since the previous tick. */
  pressed: number;
}

export interface JoinOptions {
  zoneId: ZoneId;
  /** Session token issued by the auth service; the profile is loaded server-side. */
  token: string;
  clientVersion: string;
}

// ---------------------------------------------------------------------------
// Synchronised room state. Server schema classes (@colyseus/schema) implement these
// interfaces; the client reads them. Fields are flat scalars for cheap delta encoding.
// ---------------------------------------------------------------------------

/** Structural subset of Colyseus MapSchema, so shared code doesn't depend on Colyseus. */
export interface MapLike<V> {
  get(key: string): V | undefined;
  forEach(callback: (value: V, key: string) => void): void;
  readonly size: number;
}

export interface ListLike<V> {
  readonly length: number;
  at(index: number): V | undefined;
  forEach(callback: (value: V, index: number) => void): void;
}

export interface PlayerNetState {
  sessionId: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  action: CharacterActionId;
  actionTick: number;
  comboStep: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  /** Last InputFrame.seq the server simulated — the client replays everything after it. */
  lastInputSeq: number;
  weaponId: string;
  marks: ListLike<string>;
}

export interface MonsterNetState {
  id: string;
  monsterId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  action: number;
  actionTick: number;
  targetSessionId: string;
}

export interface WorldZoneNetState {
  zoneId: ZoneId;
  serverTick: number;
  /** 0..1 through the day cycle. */
  dayProgress: number;
  timeOfDay: TimeOfDay;
  moonPhase: MoonPhase;
  players: MapLike<PlayerNetState>;
  monsters: MapLike<MonsterNetState>;
}

export interface ColossusRaidNetState extends WorldZoneNetState {
  colossusId: ColossusId;
  phaseId: string;
  /** Parry-chain colossi: consecutive perfect parries landed by the raid. */
  parryChain: number;
}

// ---------------------------------------------------------------------------
// Discrete messages (Colyseus room.send / room.onMessage). Numeric ids keep frames small.
// ---------------------------------------------------------------------------

export const ClientMessage = {
  Input: 1,
  Chat: 2,
  Interact: 3,
} as const;
export type ClientMessageId = (typeof ClientMessage)[keyof typeof ClientMessage];

export interface ClientMessagePayloads {
  [ClientMessage.Input]: { frames: readonly InputFrame[] };
  [ClientMessage.Chat]: { channel: ChatChannel; text: string };
  [ClientMessage.Interact]: { targetId: string };
}

export const ServerMessage = {
  HitConfirm: 101,
  PlayerDamaged: 102,
  ColossusAnnouncement: 103,
  Chat: 104,
  ScenarioUnlocked: 105,
} as const;
export type ServerMessageId = (typeof ServerMessage)[keyof typeof ServerMessage];

export type ChatChannel = 'zone' | 'party' | 'global' | 'whisper';

export interface HitConfirmPacket {
  tick: number;
  attackerId: string;
  targetId: string;
  hurtboxId: string;
  amount: number;
  isCritical: boolean;
  isWeakPoint: boolean;
}

export interface ServerMessagePayloads {
  [ServerMessage.HitConfirm]: HitConfirmPacket;
  [ServerMessage.PlayerDamaged]: { tick: number; sourceId: string; amount: number; staggered: boolean };
  [ServerMessage.ColossusAnnouncement]: {
    colossusId: ColossusId;
    event: 'awakened' | 'engaged' | 'defeated';
    shardId: string;
    zoneId: ZoneId;
    participants: readonly string[];
    text: string;
  };
  [ServerMessage.Chat]: { channel: ChatChannel; from: string; text: string; sentAt: number };
  [ServerMessage.ScenarioUnlocked]: { scenarioId: string; name: string };
}
