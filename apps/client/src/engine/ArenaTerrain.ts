import { DeterministicRng } from '@frontier/combat-math';
import * as THREE from 'three';
import type { PhysicsWorld } from './PhysicsWorld.ts';

export const ARENA_RADIUS = 30;
const WALL_RADIUS = ARENA_RADIUS + 1.6;
const WORLD_SIZE = 260;
const SEGMENTS = 140;

/**
 * Deterministic height function. Both the render mesh and the Rapier trimesh are built from
 * it, and the server can rebuild identical collision from the same seed-free formula.
 */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const outside = smoothstep(ARENA_RADIUS + 3, ARENA_RADIUS + 18, r);
  const hills = (fbm(x * 0.028, z * 0.028) - 0.32) * 10 * outside;
  const bowl = smoothstep(ARENA_RADIUS + 4, ARENA_RADIUS + 40, r) * 4;
  const mountains = smoothstep(96, 124, r) * 34 * (0.55 + fbm(x * 0.05 + 7, z * 0.05 - 3));
  return Math.max(hills, -1.5) + bowl + mountains;
}

/** The training-grounds arena: sand floor, ring wall with four gates, pillars, scattered props. */
export class ArenaTerrain {
  readonly group = new THREE.Group();

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.#buildGround(physics);
    this.#buildMarkings();
    this.#buildWall(physics);
    this.#buildPillars(physics);
    this.#buildScatter(physics);
    scene.add(this.group);
  }

  #buildGround(physics: PhysicsWorld): void {
    const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      const y = terrainHeight(x, z);
      position.setY(i, y);
      groundColor(x, y, z, color);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.96, metalness: 0 }),
    );
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const index = geometry.getIndex();
    if (!index) throw new Error('terrain geometry must be indexed');
    physics.addStatic(
      physics.rapier.ColliderDesc.trimesh(
        new Float32Array(position.array as ArrayLike<number>),
        Uint32Array.from(index.array as ArrayLike<number>),
      ).setFriction(0.8),
    );
  }

  #buildMarkings(): void {
    const material = new THREE.MeshBasicMaterial({
      color: '#f3d58a',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (const [inner, outer] of [
      [7.6, 8.0],
      [ARENA_RADIUS - 1.4, ARENA_RADIUS - 0.9],
    ] as const) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.group.add(ring);
    }
    // Spokes of the training sigil.
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 5.5), material);
      const angle = (i / 8) * Math.PI * 2;
      spoke.rotation.set(-Math.PI / 2, 0, angle); // lies flat, pointing radially
      spoke.position.set(Math.sin(angle) * 11, 0.02, Math.cos(angle) * 11);
      this.group.add(spoke);
    }
  }

  #buildWall(physics: PhysicsWorld): void {
    const segments = 40;
    const rng = new DeterministicRng(31);
    const blocks: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < segments; i++) {
      if (i % 10 === 0) continue; // four gates (N/E/S/W) into the wilds
      const angle = (i / segments) * Math.PI * 2;
      const height = 1.2 + rng.next() * 0.9;
      const width = ((Math.PI * 2 * WALL_RADIUS) / segments) * 0.94;
      pos.set(Math.sin(angle) * WALL_RADIUS, height / 2 - 0.2, Math.cos(angle) * WALL_RADIUS);
      quaternion.setFromAxisAngle(up, angle);
      scale.set(width, height, 1.3);
      blocks.push(matrix.compose(pos, quaternion, scale).clone());
      physics.addStatic(
        physics.rapier.ColliderDesc.cuboid(width / 2, height / 2, 0.65)
          .setTranslation(pos.x, pos.y, pos.z)
          .setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w }),
      );
    }

    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#9a8f7e', flatShading: true, roughness: 0.9 }),
      blocks.length,
    );
    blocks.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    // Gate posts with banners mark the four exits.
    const postMaterial = new THREE.MeshStandardMaterial({ color: '#5b4a3a', flatShading: true });
    const bannerMaterial = new THREE.MeshStandardMaterial({ color: '#b3342c', flatShading: true, side: THREE.DoubleSide });
    for (let g = 0; g < 4; g++) {
      const angle = (g / 4) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const offset = angle + side * ((Math.PI * 2) / segments) * 0.55;
        const x = Math.sin(offset) * WALL_RADIUS;
        const z = Math.cos(offset) * WALL_RADIUS;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.6, 6), postMaterial);
        post.position.set(x, 2.3, z);
        post.castShadow = true;
        // Hangs on the inner face of the post, facing the arena centre.
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), bannerMaterial);
        banner.position.set(Math.sin(offset) * (WALL_RADIUS - 0.32), 3.0, Math.cos(offset) * (WALL_RADIUS - 0.32));
        banner.rotation.y = offset;
        banner.castShadow = true;
        this.group.add(post, banner);
        physics.addStatic(physics.rapier.ColliderDesc.cylinder(2.3, 0.28).setTranslation(x, 2.3, z));
      }
    }
  }

  #buildPillars(physics: PhysicsWorld): void {
    const rng = new DeterministicRng(7);
    const material = new THREE.MeshStandardMaterial({ color: '#c8bfae', flatShading: true, roughness: 0.85 });
    const capMaterial = new THREE.MeshStandardMaterial({ color: '#a99f8c', flatShading: true });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.sin(angle) * 20;
      const z = Math.cos(angle) * 20;
      const height = 3.5 + rng.next() * 3.5;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.8, height, 8), material);
      pillar.position.set(x, height / 2, z);
      pillar.rotation.y = rng.next() * Math.PI;
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.group.add(pillar);

      const broken = rng.next() < 0.5;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.9), capMaterial);
      cap.position.set(x, height + 0.22, z);
      if (broken) {
        cap.position.set(x + 1.4, 0.22, z + 0.6);
        cap.rotation.set(0.12, rng.next() * Math.PI, 0.2);
        physics.addStatic(physics.rapier.ColliderDesc.cuboid(0.95, 0.22, 0.95).setTranslation(x + 1.4, 0.22, z + 0.6));
      }
      cap.castShadow = true;
      cap.receiveShadow = true;
      this.group.add(cap);

      physics.addStatic(physics.rapier.ColliderDesc.cylinder(height / 2, 0.78).setTranslation(x, height / 2, z));
    }
  }

  #buildScatter(physics: PhysicsWorld): void {
    const rng = new DeterministicRng(2024);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();

    const treeCount = 150;
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.22, 0.32, 2.4, 6).translate(0, 1.2, 0),
      new THREE.MeshStandardMaterial({ color: '#6b4c33', flatShading: true }),
      treeCount,
    );
    const crowns = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1.7, 4.2, 7).translate(0, 4.0, 0),
      new THREE.MeshStandardMaterial({ color: '#3f6b35', flatShading: true }),
      treeCount,
    );
    const crownColor = new THREE.Color();
    for (let i = 0; i < treeCount; i++) {
      const angle = rng.next() * Math.PI * 2;
      const radius = 44 + rng.next() * 62;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const s = 0.8 + rng.next() * 0.9;
      pos.set(x, terrainHeight(x, z) - 0.1, z);
      quaternion.setFromEuler(euler.set(0, rng.next() * Math.PI * 2, 0));
      scale.set(s, s * (0.9 + rng.next() * 0.4), s);
      matrix.compose(pos, quaternion, scale);
      trunks.setMatrixAt(i, matrix);
      crowns.setMatrixAt(i, matrix);
      crowns.setColorAt(i, crownColor.setHSL(0.27 + rng.next() * 0.06, 0.42, 0.26 + rng.next() * 0.1, THREE.SRGBColorSpace));
      physics.addStatic(physics.rapier.ColliderDesc.cylinder(1.2 * s, 0.3 * s).setTranslation(x, pos.y + 1.2 * s, z));
    }
    trunks.castShadow = crowns.castShadow = true;
    trunks.receiveShadow = crowns.receiveShadow = true;
    this.group.add(trunks, crowns);

    const rockCount = 110;
    const rocks = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: '#8a8780', flatShading: true, roughness: 0.9 }),
      rockCount,
    );
    for (let i = 0; i < rockCount; i++) {
      const angle = rng.next() * Math.PI * 2;
      const radius = 35 + rng.next() * 75;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const s = 0.35 + rng.next() * rng.next() * 2.4;
      pos.set(x, terrainHeight(x, z) + s * 0.25, z);
      quaternion.setFromEuler(euler.set(rng.next() * 3, rng.next() * 3, rng.next() * 3));
      scale.set(s * (1 + rng.next() * 0.6), s * 0.7, s);
      rocks.setMatrixAt(i, matrix.compose(pos, quaternion, scale));
      if (s > 1) physics.addStatic(physics.rapier.ColliderDesc.ball(s * 0.8).setTranslation(pos.x, pos.y, pos.z));
    }
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    this.group.add(rocks);
  }
}

function groundColor(x: number, y: number, z: number, out: THREE.Color): void {
  const r = Math.hypot(x, z);
  const n = fbm(x * 0.15, z * 0.15);
  // Authored in sRGB; Color converts to the linear working space.
  const srgb = THREE.SRGBColorSpace;
  const sand = tmpA.setRGB(0.7 + n * 0.08, 0.6 + n * 0.07, 0.43 + n * 0.05, srgb);
  const grass = tmpB.setRGB(0.36 + n * 0.12, 0.52 + n * 0.14, 0.25 + n * 0.05, srgb);
  out.copy(sand).lerp(grass, smoothstep(ARENA_RADIUS + 1, ARENA_RADIUS + 6, r));
  if (y > 7) out.lerp(tmpC.setRGB(0.5, 0.48, 0.44, srgb), smoothstep(7, 12, y));
  if (y > 22) out.lerp(tmpC.setRGB(0.92, 0.94, 0.96, srgb), smoothstep(22, 28, y));
}
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const tmpC = new THREE.Color();

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hash2(ix: number, iz: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < 4; i++) {
    sum += amplitude * valueNoise(x * frequency, z * frequency);
    frequency *= 2;
    amplitude *= 0.5;
  }
  return sum;
}
