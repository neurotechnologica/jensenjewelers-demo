# Ring Builder — AR try-on

Added in the `ops/e2e-ar-tryon` work. It uses the **existing** ring (`public/assets/3D/ring_webgi.glb`). No new designs.

## What the user gets

| Surface | Path | Needs |
|---|---|---|
| iPhone / iPad Safari | `<a rel="ar">` wrapping an image → **AR Quick Look** with `public/assets/ar/ring-<metal>.usdz` | HTTPS, correct `model/vnd.usdz+zip` MIME |
| Android Chrome | `<model-viewer ar ar-modes="webxr scene-viewer quick-look">` → WebXR where available, otherwise **Scene Viewer** with `ring-<metal>.glb` | HTTPS, Google app / ARCore device, GLB **without Draco** |
| Any device with a camera | **Try on your hand**: `getUserMedia` + MediaPipe HandLandmarker → three.js ring on the ring finger; or upload a photo of a hand | HTTPS (or localhost) for the camera |
| Desktop | QR code that opens the same ring on a phone (`?ring=<metal>,<gem>&ar=1`) | – |

Deep links: `/?ring=white-gold,ruby&ar=1` opens the AR sheet, `&tryon=1` opens the hand try-on.

## Files

- `components/ArViewSheet.tsx` – lazy model-viewer, Quick Look link, QR.
- `components/RingTryOn.tsx`, `lib/hand-pose.ts`, `lib/ring-overlay.ts` – camera/photo try-on. Ring pose is taken from landmarks 13 (ring MCP) and 14 (PIP); scale from average finger proportions (visual only — not a sizing tool). A depth-only cylinder hides the part of the band behind the finger. Video stays on device; nothing is uploaded.
- `lib/ar-assets.ts` – URL helpers, metal → asset mapping, deep link, Quick Look detection.
- `public/assets/ar/` – `ring-{yellow-gold,white-gold,rose-gold,platinum}.{glb,usdz}` + thumbnails.
- `public/ar/hand_landmarker.task`, `public/mediapipe/wasm/` – self-hosted model and WASM (SIMD build), so no third-party CDN is needed at runtime.
- `scripts/ar/` – reproducible asset pipeline.

## Regenerating the assets

```
npm i --no-save @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions draco3dgltf
pip install usd-core
scripts/ar/build-ar-assets.sh
```

Steps: decode Draco → drop WEBGI-only extensions → plain PBR (RingMetal/RingAccent/RingGem) → remove the source scene tilt, stand the ring upright → scale to real size (band outer diameter ≈ 22 mm) → write GLB (uncompressed, Scene Viewer cannot read Draco) → bake geometry → USDZ (UsdPreviewSurface, Y-up, metres, triangles) via `UsdUtils.CreateNewARKitUsdzPackage`. Output is byte-identical on a re-run (checked for yellow-gold and platinum).

Validation committed in `docs/screenshots/ops-ship/evidence/`: `gltf-validator` 0 errors / 0 warnings on all four GLBs; USD `ComplianceChecker(arkit=True)` 0 errors / 0 failed checks on all four USDZ.

## Hosting requirements

AR will silently fail without these.

- **HTTPS** everywhere (camera, WebXR and Scene Viewer all require a secure context).
- MIME types: `model/vnd.usdz+zip` (usdz), `model/gltf-binary` (glb), `application/wasm` (wasm). Vite dev/preview get them from `arMimePlugin` in `vite.config.ts`. **For the production nginx** add to `types {}` / `mime.types`:

```
model/vnd.usdz+zip   usdz;
model/gltf-binary    glb;
application/wasm     wasm;
```
- Do not enable `Content-Encoding` rewriting on `.usdz`; Quick Look needs the plain zip. Range requests should stay on.
- CSP (if added): `worker-src blob:`, `connect-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'`, `media-src 'self' blob:`.

## Verified vs untested

Verified (Chromium via Playwright, software GL, emulated devices):
- Assets served with the right MIME types and sizes; GLB/USDZ validate (above).
- Desktop: model-viewer loads, QR shown, no Quick Look link.
- iPhone user agent: the `rel="ar"` link renders with the `.usdz` href and the file answers HEAD 200 with the right MIME.
- Pixel user agent: model-viewer reports `canActivateAR`, AR button renders, `activateAR()` builds the Scene Viewer intent for the `.glb`.
- Try-on against a Chrome fake camera (looped MediaPipe sample hand video) and against uploaded photos: hand detected, ring placed on the ring-finger segment, "Save picture" produces a PNG, no console errors.

**Not tested:** real iPhone Quick Look, real Android Scene Viewer / WebXR session, a real camera, real-device performance (software GL runs the try-on at ~1 fps; a phone GPU will differ), try-on accuracy on an open back-of-hand (sample photos are mostly fists/pointing), Safari/WebKit at all, finger sizing.


## Accessibility, copy and test hooks (PR #4 review fixes)

- **Dialogs.** `ArViewSheet` and `RingTryOn` both use `lib/use-modal-a11y.ts`: focus moves in on open, Tab/Shift+Tab cycle inside, Escape closes, the rest of `<body>` gets `inert` + `aria-hidden="true"` while open (restored exactly on close) and focus returns to the trigger.
- **What AR shows.** The AR files (GLB/USDZ) change **metal only**; the stone is baked clear. The AR sheet says so. The chosen stone colour is shown in the 3D studio and in the camera/photo try-on.
- **Download size.** First try-on fetches ~11.5 MB over the wire: hand model 5.8 MB (gzip) + MediaPipe WASM 3.3 MB (gzip) + ring GLB 2.1 MB + loader JS 0.3 MB (about 21 MB if the `.gz` variants are unavailable). The progress bar and the status copy compute the size from the real downloads (`lib/tryon-preload.ts`), not from a hard-coded number.
- **`window.__ringTryOn`** (landmarks + pose for e2e) exists **only** in a build made with `VITE_E2E_HOOKS=1` (`VITE_E2E_HOOKS=1 npm run build`). Normal builds do not contain it.
- **Licences.** The vendored MediaPipe runtime and hand model are Apache-2.0 (Google LLC): see `THIRD_PARTY_NOTICES.md`, `public/mediapipe/{LICENSE,NOTICE}`, `public/ar/{LICENSE,NOTICE}`.
- **Tests.** `npm test` runs the vitest suite in `tests/` (pose maths, AR asset helpers, asset files present).


## Loading performance (try-on)

- Nothing is downloaded until the user shows intent: hover / focus / touch / press on "Try on your hand" (or "Try on" inside the AR sheet) calls `warmTryOn()`, and opening the sheet calls `prefetchTryOn()`. `Save-Data` skips the warm-up.
- The MediaPipe chunk, wasm, hand model and ring GLB are fetched **in parallel** (`lib/tryon-preload.ts`), with one aggregate progress bar (`data-testid=tryon-progress`, `role=progressbar`).
- `public/mediapipe/wasm/vision_wasm_internal.wasm.gz` and `public/ar/hand_landmarker.task.gz` are gzip copies of the vendored binaries (the app inflates them with `DecompressionStream`; if that API or the `.gz` is missing it falls back to the plain file). **Regenerate them whenever the originals change**: `gzip -9 -n -c X > X.gz` (`tests/tryon-assets.test.ts` checks that each `.gz` inflates to exactly the original).
- URLs carry `?v=<AR_ASSET_VERSION>` (`lib/ar-assets.ts`); bump it when any AR/MediaPipe binary changes. `vite preview`/`vite dev` serve versioned binaries with `Cache-Control: public, max-age=31536000, immutable`.
- **Production headers are not set by this repo** (the web server config lives outside it). Recommended for nginx, applied by whoever owns that config:

```nginx
location ~* \.(wasm|task|glb|gz)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";   # safe because the app requests them as ...?v=<version>
}
```
  and make sure `application/wasm`, `model/gltf-binary` and `model/vnd.usdz+zip` are in `mime.types`. Do not add `Content-Encoding: gzip` for `*.gz` (the app inflates them itself; it also detects an already-inflated body).
- Not done: no smaller hand model exists in MediaPipe's `hand_landmarker` bundle (this is the only variant, float16); the ring GLB is already Draco/mesh-compressed.
