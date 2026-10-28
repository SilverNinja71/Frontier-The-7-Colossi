/** JSON-safe vector used in registries and network packets. No methods, no classes. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * World-space pose on the ground plane. `yaw` is radians around +Y; yaw 0 faces -Z
 * (Three.js convention), so forward = (-sin yaw, 0, -cos yaw).
 */
export interface GroundPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
}
