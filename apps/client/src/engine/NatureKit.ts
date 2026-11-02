import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface KitPart {
  /**
   * Float32, indexed geometry with position/normal/uv/color and the model's internal node
   * transforms baked in (origin = model base). Uniform layout so parts can share a BatchedMesh.
   */
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
}

/** Materials that sway in the wind (foliage cards, grass, petals). */
const SWAYING = /Leaves|Leaf|Grass|Flowers/;

/**
 * Optimised art kit produced by apps/asset-pipeline (one .glb, one top-level node per
 * model). Loads once; hands out per-model parts for instancing.
 */
export class NatureKit {
  readonly #models = new Map<string, KitPart[]>();
  /** Shared wind clock for every swaying material. */
  readonly #wind = { value: 0 };

  private constructor(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const swayed = new Set<THREE.Material>();
    for (const model of root.children) {
      const inverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
      const parts: KitPart[] = [];
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        // Dequantise before baking: transforms would clip normalised int16 positions.
        const geometry = uniformGeometry(object.geometry as THREE.BufferGeometry);
        geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
        geometry.computeBoundingSphere();
        const material = object.material as THREE.MeshStandardMaterial;
        if (SWAYING.test(material.name) && !swayed.has(material)) {
          swayed.add(material);
          this.#addSway(material);
        }
        parts.push({ geometry, material });
      });
      this.#models.set(model.name, parts);
    }
  }

  /** Resolves to null (never throws) so the world can fall back to procedural props. */
  static async load(url: string): Promise<NatureKit | null> {
    try {
      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(url);
      return new NatureKit(gltf.scene);
    } catch (error) {
      console.warn('[NatureKit] falling back to procedural scenery:', error);
      return null;
    }
  }

  has(model: string): boolean {
    return this.#models.has(model);
  }

  parts(model: string): readonly KitPart[] {
    return this.#models.get(model) ?? [];
  }

  /** Advance the wind; call once per rendered frame. */
  tick(seconds: number): void {
    this.#wind.value = seconds;
  }

  /** Vertex sway scaled by height above the model base, phase-shifted per instance. */
  #addSway(material: THREE.MeshStandardMaterial): void {
    const wind = this.#wind;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWind = wind;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uWind;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          #if defined( USE_BATCHING )
            float phase = batchingMatrix[3].x * 0.31 + batchingMatrix[3].z * 0.23;
          #elif defined( USE_INSTANCING )
            float phase = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23;
          #else
            float phase = 0.0;
          #endif
          float bend = max(position.y, 0.0) * 0.035;
          transformed.x += sin(uWind * 1.6 + phase) * bend;
          transformed.z += cos(uWind * 1.3 + phase * 1.7) * bend * 0.6;`,
        );
    };
    material.customProgramCacheKey = () => 'frontier-sway';
  }
}

/** Copy any glTF primitive into float position/normal/uv/color + index (missing ones filled). */
function uniformGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = source.getAttribute('position');
  const count = position.count;
  const out = new THREE.BufferGeometry();
  const copy = (name: string, itemSize: number, fallback: number) => {
    const attribute = source.getAttribute(name);
    const array = new Float32Array(count * itemSize);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < itemSize; c++) {
        array[i * itemSize + c] = attribute ? attribute.getComponent(i, Math.min(c, attribute.itemSize - 1)) : fallback;
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  };
  copy('position', 3, 0);
  copy('uv', 2, 0);
  copy('color', 3, 1);
  if (source.getAttribute('normal')) copy('normal', 3, 0);
  else out.computeVertexNormals();
  const index = source.getIndex();
  const indices = new Uint32Array(index ? index.count : count);
  for (let i = 0; i < indices.length; i++) indices[i] = index ? index.getX(i) : i;
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}
