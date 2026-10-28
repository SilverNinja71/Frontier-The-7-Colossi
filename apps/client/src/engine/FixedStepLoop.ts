/**
 * Fixed-timestep simulation with interpolated rendering. The sim runs at SIM_TICK_HZ (same
 * rate as the server) regardless of display refresh; render() receives the blend factor
 * between the previous and current sim states.
 */
export class FixedStepLoop {
  #accumulator = 0;
  #lastTime = 0;
  #rafId = 0;
  #running = false;
  tick = 0;
  /** When true the simulation is frozen but rendering continues (menus, ad breaks). */
  paused = false;

  constructor(
    private readonly dt: number,
    private readonly step: (tick: number) => void,
    private readonly render: (alpha: number, frameDt: number) => void,
    private readonly maxStepsPerFrame = 5,
  ) {}

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#lastTime = performance.now();
    this.#rafId = requestAnimationFrame(this.#frame);
  }

  stop(): void {
    this.#running = false;
    cancelAnimationFrame(this.#rafId);
  }

  #frame = (now: number): void => {
    if (!this.#running) return;
    this.#rafId = requestAnimationFrame(this.#frame);
    const frameDt = Math.min((now - this.#lastTime) / 1000, 0.25);
    this.#lastTime = now;

    if (this.paused) {
      this.#accumulator = 0;
    } else {
      this.#accumulator += frameDt;
      let steps = 0;
      while (this.#accumulator >= this.dt && steps < this.maxStepsPerFrame) {
        this.step(this.tick++);
        this.#accumulator -= this.dt;
        steps++;
      }
      // Drop backlog instead of spiralling after a long stall (tab switch, GC pause).
      if (steps === this.maxStepsPerFrame) this.#accumulator = 0;
    }

    this.render(this.paused ? 1 : this.#accumulator / this.dt, frameDt);
  };
}
