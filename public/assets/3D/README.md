# 3D assets

`ring_webgi.glb` is the ring mesh from [VikasRana10/3D-app](https://github.com/VikasRana10/3D-app) (Crystal-Jewels). It is Draco-compressed; `CrystalRingCanvas` decodes it with the local files in `/draco/gltf/`. We load it with Three.js — not WebGI — and only reuse camera/rotation/build. Their site chrome is not in this repo.

The hero section can still load **one random model per session** from the folders listed here.

**Convention:** Each subfolder should contain a **`scene.gltf`** (or `scene.glb`) file.

**When you add a new folder** (e.g. `my-model`):
1. Put your `scene.gltf` (or `scene.glb`) inside `public/assets/3D/my-model/`.
2. Add the folder name to the **`ASSET_FOLDERS`** array in `components/PendantFBX.tsx`.

Example: after adding `public/assets/3D/sphere/`, add `'sphere'` to `ASSET_FOLDERS`.
