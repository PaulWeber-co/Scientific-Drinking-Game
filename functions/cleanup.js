/**
 * Reine Aufräum-Logik, ohne Firebase-Abhängigkeit – damit sie sich mit einer
 * Attrappe testen lässt (tests/functions/cleanup.test.ts). Die geplanten
 * Funktionen in index.js reichen nur Datenbank bzw. Auth hinein.
 */

/** Anonyme Anmeldungen, die so lange nicht benutzt wurden, verschwinden. */
const ANON_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Löscht jede Lobby, deren `meta/expiresAt` vorbei ist. Lobbys ohne
 * `expiresAt` sortiert die Abfrage zuerst ein – sie gehen mit.
 *
 * Pro Lobby als Transaktion, die das Ablaufdatum erneut prüft: Zwischen
 * Abfrage und Löschen kann ein Gerät denselben Code frisch angelegt haben.
 * Vorher löschte ein Sammel-`update` anhand des Codes auch diese neue Lobby.
 */
async function removeExpiredLobbies(db, now) {
  const snap = await db.ref('lobbies').orderByChild('meta/expiresAt').endAt(now).get();
  const keys = [];
  snap.forEach((lobby) => {
    keys.push(lobby.key);
  });
  let removed = 0;
  for (const key of keys) {
    let deleted = false;
    await db.ref(`lobbies/${key}`).transaction((cur) => {
      // Erster Aufruf mit leerem Cache: „löschen" vorschlagen; der Server
      // antwortet mit dem echten Stand, und es geht mit dem weiter.
      if (cur === null) {
        deleted = false;
        return null;
      }
      const exp = cur && cur.meta && cur.meta.expiresAt;
      if (typeof exp === 'number' && exp > now) {
        deleted = false;
        return undefined; // inzwischen wieder gültig – stehen lassen
      }
      deleted = true;
      return null;
    });
    if (deleted) removed++;
  }
  return removed;
}

function lastActive(user) {
  const m = user.metadata || {};
  return Date.parse(m.lastRefreshTime || m.lastSignInTime || m.creationTime || '') || 0;
}

/**
 * Datensparsamkeit: Die Online-Lobby legt pro Gerät eine anonyme Anmeldung
 * an. Ohne diesen Job blieben die Konten für immer in Firebase Auth liegen.
 * Gelöscht werden nur anonyme Konten (ohne verknüpften Anbieter), die seit
 * `maxAgeMs` nicht benutzt wurden.
 */
async function removeStaleAnonymousUsers(auth, now, maxAgeMs = ANON_MAX_AGE_MS) {
  let pageToken;
  let removed = 0;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const stale = page.users
      .filter((u) => (u.providerData || []).length === 0 && lastActive(u) < now - maxAgeMs)
      .map((u) => u.uid);
    if (stale.length) {
      const res = await auth.deleteUsers(stale);
      removed += res.successCount;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return removed;
}

module.exports = { removeExpiredLobbies, removeStaleAnonymousUsers, ANON_MAX_AGE_MS };
