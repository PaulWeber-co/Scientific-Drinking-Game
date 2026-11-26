/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_DB_URL?: string;
  /** Öffentlicher Web-API-Key (kein Geheimnis) – nötig für die anonyme Anmeldung. */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Fingerabdruck der Spiellogik, gesetzt in `vite.config.ts`. */
declare const __GAME_BUILD__: string;
