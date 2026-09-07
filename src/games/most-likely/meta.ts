import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'most-likely',
  name: 'Wer aus der Runde',
  tagline: 'Alle zeigen gleichzeitig. Wer gezeigt wird, trinkt.',
  icon: 'people',
  accent: 'var(--orange)',
  minPlayers: 4,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 2,
  tags: ['geheim', 'schnell', 'reden'],
  requiresOwnDevice: false,
  allowSpicy: true,
  howTo: [
    'Frage vorlesen. Auf drei zeigen alle gleichzeitig mit dem Finger auf eine Person.',
    'Eine Person zählt nach und trägt ein, wie viele Finger auf wen zeigten.',
    'Jede Person trinkt so viele Schlucke, wie Finger auf sie gezeigt haben.',
  ],
};
