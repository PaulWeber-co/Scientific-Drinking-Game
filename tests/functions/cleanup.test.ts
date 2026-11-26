// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

/**
 * Die Aufräum-Jobs der Cloud Functions gegen eine Attrappe.
 *
 * Die Transaktions-Attrappe verhält sich wie das Admin-SDK: Der erste Aufruf
 * sieht einen leeren Cache (`null`), danach den echten Serverstand. Zwischen
 * Abfrage und Löschen kann sich der Stand ändern – genau das stellt der Test
 * „neu angelegte Lobby" nach.
 */
const require = createRequire(import.meta.url);
const { removeExpiredLobbies, removeStaleAnonymousUsers, ANON_MAX_AGE_MS } = require(
  '../../functions/cleanup.js',
) as typeof import('../../functions/cleanup.js');

type Lobby = { meta?: { expiresAt?: number } };
const NOW = 1_800_000_000_000;

function fakeDb(lobbies: Record<string, Lobby>, beforeDelete?: () => void) {
  return {
    lobbies,
    ref(path: string) {
      return {
        orderByChild: () => ({
          endAt: (t: number) => ({
            get: async () => {
              const hits = Object.entries(lobbies).filter(([, l]) => (l.meta?.expiresAt ?? -Infinity) <= t);
              const snapshot = { forEach: (cb: (s: { key: string }) => void) => hits.forEach(([key]) => cb({ key })) };
              // Zwischen Abfrage und Löschen passiert etwas (Race).
              beforeDelete?.();
              return snapshot;
            },
          }),
        }),
        async transaction(fn: (cur: unknown) => unknown) {
          const key = path.split('/')[1];
          let next = fn(null); // leerer Cache
          const server = lobbies[key] ?? null;
          if (server !== null) next = fn(structuredClone(server));
          if (next === undefined) return { committed: false };
          if (next === null) delete lobbies[key];
          else lobbies[key] = next as Lobby;
          return { committed: true };
        },
      };
    },
  };
}

describe('removeExpiredLobbies', () => {
  it('löscht abgelaufene Lobbys und Lobbys ohne Ablaufdatum, lässt gültige stehen', async () => {
    const db = fakeDb({
      ALT111: { meta: { expiresAt: NOW - 1 } },
      KAPUTT: {},
      NEU222: { meta: { expiresAt: NOW + 1000 } },
    });
    expect(await removeExpiredLobbies(db, NOW)).toBe(2);
    expect(Object.keys(db.lobbies)).toEqual(['NEU222']);
  });

  it('löscht keine Lobby, die nach der Abfrage unter demselben Code neu angelegt wurde', async () => {
    const lobbies: Record<string, Lobby> = { ABC234: { meta: { expiresAt: NOW - 1 } } };
    const db = fakeDb(lobbies, () => {
      lobbies.ABC234 = { meta: { expiresAt: NOW + 8 * 3_600_000 } };
    });
    expect(await removeExpiredLobbies(db, NOW)).toBe(0);
    expect(lobbies.ABC234?.meta?.expiresAt).toBe(NOW + 8 * 3_600_000);
  });
});

describe('removeStaleAnonymousUsers', () => {
  const user = (uid: string, lastMs: number, providers = 0) => ({
    uid,
    providerData: Array.from({ length: providers }, () => ({ providerId: 'google.com' })),
    metadata: { lastSignInTime: new Date(lastMs).toUTCString(), creationTime: new Date(lastMs).toUTCString() },
  });

  it('löscht nur anonyme Konten, die länger als 30 Tage ungenutzt sind – über alle Seiten', async () => {
    const pages = [
      { users: [user('alt', NOW - ANON_MAX_AGE_MS - 86_400_000), user('frisch', NOW - 1000)], pageToken: 'p2' },
      { users: [user('alt2', NOW - ANON_MAX_AGE_MS - 1000), user('verknuepft', 0, 1)], pageToken: undefined },
    ];
    const deleted: string[] = [];
    const auth = {
      listUsers: async (_max: number, token?: string) => pages[token ? 1 : 0],
      deleteUsers: async (uids: string[]) => {
        deleted.push(...uids);
        return { successCount: uids.length };
      },
    };
    expect(await removeStaleAnonymousUsers(auth, NOW)).toBe(2);
    expect(deleted).toEqual(['alt', 'alt2']);
  });
});
