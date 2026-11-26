import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import type { Auth } from 'firebase/auth';

/**
 * Die Realtime-Database-URL ist fest hinterlegt – niemand soll beim ersten
 * Start irgendwelche Keys eintippen müssen. Ueber VITE_FIREBASE_DB_URL lässt
 * sich für eigene Deployments eine andere Instanz setzen.
 */
export const DATABASE_URL =
  import.meta.env.VITE_FIREBASE_DB_URL ??
  'https://scientificgame-5b7e7-default-rtdb.europe-west1.firebasedatabase.app';

/**
 * Web-API-Key des Firebase-Projekts – für die anonyme Anmeldung nötig.
 *
 * Er ist KEIN Geheimnis: Firebase-Web-Keys stehen in jedem Client und
 * identifizieren nur das Projekt. Geschützt werden die Daten durch die
 * Security Rules (database.rules.json), die jede Schreibung an die anonyme
 * UID binden. Den Key in der Google Cloud Console trotzdem auf die eigene
 * Domain und die Identity-Toolkit-API beschränken (siehe SECURITY_AUDIT.md).
 */
const API_KEY: string | undefined = import.meta.env.VITE_FIREBASE_API_KEY || undefined;
const PROJECT_ID: string = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'scientificgame-5b7e7';

/** Ist die anonyme Anmeldung eingerichtet? Ohne sie lehnen die Rules alles ab. */
export const AUTH_CONFIGURED = Boolean(API_KEY);

let app: FirebaseApp | null = null;
let db: Database | null = null;

function getApp(): FirebaseApp {
  app ??= initializeApp({ databaseURL: DATABASE_URL, apiKey: API_KEY, projectId: PROJECT_ID });
  return app;
}

export function getDb(): Database {
  db ??= getDatabase(getApp());
  return db;
}

let auth: Promise<Auth> | null = null;

/**
 * Erst beim Gang in die Online-Lobby geladen: Pass & Play baut keine
 * Verbindung zu Google auf und braucht das Modul nicht.
 *
 * Ohne Popup/Redirect-Resolver (wie `getAuth()` ihn einbindet): anonym braucht
 * keinen, und in der nativen Hülle (capacitor://) scheitert sein iframe.
 */
function loadAuth(): Promise<Auth> {
  auth ??= import('firebase/auth')
    .then(
      ({
        initializeAuth,
        indexedDBLocalPersistence,
        browserLocalPersistence,
        inMemoryPersistence,
      }) =>
        initializeAuth(getApp(), {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
        }),
    )
    .catch((e: unknown) => {
      // Chunk nicht geladen (offline): beim nächsten Versuch neu.
      auth = null;
      throw e;
    });
  return auth;
}

/**
 * Die Kennung, unter der dieses Gerät online auftritt.
 *
 * Mit API-Key: die UID der anonymen Firebase-Anmeldung. Der Server kennt sie
 * aus dem signierten Token – die Rules erlauben einen Spielereintrag, den
 * Host-Posten und Inbox-Nachrichten nur unter genau dieser UID. Die Anmeldung
 * bleibt im Gerätespeicher; ein Neuladen ist derselbe Spieler.
 *
 * Ohne API-Key (Entwicklung, Fork ohne Firebase-Auth): die alte Gerätekennung.
 * Gegen die gehärteten Rules funktioniert das NICHT – `describe()` in
 * PartyContext sagt dann, was fehlt.
 */
export async function onlineIdentity(fallback: string): Promise<string> {
  if (!API_KEY) return fallback;
  const a = await loadAuth();
  await a.authStateReady();
  if (a.currentUser) return a.currentUser.uid;
  const { signInAnonymously } = await import('firebase/auth');
  return (await signInAnonymously(a)).user.uid;
}

/**
 * „Alles zurücksetzen“: die anonyme Anmeldung gleich mit löschen – auf dem
 * Server, und klappt das nicht (offline), wenigstens auf dem Gerät. Das
 * Server-Konto räumt dann `cleanupAnonymousUsers` nach 30 Tagen.
 *
 * Läuft bewusst nach `leave()`: dessen Schreibvorgänge sind dann schon mit
 * der alten Anmeldung unterwegs.
 */
export async function forgetOnlineIdentity(): Promise<void> {
  if (!API_KEY) return;
  try {
    const a = await loadAuth();
    await a.authStateReady();
    const user = a.currentUser;
    if (!user) return;
    const { signOut } = await import('firebase/auth');
    await user.delete().catch(() => signOut(a));
  } catch {
    // Auth-Modul nicht ladbar (offline): nichts zu tun, siehe oben.
  }
}

export const LOBBY_TTL_MS = 8 * 60 * 60 * 1000; // 8 Stunden – eine Partynacht
export const PLAYER_STALE_MS = 90_000; // ab hier gilt ein Spieler als weg
/** Muss zu `now - 45000` in database.rules.json passen (meta/host). */
export const HOST_TAKEOVER_MS = 45_000; // ab hier darf jemand den Host übernehmen
export const HEARTBEAT_MS = 20_000;

/** Firebase wartet bei schlechtem Netz endlos. Auf einer Party ist das keine Option. */
export const NETWORK_TIMEOUT_MS = 12_000;

export function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), NETWORK_TIMEOUT_MS);
  });
  // Der Wecker wird abgeräumt, sobald die Antwort da ist – sonst lief nach
  // jedem erfolgreichen Aufruf noch zwölf Sekunden ein toter Timer mit.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
