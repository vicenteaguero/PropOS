/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_URL: string;
  // Web push subscription key. Set per Vercel project; a missing value silently
  // disables push instead of failing the build, so keep it declared here.
  readonly VITE_VAPID_PUBLIC_KEY: string;
  // Stamped by vite.config.ts at build time, not read from a .env file. They
  // exist so the running app can name the commit it was built from — see
  // `core/version/build-stamp.ts`.
  readonly VITE_APP_VERSION: string;
  readonly VITE_APP_COMMIT: string;
  readonly VITE_APP_BRANCH: string;
  readonly VITE_APP_BUILT_AT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
