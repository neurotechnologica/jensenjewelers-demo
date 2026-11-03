/// <reference types="vite/client" />

declare module 'three/examples/jsm/loaders/GLTFLoader' {
  import type { Loader, LoadingManager, Group } from 'three';
  import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    setDRACOLoader(dracoLoader: DRACOLoader): this;
    load(
      url: string,
      onLoad: (gltf: { scene: Group }) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
  }
}

declare module 'three/examples/jsm/loaders/DRACOLoader' {
  import type { Loader, LoadingManager } from 'three';
  export class DRACOLoader extends Loader {
    constructor(manager?: LoadingManager);
    setDecoderPath(path: string): this;
    setDecoderConfig(config: { type?: string }): this;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/environments/RoomEnvironment' {
  import { Scene } from 'three';
  export class RoomEnvironment extends Scene {
    constructor();
    dispose(): void;
  }
}

declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}

declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }
  export default function qrcode(typeNumber: number, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'): QRCode;
}

interface ImportMetaEnv {
  /** '0' turns the short prospect page off (root `/` renders the legacy long landing again). Default: on. */
  readonly VITE_CRO_SHORT?: string;
  /** Primary CTA on the short page: 'book' (default) | 'hear' | 'golive'. 'golive' needs VITE_VOICE_ONBOARDING=1 + VITE_ONBOARDING_URL. */
  readonly VITE_CRO_CTA?: string;
  /** '1' only once the voice-onboarding platform is live and "Go live in 5 minutes" is true. */
  readonly VITE_VOICE_ONBOARDING?: string;
  readonly VITE_ONBOARDING_URL?: string;
  /** Optional http(s) override for the booking page. Wins over VITE_BOOKING_URL. Empty uses the Google Calendar appointment page. */
  readonly VITE_CAL_BOOKING_URL?: string;
  /** Optional http(s) override for the booking page. */
  readonly VITE_BOOKING_URL?: string;
  /** Fourcee platform API event endpoint (POST, JSON as text/plain). Unset = events stay in memory only. */
  readonly VITE_TRACK_URL?: string;
}
