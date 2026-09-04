import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'zwei-wahrheiten',
  name: 'Zwei Wahrheiten, eine Lüge',
  tagline: 'Drei Aussagen. Eine stimmt nicht.',
  icon: 'quotes',
  accent: 'var(--green)',
  minPlayers: 3,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 1,
  tags: ['geheim', 'reden', 'kreativ'],
  requiresOwnDevice: true,
  howTo: [
    'Reihum schreibt eine Person drei Aussagen über sich – zwei wahr, eine erfunden.',
    'Alle anderen tippen auf die Aussage, die sie für gelogen halten.',
    'Wer falsch liegt, trinkt. Durchschauen alle die Lüge, trinkt der Autor.',
  ],
};
