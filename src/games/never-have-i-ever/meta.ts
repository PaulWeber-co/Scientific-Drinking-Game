import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'never-have-i-ever',
  name: 'Ich hab noch nie',
  tagline: 'Handy weg. Karte lesen. Ehrlich sein.',
  icon: 'eyeOff',
  accent: 'var(--teal)',
  minPlayers: 4,
  maxPlayers: 16,
  duration: '10-25 Min',
  intensity: 2,
  tags: ['handy-weg', 'reden'],
  howTo: [
    'Ein Handy liegt in der Mitte, alle anderen bleiben in der Tasche.',
    'Karte vorlesen. Wer es schon gemacht hat, trinkt.',
    'Deine persönliche Menge steht auf deinem Handy – oder du fragst den Vorleser.',
  ],
  allowCustomCards: true,
  allowSpicy: true,
  requiresOwnDevice: false,
};
