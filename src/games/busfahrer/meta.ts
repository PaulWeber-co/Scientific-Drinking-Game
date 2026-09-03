import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'busfahrer',
  name: 'Busfahrer',
  tagline: 'Vier Fragen. Ein Verlierer. Eine lange Fahrt.',
  icon: 'bus',
  accent: 'var(--yellow)',
  minPlayers: 3,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 3,
  tags: ['karten', 'schnell'],
  requiresOwnDevice: false,
  howTo: [
    'Jede Person beantwortet vier Fragen zu ihren Karten. Falsch = trinken.',
    'Wer am meisten falsch lag, wird Busfahrer.',
    'Der Busfahrer deckt fünf Karten auf. Jede Bildkarte schickt ihn zurück an den Anfang.',
  ],
};
