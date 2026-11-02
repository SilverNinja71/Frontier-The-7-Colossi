/**
 * Rigid-part character builder (pure; no I/O). See build-character.ts for the CLI.
 *
 * Print models are one fused mesh with no skeleton, so instead of skinning we cut the statue
 * into the PlayerRig's moving parts by nearest "bone capsule", drop the display base, and bake
 * each limb into the rig's rest pose: upper and lower segments are rotated to hang straight
 * (arms with a slight outward splay), blended smoothly across the elbow / knee.
 */
import type { Soup } from './print-model.ts';

type V3 = [number, number, number];

export interface RigSpec {
  /** Height of each sole in model units (the base below is removed); feet may stand at different heights. */
  soles: { R: number; L: number };
  /** Pelvis height above the ground in metres; sets the scale. */
  pelvisHeight: number;
  joints: Record<
    | 'pelvis'
    | 'neck'
    | 'headTop'
    | 'shoulderR'
    | 'elbowR'
    | 'wristR'
    | 'shoulderL'
    | 'elbowL'
    | 'wristL'
    | 'hipR'
    | 'kneeR'
    | 'ankleR'
    | 'hipL'
    | 'kneeL'
    | 'ankleL',
    V3
  >;
  /** Optional weapon held along a straight axis (bottom → top), in model units. */
  staff?: { bottom: V3; top: V3; length: number; gripFromTop: number };
  radii: { torso: number; head: number; arm: number; leg: number };
  /** Outward arm angle at rest, radians. */
  armSplay: number;
}

export type PartName = 'torso' | 'armR' | 'armL' | 'legR' | 'legL' | 'staff';

export interface CharacterPart {
  name: PartName;
  /** Part-local metres: torso about the pelvis, arms about the shoulder, legs about the hip, staff about the grip. */
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  colors?: Float32Array;
}

/** Joint layout for the client rig, metres, pelvis-local, character facing -Z (right = +X). */
export interface RigInfo {
  pelvisHeight: number;
  shoulderR: V3;
  shoulderL: V3;
  hipR: V3;
  hipL: V3;
  /** Wrist relative to its shoulder, after straightening (where the weapon is held). */
  handR: V3;
  handL: V3;
  headTop: number;
  staff?: { length: number; gripFromTop: number };
  legScale: { R: number; L: number };
}

export interface CharacterResult {
  parts: CharacterPart[];
  rig: RigInfo;
  dropped: number;
}

export function buildCharacter(soup: Soup, spec: RigSpec): CharacterResult {
  const J = spec.joints;
  const soleY = Math.min(spec.soles.R, spec.soles.L);
  const k = spec.pelvisHeight / (J.pelvis[1] - soleY);
  const staff = spec.staff ? fitStaff(soup, spec.staff) : undefined;
  /** Model units → pelvis-local metres, turned to face -Z. */
  const toRig = (p: V3): V3 => [-(p[0] - J.pelvis[0]) * k, (p[1] - J.pelvis[1]) * k, -(p[2] - J.pelvis[2]) * k];

  const bones: { part: PartName; points: V3[]; radius: number }[] = [
    { part: 'torso', points: [J.pelvis, J.neck], radius: spec.radii.torso },
    { part: 'torso', points: [J.neck, J.headTop], radius: spec.radii.head },
    { part: 'armR', points: [J.shoulderR, J.elbowR, J.wristR, extend(J.elbowR, J.wristR, 7)], radius: spec.radii.arm },
    { part: 'armL', points: [J.shoulderL, J.elbowL, J.wristL, extend(J.elbowL, J.wristL, 7)], radius: spec.radii.arm },
    { part: 'legR', points: [J.hipR, J.kneeR, J.ankleR], radius: spec.radii.leg },
    { part: 'legL', points: [J.hipL, J.kneeL, J.ankleL], radius: spec.radii.leg },
  ];

  const buckets = new Map<PartName, number[]>();
  const push = (part: PartName, tri: number) => {
    const list = buckets.get(part) ?? [];
    list.push(tri);
    buckets.set(part, list);
  };
  let dropped = 0;
  const triangles = soup.length / 9;
  for (let t = 0; t < triangles; t++) {
    const c: V3 = [0, 0, 0];
    for (let v = 0; v < 3; v++) for (let d = 0; d < 3; d++) c[d] = c[d]! + soup[t * 9 + v * 3 + d]! / 3;
    const toStaff = staff ? staffDistance(c, staff) : Infinity;
    if (toStaff <= 0) {
      push('staff', t);
      continue;
    }
    if (isBase(c, spec)) {
      dropped++;
      continue;
    }
    let best: PartName = 'torso';
    let bestScore = Infinity;
    for (const bone of bones) {
      const score = distanceToPolyline(c, bone.points) - bone.radius;
      if (score < bestScore) {
        bestScore = score;
        best = bone.part;
      }
    }
    // Far from every bone: stray weapon pieces go to the weapon, anything else is dropped.
    if (bestScore > 9) {
      if (toStaff < 6) push('staff', t);
      else dropped++;
      continue;
    }
    push(best, t);
  }

  const S = { R: toRig(J.shoulderR), L: toRig(J.shoulderL) };
  const H = { R: toRig(J.hipR), L: toRig(J.hipL) };
  const parts: CharacterPart[] = [];
  const rig: RigInfo = {
    pelvisHeight: spec.pelvisHeight,
    shoulderR: S.R,
    shoulderL: S.L,
    hipR: H.R,
    hipL: H.L,
    handR: [0, -0.5, 0],
    handL: [0, -0.5, 0],
    headTop: (J.headTop[1] - J.pelvis[1]) * k,
    legScale: { R: 1, L: 1 },
  };

  // Torso + head: rigid.
  parts.push(finishPart('torso', collect(soup, buckets.get('torso') ?? [], toRig)));

  // Arms: straighten with a slight outward splay; origin at the shoulder.
  for (const side of ['R', 'L'] as const) {
    const out = side === 'R' ? 1 : -1;
    const target: V3 = [out * Math.sin(spec.armSplay), -Math.cos(spec.armSplay), 0];
    const shoulder = toRig(J[`shoulder${side}` as const]);
    const elbow = toRig(J[`elbow${side}` as const]);
    const wrist = toRig(J[`wrist${side}` as const]);
    const bend = straighten(shoulder, elbow, wrist, target, 0.03);
    const positions = collect(soup, buckets.get(`arm${side}` as const) ?? [], (p) => sub(bend(toRig(p)), shoulder));
    parts.push(finishPart(`arm${side}` as const, positions));
    rig[`hand${side}` as const] = sub(bend(wrist), shoulder);
  }

  // Legs: thigh and shin straight down, the foot carried level (it already stands flat), then
  // a gentle vertical scale so the sole meets the ground. Origin at the hip.
  for (const side of ['R', 'L'] as const) {
    const hip = toRig(J[`hip${side}` as const]);
    const knee = toRig(J[`knee${side}` as const]);
    const ankle = toRig(J[`ankle${side}` as const]);
    const bend = straighten(hip, knee, ankle, [0, -1, 0], 0.035);
    const ankleAfter = bend(ankle);
    const band = 0.025;
    const pose = (p: V3): V3 => {
      const leg = bend(p);
      const foot = add(ankleAfter, sub(p, ankle));
      const w = smoothstep(ankle[1] + band, ankle[1] - band, p[1]);
      return [leg[0] + (foot[0] - leg[0]) * w, leg[1] + (foot[1] - leg[1]) * w, leg[2] + (foot[2] - leg[2]) * w];
    };
    const positions = collect(soup, buckets.get(`leg${side}` as const) ?? [], (p) => sub(pose(toRig(p)), hip));
    const footHeight = (J[`ankle${side}` as const][1] - spec.soles[side]) * k;
    const ankleLocal = ankleAfter[1] - hip[1];
    const wanted = -spec.pelvisHeight + footHeight - hip[1];
    const scale = ankleLocal < 0 ? wanted / ankleLocal : 1;
    for (let i = 1; i < positions.length; i += 3) positions[i] = positions[i]! * scale;
    rig.legScale[side] = scale;
    parts.push(finishPart(`leg${side}` as const, positions));
  }

  // Weapon: along local Y, gripped at the origin, top end up.
  if (spec.staff && staff) {
    const { length, gripFromTop } = spec.staff;
    const { bottom, top } = staff;
    const axis = normalize(sub(top, bottom));
    const scale = length / norm(sub(top, bottom));
    const grip = sub(top, mul(axis, gripFromTop / scale));
    const x = normalize(cross(axis, Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    const z = cross(x, axis);
    const toStaff = (p: V3): V3 => {
      const d = sub(p, grip);
      return [dot(d, x) * scale, dot(d, axis) * scale, dot(d, z) * scale];
    };
    const positions = collect(soup, buckets.get('staff') ?? [], toStaff);
    const colors = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      // Gilded ends and grip band, dark iron shaft.
      const y = positions[i + 1]!;
      const fromTop = gripFromTop - y;
      const gold = fromTop < 0.16 || fromTop > length - 0.16 || Math.abs(y) < 0.03;
      colors.set(gold ? [0.86, 0.66, 0.24] : [0.14, 0.13, 0.13], i);
    }
    parts.push(finishPart('staff', positions, colors));
    rig.staff = { length, gripFromTop };
  }

  return { parts, rig, dropped };
}

// --- Segmentation helpers -----------------------------------------------------------

function staffDistance(c: V3, staff: { bottom: V3; top: V3 }): number {
  const ab = sub(staff.top, staff.bottom);
  const t = dot(sub(c, staff.bottom), ab) / dot(ab, ab);
  if (t < -0.03 || t > 1.03) return Infinity;
  const nearest = add(staff.bottom, mul(ab, Math.max(0, Math.min(1, t))));
  // Ornate heads at the ends are thicker than the shaft.
  const radius = t < 0.08 || t > 0.92 ? 7 : 3.6;
  return norm(sub(c, nearest)) - radius;
}

/**
 * Refine a hand-annotated weapon axis: least-squares line through the vertices near it
 * (principal axis by power iteration), keeping the annotated end heights.
 */
export function fitStaff(soup: Soup, rough: { bottom: V3; top: V3 }): { bottom: V3; top: V3 } {
  let axis = { bottom: rough.bottom, top: rough.top };
  for (let pass = 0; pass < 3; pass++) {
    const near: V3[] = [];
    for (let i = 0; i < soup.length; i += 3) {
      const p: V3 = [soup[i]!, soup[i + 1]!, soup[i + 2]!];
      const ab = sub(axis.top, axis.bottom);
      const t = dot(sub(p, axis.bottom), ab) / dot(ab, ab);
      // The shaft only: skip the ornate ends and keep a tight radius.
      if (t < 0.12 || t > 0.88) continue;
      if (norm(sub(p, add(axis.bottom, mul(ab, t)))) < 4.5) near.push(p);
    }
    if (near.length < 50) return axis;
    const mean: V3 = [0, 0, 0];
    for (const p of near) for (let d = 0; d < 3; d++) mean[d] = mean[d]! + p[d]! / near.length;
    let dir = normalize(sub(axis.top, axis.bottom));
    for (let it = 0; it < 20; it++) {
      const next: V3 = [0, 0, 0];
      for (const p of near) {
        const q = sub(p, mean);
        const s = dot(q, dir);
        for (let d = 0; d < 3; d++) next[d] = next[d]! + q[d]! * s;
      }
      dir = normalize(next);
    }
    if (dir[1] < 0) dir = mul(dir, -1);
    const at = (y: number): V3 => add(mean, mul(dir, (y - mean[1]) / dir[1]));
    axis = { bottom: at(rough.bottom[1]), top: at(rough.top[1]) };
  }
  return axis;
}

/** The rock or plinth the statue stands on: everything at sole level away from the feet. */
function isBase(c: V3, spec: RigSpec): boolean {
  const top = Math.max(spec.soles.R, spec.soles.L) + 2.5;
  if (c[1] > top) return false;
  for (const side of ['R', 'L'] as const) {
    const ankle = spec.joints[`ankle${side}` as const];
    // Under a foot: keep down to its sole.
    if (Math.hypot(c[0] - ankle[0], c[2] - ankle[2]) < 10) return c[1] < spec.soles[side] - 0.5;
  }
  return true;
}

function extend(a: V3, b: V3, amount: number): V3 {
  return add(b, mul(normalize(sub(b, a)), amount));
}

function distanceToPolyline(p: V3, points: V3[]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const ab = sub(points[i + 1]!, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
    best = Math.min(best, norm(sub(p, add(a, mul(ab, t)))));
  }
  return best;
}

/**
 * Re-pose a two-segment limb so both segments point along `target`, keeping their lengths.
 * Points blend between the upper and lower transforms across a band around the joint.
 */
export function straighten(root: V3, joint: V3, end: V3, target: V3, band: number): (p: V3) => V3 {
  const upper = normalize(sub(joint, root));
  const lower = normalize(sub(end, joint));
  const dir = normalize(target);
  const rotUpper = rotationBetween(upper, dir);
  const rotLower = rotationBetween(lower, dir);
  const jointAfter = add(root, mul(dir, norm(sub(joint, root))));
  const seam = normalize(add(upper, lower));
  return (p) => {
    const a = add(root, apply(rotUpper, sub(p, root)));
    const b = add(jointAfter, apply(rotLower, sub(p, joint)));
    const s = dot(sub(p, joint), seam);
    const w = smoothstep(-band, band, s);
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
  };
}

// --- Mesh helpers --------------------------------------------------------------------

function collect(soup: Soup, triangles: number[], map: (p: V3) => V3): Float32Array {
  const out = new Float32Array(triangles.length * 9);
  triangles.forEach((t, i) => {
    for (let v = 0; v < 3; v++) {
      const p = map([soup[t * 9 + v * 3]!, soup[t * 9 + v * 3 + 1]!, soup[t * 9 + v * 3 + 2]!]);
      out.set(p, i * 9 + v * 3);
    }
  });
  return out;
}

/** Weld a triangle soup and give it smooth, area-weighted normals. */
export function finishPart(name: PartName, soupPositions: Float32Array, soupColors?: Float32Array): CharacterPart {
  const index = new Map<string, number>();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices = new Uint32Array(soupPositions.length / 3);
  for (let v = 0; v < soupPositions.length / 3; v++) {
    const x = soupPositions[v * 3]!;
    const y = soupPositions[v * 3 + 1]!;
    const z = soupPositions[v * 3 + 2]!;
    const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
    let id = index.get(key);
    if (id === undefined) {
      id = positions.length / 3;
      index.set(key, id);
      positions.push(x, y, z);
      if (soupColors) colors.push(soupColors[v * 3]!, soupColors[v * 3 + 1]!, soupColors[v * 3 + 2]!);
    }
    indices[v] = id;
  }
  const normals = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t]!, indices[t + 1]!, indices[t + 2]!];
    const pa: V3 = [positions[a * 3]!, positions[a * 3 + 1]!, positions[a * 3 + 2]!];
    const n = cross(sub([positions[b * 3]!, positions[b * 3 + 1]!, positions[b * 3 + 2]!], pa), sub([positions[c * 3]!, positions[c * 3 + 1]!, positions[c * 3 + 2]!], pa));
    for (const id of [a, b, c]) for (let d = 0; d < 3; d++) normals[id * 3 + d] = normals[id * 3 + d]! + n[d]!;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) || 1;
    normals[i] = normals[i]! / l;
    normals[i + 1] = normals[i + 1]! / l;
    normals[i + 2] = normals[i + 2]! / l;
  }
  return {
    name,
    positions: Float32Array.from(positions),
    normals,
    indices,
    colors: soupColors ? Float32Array.from(colors) : undefined,
  };
}

// --- Vector math -----------------------------------------------------------------------

type M3 = number[];

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
function mul(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a: V3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
function normalize(a: V3): V3 {
  const l = norm(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Row-major 3×3 rotation taking unit vector `from` onto unit vector `to` (Rodrigues). */
function rotationBetween(from: V3, to: V3): M3 {
  const v = cross(from, to);
  const c = dot(from, to);
  if (c < -0.9999) {
    // Opposite: rotate 180° about any perpendicular axis.
    const axis = normalize(cross(from, Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const [x, y, z] = axis;
    return [2 * x * x - 1, 2 * x * y, 2 * x * z, 2 * x * y, 2 * y * y - 1, 2 * y * z, 2 * x * z, 2 * y * z, 2 * z * z - 1];
  }
  const k = 1 / (1 + c);
  const [x, y, z] = v;
  return [
    c + x * x * k, x * y * k - z, x * z * k + y,
    x * y * k + z, c + y * y * k, y * z * k - x,
    x * z * k - y, y * z * k + x, c + z * z * k,
  ];
}

function apply(m: M3, p: V3): V3 {
  return [
    m[0]! * p[0] + m[1]! * p[1] + m[2]! * p[2],
    m[3]! * p[0] + m[4]! * p[1] + m[5]! * p[2],
    m[6]! * p[0] + m[7]! * p[1] + m[8]! * p[2],
  ];
}
