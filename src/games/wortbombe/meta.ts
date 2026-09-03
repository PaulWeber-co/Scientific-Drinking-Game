import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'wortbombe',
  name: 'Wortbombe',
  tagline: 'Ein Wort sagen, weitergeben, nicht explodieren.',
  icon: 'bomb',
  accent: 'var(--pink)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '5-20 Min',
  intensity: 2,
  tags: ['handy-weg', 'schnell', 'bewegung'],
  requiresOwnDevice: false,
  howTo: [
    'Auf einem Handy: die Bombe wird herumgereicht. Mit eigenen Handys: sie springt von selbst weiter.',
    'Wer die Bombe hat, nennt ein passendes Wort und gibt sofort weiter.',
    'Wer sie in der Hand hält, wenn sie hochgeht, trinkt.',
  ],
};
