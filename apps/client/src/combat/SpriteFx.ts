import * as THREE from 'three';
import { softDotTexture } from './textures.ts';

/** Cells of the particle atlas (apps/asset-pipeline build-vfx.ts writes the name → cell map). */
export type SpriteName =
  | 'star4'
  | 'starX'
  | 'burst'
  | 'glint'
  | 'ring'
  | 'dot'
  | 'streak'
  | 'slash'
  | 'impact'
  | 'compass'
  | 'runes'
  | 'halo'
  | 'debris'
  | 'puffA'
  | 'puffB'
  | 'puffC';

export interface ParticleAtlas {
  texture: THREE.Texture;
  grid: number;
  frames: Partial<Record<SpriteName, number>>;
}

/** Loads the atlas; on failure every sprite becomes a soft dot (effects still read, just plainer). */
export async function loadParticleAtlas(baseUrl: string): Promise<ParticleAtlas> {
  try {
    const [manifest, texture] = await Promise.all([
      fetch(`${baseUrl}particles.json`).then((r) =>
        r.ok ? (r.json() as Promise<{ grid: number; sprites: Record<string, number> }>) : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      new THREE.TextureLoader().loadAsync(`${baseUrl}particles.webp`),
    ]);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return { texture, grid: manifest.grid, frames: manifest.sprites };
  } catch (error) {
    console.warn('[vfx] particle atlas unavailable, using soft dots:', error);
    return { texture: softDotTexture(), grid: 1, frames: {} };
  }
}

export interface SpriteSpawn {
  sprite: SpriteName;
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Seconds. */
  life: number;
  /** Metres at birth and at death. */
  size: number;
  sizeEnd?: number;
  color: THREE.Color;
  alpha?: number;
  /** m/s² downward. */
  gravity?: number;
  /** Velocity damping per second (0 = none). */
  drag?: number;
  rot?: number;
  spin?: number;
  /** Streaks: length grows with speed and the sprite turns to face its motion. */
  stretch?: number;
  /** Lie flat on the ground instead of facing the camera. */
  flat?: boolean;
  /** Glow (added) instead of smoke (blended). */
  additive?: boolean;
}

const VERTEX = /* glsl */ `
attribute vec3 iPos;
attribute vec2 iSize;
attribute float iRot;
attribute float iFrame;
attribute vec4 iColor;
attribute float iFlat;
uniform float uGrid;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec2 c = position.xy;
  float s = sin(iRot);
  float k = cos(iRot);
  vec2 q = vec2(c.x * k - c.y * s, c.x * s + c.y * k) * iSize;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 world = iFlat > 0.5 ? iPos + vec3(q.x, 0.0, q.y) : iPos + right * q.x + up * q.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  float col = mod(iFrame, uGrid);
  float row = floor(iFrame / uGrid);
  vUv = (vec2(col, uGrid - 1.0 - row) + c + 0.5) / uGrid;
  vColor = iColor;
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(uMap, vUv);
  gl_FragColor = vec4(t.rgb * vColor.rgb, t.a * vColor.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** One batch of particles sharing a blend mode: CPU simulation, one instanced draw. */
class Pool {
  readonly mesh: THREE.Mesh;
  readonly #geometry = new THREE.InstancedBufferGeometry();
  readonly #capacity: number;
  #count = 0;
  // Simulation state (struct of arrays).
  readonly #pos: Float32Array;
  readonly #vel: Float32Array;
  readonly #age: Float32Array;
  readonly #life: Float32Array;
  readonly #size: Float32Array; // start, end
  readonly #rot: Float32Array; // angle, spin
  readonly #phys: Float32Array; // gravity, drag, stretch
  readonly #color: Float32Array; // r, g, b, alpha
  readonly #frame: Float32Array;
  readonly #flat: Uint8Array;
  // GPU attributes.
  readonly #iPos: THREE.InstancedBufferAttribute;
  readonly #iSize: THREE.InstancedBufferAttribute;
  readonly #iRot: THREE.InstancedBufferAttribute;
  readonly #iFrame: THREE.InstancedBufferAttribute;
  readonly #iColor: THREE.InstancedBufferAttribute;
  readonly #iFlat: THREE.InstancedBufferAttribute;

  constructor(capacity: number, atlas: ParticleAtlas, additive: boolean) {
    this.#capacity = capacity;
    this.#pos = new Float32Array(capacity * 3);
    this.#vel = new Float32Array(capacity * 3);
    this.#age = new Float32Array(capacity);
    this.#life = new Float32Array(capacity);
    this.#size = new Float32Array(capacity * 2);
    this.#rot = new Float32Array(capacity * 2);
    this.#phys = new Float32Array(capacity * 3);
    this.#color = new Float32Array(capacity * 4);
    this.#frame = new Float32Array(capacity);
    this.#flat = new Uint8Array(capacity);

    const g = this.#geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const attr = (size: number) => new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size).setUsage(THREE.DynamicDrawUsage);
    this.#iPos = attr(3);
    this.#iSize = attr(2);
    this.#iRot = attr(1);
    this.#iFrame = attr(1);
    this.#iColor = attr(4);
    this.#iFlat = attr(1);
    g.setAttribute('iPos', this.#iPos);
    g.setAttribute('iSize', this.#iSize);
    g.setAttribute('iRot', this.#iRot);
    g.setAttribute('iFrame', this.#iFrame);
    g.setAttribute('iColor', this.#iColor);
    g.setAttribute('iFlat', this.#iFlat);
    g.instanceCount = 0;

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { uMap: { value: atlas.texture }, uGrid: { value: atlas.grid } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
  }

  spawn(p: SpriteSpawn, frame: number): void {
    // Full: overwrite the oldest-born slot (index 0 after compaction keeps age order roughly).
    const i = this.#count < this.#capacity ? this.#count++ : Math.floor(Math.random() * this.#capacity);
    this.#pos.set([p.x, p.y, p.z], i * 3);
    this.#vel.set([p.vx ?? 0, p.vy ?? 0, p.vz ?? 0], i * 3);
    this.#age[i] = 0;
    this.#life[i] = p.life;
    this.#size.set([p.size, p.sizeEnd ?? p.size], i * 2);
    this.#rot.set([p.rot ?? Math.random() * Math.PI * 2, p.spin ?? 0], i * 2);
    this.#phys.set([p.gravity ?? 0, p.drag ?? 0, p.stretch ?? 0], i * 3);
    this.#color.set([p.color.r, p.color.g, p.color.b, p.alpha ?? 1], i * 4);
    this.#frame[i] = frame;
    this.#flat[i] = p.flat ? 1 : 0;
  }

  clear(): void {
    this.#count = 0;
    this.#geometry.instanceCount = 0;
  }

  update(dt: number, right: THREE.Vector3, up: THREE.Vector3, additive: boolean): void {
    let n = 0;
    for (let i = 0; i < this.#count; i++) {
      const age = this.#age[i]! + dt;
      const life = this.#life[i]!;
      if (age >= life) continue;
      if (n !== i) this.#move(i, n);
      this.#age[n] = age;
      const k = n * 3;
      const gravity = this.#phys[k]!;
      const drag = this.#phys[k + 1]!;
      const stretch = this.#phys[k + 2]!;
      this.#vel[k + 1]! -= gravity * dt;
      const damp = Math.exp(-drag * dt);
      for (let a = 0; a < 3; a++) {
        this.#vel[k + a]! *= damp;
        this.#pos[k + a]! += this.#vel[k + a]! * dt;
      }
      this.#rot[n * 2]! += this.#rot[n * 2 + 1]! * dt;

      const t = age / life;
      const size = this.#size[n * 2]! + (this.#size[n * 2 + 1]! - this.#size[n * 2]!) * t;
      let width = size;
      let height = size;
      let angle = this.#rot[n * 2]!;
      if (stretch > 0) {
        const vx = this.#vel[k]!;
        const vy = this.#vel[k + 1]!;
        const vz = this.#vel[k + 2]!;
        const sr = vx * right.x + vy * right.y + vz * right.z;
        const su = vx * up.x + vy * up.y + vz * up.z;
        height = size * (1 + Math.hypot(sr, su) * stretch);
        width = size * 0.35;
        angle = Math.atan2(su, sr) - Math.PI / 2;
      }
      // Glows flash in and burn out; smoke swells in and thins away.
      const fade = additive ? Math.min(1, t * 14) * (1 - t) ** 1.4 : Math.min(1, t * 6) * (1 - t);
      this.#iPos.array.set([this.#pos[k]!, this.#pos[k + 1]!, this.#pos[k + 2]!], n * 3);
      this.#iSize.array.set([width, height], n * 2);
      this.#iRot.array[n] = angle;
      this.#iFrame.array[n] = this.#frame[n]!;
      const c = n * 4;
      this.#iColor.array.set([this.#color[c]!, this.#color[c + 1]!, this.#color[c + 2]!, this.#color[c + 3]! * fade], c);
      this.#iFlat.array[n] = this.#flat[n]!;
      n++;
    }
    this.#count = n;
    this.#geometry.instanceCount = n;
    for (const a of [this.#iPos, this.#iSize, this.#iRot, this.#iFrame, this.#iColor, this.#iFlat]) {
      a.needsUpdate = true;
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
    }
  }

  #move(from: number, to: number): void {
    this.#pos.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.#vel.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.#life[to] = this.#life[from]!;
    this.#size.copyWithin(to * 2, from * 2, from * 2 + 2);
    this.#rot.copyWithin(to * 2, from * 2, from * 2 + 2);
    this.#phys.copyWithin(to * 3, from * 3, from * 3 + 3);
    this.#color.copyWithin(to * 4, from * 4, from * 4 + 4);
    this.#frame[to] = this.#frame[from]!;
    this.#flat[to] = this.#flat[from]!;
  }
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** A random direction on the upper part of the unit sphere, scaled. */
function spray(speed: number, lift = 0.6): [number, number, number] {
  const theta = Math.random() * Math.PI * 2;
  const y = rand(-0.2, 1) * lift + (1 - lift) * 0.3;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  return [Math.cos(theta) * r * speed, y * speed, Math.sin(theta) * r * speed];
}

const C = {
  white: new THREE.Color('#fff6e6'),
  gold: new THREE.Color('#ffc451'),
  hot: new THREE.Color('#ffe2a0'),
  cyan: new THREE.Color('#7fe3ff'),
  violet: new THREE.Color('#b48cff'),
  grey: new THREE.Color('#9aa0ae'),
  dust: new THREE.Color('#a48d68'),
  dustLight: new THREE.Color('#e8dcc0'),
  acid: new THREE.Color('#9be35a'),
  bile: new THREE.Color('#4f7d2a'),
  shadow: new THREE.Color('#1b1526'),
  ember: new THREE.Color('#ff8a3d'),
};

export type HitKind = 'normal' | 'critical' | 'weakpoint';

/**
 * Sprite particles from the Kenney packs: one additive batch (sparks, stars, rings, slashes)
 * and one blended batch (smoke, dust, debris), each a single instanced draw. The named
 * emitters below are the game's whole effects vocabulary.
 */
export class SpriteFx {
  readonly group = new THREE.Group();
  readonly #glow: Pool;
  readonly #smoke: Pool;
  readonly #atlas: ParticleAtlas;
  readonly #right = new THREE.Vector3();
  readonly #up = new THREE.Vector3();
  /** Low-power devices get fewer particles per burst. */
  readonly #density: number;
  /** Dev: slow effects down to inspect them. */
  timeScale = 1;

  constructor(atlas: ParticleAtlas, lowPower: boolean) {
    this.#atlas = atlas;
    this.#density = lowPower ? 0.55 : 1;
    this.#glow = new Pool(lowPower ? 220 : 400, atlas, true);
    this.#smoke = new Pool(lowPower ? 90 : 160, atlas, false);
    this.group.add(this.#smoke.mesh, this.#glow.mesh);
  }

  /** Drops every live particle at once. */
  clear(): void {
    this.#glow.clear();
    this.#smoke.clear();
  }

  spawn(p: SpriteSpawn): void {
    (p.additive ? this.#glow : this.#smoke).spawn(p, this.#atlas.frames[p.sprite] ?? 0);
  }

  update(frameDt: number, camera: THREE.Camera): void {
    const dt = frameDt * this.timeScale;
    const e = camera.matrixWorld.elements;
    this.#right.set(e[0]!, e[1]!, e[2]!);
    this.#up.set(e[4]!, e[5]!, e[6]!);
    this.#glow.update(dt, this.#right, this.#up, true);
    this.#smoke.update(dt, this.#right, this.#up, false);
  }

  #n(count: number): number {
    return Math.max(1, Math.round(count * this.#density));
  }

  #sparks(x: number, y: number, z: number, count: number, color: THREE.Color, speed: number, size = 0.07): void {
    for (let i = 0; i < this.#n(count); i++) {
      const [vx, vy, vz] = spray(speed * rand(0.5, 1.2));
      this.spawn({ sprite: 'streak', x, y, z, vx, vy, vz, life: rand(0.22, 0.42), size, color, gravity: 11, drag: 2.5, stretch: 0.09, additive: true });
    }
  }

  // --- The effects vocabulary ------------------------------------------------------

  hit(x: number, y: number, z: number, kind: HitKind): void {
    const strong = kind !== 'normal';
    const color = strong ? C.gold : C.white;
    this.spawn({ sprite: 'impact', x, y, z, life: 0.2, size: strong ? 0.7 : 0.45, sizeEnd: strong ? 1.6 : 1.05, color, alpha: 0.9, additive: true });
    this.spawn({ sprite: 'slash', x, y, z, life: 0.17, size: strong ? 1.6 : 1.2, sizeEnd: strong ? 2.1 : 1.5, color, alpha: 0.85, additive: true });
    this.#sparks(x, y, z, strong ? 14 : 7, strong ? C.hot : C.white, strong ? 9 : 6);
    if (strong) this.spawn({ sprite: 'star4', x, y, z, life: 0.26, size: 1.3, sizeEnd: 0.2, color: C.hot, spin: 3, additive: true });
    if (kind === 'weakpoint') this.spawn({ sprite: 'ring', x, y, z, life: 0.3, size: 0.4, sizeEnd: 2.4, color: C.gold, alpha: 0.8, additive: true });
    this.spawn({ sprite: 'puffA', x, y: y - 0.1, z, vy: 0.5, life: 0.6, size: 0.4, sizeEnd: 1, color: C.dust, alpha: 0.28, drag: 1, spin: 0.6 });
  }

  parry(x: number, y: number, z: number): void {
    this.spawn({ sprite: 'starX', x, y, z, life: 0.24, size: 0.6, sizeEnd: 2.6, color: C.gold, spin: 1.5, additive: true });
    this.spawn({ sprite: 'burst', x, y, z, life: 0.16, size: 1.6, sizeEnd: 0.4, color: C.white, additive: true });
    this.spawn({ sprite: 'ring', x, y, z, life: 0.32, size: 0.3, sizeEnd: 3.4, color: C.gold, alpha: 0.9, additive: true });
    this.#sparks(x, y, z, 20, C.hot, 10, 0.08);
  }

  guard(x: number, y: number, z: number): void {
    this.spawn({ sprite: 'impact', x, y, z, life: 0.2, size: 0.5, sizeEnd: 1.2, color: C.violet, alpha: 0.8, additive: true });
    this.spawn({ sprite: 'ring', x, y, z, life: 0.25, size: 0.3, sizeEnd: 1.6, color: C.violet, alpha: 0.7, additive: true });
    this.#sparks(x, y, z, 8, C.violet, 5);
  }

  immune(x: number, y: number, z: number): void {
    this.spawn({ sprite: 'glint', x, y, z, life: 0.18, size: 0.9, sizeEnd: 0.3, color: C.grey, additive: true });
    this.#sparks(x, y, z, 4, C.grey, 4, 0.05);
  }

  perfectDodge(x: number, y: number, z: number): void {
    this.spawn({ sprite: 'star4', x, y, z, life: 0.35, size: 1.4, sizeEnd: 0.3, color: C.cyan, spin: 2, additive: true });
    this.spawn({ sprite: 'ring', x, y, z, life: 0.35, size: 0.4, sizeEnd: 2.6, color: C.cyan, alpha: 0.7, additive: true });
    for (let i = 0; i < this.#n(12); i++) {
      const [vx, vy, vz] = spray(2.2, 0.9);
      this.spawn({ sprite: 'dot', x, y, z, vx, vy: vy + 0.8, vz, life: rand(0.5, 0.9), size: 0.12, sizeEnd: 0.04, color: C.cyan, drag: 1.8, additive: true });
    }
  }

  /** Kicked-up dust under the feet (dodges, hard landings, sprint steps). */
  dust(x: number, y: number, z: number, amount = 1, color: THREE.Color = C.dust): void {
    for (let i = 0; i < this.#n(3 * amount); i++) {
      const [vx, , vz] = spray(1.4 * amount, 0);
      this.spawn({
        sprite: i % 2 ? 'puffB' : 'puffA',
        x: x + vx * 0.1,
        y: y + 0.15,
        z: z + vz * 0.1,
        vx,
        vy: rand(0.3, 0.8),
        vz,
        life: rand(0.5, 0.9),
        size: 0.35 * amount,
        sizeEnd: 1.1 * amount,
        color,
        alpha: 0.35,
        drag: 2.2,
        spin: rand(-0.8, 0.8),
      });
    }
  }

  /** A heavy blow into the ground: ring, debris and a wall of dust. */
  slam(x: number, y: number, z: number, radius = 3): void {
    this.spawn({ sprite: 'ring', x, y: y + 0.08, z, life: 0.45, size: 0.5, sizeEnd: radius * 2.2, color: C.dustLight, alpha: 0.55, flat: true, additive: true });
    for (let i = 0; i < this.#n(10); i++) {
      const a = (i / 10) * Math.PI * 2;
      this.spawn({
        sprite: i % 3 === 0 ? 'puffC' : 'puffB',
        x: x + Math.cos(a) * 0.4,
        y: y + 0.2,
        z: z + Math.sin(a) * 0.4,
        vx: Math.cos(a) * radius * 1.6,
        vy: rand(0.4, 1.2),
        vz: Math.sin(a) * radius * 1.6,
        life: rand(0.7, 1.1),
        size: 0.6,
        sizeEnd: 1.8,
        color: C.dust,
        alpha: 0.4,
        drag: 3,
      });
    }
    for (let i = 0; i < this.#n(6); i++) {
      const [vx, vy, vz] = spray(5, 0.9);
      this.spawn({ sprite: 'debris', x, y: y + 0.2, z, vx, vy: vy + 3, vz, life: rand(0.6, 0.9), size: 0.5, sizeEnd: 0.4, color: C.dust, alpha: 0.9, gravity: 14, spin: rand(-6, 6) });
    }
  }

  /** The serpent's acid: a green cloud that hangs, with bright droplets. */
  acid(x: number, y: number, z: number, scale = 1): void {
    for (let i = 0; i < this.#n(5); i++) {
      const [vx, vy, vz] = spray(1.2 * scale, 0.5);
      this.spawn({ sprite: i % 2 ? 'puffA' : 'puffC', x, y, z, vx, vy: vy + 0.4, vz, life: rand(1, 1.6), size: 0.6 * scale, sizeEnd: 2 * scale, color: C.bile, alpha: 0.45, drag: 1.4, spin: rand(-0.6, 0.6) });
    }
    for (let i = 0; i < this.#n(8); i++) {
      const [vx, vy, vz] = spray(4 * scale, 0.8);
      this.spawn({ sprite: 'dot', x, y, z, vx, vy: vy + 2, vz, life: rand(0.4, 0.8), size: 0.14, sizeEnd: 0.06, color: C.acid, gravity: 9, additive: true });
    }
  }

  /** Shadowy smoke for things that rise from or sink into the dark. */
  shadow(x: number, y: number, z: number, scale = 1): void {
    for (let i = 0; i < this.#n(8); i++) {
      const [vx, vy, vz] = spray(1.6 * scale, 0.4);
      this.spawn({ sprite: i % 2 ? 'puffB' : 'puffC', x, y: y + rand(0, 1.2) * scale, z, vx, vy: vy + 0.9, vz, life: rand(1, 1.8), size: 0.8 * scale, sizeEnd: 2.4 * scale, color: C.shadow, alpha: 0.6, drag: 1.2, spin: rand(-0.5, 0.5) });
    }
    for (let i = 0; i < this.#n(10); i++) {
      const [vx, vy, vz] = spray(2 * scale, 0.9);
      this.spawn({ sprite: 'dot', x, y: y + 0.6 * scale, z, vx, vy: vy + 1, vz, life: rand(0.6, 1.2), size: 0.1, sizeEnd: 0.03, color: C.violet, drag: 1, additive: true });
    }
  }

  /** A waystone wakes: runes spread on the ground and light climbs the stone. */
  discovery(x: number, y: number, z: number): void {
    this.spawn({ sprite: 'runes', x, y: y + 0.1, z, life: 1.8, size: 1, sizeEnd: 6, color: C.cyan, alpha: 0.9, flat: true, spin: 0.6, additive: true });
    this.spawn({ sprite: 'halo', x, y: y + 1.6, z, life: 1, size: 1, sizeEnd: 4, color: C.cyan, alpha: 0.6, additive: true });
    this.spawn({ sprite: 'compass', x, y: y + 3.4, z, life: 1.2, size: 2.4, sizeEnd: 0.5, color: C.white, spin: 1.2, additive: true });
    for (let i = 0; i < this.#n(24); i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0.4, 1.6);
      this.spawn({
        sprite: i % 3 === 0 ? 'glint' : 'dot',
        x: x + Math.cos(a) * r,
        y: y + rand(0, 0.6),
        z: z + Math.sin(a) * r,
        vx: -Math.cos(a) * 0.4,
        vy: rand(1.5, 3.5),
        vz: -Math.sin(a) * 0.4,
        life: rand(1, 1.8),
        size: 0.16,
        sizeEnd: 0.05,
        color: C.cyan,
        drag: 0.6,
        additive: true,
      });
    }
  }

  /** A great beast falls: a wide dust wall, embers and a slow glow. */
  felled(x: number, y: number, z: number, scale = 2): void {
    this.slam(x, y, z, 3 * scale);
    this.spawn({ sprite: 'halo', x, y: y + scale, z, life: 1.4, size: scale, sizeEnd: scale * 4, color: C.gold, alpha: 0.5, additive: true });
    for (let i = 0; i < this.#n(30); i++) {
      const [vx, vy, vz] = spray(3, 0.9);
      this.spawn({ sprite: 'dot', x, y: y + rand(0.2, scale), z, vx, vy: vy + 2, vz, life: rand(1, 2), size: 0.12, sizeEnd: 0.04, color: C.ember, drag: 0.8, gravity: -0.5, additive: true });
    }
  }
}
