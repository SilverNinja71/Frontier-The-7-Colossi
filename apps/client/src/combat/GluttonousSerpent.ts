import {
  createSerpentState,
  reviveSerpent,
  segmentPosition,
  segmentRadius,
  SERPENT_TUNING,
  serpentActive,
  serpentHurtboxes,
  SerpentPhase,
  serpentStruck,
  serpentTargetable,
  stepSerpent,
  wakeSerpent,
  type DamageResult,
  type MeleeHit,
  type SerpentContext,
  type SerpentState,
  type SerpentStepResult,
} from '@frontier/combat-math';
import type { GroundPose, Hurtbox } from '@frontier/shared-types';
import * as THREE from 'three';
import { GLUTTONOUS_SERPENT } from '../data/sandbox.ts';
import { lerpAngle } from '../engine/PlayerCharacter.ts';
import type { CombatTarget, HitReceipt } from './CombatSystem.ts';
import { softDotTexture } from './textures.ts';

const N = SERPENT_TUNING.segments;
const MAX_POOLS = 16;
const SUCTION = 70;
/** Eyes flash white this many ticks before a bite lands: parry on white. */
const STRIKE_TELL_TICKS = 4;

/**
 * Look of the serpent, in one place so concept art can retune it (or a generated head model can
 * replace the procedural head) without touching the fight.
 */
export const SERPENT_LOOK = {
  back: '#3f5b2b',
  backAlt: '#4f6a2e',
  diamond: '#8a7a2a',
  belly: '#d2c08c',
  spine: '#2a2119',
  hood: '#6e3328',
  hoodVein: '#ff6a3a',
  eyeIdle: '#ffb21a',
  eyeParry: '#ffd36b',
  eyeStrike: '#ffffff',
  eyePeril: '#ff2a2a',
  eyeStunned: '#5a4a2a',
  acid: '#8cff3c',
  mouth: '#5a0d14',
} as const;

const IDENTITY: GroundPose = { x: 0, y: 0, z: 0, yaw: 0 };

/**
 * The Gluttonous Serpent in the world: renders the deterministic brain (combat-math/serpent.ts)
 * as a banded, thorn-spined body following the head's path, a horned head with an opening jaw
 * and a hood that flares in Frenzy, plus every telegraph (eye flash, tail ring, bile target,
 * inhale cone) and its acid pools.
 */
export class GluttonousSerpent {
  readonly id = 'gluttonous-serpent';
  readonly brain: SerpentState;
  /** Head pose: lock-on, enemy source for parry direction, audio. */
  readonly pose: GroundPose;
  readonly root = new THREE.Group();
  readonly hitTarget: CombatTarget;
  /** Events raised by the player's blows (Frenzy, Slain), collected for the game to read. */
  pendingEvents = 0;

  readonly #hurtboxes: Hurtbox[] = [];
  readonly #prevSeg = new Float32Array(N * 2);
  readonly #currSeg = new Float32Array(N * 2);
  readonly #prevHead = { x: 0, z: 0, yaw: 0 };
  readonly #body: THREE.InstancedMesh;
  readonly #spines: THREE.InstancedMesh;
  readonly #barb: THREE.Mesh;
  readonly #barbMaterial: THREE.MeshStandardMaterial;
  readonly #head = new THREE.Group();
  readonly #jaw = new THREE.Group();
  readonly #hood: THREE.Mesh[] = [];
  readonly #hoodMaterial: THREE.MeshStandardMaterial;
  readonly #eyeMaterial = new THREE.MeshBasicMaterial({ color: SERPENT_LOOK.eyeIdle });
  readonly #bodyMaterial: THREE.MeshStandardMaterial;
  readonly #ring: THREE.Mesh;
  readonly #cone: THREE.Mesh;
  readonly #glob: THREE.Mesh;
  readonly #pools: THREE.InstancedMesh;
  readonly #suction: THREE.Points;
  readonly #suctionPos = new Float32Array(SUCTION * 3);
  readonly #suctionSeed = Float32Array.from({ length: SUCTION * 2 }, () => Math.random());
  readonly #mound: THREE.Group;
  readonly #stars: THREE.Mesh[] = [];
  readonly #perilIcon: HTMLDivElement;
  readonly #matrix = new THREE.Matrix4();
  readonly #quat = new THREE.Quaternion();
  readonly #vec = new THREE.Vector3();
  readonly #scale = new THREE.Vector3();
  readonly #tmp = new THREE.Vector3();
  readonly #euler = new THREE.Euler();
  #time = 0;
  #emerge = -3;
  #slainFor = 0;
  #jawOpen = 0;
  #headLift = 0;
  #headPitch = 0;
  #hoodFlare = 0;

  constructor(
    scene: THREE.Scene,
    overlay: HTMLElement,
    home: { x: number; z: number; radius: number; floor: number },
  ) {
    this.brain = createSerpentState(home.x, home.z, home.floor, home.radius);
    this.pose = { x: home.x, y: home.floor, z: home.z, yaw: 0 };
    this.#snapshot(true);

    // Body: one stretched sphere per segment, dark back and cream belly via vertex colours,
    // banded per instance.
    const segment = new THREE.SphereGeometry(1, 18, 12);
    const position = segment.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const back = new THREE.Color(SERPENT_LOOK.back);
    const belly = new THREE.Color(SERPENT_LOOK.belly);
    const c = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      const x = position.getX(i);
      c.copy(belly).lerp(back, smoothstep(-0.55, 0.05, y));
      if (y > 0.55 && Math.abs(x) < 0.22) c.multiplyScalar(0.55); // dorsal stripe
      c.toArray(colors, i * 3);
    }
    segment.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.#bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
    this.#body = new THREE.InstancedMesh(segment, this.#bodyMaterial, N);
    // Bands: plain, mossy, a pale diamond, mossy (multiplied with the vertex colours).
    const tints = ['#ffffff', '#d4e3c2', '#f4dd94', '#d4e3c2'].map((hex) => new THREE.Color(hex));
    for (let i = 0; i < N; i++) this.#body.setColorAt(i, tints[i % 4]!);
    this.#body.castShadow = true;
    this.#body.receiveShadow = true;
    this.#body.frustumCulled = false;

    const spineGeometry = new THREE.ConeGeometry(0.16, 0.75, 5).translate(0, 0.37, 0);
    this.#spines = new THREE.InstancedMesh(spineGeometry, new THREE.MeshStandardMaterial({ color: SERPENT_LOOK.spine, roughness: 0.7, flatShading: true }), N);
    this.#spines.castShadow = true;
    this.#spines.frustumCulled = false;

    this.#barbMaterial = new THREE.MeshStandardMaterial({ color: SERPENT_LOOK.spine, emissive: '#ff2a1a', emissiveIntensity: 0, flatShading: true });
    this.#barb = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.5, 6).rotateX(Math.PI / 2), this.#barbMaterial);
    this.#barb.castShadow = true;

    this.#buildHead();
    this.#hoodMaterial = this.#hood[0]!.material as THREE.MeshStandardMaterial;

    // Telegraphs.
    const flat = (geometry: THREE.BufferGeometry, color: string, additive = false) => {
      const mesh = new THREE.Mesh(
        geometry.rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }),
      );
      mesh.renderOrder = 4;
      return mesh;
    };
    this.#ring = flat(new THREE.RingGeometry(0.9, 1, 72), '#ff2a3a');
    this.#cone = flat(new THREE.CircleGeometry(1, 32, Math.PI / 2 - (35 * Math.PI) / 180, (70 * Math.PI) / 180), '#b46cff', true);
    this.#glob = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: SERPENT_LOOK.acid }));
    this.#glob.visible = false;
    this.#pools = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: SERPENT_LOOK.acid, transparent: true, opacity: 0.55, depthWrite: false }),
      MAX_POOLS,
    );
    this.#pools.count = 0;
    this.#pools.renderOrder = 3;
    this.#pools.frustumCulled = false;

    const suctionGeometry = new THREE.BufferGeometry();
    suctionGeometry.setAttribute('position', new THREE.BufferAttribute(this.#suctionPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.#suction = new THREE.Points(
      suctionGeometry,
      new THREE.PointsMaterial({ color: '#d9b8ff', size: 0.3, map: softDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.#suction.frustumCulled = false;
    this.#suction.visible = false;

    // While it sleeps: a gravel mound with a few thorns poking through.
    this.#mound = new THREE.Group();
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#7a6d5a', roughness: 1, flatShading: true }),
    );
    mound.scale.y = 0.35;
    mound.receiveShadow = true;
    this.#mound.add(mound);
    for (let i = 0; i < 6; i++) {
      const thorn = new THREE.Mesh(spineGeometry, this.#spines.material as THREE.Material);
      const a = (i / 6) * Math.PI * 2;
      thorn.position.set(Math.sin(a) * 1.6, 0.6, Math.cos(a) * 1.6);
      thorn.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
      thorn.scale.setScalar(1.3);
      this.#mound.add(thorn);
    }
    this.#mound.position.set(home.x, home.floor - 0.05, home.z);

    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: '#ffe27a' }));
      star.visible = false;
      this.#stars.push(star);
    }

    this.#perilIcon = document.createElement('div');
    this.#perilIcon.className =
      'pointer-events-none fixed left-0 top-0 hidden font-black text-red-500 text-5xl [text-shadow:0_0_14px_rgb(255_0_0/0.9),0_2px_0_#000]';
    this.#perilIcon.textContent = '危';
    overlay.appendChild(this.#perilIcon);

    this.root.add(this.#body, this.#spines, this.#barb, this.#head);
    scene.add(this.root, this.#ring, this.#cone, this.#glob, this.#pools, this.#suction, this.#mound, ...this.#stars);
    this.root.visible = false;

    const self = this;
    this.hitTarget = {
      id: this.id,
      pose: IDENTITY,
      hurtboxes: this.#hurtboxes,
      defense: GLUTTONOUS_SERPENT.stats.defense,
      get targetable() {
        return serpentTargetable(self.brain);
      },
      receiveHit(hit: MeleeHit, damage: DamageResult): HitReceipt {
        const { applied, events } = serpentStruck(self.brain, hit.hurtbox.kind, damage.amount);
        self.pendingEvents |= events;
        return { applied, immune: applied === 0, reset: false, events: 0 };
      },
    };
  }

  get present(): boolean {
    return serpentActive(this.brain);
  }

  get targetable(): boolean {
    return serpentTargetable(this.brain);
  }

  get slain(): boolean {
    return this.brain.phase === SerpentPhase.Slain;
  }

  wake(target: GroundPose): number {
    const events = wakeSerpent(this.brain, target);
    this.#snapshot(true);
    return events;
  }

  revive(): void {
    reviveSerpent(this.brain);
    this.#slainFor = 0;
    this.#snapshot(true);
  }

  step(ctx: SerpentContext): SerpentStepResult {
    this.#prevHead.x = this.brain.x;
    this.#prevHead.z = this.brain.z;
    this.#prevHead.yaw = this.brain.yaw;
    this.#prevSeg.set(this.#currSeg);
    const result = stepSerpent(this.brain, ctx);
    this.#snapshot(false);
    return result;
  }

  lockPoint(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.brain.x, this.brain.y + 1.3, this.brain.z);
  }

  headPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.#head.getWorldPosition(out);
  }

  dispose(): void {
    this.#perilIcon.remove();
  }

  #snapshot(reset: boolean): void {
    const b = this.brain;
    this.pose.x = b.x;
    this.pose.z = b.z;
    this.pose.y = b.y;
    this.pose.yaw = b.yaw;
    const p = { x: 0, z: 0 };
    for (let i = 0; i < N; i++) {
      segmentPosition(b, i, p);
      this.#currSeg[i * 2] = p.x;
      this.#currSeg[i * 2 + 1] = p.z;
    }
    if (reset) {
      this.#prevSeg.set(this.#currSeg);
      Object.assign(this.#prevHead, { x: b.x, z: b.z, yaw: b.yaw });
    }
    serpentHurtboxes(b, this.#hurtboxes);
  }

  // --- Rendering -------------------------------------------------------------------

  update(alpha: number, dt: number, camera: THREE.Camera): void {
    this.#time += dt;
    const b = this.brain;
    const floor = b.y;
    this.#mound.visible = b.phase === SerpentPhase.Dormant;

    // Emerging, burrowing, collapsing.
    let targetEmerge = 0;
    if (b.phase === SerpentPhase.Dormant) targetEmerge = -3.2;
    else if (b.phase === SerpentPhase.Rising) targetEmerge = -3.2 + 3.2 * Math.min(1, b.phaseTick / SERPENT_TUNING.risingTicks);
    else if (b.phase === SerpentPhase.Retreating) targetEmerge = -3.2 * Math.min(1, b.phaseTick / SERPENT_TUNING.retreatTicks);
    if (b.phase === SerpentPhase.Slain) {
      this.#slainFor += dt;
      targetEmerge = this.#slainFor < 6 ? -0.35 : -0.35 - (this.#slainFor - 6) * 0.6;
    }
    this.#emerge = b.phase === SerpentPhase.Rising || b.phase === SerpentPhase.Retreating ? targetEmerge : damp(this.#emerge, targetEmerge, 6, dt);
    const visible = b.phase !== SerpentPhase.Dormant && !(b.phase === SerpentPhase.Slain && this.#slainFor > 12);
    this.root.visible = visible;
    this.#bodyMaterial.color.setScalar(b.phase === SerpentPhase.Slain ? Math.max(0.35, 1 - this.#slainFor * 0.2) : 1);

    // Interpolated head and segments.
    const hx = this.#prevHead.x + (b.x - this.#prevHead.x) * alpha;
    const hz = this.#prevHead.z + (b.z - this.#prevHead.z) * alpha;
    const yaw = lerpAngle(this.#prevHead.yaw, b.yaw, alpha);
    const moving = b.phase === SerpentPhase.Hunt || (b.phase === SerpentPhase.Attack && b.attack?.kind === 'bite');
    const wave = moving ? 0.38 : 0.12;
    let px = hx;
    let pz = hz;
    for (let i = 0; i < N; i++) {
      const sx = this.#prevSeg[i * 2]! + (this.#currSeg[i * 2]! - this.#prevSeg[i * 2]!) * alpha;
      const sz = this.#prevSeg[i * 2 + 1]! + (this.#currSeg[i * 2 + 1]! - this.#prevSeg[i * 2 + 1]!) * alpha;
      let dx = px - sx;
      let dz = pz - sz;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      // Lateral undulation (visual only), growing towards the tail.
      const sway = Math.sin(this.#time * (moving ? 5 : 1.6) - i * 0.55) * wave * (0.3 + i / N);
      const r = segmentRadius(i);
      const x = sx - dz * sway;
      const z = sz + dx * sway;
      const segYaw = Math.atan2(dx, dz);
      this.#vec.set(x, floor + r * 0.82 + this.#emerge, z);
      this.#quat.setFromEuler(this.#euler.set(0, segYaw, 0));
      this.#scale.set(r, r * 0.86, r * 1.38);
      this.#body.setMatrixAt(i, this.#matrix.compose(this.#vec, this.#quat, this.#scale));
      // Thorns on every other segment, raked backwards.
      const spine = i % 2 === 0 && i < N - 2 ? r * 1.1 : 0.0001;
      this.#vec.set(x, floor + r * 1.55 + this.#emerge, z);
      this.#quat.setFromEuler(this.#euler.set(-0.55, segYaw, 0, 'YXZ'));
      this.#scale.setScalar(spine);
      this.#spines.setMatrixAt(i, this.#matrix.compose(this.#vec, this.#quat, this.#scale));
      if (i === N - 1) {
        this.#barb.position.set(x - dx * 1.1, floor + r * 0.9 + this.#emerge, z - dz * 1.1);
        this.#barb.rotation.set(0, segYaw + Math.PI, 0);
      }
      px = sx;
      pz = sz;
    }
    this.#body.instanceMatrix.needsUpdate = true;
    this.#spines.instanceMatrix.needsUpdate = true;

    // Head pose by phase.
    const a = b.attack;
    const t = b.phase === SerpentPhase.Attack ? Math.max(0, b.phaseTick - 1 + alpha) : 0;
    const windup = b.windupTicks;
    let jaw = 0.08 + Math.sin(this.#time * 1.3) * 0.04;
    let lift = 0;
    let pitch = 0;
    let eye = new THREE.Color(SERPENT_LOOK.eyeIdle);
    let strike = false;
    let peril = false;
    if (b.phase === SerpentPhase.Rising) {
      lift = 0.6;
      jaw = 0.6;
      pitch = 0.35;
    } else if (b.phase === SerpentPhase.Stunned) {
      lift = -0.75;
      pitch = -0.25 + Math.sin(this.#time * 3) * 0.06;
      jaw = 0.35;
      eye = new THREE.Color(SERPENT_LOOK.eyeStunned);
    } else if (b.phase === SerpentPhase.Slain) {
      lift = -0.8;
      pitch = -0.3;
      jaw = 0.5;
      eye = new THREE.Color('#1a1a1a');
    } else if (a) {
      const inWindup = t < windup;
      const u = Math.min(1, t / Math.max(1, windup));
      switch (a.kind) {
        case 'bite':
          if (inWindup) {
            lift = 1.2 * u;
            pitch = 0.45 * u;
            jaw = 0.2 + 0.4 * u;
            strike = t >= windup - STRIKE_TELL_TICKS;
            eye = new THREE.Color(strike ? SERPENT_LOOK.eyeStrike : SERPENT_LOOK.eyeParry);
          } else {
            lift = 0.1;
            pitch = -0.15;
            jaw = t < windup + a.activeTicks ? 0.9 : 0.15;
          }
          break;
        case 'tail':
          peril = inWindup;
          eye = new THREE.Color(inWindup ? SERPENT_LOOK.eyePeril : SERPENT_LOOK.eyeIdle);
          lift = 0.3;
          break;
        case 'spit':
          peril = inWindup;
          lift = 0.9 * u;
          pitch = 0.3 * u;
          jaw = inWindup ? 0.2 + 0.5 * u : 0.7;
          eye = new THREE.Color(inWindup ? SERPENT_LOOK.eyePeril : SERPENT_LOOK.eyeIdle);
          break;
        case 'devour':
          peril = inWindup;
          lift = 1.0;
          pitch = 0.1;
          jaw = inWindup ? 0.3 + 0.7 * u : 1.15;
          eye = new THREE.Color(inWindup ? SERPENT_LOOK.eyePeril : SERPENT_LOOK.eyeIdle);
          break;
      }
    }
    this.#jawOpen = damp(this.#jawOpen, jaw, 14, dt);
    this.#headLift = damp(this.#headLift, lift, 10, dt);
    this.#headPitch = damp(this.#headPitch, pitch, 10, dt);
    this.#head.position.set(hx, floor + 1.15 + this.#headLift + this.#emerge, hz);
    this.#head.rotation.set(this.#headPitch, yaw, 0, 'YXZ');
    this.#jaw.rotation.x = -this.#jawOpen * 0.75;
    this.#eyeMaterial.color.lerp(eye, strike ? 1 : 1 - Math.exp(-dt * 18));
    this.#hoodFlare = damp(this.#hoodFlare, b.frenzy || (a?.kind === 'devour' && t >= windup) ? 1 : 0.35, 5, dt);
    for (const [i, hood] of this.#hood.entries()) {
      hood.scale.setScalar(0.6 + this.#hoodFlare * 0.55);
      hood.rotation.z = (i ? -1 : 1) * (0.25 + this.#hoodFlare * 0.4);
    }
    this.#hoodMaterial.emissiveIntensity = b.frenzy ? 0.6 + Math.sin(this.#time * 6) * 0.25 : 0.08;
    this.#barbMaterial.emissiveIntensity = a?.kind === 'tail' && t < windup ? 0.6 + 0.6 * Math.abs(Math.sin(this.#time * 14)) : 0;

    this.#updateTelegraphs(t, windup, dt);
    this.#updateStars(b.phase === SerpentPhase.Stunned);

    // 危 over the head while a perilous move winds up.
    this.#perilIcon.classList.toggle('hidden', !peril || !visible);
    if (peril && visible) {
      this.#head.getWorldPosition(this.#tmp).add(this.#vec.set(0, 2.3, 0)).project(camera);
      const sx = (this.#tmp.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-this.#tmp.y * 0.5 + 0.5) * window.innerHeight;
      const pulse = 1 + Math.sin(performance.now() * 0.03) * 0.12;
      this.#perilIcon.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${pulse.toFixed(3)})`;
      this.#perilIcon.style.display = this.#tmp.z > 1 ? 'none' : '';
    }
  }

  #updateTelegraphs(t: number, windup: number, dt: number): void {
    const b = this.brain;
    const a = b.attack;
    const ring = this.#ring.material as THREE.MeshBasicMaterial;
    const cone = this.#cone.material as THREE.MeshBasicMaterial;
    const blink = 0.35 + 0.4 * Math.abs(Math.sin(performance.now() * 0.018));
    ring.opacity = 0;
    cone.opacity = 0;
    this.#glob.visible = false;
    this.#suction.visible = false;
    if (a && b.phase === SerpentPhase.Attack) {
      const inWindup = t < windup;
      const u = Math.min(1, t / Math.max(1, windup));
      if (a.kind === 'tail' && inWindup) {
        const tail = segmentPosition(b, N - 1);
        this.#ring.position.set(tail.x, b.y + 0.06, tail.z);
        this.#ring.scale.setScalar(a.reach * (0.3 + 0.7 * u));
        ring.color.set('#ff2a3a');
        ring.opacity = blink;
      } else if (a.kind === 'spit' && t < windup + a.activeTicks) {
        this.#ring.position.set(b.aimX, b.y + 0.06, b.aimZ);
        this.#ring.scale.setScalar(a.reach * (0.5 + 0.5 * u));
        ring.color.set(SERPENT_LOOK.acid);
        ring.opacity = blink;
        // The glob flies for the last third of a second.
        const flight = Math.min(1, Math.max(0, (t - (windup - 10)) / 10));
        if (flight > 0 && inWindup) {
          this.#head.getWorldPosition(this.#tmp);
          this.#glob.position.set(
            this.#tmp.x + (b.aimX - this.#tmp.x) * flight,
            this.#tmp.y + (b.y + 0.3 - this.#tmp.y) * flight + Math.sin(flight * Math.PI) * 3,
            this.#tmp.z + (b.aimZ - this.#tmp.z) * flight,
          );
          this.#glob.visible = true;
        }
      } else if (a.kind === 'devour' && t < windup + a.activeTicks) {
        this.#cone.position.set(b.x, b.y + 0.07, b.z);
        this.#cone.rotation.y = b.yaw;
        this.#cone.scale.setScalar(a.reach);
        cone.opacity = inWindup ? 0.15 + 0.35 * u * blink : 0.32;
        if (!inWindup) this.#updateSuction(a.reach, dt);
      }
    }

    // Acid pools.
    const pools = b.pools.slice(0, MAX_POOLS);
    this.#pools.count = pools.length;
    pools.forEach((pool, i) => {
      const fade = Math.min(1, pool.ticks / 30);
      const bubble = 1 + Math.sin(this.#time * 5 + i) * 0.04;
      this.#vec.set(pool.x, b.y + 0.04 + i * 0.002, pool.z);
      this.#scale.set(SERPENT_TUNING.poolRadius * fade * bubble, 1, SERPENT_TUNING.poolRadius * fade * bubble);
      this.#pools.setMatrixAt(i, this.#matrix.compose(this.#vec, this.#quat.identity(), this.#scale));
    });
    this.#pools.instanceMatrix.needsUpdate = true;
  }

  /** Motes streaming into the open jaws while it inhales. */
  #updateSuction(reach: number, dt: number): void {
    const b = this.brain;
    this.#suction.visible = true;
    const fx = -Math.sin(b.yaw);
    const fz = -Math.cos(b.yaw);
    for (let i = 0; i < SUCTION; i++) {
      let u = this.#suctionSeed[i * 2]! - dt * 0.9;
      if (u <= 0) u += 1;
      this.#suctionSeed[i * 2] = u;
      const spread = (this.#suctionSeed[i * 2 + 1]! - 0.5) * 1.2 * u;
      const d = 1.2 + u * reach;
      this.#suctionPos[i * 3] = b.x + fx * d - fz * spread * d * 0.6;
      this.#suctionPos[i * 3 + 1] = b.y + 0.5 + u * 1.5 + Math.sin(i) * 0.3;
      this.#suctionPos[i * 3 + 2] = b.z + fz * d + fx * spread * d * 0.6;
    }
    this.#suction.geometry.attributes.position!.needsUpdate = true;
  }

  #updateStars(on: boolean): void {
    this.#head.getWorldPosition(this.#tmp);
    this.#stars.forEach((star, i) => {
      star.visible = on;
      if (!on) return;
      const a = this.#time * 4 + (i / 3) * Math.PI * 2;
      star.position.set(this.#tmp.x + Math.sin(a) * 1.1, this.#tmp.y + 1.4, this.#tmp.z + Math.cos(a) * 1.1);
      star.rotation.y = a * 2;
    });
  }

  #buildHead(): void {
    const plain = new THREE.MeshStandardMaterial({ color: SERPENT_LOOK.back, roughness: 0.55 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: SERPENT_LOOK.belly, roughness: 0.6 });
    const bone = new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: SERPENT_LOOK.spine, roughness: 0.7, flatShading: true });
    const mouth = new THREE.MeshStandardMaterial({ color: SERPENT_LOOK.mouth, roughness: 0.8, emissive: '#3a0508', emissiveIntensity: 0.6 });
    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geometry, material);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

    // Skull (faces -Z), brow ridges, horns.
    const skull = mesh(new THREE.SphereGeometry(1, 22, 14), plain, 0, 0.05, 0);
    skull.scale.set(1.05, 0.6, 1.55);
    this.#head.add(skull);
    for (const side of [-1, 1]) {
      const brow = mesh(new THREE.BoxGeometry(0.5, 0.16, 0.7), dark, side * 0.52, 0.48, -0.55);
      brow.rotation.set(0.15, side * 0.25, side * -0.2);
      this.#head.add(brow);
      const eyeBall = mesh(new THREE.SphereGeometry(0.17, 12, 8), this.#eyeMaterial, side * 0.66, 0.3, -0.78);
      eyeBall.castShadow = false;
      this.#head.add(eyeBall);
      const horn = mesh(new THREE.ConeGeometry(0.15, 1.15, 6), dark, side * 0.5, 0.55, 0.45);
      horn.rotation.set(1.15, 0, side * -0.3);
      this.#head.add(horn);
      const fang = mesh(new THREE.ConeGeometry(0.085, 0.62, 6), bone, side * 0.42, -0.28, -1.2);
      fang.rotation.x = Math.PI;
      this.#head.add(fang);
      // Hood: a ribbed membrane that flares in Frenzy.
      const hood = mesh(
        new THREE.CircleGeometry(1.5, 14, -Math.PI / 2, Math.PI),
        new THREE.MeshStandardMaterial({ color: SERPENT_LOOK.hood, emissive: SERPENT_LOOK.hoodVein, emissiveIntensity: 0.08, side: THREE.DoubleSide, roughness: 0.8 }),
        side * 0.85,
        0.15,
        0.9,
      );
      hood.rotation.y = side * Math.PI / 2;
      this.#hood.push(hood);
      this.#head.add(hood);
    }
    if (this.#hood[1]) this.#hood[1].material = this.#hood[0]!.material;

    // Jaw, hinged at the back of the skull.
    this.#jaw.position.set(0, -0.12, 0.65);
    const lower = mesh(new THREE.SphereGeometry(1, 18, 10), bellyMat, 0, -0.12, -1.25);
    lower.scale.set(0.92, 0.26, 1.35);
    this.#jaw.add(lower);
    const throat = mesh(new THREE.SphereGeometry(1, 14, 8), mouth, 0, 0.0, -1.1);
    throat.scale.set(0.75, 0.2, 1.1);
    this.#jaw.add(throat);
    for (const side of [-1, 1]) {
      const tooth = mesh(new THREE.ConeGeometry(0.05, 0.3, 5), bone, side * 0.45, 0.12, -2.0);
      this.#jaw.add(tooth);
    }
    this.#head.add(this.#jaw);
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function damp(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
