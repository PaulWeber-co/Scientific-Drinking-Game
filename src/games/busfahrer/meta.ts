import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'busfahrer',
  name: 'Busfahrer',
  tagline: 'Vier Fragen, eine Pyramide, eine lange Fahrt.',
  icon: 'bus',
  accent: 'var(--yellow)',
  minPlayers: 2,
  maxPlayers: 12,
  duration: '20-35 Min',
  intensity: 3,
  tags: ['karten', 'schnell'],
  requiresOwnDevice: false,
  howTo: [
    'Vier Fragen zu deinen Karten. Falsch geraten heißt trinken – und die Karte bleibt bei dir.',
    'Dann die Pyramide: Wer den aufgedeckten Wert hält, legt ab und verteilt Schlucke. Bluffen ist erlaubt, Zweifeln auch – wer danebenliegt, trinkt doppelt.',
    'Wer am Ende die meisten Karten hat, fährt Bus: fünf Karten, jede Bildkarte schickt ihn zurück an den Anfang.',
  ],
};
