import type { GameMeta } from '../types';
import image from '../../assets/games/stichmagie.webp';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik, Karten und Tisch lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'stichmagie',
  name: 'Stichmagie',
  tagline: 'Sag deine Stiche voraus. Magier, Drache, Fee – und eine Bombe.',
  icon: 'wand',
  accent: 'var(--indigo)',
  image,
  minPlayers: 3,
  maxPlayers: 10,
  duration: '30-60 Min',
  intensity: 2,
  tags: ['karten', 'geheim'],
  requiresOwnDevice: true,
  // Wie `planFor` in rules.ts – hier ausgeschrieben, damit die Regeln nicht
  // ins Haupt-Bundle wandern. 60 Karten durch die Zahl der Leute.
  rounds: (players, length) => {
    const max = Math.floor(60 / Math.max(1, players));
    return length === 'kurz' ? Math.ceil(max / 2) : max;
  },
  howTo: [
    'Jede Person braucht ihr eigenes Handy – die Hand bleibt geheim. Runde 1 hat eine Karte, jede weitere eine mehr.',
    'Nach dem Blick auf die Hand sagt reihum jede Person an, wie viele Stiche sie macht. Farbe bedienen ist Pflicht, Magier und Narren gehen immer.',
    'Genau getroffen: 20 Punkte plus 10 je Stich. Daneben: minus 10 je Stich – und trinken. Die meisten Punkte gewinnen.',
    'Mit den Sonderkarten der Jubiläumsausgaben: Drache, Fee, Bombe, Werwolf, Jongleur, Wolke, Gestaltwandler – und neu Hexe und Vampir.',
  ],
};
