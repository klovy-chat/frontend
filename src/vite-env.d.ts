/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
  readonly VITE_CDN_BASE_URL?: string;
  /**
   * Lista dozwolonych hostów LiveKit (po przecinku), np.
   * "*.livekit.cloud,rtc.example.com". Domyślnie "*.livekit.cloud".
   */
  readonly VITE_LIVEKIT_ALLOWED_HOSTS?: string;
  /** Ustawiane przez Vite: "development" | "production" */
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
