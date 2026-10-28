import {
  activeAttackStep,
  computeDamage,
  DEFAULT_MOTOR_TUNING,
  deriveCombatStats,
  DUAL_BLADES_MOVESET,
  equipmentModifiers,
  MotorEvent,
  resolveStats,
  type MotorContext,
} from '@frontier/combat-math';
import { CharacterAction, SIM_DT } from '@frontier/shared-types';
import * as THREE from 'three';
import { BladeTrail } from '../combat/BladeTrail.ts';
import { CombatSystem } from '../combat/CombatSystem.ts';
import { DamageNumbers } from '../combat/DamageNumbers.ts';
import { HitSparks } from '../combat/HitSparks.ts';
import { DRILL_RADIUS, TrainingDummy } from '../combat/TrainingDummy.ts';
import {
  CRITICAL_STRIKE,
  FIRSTIA_TWIN_FANGS,
  PLAYER_BASE_STATS,
  SANDBOX_WORLD,
  TRAINING_DUMMY,
} from '../data/sandbox.ts';
import type { PlatformService } from '../platform/index.ts';
import { pushToast, useHud, type GameCommands } from '../ui/store.ts';
import { ArenaTerrain } from './ArenaTerrain.ts';
import { CameraRig } from './CameraRig.ts';
import { GameEvents } from './events.ts';
import { FixedStepLoop } from './FixedStepLoop.ts';
import { InputController } from './InputController.ts';
import { PhysicsWorld, loadRapier, type Rapier } from './PhysicsWorld.ts';
import { PlayerCharacter } from './PlayerCharacter.ts';
import { PlayerRig } from './PlayerRig.ts';
import { SceneManager } from './SceneManager.ts';
import { isTouchDevice, TouchControls } from './TouchControls.ts';

const ACTION_NAMES = ['free', 'dodge', 'attack', 'stagger', 'dead'] as const;
const HUD_SYNC_INTERVAL = 1 / 15;
const COMBO_WINDOW_MS = 2500;
const DPS_ENGAGEMENT_GAP_MS = 5000;
const PLAYER_SPAWN = { x: 0, y: 0, z: 7 };
const SLAM_STAGGER_TICKS = 14;

/** Phase 1 sandbox: the Firstia training grounds. Owns the loop and all subsystems. */
export class Game implements GameCommands {
  readonly events = new GameEvents();
  readonly #scene: SceneManager;
  readonly #physics: PhysicsWorld;
  readonly #player: PlayerCharacter;
  readonly #rig: PlayerRig;
  readonly #trails: BladeTrail[];
  readonly #dummy: TrainingDummy;
  readonly #camera: CameraRig;
  readonly #input: InputController;
  readonly #touch: TouchControls | null;
  readonly #combat: CombatSystem;
  readonly #sparks = new HitSparks();
  readonly #numbers: DamageNumbers;
  readonly #loop: FixedStepLoop;
  readonly #motorContext: MotorContext;
  readonly #abort = new AbortController();

  #phase: 'title' | 'playing' | 'paused' = 'title';
  #adBreak = false;
  #hudTimer = 0;
  #fpsFrames = 0;
  #fpsTimer = 0;
  #fps = 0;
  #debug = false;
  #combo = { count: 0, at: 0 };
  #engagement = { start: 0, last: 0, total: 0 };
  readonly #renderPos = new THREE.Vector3();
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
    new ArenaTerrain(this.#scene.scene, this.#physics);

    const stats = resolveStats(PLAYER_BASE_STATS, equipmentModifiers([FIRSTIA_TWIN_FANGS]), SANDBOX_WORLD);
    const combatStats = deriveCombatStats(stats);
    this.#motorContext = {
      moveset: DUAL_BLADES_MOVESET,
      tuning: DEFAULT_MOTOR_TUNING,
      speedMultiplier: combatStats.moveSpeed,
      dt: SIM_DT,
    };
    this.#player = new PlayerCharacter(this.#physics, PLAYER_SPAWN, combatStats, stats.maxHp, stats.maxStamina, this.#motorContext);

    this.#rig = new PlayerRig();
    this.#trails = this.#rig.bladeAnchors.map((a) => new BladeTrail(a.base, a.tip));
    this.#scene.scene.add(this.#rig.root, this.#sparks.points, ...this.#trails.map((t) => t.mesh));

    this.#dummy = new TrainingDummy(this.#scene.scene, this.#physics, TRAINING_DUMMY, new THREE.Vector3(0, 0, 0));
    this.#numbers = new DamageNumbers(overlayRoot);
    this.#camera = new CameraRig(this.#scene.camera, this.#physics, this.#player.collider);
    this.#input = new InputController(this.#scene.renderer.domElement);
    this.#touch = touch ? new TouchControls(overlayRoot, this.#input, () => this.pause()) : null;
    if (this.#touch) this.#touch.visible = false;
    this.#combat = new CombatSystem(this.#player, DUAL_BLADES_MOVESET, [this.#dummy], this.events, CRITICAL_STRIKE);

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

  /** Platform ad break: freeze everything until the ad ends. */
  setAdBreak(active: boolean): void {
    this.#adBreak = active;
    this.#applyRunState();
    useHud.setState({ adBreak: active });
  }

  dispose(): void {
    this.#loop.stop();
    this.#abort.abort();
    this.#input.dispose();
    this.#touch?.dispose();
    this.#numbers.dispose();
    this.#scene.dispose();
  }

  // --- Simulation (30 Hz) ----------------------------------------------------

  #step(): void {
    const input = this.#input.sampleFrame(this.#camera.yaw);
    const motorResult = this.#player.step(input);
    const dummyResult = this.#dummy.step(this.#player.pose());
    this.#physics.step();
    this.#player.syncFromPhysics();
    this.#combat.step();

    if (motorResult.events & MotorEvent.Exhausted) pushToast('Exhausted!', 'danger');
    if (dummyResult.slam) this.#resolveSlam();
  }

  #resolveSlam(): void {
    const pose = this.#player.pose();
    const distance = Math.hypot(pose.x - this.#dummy.pose.x, pose.z - this.#dummy.pose.z);
    this.#camera.addTrauma(distance < DRILL_RADIUS * 2 ? 0.35 : 0.1);
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

    const look = this.#input.consumeLook();
    this.#camera.applyLook(look.x, look.y);
    if (this.#phase === 'title') this.#camera.yaw += frameDt * 0.12; // attract-mode orbit

    const motor = this.#player.motor;
    const yaw = this.#player.renderPose(alpha, this.#renderPos);
    this.#rig.root.position.copy(this.#renderPos);
    this.#rig.root.rotation.y = yaw;
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

    this.#dummy.update(alpha, frameDt);
    this.#sparks.update(frameDt);
    this.#camera.update(this.#renderPos, frameDt, motor.sprinting && motor.action === CharacterAction.Free);
    this.#scene.followShadow(this.#renderPos);
    this.#scene.render();
    this.#numbers.update(this.#scene.camera, frameDt);

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
    if (this.#touch) this.#touch.visible = running;
  }

  #bindEvents(): void {
    const signal = this.#abort.signal;
    this.#input.bindHotkey('KeyT', () => this.toggleDrill());
    this.#input.bindHotkey('KeyG', () => this.toggleTracking());
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
    this.events.on('hit', (hit) => {
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
      if (kind === 'weakpoint') pushToast('WEAK POINT', 'gold');
      useHud.setState({ combo: { ...this.#combo } });
    });
    this.events.on('playerDamaged', ({ amount, staggered }) => {
      this.#numbers.spawn(this.#tmp.copy(this.#renderPos).setY(this.#renderPos.y + 2), `-${amount}`, 'player');
      this.#camera.addTrauma(0.6);
      if (staggered) pushToast('Staggered!', 'danger');
    });
    this.events.on('perfectDodge', ({ x, y, z }) => {
      this.#sparks.burst(x, y, z, 26, cyan, 6);
      this.#numbers.spawn(this.#tmp.set(x, y + 0.8, z), 'DODGE', 'miss');
      pushToast('PERFECT DODGE', 'cyan');
    });
    this.events.on('toast', ({ text, tone }) => pushToast(text, tone));
  }

  #syncHud(): void {
    const motor = this.#player.motor;
    const pose = this.#player.pose();
    const engaged = performance.now() - this.#engagement.last < DPS_ENGAGEMENT_GAP_MS;
    const elapsed = Math.max(1, (this.#engagement.last - this.#engagement.start) / 1000);
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
      },
    });
  }
}
