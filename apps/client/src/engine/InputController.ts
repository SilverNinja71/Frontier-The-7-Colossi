import { InputButton, type InputFrame } from '@frontier/shared-types';

const KEY_BUTTONS: Record<string, number> = {
  ShiftLeft: InputButton.Sprint,
  ShiftRight: InputButton.Sprint,
  Space: InputButton.Dodge,
  KeyJ: InputButton.Attack,
  KeyK: InputButton.Dodge,
  KeyL: InputButton.Parry,
  KeyE: InputButton.Interact,
};

const MOUSE_BUTTONS: Record<number, number> = {
  0: InputButton.Attack,
  2: InputButton.Parry,
};

/** Standard-mapping gamepad (Xbox labels; PlayStation/Switch map to the same indices). */
const PAD_BUTTONS: Record<number, number> = {
  0: InputButton.Dodge, // A
  1: InputButton.Sprint, // B (hold)
  2: InputButton.Attack, // X
  5: InputButton.Parry, // RB
  6: InputButton.Sprint, // LT
  7: InputButton.Attack, // RT
};
const PAD_HOTKEYS: Record<number, string> = { 3: 'PadY', 8: 'PadBack', 9: 'PadStart', 11: 'PadR3' };
const STICK_DEADZONE = 0.18;
/** Right stick look speed at full deflection, in mouse-pixel equivalents per second. */
const PAD_LOOK_X = 950;
const PAD_LOOK_Y = 600;

/**
 * Collects keyboard, mouse and touch state and turns it into one InputFrame per sim tick.
 * Presses are latched between ticks so a tap shorter than a tick is never lost. Camera look
 * is consumed per render frame (not per tick) to keep aiming responsive.
 */
export class InputController {
  readonly #keys = new Set<string>();
  #mouseHeld = 0;
  #virtualHeld = 0;
  #virtualMoveX = 0;
  #virtualMoveY = 0;
  #padMoveX = 0;
  #padMoveY = 0;
  #padHeld = 0;
  #padPrevMask = 0;
  /** A gamepad was seen on the last poll. */
  padConnected = false;
  #pressedLatch = 0;
  #lookX = 0;
  #lookY = 0;
  #seq = 0;
  #enabled = false;
  readonly #hotkeys = new Map<string, () => void>();
  readonly #abort = new AbortController();

  constructor(private readonly element: HTMLElement) {
    const signal = this.#abort.signal;
    window.addEventListener('keydown', this.#onKeyDown, { signal });
    window.addEventListener('keyup', (e) => this.#keys.delete(e.code), { signal });
    window.addEventListener('blur', () => this.#releaseAll(), { signal });
    element.addEventListener('mousedown', this.#onMouseDown, { signal });
    window.addEventListener('mouseup', (e) => (this.#mouseHeld &= ~(MOUSE_BUTTONS[e.button] ?? 0)), { signal });
    element.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    document.addEventListener('mousemove', this.#onMouseMove, { signal });
  }

  /** Gameplay input is ignored while disabled (menus, ad breaks). */
  set enabled(value: boolean) {
    this.#enabled = value;
    if (!value) this.#releaseAll();
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.element;
  }

  requestPointerLock(): void {
    // Rejects without a user gesture or when unsupported (iOS); touch controls take over then.
    this.element.requestPointerLock?.()?.catch?.(() => {});
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock();
  }

  /** Non-gameplay keys (toggles, debug). Fire even while gameplay input is disabled. */
  bindHotkey(code: string, handler: () => void): void {
    this.#hotkeys.set(code, handler);
  }

  // --- Touch bridge ---------------------------------------------------------

  setVirtualMove(x: number, y: number): void {
    this.#virtualMoveX = x;
    this.#virtualMoveY = y;
  }

  setVirtualButton(button: number, down: boolean): void {
    if (down) {
      if (!(this.#virtualHeld & button)) this.#pressedLatch |= button;
      this.#virtualHeld |= button;
    } else {
      this.#virtualHeld &= ~button;
    }
  }

  addLook(dx: number, dy: number): void {
    if (!this.#enabled) return;
    this.#lookX += dx;
    this.#lookY += dy;
  }

  // --- Gamepad --------------------------------------------------------------

  /** Poll once per render frame: sticks, buttons (edge-detected) and pad hotkeys. */
  pollGamepad(frameDt: number): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const candidate of pads) {
      if (!candidate?.connected) continue;
      pad = candidate;
      if (candidate.mapping === 'standard') break;
    }
    if (!pad) {
      if (this.padConnected) this.#releasePad();
      this.padConnected = false;
      return;
    }
    this.padConnected = true;

    const [lx, ly] = deadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const [rx, ry] = deadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    this.#padMoveX = lx;
    this.#padMoveY = -ly;
    if (rx !== 0 || ry !== 0) this.addLook(rx * PAD_LOOK_X * frameDt, ry * PAD_LOOK_Y * frameDt);

    let mask = 0;
    let held = 0;
    pad.buttons.forEach((button, index) => {
      if (!button.pressed && button.value <= 0.5) return;
      mask |= 1 << index;
      held |= PAD_BUTTONS[index] ?? 0;
    });
    const down = mask & ~this.#padPrevMask;
    this.#padPrevMask = mask;
    for (const [index, code] of Object.entries(PAD_HOTKEYS)) {
      if (down & (1 << Number(index))) this.#hotkeys.get(code)?.();
    }
    if (!this.#enabled) {
      this.#padHeld = 0;
      return;
    }
    this.#pressedLatch |= held & ~this.#padHeld;
    this.#padHeld = held;
  }

  #releasePad(): void {
    this.#padMoveX = 0;
    this.#padMoveY = 0;
    this.#padHeld = 0;
    this.#padPrevMask = 0;
  }

  // --- Sampling -------------------------------------------------------------

  /** Accumulated look delta since the last call, in pixels. */
  consumeLook(): { x: number; y: number } {
    const look = { x: this.#lookX, y: this.#lookY };
    this.#lookX = 0;
    this.#lookY = 0;
    return look;
  }

  /** `extraHeld` adds game-side state flags such as InputButton.LockOn. */
  sampleFrame(viewYaw: number, extraHeld = 0): InputFrame {
    const seq = ++this.#seq;
    if (!this.#enabled) return { seq, moveX: 0, moveY: 0, viewYaw, held: 0, pressed: 0 };

    let moveX = this.#axis('KeyD', 'ArrowRight') - this.#axis('KeyA', 'ArrowLeft') + this.#virtualMoveX + this.#padMoveX;
    let moveY = this.#axis('KeyW', 'ArrowUp') - this.#axis('KeyS', 'ArrowDown') + this.#virtualMoveY + this.#padMoveY;
    const length = Math.hypot(moveX, moveY);
    if (length > 1) {
      moveX /= length;
      moveY /= length;
    }

    let held = this.#mouseHeld | this.#virtualHeld | this.#padHeld | extraHeld;
    for (const code of this.#keys) held |= KEY_BUTTONS[code] ?? 0;
    const pressed = this.#pressedLatch;
    this.#pressedLatch = 0;
    return { seq, moveX, moveY, viewYaw, held, pressed };
  }

  dispose(): void {
    this.#abort.abort();
    this.exitPointerLock();
  }

  // --------------------------------------------------------------------------

  #axis(a: string, b: string): number {
    return this.#keys.has(a) || this.#keys.has(b) ? 1 : 0;
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const hotkey = this.#hotkeys.get(event.code);
    if (hotkey && !event.repeat) {
      hotkey();
      event.preventDefault();
      return;
    }
    if (!this.#enabled) return;
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (!event.repeat && !this.#keys.has(event.code)) this.#pressedLatch |= KEY_BUTTONS[event.code] ?? 0;
    this.#keys.add(event.code);
  };

  #onMouseDown = (event: MouseEvent): void => {
    if (event.button === 1) {
      event.preventDefault(); // middle click: no autoscroll
      this.#hotkeys.get('Mouse1')?.();
      return;
    }
    if (!this.#enabled) return;
    const button = MOUSE_BUTTONS[event.button] ?? 0;
    this.#pressedLatch |= button;
    this.#mouseHeld |= button;
  };

  #onMouseMove = (event: MouseEvent): void => {
    // Without pointer lock (unsupported/denied), right-drag still orbits the camera.
    if (this.pointerLocked || this.#mouseHeld & InputButton.Parry) this.addLook(event.movementX, event.movementY);
  };

  #releaseAll(): void {
    this.#keys.clear();
    this.#mouseHeld = 0;
    this.#virtualHeld = 0;
    this.#virtualMoveX = 0;
    this.#virtualMoveY = 0;
    this.#pressedLatch = 0;
    this.#padHeld = 0;
  }
}

/** Radial deadzone, rescaled so motion starts smoothly at the edge of the zone. */
function deadzone(x: number, y: number): [number, number] {
  const magnitude = Math.hypot(x, y);
  if (magnitude < STICK_DEADZONE) return [0, 0];
  const scaled = Math.min(1, (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE));
  return [(x / magnitude) * scaled, (y / magnitude) * scaled];
}
