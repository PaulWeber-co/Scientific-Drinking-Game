import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'erste-zeile',
  name: 'Erste Zeile',
  tagline: 'Singen statt streamen. Die Runde rät.',
  icon: 'activity',
  accent: 'var(--pink)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 1,
  tags: ['handy-weg', 'reden', 'kreativ'],
  howTo: [
    'Die Person am Zug sucht sich einen passenden Song aus und singt die erste Zeile.',
    'Wer ihn zuerst errät, wird angetippt und ist raus – alle anderen trinken.',
    'Errät ihn niemand, trinkt die singende Person.',
  ],
  allowCustomCards: true,
  requiresOwnDevice: false,
};
