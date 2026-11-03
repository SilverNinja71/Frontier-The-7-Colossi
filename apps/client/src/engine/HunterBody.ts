import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/** Loads the hunter (apps/asset-pipeline build-hunter.ts). Resolves to null, never throws. */
export async function loadHunter(url: string): Promise<GLTF | null> {
  try {
    return await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url);
  } catch (error) {
    console.warn('[hunter] falling back to the stand-in body:', error);
    return null;
  }
}

export interface PlayOptions {
  /** Cross-fade seconds. */
  fade?: number;
  timeScale?: number;
  /** Loop (locomotion) or play once and hold the last frame (actions). */
  loop?: boolean;
  /** Start from the first frame even if this clip is already playing. */
  restart?: boolean;
}

/**
 * The player's animated body: the skinned hunter, its mixer and named clips, and grips on both
 * hand bones for the game's weapons. The grip is derived from the skeleton, not tuned by hand:
 * a sword held in a fist runs across the knuckles, from the little finger out past the index,
 * so the blade axis is (index_01 − pinky_01) in the hand's frame, through the middle of the palm.
 */
export class HunterBody {
  /** Container: the rig turns it (e.g. towards a dodge); the model inside faces -Z. */
  readonly object = new THREE.Group();
  readonly gripR: THREE.Group;
  readonly gripL: THREE.Group;
  /** Forearm bones (for the hunt mark's glowing bands). */
  readonly forearms: THREE.Object3D[] = [];
  readonly #mixer: THREE.AnimationMixer;
  readonly #actions = new Map<string, THREE.AnimationAction>();
  #current: THREE.AnimationAction | null = null;
  #currentKey = '';

  constructor(gltf: GLTF) {
    const model = gltf.scene;
    model.rotation.y = Math.PI; // the pack faces +Z; the rig faces -Z
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // skinned bounds lag the pose
      }
    });
    this.object.add(model);
    this.object.updateMatrixWorld(true);
    this.gripR = this.#grip(model, 'r');
    this.gripL = this.#grip(model, 'l');
    for (const side of ['r', 'l']) {
      const bone = model.getObjectByName(`lowerarm_${side}`);
      if (bone) this.forearms.push(bone);
    }
    this.#mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) this.#actions.set(clip.name, this.#mixer.clipAction(clip));
  }

  has(clip: string): boolean {
    return this.#actions.has(clip);
  }

  duration(clip: string): number {
    return this.#actions.get(clip)?.getClip().duration ?? 1;
  }

  get playing(): string {
    return this.#currentKey;
  }

  /** Cross-fades to a clip (no-op if it is already the current one, unless `restart`). */
  play(clip: string, { fade = 0.15, timeScale = 1, loop = true, restart = false }: PlayOptions = {}): void {
    const action = this.#actions.get(clip);
    if (!action) return;
    action.timeScale = timeScale;
    if (this.#current === action && !restart) return;
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.setEffectiveWeight(1);
    if (this.#current && this.#current !== action) action.crossFadeFrom(this.#current, fade, false);
    action.play();
    this.#current = action;
    this.#currentKey = clip;
  }

  /** Adjusts the playing clip's speed (locomotion follows ground speed). */
  setTimeScale(timeScale: number): void {
    if (this.#current) this.#current.timeScale = timeScale;
  }

  update(dt: number): void {
    this.#mixer.update(dt);
  }

  #grip(model: THREE.Object3D, side: 'r' | 'l'): THREE.Group {
    const grip = new THREE.Group();
    grip.name = `grip_${side}`;
    const hand = model.getObjectByName(`hand_${side}`);
    const index = model.getObjectByName(`index_01_${side}`);
    const pinky = model.getObjectByName(`pinky_01_${side}`);
    const middle = model.getObjectByName(`middle_01_${side}`);
    if (!hand || !index || !pinky || !middle) {
      model.add(grip);
      return grip;
    }
    const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const inverse = new THREE.Matrix4().copy(hand.matrixWorld).invert();
    const toLocal = (p: THREE.Vector3) => p.clone().applyMatrix4(inverse);
    const across = toLocal(world(index)).sub(toLocal(world(pinky))).normalize();
    const palm = toLocal(world(hand).add(world(middle)).multiplyScalar(0.5));
    grip.position.copy(palm);
    // Weapons hang along the group's -Y (blade from the hilt down to the tip).
    grip.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), across);
    // Undo the armature's scale so weapons keep their size in metres.
    const scale = new THREE.Vector3();
    hand.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    grip.scale.setScalar(1 / scale.x);
    hand.add(grip);
    return grip;
  }
}
