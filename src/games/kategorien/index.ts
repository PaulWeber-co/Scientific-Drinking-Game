import { createCardGame } from '../card-engine/createCardGame';
import type { CardDef } from '../card-engine/types';

/**
 * Reines Datenspiel: eine Kategorie, reihum ein Beispiel, wer hängt trinkt.
 * Zeigt, wie wenig ein neues Kartenspiel braucht – eine Datei, keine Komponente.
 */
const CARDS: CardDef[] = [
  { text: 'Automarken', heat: 1 },
  { text: 'Dinge im Kühlschrank', heat: 1 },
  { text: 'Pizzabeläge', heat: 1 },
  { text: 'Hauptstädte', heat: 1 },
  { text: 'Tiere mit Fell', heat: 1 },
  { text: 'Serien, die alle kennen', heat: 1 },
  { text: 'Dinge in einer Schultasche', heat: 1 },
  { text: 'Sportarten ohne Ball', heat: 1 },
  { text: 'Farben', heat: 1 },
  { text: 'Berufe ohne Büro', heat: 1 },
  { text: 'Marken für Sportschuhe', heat: 1 },
  { text: 'Dinge, die man einfriert', heat: 1 },
  { text: 'Deutsche Städte', heat: 1 },
  { text: 'Filme mit einem Wort im Titel', heat: 1 },
  { text: 'Dinge, die man auf ein Brot legt', heat: 1 },
  { text: 'Instrumente', heat: 1 },
  { text: 'Cocktails', heat: 2 },
  { text: 'Ausreden fürs Zuspätkommen', heat: 2 },
  { text: 'Dinge, die man niemals verleiht', heat: 2 },
  { text: 'Gründe, ein Date abzusagen', heat: 2 },
  { text: 'Dinge, die auf einer Party schiefgehen', heat: 2 },
  { text: 'Was man am Montag hasst', heat: 2 },
  { text: 'Dinge, die man in einer WG teilt', heat: 2 },
  { text: 'Apps auf deinem Handy', heat: 2 },
  { text: 'Peinliche Kindheitsmomente', heat: 3 },
  { text: 'Dinge, die man googelt und sofort löscht', heat: 3 },
  { text: 'Gründe, jemanden zu blockieren', heat: 3 },
  { text: 'Sätze, die eine Beziehung beenden', heat: 3 },
  { text: 'Dinge, die man nur betrunken sagt', heat: 3 },
  { text: 'Was in deinem Suchverlauf steht', heat: 3 },
];

export const kategorien = createCardGame({
  id: 'kategorien',
  name: 'Kategorien',
  tagline: 'Reihum ein Beispiel. Wer hängt, trinkt.',
  icon: 'brackets',
  accent: 'var(--mint)',
  minPlayers: 3,
  maxPlayers: 16,
  duration: '5-15 Min',
  intensity: 1,
  tags: ['handy-weg', 'schnell', 'reden'],
  howTo: [
    'Ein Handy in der Mitte reicht.',
    'Kategorie vorlesen, dann reihum ein Beispiel nennen – im Takt.',
    'Wer hängt, sich wiederholt oder patzt, trinkt.',
  ],
  actor: 'none',
  baseSips: 3,
  drink: 'self-declare',
  resolveLabel: 'Runde vorbei',
  heatSelectable: true,
  allowCustomCards: true,
  cards: CARDS,
});
