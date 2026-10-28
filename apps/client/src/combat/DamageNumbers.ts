import * as THREE from 'three';

export type DamageNumberKind = 'normal' | 'critical' | 'weakpoint' | 'player' | 'miss';

const STYLE: Record<DamageNumberKind, string> = {
  normal: 'text-white text-xl',
  critical: 'text-amber-300 text-3xl',
  weakpoint: 'text-orange-400 text-4xl',
  player: 'text-rose-400 text-2xl',
  miss: 'text-sky-300 text-xl italic',
};

interface Floating {
  node: HTMLDivElement;
  world: THREE.Vector3;
  velocity: number;
  drift: number;
  age: number;
  life: number;
}

/** DOM-projected floating combat text: crisp at any DPI and free of texture uploads. */
export class DamageNumbers {
  readonly #layer: HTMLDivElement;
  readonly #items: Floating[] = [];
  readonly #projected = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.#layer = document.createElement('div');
    this.#layer.className = 'pointer-events-none fixed inset-0 z-[5] overflow-hidden';
    parent.appendChild(this.#layer);
  }

  spawn(position: THREE.Vector3, text: string, kind: DamageNumberKind): void {
    const node = document.createElement('div');
    node.className = `absolute left-0 top-0 font-black tabular-nums [text-shadow:0_2px_0_rgb(0_0_0/0.7),0_0_12px_rgb(0_0_0/0.4)] will-change-transform ${STYLE[kind]}`;
    node.textContent = text;
    this.#layer.appendChild(node);
    this.#items.push({
      node,
      world: position.clone(),
      velocity: kind === 'weakpoint' || kind === 'critical' ? 2.2 : 1.6,
      drift: (Math.random() - 0.5) * 0.9,
      age: 0,
      life: kind === 'normal' ? 0.8 : 1.15,
    });
  }

  update(camera: THREE.Camera, dt: number): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (let i = this.#items.length - 1; i >= 0; i--) {
      const item = this.#items[i]!;
      item.age += dt;
      if (item.age >= item.life) {
        item.node.remove();
        this.#items.splice(i, 1);
        continue;
      }
      item.world.y += item.velocity * dt;
      item.world.x += item.drift * dt;
      item.velocity *= 0.94;
      this.#projected.copy(item.world).project(camera);
      if (this.#projected.z > 1) {
        item.node.style.opacity = '0';
        continue;
      }
      const x = (this.#projected.x * 0.5 + 0.5) * width;
      const y = (-this.#projected.y * 0.5 + 0.5) * height;
      const t = item.age / item.life;
      const pop = t < 0.12 ? 1.5 - (t / 0.12) * 0.5 : 1;
      item.node.style.opacity = String(t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1);
      item.node.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${pop.toFixed(3)})`;
    }
  }

  dispose(): void {
    this.#layer.remove();
  }
}
