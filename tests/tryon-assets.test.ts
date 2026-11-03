import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { AR_ASSET_VERSION, arGlbUrl, arGlbVersionedUrl } from '../lib/ar-assets';

const pub = (p: string) => resolve(__dirname, '..', 'public', p);

// The try-on downloads <file>.gz and inflates it in the browser (lib/tryon-preload.ts). The .gz must be a real gzip of the exact file.
describe('pre-compressed try-on binaries', () => {
  for (const f of ['mediapipe/wasm/vision_wasm_internal.wasm', 'ar/hand_landmarker.task']) {
    it(`${f}.gz inflates to exactly ${f}`, () => {
      const gz = readFileSync(pub(`${f}.gz`));
      expect(gz[0]).toBe(0x1f);
      expect(gz[1]).toBe(0x8b);
      const raw = gunzipSync(gz);
      expect(raw.length).toBe(statSync(pub(f)).size);
      expect(raw.equals(readFileSync(pub(f)))).toBe(true);
      expect(gz.length).toBeLessThan(raw.length * 0.9);
    });
  }
  it('wasm.gz starts with the wasm magic after inflating', () => {
    const raw = gunzipSync(readFileSync(pub('mediapipe/wasm/vision_wasm_internal.wasm.gz')));
    expect([...raw.subarray(0, 4)]).toEqual([0x00, 0x61, 0x73, 0x6d]);
  });
  it('versioned GLB URL = plain URL + ?v=<AR_ASSET_VERSION>', () => {
    expect(arGlbVersionedUrl('platinum')).toBe(`${arGlbUrl('platinum')}?v=${AR_ASSET_VERSION}`);
  });
});
