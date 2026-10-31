import type { CharacterActionId, MoonPhase, TimeOfDay } from '@frontier/shared-types';
import { create } from 'zustand';
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
}

export interface BossHud {
  visible: boolean;
  name: string;
  title: string;
  resolve: number;
  maxResolve: number;
  chain: number;
  chainGoal: number;
  /** Second phase: faster, relentless. */
  eclipsed: boolean;
  status: 'emerging' | 'hunting' | 'exposed' | 'subdued' | 'fading';
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
  };
  combo: { count: number; at: number };
  boss: BossHud;
  clock: { period: TimeOfDay; moon: MoonPhase; night: number };
  announcement: Announcement | null;
  marks: MarkHud[];
  lockOn: boolean;
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
  target: { name: '', level: 1, hp: 1, maxHp: 1, dps: 0, total: 0, tracking: true, drill: false },
  combo: { count: 0, at: 0 },
  boss: { visible: false, name: '', title: '', resolve: 1, maxResolve: 1, chain: 0, chainGoal: 3, eclipsed: false, status: 'hunting' },
  clock: { period: 'day', moon: 'full', night: 0 },
  announcement: null,
  marks: [],
  lockOn: false,
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
