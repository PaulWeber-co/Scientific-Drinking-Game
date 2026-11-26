import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Online-Identität: anonyme Firebase-Anmeldung.
 *
 * Der API-Key wird beim Laden des Moduls gelesen – darum je Test
 * `vi.stubEnv` und ein frisches Modul.
 */
const auth = vi.hoisted(() => ({
  currentUser: null as null | { uid: string; delete: () => Promise<void> },
  authStateReady: vi.fn(async () => {}),
}));
const fb = vi.hoisted(() => ({
  initializeAuth: vi.fn(() => auth),
  signInAnonymously: vi.fn(async () => {
    auth.currentUser = { uid: 'uid-neu', delete: vi.fn(async () => {}) };
    return { user: auth.currentUser };
  }),
  signOut: vi.fn(async () => {
    auth.currentUser = null;
  }),
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/database', () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  ...fb,
  indexedDBLocalPersistence: 'idb',
  browserLocalPersistence: 'local',
  inMemoryPersistence: 'memory',
}));

async function modul(apiKey: string) {
  vi.stubEnv('VITE_FIREBASE_API_KEY', apiKey);
  vi.resetModules();
  return import('./firebase');
}

beforeEach(() => {
  auth.currentUser = null;
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe('onlineIdentity', () => {
  it('ohne API-Key: Gerätekennung, keine Verbindung zu Firebase Auth', async () => {
    const m = await modul('');
    expect(m.AUTH_CONFIGURED).toBe(false);
    expect(await m.onlineIdentity('d_geraet')).toBe('d_geraet');
    expect(fb.initializeAuth).not.toHaveBeenCalled();
  });

  it('mit API-Key: meldet sich einmal anonym an und bleibt bei derselben UID', async () => {
    const m = await modul('public-web-key');
    expect(await m.onlineIdentity('d_geraet')).toBe('uid-neu');
    expect(await m.onlineIdentity('d_geraet')).toBe('uid-neu');
    expect(fb.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(fb.initializeAuth).toHaveBeenCalledTimes(1);
  });

  it('übernimmt eine gespeicherte Anmeldung nach dem Neuladen', async () => {
    auth.currentUser = { uid: 'uid-alt', delete: vi.fn(async () => {}) };
    const m = await modul('public-web-key');
    expect(await m.onlineIdentity('d_geraet')).toBe('uid-alt');
    expect(fb.signInAnonymously).not.toHaveBeenCalled();
  });
});

describe('forgetOnlineIdentity („Alles zurücksetzen“)', () => {
  it('löscht das anonyme Konto auf dem Server', async () => {
    const del = vi.fn(async () => {});
    auth.currentUser = { uid: 'uid-alt', delete: del };
    const m = await modul('public-web-key');
    await m.forgetOnlineIdentity();
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('meldet sich wenigstens lokal ab, wenn das Löschen scheitert', async () => {
    auth.currentUser = {
      uid: 'uid-alt',
      delete: vi.fn(async () => Promise.reject(new Error('offline'))),
    };
    const m = await modul('public-web-key');
    await m.forgetOnlineIdentity();
    expect(fb.signOut).toHaveBeenCalledTimes(1);
    expect(auth.currentUser).toBeNull();
  });
});
