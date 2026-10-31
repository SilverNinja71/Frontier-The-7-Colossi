export interface GameEventMap {
  hit: {
    targetId: string;
    amount: number;
    /** Landed but did nothing (colossus not exposed). */
    immune: boolean;
    isCritical: boolean;
    isWeakPoint: boolean;
    comboStep: number;
    x: number;
    y: number;
    z: number;
  };
  playerDamaged: { amount: number; staggered: boolean };
  perfectDodge: { x: number; y: number; z: number };
  parry: { x: number; y: number; z: number; chain: number; resolveDamage: number };
  guard: { x: number; y: number; z: number; amount: number; broken: boolean };
  /** StalkerEvent flags from the brain or from combat resolution. */
  stalker: { flags: number };
  toast: { text: string; tone: ToastTone };
}

export type ToastTone = 'info' | 'gold' | 'cyan' | 'danger';

type Listener<T> = (payload: T) => void;

export class GameEvents {
  readonly #listeners = new Map<keyof GameEventMap, Set<Listener<never>>>();

  on<K extends keyof GameEventMap>(type: K, listener: Listener<GameEventMap[K]>): () => void {
    let set = this.#listeners.get(type);
    if (!set) {
      set = new Set();
      this.#listeners.set(type, set);
    }
    set.add(listener as Listener<never>);
    return () => set.delete(listener as Listener<never>);
  }

  emit<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
    const set = this.#listeners.get(type);
    if (!set) return;
    for (const listener of set) (listener as Listener<GameEventMap[K]>)(payload);
  }
}
