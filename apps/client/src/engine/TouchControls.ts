import { InputButton } from '@frontier/shared-types';
import type { InputController } from './InputController.ts';

const JOYSTICK_RADIUS = 56;
const LOOK_SENSITIVITY = 1.6;

/** Primary input is touch (phones, tablets). Touchscreen laptops keep mouse + pointer lock. */
export function isTouchDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Mobile Chrome controls: floating joystick on the left half, drag-to-look on the right
 * half, and action buttons. Built imperatively (not React) so touch → input has no render lag.
 */
export class TouchControls {
  readonly root: HTMLDivElement;
  readonly #abort = new AbortController();
  #stickPointer: number | null = null;
  #stickOriginX = 0;
  #stickOriginY = 0;
  #lookPointer: number | null = null;
  #lookLastX = 0;
  #lookLastY = 0;
  #sprintToggled = false;
  readonly #base: HTMLDivElement;
  readonly #knob: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private readonly input: InputController,
    onPause: () => void,
  ) {
    const signal = this.#abort.signal;
    this.root = el('div', 'pointer-events-auto fixed inset-0 z-10 select-none touch-none');
    this.#base = el(
      'div',
      'pointer-events-none absolute hidden h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30 bg-white/10',
    );
    this.#knob = el('div', 'absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/50');
    this.#base.appendChild(this.#knob);
    this.root.appendChild(this.#base);

    this.root.addEventListener('pointerdown', this.#onDown, { signal });
    this.root.addEventListener('pointermove', this.#onMove, { signal });
    this.root.addEventListener('pointerup', this.#onUp, { signal });
    this.root.addEventListener('pointercancel', this.#onUp, { signal });

    const cluster = el('div', 'absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 flex items-end gap-3');
    cluster.append(
      this.#button('Dodge', 'h-16 w-16 bg-sky-500/40', InputButton.Dodge, signal),
      this.#button('Strike', 'h-24 w-24 bg-rose-500/45 text-base', InputButton.Attack, signal),
    );
    const sprint = this.#toggle('Sprint', 'absolute bottom-36 right-8 h-14 w-14 bg-amber-400/35', signal);
    const pause = el('button', 'absolute right-4 top-[max(1rem,env(safe-area-inset-top))] rounded-md bg-black/40 px-3 py-1 text-sm text-white');
    pause.textContent = 'II';
    pause.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      onPause();
    }, { signal });
    this.root.append(cluster, sprint, pause);
    parent.appendChild(this.root);
  }

  set visible(value: boolean) {
    this.root.style.display = value ? '' : 'none';
    if (!value) this.#resetStick();
  }

  dispose(): void {
    this.#abort.abort();
    this.root.remove();
  }

  #onDown = (event: PointerEvent): void => {
    if (event.clientX < window.innerWidth * 0.45 && this.#stickPointer === null) {
      this.#stickPointer = event.pointerId;
      this.#stickOriginX = event.clientX;
      this.#stickOriginY = event.clientY;
      this.#base.style.left = `${event.clientX}px`;
      this.#base.style.top = `${event.clientY}px`;
      this.#base.classList.remove('hidden');
      this.root.setPointerCapture(event.pointerId);
    } else if (this.#lookPointer === null) {
      this.#lookPointer = event.pointerId;
      this.#lookLastX = event.clientX;
      this.#lookLastY = event.clientY;
      this.root.setPointerCapture(event.pointerId);
    }
  };

  #onMove = (event: PointerEvent): void => {
    if (event.pointerId === this.#stickPointer) {
      let dx = event.clientX - this.#stickOriginX;
      let dy = event.clientY - this.#stickOriginY;
      const length = Math.hypot(dx, dy);
      if (length > JOYSTICK_RADIUS) {
        dx = (dx / length) * JOYSTICK_RADIUS;
        dy = (dy / length) * JOYSTICK_RADIUS;
      }
      this.#knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.input.setVirtualMove(dx / JOYSTICK_RADIUS, -dy / JOYSTICK_RADIUS);
    } else if (event.pointerId === this.#lookPointer) {
      this.input.addLook((event.clientX - this.#lookLastX) * LOOK_SENSITIVITY, (event.clientY - this.#lookLastY) * LOOK_SENSITIVITY);
      this.#lookLastX = event.clientX;
      this.#lookLastY = event.clientY;
    }
  };

  #onUp = (event: PointerEvent): void => {
    if (event.pointerId === this.#stickPointer) this.#resetStick();
    if (event.pointerId === this.#lookPointer) this.#lookPointer = null;
  };

  #resetStick(): void {
    this.#stickPointer = null;
    this.#base.classList.add('hidden');
    this.#knob.style.transform = '';
    this.input.setVirtualMove(0, 0);
  }

  #button(label: string, classes: string, button: number, signal: AbortSignal): HTMLButtonElement {
    const node = el('button', `rounded-full border border-white/40 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm active:scale-95 ${classes}`);
    node.textContent = label;
    node.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.input.setVirtualButton(button, true);
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      node.addEventListener(type, () => this.input.setVirtualButton(button, false), { signal });
    }
    return node;
  }

  #toggle(label: string, classes: string, signal: AbortSignal): HTMLButtonElement {
    const node = el('button', `rounded-full border border-white/40 text-xs font-bold uppercase text-white ${classes}`);
    node.textContent = label;
    node.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.#sprintToggled = !this.#sprintToggled;
      node.classList.toggle('ring-4', this.#sprintToggled);
      this.input.setVirtualButton(InputButton.Sprint, this.#sprintToggled);
    }, { signal });
    return node;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
