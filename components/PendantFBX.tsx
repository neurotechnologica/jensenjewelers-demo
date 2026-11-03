/**
 * Hero3D: loads a random 3D asset from public/assets/3D for the hero.
 * Each folder under public/assets/3D should contain scene.gltf (or scene.glb).
 * Add folder names to ASSET_FOLDERS when you upload new models.
 * Uses an HDR environment map so metallic/chrome materials reflect properly.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader';
import { assetUrl } from '../lib/asset-url';

// Folders in public/assets/3D that contain scene.gltf (or scene.glb). Add new ones as you upload.
const ASSET_FOLDERS = [
  'gold chatoic sphere',
];

function toAssetUrl(folder: string, file = 'scene.gltf'): string {
  return assetUrl(`assets/3D/${encodeURIComponent(folder)}/${file}`);
}

interface PendantFBXProps {
  className?: string;
  /** When false (light mode), use silver/inverted look instead of gold */
  isDarkMode?: boolean;
}

export const PendantFBX: React.FC<PendantFBXProps> = ({ className = '', isDarkMode = true }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    frameId: number;
    object: THREE.Group | null;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getSize = () => ({
      w: container.clientWidth || 340,
      h: container.clientHeight || 260,
    });
    const { w, h } = getSize();
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 1000);
    camera.position.set(0, 0, 3.05);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const hdrLoader = new HDRLoader();
    hdrLoader.load(
      'https://threejs.org/examples/textures/equirectangular/venice_sunset_1k.hdr',
      (envMap) => {
        envMap.mapping = THREE.EquirectangularReflectionMapping;
        const env = pmrem.fromEquirectangular(envMap).texture;
        scene.environment = env;
        envMap.dispose();
        pmrem.dispose();
      },
      undefined,
      () => {},
    );

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(2, 4, 4);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xf5e6c8, 0.4);
    fillLight.position.set(-1, 2, 2);
    scene.add(fillLight);

    const baseColor = isDarkMode ? 0xc9a227 : 0xa8b2c1; // gold (dark) / silver (light)
    const chromeMaterial = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      metalness: 0.92,
      roughness: isDarkMode ? 0.05 : 0.12,
      clearcoat: 0.6,
      clearcoatRoughness: 0,
      envMapIntensity: isDarkMode ? 2.2 : 1.4,
    });

    const addModel = (gltf: { scene: THREE.Group }, assetUrl: string) => {
      const object = gltf.scene;
      const isSphere = assetUrl.includes('sphere');
      object.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (isSphere) {
            mesh.material = chromeMaterial;
          } else {
            const mat = mesh.material;
            if (Array.isArray(mat)) {
              mat.forEach((m) => {
                if (m && 'envMapIntensity' in m) (m as THREE.MeshStandardMaterial).envMapIntensity = 1.5;
              });
            } else if (mat && 'envMapIntensity' in mat) {
              (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.5;
            }
          }
        }
      });

      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);
      // Fit fully inside frame with margin so spheres aren't cropped on small viewports
      const targetSize = isSphere ? 1.0 : 1.15;
      const scaleY = targetSize / (size.y || 1);
      const scaleX = targetSize / (size.x || 1);
      const scaleZ = targetSize / (size.z || 1);
      const scale = Math.min(scaleY, scaleX, scaleZ) * (isSphere ? 0.92 : 1);
      object.scale.setScalar(scale);
      object.position.x = -center.x * scale;
      object.position.z = -center.z * scale;
      object.position.y = isSphere ? -center.y * scale : 0.42 - box.max.y * scale;
      const isGoldChaotic = assetUrl.includes('chatoic');
      if (isGoldChaotic) {
        object.rotation.x = 0;
        object.rotation.z = 0;
      } else {
        object.rotation.x = Math.PI * 0.02;
        object.rotation.z = Math.PI * 0.02;
      }

      scene.add(object);
      sceneRef.current!.object = object;

      const animate = () => {
        if (!sceneRef.current) return;
        sceneRef.current.frameId = requestAnimationFrame(animate);
        if (sceneRef.current.object) {
          sceneRef.current.object.rotation.y += 0.0025;
        }
        renderer.render(scene, camera);
      };
      animate();
    };

    const loader = new GLTFLoader();
    const urlsToTry = ASSET_FOLDERS.map((folder) => toAssetUrl(folder));
    const shuffled = [...urlsToTry].sort(() => Math.random() - 0.5);
    let tried = 0;

    const tryLoad = () => {
      const url = shuffled[tried];
      loader.load(
        url,
        (gltf) => addModel(gltf, url),
        undefined,
        () => {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Hero 3D: failed to load ${url}`);
          }
          tried += 1;
          if (tried < shuffled.length) tryLoad();
          else renderer.render(scene, camera);
        },
      );
    };
    tryLoad();

    sceneRef.current = { renderer, scene, camera, frameId: 0, object: null };

    const handleResize = () => {
      if (!containerRef.current) return;
      const { w: newW, h: newH } = getSize();
      if (newW <= 0 || newH <= 0) return;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.frameId);
        sceneRef.current.renderer.dispose();
      }
      if (container?.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isDarkMode]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none h-full w-full min-h-0 ${className}`.trim()}
    />
  );
};
