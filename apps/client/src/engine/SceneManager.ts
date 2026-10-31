import type { MoonPhase } from '@frontier/shared-types';
import * as THREE from 'three';

const SKY_VERTEX = /* glsl */ `
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w; // pin to far plane
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uNight;
  uniform float uMoonLit;
  varying vec3 vWorldDir;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = dir.y;
    vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
    sky = mix(uGround, sky, smoothstep(-0.12, 0.02, h));

    float sun = max(dot(dir, uSunDir), 0.0);
    sky += vec3(1.0, 0.86, 0.6) * (pow(sun, 900.0) * 3.0 + pow(sun, 12.0) * 0.18) * (1.0 - uNight);

    // Stars fade in with night.
    float star = hash(floor(dir * 260.0));
    sky += vec3(0.85, 0.9, 1.0) * step(0.9965, star) * (star - 0.9965) * 220.0 * smoothstep(0.02, 0.3, h) * uNight;

    // Moon: a lit disc, or on new-moon nights a black disc with a violet corona.
    float m = dot(dir, uMoonDir);
    float disc = smoothstep(0.99935, 0.9996, m);
    float corona = smoothstep(0.9975, 0.99935, m) - disc;
    vec3 litMoon = vec3(0.92, 0.94, 1.0) * 1.6;
    sky = mix(sky, mix(vec3(0.004, 0.003, 0.01), litMoon, uMoonLit), disc * uNight);
    sky += mix(vec3(0.55, 0.25, 1.0) * 0.9, vec3(0.5, 0.6, 0.9) * 0.25, uMoonLit) * corona * uNight;
    sky += vec3(0.4, 0.45, 0.8) * pow(max(m, 0.0), 80.0) * 0.12 * uMoonLit * uNight;

    gl_FragColor = vec4(sky, 1.0);
    #include <colorspace_fragment>
  }
`;

const MOON_LIGHT: Record<MoonPhase, number> = { full: 1, waxing: 0.55, waning: 0.55, new: 0 };

const DAY = {
  zenith: new THREE.Color('#3f7fd0'),
  horizon: new THREE.Color('#cfe3ee'),
  ground: new THREE.Color('#6b7a62'),
  hemiSky: new THREE.Color('#d8ecff'),
  hemiGround: new THREE.Color('#4a5a3a'),
};
const NIGHT = {
  zenith: new THREE.Color('#060a1a'),
  horizon: new THREE.Color('#141c38'),
  ground: new THREE.Color('#05070c'),
  hemiSky: new THREE.Color('#3a4c8a'),
  hemiGround: new THREE.Color('#0c0f18'),
};
const DUSK_HORIZON = new THREE.Color('#f0a06a');
const DUSK_ZENITH = new THREE.Color('#4b5c9e');
const SUN_WARM = new THREE.Color('#ffb070');
const SUN_NOON = new THREE.Color('#fff1d6');
const MOONLIGHT = new THREE.Color('#8ea6ff');

export interface SceneOptions {
  /** Mobile / low-end: lower pixel ratio, smaller shadow map, no MSAA. */
  lowPower: boolean;
}

/** Renderer, camera, lighting, sky, the day/night cycle and resize handling. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Sun by day, moon by night: one shadow-casting light, so the cycle never adds draw cost. */
  readonly sun: THREE.DirectionalLight;
  readonly #hemi: THREE.HemisphereLight;
  readonly #fog: THREE.Fog;
  readonly #sky: THREE.ShaderMaterial;
  readonly #resizeObserver: ResizeObserver;
  readonly #lightDir = new THREE.Vector3(38, 60, 22).normalize();
  readonly #sunDir = new THREE.Vector3();
  readonly #moonDir = new THREE.Vector3();

  constructor(
    private readonly container: HTMLElement,
    options: SceneOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: !options.lowPower,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.lowPower ? 1.25 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'block h-full w-full touch-none outline-none';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);

    this.#fog = new THREE.Fog(DAY.horizon.clone(), 70, 260);
    this.scene.fog = this.#fog;

    this.#hemi = new THREE.HemisphereLight(DAY.hemiSky.clone(), DAY.hemiGround.clone(), 1.1);
    this.scene.add(this.#hemi);

    this.sun = new THREE.DirectionalLight(SUN_NOON.clone(), 2.6);
    this.sun.castShadow = true;
    const shadowSize = options.lowPower ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = this.sun.shadow.camera;
    cam.left = -36;
    cam.right = 36;
    cam.top = 36;
    cam.bottom = -36;
    cam.near = 1;
    cam.far = 180;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.#sky = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: DAY.zenith.clone() },
        uHorizon: { value: DAY.horizon.clone() },
        uGround: { value: DAY.ground.clone() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
        uNight: { value: 0 },
        uMoonLit: { value: 1 },
      },
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.#sky);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    this.scene.add(sky);

    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(container);
    this.resize();
  }

  /**
   * Apply world time (days; 0.5 = noon). Returns daylight 0..1 so other systems (braziers,
   * audio ambience) can follow the same curve.
   */
  setTime(t: number, moon: MoonPhase): number {
    const f = t - Math.floor(t);
    const theta = (f - 0.25) * Math.PI * 2; // sunrise at 0.25, sunset at 0.75
    const elevation = Math.sin(theta);
    this.#sunDir.set(Math.cos(theta), elevation, 0.38).normalize();
    this.#moonDir.set(-Math.cos(theta), -elevation, 0.38).normalize();

    const daylight = smoothstep(-0.06, 0.25, elevation);
    const night = 1 - daylight;
    const dusk = Math.max(0, 1 - Math.abs(elevation) / 0.28);
    const moonLit = MOON_LIGHT[moon];

    const u = this.#sky.uniforms;
    (u.uZenith!.value as THREE.Color).copy(NIGHT.zenith).lerp(DAY.zenith, daylight).lerp(DUSK_ZENITH, dusk * 0.35);
    (u.uHorizon!.value as THREE.Color).copy(NIGHT.horizon).lerp(DAY.horizon, daylight).lerp(DUSK_HORIZON, dusk * 0.6);
    (u.uGround!.value as THREE.Color).copy(NIGHT.ground).lerp(DAY.ground, daylight);
    (u.uSunDir!.value as THREE.Vector3).copy(this.#sunDir);
    (u.uMoonDir!.value as THREE.Vector3).copy(this.#moonDir);
    u.uNight!.value = night;
    u.uMoonLit!.value = moonLit;

    this.#fog.color.copy(u.uHorizon!.value as THREE.Color);
    this.#fog.near = 35 + 35 * daylight;
    this.#fog.far = 170 + 90 * daylight;

    this.#hemi.color.copy(NIGHT.hemiSky).lerp(DAY.hemiSky, daylight);
    this.#hemi.groundColor.copy(NIGHT.hemiGround).lerp(DAY.hemiGround, daylight);
    this.#hemi.intensity = 0.78 + 0.32 * daylight;

    if (elevation >= 0) {
      this.#lightDir.copy(this.#sunDir);
      this.sun.color.copy(SUN_WARM).lerp(SUN_NOON, smoothstep(0.05, 0.4, elevation));
      this.sun.intensity = 2.6 * smoothstep(0, 0.25, elevation);
    } else {
      // Starlight even on a new moon, so the arena stays readable.
      this.#lightDir.copy(this.#moonDir);
      this.sun.color.copy(MOONLIGHT);
      this.sun.intensity = (0.3 + 0.35 * moonLit) * smoothstep(0, 0.2, -elevation);
    }
    this.renderer.toneMappingExposure = 0.98 + 0.07 * daylight;
    return daylight;
  }

  /** Keep the shadow frustum centred on the player so a small map covers the action. */
  followShadow(focus: THREE.Vector3): void {
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.#lightDir, 80);
  }

  resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.#resizeObserver.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
