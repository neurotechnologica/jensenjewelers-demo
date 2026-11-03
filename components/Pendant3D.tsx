/**
 * Pendant3D: loads a pendant OBJ for the hero.
 * Three.js OBJLoader only supports mesh data (v, vn, vt, f). It does NOT support
 * NURBS/curves (curv2, cstype bspline, trim, end). If your OBJ was exported from
 * Rhino or similar and shows "Unexpected line" errors, re-export it as "mesh only"
 * or "triangulated mesh" so it only contains vertices and faces.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

const pendantObjUrl = new URL('../assets/uploads_files_6588064_f410.3.obj', import.meta.url).href;

interface Pendant3DProps {
  height?: number;
}

export const Pendant3D: React.FC<Pendant3DProps> = ({ height = 260 }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    frameId: number;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 260;
    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 1000);
    camera.position.set(0, 0.4, 3);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
    directionalLight.position.set(2, 6, 6);
    scene.add(directionalLight);

    const loader = new OBJLoader();
    loader.load(
      pendantObjUrl,
      (object) => {
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (!Array.isArray(mesh.material)) {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0xf5f5f5,
                metalness: 0.85,
                roughness: 0.25,
              });
            }
          }
        });

        const box = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.4 / maxDim;
        object.scale.setScalar(scale);

        box.setFromObject(object);
        const center = new THREE.Vector3();
        box.getCenter(center);
        object.position.sub(center);
        object.position.y -= 0.5;

        scene.add(object);

        const animate = () => {
          sceneRef.current!.frameId = requestAnimationFrame(animate);
          object.rotation.y += 0.003;
          renderer.render(scene, camera);
        };

        animate();
      },
      undefined,
      () => {
        renderer.render(scene, camera);
      },
    );

    sceneRef.current = { renderer, scene, camera, frameId: 0 };

    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth || width;
      camera.aspect = newWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.frameId);
        sceneRef.current.renderer.dispose();
      }
      if (container && renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [height]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none"
      style={{ width: height * 0.7, height }}
    />
  );
};

