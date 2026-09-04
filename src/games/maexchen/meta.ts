import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'maexchen',
  name: 'Mäxchen',
  tagline: 'Würfeln, ansagen, lügen. Oder aufdecken.',
  icon: 'games',
  accent: 'var(--yellow)',
  minPlayers: 3,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 3,
  tags: ['handy-weg', 'geheim', 'reden'],
  requiresOwnDevice: false,
  howTo: [
    'Ein Handy wandert reihum. Wer dran ist, würfelt verdeckt und schaut allein hin.',
    'Dann wird angesagt – höher als die Ansage davor. Lügen ist ausdrücklich erlaubt.',
    'Die nächste Person glaubt oder deckt auf. Wer falsch liegt, trinkt.',
  ],
};
