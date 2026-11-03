import { AR_ASSET_VERSION, HAND_MODEL_URL, MEDIAPIPE_WASM_URL, arGlbVersionedUrl, type ArMetalKey } from './ar-assets';

/**
 * First-use loading of the hand try-on, built to be as short as the network allows:
 *  - nothing is fetched until the user shows intent (hover / focus / touch / press on "Try on your hand", or the sheet opening);
 *  - the MediaPipe wasm, the hand model, the ring model and the MediaPipe JS chunk are fetched IN PARALLEL (before: one after the other,
 *    and only after the camera had started);
 *  - the two big binaries ship gzip-compressed (*.gz, ~10.5 MB instead of ~21 MB over the wire for wasm + model + GLB) and are inflated in the
 *    browser with DecompressionStream, so the saving does not depend on how the static host is configured. If DecompressionStream is
 *    missing, or the .gz is not there, the original uncompressed file is used;
 *  - one aggregate progress value (bytes) drives the progress bar in the sheet.
 * Everything is cached in module memory for the session (and the files are ordinary static files, so the HTTP cache applies too).
 */

export interface TryOnAssets {
  wasmLoaderPath: string;
  wasmBinaryUrl: string; // blob: URL of the inflated wasm (or the plain URL on fallback)
  model: Uint8Array;
  glb: ArrayBuffer;
  tasks: typeof import('@mediapipe/tasks-vision');
}
export interface TryOnProgress {
  loaded: number;
  total: number;
  fraction: number;
  done: boolean;
}

// Fallback sizes (bytes on the wire) until Content-Length is known. Only used for the progress bar.
const EST = { wasm: 3_277_471, model: 5_817_979, glb: 2_050_588, loader: 322_044 };
type Key = keyof typeof EST;

const loaded: Record<Key, number> = { wasm: 0, model: 0, glb: 0, loader: 0 };
const total: Record<Key, number> = { ...EST };
let finished = false;
const listeners = new Set<(p: TryOnProgress) => void>();

export function getProgress(): TryOnProgress {
  const l = (Object.keys(loaded) as Key[]).reduce((a, k) => a + Math.min(loaded[k], total[k] || loaded[k]), 0);
  const t = (Object.keys(total) as Key[]).reduce((a, k) => a + total[k], 0);
  return { loaded: l, total: t, fraction: finished ? 1 : Math.min(0.99, l / Math.max(t, 1)), done: finished };
}
export function subscribeProgress(cb: (p: TryOnProgress) => void): () => void {
  listeners.add(cb);
  cb(getProgress());
  return () => listeners.delete(cb);
}
const emit = () => {
  const p = getProgress();
  listeners.forEach((cb) => cb(p));
};

async function fetchBytes(url: string, key: Key, signal?: AbortSignal): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length'));
  if (len > 0) total[key] = len;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    loaded[key] = buf.length;
    emit();
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    n += value.length;
    loaded[key] = n;
    emit();
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

const isGzip = (b: Uint8Array) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

async function inflate(b: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([b as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Fetch `<url>.gz` and inflate; on any problem fall back to the uncompressed `<url>`. */
async function fetchMaybeGz(url: string, key: Key, estRaw: number): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const gz = await fetchBytes(`${url}.gz?v=${AR_ASSET_VERSION}`, key);
      // some static hosts add Content-Encoding to *.gz and the browser has already inflated it: then it is not gzip any more
      return isGzip(gz) ? await inflate(gz) : gz;
    } catch {
      loaded[key] = 0;
      total[key] = estRaw;
    }
  }
  return fetchBytes(`${url}?v=${AR_ASSET_VERSION}`, key);
}

type Binaries = Omit<TryOnAssets, 'glb'>;
let binaries: Promise<Binaries> | null = null;
const glbs = new Map<ArMetalKey, Promise<ArrayBuffer>>();

function startBinaries(): Promise<Binaries> {
  if (binaries) return binaries;
  finished = false;
  const loaderUrl = `${MEDIAPIPE_WASM_URL}/vision_wasm_internal.js`;
  const p = (async () => {
    const tasksP = import('@mediapipe/tasks-vision');
    const wasmP = fetchMaybeGz(`${MEDIAPIPE_WASM_URL}/vision_wasm_internal.wasm`, 'wasm', 11_153_617);
    const modelP = fetchMaybeGz(HAND_MODEL_URL, 'model', 7_819_105);
    // warm the loader script into the HTTP cache so MediaPipe's own <script>/importScripts is instant
    const loaderP = fetch(loaderUrl)
      .then(async (r) => {
        const b = await r.arrayBuffer();
        loaded.loader = b.byteLength;
        total.loader = b.byteLength;
        emit();
      })
      .catch(() => undefined);
    const [tasks, wasm, model] = await Promise.all([tasksP, wasmP, modelP, loaderP]);
    const wasmBinaryUrl = URL.createObjectURL(new Blob([wasm as BlobPart], { type: 'application/wasm' }));
    return { tasks, wasmLoaderPath: loaderUrl, wasmBinaryUrl, model } as Binaries;
  })();
  binaries = p;
  p.catch(() => {
    if (binaries === p) binaries = null; // allow a retry after a network failure
  });
  return p;
}

function startGlb(k: ArMetalKey): Promise<ArrayBuffer> {
  let g = glbs.get(k);
  if (!g) {
    g = fetchBytes(arGlbVersionedUrl(k), 'glb').then((b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    glbs.set(k, g);
    g.catch(() => glbs.delete(k));
  }
  return g;
}

/** Starts (once) the parallel fetches and resolves with everything the sheet needs. Safe to call repeatedly. */
export function prefetchTryOn(metalKey: ArMetalKey): Promise<TryOnAssets> {
  const all = Promise.all([startBinaries(), startGlb(metalKey)]).then(([b, glb]) => {
    finished = true;
    emit();
    return { ...b, glb } as TryOnAssets;
  });
  return all;
}

/** Warm-up for pointer/focus/touch intent on the entry buttons: loads the sheet chunk and starts the parallel fetches. */
export function warmTryOn(metalKey: ArMetalKey): void {
  const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  void import('../components/RingTryOn');
  void prefetchTryOn(metalKey).catch(() => undefined);
}
