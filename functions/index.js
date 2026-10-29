const { onSchedule } = require('firebase-functions/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

/**
 * Löscht jede Lobby, deren `meta/expiresAt` vorbei ist. Die Realtime
 * Database kennt kein Ablaufdatum: ohne diesen Job blieben Namen und
 * Spielstände abgelaufener Lobbys für immer liegen. Lobbys ohne
 * `expiresAt` sortiert die Abfrage zuerst ein – sie gehen mit.
 */
async function removeExpiredLobbies(db, now) {
  const snap = await db.ref('lobbies').orderByChild('meta/expiresAt').endAt(now).get();
  const gone = {};
  snap.forEach((lobby) => {
    gone[lobby.key] = null;
  });
  if (Object.keys(gone).length > 0) await db.ref('lobbies').update(gone);
  return Object.keys(gone).length;
}

exports.removeExpiredLobbies = removeExpiredLobbies;

exports.cleanupLobbies = onSchedule(
  { schedule: 'every 60 minutes', region: 'europe-west1' },
  async () => {
    await removeExpiredLobbies(getDatabase(), Date.now());
  },
);
