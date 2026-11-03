import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { RingSwatch } from '../types/audit';
import { arGlbVersionedUrl, pickArMetal } from '../lib/ar-assets';
import { getProgress, prefetchTryOn, subscribeProgress, type TryOnProgress } from '../lib/tryon-preload';
import { computeRingPose, type RingPose } from '../lib/hand-pose';
import { HandSideVote, PoseFilter, poseToQuat, type FilteredPose } from '../lib/pose-filter';
import { RingOverlay } from '../lib/ring-overlay';
import { useModalA11y } from '../lib/use-modal-a11y';
import { assetUrl } from '../lib/asset-url';

const posterUrl = assetUrl('assets/plates/plate_hero_ring.webp');

type Phase = 'idle' | 'starting' | 'live' | 'photo' | 'error';
type HandLandmarkerT = import('@mediapipe/tasks-vision').HandLandmarker;

interface Props {
  metal: RingSwatch;
  gem: RingSwatch;
  onClose: () => void;
}

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Camera try-on fallback: MediaPipe hand landmarks -> the EXISTING ring on the ring finger.
 * All processing is on-device (WASM + WebGL). No frame is uploaded or stored.
 */
export const RingTryOn: React.FC<Props> = ({ metal, gem, onClose }) => {
  const metalKeyRef = useRef(pickArMetal(metal));
  const [prog, setProg] = useState<TryOnProgress>(() => getProgress());
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('Allow camera access, then show the back of your hand with the ring finger up.');
  const [facing, setFacing] = useState<'user' | 'environment'>(isTouch ? 'environment' : 'user');
  const [handSeen, setHandSeen] = useState(false);
  const [fps, setFps] = useState(0);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number }>({ w: 1280, h: 720 });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const photoRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<RingOverlay | null>(null);
  const landmarkerRef = useRef<HandLandmarkerT | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const poseRef = useRef<RingPose | FilteredPose | null>(null);
  const filterRef = useRef(new PoseFilter());
  const voteRef = useRef(new HandSideVote());
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const modeRef = useRef<'VIDEO' | 'IMAGE'>('VIDEO');
  const liveRef = useRef(false);
  const mirror = phase === 'live' && facing === 'user';

  const stopStream = useCallback(() => {
    liveRef.current = false;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // start the parallel download as soon as the sheet opens (the user just tapped "Try on your hand") and follow its progress
  useEffect(() => {
    void prefetchTryOn(metalKeyRef.current).catch(() => undefined);
    return subscribeProgress(setProg);
  }, []);

  // overlay lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let overlay: RingOverlay;
    try {
      overlay = new RingOverlay(canvas);
    } catch (err) {
      console.error('[RingTryOn] WebGL unavailable', err);
      setPhase('error');
      setMessage('This browser could not start 3D graphics (WebGL). Try the AR button instead.');
      return;
    }
    overlayRef.current = overlay;
    // GLB comes from the shared parallel prefetch (falls back to a plain URL load if that failed)
    prefetchTryOn(pickArMetal(metal)).then((a) => a.glb, () => arGlbVersionedUrl(pickArMetal(metal))).then((src) => overlay.load(src)).then(
      () => !disposed && overlay.render(),
      (err) => {
        console.error('[RingTryOn] ring model failed to load', err);
        if (!disposed) {
          setPhase('error');
          setMessage('The ring model could not load.');
        }
      }
    );
    return () => {
      disposed = true;
      overlay.dispose();
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    overlayRef.current?.setColors(metal.color, gem.color);
  }, [metal.color, gem.color]);

  // focus trap + inert background + Escape + focus return to the trigger (see lib/use-modal-a11y.ts)
  useModalA11y(dialogRef, onClose, closeRef);

  useEffect(
    () => () => {
      stopStream();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    },
    [stopStream]
  );

  const ensureLandmarker = useCallback(async (mode: 'VIDEO' | 'IMAGE') => {
    if (!landmarkerRef.current) {
      const assets = await prefetchTryOn(metalKeyRef.current);
      const { HandLandmarker } = assets.tasks;
      const fileset = { wasmLoaderPath: assets.wasmLoaderPath, wasmBinaryPath: assets.wasmBinaryUrl };
      const make = (delegate: 'GPU' | 'CPU') =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetBuffer: delegate === 'GPU' ? assets.model : assets.model.slice(), delegate },
          runningMode: mode,
          numHands: 1,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        landmarkerRef.current = await make('GPU');
      } catch {
        landmarkerRef.current = await make('CPU');
      }
      modeRef.current = mode;
    } else if (modeRef.current !== mode) {
      await landmarkerRef.current.setOptions({ runningMode: mode });
      modeRef.current = mode;
    }
    return landmarkerRef.current;
  }, []);

  const applyResult = useCallback(
    (
      result: { landmarks: { x: number; y: number; z: number }[][]; handedness: { categoryName: string; score?: number }[][] },
      w: number,
      h: number,
      smooth: boolean,
      tMs = performance.now()
    ) => {
      const lm = result.landmarks?.[0];
      const cat = result.handedness?.[0]?.[0];
      let raw: RingPose | null = null;
      if (lm) {
        // live: the label is voted over the last frames (a single flickering label flips the ring upside down); photo: the one label
        const side = smooth ? voteRef.current.push(cat?.categoryName, cat?.score) : cat?.categoryName;
        raw = computeRingPose(lm, w, h, side);
      }
      if (!smooth) {
        // single photo: no temporal filtering
        poseRef.current = raw;
        if (import.meta.env.VITE_E2E_HOOKS === '1') {
          (window as unknown as Record<string, unknown>).__ringTryOn = { landmarks: lm, pose: raw, raw, w, h, handedness: cat?.categoryName, score: cat?.score };
        }
        overlayRef.current?.setPose(raw);
        setHandSeen(!!raw);
        return !!raw;
      }
      // live video: One-Euro position/scale + quaternion slerp rotation + hold-last-pose on missed frames (lib/pose-filter.ts)
      const fp = filterRef.current.update(raw, tMs);
      poseRef.current = fp;
      // read-only e2e hook; compiled in ONLY when built with VITE_E2E_HOOKS=1 (never in a normal build)
      if (import.meta.env.VITE_E2E_HOOKS === '1') {
        const win = window as unknown as Record<string, unknown>;
        const rq = raw ? poseToQuat(raw) : null;
        win.__ringTryOn = { landmarks: lm, pose: fp, raw, w, h, handedness: cat?.categoryName, score: cat?.score };
        const trace = (win.__ringTrace ??= []) as unknown[];
        if (trace.length < 5000)
          trace.push({ t: tMs, label: cat?.categoryName, raw: raw ? { p: raw.position, q: rq, s: raw.pxPerMm } : null, f: fp ? { p: fp.position, q: fp.quat, s: fp.pxPerMm, held: fp.held } : null });
      }
      overlayRef.current?.setFilteredPose(fp);
      setHandSeen(!!fp);
      return !!raw;
    },
    []
  );

  const startCamera = useCallback(
    async (nextFacing = facing) => {
      stopStream();
      filterRef.current.reset();
      voteRef.current.reset();
      setPhase('starting');
      setHandSeen(false);
      setMessage('Starting camera…');
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase('error');
        setMessage('Camera access needs a secure (https) page and a supported browser. You can upload a photo of your hand instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          // Sheet was closed while the camera permission prompt / device was still starting: release the camera, do not touch the
          // unmounted <video>.
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          return;
        }
        video.srcObject = stream;
        await video.play();
        const w = video.videoWidth || 1280;
        const h = video.videoHeight || 720;
        setFrameSize({ w, h });
        overlayRef.current?.resize(w, h, 1);
        setMessage(`Loading hand tracking (about ${Math.max(1, Math.round(getProgress().total / 1e6))} MB, first use only)…`);
        const landmarker = await ensureLandmarker('VIDEO');
        setPhase('live');
        setMessage('Show the back of your hand, fingers up. The ring snaps to your ring finger.');
        liveRef.current = true;
        let last = -1;
        let frames = 0;
        let t0 = performance.now();
        const tick = () => {
          if (!liveRef.current) return;
          rafRef.current = requestAnimationFrame(tick);
          if (video.readyState < 2 || video.currentTime === last) return;
          last = video.currentTime;
          const res = landmarker.detectForVideo(video, performance.now());
          applyResult(res as never, video.videoWidth, video.videoHeight, true, performance.now());
          overlayRef.current?.render();
          frames += 1;
          const now = performance.now();
          if (now - t0 > 1000) {
            setFps(Math.round((frames * 1000) / (now - t0)));
            frames = 0;
            t0 = now;
          }
        };
        tick();
      } catch (err) {
        stopStream();
        // closed mid-start (video element gone): nothing to report to the user
        if (!videoRef.current) return;
        console.error('[RingTryOn] camera start failed', err);
        const name = (err as DOMException)?.name;
        setPhase('error');
        setMessage(
          name === 'NotAllowedError' || name === 'SecurityError'
            ? 'Camera permission was blocked. Allow it in your browser settings, or upload a photo of your hand instead.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Upload a photo of your hand instead.'
              : 'The camera or hand tracking could not start. Upload a photo of your hand instead.'
        );
      }
    },
    [applyResult, ensureLandmarker, facing, stopStream]
  );

  const onPhoto = useCallback(
    async (file: File | null) => {
      if (!file) return;
      stopStream();
      setPhase('starting');
      setMessage('Analysing photo on your device…');
      try {
        const bitmap = await createImageBitmap(file);
        const maxSide = 1280;
        const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * k);
        const h = Math.round(bitmap.height * k);
        const pc = photoRef.current!;
        pc.width = w;
        pc.height = h;
        pc.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        setFrameSize({ w, h });
        overlayRef.current?.resize(w, h, 1);
        const landmarker = await ensureLandmarker('IMAGE');
        poseRef.current = null;
        const res = landmarker.detect(pc);
        setPhase('photo');
        const ok = applyResult(res as never, w, h, false);
        overlayRef.current?.render();
        setMessage(ok ? 'Ring placed on the ring finger. Save the picture or try another photo.' : 'No hand found. Use a clear photo of the back of your hand with fingers visible.');
      } catch (err) {
        console.error('[RingTryOn] photo failed', err);
        setPhase('error');
        setMessage('That photo could not be analysed. Try a clearer image.');
      }
    },
    [applyResult, ensureLandmarker, stopStream]
  );

  const savePicture = useCallback(() => {
    const overlay = overlayRef.current;
    const out = document.createElement('canvas');
    out.width = frameSize.w;
    out.height = frameSize.h;
    const ctx = out.getContext('2d')!;
    ctx.save();
    if (mirror) {
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    }
    if (phase === 'photo' && photoRef.current) ctx.drawImage(photoRef.current, 0, 0);
    else if (videoRef.current) ctx.drawImage(videoRef.current, 0, 0, out.width, out.height);
    overlay?.render();
    if (canvasRef.current) ctx.drawImage(canvasRef.current, 0, 0, out.width, out.height);
    ctx.restore();
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ring-try-on.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  }, [frameSize, mirror, phase]);

  const flip = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    if (phase === 'live' || phase === 'starting') void startCamera(next);
  };

  const btn = 'fx-btn fx-btn-primary min-h-[44px] px-6 font-semibold transition';
  const ghost = 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#c8b58f]/50 px-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f4efe4] transition hover:bg-white/10';
  const mediaVisible = phase === 'live' || phase === 'photo';

  return (
    <div className="fixed inset-0 z-[1500] flex items-end justify-center sm:items-center" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tryon-title" data-testid="tryon-sheet">
      <button type="button" aria-label="Close try-on" className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} tabIndex={-1} />
      <div className="relative z-10 flex max-h-[96svh] w-full max-w-2xl flex-col overflow-y-auto rounded-t-[2rem] border border-[#c8b58f]/30 bg-[#0c0b09]/95 p-5 text-[#f4efe4] shadow-2xl backdrop-blur-2xl sm:rounded-[2rem] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="fx-kicker">Camera try-on</p>
            <h3 id="tryon-title" className="fx-display mt-1 text-3xl leading-none text-[#f4efe4]">Try it on your hand</h3>
            <p className="mt-2 text-sm text-[#ddd4c6]">{metal.label} · {gem.label}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-lg hover:bg-white/10">
            ×
          </button>
        </div>

        <div
          className="relative mx-auto mt-4 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#050504]"
          style={{ aspectRatio: `${frameSize.w} / ${frameSize.h}`, maxHeight: '52svh', transform: mirror ? 'scaleX(-1)' : undefined }}
          data-testid="tryon-stage"
          data-phase={phase}
          data-hand={handSeen ? 'detected' : 'none'}
        >
          <video ref={videoRef} playsInline muted preload="none" poster={posterUrl} className={`absolute inset-0 h-full w-full object-cover ${phase === 'live' ? '' : 'hidden'}`} data-testid="tryon-video" />
          <canvas ref={photoRef} className={`absolute inset-0 h-full w-full object-cover ${phase === 'photo' ? '' : 'hidden'}`} data-testid="tryon-photo" />
          <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full object-cover ${mediaVisible ? '' : 'invisible'}`} data-testid="tryon-overlay" aria-label="Ring drawn on your finger" />
          {!mediaVisible && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[#ddd4c6]">{phase === 'starting' ? 'Starting…' : 'Camera preview appears here'}</div>
          )}
        </div>

        {!prog.done && prog.loaded > 0 && phase !== 'error' && (
          <div className="mt-3" data-testid="tryon-progress">
            <div className="flex items-center justify-between text-[11px] text-[#c9bda6]">
              <span>Preparing hand tracking · first use only</span>
              <span>{Math.round(prog.fraction * 100)}%</span>
            </div>
            <div
              className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="Preparing hand tracking"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(prog.fraction * 100)}
            >
              <div className="h-full origin-left rounded-full bg-[#c8b58f] transition-transform duration-200" style={{ transform: `scaleX(${prog.fraction})` }} />
            </div>
          </div>
        )}
        <p className="mt-3 min-h-[2.5rem] text-sm text-[#ece4d4]" role="status" aria-live="polite" data-testid="tryon-status">{message}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {(phase === 'idle' || phase === 'error') && (
            <button type="button" className={btn} onClick={() => void startCamera()} data-testid="tryon-start">
              Start camera
            </button>
          )}
          {phase === 'live' && (
            <>
              <button type="button" className={btn} onClick={savePicture} data-testid="tryon-save">Save picture</button>
              <button type="button" className={ghost} onClick={flip}>Flip camera</button>
              <button type="button" className={ghost} onClick={() => { stopStream(); setPhase('idle'); setMessage('Camera stopped.'); }}>Stop</button>
            </>
          )}
          {phase === 'photo' && (
            <>
              <button type="button" className={btn} onClick={savePicture} data-testid="tryon-save">Save picture</button>
              <button type="button" className={ghost} onClick={() => void startCamera()}>Use camera</button>
            </>
          )}
          <label className={`${ghost} cursor-pointer`}>
            Upload a hand photo
            <input type="file" accept="image/*" className="sr-only" data-testid="tryon-file" onChange={(e) => { void onPhoto(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </label>
          {phase === 'live' && <span className="ml-auto font-mono text-[11px] text-[#c9bda6]" data-testid="tryon-fps">{fps} fps</span>}
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[#c9bda6]">
          Your camera feed is processed on this device only. Nothing is uploaded or saved unless you tap Save picture. Sizing is approximate (average hand proportions): a visual preview, not a fitting.
        </p>
      </div>
    </div>
  );
};
