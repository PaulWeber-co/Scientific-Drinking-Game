import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'kategorien',
  name: 'Kategorien',
  tagline: 'Reihum ein Beispiel. Wer hängt, trinkt.',
  icon: 'brackets',
  accent: 'var(--mint)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '5-15 Min',
  intensity: 1,
  tags: ['handy-weg', 'schnell', 'reden'],
  howTo: [
    'Ein Handy in der Mitte reicht.',
    'Kategorie vorlesen, dann reihum ein Beispiel nennen – im Takt.',
    'Wer hängt, sich wiederholt oder patzt, trinkt.',
  ],
  allowCustomCards: true,
  allowSpicy: true,
  requiresOwnDevice: false,
};
