import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik, Komponente und Kartenstapel lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'lueckenfueller',
  name: 'Lückenfüller',
  tagline: 'Lücke lesen, Karte legen, der Richter kürt.',
  icon: 'cards',
  accent: 'var(--purple)',
  minPlayers: 3,
  maxPlayers: 10,
  duration: '20-40 Min',
  intensity: 2,
  tags: ['karten', 'kreativ', 'geheim'],
  requiresOwnDevice: true,
  allowSpicy: true,
  allowCustomCards: true,
  howTo: [
    'Jede Person braucht ein eigenes Handy – die Hand bleibt geheim, bis alle gelegt haben.',
    'Eine Karte mit Lücke liegt in der Mitte. Alle außer dem Richter legen die Antwort, die sie am besten finden.',
    'Der Richter deckt eine nach der anderen auf und kürt eine. Alle anderen trinken, der Richter rotiert.',
  ],
};
