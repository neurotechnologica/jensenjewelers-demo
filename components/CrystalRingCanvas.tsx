import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { assetUrl } from '../lib/asset-url';

const RING_URL = assetUrl('assets/3D/ring_webgi.glb');
const DRACO_PATH = assetUrl('draco/gltf/');

type Vec3 = [number, number, number];

/**
 * Camera path aligned to VikasRana10/3D-app (WebGi + GSAP ScrollTrigger) keyframes,
 * ending in a docked studio pose that fits under our HUD.
 * Ref: Crystal-Jewels/src/index.ts intro + cam-view-2/3 + config positions.
 */
const SCROLL_KEYS: { pos: Vec3; target: Vec3; rot: Vec3 }[] = [
  // Intro settle (Vikas intro end)
  { pos: [1.28, -1.7, 5.86], target: [0.91, 0.03, -0.25], rot: [0, 0, 0] },
  // Forever / cam-view-2
  { pos: [-1.83, -0.14, 6.15], target: [-0.78, -0.03, -0.12], rot: [0, 0, Math.PI / 2] },
  // Emotions / cam-view-3
  { pos: [-0.06, -1.15, 4.42], target: [-0.01, 0.9, 0.07], rot: [0, 0, -Math.PI / 2] },
  // Approach customize framing (Vikas config mid)
  { pos: [-0.17, -0.25, 6.2], target: [0, 0.15, 0], rot: [-Math.PI / 3, 0, -Math.PI / 2.4] },
  // Docked studio — camera pulled back so the ring fits under the HUD
  { pos: [-0.17, 0.95, 10.6], target: [0, -0.72, 0], rot: [-Math.PI / 2.2, 0, -Math.PI / 2] },
];

const DOCK_AT = 0.78;
const SCROLL_SCALE = 2.2;
const DOCK_SCALE = 1.45;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function sampleScroll(progress: number) {
  const clamped = Math.min(1, Math.max(0, progress));
  // Cubic (not quint) ≈ GSAP power2/power4 scrub without heavy lag
  const eased = easeInOutCubic(clamped);
  const scaled = eased * (SCROLL_KEYS.length - 1);
  const i = Math.min(SCROLL_KEYS.length - 2, Math.floor(scaled));
  const t = scaled - i;
  const from = SCROLL_KEYS[i];
  const to = SCROLL_KEYS[i + 1];
  return {
    pos: lerpVec(from.pos, to.pos, t),
    target: lerpVec(from.target, to.target, t),
    rot: lerpVec(from.rot, to.rot, t),
  };
}

function classifyMesh(name: string) {
  const n = name.toLowerCase();
  if (n.includes('diamond') || n.includes('gem') || n === 'object') return 'gem';
  if (n.includes('gold') || n.includes('entourage') || n.includes('yellow')) return 'gold';
  if (n.includes('silver') || n.includes('alliance') || n.includes('white') || n.includes('plat')) {
    return 'silver';
  }
  return 'other';
}

function isPaleMetal(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.62;
}

/**
 * Polished metal — matches Vikas GLB gold/silver (roughness ≈ 0, metalness high)
 * plus MeshPhysical clearcoat for showroom sheen (WebGi metals use KHR clearcoat/ior).
 */
function makeMetalMaterial(hex: string) {
  return new THREE.MeshPhysicalMaterial({
    color: hex,
    metalness: 1,
    roughness: 0.04,
    envMapIntensity: 1.85,
    clearcoat: 0.45,
    clearcoatRoughness: 0.06,
    ior: 1.5,
    reflectivity: 1,
  });
}

/**
 * Approximate WebGi DiamondPlugin / WEBGI_materials_diamond from ring_webgi.glb:
 * refractiveIndex 2.4, dispersion 0.012, envMapIntensity 1.25, rayBounces 5.
 * Plain Three.js has no DiamondPlugin — MeshPhysicalMaterial + strong PMREM is the stand-in.
 */
function makeGemMaterial(hex: string) {
  const c = new THREE.Color(hex);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const isClear = lum > 0.82;
  return new THREE.MeshPhysicalMaterial({
    color: isClear ? new THREE.Color('#f8fcff') : c,
    metalness: 0,
    roughness: 0,
    transmission: isClear ? 1 : 0.94,
    thickness: 1.35,
    ior: 2.417,
    specularIntensity: 1,
    specularColor: new THREE.Color('#ffffff'),
    reflectivity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0,
    // Iridescence stands in for WebGi dispersion (0.012)
    iridescence: isClear ? 0.42 : 0.18,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [120, 420],
    attenuationColor: isClear ? new THREE.Color('#ffffff') : c.clone(),
    attenuationDistance: isClear ? 3.2 : 0.75,
    envMapIntensity: 1.85,
    transparent: true,
    opacity: 1,
    side: THREE.FrontSide,
  });
}

function applyHex(mesh: THREE.Mesh, hex: string, kind: 'gem' | 'metal') {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach((mat) => {
    if ('color' in mat && mat.color instanceof THREE.Color) {
      if (kind === 'gem') {
        const c = new THREE.Color(hex);
        const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        mat.color.copy(lum > 0.82 ? new THREE.Color('#f8fcff') : c);
      } else {
        mat.color.set(hex);
      }
    }
    if (kind === 'gem' && mat instanceof THREE.MeshPhysicalMaterial) {
      const c = new THREE.Color(hex);
      const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
      const isClear = lum > 0.82;
      mat.attenuationColor.copy(isClear ? new THREE.Color('#ffffff') : c);
      mat.attenuationDistance = isClear ? 3.2 : 0.75;
      mat.transmission = isClear ? 1 : 0.94;
      mat.iridescence = isClear ? 0.42 : 0.18;
      mat.needsUpdate = true;
    }
  });
}

/** Jewelry-studio PMREM — brighter softboxes than stock RoomEnvironment (Vikas WebGi IBL is richer). */
function buildJewelryStudioEnv(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();

  const addPanel = (
    color: number,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    envScene.add(mesh);
  };

  // Softbox panels (warm key / cool fill / overhead / bounce)
  addPanel(0xffffff, 10, 8, 0, 2.5, -5, 0, 0);
  addPanel(0xfff2dc, 5, 5, 5, 2.2, 0, 0, -Math.PI / 2);
  addPanel(0xdfe9ff, 5, 5, -5, 2.2, 0, 0, Math.PI / 2);
  addPanel(0xffffff, 8, 8, 0, 6, 0, Math.PI / 2, 0);
  addPanel(0x1a1814, 12, 12, 0, -2.5, 0, -Math.PI / 2, 0);
  addPanel(0xf7f7f7, 4, 4, 0, 1.5, 5, 0, Math.PI);

  // Emissive spheres ≈ area lights for facet sparkle
  const addGlow = (color: number, intensity: number, x: number, y: number, z: number, r = 0.35) => {
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(r, 16, 16),
      new THREE.MeshBasicMaterial({ color })
    );
    glow.position.set(x, y, z);
    envScene.add(glow);
    const light = new THREE.PointLight(color, intensity, 12);
    light.position.copy(glow.position);
    envScene.add(light);
  };
  addGlow(0xfff5e0, 40, 2.8, 3.2, 2.2, 0.45);
  addGlow(0xe8f2ff, 28, -2.6, 2.4, 1.8, 0.4);
  addGlow(0xffffff, 22, 0.2, 4.0, -1.5, 0.35);

  const texture = pmrem.fromScene(envScene, 0.03).texture;
  envScene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose());
    }
  });
  return { texture, pmrem };
}

interface CrystalRingCanvasProps {
  metalColor: string;
  gemColor: string;
  mode?: 'scroll' | 'orbit';
  /** When false, canvas never captures touch/wheel — page scroll drives the shot. */
  interactive?: boolean;
  scrollRoot?: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Fires ~rAF with smoothed 0–1 progress (scroll mode). */
  onProgress?: (progress: number) => void;
  /** Progress at which camera locks to dock pose and interactive orbit may begin. */
  dockAt?: number;
}

export const CrystalRingCanvas: React.FC<CrystalRingCanvasProps> = ({
  metalColor,
  gemColor,
  mode = 'orbit',
  interactive,
  scrollRoot,
  className = '',
  onProgress,
  dockAt = DOCK_AT,
}) => {
  const wantInteract = interactive ?? mode === 'orbit';
  const mountRef = useRef<HTMLDivElement | null>(null);
  const metalColorRef = useRef(metalColor);
  const gemColorRef = useRef(gemColor);
  const applyMaterialsRef = useRef<() => void>(() => {});
  const interactiveRef = useRef(wantInteract);
  const onProgressRef = useRef(onProgress);
  const dockAtRef = useRef(dockAt);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [docked, setDocked] = useState(mode !== 'scroll');

  metalColorRef.current = metalColor;
  gemColorRef.current = gemColor;
  interactiveRef.current = wantInteract;
  onProgressRef.current = onProgress;
  dockAtRef.current = dockAt;

  useEffect(() => {
    applyMaterialsRef.current();
  }, [metalColor, gemColor]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let cancelled = false;
    setLoadState('loading');

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 280;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(mode === 'scroll' ? 26 : 28, width / height, 0.08, 80);
    if (mode === 'scroll') {
      camera.position.set(...SCROLL_KEYS[0].pos);
      camera.lookAt(...SCROLL_KEYS[0].target);
    } else {
      camera.position.set(-0.17, 0.55, 7.4);
      camera.lookAt(0, -0.42, 0);
    }

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const setPointerMode = (on: boolean) => {
      renderer.domElement.style.touchAction = 'pan-y';
      renderer.domElement.style.cursor = on ? 'grab' : 'default';
      renderer.domElement.style.pointerEvents = on ? 'auto' : 'none';
      if (mountRef.current) {
        mountRef.current.style.touchAction = 'pan-y';
        mountRef.current.style.pointerEvents = on ? 'auto' : 'none';
        mountRef.current.style.cursor = on ? 'grab' : 'default';
      }
    };
    setPointerMode(false);

    const { texture: envMap, pmrem } = buildJewelryStudioEnv(renderer);
    scene.environment = envMap;

    // Soft key / fill / rim — complements PMREM (Vikas uses RandomizedDirectionalLightPlugin + bloom)
    const key = new THREE.DirectionalLight(0xfff4e0, 1.35);
    key.position.set(2.6, 3.4, 2.4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdbe7f3, 0.55);
    fill.position.set(-2.4, 0.9, 1.8);
    scene.add(fill);
    const rim = new THREE.PointLight(0xffffff, 0.7, 14);
    rim.position.set(0.1, 1.6, 1.4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    const sparkle = new THREE.PointLight(0xfff8ee, 0.55, 8);
    sparkle.position.set(-0.4, 0.8, 2.2);
    scene.add(sparkle);

    const root = new THREE.Group();
    scene.add(root);

    const buckets = {
      gold: [] as THREE.Mesh[],
      silver: [] as THREE.Mesh[],
      gem: [] as THREE.Mesh[],
    };

    const paint = () => {
      const metal = metalColorRef.current;
      const accent = isPaleMetal(metal) ? metal : '#f3f1ec';
      buckets.gold.forEach((mesh) => applyHex(mesh, metal, 'metal'));
      buckets.silver.forEach((mesh) => applyHex(mesh, accent, 'metal'));
      buckets.gem.forEach((mesh) => applyHex(mesh, gemColorRef.current, 'gem'));
    };
    applyMaterialsRef.current = paint;

    const indexMeshes = (group: THREE.Object3D) => {
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const kind = classifyMesh(obj.name);
        if (kind === 'gem') {
          obj.material = makeGemMaterial(gemColorRef.current);
          buckets.gem.push(obj);
        } else if (kind === 'gold') {
          obj.material = makeMetalMaterial(metalColorRef.current);
          buckets.gold.push(obj);
        } else if (kind === 'silver') {
          obj.material = makeMetalMaterial('#f3f1ec');
          buckets.silver.push(obj);
        } else {
          // Unclassified: if original looked non-metal, treat as gem-adjacent skip
          const mat = obj.material as THREE.Material & { metalness?: number };
          if (mat && typeof mat.metalness === 'number' && mat.metalness < 0.2) {
            obj.material = makeGemMaterial(gemColorRef.current);
            buckets.gem.push(obj);
          }
        }
      });
      paint();
    };

    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(
      RING_URL,
      (gltf) => {
        if (cancelled) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const baseUnit = 1 / Math.max(size, 0.001);
        const scrollMul = mode === 'scroll' ? SCROLL_SCALE : DOCK_SCALE;
        model.scale.setScalar(scrollMul * baseUnit);
        (root as any).userData.baseUnit = baseUnit;
        (root as any).userData.scaleMul = scrollMul;
        root.add(model);
        indexMeshes(model);
        setLoadState('ready');
      },
      undefined,
      (err) => {
        console.error('[CrystalRingCanvas] GLB load failed', err);
        if (!cancelled) setLoadState('error');
      }
    );

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let orbitY = mode === 'scroll' ? 0 : -0.45;
    let orbitX = mode === 'scroll' ? 0 : 0;
    let smoothed = 0;
    let wasDocked = mode !== 'scroll';
    if (mode !== 'scroll') root.rotation.y = orbitY;

    const onPointerDown = (event: PointerEvent) => {
      if (!interactiveRef.current) return;
      event.preventDefault();
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      renderer.domElement.style.cursor = 'grabbing';
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (interactiveRef.current) renderer.domElement.style.cursor = 'grab';
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || !interactiveRef.current) return;
      orbitY += (event.clientX - lastX) * 0.01;
      orbitX += (event.clientY - lastY) * 0.006;
      orbitX = Math.max(-0.6, Math.min(0.6, orbitX));
      lastX = event.clientX;
      lastY = event.clientY;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      if (mode === 'scroll' && scrollRoot?.current) {
        const el = scrollRoot.current;
        let scroller: HTMLElement | null = el.parentElement;
        while (scroller) {
          const oy = getComputedStyle(scroller).overflowY;
          if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') break;
          scroller = scroller.parentElement;
        }
        const viewH = scroller?.clientHeight || window.innerHeight || 1;
        const range = Math.max(1, el.offsetHeight - viewH);
        const top = el.getBoundingClientRect().top - (scroller?.getBoundingClientRect().top ?? 0);
        const raw = Math.min(1, Math.max(0, -top / range));
        // Tighter follow ≈ GSAP ScrollTrigger scrub:true (was 0.11 — felt laggy vs Vikas)
        smoothed += (raw - smoothed) * 0.28;
        const progress = smoothed;
        onProgressRef.current?.(progress);

        const dockT = dockAtRef.current;
        const pathT = Math.min(progress / dockT, 1);
        const baseUnit = (root as any).userData.baseUnit as number | undefined;
        if (baseUnit) {
          const scaleMul = SCROLL_SCALE + (DOCK_SCALE - SCROLL_SCALE) * easeInOutCubic(pathT);
          (root as any).userData.scaleMul = scaleMul;
          root.scale.setScalar(1);
          root.children.forEach((ch) => {
            if ((ch as THREE.Object3D).scale) ch.scale.setScalar(scaleMul * baseUnit);
          });
        }

        const isDock = progress >= dockT;
        if (isDock !== wasDocked) {
          wasDocked = isDock;
          setDocked(isDock);
          if (isDock) {
            const dock = SCROLL_KEYS[SCROLL_KEYS.length - 1];
            orbitY = dock.rot[1];
            orbitX = dock.rot[0];
          }
          setPointerMode(isDock && interactiveRef.current);
        } else if (isDock) {
          setPointerMode(interactiveRef.current);
        }

        if (isDock) {
          const dock = SCROLL_KEYS[SCROLL_KEYS.length - 1];
          camera.position.set(...dock.pos);
          camera.lookAt(dock.target[0], dock.target[1], dock.target[2]);
          if (interactiveRef.current) {
            if (!dragging) orbitY += 0.0025;
            root.rotation.y = orbitY;
            root.rotation.x = orbitX + Math.sin(performance.now() / 2800) * 0.035;
          } else {
            root.rotation.set(dock.rot[0], dock.rot[1], dock.rot[2]);
          }
        } else {
          const sample = sampleScroll(pathT);
          camera.position.set(...sample.pos);
          camera.lookAt(sample.target[0], sample.target[1], sample.target[2]);
          root.rotation.set(sample.rot[0], sample.rot[1], sample.rot[2]);
        }
      } else {
        if (!dragging) orbitY += 0.004;
        root.rotation.y = orbitY;
        root.rotation.x = orbitX + Math.sin(performance.now() / 2600) * 0.05;
        setPointerMode(interactiveRef.current);
      }
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nextW = container.clientWidth || width;
      const nextH = container.clientHeight || height;
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      draco.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [mode, scrollRoot]);

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%' }}>
      <div
        ref={mountRef}
        style={{
          touchAction: 'pan-y' /* vertical swipes over the ring must still scroll the page; horizontal drags orbit it */,
          cursor: docked && wantInteract ? 'grab' : 'default',
          width: '100%',
          height: '100%',
          pointerEvents: docked && wantInteract ? 'auto' : 'none',
        }}
        aria-label={
          docked && wantInteract
            ? 'Interactive 3D ring. Drag to rotate.'
            : 'Scroll-driven 3D ring showcase. Scroll to dock into the studio.'
        }
      />
      {loadState === 'loading' ? (
        <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#c8b58f]">
          Loading ring
        </p>
      ) : null}
      {loadState === 'error' ? (
        <p className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-rose-300">
          Ring mesh failed
        </p>
      ) : null}
    </div>
  );
};
