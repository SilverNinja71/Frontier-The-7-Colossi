import {
  activeAttackStep,
  computeDamage,
  conditionMatches,
  DEFAULT_MOTOR_TUNING,
  deriveCombatStats,
  DeterministicRng,
  DUAL_BLADES_MOVESET,
  equipmentModifiers,
  moonPhaseAt,
  MotorEvent,
  nextNewMoonNight,
  nightIndexAt,
  resolveStats,
  SANDBOX_DAY_SECONDS,
  StalkerEvent,
  StalkerPhase,
  stalkerTargetFell,
  timeOfDayAt,
  yawFromDirection,
  type MotorContext,
} from '@frontier/combat-math';
import {
  CharacterAction,
  InputButton,
  SIM_DT,
  type GroundPose,
  type TimeOfDay,
  type WorldConditions,
  type WorldMarkDefinition,
} from '@frontier/shared-types';
import * as THREE from 'three';
import { AudioEngine } from '../audio/AudioEngine.ts';
import { BladeTrail } from '../combat/BladeTrail.ts';
import { CombatSystem } from '../combat/CombatSystem.ts';
import { DamageNumbers } from '../combat/DamageNumbers.ts';
import { HitSparks } from '../combat/HitSparks.ts';
import { ShadowStalker } from '../combat/ShadowStalker.ts';
import { DRILL_RADIUS, TrainingDummy } from '../combat/TrainingDummy.ts';
import { loadMarks, saveMarks } from '../data/progress.ts';
import {
  CRITICAL_STRIKE,
  FIRSTIA_TWIN_FANGS,
  MARK_OF_THE_NIGHT_LYCAON,
  PLAYER_BASE_STATS,
  SANDBOX_WORLD,
  SHADOW_STALKER,
  TRAINING_DUMMY,
} from '../data/sandbox.ts';
import type { PlatformService } from '../platform/index.ts';
import { announce, pushToast, useHud, type BossHud, type GameCommands } from '../ui/store.ts';
import { ArenaTerrain } from './ArenaTerrain.ts';
import { CameraRig } from './CameraRig.ts';
import { GameEvents } from './events.ts';
import { FixedStepLoop } from './FixedStepLoop.ts';
import { InputController } from './InputController.ts';
import { LockReticle } from './LockReticle.ts';
import { PhysicsWorld, loadRapier, type Rapier } from './PhysicsWorld.ts';
import { PlayerCharacter } from './PlayerCharacter.ts';
import { PlayerRig } from './PlayerRig.ts';
import { SceneManager } from './SceneManager.ts';
import { isTouchDevice, TouchControls } from './TouchControls.ts';

const ACTION_NAMES = ['free', 'dodge', 'attack', 'stagger', 'dead', 'parry'] as const;
const HUD_SYNC_INTERVAL = 1 / 15;
const COMBO_WINDOW_MS = 2500;
const DPS_ENGAGEMENT_GAP_MS = 5000;
const PLAYER_SPAWN = { x: 0, y: 0, z: 7 };
const SLAM_STAGGER_TICKS = 14;
/** Late afternoon of day 1: about a minute of daylight before a new-moon night. */
const START_TIME = 1.66;
const LOCK_RANGE = 25;
const LOCK_BREAK_RANGE = 32;
const STALKER_EMERGE_DISTANCE = 16;
const STALKER_PHASE_NAMES = ['dormant', 'emerging', 'prowl', 'attack', 'recoil', 'exposed', 'dissolving', 'subdued'] as const;
const KNOWN_MARKS: Record<string, WorldMarkDefinition> = { [MARK_OF_THE_NIGHT_LYCAON.id]: MARK_OF_THE_NIGHT_LYCAON };

interface Lockable {
  readonly id: string;
  readonly pose: GroundPose;
  readonly targetable: boolean;
  lockPoint(out: THREE.Vector3): THREE.Vector3;
}

const BOSS_STATUS: Partial<Record<number, BossHud['status']>> = {
  [StalkerPhase.Emerging]: 'emerging',
  [StalkerPhase.Prowl]: 'hunting',
  [StalkerPhase.Attack]: 'hunting',
  [StalkerPhase.Recoil]: 'hunting',
  [StalkerPhase.Exposed]: 'exposed',
  [StalkerPhase.Subdued]: 'subdued',
  [StalkerPhase.Dissolving]: 'fading',
};

/** The Firstia training grounds: dummy by day, the Shadow Stalker on new-moon nights. */
export class Game implements GameCommands {
  readonly events = new GameEvents();
  readonly #scene: SceneManager;
  readonly #physics: PhysicsWorld;
  readonly #arena: ArenaTerrain;
  readonly #player: PlayerCharacter;
  readonly #rig: PlayerRig;
  readonly #trails: BladeTrail[];
  readonly #dummy: TrainingDummy;
  readonly #stalker: ShadowStalker;
  readonly #camera: CameraRig;
  readonly #input: InputController;
  readonly #touch: TouchControls | null;
  readonly #combat: CombatSystem;
  readonly #sparks = new HitSparks();
  readonly #numbers: DamageNumbers;
  readonly #reticle: LockReticle;
  readonly #audio = new AudioEngine();
  readonly #loop: FixedStepLoop;
  readonly #motorContext: MotorContext;
  readonly #abort = new AbortController();
  readonly #baseModifiers = equipmentModifiers([FIRSTIA_TWIN_FANGS]);
  readonly #stalkerRng = new DeterministicRng(0x5ad0);

  #phase: 'title' | 'playing' | 'paused' = 'title';
  #adBreak = false;
  #hudTimer = 0;
  #fpsFrames = 0;
  #fpsTimer = 0;
  #fps = 0;
  #debug = false;
  #combo = { count: 0, at: 0 };
  #engagement = { start: 0, last: 0, total: 0 };
  #worldTime = START_TIME;
  #period: TimeOfDay = timeOfDayAt(START_TIME);
  #daylight = 1;
  #stalkerNight = Number.NaN;
  #shockSerial = -1;
  /** Died at least once during the current hunt: surviving to dawn no longer earns the mark. */
  #fellTonight = false;
  #wasDead = false;
  #lockTarget: Lockable | null = null;
  #marks: WorldMarkDefinition[];
  readonly #renderPos = new THREE.Vector3();
  readonly #lockPoint = new THREE.Vector3();
  readonly #tmp = new THREE.Vector3();

  static async create(
    gameRoot: HTMLElement,
    overlayRoot: HTMLElement,
    platform: PlatformService,
    onProgress: (label: string) => void,
  ): Promise<Game> {
    onProgress('Loading physics…');
    const rapier = await loadRapier();
    onProgress('Raising the training grounds…');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return new Game(gameRoot, overlayRoot, platform, rapier);
  }

  private constructor(
    gameRoot: HTMLElement,
    overlayRoot: HTMLElement,
    private readonly platform: PlatformService,
    rapier: Rapier,
  ) {
    const touch = isTouchDevice();
    this.#scene = new SceneManager(gameRoot, { lowPower: touch });
    this.#physics = new PhysicsWorld(rapier, SIM_DT);
    this.#arena = new ArenaTerrain(this.#scene.scene, this.#physics);

    this.#motorContext = {
      moveset: DUAL_BLADES_MOVESET,
      tuning: DEFAULT_MOTOR_TUNING,
      speedMultiplier: 1,
      dt: SIM_DT,
    };
    const baseStats = resolveStats(PLAYER_BASE_STATS, this.#baseModifiers, SANDBOX_WORLD);
    this.#player = new PlayerCharacter(
      this.#physics,
      PLAYER_SPAWN,
      deriveCombatStats(baseStats),
      baseStats.maxHp,
      baseStats.maxStamina,
      this.#motorContext,
    );
    this.#marks = loadMarks().flatMap((id) => (KNOWN_MARKS[id] ? [KNOWN_MARKS[id]] : []));
    this.#recomputeStats();

    this.#rig = new PlayerRig();
    this.#trails = this.#rig.bladeAnchors.map((a) => new BladeTrail(a.base, a.tip));
    this.#scene.scene.add(this.#rig.root, this.#sparks.points, ...this.#trails.map((t) => t.mesh));

    this.#dummy = new TrainingDummy(this.#scene.scene, this.#physics, TRAINING_DUMMY, new THREE.Vector3(0, 0, 0));
    this.#stalker = new ShadowStalker(this.#scene.scene, this.#physics, overlayRoot);
    this.#numbers = new DamageNumbers(overlayRoot);
    this.#reticle = new LockReticle(overlayRoot);
    this.#camera = new CameraRig(this.#scene.camera, this.#physics, [this.#player.collider, this.#stalker.collider]);
    this.#input = new InputController(this.#scene.renderer.domElement);
    this.#touch = touch
      ? new TouchControls(overlayRoot, this.#input, { onPause: () => this.pause(), onLock: () => this.toggleLock() })
      : null;
    if (this.#touch) this.#touch.visible = false;
    this.#combat = new CombatSystem(
      this.#player,
      DUAL_BLADES_MOVESET,
      DEFAULT_MOTOR_TUNING,
      [this.#dummy, this.#stalker],
      this.events,
      CRITICAL_STRIKE,
    );

    this.#bindEvents();
    // Register static colliders with the query pipeline before the first camera ray.
    this.#physics.step();

    this.#loop = new FixedStepLoop(
      SIM_DT,
      () => this.#step(),
      (alpha, frameDt) => this.#render(alpha, frameDt),
    );
    useHud.setState({
      touch,
      platformId: platform.id,
      commands: this,
      skill: { name: CRITICAL_STRIKE.name, level: 1, precisionHits: 0, goal: 1000, evolvesInto: 'Spiral Slash' },
    });
    this.#syncHud();
    this.#loop.start();
  }

  // --- Commands (HUD / platform) ---------------------------------------------

  play(): void {
    if (this.#phase === 'playing') return;
    if (this.#phase === 'title') this.#camera.resetBehind(this.#player.motor.facingYaw); // undo attract orbit
    this.#phase = 'playing';
    if (!this.#touch) this.#input.requestPointerLock();
    this.#audio.unlock(); // first user gesture
    this.#applyRunState();
    this.platform.setAdContext('overworld');
    this.platform.gameplayStart();
    useHud.setState({ phase: 'playing' });
  }

  pause(): void {
    if (this.#phase !== 'playing') return;
    this.#phase = 'paused';
    this.#input.exitPointerLock();
    this.#applyRunState();
    this.platform.gameplayStop();
    this.platform.setAdContext('menu');
    useHud.setState({ phase: 'paused' });
  }

  resume(): void {
    if (this.#phase !== 'paused') return;
    this.play();
  }

  toggleDrill(): void {
    this.#dummy.drillEnabled = !this.#dummy.drillEnabled;
    pushToast(this.#dummy.drillEnabled ? 'Slam drill ON — dodge through the red ring' : 'Slam drill OFF', 'info');
    this.#syncHud();
  }

  toggleTracking(): void {
    this.#dummy.tracking = !this.#dummy.tracking;
    pushToast(this.#dummy.tracking ? 'Dummy tracks you — flank for the core' : 'Dummy holds still', 'info');
    this.#syncHud();
  }

  toggleLock(): void {
    if (this.#lockTarget) {
      this.#setLock(null);
      return;
    }
    const pose = this.#player.pose();
    const fx = -Math.sin(this.#camera.yaw);
    const fz = -Math.cos(this.#camera.yaw);
    let best: Lockable | null = null;
    let bestScore = Infinity;
    for (const candidate of [this.#stalker, this.#dummy] as Lockable[]) {
      if (!candidate.targetable) continue;
      const dx = candidate.pose.x - pose.x;
      const dz = candidate.pose.z - pose.z;
      const distance = Math.hypot(dx, dz);
      if (distance > LOCK_RANGE) continue;
      // Prefer what the camera is looking at, then what is close.
      const facing = distance > 1e-3 ? (dx * fx + dz * fz) / distance : 1;
      const score = distance * (1.6 - facing);
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) pushToast('No target in range', 'info');
    this.#setLock(best);
  }

  summonNewMoon(): void {
    const target = nextNewMoonNight(this.#worldTime);
    if (target > this.#worldTime) this.#worldTime = target + 0.002;
    pushToast('The new moon rises…', 'info');
    this.#syncHud();
  }

  clearMarks(): void {
    this.#marks = [];
    saveMarks([]);
    this.#recomputeStats();
    pushToast('Marks cleared (sandbox)', 'info');
  }

  /** Platform ad break: freeze everything until the ad ends. */
  setAdBreak(active: boolean): void {
    this.#adBreak = active;
    this.#applyRunState();
    useHud.setState({ adBreak: active });
  }

  setMuted(muted: boolean): void {
    this.#audio.setMuted(muted);
  }

  dispose(): void {
    this.#loop.stop();
    this.#abort.abort();
    this.#input.dispose();
    this.#touch?.dispose();
    this.#numbers.dispose();
    this.#reticle.dispose();
    this.#stalker.dispose();
    this.#scene.dispose();
  }

  // --- Simulation (30 Hz) ----------------------------------------------------

  #step(): void {
    // World time only flows while playing, so nothing hunts an idle title screen.
    if (this.#phase === 'playing') this.#worldTime += SIM_DT / SANDBOX_DAY_SECONDS;
    const t = this.#worldTime;
    const period = timeOfDayAt(t);
    const moon = moonPhaseAt(t);
    if (period !== this.#period) {
      this.#period = period;
      this.#recomputeStats();
      if (period === 'night') pushToast(moon === 'new' ? 'Night falls · a new moon' : 'Night falls', 'info');
      if (period === 'dawn') pushToast('Dawn breaks', 'info');
    }
    const isNight = period === 'night';
    if (this.#phase === 'playing' && isNight && moon === 'new' && !this.#stalker.present && nightIndexAt(t) !== this.#stalkerNight) {
      this.#summonStalker();
    }
    this.#validateLock();

    const input = this.#input.sampleFrame(this.#camera.yaw, this.#lockTarget ? InputButton.LockOn : 0);
    const motorResult = this.#player.step(input);
    const dummyResult = this.#dummy.step(this.#player.pose());
    const stalkerResult = this.#stalker.step({
      target: this.#player.pose(),
      targetAlive: !this.#player.dead,
      isNight,
      rng: this.#stalkerRng,
      dt: SIM_DT,
    });
    this.#physics.step();
    this.#player.syncFromPhysics();
    this.#stalker.syncFromPhysics();
    this.#combat.step();
    this.#combat.resolveEnemyHit(this.#stalker, stalkerResult.hit, SHADOW_STALKER.stats);

    // No natural healing mid-hunt, and every fall feeds it.
    this.#player.regenBlocked = this.#stalker.present;
    const dead = this.#player.dead;
    if (dead && !this.#wasDead && this.#stalker.targetable) {
      this.#fellTonight = true;
      const regained = stalkerTargetFell(this.#stalker.brain);
      if (regained > 0) pushToast(`It feeds on your fall · +${Math.round(regained)} Resolve`, 'danger');
    }
    this.#wasDead = dead;

    const pose = this.#player.pose();
    const at = { x: pose.x, y: pose.y + 1.2, z: pose.z };
    if (motorResult.events & MotorEvent.AttackStarted) this.#audio.play('swing', at, 0.8 + this.#player.motor.comboStep * 0.15);
    if (motorResult.events & MotorEvent.DodgeStarted) this.#audio.play('dodge', at);
    if (motorResult.events & MotorEvent.ParryStarted) this.#audio.play('whiff', at);
    if (motorResult.events & MotorEvent.Exhausted) pushToast('Exhausted!', 'danger');
    if (dummyResult.slam) this.#resolveSlam();
    if (stalkerResult.events) this.#onStalkerEvents(stalkerResult.events);

    const hit = stalkerResult.hit;
    if (hit && hit.attack.arcDegrees >= 360 && hit.serial !== this.#shockSerial) {
      this.#shockSerial = hit.serial;
      this.#stalker.shockwave(hit.pose.x, hit.pose.z, hit.attack.reach);
      this.#audio.play('slam', { x: hit.pose.x, y: 0.5, z: hit.pose.z });
      this.#camera.addTrauma(0.45);
    }
  }

  #summonStalker(): void {
    const p = this.#player.pose();
    // Emerge on the far side of the arena centre from the player.
    const angle = Math.atan2(p.x, p.z) + Math.PI;
    const x = Math.sin(angle) * STALKER_EMERGE_DISTANCE;
    const z = Math.cos(angle) * STALKER_EMERGE_DISTANCE;
    this.#stalkerNight = nightIndexAt(this.#worldTime);
    this.#fellTonight = false;
    this.#onStalkerEvents(this.#stalker.summon(x, z, yawFromDirection(p.x - x, p.z - z)));
  }

  #onStalkerEvents(flags: number): void {
    const stalker = this.#stalker;
    const at = { x: stalker.pose.x, y: 1.6, z: stalker.pose.z };
    if (flags & StalkerEvent.Emerged) {
      announce('World event · Firstia', 'The Shadow Stalker stirs', 'A Unique Colossus hunts beneath the new moon. Blades cannot wound it. Parry.');
      this.#audio.play('gong');
      this.#audio.play('howl', at);
    }
    if (flags & StalkerEvent.TelegraphParryable) this.#audio.play('growl', at, 0.8);
    if (flags & StalkerEvent.TelegraphPerilous) {
      this.#audio.play(stalker.brain.attack?.id === 'moonless-howl' ? 'howl' : 'growl', at, 1.2);
    }
    if (flags & StalkerEvent.Eclipsed) {
      announce('Eclipse', "The Shadow Stalker's eyes burn", 'Half its Resolve is gone. It hunts in earnest now.');
      this.#audio.play('howl', at, 1.3);
      this.#camera.addTrauma(0.5);
    }
    if (flags & StalkerEvent.Exposed) {
      pushToast('EXPOSED · STRIKE THE HEART', 'gold');
      this.#audio.play('crit', at);
      this.#camera.addTrauma(0.3);
    }
    if (flags & StalkerEvent.Subdued) {
      const fresh = this.#grantMark();
      announce(
        'World announcement',
        'The Shadow Stalker has been subdued',
        fresh ? `Mark acquired: ${MARK_OF_THE_NIGHT_LYCAON.name}` : 'Its mark already burns on your skin.',
      );
      this.#audio.play('gong');
      this.platform.happytime();
      this.#setLock(null);
    }
    if (flags & StalkerEvent.Survived) {
      if (this.#fellTonight) {
        announce('Dawn breaks', 'The Shadow Stalker fades', 'You fell tonight. Survive a whole new-moon night unbroken to earn its mark.');
      } else {
        const fresh = this.#grantMark();
        announce(
          'Dawn breaks',
          'You survived the Shadow Stalker',
          fresh ? `Mark acquired: ${MARK_OF_THE_NIGHT_LYCAON.name}` : 'It fades with the night… for now.',
        );
      }
      this.#audio.play('gong');
    }
  }

  /** Returns true when the mark is newly earned. */
  #grantMark(): boolean {
    if (this.#marks.some((m) => m.id === MARK_OF_THE_NIGHT_LYCAON.id)) return false;
    this.#marks.push(MARK_OF_THE_NIGHT_LYCAON);
    saveMarks(this.#marks.map((m) => m.id));
    this.#recomputeStats();
    return true;
  }

  #recomputeStats(): void {
    const world: WorldConditions = {
      timeOfDay: timeOfDayAt(this.#worldTime),
      moonPhase: moonPhaseAt(this.#worldTime),
      zoneTags: SANDBOX_WORLD.zoneTags,
    };
    const modifiers = [...this.#baseModifiers, ...this.#marks.flatMap((m) => m.modifiers)];
    const stats = deriveCombatStats(resolveStats(PLAYER_BASE_STATS, modifiers, world));
    this.#player.stats = stats;
    this.#motorContext.speedMultiplier = stats.moveSpeed;
    useHud.setState({
      marks: this.#marks.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        active: m.modifiers.some((mod) => conditionMatches(mod.condition, world)),
      })),
    });
  }

  #setLock(target: Lockable | null): void {
    this.#lockTarget = target;
    useHud.setState({ lockOn: target !== null });
  }

  #validateLock(): void {
    const target = this.#lockTarget;
    if (!target) return;
    const pose = this.#player.pose();
    if (!target.targetable || Math.hypot(target.pose.x - pose.x, target.pose.z - pose.z) > LOCK_BREAK_RANGE) {
      this.#setLock(null);
    }
  }

  #resolveSlam(): void {
    const pose = this.#player.pose();
    const distance = Math.hypot(pose.x - this.#dummy.pose.x, pose.z - this.#dummy.pose.z);
    this.#camera.addTrauma(distance < DRILL_RADIUS * 2 ? 0.35 : 0.1);
    this.#audio.play('slam', { x: this.#dummy.pose.x, y: 0.5, z: this.#dummy.pose.z }, 0.7);
    if (distance > DRILL_RADIUS + 0.4) return;

    if (this.#player.invulnerable) {
      this.events.emit('perfectDodge', { x: pose.x, y: pose.y + 1.2, z: pose.z });
      return;
    }
    const damage = computeDamage({
      attacker: deriveCombatStats(TRAINING_DUMMY.stats),
      defender: this.#player.stats,
      motionValue: 1,
      hurtbox: { kind: 'body', damageMultiplier: 1, critBonus: 0 },
      critRoll: 1,
    });
    if (this.#player.takeDamage(damage.amount, SLAM_STAGGER_TICKS)) {
      this.events.emit('playerDamaged', { amount: damage.amount, staggered: !this.#player.dead });
      if (this.#player.dead) pushToast('Knocked out — respawning', 'danger');
    }
  }

  // --- Rendering (display rate) ----------------------------------------------

  #render(alpha: number, frameDt: number): void {
    this.#fpsFrames++;
    this.#fpsTimer += frameDt;
    if (this.#fpsTimer >= 0.5) {
      this.#fps = Math.round(this.#fpsFrames / this.#fpsTimer);
      this.#fpsFrames = 0;
      this.#fpsTimer = 0;
    }
    const now = performance.now() / 1000;

    const renderTime = this.#worldTime + (this.#phase === 'playing' ? (alpha * SIM_DT) / SANDBOX_DAY_SECONDS : 0);
    this.#daylight = this.#scene.setTime(renderTime, moonPhaseAt(renderTime));
    const night = 1 - this.#daylight;
    this.#arena.setNight(night, now);
    this.#audio.setNight(night);

    const look = this.#input.consumeLook();
    this.#camera.applyLook(look.x, look.y);
    if (this.#phase === 'title') this.#camera.yaw += frameDt * 0.12; // attract-mode orbit

    const motor = this.#player.motor;
    const yaw = this.#player.renderPose(alpha, this.#renderPos);
    this.#rig.root.position.copy(this.#renderPos);
    this.#rig.root.rotation.y = yaw;
    this.#rig.setMark(this.#marks.length > 0, night);
    this.#rig.update(
      {
        motor,
        moveset: DUAL_BLADES_MOVESET,
        tuning: DEFAULT_MOTOR_TUNING,
        alpha,
        groundSpeed: this.#player.groundSpeed,
        invulnerable: this.#player.invulnerable,
      },
      frameDt,
    );

    const active = activeAttackStep(motor, DUAL_BLADES_MOVESET);
    const leadBlade = active?.id.endsWith('2') ? 1 : 0;
    this.#trails.forEach((trail, i) => trail.update(!!active && (active.arcDegrees >= 360 || i === leadBlade), frameDt));

    const lockPoint = this.#lockTarget ? this.#lockTarget.lockPoint(this.#lockPoint) : null;
    this.#dummy.update(alpha, frameDt);
    this.#stalker.update(alpha, frameDt, this.#scene.camera, this.#renderPos);
    this.#sparks.update(frameDt);
    this.#camera.update(this.#renderPos, frameDt, motor.sprinting && motor.action === CharacterAction.Free, lockPoint);
    this.#scene.followShadow(this.#renderPos);
    this.#scene.render();
    this.#numbers.update(this.#scene.camera, frameDt);
    this.#reticle.update(this.#scene.camera, lockPoint);
    this.#audio.updateListener(this.#scene.camera);

    this.#hudTimer += frameDt;
    if (this.#hudTimer >= HUD_SYNC_INTERVAL) {
      this.#hudTimer = 0;
      this.#syncHud();
    }
  }

  // --------------------------------------------------------------------------

  #applyRunState(): void {
    const running = this.#phase === 'playing' && !this.#adBreak;
    this.#loop.paused = this.#phase === 'paused' || this.#adBreak;
    this.#input.enabled = running;
    this.#audio.setPaused(!running);
    if (this.#touch) this.#touch.visible = running;
  }

  #bindEvents(): void {
    const signal = this.#abort.signal;
    this.#input.bindHotkey('KeyT', () => this.toggleDrill());
    this.#input.bindHotkey('KeyG', () => this.toggleTracking());
    this.#input.bindHotkey('Tab', () => this.#phase === 'playing' && this.toggleLock());
    this.#input.bindHotkey('Mouse1', () => this.#phase === 'playing' && this.toggleLock());
    this.#input.bindHotkey('KeyN', () => this.#phase === 'playing' && this.summonNewMoon());
    this.#input.bindHotkey('F3', () => {
      this.#debug = !this.#debug;
      this.#syncHud();
    });
    this.#input.bindHotkey('KeyP', () => (this.#phase === 'playing' ? this.pause() : this.resume()));

    document.addEventListener(
      'pointerlockchange',
      () => {
        if (!this.#input.pointerLocked && this.#phase === 'playing' && !this.#touch) this.pause();
      },
      { signal },
    );
    document.addEventListener('visibilitychange', () => document.hidden && this.pause(), { signal });
    this.#scene.renderer.domElement.addEventListener(
      'click',
      () => {
        if (this.#phase === 'playing' && !this.#touch && !this.#input.pointerLocked) this.#input.requestPointerLock();
      },
      { signal },
    );

    const gold = new THREE.Color('#ffc451');
    const white = new THREE.Color('#fff4e0');
    const cyan = new THREE.Color('#7fe3ff');
    const grey = new THREE.Color('#8a90a0');
    const violet = new THREE.Color('#b48cff');
    this.events.on('hit', (hit) => {
      const point = { x: hit.x, y: hit.y, z: hit.z };
      if (hit.immune) {
        this.#numbers.spawn(this.#tmp.set(hit.x, hit.y + 0.4, hit.z), 'IMMUNE', 'immune');
        this.#sparks.burst(hit.x, hit.y, hit.z, 6, grey, 4);
        this.#audio.play('immune', point);
        this.#rig.hitstop(0.03);
        return;
      }
      const now = performance.now();
      this.#combo = { count: now - this.#combo.at < COMBO_WINDOW_MS ? this.#combo.count + 1 : 1, at: now };
      if (now - this.#engagement.last > DPS_ENGAGEMENT_GAP_MS) this.#engagement = { start: now, last: now, total: 0 };
      this.#engagement.last = now;
      this.#engagement.total += hit.amount;

      const kind = hit.isWeakPoint && hit.isCritical ? 'weakpoint' : hit.isCritical ? 'critical' : 'normal';
      const label = kind === 'weakpoint' ? `${hit.amount}!!` : kind === 'critical' ? `${hit.amount}!` : `${hit.amount}`;
      this.#numbers.spawn(this.#tmp.set(hit.x, hit.y + 0.4, hit.z), label, kind);
      this.#sparks.burst(hit.x, hit.y, hit.z, kind === 'normal' ? 10 : 22, kind === 'normal' ? white : gold, kind === 'normal' ? 5 : 8);
      this.#camera.addTrauma(kind === 'normal' ? 0.12 : 0.28);
      this.#rig.hitstop(kind === 'normal' ? 0.045 : 0.08);
      this.#audio.play(kind === 'normal' ? 'hit' : 'crit', point);
      if (kind === 'weakpoint') pushToast('WEAK POINT', 'gold');
      useHud.setState({ combo: { ...this.#combo } });
    });
    this.events.on('parry', ({ x, y, z, chain, resolveDamage }) => {
      this.#sparks.burst(x, y, z, 34, gold, 9);
      this.#sparks.burst(x, y, z, 14, white, 5);
      this.#numbers.spawn(this.#tmp.set(x, y + 0.6, z), chain > 1 ? `PARRY ×${chain}` : 'PARRY', 'parry');
      if (resolveDamage > 0) {
        this.#stalker.headPosition(this.#tmp);
        this.#numbers.spawn(this.#tmp.setY(this.#tmp.y + 0.6), `${resolveDamage}`, 'critical');
      }
      this.#rig.parryFlash();
      this.#rig.hitstop(0.09);
      this.#camera.addTrauma(0.22);
      this.#audio.play('parry', { x, y, z });
    });
    this.events.on('guard', ({ x, y, z, amount, broken }) => {
      this.#sparks.burst(x, y, z, 12, violet, 5);
      this.#numbers.spawn(this.#tmp.copy(this.#renderPos).setY(this.#renderPos.y + 2), `-${amount}`, 'player');
      this.#audio.play('guard', { x, y, z });
      this.#camera.addTrauma(0.25);
      pushToast(broken ? 'Guard broken!' : 'Late parry — guarded', broken ? 'danger' : 'info');
    });
    this.events.on('playerDamaged', ({ amount, staggered }) => {
      this.#numbers.spawn(this.#tmp.copy(this.#renderPos).setY(this.#renderPos.y + 2), `-${amount}`, 'player');
      this.#camera.addTrauma(0.6);
      this.#audio.play('hurt', { x: this.#renderPos.x, y: this.#renderPos.y + 1.2, z: this.#renderPos.z });
      if (staggered) pushToast('Staggered!', 'danger');
    });
    this.events.on('perfectDodge', ({ x, y, z }) => {
      this.#sparks.burst(x, y, z, 26, cyan, 6);
      this.#numbers.spawn(this.#tmp.set(x, y + 0.8, z), 'DODGE', 'miss');
      pushToast('PERFECT DODGE', 'cyan');
    });
    this.events.on('stalker', ({ flags }) => this.#onStalkerEvents(flags));
    this.events.on('toast', ({ text, tone }) => pushToast(text, tone));
  }

  #syncHud(): void {
    const motor = this.#player.motor;
    const pose = this.#player.pose();
    const engaged = performance.now() - this.#engagement.last < DPS_ENGAGEMENT_GAP_MS;
    const elapsed = Math.max(1, (this.#engagement.last - this.#engagement.start) / 1000);
    const brain = this.#stalker.brain;
    useHud.setState({
      vitals: {
        hp: this.#player.hp,
        maxHp: this.#player.maxHp,
        stamina: motor.stamina,
        maxStamina: motor.maxStamina,
        exhausted: motor.exhausted,
        sprinting: motor.sprinting,
        invulnerable: this.#player.invulnerable,
        action: motor.action,
        comboStep: motor.comboStep,
        deflecting: motor.action === CharacterAction.Parry && motor.actionTick < DEFAULT_MOTOR_TUNING.parry.perfectTicks,
      },
      target: {
        name: TRAINING_DUMMY.name,
        level: TRAINING_DUMMY.level,
        hp: this.#dummy.hp,
        maxHp: this.#dummy.maxHp,
        dps: engaged ? Math.round(this.#engagement.total / elapsed) : 0,
        total: this.#engagement.total,
        tracking: this.#dummy.tracking,
        drill: this.#dummy.drillEnabled,
      },
      boss: {
        visible: this.#stalker.present,
        name: SHADOW_STALKER.name,
        title: SHADOW_STALKER.title,
        resolve: brain.resolve,
        maxResolve: SHADOW_STALKER.stats.maxHp,
        chain: brain.parryChain,
        eclipsed: brain.eclipsed,
        chainGoal: SHADOW_STALKER.defeatCondition.kind === 'parry-chain' ? SHADOW_STALKER.defeatCondition.requiredChain : 3,
        status: BOSS_STATUS[brain.phase] ?? 'hunting',
      },
      clock: { period: this.#period, moon: moonPhaseAt(this.#worldTime), night: 1 - this.#daylight },
      skill: {
        name: CRITICAL_STRIKE.name,
        level: this.#combat.skill.level,
        precisionHits: this.#combat.skill.counters.precisionHits ?? 0,
        goal: 1000,
        evolvesInto: 'Spiral Slash',
      },
      debug: {
        visible: this.#debug,
        fps: this.#fps,
        tick: this.#loop.tick,
        x: pose.x,
        z: pose.z,
        action: ACTION_NAMES[motor.action],
        stalker: this.#stalker.present
          ? `${STALKER_PHASE_NAMES[brain.phase]}${brain.attack ? `:${brain.attack.id}` : ''} @${Math.hypot(brain.x - pose.x, brain.z - pose.z).toFixed(1)}m`
          : 'dormant',
      },
    });
  }
}
