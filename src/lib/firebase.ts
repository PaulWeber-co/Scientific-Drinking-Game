import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

/**
 * Die Realtime-Database-URL ist fest hinterlegt – niemand soll beim ersten
 * Start irgendwelche Keys eintippen müssen. Ueber VITE_FIREBASE_DB_URL lässt
 * sich für eigene Deployments eine andere Instanz setzen.
 *
 * Es liegt hier bewusst kein API-Key: für die Realtime Database ohne Auth
 * genügt die databaseURL. Der Zugriff wird über die Security Rules begrenzt
 * (siehe database.rules.json).
 */
export const DATABASE_URL =
  import.meta.env.VITE_FIREBASE_DB_URL ??
  'https://scientificgame-5b7e7-default-rtdb.europe-west1.firebasedatabase.app';

let app: FirebaseApp | null = null;
let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    app = initializeApp({ databaseURL: DATABASE_URL });
    db = getDatabase(app);
  }
  return db;
}

export const LOBBY_TTL_MS = 8 * 60 * 60 * 1000; // 8 Stunden – eine Partynacht
export const PLAYER_STALE_MS = 90_000; // ab hier gilt ein Spieler als weg
export const HOST_TAKEOVER_MS = 45_000; // ab hier darf jemand den Host übernehmen
export const HEARTBEAT_MS = 20_000;

/** Firebase wartet bei schlechtem Netz endlos. Auf einer Party ist das keine Option. */
export const NETWORK_TIMEOUT_MS = 12_000;

export function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), NETWORK_TIMEOUT_MS),
    ),
  ]);
}
