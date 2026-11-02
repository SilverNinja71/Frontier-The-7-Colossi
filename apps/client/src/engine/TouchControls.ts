import { InputButton } from '@frontier/shared-types';
import { iconSvg, type IconName } from '../ui/icons.ts';
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
    actions: { onPause: () => void; onLock: () => void; onSwap: () => void; onMap: () => void },
  ) {
    const signal = this.#abort.signal;
    this.root = el('div', 'pointer-events-auto fixed inset-0 z-10 select-none touch-none');
    this.#base = el(
      'div',
      'pointer-events-none absolute hidden h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200/40 bg-black/25 shadow-[inset_0_0_20px_rgba(0,0,0,0.4)] backdrop-blur-[2px]',
    );
    this.#knob = el(
      'div',
      'absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-100/80 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.8),rgba(253,230,138,0.45))] shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
    );
    this.#base.appendChild(this.#knob);
    this.root.appendChild(this.#base);

    this.root.addEventListener('pointerdown', this.#onDown, { signal });
    this.root.addEventListener('pointermove', this.#onMove, { signal });
    this.root.addEventListener('pointerup', this.#onUp, { signal });
    this.root.addEventListener('pointercancel', this.#onUp, { signal });

    const cluster = el('div', 'absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 flex items-end gap-3');
    const column = el('div', 'flex flex-col items-center gap-3');
    column.append(
      this.#button('Parry', 'shield', 'fx-touch--parry h-16 w-16', InputButton.Parry, signal),
      this.#button('Dodge', 'dodge', 'fx-touch--dodge h-16 w-16', InputButton.Dodge, signal),
    );
    cluster.append(column, this.#button('Strike', 'swords', 'fx-touch--strike h-24 w-24 text-xs', InputButton.Attack, signal, 30));
    const sprint = this.#toggle('Sprint', 'sprint', 'fx-touch--sprint absolute bottom-48 right-28 h-14 w-14', signal);
    const lock = this.#action('Lock', 'lock', 'fx-touch--lock absolute bottom-48 right-6 h-14 w-14', actions.onLock, signal);
    const swap = this.#action('Swap', 'swap', 'fx-touch--utility absolute bottom-[17rem] right-6 h-12 w-12', actions.onSwap, signal);
    const map = this.#action('Map', 'map', 'fx-touch--utility absolute bottom-[17rem] right-28 h-12 w-12', actions.onMap, signal);
    const pause = this.#action('', 'pause', 'fx-touch--utility absolute right-4 top-[max(1rem,env(safe-area-inset-top))] h-11 w-11', actions.onPause, signal);
    this.root.append(cluster, sprint, lock, swap, map, pause);
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

  #face(node: HTMLElement, label: string, icon: IconName, iconSize: number): void {
    node.innerHTML = iconSvg(icon, iconSize);
    if (label) node.append(Object.assign(document.createElement('span'), { textContent: label }));
  }

  #button(label: string, icon: IconName, classes: string, button: number, signal: AbortSignal, iconSize = 22): HTMLButtonElement {
    const node = el('button', `fx-touch ${classes}`);
    this.#face(node, label, icon, iconSize);
    node.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.input.setVirtualButton(button, true);
    }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      node.addEventListener(type, () => this.input.setVirtualButton(button, false), { signal });
    }
    return node;
  }

  #action(label: string, icon: IconName, classes: string, run: () => void, signal: AbortSignal): HTMLButtonElement {
    const node = el('button', `fx-touch ${classes}`);
    this.#face(node, label, icon, 18);
    node.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      run();
    }, { signal });
    return node;
  }

  #toggle(label: string, icon: IconName, classes: string, signal: AbortSignal): HTMLButtonElement {
    const node = el('button', `fx-touch ${classes}`);
    this.#face(node, label, icon, 18);
    node.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.#sprintToggled = !this.#sprintToggled;
      node.dataset.on = String(this.#sprintToggled);
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
