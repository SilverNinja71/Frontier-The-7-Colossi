import * as THREE from 'three';

/** Screen-space lock-on marker projected onto the locked target each frame. */
export class LockReticle {
  readonly #node: HTMLDivElement;
  readonly #projected = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.#node = document.createElement('div');
    this.#node.className = 'pointer-events-none fixed left-0 top-0 hidden';
    this.#node.innerHTML =
      '<div class="h-7 w-7 rotate-45 rounded-sm border-2 border-amber-200/90 shadow-[0_0_10px_rgba(251,191,36,0.8)]"></div>' +
      '<div class="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200"></div>';
    parent.appendChild(this.#node);
  }

  update(camera: THREE.Camera, point: THREE.Vector3 | null): void {
    if (!point) {
      this.#node.classList.add('hidden');
      return;
    }
    this.#projected.copy(point).project(camera);
    const behind = this.#projected.z > 1;
    this.#node.classList.toggle('hidden', behind);
    if (behind) return;
    const x = (this.#projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.#projected.y * 0.5 + 0.5) * window.innerHeight;
    this.#node.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  dispose(): void {
    this.#node.remove();
  }
}
