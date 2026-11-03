'use client';

import { cn } from '@/lib/utils';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
	AMOUNTX,
	AMOUNTY,
	SEPARATION,
	dotHeight,
	dottedPixelRatio,
	kickDotted,
	registerDotted,
	type DottedInstance,
} from '@/lib/dotted-renderer';

export type DottedSurfaceProps = React.ComponentPropsWithoutRef<'div'> & {
	/** true = white dots (dark mode), false = smooth black dots (light / beige) */
	isDarkMode?: boolean;
};

/**
 * Decorative dotted wave. Every instance draws through ONE shared WebGL renderer (lib/dotted-renderer.ts) into its own 2D canvas, and
 * only while it is on screen, so the page never holds more than one extra WebGL context for these surfaces.
 */
export function DottedSurface({ className, isDarkMode = false, ...props }: DottedSurfaceProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const canvas = document.createElement('canvas');
		canvas.style.display = 'block';
		canvas.style.width = '100%';
		canvas.style.height = '100%';
		container.appendChild(canvas);
		const ctx2d = canvas.getContext('2d');
		if (!ctx2d) {
			container.removeChild(canvas);
			return;
		}

		const scene = new THREE.Scene();
		scene.fog = new THREE.Fog(isDarkMode ? 0x050504 : 0xfaf5ea, 1800, 9200);
		const camera = new THREE.PerspectiveCamera(55, 1, 1, 10000);
		camera.position.set(0, 260, 960);
		camera.lookAt(0, 0, 0);

		const positions: number[] = [];
		const colors: number[] = [];
		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				positions.push(ix * SEPARATION - (AMOUNTX * SEPARATION) / 2, 0, iy * SEPARATION - (AMOUNTY * SEPARATION) / 2);
				if (isDarkMode) colors.push(1, 1, 1);
				else colors.push(0.04, 0.035, 0.03);
			}
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		const material = new THREE.PointsMaterial({
			size: isDarkMode ? 9 : 14,
			vertexColors: true,
			transparent: true,
			opacity: isDarkMode ? 0.88 : 0.9,
			sizeAttenuation: true,
			depthWrite: false,
		});
		scene.add(new THREE.Points(geometry, material));
		const positionAttr = geometry.attributes.position;
		const posArray = positionAttr.array as Float32Array;

		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

		const inst: DottedInstance = {
			canvas,
			ctx2d,
			scene,
			camera,
			posArray,
			posAttr: positionAttr,
			visible: false,
			dirty: true,
			animated: !reduceMotion,
			step: (count) => {
				let i = 0;
				for (let ix = 0; ix < AMOUNTX; ix++) {
					for (let iy = 0; iy < AMOUNTY; iy++) {
						posArray[i * 3 + 1] = dotHeight(ix, iy, count);
						i++;
					}
				}
				positionAttr.needsUpdate = true;
			},
		};

		const size = () => {
			const dpr = dottedPixelRatio(window.devicePixelRatio, coarse);
			const w = Math.max(Math.round(container.clientWidth * dpr), 2);
			const h = Math.max(Math.round(container.clientHeight * dpr), 2);
			if (canvas.width !== w || canvas.height !== h) {
				canvas.width = w;
				canvas.height = h;
				camera.aspect = w / h;
				camera.updateProjectionMatrix();
				inst.dirty = true;
			}
		};
		size();
		const ro = new ResizeObserver(() => {
			size();
			kickDotted();
		});
		ro.observe(container);

		const unregister = registerDotted(inst);

		// Offscreen: the shared loop skips this instance (no sim, no draw); the 2D canvas keeps its last frame, so nothing flashes.
		const io = new IntersectionObserver(
			([entry]) => {
				inst.visible = entry.isIntersecting;
				if (entry.isIntersecting) {
					inst.dirty = true;
					kickDotted();
				}
			},
			{ rootMargin: '80px 0px', threshold: 0 }
		);
		io.observe(container);

		return () => {
			io.disconnect();
			ro.disconnect();
			unregister?.();
			if (container.contains(canvas)) container.removeChild(canvas);
		};
	}, [isDarkMode]);

	return <div ref={containerRef} className={cn('pointer-events-none absolute inset-0', className)} aria-hidden {...props} />;
}
