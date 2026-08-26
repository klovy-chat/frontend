// vite-env.d.ts
// Typy zmiennych Vite (import.meta.env).
// Zakres:
//  - backend, Turnstile, CDN, LiveKit, MODE/DEV/PROD
//  - nowy VITE_* dopisz tu, inaczej tsc nie zobaczy import.meta.env
// Zostaw `/// <reference types="vite/client" />` — bez tego zniknie typowanie Vite.
// Przy zmianach: .env, wrangler, utils/env/*.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  readonly VITE_TURNSTILE_SITE_KEY: string;
  readonly VITE_CDN_BASE_URL?: string;

  readonly VITE_LIVEKIT_ALLOWED_HOSTS?: string;

  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
