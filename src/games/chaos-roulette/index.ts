import { createCardGame, type CardDef } from '../card-engine/createCardGame';
import { meta } from './meta';

/**
 * Bewusst ohne Bildschirmarbeit: Aufgaben, die in den Raum wirken.
 * `target: 'all'` = die ganze Runde trinkt, sonst nur die Person am Zug.
 *
 * Das Modell kennt keine Teilmenge: eine `target: 'all'`-Karte muss ihre
 * Ansage deshalb auch wörtlich an „alle"/„die Runde" richten (jede Person
 * bekommt sonst einen Knopf, den der Text ihr gar nicht zuspricht), und eine
 * Karte ohne `target` darf keinen anderen, dem Spiel unbekannten Namen als
 * Zielperson versprechen (etwa „die jüngste Person" oder „der Verlierer"
 * eines Duells mit offenem Ausgang) – sonst trifft die Ansage die Person am
 * Zug statt der im Text genannten. Siehe Testdatei für beide Muster.
 */
export const CARDS: CardDef[] = [
  { text: 'Wer heute schon auf Instagram war, outet sich kurz. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Gruppe', heat: 1 },
  { text: 'Wer weiße Sneaker trägt, zeigt sie kurz her. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Gruppe', heat: 1 },
  { text: 'Findet die jüngste Person in der Runde. Die Runde trinkt auf sie.', target: 'all', kicker: 'Gruppe', heat: 1 },
  { text: 'Alle Handys in die Mitte, laut gestellt. Klingelt oder vibriert eins: die ganze Runde trinkt.', target: 'all', kicker: 'Handy weg', heat: 1 },
  { text: 'Kategorie: Automarken. Reihum nennen, bis jemand hängt. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Kette', heat: 1 },
  { text: 'Kategorie: Dinge im Kühlschrank. Reihum nennen, bis jemand hängt. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Kette', heat: 1 },
  { text: 'Reihum zählen – aber jede Zahl mit einer 3 wird zu "Prost". Patzt jemand, trinkt die ganze Runde.', target: 'all', kicker: 'Kette', heat: 1 },
  { text: 'Alle stehen möglichst gleichzeitig auf. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Bewegung', heat: 1 },
  { text: 'Alle zeigen gleichzeitig auf die Person, die am häufigsten zu spät kommt. Die Runde trinkt auf sie.', target: 'all', kicker: 'Abstimmung', heat: 1 },
  { text: 'Handy-Amnestie: Alle trinken einen Schluck, dann sind ab jetzt alle Handys tabu – bis zur nächsten Karte.', target: 'all', kicker: 'Handy weg', heat: 1 },
  { text: 'Daumen-Duell: Du gegen die Person rechts von dir. Verlierst du, trinkst du.', kicker: 'Duell', heat: 1 },
  { text: 'Du bist ab jetzt "Der Erzähler". Wer für die nächsten 3 Runden "ich" sagt, trinkt. Als Auftakt trinkt jetzt die ganze Runde.', target: 'all', kicker: 'Regel', heat: 2 },
  { text: 'Erfinde eine Regel, die bis zum Ende des Spiels gilt. Wer sie bricht, trinkt. Zum Besiegeln trinkt jetzt die ganze Runde.', target: 'all', kicker: 'Regel', heat: 2 },
  { text: 'Staffellauf: Alle stehen auf und tauschen im Uhrzeigersinn den Platz. Sobald alle sitzen, trinkt die ganze Runde.', target: 'all', kicker: 'Bewegung', heat: 2 },
  { text: 'Wortkette ohne den Buchstaben "E". Fällt jemandem der Buchstabe raus, trinkt die ganze Runde.', target: 'all', kicker: 'Kette', heat: 2 },
  { text: 'Zeig auf die Person, die den besten Musikgeschmack hat. Die Runde prostet ihr zu – alle trinken.', target: 'all', kicker: 'Abstimmung', heat: 2 },
  { text: 'Wer schon mal im Ausland gearbeitet hat, erzählt kurz davon. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Gruppe', heat: 2 },
  { text: 'Balanciere 30 Sekunden auf einem Bein, während die Runde dich ablenkt. Fallen = trinken.', kicker: 'Bewegung', heat: 2 },
  { text: 'Sprich für die nächsten 3 Runden mit Akzent. Aussetzer = trinken.', kicker: 'Regel', heat: 2 },
  { text: 'Blinzelduell mit der Person gegenüber. Verlierst du, trinkst du.', kicker: 'Duell', heat: 2 },
  { text: 'Wer schon mal etwas gekauft und nie benutzt hat, nennt es kurz. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Gruppe', heat: 2 },
  { text: 'Handy-Roulette: Gib dein entsperrtes Handy nach links. Die Person darf 10 Sekunden scrollen – ohne etwas zu öffnen. Danach: alle trinken einmal.', target: 'all', kicker: 'Mut', heat: 3, sips: 2 },
  { text: 'Nenne sofort eine Zahl zwischen 1 und 6, als hättest du gewürfelt. Ob sie stimmt oder nicht: du trinkst doppelt.', kicker: 'Glück', heat: 3, sips: 5 },
  { text: 'Wahrheitsminute: Die Runde stellt dir 60 Sekunden lang Fragen. Jede Frage, die du nicht beantwortest, kostet einen Schluck.', kicker: 'Mut', heat: 3 },
  { text: 'Zeig auf die Person, die am schnellsten betrunken wird. Die Runde trinkt ihr zu.', target: 'all', kicker: 'Abstimmung', heat: 3 },
  { text: 'Vernunft-Check: Wer heute noch fährt, sagt es jetzt laut und holt sich ein Wasser. Die Runde stößt darauf an.', target: 'all', kicker: 'Vernunft', heat: 1 },
  { text: 'Wasserrunde. Alle trinken ein Glas Wasser. Keine Ausreden.', target: 'all', kicker: 'Vernunft', heat: 1, sips: 0 },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Wer schon mal jemanden aus dieser Runde attraktiv fand, hebt die Hand – Namen bleiben geheim. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Gruppe', heat: 3, spicy: true },
  { text: 'Komplimente-Runde: Jede Person sagt der Person links etwas, das sie an ihr anziehend findet.', target: 'all', kicker: 'Reihum', heat: 3, spicy: true, sips: 0 },
  { text: 'Wer schon mal jemanden geküsst hat, den sie oder er danach nicht mehr sehen wollte, hebt die Hand. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Gruppe', heat: 3, spicy: true },
  { text: 'Zeigt gleichzeitig auf die Person mit dem besten Flirtblick. Die Runde trinkt auf sie.', target: 'all', kicker: 'Abstimmung', heat: 3, spicy: true },
  { text: 'Blickduell mit der Person gegenüber. 30 Sekunden, kein Lachen, kein Wegschauen. Blinzelst du zuerst, trinkst du.', kicker: 'Duell', heat: 3, spicy: true },
  { text: 'Wer gerade für jemanden Gefühle hat, hebt die Hand – der Name ist freiwillig. Danach trinkt die ganze Runde.', target: 'all', kicker: 'Gruppe', heat: 3, spicy: true },
  { text: 'Nenne die drei Eigenschaften, die dich an einem Menschen sofort umhauen.', kicker: 'Mut', heat: 3, spicy: true, sips: 0 },
];

export const chaosRoulette = createCardGame({
  ...meta,
  actor: 'turn',
  baseSips: 3,
  drink: 'actor',
  resolveLabel: 'Erledigt',
  heatSelectable: true,
  cards: CARDS,
});
