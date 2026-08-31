/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_DB_URL?: string;
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
