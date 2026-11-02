import {
  activeAttackStep,
  computeDamage,
  conditionMatches,
  DEFAULT_MOTOR_TUNING,
  deriveCombatStats,
  DAY_PERIODS,
  DeterministicRng,
  DUAL_BLADES_MOVESET,
  equipmentModifiers,
  MOVESETS,
  moonPhaseAt,
  MotorEvent,
  nextNewMoonNight,
  nightIndexAt,
  resolveStats,
  SANDBOX_DAY_SECONDS,
  StalkerEvent,
  StalkerPhase,
  stalkerAttackResolved,
  stalkerSawParry,
  stalkerTargetFell,
  timeOfDayAt,
  yawFromDirection,
  type DefenseOutcome,
  type MotorContext,
  type Moveset,
} from '@frontier/combat-math';
import {
  CharacterAction,
  InputButton,
  SIM_DT,
  type GroundPose,
  type TimeOfDay,
  type WorldConditions,
  type WeaponDefinition,
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
import {
  loadDiscovered,
  loadMarks,
  loadRecords,
  loadWeaponId,
  saveDiscovered,
  saveMarks,
  saveRecords,
  saveWeaponId,
  type HuntRecords,
} from '../data/progress.ts';
import {
  CRITICAL_STRIKE,
  FIRSTIA_TWIN_FANGS,
  MARK_OF_THE_NIGHT_LYCAON,
  PLAYER_BASE_STATS,
  SANDBOX_WEAPONS,
  SANDBOX_WORLD,
  SHADOW_STALKER,
  TRAINING_DUMMY,
} from '../data/sandbox.ts';
import type { PlatformService } from '../platform/index.ts';
import { announce, pushToast, useHud, type BossHud, type GameCommands, type HuntReport } from '../ui/store.ts';
import {
  ARENA_RADIUS,
  biomeAt,
  HeightGrid,
  inLake,
  LANDMARKS,
  nearestLandmark,
  WATER_LEVEL,
  type Biome,
  type Landmark,
} from '../world/geography.ts';
import { renderMapPixels } from '../world/map-image.ts';
import { ArenaTerrain } from './ArenaTerrain.ts';
import { CameraRig } from './CameraRig.ts';
import { loadPrivateSkin, type CharacterSkin } from './CharacterSkin.ts';
import { GameEvents } from './events.ts';
import { FixedStepLoop } from './FixedStepLoop.ts';
import { InputController } from './InputController.ts';
import { LockReticle } from './LockReticle.ts';
import { NatureKit } from './NatureKit.ts';
import { PhysicsWorld, loadRapier, type Rapier } from './PhysicsWorld.ts';
import { PlayerCharacter } from './PlayerCharacter.ts';
import { PlayerRig } from './PlayerRig.ts';
import { SceneManager } from './SceneManager.ts';
import { Landmarks } from './Landmarks.ts';
import { Terrain } from './Terrain.ts';
import { isTouchDevice, TouchControls } from './TouchControls.ts';
import { Water } from './Water.ts';
import { WorldScatter } from './WorldScatter.ts';

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
const DISCOVERY_INTERVAL_TICKS = 6;
/** Slower through Mirror Lake's shallows. */
const WADING_SPEED = 0.62;
const MAP_PIXELS = 384;

/** Running tally for the current Shadow Stalker hunt. */
interface HuntTally {
  startTick: number;
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
  lowestResolve: number;
  outcome: HuntReport['outcome'];
  markEarned: boolean;
}

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

/** The First Bastion training grounds: dummy by day, the Shadow Stalker on new-moon nights. */
export class Game implements GameCommands {
  readonly events = new GameEvents();
  readonly #scene: SceneManager;
  readonly #physics: PhysicsWorld;
  readonly #arena: ArenaTerrain;
  readonly #terrain: Terrain;
  readonly #scatter: WorldScatter;
  readonly #landmarks: Landmarks;
  readonly #water: Water;
  readonly #player: PlayerCharacter;
  readonly #rig: PlayerRig;
  readonly #bladeTrails: BladeTrail[];
  readonly #staffTrails: BladeTrail[];
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
  #weapon: WeaponDefinition = SANDBOX_WEAPONS.find((w) => w.id === loadWeaponId()) ?? FIRSTIA_TWIN_FANGS;
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
  #hunt: HuntTally | null = null;
  #records: HuntRecords = loadRecords();
  #reportOpen = false;
  #fledTonight = false;
  #lockTarget: Lockable | null = null;
  #marks: WorldMarkDefinition[];
  #discovered = new Set<string>(['firstia', ...loadDiscovered()]);
  #mapOpen = false;
  #wading = false;
  #rippleTimer = 0;
  #mapUrl: string | null = null;
  readonly #biome: Biome = { forest: 0, gloam: 0, highland: 0, amber: 0, mesa: 0 };
  readonly #renderPos = new THREE.Vector3();
  readonly #lockPoint = new THREE.Vector3();
  readonly #tmp = new THREE.Vector3();

  static async create(
    gameRoot: HTMLElement,
    overlayRoot: HTMLElement,
    platform: PlatformService,
    onProgress: (label: string) => void,
  ): Promise<Game> {
    onProgress('Loading physics and scenery…');
    const [rapier, kit, skin] = await Promise.all([
      loadRapier(),
      NatureKit.load(`${import.meta.env.BASE_URL}assets/nature/nature.glb`),
      loadPrivateSkin('wukong'),
    ]);
    onProgress('Shaping the Bramble Primeval…');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const grid = new HeightGrid();
    onProgress('Raising the training grounds…');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return new Game(gameRoot, overlayRoot, platform, rapier, kit, grid, skin);
  }

  private constructor(
    gameRoot: HTMLElement,
    overlayRoot: HTMLElement,
    private readonly platform: PlatformService,
    rapier: Rapier,
    private readonly kit: NatureKit | null,
    private readonly grid: HeightGrid,
    private readonly skin: CharacterSkin | null = null,
  ) {
    const touch = isTouchDevice();
    this.#scene = new SceneManager(gameRoot, { lowPower: touch });
    this.#physics = new PhysicsWorld(rapier, SIM_DT);
    this.#terrain = new Terrain(grid, this.#physics, this.#scene.renderer, touch);
    this.#arena = new ArenaTerrain(this.#scene.scene, this.#physics, { kit });
    this.#scatter = new WorldScatter(grid, this.#physics, kit, touch);
    this.#landmarks = new Landmarks(grid, this.#physics, kit);
    this.#water = new Water(this.#scene.scene, grid);
    this.#scene.scene.add(this.#terrain.group, this.#scatter.group, this.#landmarks.group);
    for (const id of this.#discovered) this.#landmarks.setAttuned(id, true);

    this.#motorContext = {
      moveset: movesetFor(this.#weapon),
      tuning: DEFAULT_MOTOR_TUNING,
      speedMultiplier: 1,
      dt: SIM_DT,
    };
    const baseStats = resolveStats(PLAYER_BASE_STATS, equipmentModifiers([this.#weapon]), SANDBOX_WORLD);
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
    this.#rig.setWeapon(this.#weapon.weaponClass === 'staff' ? 'staff' : 'blades');
    if (skin) this.#rig.applySkin(skin);
    this.#bladeTrails = this.#rig.bladeAnchors.map((a) => new BladeTrail(a.base, a.tip));
    this.#staffTrails = this.#rig.staffAnchors.map((a) => new BladeTrail(a.base, a.tip, '#ffd77a'));
    const trailMeshes = [...this.#bladeTrails, ...this.#staffTrails].map((t) => t.mesh);
    this.#scene.scene.add(this.#rig.root, this.#sparks.points, ...trailMeshes);

    this.#dummy = new TrainingDummy(this.#scene.scene, this.#physics, TRAINING_DUMMY, new THREE.Vector3(0, 0, 0));
    this.#stalker = new ShadowStalker(this.#scene.scene, this.#physics, overlayRoot);
    this.#numbers = new DamageNumbers(overlayRoot);
    this.#reticle = new LockReticle(overlayRoot);
    this.#camera = new CameraRig(this.#scene.camera, this.#physics, [this.#player.collider, this.#stalker.collider]);
    this.#input = new InputController(this.#scene.renderer.domElement);
    this.#touch = touch
      ? new TouchControls(overlayRoot, this.#input, {
          onPause: () => this.pause(),
          onLock: () => this.toggleLock(),
          onSwap: () => this.swapWeapon(),
          onMap: () => this.openMap(),
        })
      : null;
    if (this.#touch) this.#touch.visible = false;
    this.#combat = new CombatSystem(
      this.#player,
      this.#motorContext.moveset,
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
      records: this.#records,
      skill: { name: CRITICAL_STRIKE.name, level: 1, precisionHits: 0, goal: 1000, evolvesInto: 'Spiral Slash' },
    });
    if (skin && this.#weapon.weaponClass !== 'staff') this.#equip(SANDBOX_WEAPONS.find((w) => w.weaponClass === 'staff') ?? this.#weapon);
    this.#syncHud();
    this.#loop.start();
    setTimeout(() => this.#paintMap(), 0);
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

  /** Swap between the Twin Fangs and the Ruyi staff (only while not mid-move). */
  swapWeapon(): void {
    if (this.#player.motor.action !== CharacterAction.Free) {
      pushToast('Finish your move first', 'info');
      return;
    }
    const index = SANDBOX_WEAPONS.indexOf(this.#weapon);
    this.#equip(SANDBOX_WEAPONS[(index + 1) % SANDBOX_WEAPONS.length]!);
    pushToast(`${this.#weapon.name} · ${this.#motorContext.moveset.steps.length}-strike combo`, 'gold');
  }

  #equip(weapon: WeaponDefinition): void {
    this.#weapon = weapon;
    const moveset = movesetFor(weapon);
    this.#motorContext.moveset = moveset;
    this.#combat.moveset = moveset;
    this.#rig.setWeapon(weapon.weaponClass === 'staff' ? 'staff' : 'blades');
    saveWeaponId(weapon.id);
    this.#recomputeStats();
  }

  toggleStrikeDrill(): void {
    this.#dummy.strikeDrill = !this.#dummy.strikeDrill;
    pushToast(
      this.#dummy.strikeDrill ? 'Parry drill ON — parry when its head flashes white' : 'Parry drill OFF',
      'info',
    );
    this.#syncHud();
  }

  fleeToDawn(): void {
    if (!this.#stalker.present) return;
    this.#fledTonight = true;
    this.#worldTime = nightIndexAt(this.#worldTime) + DAY_PERIODS.dawn + 0.001;
    pushToast('You flee until dawn…', 'info');
  }

  /** Private character model on / off (dev only; see apps/client/private-assets). */
  toggleSkin(): void {
    if (!this.skin) return;
    if (this.#rig.skinName) {
      this.#rig.removeSkin();
      pushToast('Back to the hunter', 'info');
    } else {
      this.#rig.applySkin(this.skin);
      pushToast('Sun Wukong takes the field', 'gold');
    }
    this.#syncHud();
  }

  openMap(): void {
    if (this.#phase === 'paused') {
      // From the pause menu: the map replaces it.
      this.#phase = 'playing';
      this.platform.setAdContext('overworld');
      useHud.setState({ phase: 'playing' });
    }
    if (this.#phase !== 'playing' || this.#mapOpen || this.#reportOpen) return;
    this.#mapOpen = true;
    this.#input.exitPointerLock();
    this.platform.gameplayStop();
    this.#applyRunState();
    this.#syncHud();
    useHud.setState({ mapOpen: true });
  }

  closeMap(): void {
    if (!this.#mapOpen) return;
    this.#mapOpen = false;
    useHud.setState({ mapOpen: false });
    if (this.#phase === 'playing') {
      if (!this.#touch) this.#input.requestPointerLock();
      this.platform.gameplayStart();
    }
    this.#applyRunState();
  }

  /**
   * Dev-only (window.__game in `npm run dev`): jump to a landmark's waystone for testing.
   * The world itself has no fast travel; it is walked.
   */
  debugTeleport(landmarkId: string): void {
    if (this.#player.dead) return;
    const point = this.#landmarks.spawnPoint(landmarkId);
    const landmark = LANDMARKS.find((l) => l.id === landmarkId);
    if (!point || !landmark) return;
    // Arrive facing away from the waystone, towards the landmark proper.
    const yaw = landmarkId === 'firstia' ? 0 : yawFromDirection(landmark.x - point.x, landmark.z - point.z - 0.001);
    this.#player.teleport(point, yaw);
    this.#camera.resetBehind(yaw);
    this.#setLock(null);
    this.closeMap();
  }

  closeReport(): void {
    if (!this.#reportOpen) return;
    this.#reportOpen = false;
    useHud.setState({ report: null });
    if (this.#phase === 'playing') {
      if (!this.#touch) this.#input.requestPointerLock();
      this.platform.setAdContext('overworld');
      this.platform.gameplayStart();
    }
    this.#applyRunState();
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
    const feet = this.#player.pose();
    this.#wading = feet.y < WATER_LEVEL - 0.2 && inLake(feet.x, feet.z);
    this.#motorContext.speedMultiplier = this.#player.stats.moveSpeed * (this.#wading ? WADING_SPEED : 1);
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
    const stalkerOutcome = this.#combat.resolveEnemyHit(this.#stalker, stalkerResult.hit, SHADOW_STALKER.stats);
    if (stalkerOutcome) this.#onStalkerOutcome(stalkerOutcome);
    const drillOutcome = this.#combat.resolveEnemyHit(this.#dummy, dummyResult.strike, TRAINING_DUMMY.stats);
    if (drillOutcome) this.#onDrillOutcome(drillOutcome);

    // No natural healing mid-hunt, and every fall feeds it.
    this.#player.regenBlocked = this.#stalker.present;
    const dead = this.#player.dead;
    if (this.#loop.tick % DISCOVERY_INTERVAL_TICKS === 0 && !dead) this.#checkDiscovery();
    if (dead && !this.#wasDead) {
      // Rise again at the nearest attuned waystone.
      const p = this.#player.pose();
      const home = nearestLandmark(p.x, p.z, (l) => this.#discovered.has(l.id));
      const spawn = home ? this.#landmarks.spawnPoint(home.id) : null;
      if (spawn) this.#player.spawn = spawn;
      let fed = 0;
      if (this.#stalker.targetable) {
        this.#fellTonight = true;
        fed = stalkerTargetFell(this.#stalker.brain);
        if (this.#hunt) this.#hunt.falls++;
      }
      useHud.setState({ fallen: { fed } });
    } else if (!dead && this.#wasDead) {
      useHud.setState({ fallen: null });
    }
    this.#wasDead = dead;
    if (this.#hunt) {
      this.#hunt.lowestResolve = Math.min(this.#hunt.lowestResolve, this.#stalker.brain.resolve);
      if (!this.#stalker.present) this.#endHunt();
    }

    const pose = this.#player.pose();
    const at = { x: pose.x, y: pose.y + 1.2, z: pose.z };
    if (motorResult.events & MotorEvent.AttackStarted) {
      this.#audio.play(this.#rig.weapon === 'staff' ? 'staff' : 'swing', at, 0.8 + this.#player.motor.comboStep * 0.15);
    }
    if (motorResult.events & MotorEvent.DodgeStarted) this.#audio.play('dodge', at);
    if (motorResult.events & MotorEvent.ParryStarted) {
      this.#audio.play('whiff', at);
      this.#combat.onParryStarted();
      if (this.#stalker.present) this.#onStalkerEvents(stalkerSawParry(this.#stalker.brain));
    }
    if (motorResult.events & MotorEvent.Exhausted) pushToast('Exhausted!', 'danger');
    if (dummyResult.slam) this.#resolveSlam();
    if (stalkerResult.events) this.#onStalkerEvents(stalkerResult.events);

    const hit = stalkerResult.hit;
    if (hit && hit.attack.arcDegrees >= 360 && hit.serial !== this.#shockSerial) {
      this.#shockSerial = hit.serial;
      this.#stalker.shockwave(hit.pose.x, hit.pose.z, hit.attack.reach, hit.pose.y);
      this.#audio.play('slam', { x: hit.pose.x, y: hit.pose.y + 0.5, z: hit.pose.z });
      this.#camera.addTrauma(0.45);
    }
  }

  #summonStalker(): void {
    const p = this.#player.pose();
    let x: number;
    let z: number;
    if (Math.hypot(p.x, p.z) < ARENA_RADIUS) {
      // In the ring: emerge on the far side of the arena centre from the player.
      const angle = Math.atan2(p.x, p.z) + Math.PI;
      x = Math.sin(angle) * STALKER_EMERGE_DISTANCE;
      z = Math.cos(angle) * STALKER_EMERGE_DISTANCE;
    } else {
      // Out in the wilds: it finds you, rising where you are looking.
      x = p.x - Math.sin(this.#camera.yaw) * STALKER_EMERGE_DISTANCE;
      z = p.z - Math.cos(this.#camera.yaw) * STALKER_EMERGE_DISTANCE;
    }
    const y = Math.hypot(x, z) < ARENA_RADIUS ? 0 : this.grid.sample(x, z) + 0.05;
    this.#stalkerNight = nightIndexAt(this.#worldTime);
    this.#fellTonight = false;
    this.#fledTonight = false;
    this.#hunt = {
      startTick: this.#loop.tick,
      perfectParries: 0,
      bestChain: 0,
      early: 0,
      late: 0,
      guards: 0,
      dodges: 0,
      hitsTaken: 0,
      falls: 0,
      exposures: 0,
      eclipse: false,
      lowestResolve: SHADOW_STALKER.stats.maxHp,
      outcome: 'faded',
      markEarned: false,
    };
    this.#onStalkerEvents(this.#stalker.summon(x, z, yawFromDirection(p.x - x, p.z - z), y));
  }

  #onStalkerEvents(flags: number): void {
    const stalker = this.#stalker;
    const at = { x: stalker.pose.x, y: stalker.pose.y + 1.6, z: stalker.pose.z };
    if (flags & StalkerEvent.Emerged) {
      announce('World event', 'The Shadow Stalker stirs', 'A Unique Colossus hunts beneath the new moon. Blades cannot wound it. Parry.');
      this.#audio.play('gong');
      this.#audio.play('howl', at);
    }
    if (flags & StalkerEvent.TelegraphParryable) this.#audio.play('growl', at, 0.8);
    if (flags & StalkerEvent.TelegraphPerilous) {
      this.#audio.play(stalker.brain.attack?.id === 'moonless-howl' ? 'howl' : 'growl', at, 1.2);
    }
    if (flags & StalkerEvent.Wary) {
      pushToast('It has read your rhythm. Stop mashing parry.', 'danger');
    }
    if (flags & StalkerEvent.Eclipsed) {
      if (this.#hunt) this.#hunt.eclipse = true;
      announce('Eclipse', "The Shadow Stalker's eyes burn", 'Half its Resolve is gone. It hunts in earnest now.');
      this.#audio.play('howl', at, 1.3);
      this.#camera.addTrauma(0.5);
    }
    if (flags & StalkerEvent.Exposed) {
      if (this.#hunt) this.#hunt.exposures++;
      pushToast('EXPOSED · STRIKE THE HEART', 'gold');
      this.#audio.play('crit', at);
      this.#camera.addTrauma(0.3);
    }
    if (flags & StalkerEvent.Subdued) {
      const fresh = this.#grantMark();
      if (this.#hunt) Object.assign(this.#hunt, { outcome: 'subdued', markEarned: fresh });
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
      if (this.#fledTonight) {
        announce('Dawn breaks', 'You fled the hunt', 'The mark only answers to those who endure the whole night.');
      } else if (this.#fellTonight) {
        announce('Dawn breaks', 'The Shadow Stalker fades', 'You fell tonight. Survive a whole new-moon night unbroken to earn its mark.');
      } else {
        const fresh = this.#grantMark();
        if (this.#hunt) Object.assign(this.#hunt, { outcome: 'survived', markEarned: fresh });
        announce(
          'Dawn breaks',
          'You survived the Shadow Stalker',
          fresh ? `Mark acquired: ${MARK_OF_THE_NIGHT_LYCAON.name}` : 'It fades with the night… for now.',
        );
      }
      this.#audio.play('gong');
    }
  }

  /** Bookkeeping after the player met one of the Stalker's blows. */
  #onStalkerOutcome(outcome: DefenseOutcome): void {
    const brain = this.#stalker.brain;
    const { resolveDamage, events } = stalkerAttackResolved(brain, outcome);
    const hunt = this.#hunt;
    if (outcome === 'parried') {
      const chain = brain.parryChain;
      const goal = SHADOW_STALKER.defeatCondition.kind === 'parry-chain' ? SHADOW_STALKER.defeatCondition.requiredChain : chain;
      this.#numbers.spawn(this.#tmp.copy(this.#renderPos).setY(this.#renderPos.y + 2.6), `CHAIN ${Math.min(chain, goal)}/${goal}`, 'parry');
      if (resolveDamage > 0) {
        this.#stalker.headPosition(this.#tmp);
        this.#numbers.spawn(this.#tmp.setY(this.#tmp.y + 0.6), `${resolveDamage}`, 'critical');
      }
      if (hunt) {
        hunt.perfectParries++;
        hunt.bestChain = Math.max(hunt.bestChain, chain);
      }
    } else if (hunt) {
      if (outcome === 'guarded') hunt.guards++;
      else if (outcome === 'dodged') hunt.dodges++;
      else hunt.hitsTaken++;
    }
    if (events) this.#onStalkerEvents(events);
  }

  #onDrillOutcome(outcome: DefenseOutcome): void {
    const streak = this.#dummy.drillOutcome(outcome);
    if (outcome === 'parried' && streak > 0 && streak % 5 === 0) {
      pushToast(streak >= 15 ? `Drill streak ${streak} — ready for the new moon` : `Drill streak ${streak}`, 'gold');
    }
  }

  /** The Stalker left the world: close the tally, update records, show the Hunt Report. */
  #endHunt(): void {
    const hunt = this.#hunt;
    if (!hunt) return;
    this.#hunt = null;
    const maxResolve = SHADOW_STALKER.stats.maxHp;
    const seconds = Math.round((this.#loop.tick - hunt.startTick) * SIM_DT);
    const resolveBroken = hunt.outcome === 'subdued' ? 1 : 1 - hunt.lowestResolve / maxResolve;
    const records = this.#records;
    const newBests: string[] = [];
    if (resolveBroken > records.bestResolveBroken + 1e-6) newBests.push('resolve');
    if (hunt.bestChain > records.bestChain) newBests.push('chain');
    if (hunt.outcome === 'subdued' && (records.fastestSubdueSeconds === null || seconds < records.fastestSubdueSeconds)) {
      newBests.push('time');
    }
    this.#records = {
      hunts: records.hunts + 1,
      subdued: records.subdued + (hunt.outcome === 'subdued' ? 1 : 0),
      survived: records.survived + (hunt.outcome === 'survived' ? 1 : 0),
      bestResolveBroken: Math.max(records.bestResolveBroken, resolveBroken),
      bestChain: Math.max(records.bestChain, hunt.bestChain),
      fastestSubdueSeconds: newBests.includes('time') ? seconds : records.fastestSubdueSeconds,
    };
    saveRecords(this.#records);

    const report: HuntReport = {
      outcome: hunt.outcome,
      seconds,
      resolveBroken,
      perfectParries: hunt.perfectParries,
      bestChain: hunt.bestChain,
      early: hunt.early,
      late: hunt.late,
      guards: hunt.guards,
      dodges: hunt.dodges,
      hitsTaken: hunt.hitsTaken,
      falls: hunt.falls,
      exposures: hunt.exposures,
      eclipse: hunt.eclipse,
      markEarned: hunt.markEarned,
      newBests,
    };
    useHud.setState({ report, records: this.#records });
    if (this.#phase === 'playing') {
      this.#reportOpen = true;
      this.#input.exitPointerLock();
      this.platform.gameplayStop();
      this.platform.setAdContext('menu');
      this.#applyRunState();
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
    const modifiers = [...equipmentModifiers([this.#weapon]), ...this.#marks.flatMap((m) => m.modifiers)];
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
    this.#landmarks.update(now, night);
    this.#water.update(now, frameDt, this.#scene.horizonColor, this.#scene.lightDirection, this.#scene.sun.color, this.#daylight);
    this.kit?.tick(now);
    this.#audio.setNight(night);

    this.#input.pollGamepad(frameDt);
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
        moveset: this.#motorContext.moveset,
        tuning: DEFAULT_MOTOR_TUNING,
        alpha,
        groundSpeed: this.#player.groundSpeed,
        invulnerable: this.#player.invulnerable,
      },
      frameDt,
    );

    const active = activeAttackStep(motor, this.#motorContext.moveset);
    const staff = this.#rig.weapon === 'staff';
    const leadBlade = active?.id.endsWith('2') ? 1 : 0;
    this.#bladeTrails.forEach((trail, i) => trail.update(!staff && !!active && (active.arcDegrees >= 360 || i === leadBlade), frameDt));
    for (const trail of this.#staffTrails) trail.update(staff && !!active, frameDt);

    this.#scatter.update(this.#renderPos.x, this.#renderPos.z);
    if (this.#wading && this.#player.groundSpeed > 0.5 && this.#phase === 'playing') {
      this.#rippleTimer -= frameDt;
      if (this.#rippleTimer <= 0) {
        this.#rippleTimer = 0.32;
        this.#water.ripple(this.#renderPos.x, this.#renderPos.z);
      }
    }

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
    const running = this.#phase === 'playing' && !this.#adBreak && !this.#reportOpen && !this.#mapOpen;
    this.#loop.paused = this.#phase === 'paused' || this.#adBreak || this.#reportOpen || this.#mapOpen;
    this.#input.enabled = running;
    this.#audio.setPaused(!running);
    if (this.#touch) this.#touch.visible = running;
  }

  #bindEvents(): void {
    const signal = this.#abort.signal;
    this.#input.bindHotkey('KeyT', () => this.toggleDrill());
    this.#input.bindHotkey('KeyG', () => this.toggleTracking());
    this.#input.bindHotkey('KeyY', () => this.toggleStrikeDrill());
    this.#input.bindHotkey('KeyQ', () => this.#phase === 'playing' && this.swapWeapon());
    this.#input.bindHotkey('PadY', () => this.#phase === 'playing' && this.swapWeapon());
    this.#input.bindHotkey('PadR3', () => this.#phase === 'playing' && this.toggleLock());
    const toggleMap = () => {
      if (this.#mapOpen) this.closeMap();
      else this.openMap();
    };
    this.#input.bindHotkey('KeyM', toggleMap);
    this.#input.bindHotkey('PadBack', toggleMap);
    this.#input.bindHotkey('Escape', () => this.closeMap());
    this.#input.bindHotkey('PadStart', () => {
      if (this.#mapOpen) this.closeMap();
      else if (this.#reportOpen) this.closeReport();
      else if (this.#phase === 'playing') this.pause();
      else if (this.#phase === 'paused') this.resume();
      else this.play();
    });
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
        if (!this.#input.pointerLocked && this.#phase === 'playing' && !this.#touch && !this.#mapOpen && !this.#reportOpen) this.pause();
      },
      { signal },
    );
    document.addEventListener('visibilitychange', () => document.hidden && this.pause(), { signal });
    this.#scene.renderer.domElement.addEventListener(
      'click',
      () => {
        if (this.#phase === 'playing' && !this.#touch && !this.#input.pointerLocked && !this.#mapOpen && !this.#reportOpen) {
          this.#input.requestPointerLock();
        }
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
    this.events.on('parry', ({ x, y, z }) => {
      this.#sparks.burst(x, y, z, 34, gold, 9);
      this.#sparks.burst(x, y, z, 14, white, 5);
      this.#numbers.spawn(this.#tmp.set(x, y + 0.6, z), 'PARRY', 'parry');
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
      if (broken) pushToast('Guard broken!', 'danger');
    });
    this.events.on('parryTiming', ({ kind, ms }) => {
      if (kind === 'perfect') return; // the PARRY burst says it all
      if (this.#hunt && kind !== 'angle') this.#hunt[kind]++;
      const label = kind === 'early' ? `EARLY · ${ms} ms` : kind === 'late' ? `LATE · ${ms} ms` : 'FACE THE BLOW';
      this.#numbers.spawn(this.#tmp.copy(this.#renderPos).setY(this.#renderPos.y + 2.3), label, kind === 'late' ? 'late' : 'early');
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

  #checkDiscovery(): void {
    const p = this.#player.pose();
    for (const landmark of LANDMARKS) {
      if (this.#discovered.has(landmark.id)) continue;
      if (Math.hypot(landmark.x - p.x, landmark.z - p.z) > landmark.radius) continue;
      this.#discover(landmark);
    }
  }

  #discover(landmark: Landmark): void {
    this.#discovered.add(landmark.id);
    saveDiscovered([...this.#discovered]);
    this.#landmarks.setAttuned(landmark.id, true);
    const found = this.#discovered.size;
    announce(`Discovered · ${found}/${LANDMARKS.length}`, landmark.name, `${landmark.blurb} Its waystone wakes: you will rise here.`);
    this.#audio.play('discover');
    if (found === LANDMARKS.length) pushToast('Every corner of the Bramble Primeval found', 'gold');
  }

  #regionName(x: number, z: number, y: number): string {
    const near = LANDMARKS.find((l) => Math.hypot(l.x - x, l.z - z) < l.radius * 1.5);
    if (near) return near.name;
    const b = biomeAt(x, z, y, this.#biome);
    if (inLake(x, z)) return 'Mirror Lake';
    if (b.gloam > 0.5) return 'The Gloamwood';
    if (b.mesa > 0.5) return 'Windcut Mesa';
    if (b.highland > 0.5) return 'Howling Ridge';
    if (b.amber > 0.5) return 'Amber Meadow';
    if (b.forest > 0.5) return 'Bramble Woods';
    return 'The Bramble Primeval';
  }

  /** Paint the world map once, off the critical path. */
  #paintMap(): void {
    const pixels = renderMapPixels(this.grid, MAP_PIXELS);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MAP_PIXELS;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(pixels, MAP_PIXELS, MAP_PIXELS), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      this.#mapUrl = URL.createObjectURL(blob);
      this.#syncHud();
    });
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
        strikeDrill: this.#dummy.strikeDrill,
        drillStreak: this.#dummy.drillStreak,
        drillBest: this.#dummy.drillBest,
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
      weapon: { name: this.#weapon.name, moves: this.#motorContext.moveset.steps.map((step) => step.name) },
      skin: { available: this.skin !== null, active: this.#rig.skinName !== null },
      explore: {
        mapUrl: this.#mapUrl,
        x: pose.x,
        z: pose.z,
        facing: motor.facingYaw,
        cameraYaw: this.#camera.yaw,
        discovered: [...this.#discovered],
        region: this.#regionName(pose.x, pose.z, pose.y),
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
        stalker: this.#stalker.present
          ? `${STALKER_PHASE_NAMES[brain.phase]}${brain.attack ? `:${brain.attack.id}` : ''} @${Math.hypot(brain.x - pose.x, brain.z - pose.z).toFixed(1)}m`
          : 'dormant',
      },
    });
  }
}

function movesetFor(weapon: WeaponDefinition): Moveset {
  return MOVESETS[weapon.movesetId] ?? DUAL_BLADES_MOVESET;
}
