import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'chaos-roulette',
  name: 'Chaos-Roulette',
  tagline: 'Aufgaben für die Runde. Handys bleiben liegen.',
  icon: 'shuffle',
  accent: 'var(--orange)',
  minPlayers: 4,
  maxPlayers: 16,
  duration: '10-30 Min',
  intensity: 2,
  tags: ['handy-weg', 'bewegung', 'schnell'],
  howTo: [
    'Ein Handy reicht – es wird reihum weitergegeben.',
    'Karte vorlesen und sofort machen. Kein Nachdenken.',
    'Manche Karten treffen die ganze Runde, manche nur dich.',
  ],
  allowCustomCards: true,
  allowSpicy: true,
  requiresOwnDevice: false,
};
