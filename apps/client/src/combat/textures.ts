import * as THREE from 'three';

let softDot: THREE.Texture | null = null;

/** Round, soft-edged sprite for point particles (points are square without a map). */
export function softDotTexture(): THREE.Texture {
  if (softDot) return softDot;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  softDot = new THREE.CanvasTexture(canvas);
  return softDot;
}
