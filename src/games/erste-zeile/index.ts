import { createCardGame } from '../card-engine/createCardGame';
import type { CardDef } from '../card-engine/types';
import { meta } from './meta';

/**
 * Musikquiz ohne Streaming und ohne Lizenzfragen: eine Person singt oder
 * summt die erste Zeile, die Runde rät.
 */
const CARDS: CardDef[] = [
  { text: 'Ein Song, den auf jeder Hochzeit alle mitsingen', heat: 1 },
  { text: 'Ein Sommerhit, den du nicht mehr hören kannst', heat: 1 },
  { text: 'Ein Song aus deiner Kindheit', heat: 1 },
  { text: 'Eine deutsche Schlagernummer', heat: 1 },
  { text: 'Der erste Song in deiner Lieblingsplaylist', heat: 1 },
  { text: 'Ein Song, den deine Eltern hören', heat: 1 },
  { text: 'Ein Filmsoundtrack', heat: 1 },
  { text: 'Eine Weihnachtsnummer – egal welcher Monat', heat: 1 },
  { text: 'Ein Song mit einem Namen im Titel', heat: 1 },
  { text: 'Ein Song, den man nur grölen kann', heat: 1 },
  { text: 'Ein Song, der auf jeder Klassenfahrt lief', heat: 1 },
  { text: 'Ein Song, den du im Auto immer lauter drehst', heat: 1 },
  { text: 'Eine Titelmelodie aus einer Zeichentrickserie', heat: 1 },
  { text: 'Ein Song mit einer Stadt im Titel', heat: 1 },
  { text: 'Ein Song, den man beim Putzen hört', heat: 1 },
  { text: 'Ein Fußball- oder Stadionsong', heat: 1 },
  { text: 'Ein Song, der über zehn Jahre alt ist und immer noch läuft', heat: 1 },
  { text: 'Ein Song, bei dem alle die Hände heben', heat: 1 },
  { text: 'Ein Song aus den Charts von letzter Woche', heat: 1 },
  { text: 'Ein Song mit einer Zahl im Titel', heat: 1 },
  { text: 'Ein Rap-Song – Text zählt, Flow ist optional', heat: 2 },
  { text: 'Ein Song, den du heimlich liebst', heat: 2 },
  { text: 'Ein Song aus einer Serie', heat: 2 },
  { text: 'Ein Song, zu dem du das letzte Mal getanzt hast', heat: 2 },
  { text: 'Eine Ballade, die dich mal zum Heulen gebracht hat', heat: 2 },
  { text: 'Ein Song, der auf jeder Studentenparty läuft', heat: 2 },
  { text: 'Ein Song aus dem Jahr deiner Geburt', heat: 2 },
  { text: 'Ein Song in einer Sprache, die du nicht sprichst', heat: 2 },
  { text: 'Dein persönlicher Karaoke-Song', heat: 3 },
  { text: 'Ein Song, den du mal jemandem gewidmet hast', heat: 3 },
  { text: 'Der peinlichste Song in deiner Mediathek', heat: 3 },
  { text: 'Ein Song, der dich an deinen Ex erinnert', heat: 3 },
];

export const ersteZeile = createCardGame({
  ...meta,
  actor: 'turn',
  cardKicker: 'Sing die erste Zeile',
  baseSips: 3,
  drink: 'none',
  resolveLabel: 'Erraten',
  refuseLabel: 'Keiner wusste es',
  refuseSips: 3,
  // Die Anleitung verspricht, dass der schnellste Rater raus ist. Ohne diese
  // Auswahl war das Spiel praktisch trinkfrei: getrunken wurde nur, wenn
  // niemand den Song kannte.
  pickWinner: {
    prompt: 'Wer hatte den Song zuerst?',
    label: 'zu langsam',
    sips: 2,
  },
  heatSelectable: true,
  cards: CARDS,
});
