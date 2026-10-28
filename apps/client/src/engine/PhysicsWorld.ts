import type RAPIER from '@dimforge/rapier3d-compat';

export type Rapier = typeof RAPIER;

let rapierReady: Promise<Rapier> | null = null;

/** Loads Rapier (own chunk: inlined WASM, ~1.7 MB gzip) once, on demand. */
export function loadRapier(): Promise<Rapier> {
  rapierReady ??= import('@dimforge/rapier3d-compat').then(async ({ default: rapier }) => {
    await rapier.init();
    return rapier;
  });
  return rapierReady;
}

/**
 * Client-side Rapier world used for character collision and camera queries. The server
 * builds the same static colliders from the same terrain function.
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor(
    readonly rapier: Rapier,
    dt: number,
  ) {
    this.world = new rapier.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = dt;
  }

  addStatic(desc: RAPIER.ColliderDesc): RAPIER.Collider {
    return this.world.createCollider(desc);
  }

  step(): void {
    this.world.step();
  }

  /**
   * Distance along `dir` (unit) from `origin` to the first static hit, or `maxDistance`.
   * Excludes the given collider (the local player).
   */
  castRay(
    origin: { x: number; y: number; z: number },
    dir: { x: number; y: number; z: number },
    maxDistance: number,
    exclude?: RAPIER.Collider,
  ): number {
    const ray = new this.rapier.Ray(origin, dir);
    const hit = this.world.castRay(ray, maxDistance, true, undefined, undefined, exclude);
    return hit ? hit.timeOfImpact : maxDistance;
  }
}
