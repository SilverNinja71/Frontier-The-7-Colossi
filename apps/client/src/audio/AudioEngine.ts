import type * as THREE from 'three';

export type Sfx =
  | 'swing'
  | 'staff'
  | 'whiff'
  | 'dodge'
  | 'hit'
  | 'crit'
  | 'immune'
  | 'parry'
  | 'guard'
  | 'hurt'
  | 'growl'
  | 'howl'
  | 'slam'
  | 'gong'
  | 'discover'
  | 'hiss'
  | 'inhale'
  | 'gulp'
  | 'spit'
  | 'swap';

/** Ground under a footstep. */
export type StepSurface = 'grass' | 'dirt' | 'stone' | 'snow' | 'wood';

/** Menu and HUD feedback. */
export type UiSfx = 'click' | 'hover' | 'open' | 'close' | 'toggle' | 'confirm' | 'error';

type Dest = AudioNode;

/** `sfx.json` from apps/asset-pipeline build-audio.ts: [start, duration] slices per set. */
interface SampleManifest {
  syncAt: number;
  sets: Record<string, [number, number][]>;
}

interface SampleBank {
  buffer: AudioBuffer;
  sets: Record<string, [number, number][]>;
  /** Seconds the decoder shifted the sprite by (MP3 encoder delay handling differs). */
  offset: number;
}

const STEP_SET: Record<StepSurface, string> = {
  grass: 'stepGrass',
  dirt: 'stepDirt',
  stone: 'stepStone',
  snow: 'stepSnow',
  wood: 'stepWood',
};

const UI_SET: Record<UiSfx, [set: string, gain: number]> = {
  click: ['uiClick', 0.35],
  hover: ['uiHover', 0.16],
  open: ['uiOpen', 0.4],
  close: ['uiClose', 0.35],
  toggle: ['uiToggle', 0.35],
  confirm: ['uiConfirm', 0.4],
  error: ['uiError', 0.35],
};

/**
 * Sound effects: recorded CC0 samples (Kenney's Impact, Interface and RPG audio, one sprite)
 * layered with procedural synthesis (oscillators and filtered noise) for the creature voices,
 * whooshes and bells. Until the sprite has loaded, or if it fails, everything is synthesised.
 * Positional sounds go through a PannerNode tied to the camera.
 */
export class AudioEngine {
  #ctx: AudioContext | null = null;
  #sprite: Promise<{ manifest: SampleManifest; data: ArrayBuffer } | null> | null = null;
  #bank: SampleBank | null = null;
  readonly #lastVariant = new Map<string, number>();
  #master!: GainNode;
  #sfx!: GainNode;
  #ambience!: GainNode;
  /** Everything in the world (sfx + ambience); faded out while a menu is open. */
  #world!: GainNode;
  /** Menu feedback: stays live in menus. */
  #ui!: GainNode;
  #suspended = false;
  #noise!: AudioBuffer;
  #muted = false;
  #paused = false;

  /** The decoded sample bank's decoder shift, or null while synthesising only (dev checks). */
  get samples(): { offset: number; sets: number } | null {
    return this.#bank ? { offset: this.#bank.offset, sets: Object.keys(this.#bank.sets).length } : null;
  }

  /** Starts downloading the sample sprite (decoded once audio is unlocked). */
  preload(baseUrl: string): void {
    this.#sprite ??= Promise.all([
      fetch(`${baseUrl}sfx.json`).then((r) => (r.ok ? (r.json() as Promise<SampleManifest>) : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(`${baseUrl}sfx.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`)))),
    ]).then(
      ([manifest, data]) => ({ manifest, data }),
      (error: unknown) => {
        console.warn('[audio] samples unavailable, synthesising everything:', error);
        return null;
      },
    );
  }

  /** Browsers only allow audio after a user gesture: call from the "Enter" click. */
  unlock(): void {
    if (this.#ctx) {
      this.#applyRunning();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.#ctx = ctx;
    this.#master = ctx.createGain();
    this.#master.gain.value = this.#muted ? 0 : 0.8;
    this.#master.connect(ctx.destination);
    this.#world = ctx.createGain();
    this.#world.connect(this.#master);
    this.#ui = ctx.createGain();
    this.#ui.connect(this.#master);
    this.#sfx = ctx.createGain();
    this.#sfx.connect(this.#world);
    this.#ambience = ctx.createGain();
    this.#ambience.gain.value = 0;
    this.#ambience.connect(this.#world);

    this.#noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.#noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Night wind: looping noise, low-passed, slowly breathing.
    const wind = ctx.createBufferSource();
    wind.buffer = this.#noise;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 420;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(windFilter.frequency);
    wind.connect(windFilter).connect(this.#ambience);
    wind.start();
    lfo.start();
    this.#applyRunning();
    void this.#decodeSprite(ctx);
  }

  async #decodeSprite(ctx: AudioContext): Promise<void> {
    const sprite = await this.#sprite;
    if (!sprite) return;
    try {
      const buffer = await ctx.decodeAudioData(sprite.data.slice(0));
      // Find the sync click: its measured time minus its written time is the decoder's shift.
      const data = buffer.getChannelData(0);
      const end = Math.min(data.length, Math.round((sprite.manifest.syncAt + 0.1) * buffer.sampleRate));
      let peak = 0;
      for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(data[i]!));
      let at = 0;
      while (at < end && Math.abs(data[at]!) < peak * 0.5) at++;
      const offset = peak > 0.05 ? at / buffer.sampleRate - sprite.manifest.syncAt : 0;
      this.#bank = { buffer, sets: sprite.manifest.sets, offset };
    } catch (error) {
      console.warn('[audio] could not decode samples:', error);
    }
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    if (this.#ctx) this.#master.gain.setTargetAtTime(muted ? 0 : 0.8, this.#ctx.currentTime, 0.05);
  }

  /**
   * Menus fade the world out but keep the graph running for UI clicks; ad breaks (`suspend`)
   * stop the whole graph.
   */
  setPaused(paused: boolean, suspend = false): void {
    this.#paused = paused;
    this.#suspended = paused && suspend;
    this.#applyRunning();
  }

  /** 0..1 night factor drives the wind ambience. */
  setNight(night: number): void {
    if (this.#ctx) this.#ambience.gain.setTargetAtTime(0.015 + 0.09 * night, this.#ctx.currentTime, 0.5);
  }

  updateListener(camera: THREE.Camera): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    const l = ctx.listener;
    const e = camera.matrixWorld.elements;
    const [px, py, pz] = [e[12]!, e[13]!, e[14]!];
    const [fx, fy, fz] = [-e[8]!, -e[9]!, -e[10]!];
    const [ux, uy, uz] = [e[4]!, e[5]!, e[6]!];
    if (l.positionX) {
      const t = ctx.currentTime;
      l.positionX.setValueAtTime(px, t);
      l.positionY.setValueAtTime(py, t);
      l.positionZ.setValueAtTime(pz, t);
      l.forwardX.setValueAtTime(fx, t);
      l.forwardY.setValueAtTime(fy, t);
      l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(ux, t);
      l.upY.setValueAtTime(uy, t);
      l.upZ.setValueAtTime(uz, t);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }

  play(sfx: Sfx, at?: { x: number; y: number; z: number }, intensity = 1): void {
    const ctx = this.#ctx;
    if (!ctx || this.#paused || ctx.state !== 'running') return;
    const dest = this.#destination(ctx, at);
    const t = ctx.currentTime + 0.005;
    const k = intensity;
    // With samples, the recorded layer carries the body and the synth is trimmed back.
    const s = this.#bank ? 0.45 : 1;
    switch (sfx) {
      case 'swing':
        this.#noiseSweep(dest, t, 0.16, 'bandpass', 600, 2600, 1.2, 0.32 * k);
        this.#sample('cloth', dest, t, 0.22 * k, 1.25, 0.12);
        break;
      case 'staff':
        // Heavier, lower whoosh with a faint iron hum.
        this.#noiseSweep(dest, t, 0.26, 'bandpass', 320, 1500, 1.1, 0.42 * k);
        this.#tone(dest, t, 'sine', 95, 70, 0.22, 0.08 * k);
        this.#sample('cloth', dest, t, 0.3 * k, 0.9, 0.08);
        break;
      case 'whiff':
        this.#noiseSweep(dest, t, 0.09, 'highpass', 2200, 4200, 0.7, 0.12 * k);
        break;
      case 'dodge':
        this.#noiseSweep(dest, t, 0.26, 'lowpass', 1400, 280, 0.8, 0.26 * k * s);
        this.#sample('cloth', dest, t, 0.45 * k, 1, 0.1);
        break;
      case 'hit':
        this.#tone(dest, t, 'sine', 170, 55, 0.17, 0.6 * k * s);
        this.#noiseSweep(dest, t, 0.06, 'lowpass', 1100, 400, 0.7, 0.35 * k * s);
        this.#sample('punch', dest, t, 0.75 * k, 1, 0.08);
        this.#sample('slice', dest, t, 0.18 * k, 1.35, 0.1);
        break;
      case 'crit':
        this.#tone(dest, t, 'sine', 190, 50, 0.2, 0.7 * k * s);
        this.#noiseSweep(dest, t, 0.07, 'lowpass', 1600, 500, 0.7, 0.4 * k * s);
        this.#tone(dest, t + 0.01, 'triangle', 1500, 1150, 0.28, 0.16 * k);
        this.#sample('punchHeavy', dest, t, 0.9 * k, 1, 0.06);
        this.#sample('slice', dest, t, 0.35 * k, 1.2, 0.1);
        break;
      case 'immune':
        if (this.#bank) {
          this.#sample('tin', dest, t, 0.45 * k, 1.3, 0.08);
        } else {
          this.#tone(dest, t, 'square', 2600, 2450, 0.08, 0.05 * k);
          this.#tone(dest, t + 0.03, 'square', 3300, 3200, 0.07, 0.035 * k);
          this.#noiseSweep(dest, t, 0.03, 'highpass', 4000, 5000, 0.7, 0.08 * k);
        }
        break;
      case 'parry': {
        if (this.#bank) {
          // A blade meeting a blade, with the ring left hanging.
          this.#sample('metal', dest, t, 0.95 * k, 1.05, 0.06);
          this.#sample('bell', dest, t, 0.32 * k, 1.45, 0.06);
          this.#tone(dest, t, 'sine', 240, 90, 0.12, 0.25 * k);
          break;
        }
        // Bright ringing clang: inharmonic partials with a fast attack.
        const partials: [number, number][] = [
          [1250, 0.16],
          [1873, 0.11],
          [2639, 0.09],
          [3520, 0.05],
        ];
        for (const [f, g] of partials) this.#tone(dest, t, 'triangle', f, f * 0.995, 0.7, g * k, 0.002);
        this.#noiseSweep(dest, t, 0.04, 'highpass', 3000, 4500, 0.7, 0.4 * k);
        this.#tone(dest, t, 'sine', 240, 90, 0.12, 0.3 * k);
        break;
      }
      case 'guard':
        this.#tone(dest, t, 'square', 620, 420, 0.13, 0.12 * k * s);
        this.#noiseSweep(dest, t, 0.09, 'lowpass', 1600, 500, 0.7, 0.3 * k * s);
        this.#sample('plate', dest, t, 0.8 * k, 0.95, 0.06);
        break;
      case 'hurt':
        this.#tone(dest, t, 'sawtooth', 230, 105, 0.2, 0.12 * k, 0.005, 900);
        this.#noiseSweep(dest, t, 0.1, 'lowpass', 900, 300, 0.7, 0.35 * k * s);
        this.#sample('punchHeavy', dest, t, 0.7 * k, 0.8, 0.06);
        break;
      case 'growl':
        this.#tone(dest, t, 'sawtooth', 72, 58, 0.45, 0.28 * k, 0.04, 420);
        this.#tone(dest, t, 'sawtooth', 75, 60, 0.45, 0.22 * k, 0.04, 420);
        break;
      case 'howl':
        this.#howl(dest, t, k);
        break;
      case 'slam':
        this.#tone(dest, t, 'sine', 75, 28, 0.65, 0.9 * k);
        this.#noiseSweep(dest, t, 0.45, 'lowpass', 500, 120, 0.7, 0.5 * k * s);
        this.#sample('thud', dest, t, 0.9 * k, 0.7, 0.05);
        break;
      case 'swap':
        this.#sample('draw', dest, t, 0.5 * k, 1, 0.06);
        if (!this.#bank) this.#noiseSweep(dest, t, 0.22, 'highpass', 2500, 6000, 1.5, 0.12 * k);
        break;
      case 'discover':
        this.#sample('uiDiscover', dest, t, 0.25 * k, 1, 0);
        // A rising, bell-like arpeggio.
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => {
          this.#tone(dest, t + i * 0.11, 'sine', f, f, 1.4, 0.12 * k, 0.01);
          this.#tone(dest, t + i * 0.11, 'triangle', f * 2.01, f * 2.01, 0.5, 0.03 * k, 0.005);
        });
        break;
      case 'hiss':
        // A serpent's rasp: bright noise with a slow swell.
        this.#noiseSweep(dest, t, 0.55, 'highpass', 3200, 5200, 0.6, 0.22 * k);
        this.#noiseSweep(dest, t + 0.05, 0.45, 'bandpass', 5000, 3800, 2, 0.12 * k);
        break;
      case 'inhale':
        this.#noiseSweep(dest, t, 1.4, 'bandpass', 220, 1400, 1.4, 0.4 * k);
        this.#tone(dest, t, 'sawtooth', 55, 80, 1.3, 0.08 * k, 0.3, 300);
        break;
      case 'gulp':
        this.#tone(dest, t, 'sine', 140, 45, 0.35, 0.8 * k);
        this.#noiseSweep(dest, t, 0.2, 'lowpass', 600, 150, 0.8, 0.4 * k * s);
        this.#sample('thud', dest, t, 0.8 * k, 0.6, 0.05);
        break;
      case 'spit':
        this.#noiseSweep(dest, t, 0.22, 'bandpass', 1800, 600, 1.2, 0.35 * k);
        this.#tone(dest, t + 0.02, 'sine', 320, 120, 0.15, 0.15 * k);
        break;
      case 'gong':
        for (const [f, g] of [
          [110, 0.22],
          [220.9, 0.14],
          [329.2, 0.1],
          [442.5, 0.06],
        ] as const) {
          this.#tone(dest, t, 'sine', f, f, 3.2, g * k, 0.01);
        }
        this.#sample('bell', dest, t, 0.35 * k, 0.5, 0.02);
        break;
    }
  }

  /** One footstep on the given ground (samples only: the synth has no good footstep). */
  step(surface: StepSurface, at: { x: number; y: number; z: number }, intensity = 1): void {
    const ctx = this.#ctx;
    if (!ctx || this.#paused || ctx.state !== 'running' || !this.#bank) return;
    this.#sample(STEP_SET[surface], this.#destination(ctx, at), ctx.currentTime + 0.005, 0.32 * intensity, 1, 0.1);
  }

  /** Menu and HUD feedback (not positional; plays while paused too). */
  ui(name: UiSfx): void {
    const ctx = this.#ctx;
    if (!ctx || !this.#bank) return;
    const [set, gain] = UI_SET[name];
    this.#sample(set, this.#ui, ctx.currentTime + 0.005, gain, 1, 0.03);
  }

  // --------------------------------------------------------------------------

  #destination(ctx: AudioContext, at?: { x: number; y: number; z: number }): Dest {
    if (!at) return this.#sfx;
    const panner = new PannerNode(ctx, {
      panningModel: 'equalpower',
      distanceModel: 'inverse',
      refDistance: 4,
      rolloffFactor: 1,
      positionX: at.x,
      positionY: at.y,
      positionZ: at.z,
    });
    panner.connect(this.#sfx);
    return panner;
  }

  /** Plays a random variant of a sample set (never the same one twice running), pitch-jittered. */
  #sample(set: string, dest: Dest, t: number, gain: number, rate: number, jitter: number): void {
    const bank = this.#bank;
    const slices = bank?.sets[set];
    if (!bank || !slices || slices.length === 0) return;
    let index = Math.floor(Math.random() * slices.length);
    if (slices.length > 1 && index === this.#lastVariant.get(set)) index = (index + 1) % slices.length;
    this.#lastVariant.set(set, index);
    const [start, duration] = slices[index]!;
    const source = new AudioBufferSourceNode(this.#ctx!, {
      buffer: bank.buffer,
      playbackRate: rate * (1 + (Math.random() * 2 - 1) * jitter),
    });
    const level = new GainNode(this.#ctx!, { gain });
    source.connect(level).connect(dest);
    source.start(t, Math.max(0, start + bank.offset), duration);
  }

  #applyRunning(): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    if (this.#suspended) void ctx.suspend();
    else void ctx.resume();
    this.#world.gain.setTargetAtTime(this.#paused ? 0 : 1, ctx.currentTime, 0.04);
  }

  #tone(
    dest: Dest,
    t: number,
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    gain: number,
    attack = 0.005,
    lowpass?: number,
  ): void {
    const ctx = this.#ctx!;
    const osc = new OscillatorNode(ctx, { type, frequency: from });
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    const env = this.#envelope(t, duration, gain, attack);
    if (lowpass) {
      const filter = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: lowpass });
      osc.connect(filter).connect(env).connect(dest);
    } else {
      osc.connect(env).connect(dest);
    }
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  #noiseSweep(dest: Dest, t: number, duration: number, type: BiquadFilterType, from: number, to: number, q: number, gain: number): void {
    const ctx = this.#ctx!;
    const source = new AudioBufferSourceNode(ctx, { buffer: this.#noise });
    const filter = new BiquadFilterNode(ctx, { type, frequency: from, Q: q });
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    source.connect(filter).connect(this.#envelope(t, duration, gain, 0.004)).connect(dest);
    source.start(t, Math.random());
    source.stop(t + duration + 0.05);
  }

  #howl(dest: Dest, t: number, k: number): void {
    const ctx = this.#ctx!;
    const duration = 1.35;
    const osc = new OscillatorNode(ctx, { type: 'sawtooth', frequency: 250 });
    osc.frequency.linearRampToValueAtTime(430, t + 0.45);
    osc.frequency.linearRampToValueAtTime(300, t + duration);
    const vibrato = new OscillatorNode(ctx, { frequency: 6 });
    const depth = new GainNode(ctx, { gain: 14 });
    vibrato.connect(depth).connect(osc.frequency);
    const formant = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 820, Q: 3 });
    osc.connect(formant).connect(this.#envelope(t, duration, 0.5 * k, 0.12)).connect(dest);
    osc.start(t);
    vibrato.start(t);
    osc.stop(t + duration + 0.05);
    vibrato.stop(t + duration + 0.05);
  }

  #envelope(t: number, duration: number, peak: number, attack: number): GainNode {
    const env = new GainNode(this.#ctx!, { gain: 0.0001 });
    env.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return env;
  }
}
