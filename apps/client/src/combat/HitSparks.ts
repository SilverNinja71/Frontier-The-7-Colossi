import * as THREE from 'three';
import { softDotTexture } from './textures.ts';

const CAPACITY = 160;

/** Pooled additive spark particles for hit confirmation. */
export class HitSparks {
  readonly points: THREE.Points;
  readonly #positions = new Float32Array(CAPACITY * 3);
  readonly #colors = new Float32Array(CAPACITY * 3);
  readonly #velocity = new Float32Array(CAPACITY * 3);
  readonly #life = new Float32Array(CAPACITY);
  readonly #base = new Float32Array(CAPACITY * 3);
  #cursor = 0;

  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.#colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.16,
        map: softDotTexture(),
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  burst(x: number, y: number, z: number, count: number, color: THREE.Color, speed = 6): void {
    for (let n = 0; n < count; n++) {
      const i = this.#cursor;
      this.#cursor = (this.#cursor + 1) % CAPACITY;
      this.#positions.set([x, y, z], i * 3);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const v = speed * (0.4 + Math.random() * 0.8);
      this.#velocity.set([Math.sin(phi) * Math.cos(theta) * v, Math.abs(Math.cos(phi)) * v * 0.9 + 1.5, Math.sin(phi) * Math.sin(theta) * v], i * 3);
      this.#base.set([color.r, color.g, color.b], i * 3);
      this.#life[i] = 0.25 + Math.random() * 0.25;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < CAPACITY; i++) {
      const life = this.#life[i]!;
      if (life <= 0) {
        this.#colors.fill(0, i * 3, i * 3 + 3);
        continue;
      }
      this.#life[i] = life - dt;
      const k = i * 3;
      this.#velocity[k + 1]! -= 14 * dt;
      for (let a = 0; a < 3; a++) {
        this.#positions[k + a]! += this.#velocity[k + a]! * dt;
        this.#velocity[k + a]! *= 0.9;
        this.#colors[k + a] = this.#base[k + a]! * Math.min(1, life * 4);
      }
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    this.points.geometry.attributes.color!.needsUpdate = true;
  }
}
