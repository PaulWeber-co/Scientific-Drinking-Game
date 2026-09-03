import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'most-likely',
  name: 'Wer aus der Runde',
  tagline: 'Alle zeigen gleichzeitig. Meiste Stimmen trinkt.',
  icon: 'people',
  accent: 'var(--orange)',
  minPlayers: 4,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 2,
  tags: ['geheim', 'schnell', 'reden'],
  requiresOwnDevice: true,
  allowSpicy: true,
  howTo: [
    'Jede Person braucht ihr eigenes Handy – niemand soll sehen, wer wen wählt.',
    'Frage lesen, tippen. Erst wenn alle gewählt haben, wird aufgedeckt.',
    'Wer die meisten Stimmen bekommt, trinkt pro Stimme.',
  ],
};
