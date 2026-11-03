import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { RingPose } from './hand-pose';
import { norm } from './hand-pose';
import { poseToQuat, type FilteredPose } from './pose-filter';

/**
 * Transparent three.js layer that draws the EXISTING ring (AR export of ring_webgi.glb, millimetre-true) on top of a
 * video frame or photo. Orthographic camera == source pixels, so landmark space maps 1:1.
 * A depth-only cylinder stands in for the finger so the far side of the band is hidden: the ring looks worn, not pasted.
 */
export class RingOverlay {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  private holder = new THREE.Group();
  private ring: THREE.Object3D | null = null;
  private metal = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.16, envMapIntensity: 1.6 });
  private accent = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.16, envMapIntensity: 1.6 });
  private gem = new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.03, transparent: true, opacity: 0.88, envMapIntensity: 2.4 });
  private occluder: THREE.Mesh;
  private pmrem: THREE.PMREMGenerator;
  private width = 1;
  private height = 1;
  loaded = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.pmrem.fromScene(room as unknown as THREE.Scene, 0.04).texture;
    room.dispose();
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(200, 300, 400);
    this.scene.add(key, new THREE.AmbientLight(0xffffff, 0.35));

    // Finger stand-in: radius = ring inner radius (8.6 mm), long enough to hide the band behind the finger.
    const mat = new THREE.MeshBasicMaterial({ colorWrite: false });
    this.occluder = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 60, 24), mat);
    this.occluder.renderOrder = 0;
    this.occluder.rotation.x = Math.PI / 2; // cylinder axis Y -> Z (the ring band axis)
    this.holder.add(this.occluder);
    this.holder.visible = false;
    this.scene.add(this.holder);
    this.camera.position.set(0, 0, 1000);
  }

  async load(source: string | ArrayBuffer) {
    const loader = new GLTFLoader();
    const gltf = typeof source === 'string' ? await loader.loadAsync(source) : await loader.parseAsync(source, '');
    const model = gltf.scene;
    model.scale.setScalar(1000); // metres -> millimetres
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const n = (mesh.material as THREE.Material).name;
      mesh.material = n === 'RingGem' ? this.gem : n === 'RingAccent' ? this.accent : this.metal;
      mesh.renderOrder = n === 'RingGem' ? 2 : 1;
    });
    this.ring?.removeFromParent();
    this.ring = model;
    this.holder.add(model);
    this.loaded = true;
  }

  setColors(metalHex: string, gemHex: string, accentHex?: string) {
    this.metal.color.set(metalHex);
    this.accent.color.set(accentHex ?? metalHex);
    this.gem.color.set(gemHex);
  }

  resize(width: number, height: number, dpr = Math.min(window.devicePixelRatio || 1, 2)) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }

  setPose(pose: RingPose | null) {
    if (!pose) {
      this.holder.visible = false;
      return;
    }
    const q = poseToQuat(pose);
    this.holder.quaternion.set(q[0], q[1], q[2], q[3]);
    this.holder.position.set(...pose.position);
    this.holder.scale.setScalar(pose.pxPerMm);
    this.holder.visible = true;
  }

  /** Live path: pose already filtered into a quaternion (holder +Z = band axis, +Y = dorsal / stone). */
  setFilteredPose(pose: FilteredPose | null) {
    if (!pose) {
      this.holder.visible = false;
      return;
    }
    this.holder.quaternion.set(pose.quat[0], pose.quat[1], pose.quat[2], pose.quat[3]);
    this.holder.position.set(...pose.position);
    this.holder.scale.setScalar(pose.pxPerMm);
    this.holder.visible = true;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Test hook: true once a pose has been applied and the model is in the scene. */
  get isShowing() {
    return this.loaded && this.holder.visible;
  }

  dispose() {
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    [this.metal, this.accent, this.gem].forEach((m) => m.dispose());
    this.pmrem.dispose();
    this.renderer.dispose();
  }
}

export { norm };
