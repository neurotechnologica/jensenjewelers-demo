import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { arGlbUrl, arThumbUrl, arUsdzUrl, type ArMetalKey } from '../lib/ar-assets';

const METALS: ArMetalKey[] = ['yellow-gold', 'white-gold', 'rose-gold', 'platinum'];
const onDisk = (url: string) => resolve(__dirname, '..', 'public', url.replace(/^\//, ''));

// Guards against a URL helper pointing at a file that is not shipped (the SPA would answer 200 text/html).
describe('AR asset URLs resolve to real files in public/', () => {
  for (const m of METALS) {
    it(`${m}: glb, usdz and thumbnail exist and are non-empty`, () => {
      for (const url of [arGlbUrl(m), arUsdzUrl(m), arThumbUrl(m)]) {
        expect(existsSync(onDisk(url)), url).toBe(true);
        expect(statSync(onDisk(url)).size, url).toBeGreaterThan(1000);
      }
    });
  }
  it('vendored MediaPipe files ship with a licence and notice', () => {
    for (const dir of ['mediapipe', 'ar']) {
      expect(existsSync(resolve(__dirname, '..', 'public', dir, 'LICENSE')), `${dir}/LICENSE`).toBe(true);
      expect(existsSync(resolve(__dirname, '..', 'public', dir, 'NOTICE')), `${dir}/NOTICE`).toBe(true);
    }
  });
});
