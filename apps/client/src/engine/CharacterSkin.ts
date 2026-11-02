import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type SkinPart = 'torso' | 'armR' | 'armL' | 'legR' | 'legL' | 'staff';

type V3 = [number, number, number];

/** Joint layout written by apps/asset-pipeline (build-character.ts), metres, pelvis-local. */
export interface SkinRig {
  pelvisHeight: number;
  shoulderR: V3;
  shoulderL: V3;
  hipR: V3;
  hipL: V3;
  handR: V3;
  handL: V3;
  headTop: number;
  staff?: { length: number; gripFromTop: number };
}

/** A rigid-part character: one geometry per PlayerRig part, plus where its joints sit. */
export interface CharacterSkin {
  name: string;
  rig: SkinRig;
  parts: Partial<Record<SkinPart, THREE.BufferGeometry>>;
}

/**
 * Personal-use characters live in the git-ignored apps/client/private-assets folder and are
 * served by the dev server only. Production builds compile this to `null` and never ask.
 */
export async function loadPrivateSkin(name: string): Promise<CharacterSkin | null> {
  if (!import.meta.env.DEV) return null;
  try {
    const manifest = (await fetch('/private-assets/manifest.json').then((r) => (r.ok ? r.json() : null))) as { models?: string[] } | null;
    const file = `${name}.rig.glb`;
    if (!manifest?.models?.includes(file)) return null;
    const gltf = await new GLTFLoader().loadAsync(`/private-assets/${file}`);
    const rig = gltf.scene.userData.rig as SkinRig | undefined;
    if (!rig) return null;
    const parts: CharacterSkin['parts'] = {};
    gltf.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) parts[object.name as SkinPart] = object.geometry as THREE.BufferGeometry;
    });
    return { name, rig, parts };
  } catch (error) {
    console.warn(`[skin] could not load ${name}:`, error);
    return null;
  }
}
