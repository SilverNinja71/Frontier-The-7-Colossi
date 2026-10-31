import type * as THREE from 'three';

export type Sfx =
  | 'swing'
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
  | 'gong';

type Dest = AudioNode;

/**
 * Procedural sound: every effect is synthesised from oscillators and filtered noise, so the
 * build ships zero audio files. Positional sounds go through a PannerNode tied to the camera.
 */
export class AudioEngine {
  #ctx: AudioContext | null = null;
  #master!: GainNode;
  #sfx!: GainNode;
  #ambience!: GainNode;
  #noise!: AudioBuffer;
  #muted = false;
  #paused = false;

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
    this.#sfx = ctx.createGain();
    this.#sfx.connect(this.#master);
    this.#ambience = ctx.createGain();
    this.#ambience.gain.value = 0;
    this.#ambience.connect(this.#master);

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
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    if (this.#ctx) this.#master.gain.setTargetAtTime(muted ? 0 : 0.8, this.#ctx.currentTime, 0.05);
  }

  /** Pause menus and ad breaks: suspend the whole graph. */
  setPaused(paused: boolean): void {
    this.#paused = paused;
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
    let dest: Dest = this.#sfx;
    if (at) {
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
      dest = panner;
    }
    const t = ctx.currentTime + 0.005;
    const k = intensity;
    switch (sfx) {
      case 'swing':
        this.#noiseSweep(dest, t, 0.16, 'bandpass', 600, 2600, 1.2, 0.32 * k);
        break;
      case 'whiff':
        this.#noiseSweep(dest, t, 0.09, 'highpass', 2200, 4200, 0.7, 0.12 * k);
        break;
      case 'dodge':
        this.#noiseSweep(dest, t, 0.26, 'lowpass', 1400, 280, 0.8, 0.26 * k);
        break;
      case 'hit':
        this.#tone(dest, t, 'sine', 170, 55, 0.17, 0.6 * k);
        this.#noiseSweep(dest, t, 0.06, 'lowpass', 1100, 400, 0.7, 0.35 * k);
        break;
      case 'crit':
        this.#tone(dest, t, 'sine', 190, 50, 0.2, 0.7 * k);
        this.#noiseSweep(dest, t, 0.07, 'lowpass', 1600, 500, 0.7, 0.4 * k);
        this.#tone(dest, t + 0.01, 'triangle', 1500, 1150, 0.28, 0.16 * k);
        break;
      case 'immune':
        this.#tone(dest, t, 'square', 2600, 2450, 0.08, 0.05 * k);
        this.#tone(dest, t + 0.03, 'square', 3300, 3200, 0.07, 0.035 * k);
        this.#noiseSweep(dest, t, 0.03, 'highpass', 4000, 5000, 0.7, 0.08 * k);
        break;
      case 'parry': {
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
        this.#tone(dest, t, 'square', 620, 420, 0.13, 0.12 * k);
        this.#noiseSweep(dest, t, 0.09, 'lowpass', 1600, 500, 0.7, 0.3 * k);
        break;
      case 'hurt':
        this.#tone(dest, t, 'sawtooth', 230, 105, 0.2, 0.12 * k, 0.005, 900);
        this.#noiseSweep(dest, t, 0.1, 'lowpass', 900, 300, 0.7, 0.35 * k);
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
        this.#noiseSweep(dest, t, 0.45, 'lowpass', 500, 120, 0.7, 0.5 * k);
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
        break;
    }
  }

  // --------------------------------------------------------------------------

  #applyRunning(): void {
    const ctx = this.#ctx;
    if (!ctx) return;
    if (this.#paused) void ctx.suspend();
    else void ctx.resume();
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
