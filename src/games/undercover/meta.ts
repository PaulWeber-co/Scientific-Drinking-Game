import type { GameMeta } from '../types';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'undercover',
  name: 'Undercover',
  tagline: 'Alle kennen dasselbe Wort. Eine Person nicht.',
  icon: 'eyeOff',
  accent: 'var(--indigo)',
  minPlayers: 4,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 2,
  tags: ['geheim', 'reden', 'handy-weg'],
  requiresOwnDevice: true,
  howTo: [
    'Jede Person sieht ihr Wort nur auf dem eigenen Handy. Eine Person bekommt ein anderes.',
    'Reihum beschreibt jede Person ihr Wort mit genau einem Satz – ohne es zu nennen.',
    'Danach wird abgestimmt. Wer rausfliegt, trinkt. Bleibt Undercover übrig, trinkt die ganze Runde.',
  ],
};
