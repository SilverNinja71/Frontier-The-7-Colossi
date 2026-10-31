import type RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { PhysicsWorld } from './PhysicsWorld.ts';

const PIVOT_HEIGHT = 1.55;
const SHOULDER_OFFSET = 0.42;
const MIN_PITCH = -0.45;
const MAX_PITCH = 1.15;

/**
 * Third-person orbit camera. Yaw/pitch come straight from mouse/touch each render frame;
 * a ray against static geometry keeps the camera from clipping into walls and pillars.
 * yaw 0 places the camera on +Z looking toward -Z (same convention as InputFrame.viewYaw).
 */
export class CameraRig {
  yaw = 0;
  pitch = 0.28;
  sensitivity = 0.0024;
  readonly #desiredDistance = 5.4;
  #distance = 5.4;
  #trauma = 0;
  #time = 0;
  #fov = 62;
  #locked = false;
  readonly #pivot = new THREE.Vector3();
  readonly #dir = new THREE.Vector3();
  readonly #right = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly physics: PhysicsWorld,
    private readonly exclude: readonly RAPIER.Collider[],
  ) {}

  /** Place the camera directly behind a character facing `yaw`. */
  resetBehind(yaw: number): void {
    this.yaw = yaw;
    this.pitch = 0.28;
  }

  applyLook(dx: number, dy: number): void {
    if (this.#locked) return; // lock-on owns the camera
    this.yaw -= dx * this.sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * this.sensitivity, MIN_PITCH, MAX_PITCH);
  }

  /** Screen shake; trauma 0..1 decays over time and is squared for falloff. */
  addTrauma(amount: number): void {
    this.#trauma = Math.min(1, this.#trauma + amount);
  }

  /** `lockTarget`: world point to keep framed (lock-on), or null for free look. */
  update(focus: THREE.Vector3, frameDt: number, sprinting: boolean, lockTarget: THREE.Vector3 | null = null): void {
    this.#time += frameDt;
    this.#locked = lockTarget !== null;
    if (lockTarget) {
      const desiredYaw = Math.atan2(-(lockTarget.x - focus.x), -(lockTarget.z - focus.z));
      let delta = (desiredYaw - this.yaw) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      else if (delta < -Math.PI) delta += Math.PI * 2;
      this.yaw += delta * (1 - Math.exp(-9 * frameDt));
      this.pitch = THREE.MathUtils.damp(this.pitch, 0.24, 4, frameDt);
    }
    const cosPitch = Math.cos(this.pitch);
    this.#dir.set(Math.sin(this.yaw) * cosPitch, Math.sin(this.pitch), Math.cos(this.yaw) * cosPitch);
    this.#right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.#pivot.copy(focus).setY(focus.y + PIVOT_HEIGHT).addScaledVector(this.#right, SHOULDER_OFFSET);

    const hitDistance = this.physics.castRay(this.#pivot, this.#dir, this.#desiredDistance + 0.3, this.exclude);
    const target = Math.max(0.9, Math.min(this.#desiredDistance, hitDistance - 0.3));
    // Snap in instantly when occluded, ease back out when clear.
    this.#distance = target < this.#distance ? target : THREE.MathUtils.damp(this.#distance, target, 5, frameDt);

    this.camera.position.copy(this.#pivot).addScaledVector(this.#dir, this.#distance);
    this.camera.lookAt(this.#pivot);

    this.#fov = THREE.MathUtils.damp(this.#fov, sprinting ? 70 : 62, 6, frameDt);
    if (Math.abs(this.camera.fov - this.#fov) > 0.01) {
      this.camera.fov = this.#fov;
      this.camera.updateProjectionMatrix();
    }

    if (this.#trauma > 0) {
      const shake = this.#trauma * this.#trauma;
      const t = this.#time * 38;
      this.camera.position.x += Math.sin(t * 1.1) * 0.12 * shake;
      this.camera.position.y += Math.sin(t * 1.7 + 1.3) * 0.1 * shake;
      this.camera.rotateZ(Math.sin(t * 0.9 + 2.1) * 0.025 * shake);
      this.#trauma = Math.max(0, this.#trauma - frameDt * 1.8);
    }
  }
}
