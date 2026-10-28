import type { CharacterActionId } from '@frontier/shared-types';
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
  skill: { name: string; level: number; precisionHits: number; goal: number; evolvesInto: string };
  toasts: Toast[];
  debug: { visible: boolean; fps: number; tick: number; x: number; z: number; action: string };
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
  },
  target: { name: '', level: 1, hp: 1, maxHp: 1, dps: 0, total: 0, tracking: true, drill: false },
  combo: { count: 0, at: 0 },
  skill: { name: '', level: 1, precisionHits: 0, goal: 1000, evolvesInto: '' },
  toasts: [],
  debug: { visible: false, fps: 0, tick: 0, x: 0, z: 0, action: '' },
  doubloons: 0,
  commands: null,
}));

let nextToastId = 0;

export function pushToast(text: string, tone: ToastTone = 'info'): void {
  const id = ++nextToastId;
  useHud.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, text, tone }] }));
  setTimeout(() => useHud.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 1500);
}
