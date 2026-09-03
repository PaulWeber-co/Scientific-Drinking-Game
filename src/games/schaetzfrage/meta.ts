import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'schaetzfrage',
  name: 'Schätzfrage',
  tagline: 'Alle tippen eine Zahl. Am weitesten daneben trinkt.',
  icon: 'target',
  accent: 'var(--teal)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 1,
  tags: ['geheim', 'schnell'],
  requiresOwnDevice: true,
  howTo: [
    'Jede Person tippt ihre Schätzung auf dem eigenen Handy ein.',
    'Erst wenn alle abgegeben haben, wird aufgelöst.',
    'Wer am weitesten daneben liegt, trinkt. Wer am nächsten dran ist, geht frei aus.',
  ],
};
