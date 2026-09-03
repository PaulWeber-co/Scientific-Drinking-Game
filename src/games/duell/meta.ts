import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'duell',
  name: 'Reaktions-Duell',
  tagline: 'Handy in die Mitte. Wer zu langsam tippt, trinkt.',
  icon: 'bolt',
  accent: 'var(--red)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '5-15 Min',
  intensity: 2,
  tags: ['handy-weg', 'schnell', 'bewegung'],
  requiresOwnDevice: false,
  howTo: [
    'Ein Handy liegt zwischen zwei Personen – jede bekommt eine Bildschirmhälfte.',
    'Sobald der Bildschirm grün wird, so schnell wie möglich auf die eigene Seite tippen.',
    'Zu früh getippt heißt sofort verloren. Die langsamere Person trinkt.',
  ],
};
