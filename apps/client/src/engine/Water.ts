import * as THREE from 'three';
import { LAKE, WATER_LEVEL, type HeightGrid } from '../world/geography.ts';

const VERTEX = /* glsl */ `
attribute float depth;
varying float vDepth;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vDepth = depth;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uSky;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uLight;
varying float vDepth;
varying vec3 vWorld;
#include <fog_pars_fragment>

float wave(vec2 p, vec2 dir, float freq, float speed) {
  return sin(dot(p, dir) * freq + uTime * speed);
}

void main() {
  if (vDepth < -0.02) discard;
  vec2 p = vWorld.xz;
  // Slope of a few summed waves -> a cheap animated normal.
  float gx = 0.0;
  float gz = 0.0;
  vec2 d1 = normalize(vec2(1.0, 0.35));
  vec2 d2 = normalize(vec2(-0.6, 1.0));
  vec2 d3 = normalize(vec2(0.2, -1.0));
  float c1 = cos(dot(p, d1) * 0.9 + uTime * 1.1) * 0.9 * 0.05;
  float c2 = cos(dot(p, d2) * 1.7 + uTime * 1.6) * 1.7 * 0.025;
  float c3 = cos(dot(p, d3) * 3.1 + uTime * 2.3) * 3.1 * 0.01;
  gx = c1 * d1.x + c2 * d2.x + c3 * d3.x;
  gz = c1 * d1.y + c2 * d2.y + c3 * d3.y;
  vec3 n = normalize(vec3(-gx, 1.0, -gz));

  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(view, n), 0.0), 4.0);
  vec3 shallow = vec3(0.16, 0.42, 0.42);
  vec3 deep = vec3(0.03, 0.14, 0.22);
  vec3 col = mix(shallow, deep, smoothstep(0.0, 1.3, vDepth)) * uLight;
  col = mix(col, uSky, 0.12 + 0.75 * fresnel);
  vec3 r = reflect(-view, n);
  float glint = pow(max(dot(r, uSunDir), 0.0), 260.0) * 6.0 + pow(max(dot(r, uSunDir), 0.0), 24.0) * 0.12;
  col += uSunColor * glint;

  // Lapping foam along the shore.
  float shore = 1.0 - smoothstep(0.0, 0.22, vDepth);
  float lap = 0.55 + 0.45 * sin(uTime * 1.8 + p.x * 0.6 + p.y * 0.45);
  col = mix(col, vec3(0.9, 0.93, 0.92) * max(uLight, 0.25), shore * lap * 0.55);

  float alpha = mix(0.5, 0.9, smoothstep(0.0, 1.0, vDepth));
  alpha = max(alpha, shore * lap * 0.6) * smoothstep(-0.02, 0.06, vDepth);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

const RIPPLES = 10;

/** Mirror Lake's surface: animated waves, sky fresnel, sun glint, shore foam, wading ripples. */
export class Water {
  readonly mesh: THREE.Mesh;
  readonly #material: THREE.ShaderMaterial;
  readonly #ripples: { mesh: THREE.Mesh; age: number }[] = [];
  readonly #rippleMaterial = new THREE.MeshBasicMaterial({
    color: '#e8f4f4',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  #nextRipple = 0;

  constructor(scene: THREE.Scene, grid: HeightGrid) {
    const size = LAKE.radius * 2.8;
    const geometry = new THREE.PlaneGeometry(size, size, 140, 140);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute('position');
    const depth = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      depth[i] = WATER_LEVEL - grid.sample(position.getX(i) + LAKE.x, position.getZ(i) + LAKE.z);
    }
    geometry.setAttribute('depth', new THREE.BufferAttribute(depth, 1));

    this.#material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSky: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) },
          uSunColor: { value: new THREE.Color() },
          uLight: { value: 1 },
        },
      ]),
    });
    this.mesh = new THREE.Mesh(geometry, this.#material);
    this.mesh.position.set(LAKE.x, WATER_LEVEL, LAKE.z);
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);

    const ring = new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2);
    for (let i = 0; i < RIPPLES; i++) {
      const mesh = new THREE.Mesh(ring, this.#rippleMaterial.clone());
      mesh.visible = false;
      mesh.renderOrder = 3;
      scene.add(mesh);
      this.#ripples.push({ mesh, age: 1 });
    }
  }

  /** Feed the lighting of the moment so the lake matches the sky. */
  update(time: number, dt: number, sky: THREE.Color, sunDir: THREE.Vector3, sunColor: THREE.Color, daylight: number): void {
    const u = this.#material.uniforms;
    u.uTime!.value = time;
    (u.uSky!.value as THREE.Color).copy(sky);
    (u.uSunDir!.value as THREE.Vector3).copy(sunDir);
    (u.uSunColor!.value as THREE.Color).copy(sunColor);
    u.uLight!.value = 0.18 + 0.82 * daylight;
    for (const ripple of this.#ripples) {
      if (ripple.age >= 1) continue;
      ripple.age += dt / 1.1;
      const s = 0.4 + ripple.age * 2.2;
      ripple.mesh.scale.set(s, 1, s);
      (ripple.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - ripple.age) * 0.5 * (0.3 + 0.7 * daylight);
      ripple.mesh.visible = ripple.age < 1;
    }
  }

  /** A ring spreading from a wading foot. */
  ripple(x: number, z: number): void {
    const ripple = this.#ripples[this.#nextRipple]!;
    this.#nextRipple = (this.#nextRipple + 1) % RIPPLES;
    ripple.age = 0;
    ripple.mesh.position.set(x, WATER_LEVEL + 0.02, z);
    ripple.mesh.visible = true;
  }
}
