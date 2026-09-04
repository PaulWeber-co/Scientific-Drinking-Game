import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'top-ten',
  name: 'Top Ten',
  tagline: 'Geheime Zahl, passende Antwort. Kriegt ihr die Reihenfolge hin?',
  icon: 'ranking',
  accent: 'var(--blue)',
  minPlayers: 3,
  maxPlayers: 10,
  duration: '20-40 Min',
  intensity: 1,
  tags: ['geheim', 'kreativ', 'reden'],
  requiresOwnDevice: true,
  allowSpicy: true,
  howTo: [
    'Jede Person bekommt heimlich eine Zahl von 1 bis 10.',
    'Zur Kategorie gibt jede Person eine Antwort, die genau zu ihrer Zahl passt.',
    'Der Kapitän sortiert alle Antworten von 1 nach 10. Jeder Fehler kostet die Runde Schlucke.',
  ],
};
