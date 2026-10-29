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
  varying vec3 vWorldDir;
  void main() {
    vec3 dir = normalize(vWorldDir);
    float h = dir.y;
    vec3 sky = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
    sky = mix(uGround, sky, smoothstep(-0.12, 0.02, h));
    float sun = max(dot(dir, uSunDir), 0.0);
    sky += vec3(1.0, 0.86, 0.6) * (pow(sun, 900.0) * 3.0 + pow(sun, 12.0) * 0.18);
    gl_FragColor = vec4(sky, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface SceneOptions {
  /** Mobile / low-end: lower pixel ratio, smaller shadow map, no MSAA. */
  lowPower: boolean;
}

/** Renderer, camera, lighting, sky and resize handling. */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly #resizeObserver: ResizeObserver;
  readonly #sunOffset = new THREE.Vector3(38, 60, 22);

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

    const horizon = new THREE.Color('#cfe3ee');
    this.scene.fog = new THREE.Fog(horizon, 70, 260);

    this.scene.add(new THREE.HemisphereLight('#d8ecff', '#4a5a3a', 1.1));

    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6);
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

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(500, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color('#3f7fd0') },
          uHorizon: { value: horizon },
          uGround: { value: new THREE.Color('#6b7a62') },
          uSunDir: { value: this.#sunOffset.clone().normalize() },
        },
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    this.scene.add(sky);

    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(container);
    this.resize();
  }

  /** Keep the shadow frustum centred on the player so a small map covers the action. */
  followShadow(focus: THREE.Vector3): void {
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).add(this.#sunOffset);
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
