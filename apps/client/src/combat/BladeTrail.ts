import * as THREE from 'three';

const MAX_SAMPLES = 18;
const LIFETIME = 0.13;

/** Additive ribbon between a blade's base and tip, sampled each render frame while active. */
export class BladeTrail {
  readonly mesh: THREE.Mesh;
  readonly #positions = new Float32Array(MAX_SAMPLES * 2 * 3);
  readonly #colors = new Float32Array(MAX_SAMPLES * 2 * 3);
  readonly #samples: { base: THREE.Vector3; tip: THREE.Vector3; age: number }[] = [];
  readonly #geometry = new THREE.BufferGeometry();
  readonly #color: THREE.Color;

  constructor(
    private readonly base: THREE.Object3D,
    private readonly tip: THREE.Object3D,
    color = '#9be7ff',
  ) {
    this.#color = new THREE.Color(color);
    this.#geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.#geometry.setAttribute('color', new THREE.BufferAttribute(this.#colors, 3).setUsage(THREE.DynamicDrawUsage));
    const index: number[] = [];
    for (let i = 0; i < MAX_SAMPLES - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.#geometry.setIndex(index);
    this.mesh = new THREE.Mesh(
      this.#geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
  }

  update(active: boolean, frameDt: number): void {
    for (const s of this.#samples) s.age += frameDt;
    while (this.#samples.length && this.#samples[this.#samples.length - 1]!.age > LIFETIME) this.#samples.pop();
    if (active) {
      const recycled = this.#samples.length >= MAX_SAMPLES ? this.#samples.pop() : undefined;
      const sample = recycled ?? { base: new THREE.Vector3(), tip: new THREE.Vector3(), age: 0 };
      this.base.getWorldPosition(sample.base);
      this.tip.getWorldPosition(sample.tip);
      sample.age = 0;
      this.#samples.unshift(sample);
    }

    const count = this.#samples.length;
    this.mesh.visible = count > 1;
    if (count < 2) return;
    for (let i = 0; i < count; i++) {
      const s = this.#samples[i]!;
      const fade = (1 - s.age / LIFETIME) * (1 - i / count);
      s.base.toArray(this.#positions, i * 6);
      s.tip.toArray(this.#positions, i * 6 + 3);
      // Base edge stays dark so the ribbon reads as a crescent swept by the tip.
      this.#colors.fill(0, i * 6, i * 6 + 3);
      this.#colors[i * 6 + 3] = this.#color.r * fade;
      this.#colors[i * 6 + 4] = this.#color.g * fade;
      this.#colors[i * 6 + 5] = this.#color.b * fade;
    }
    this.#geometry.setDrawRange(0, (count - 1) * 6);
    this.#geometry.attributes.position!.needsUpdate = true;
    this.#geometry.attributes.color!.needsUpdate = true;
  }
}
