import type { CharacterActionId, MoonPhase, TimeOfDay } from '@frontier/shared-types';
import { create } from 'zustand';
import { EMPTY_RECORDS, type HuntRecords } from '../data/progress.ts';
import type { ToastTone } from '../engine/events.ts';
import type { PlatformId } from '../platform/index.ts';

export type HudPhase = 'loading' | 'title' | 'playing' | 'paused' | 'error';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

export interface GameCommands {
  play(): void;
  pause(): void;
  resume(): void;
  toggleDrill(): void;
  toggleTracking(): void;
  toggleLock(): void;
  /** Sandbox shortcut: jump the world clock to the next new-moon night. */
  summonNewMoon(): void;
  clearMarks(): void;
  toggleStrikeDrill(): void;
  swapWeapon(): void;
  closeReport(): void;
  /** Sandbox escape hatch: jump to dawn, ending the hunt without earning the mark. */
  fleeToDawn(): void;
  openMap(): void;
  closeMap(): void;
  toggleSkin(): void;
}

export interface ExploreHud {
  /** Object URL of the painted world map (north up). */
  mapUrl: string | null;
  /** Player feet position, facing (radians, 0 = north/-z) and camera yaw. */
  x: number;
  z: number;
  facing: number;
  cameraYaw: number;
  discovered: string[];
  /** Shown by the minimap: what is nearby. */
  region: string;
}

export interface HuntReport {
  outcome: 'subdued' | 'survived' | 'faded';
  seconds: number;
  /** Share of its Resolve broken at the deepest point, 0..1. */
  resolveBroken: number;
  perfectParries: number;
  bestChain: number;
  early: number;
  late: number;
  guards: number;
  dodges: number;
  hitsTaken: number;
  falls: number;
  exposures: number;
  eclipse: boolean;
  markEarned: boolean;
  newBests: string[];
}

export interface BossHud {
  visible: boolean;
  /** Which colossus or guardian the frame is showing. */
  kind: 'stalker' | 'serpent';
  name: string;
  title: string;
  resolve: number;
  maxResolve: number;
  chain: number;
  chainGoal: number;
  /** Second phase: faster, relentless. */
  eclipsed: boolean;
  status: 'emerging' | 'hunting' | 'exposed' | 'subdued' | 'fading' | 'stunned' | 'devouring' | 'slain';
}

export interface Announcement {
  id: number;
  kicker: string;
  title: string;
  subtitle: string;
}

export interface MarkHud {
  id: string;
  name: string;
  description: string;
  /** Its conditional bonuses apply right now (e.g. it is night). */
  active: boolean;
}

export interface HudState {
  phase: HudPhase;
  loadingLabel: string;
  error: string | null;
  adBreak: boolean;
  muted: boolean;
  touch: boolean;
  platformId: PlatformId;
  vitals: {
    hp: number;
    maxHp: number;
    stamina: number;
    maxStamina: number;
    exhausted: boolean;
    sprinting: boolean;
    invulnerable: boolean;
    action: CharacterActionId;
    comboStep: number;
    /** Inside the perfect-parry window. */
    deflecting: boolean;
  };
  target: {
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    dps: number;
    total: number;
    tracking: boolean;
    drill: boolean;
    strikeDrill: boolean;
    drillStreak: number;
    drillBest: number;
  };
  combo: { count: number; at: number };
  boss: BossHud;
  clock: { period: TimeOfDay; moon: MoonPhase; night: number };
  announcement: Announcement | null;
  marks: MarkHud[];
  lockOn: boolean;
  explore: ExploreHud;
  mapOpen: boolean;
  /** A private custom character model, if one exists (dev server only; off by default). */
  skin: { available: boolean; active: boolean; name: string };
  /** Equipped weapon and its combo, in order. */
  weapon: { name: string; moves: string[] };
  /** Shown while dead; `fed` = Resolve the Stalker regained from the fall. */
  fallen: { fed: number } | null;
  report: HuntReport | null;
  records: HuntRecords;
  skill: { name: string; level: number; precisionHits: number; goal: number; evolvesInto: string };
  toasts: Toast[];
  debug: { visible: boolean; fps: number; tick: number; x: number; z: number; action: string; stalker: string };
  /** Cosmetic currency preview. Phase 2: the server grants and persists this. */
  doubloons: number;
  commands: GameCommands | null;
}

export const useHud = create<HudState>()(() => ({
  phase: 'loading',
  loadingLabel: 'Starting…',
  error: null,
  adBreak: false,
  muted: false,
  touch: false,
  platformId: 'web',
  vitals: {
    hp: 1,
    maxHp: 1,
    stamina: 1,
    maxStamina: 1,
    exhausted: false,
    sprinting: false,
    invulnerable: false,
    action: 0,
    comboStep: 0,
    deflecting: false,
  },
  target: {
    name: '',
    level: 1,
    hp: 1,
    maxHp: 1,
    dps: 0,
    total: 0,
    tracking: true,
    drill: false,
    strikeDrill: false,
    drillStreak: 0,
    drillBest: 0,
  },
  combo: { count: 0, at: 0 },
  boss: { visible: false, kind: 'stalker', name: '', title: '', resolve: 1, maxResolve: 1, chain: 0, chainGoal: 3, eclipsed: false, status: 'hunting' },
  clock: { period: 'day', moon: 'full', night: 0 },
  announcement: null,
  marks: [],
  lockOn: false,
  weapon: { name: '', moves: [] },
  explore: { mapUrl: null, x: 0, z: 0, facing: 0, cameraYaw: 0, discovered: [], region: '' },
  mapOpen: false,
  skin: { available: false, active: false, name: '' },
  fallen: null,
  report: null,
  records: EMPTY_RECORDS,
  skill: { name: '', level: 1, precisionHits: 0, goal: 1000, evolvesInto: '' },
  toasts: [],
  debug: { visible: false, fps: 0, tick: 0, x: 0, z: 0, action: '', stalker: '' },
  doubloons: 0,
  commands: null,
}));

let nextToastId = 0;

export function pushToast(text: string, tone: ToastTone = 'info'): void {
  const id = ++nextToastId;
  useHud.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  setTimeout(() => useHud.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 1500);
}

let nextAnnouncementId = 0;

/** Big centre-screen world announcement (colossus events, marks). */
export function announce(kicker: string, title: string, subtitle = ''): void {
  const id = ++nextAnnouncementId;
  useHud.setState({ announcement: { id, kicker, title, subtitle } });
  setTimeout(() => {
    if (useHud.getState().announcement?.id === id) useHud.setState({ announcement: null });
  }, 5200);
}
