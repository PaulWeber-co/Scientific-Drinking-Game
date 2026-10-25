import type { GameMeta } from '../types';
import image from '../../assets/games/wer-bin-ich.webp';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik, Komponente und Kategorien lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'wer-bin-ich',
  name: 'Wer bin ich',
  tagline: 'Alle wissen, wer du bist. Nur du nicht.',
  icon: 'person',
  accent: 'var(--orange)',
  image,
  world: '#2a1e06',
  ambient: { kind: 'glint', x: 0.5, y: 0.5 },
  minPlayers: 2,
  maxPlayers: 10,
  duration: '15-30 Min',
  intensity: 1,
  tags: ['reden', 'kreativ', 'geheim'],
  requiresOwnDevice: true,
  allowSpicy: true,
  allowCustomCards: true,
  howTo: [
    'Jede Person braucht ein eigenes Handy. Alle bekommen dieselbe Kategorie und stimmen ab: annehmen oder neu losen.',
    'Die App lost aus, wer für wen schreibt. Du denkst dir für deine Person einen Begriff aus der Kategorie aus – sie sieht ihn nicht, alle anderen schon.',
    'Reihum stellt ihr Ja-/Nein-Fragen, um euren eigenen Begriff zu erraten. Liegt jemand richtig, tippt irgendwer am Tisch bei ihm auf „Richtig".',
    'Wer als Erstes richtig liegt, verteilt Schlucke. Wer als Letztes übrig bleibt, trinkt.',
  ],
};
