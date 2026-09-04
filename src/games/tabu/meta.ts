import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'tabu',
  name: 'Tabu Rush',
  tagline: 'Erklären ohne die verbotenen Wörter. Zwei Teams, 60 Sekunden.',
  icon: 'ban',
  accent: 'var(--indigo)',
  minPlayers: 4,
  maxPlayers: 16,
  duration: '15-25 Min',
  intensity: 2,
  tags: ['team', 'schnell', 'reden'],
  requiresOwnDevice: false,
  howTo: [
    'Zwei Teams. Reihum erklärt eine Person Begriffe, ohne die verbotenen Wörter zu benutzen.',
    'Nur die erklärende Person schaut aufs Handy – alle anderen: Bildschirm tabu.',
    'Am Ende trinkt das Verliererteam die Punktedifferenz.',
  ],
};
