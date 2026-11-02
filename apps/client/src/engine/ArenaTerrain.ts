import { DeterministicRng } from '@frontier/combat-math';
import * as THREE from 'three';
import { ARENA_RADIUS } from '../world/geography.ts';
import type { NatureKit } from './NatureKit.ts';
import type { PhysicsWorld } from './PhysicsWorld.ts';

const GRASS = ['Grass_Common_Short', 'Grass_Wispy_Short'];
const PEBBLES = ['Pebble_Round_1', 'Pebble_Round_2', 'Pebble_Square_1'];

export interface ArenaOptions {
  /** Art kit from apps/asset-pipeline; null skips the decorative props. */
  kit: NatureKit | null;
}

const WALL_RADIUS = ARENA_RADIUS + 1.6;

const BRAZIER_LIGHT = 26;

/** The training-grounds arena: ring wall with four gates, markings, pillars, braziers, props. */
export class ArenaTerrain {
  readonly group = new THREE.Group();
  readonly #markingMaterial = new THREE.MeshBasicMaterial({
    color: '#f3d58a',
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  readonly #flames: { mesh: THREE.Mesh; light: THREE.PointLight; phase: number }[] = [];
  readonly #flameMaterial = new THREE.MeshBasicMaterial({
    color: '#ffb347',
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  constructor(scene: THREE.Scene, physics: PhysicsWorld, options: ArenaOptions) {
    this.#buildMarkings();
    this.#buildWall(physics);
    this.#buildPillars(physics);
    this.#buildBraziers(physics);
    if (options.kit) this.#buildRingProps(options.kit);
    scene.add(this.group);
  }

  /**
   * Night factor 0..1: braziers kindle at dusk. Light count stays constant (intensity only)
   * so the cycle never triggers shader recompiles.
   */
  setNight(night: number, time: number): void {
    this.#markingMaterial.opacity = 0.32 - 0.14 * night;
    this.#flameMaterial.opacity = night;
    for (const flame of this.#flames) {
      const flicker = 0.85 + Math.sin(time * 11 + flame.phase) * 0.08 + Math.sin(time * 23 + flame.phase * 2) * 0.07;
      flame.light.intensity = BRAZIER_LIGHT * night * flicker;
      flame.mesh.visible = night > 0.02;
      flame.mesh.scale.set(1, 0.6 + 0.4 * night * flicker, 1);
    }
  }

  #buildMarkings(): void {
    const material = this.#markingMaterial;
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

  #buildBraziers(physics: PhysicsWorld): void {
    const iron = new THREE.MeshStandardMaterial({ color: '#3b3632', flatShading: true, roughness: 0.6, metalness: 0.5 });
    const coal = new THREE.MeshStandardMaterial({ color: '#2a1608', emissive: '#ff5a1a', emissiveIntensity: 0.6, flatShading: true });
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i * Math.PI) / 2; // between the gates
      const x = Math.sin(angle) * (ARENA_RADIUS - 3.5);
      const z = Math.cos(angle) * (ARENA_RADIUS - 3.5);
      const brazier = new THREE.Group();
      brazier.position.set(x, 0, z);
      for (let leg = 0; leg < 3; leg++) {
        const a = (leg / 3) * Math.PI * 2;
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.3, 5), iron);
        m.position.set(Math.sin(a) * 0.32, 0.6, Math.cos(a) * 0.32);
        m.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
        brazier.add(m);
      }
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.32, 0.38, 8, 1, true), iron);
      bowl.position.y = 1.32;
      bowl.material.side = THREE.DoubleSide;
      const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 8), coal);
      coals.position.y = 1.42;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.25, 7, 1, true).translate(0, 0.62, 0), this.#flameMaterial);
      flame.position.y = 1.42;
      const light = new THREE.PointLight('#ff9a4a', 0, 22, 1.6);
      light.position.y = 2.3;
      brazier.add(bowl, coals, flame, light);
      brazier.traverse((o) => {
        if (o instanceof THREE.Mesh && o !== flame) o.castShadow = true;
      });
      this.group.add(brazier);
      this.#flames.push({ mesh: flame, light, phase: i * 1.7 });
      physics.addStatic(physics.rapier.ColliderDesc.cylinder(0.75, 0.6).setTranslation(x, 0.75, z));
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

  /** Grass tufts at the wall's foot, pebbles on the sand, mushrooms by the pillars. */
  #buildRingProps(kit: NatureKit): void {
    const rng = new DeterministicRng(2024);
    const placements = new Map<string, THREE.Matrix4[]>();
    const place = (model: string, x: number, z: number, s: number) => {
      if (!kit.has(model)) return;
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x, -0.05 * s, z),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng.next() * Math.PI * 2),
        new THREE.Vector3(s, s, s),
      );
      placements.set(model, [...(placements.get(model) ?? []), matrix]);
    };
    const inRing = (min: number, max: number): [number, number] => {
      const a = rng.next() * Math.PI * 2;
      const r = min + rng.next() * (max - min);
      return [Math.sin(a) * r, Math.cos(a) * r];
    };
    const pick = (models: readonly string[]) => models[Math.floor(rng.next() * models.length)]!;
    for (let i = 0; i < 70; i++) place(pick(GRASS), ...inRing(27.5, 29.8), 0.7 + rng.next() * 0.4);
    for (let i = 0; i < 45; i++) place(pick(PEBBLES), ...inRing(3, 28), 0.8 + rng.next() * 0.8);
    for (let i = 0; i < 14; i++) {
      const pillar = Math.floor(i / 2.34) % 6;
      const angle = (pillar / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.sin(angle) * 20 + (rng.next() - 0.5) * 3;
      const z = Math.cos(angle) * 20 + (rng.next() - 0.5) * 3;
      place('Mushroom_Common', x, z, 0.8 + rng.next() * 0.6);
    }
    for (const [model, matrices] of placements) {
      for (const part of kit.parts(model)) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
        matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    }
  }
}
