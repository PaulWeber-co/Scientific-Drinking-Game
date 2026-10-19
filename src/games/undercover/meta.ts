import type { GameMeta } from '../types';
import image from '../../assets/games/undercover.webp';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'undercover',
  name: 'Undercover',
  tagline: 'Alle kennen das Wort. Eine Person nur einen Hinweis.',
  icon: 'eyeOff',
  accent: 'var(--indigo)',
  image,
  minPlayers: 4,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 2,
  tags: ['geheim', 'reden', 'handy-weg'],
  requiresOwnDevice: false,
  howTo: [
    'Jede Person schiebt ihre Karte hoch – online auf dem eigenen Handy, sonst reihum auf dem geteilten. Alle sehen das Wort, nur Undercover sieht stattdessen einen Hinweis und weiß, dass sie es ist.',
    'Reihum sagt jede Person einen Satz zum Wort, ohne es zu nennen. Undercover muss mitreden, als kenne sie es.',
    'Danach wird abgestimmt. Wer rausfliegt, trinkt. Fliegt Undercover auf, darf sie noch das Wort raten. Bleibt Undercover übrig, trinkt die ganze Runde.',
  ],
};
