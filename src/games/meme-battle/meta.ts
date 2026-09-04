import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'meme-battle',
  name: 'Meme Battle',
  tagline: 'Prompt lesen, Pointe tippen, anonym abstimmen.',
  icon: 'quotes',
  accent: 'var(--mint)',
  minPlayers: 3,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 2,
  tags: ['kreativ', 'schnell', 'geheim'],
  requiresOwnDevice: true,
  allowSpicy: true,
  howTo: [
    'Jede Person braucht ein eigenes Handy – die Antworten bleiben bis zur Abstimmung geheim.',
    'Alle schreiben zum selben Prompt die beste Pointe.',
    'Danach wird anonym abgestimmt. Wer keine Stimme bekommt, trinkt.',
  ],
};
