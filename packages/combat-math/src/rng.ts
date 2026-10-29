/**
 * Mulberry32: a 32-bit PRNG using only integer ops, so the sequence is bit-identical on
 * every JS engine. The server owns the seed per entity; the client mirrors it only to
 * predict crits, and always defers to HitConfirm.
 */
export class DeterministicRng {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Serialisable state so a server can persist and restore the stream. */
  get state(): number {
    return this.#state;
  }
}
