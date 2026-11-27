import type { GameMeta } from '../types';
import image from '../../assets/games/undercover.webp';

/** Bleibt im Haupt-Bundle: Übersicht, Filter und Lobby lesen nur das.
 *  Logik und Komponente lädt die Registry erst beim Spielstart. */
export const meta: GameMeta = {
  id: 'undercover',
  name: 'Undercover',
  tagline: 'Eine oder mehrere Personen kennen nur einen Hinweis. Der Rest kennt das Wort.',
  icon: 'eyeOff',
  accent: 'var(--indigo)',
  image,
  world: '#0d1922',
  ambient: { kind: 'lamp', x: 0.69, y: 0.06 },
  minPlayers: 4,
  maxPlayers: 12,
  duration: '15-30 Min',
  intensity: 2,
  tags: ['geheim', 'reden', 'handy-weg'],
  requiresOwnDevice: false,
  howTo: [
    'Schiebt eure Karte hoch. Online schaut ihr auf dem eigenen Handy, am Tisch reihum. Eine oder mehrere Personen sind Undercover und sehen denselben Hinweis. Sie erfahren die Anzahl und halten ihre Rollen geheim. Alle anderen sehen das Wort.',
    'Reihum sagt jede Person einen Satz zum Wort, ohne es zu nennen. Wer Undercover ist, redet mit und blufft.',
    'Stimmt ab, wer rausfliegt. Wer dabei als Undercover auffliegt, darf das Wort raten. Bei einem Treffer gewinnt das Undercover-Team.',
    'Sobald mindestens so viele Undercover wie Gruppenmitglieder übrig sind, gewinnt das Undercover-Team und die Gruppe trinkt. Sind alle Undercover raus und hat niemand das Wort erraten, gewinnt die Gruppe.',
  ],
};
