import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'kings-cup',
  name: 'Ring of Fire',
  tagline: 'Kings Cup. 52 Karten, 13 Regeln, ein Becher.',
  icon: 'crown',
  accent: 'var(--red)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '20-45 Min',
  intensity: 3,
  tags: ['karten', 'handy-weg', 'reden'],
  requiresOwnDevice: false,
  howTo: [
    'Ein leeres Glas steht in der Mitte – das ist der Becher.',
    'Reihum zieht jede Person eine Karte. Der Kartenwert bestimmt die Regel.',
    'Wer den vierten König zieht, trinkt den Becher.',
  ],
};
