import type { GroundPose, Hurtbox } from '@frontier/shared-types';
import type { AttackStep } from './frame-data.ts';

export interface MeleeHit {
  hurtbox: Hurtbox;
  /** Approximate contact point on the hurtbox surface facing the attacker (for VFX). */
  pointX: number;
  pointY: number;
  pointZ: number;
}

/**
 * Melee sweep vs sphere hurtboxes: a horizontal sector (reach × arc) extruded over the
 * step's height band. Weak points win over body hits when exposed to the attacker.
 * Runs identically on client (prediction/VFX) and server (authority).
 */
export function testMeleeHit(
  attacker: GroundPose,
  step: AttackStep,
  target: GroundPose,
  hurtboxes: readonly Hurtbox[],
): MeleeHit | null {
  const fwdX = -Math.sin(attacker.yaw);
  const fwdZ = -Math.cos(attacker.yaw);
  const halfArc = (step.arcDegrees * Math.PI) / 360;
  const bandMin = attacker.y + step.heightMin;
  const bandMax = attacker.y + step.heightMax;
  const sinT = Math.sin(target.yaw);
  const cosT = Math.cos(target.yaw);

  let best: MeleeHit | null = null;
  let bestDistance = Infinity;

  for (const box of hurtboxes) {
    // Local → world: rotation about +Y by target.yaw.
    const cx = target.x + box.offset.x * cosT + box.offset.z * sinT;
    const cy = target.y + box.offset.y;
    const cz = target.z - box.offset.x * sinT + box.offset.z * cosT;

    if (cy + box.radius < bandMin || cy - box.radius > bandMax) continue;

    const dx = cx - attacker.x;
    const dz = cz - attacker.z;
    const distance = Math.hypot(dx, dz);
    if (distance - box.radius > step.reach) continue;

    if (step.arcDegrees < 360 && distance > box.radius) {
      const cosAngle = (dx * fwdX + dz * fwdZ) / distance;
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      if (angle > halfArc + Math.asin(box.radius / distance)) continue;
    }

    if (box.exposure) {
      const nx = box.exposure.normal.x * cosT + box.exposure.normal.z * sinT;
      const nz = -box.exposure.normal.x * sinT + box.exposure.normal.z * cosT;
      const nLen = Math.hypot(nx, nz) || 1;
      const toAttackerDot = distance > 1e-6 ? (-dx * nx - dz * nz) / (distance * nLen) : 1;
      if (toAttackerDot < box.exposure.minDot) continue;
    }

    const isBetter =
      best === null ||
      (box.kind === 'weakpoint' && best.hurtbox.kind !== 'weakpoint') ||
      (box.kind === best.hurtbox.kind && distance < bestDistance);
    if (!isBetter) continue;

    const inv = distance > 1e-6 ? 1 / distance : 0;
    best = {
      hurtbox: box,
      pointX: cx - dx * inv * box.radius,
      pointY: Math.min(Math.max(cy, bandMin), bandMax),
      pointZ: cz - dz * inv * box.radius,
    };
    bestDistance = distance;
  }

  return best;
}
