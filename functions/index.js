const { onSchedule } = require('firebase-functions/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');
const { removeExpiredLobbies, removeStaleAnonymousUsers } = require('./cleanup');

initializeApp();

exports.removeExpiredLobbies = removeExpiredLobbies;

/**
 * Die Realtime Database kennt kein Ablaufdatum: ohne diesen Job blieben Namen
 * und Spielstände abgelaufener Lobbys für immer liegen.
 */
exports.cleanupLobbies = onSchedule(
  { schedule: 'every 60 minutes', region: 'europe-west1' },
  async () => {
    await removeExpiredLobbies(getDatabase(), Date.now());
  },
);

/** Anonyme Anmeldungen, die 30 Tage nicht benutzt wurden, werden gelöscht. */
exports.cleanupAnonymousUsers = onSchedule(
  { schedule: 'every 24 hours', region: 'europe-west1' },
  async () => {
    await removeStaleAnonymousUsers(getAuth(), Date.now());
  },
);
