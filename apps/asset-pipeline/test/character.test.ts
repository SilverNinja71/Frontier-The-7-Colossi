import { describe, expect, it } from 'vitest';
import { buildCharacter, fitStaff, straighten, type RigSpec } from '../src/character.ts';

type V3 = [number, number, number];

/** A thin box (12 triangles) from a to b, as a triangle soup. */
function rod(a: V3, b: V3, r = 1.5): number[] {
  const corners: V3[] = [];
  for (const end of [a, b]) {
    for (const [dx, dz] of [
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ] as const) {
      corners.push([end[0] + dx, end[1], end[2] + dz]);
    }
  }
  const faces = [
    [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
    [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
    [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0],
  ];
  return faces.flatMap((f) => f.flatMap((i) => corners[i]!));
}

/** A rod made of many short pieces, so vertices exist all along it (like a real mesh). */
function segmentedRod(a: V3, b: V3, pieces: number, r = 1.2): number[] {
  const out: number[] = [];
  for (let i = 0; i < pieces; i++) {
    const at = (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    out.push(...rod(at(i / pieces), at((i + 1) / pieces), r));
  }
  return out;
}

/** Stick-figure statue (model units, facing +Z): bent left knee, a staff, a plinth. */
const spec: RigSpec = {
  soles: { R: 10, L: 10 },
  pelvisHeight: 0.95,
  joints: {
    pelvis: [0, 70, 0],
    neck: [0, 100, 0],
    headTop: [0, 120, 0],
    shoulderR: [-15, 98, 0],
    elbowR: [-17, 82, 0],
    wristR: [-18, 66, 0],
    shoulderL: [15, 98, 0],
    elbowL: [17, 82, 0],
    wristL: [18, 66, 0],
    hipR: [-7, 66, 0],
    kneeR: [-7, 40, 0],
    ankleR: [-7, 14, 0],
    hipL: [7, 66, 0],
    kneeL: [7, 44, 16],
    ankleL: [7, 14, 0],
  },
  staff: { bottom: [-40, 5, -12], top: [40, 140, -12], length: 2, gripFromTop: 0.5 },
  radii: { torso: 10, head: 7, arm: 4, leg: 5 },
  armSplay: 0.15,
};

function statue(): Float32Array {
  const J = spec.joints;
  const soup = [
    ...rod(J.pelvis, J.neck, 6),
    ...rod(J.neck, J.headTop, 5),
    ...rod(J.shoulderR, J.elbowR),
    ...rod(J.elbowR, J.wristR),
    ...rod(J.shoulderL, J.elbowL),
    ...rod(J.elbowL, J.wristL),
    ...rod(J.hipR, J.kneeR, 2),
    ...rod(J.kneeR, J.ankleR, 2),
    ...rod(J.ankleR, [-7, 10, 0], 2),
    ...rod(J.hipL, J.kneeL, 2),
    ...rod(J.kneeL, J.ankleL, 2),
    ...rod(J.ankleL, [7, 10, 0], 2),
    ...segmentedRod(spec.staff!.bottom, spec.staff!.top, 40),
    // Plinth well away from the feet.
    ...rod([30, 0, 30], [30, 8, 30], 8),
    ...rod([-30, 0, 30], [-30, 8, 30], 8),
  ];
  return Float32Array.from(soup);
}

describe('rigid-part character builder', () => {
  const result = buildCharacter(statue(), spec);
  const part = (name: string) => result.parts.find((p) => p.name === name)!;

  it('cuts every limb, the torso and the weapon into their own parts, and drops the plinth', () => {
    expect(result.parts.map((p) => p.name).sort()).toEqual(['armL', 'armR', 'legL', 'legR', 'staff', 'torso']);
    for (const p of result.parts) expect(p.indices.length).toBeGreaterThan(0);
    expect(result.dropped).toBe(24);
  });

  it('scales to the rig: pelvis at the requested height, feet on the ground', () => {
    expect(result.rig.pelvisHeight).toBe(0.95);
    for (const side of ['R', 'L'] as const) {
      const leg = part(`leg${side}`);
      let minY = Infinity;
      for (let i = 1; i < leg.positions.length; i += 3) minY = Math.min(minY, leg.positions[i]!);
      const hip = result.rig[`hip${side}`];
      expect(hip[1] + minY).toBeCloseTo(-0.95, 1);
    }
  });

  it('straightens a bent knee so the leg hangs under the hip', () => {
    const leg = part('legL');
    let maxForward = 0;
    for (let i = 2; i < leg.positions.length; i += 3) maxForward = Math.max(maxForward, Math.abs(leg.positions[i]!));
    // The statue's knee sticks 16 units (~0.27 m) forward; straightened it stays within the leg's thickness.
    expect(maxForward).toBeLessThan(0.08);
  });

  it('turns the figure to face -Z with its right side on +X', () => {
    expect(result.rig.shoulderR[0]).toBeGreaterThan(0);
    expect(result.rig.shoulderL[0]).toBeLessThan(0);
  });

  it('lays the weapon along local Y, gripped at the origin', () => {
    const staff = part('staff');
    let top = -Infinity;
    let bottom = Infinity;
    for (let i = 1; i < staff.positions.length; i += 3) {
      top = Math.max(top, staff.positions[i]!);
      bottom = Math.min(bottom, staff.positions[i]!);
    }
    expect(top).toBeCloseTo(0.5, 1);
    expect(bottom).toBeCloseTo(-1.5, 1);
    expect(staff.colors).toBeDefined();
  });
});

describe('geometry helpers', () => {
  it('straighten keeps segment lengths and points both along the target', () => {
    const bend = straighten([0, 0, 0], [0, -1, 1], [0, -2, 0], [0, -1, 0], 0.01);
    const knee = bend([0, -1, 1]);
    const ankle = bend([0, -2, 0]);
    expect(knee[1]).toBeCloseTo(-Math.SQRT2, 5);
    expect(ankle[1]).toBeCloseTo(-2 * Math.SQRT2, 5);
    expect(Math.abs(ankle[2])).toBeLessThan(1e-6);
  });

  it('fitStaff recovers a weapon axis from a rough guess', () => {
    const soup = Float32Array.from(segmentedRod([-40, 5, -12], [40, 140, -12], 40));
    const fitted = fitStaff(soup, { bottom: [-36, 5, -9], top: [44, 140, -10] });
    expect(fitted.bottom[0]).toBeCloseTo(-40, 0);
    expect(fitted.top[2]).toBeCloseTo(-12, 0);
  });
});
