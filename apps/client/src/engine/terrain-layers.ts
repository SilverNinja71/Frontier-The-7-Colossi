import * as THREE from 'three';

/** Fallback colours (sRGB) for each layer if the texture strip fails to load. */
const FALLBACK = ['#6d7a3d', '#8f7756', '#8b8478', '#cbb88c', '#eef1f4', '#4a3b29'];

/** Decoded RGBA pixels of every layer, stacked, with each layer's mean colour (linear). */
export interface TerrainLayerImage {
  data: Uint8Array;
  size: number;
  depth: number;
  means: THREE.Vector3[];
}

/** Mean linear colour of each layer (every 4th pixel is plenty). */
function layerMeans(data: Uint8Array, size: number, depth: number): THREE.Vector3[] {
  const lut = new Float32Array(256);
  const c = new THREE.Color();
  for (let i = 0; i < 256; i++) lut[i] = c.setRGB(i / 255, 0, 0, THREE.SRGBColorSpace).r;
  const perLayer = size * size;
  return Array.from({ length: depth }, (_, layer) => {
    const mean = new THREE.Vector3();
    let n = 0;
    for (let p = layer * perLayer; p < (layer + 1) * perLayer; p += 4, n++) {
      mean.x += lut[data[p * 4]!]!;
      mean.y += lut[data[p * 4 + 1]!]!;
      mean.z += lut[data[p * 4 + 2]!]!;
    }
    return mean.divideScalar(Math.max(1, n)).max(new THREE.Vector3(0.01, 0.01, 0.01));
  });
}

/**
 * Loads the packed terrain strip (apps/asset-pipeline build-terrain.ts: square layers stacked
 * vertically). Never throws: on failure each layer becomes a flat colour.
 */
export async function loadTerrainLayers(url: string): Promise<TerrainLayerImage> {
  try {
    const blob = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.blob();
    });
    const bitmap = await createImageBitmap(blob);
    const size = bitmap.width;
    const depth = Math.round(bitmap.height / size);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size * depth;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2D context');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = new Uint8Array(ctx.getImageData(0, 0, size, size * depth).data.buffer);
    return { data, size, depth, means: layerMeans(data, size, depth) };
  } catch (error) {
    console.warn('[terrain] falling back to flat colours:', error);
    const size = 4;
    const data = new Uint8Array(size * size * 4 * FALLBACK.length);
    const c = new THREE.Color();
    FALLBACK.forEach((hex, layer) => {
      c.set(hex);
      for (let i = 0; i < size * size; i++) data.set([c.r * 255, c.g * 255, c.b * 255, 255], (layer * size * size + i) * 4);
    });
    return { data, size, depth: FALLBACK.length, means: layerMeans(data, size, FALLBACK.length) };
  }
}

/** One texture array for the terrain shader (a single sampler for every ground layer). */
export function toTerrainTexture(image: TerrainLayerImage, renderer: THREE.WebGLRenderer): THREE.DataArrayTexture {
  const texture = new THREE.DataArrayTexture(image.data, image.size, image.size, image.depth);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.UnsignedByteType;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}
