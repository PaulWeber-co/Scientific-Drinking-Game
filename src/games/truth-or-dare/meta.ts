import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'truth-or-dare',
  name: 'Wahrheit oder Pflicht',
  tagline: 'Der Klassiker. Mit Notausgang.',
  icon: 'fork',
  accent: 'var(--purple)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '15-40 Min',
  intensity: 2,
  tags: ['reden', 'handy-weg'],
  howTo: [
    'Reihum entscheidet sich eine Person für Wahrheit oder Pflicht.',
    'Karte lesen, machen – oder kneifen und dafür trinken.',
    'Der Härtegrad oben rechts gilt für die ganze Runde.',
  ],
  modes: [
    { id: 'wahrheit', label: 'Wahrheit', icon: 'chat', tone: 'var(--blue)' },
    { id: 'pflicht', label: 'Pflicht', icon: 'flame', tone: 'var(--pink)' },
  ],
  allowCustomCards: true,
  allowSpicy: true,
  requiresOwnDevice: false,
};
