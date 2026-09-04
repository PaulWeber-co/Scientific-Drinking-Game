import { createCardGame, type CardDef } from '../card-engine/createCardGame';
import { meta } from './meta';

/**
 * Bewusst ohne Bildschirmarbeit: Aufgaben, die in den Raum wirken.
 * `target: 'all'` = die ganze Runde trinkt, sonst nur die Person am Zug.
 */
const CARDS: CardDef[] = [
  { text: 'Alle, die heute schon auf Instagram waren: trinkt.', target: 'all', kicker: 'Gruppe', heat: 1 },
  { text: 'Alle mit weißen Sneakern: trinkt.', target: 'all', kicker: 'Gruppe', heat: 1 },
  { text: 'Der jüngste Mensch in der Runde: trink.', kicker: 'Gruppe', heat: 1 },
  { text: 'Alle Handys in die Mitte. Wessen Handy als erstes klingelt oder vibriert, trinkt doppelt.', target: 'all', kicker: 'Handy weg', heat: 1, sips: 4 },
  { text: 'Kategorie: Automarken. Reihum, wer hängt, trinkt.', target: 'all', kicker: 'Kette', heat: 1 },
  { text: 'Kategorie: Dinge im Kühlschrank. Reihum, wer hängt, trinkt.', target: 'all', kicker: 'Kette', heat: 1 },
  { text: 'Reihum zählen – aber jede Zahl mit einer 3 wird zu "Prost". Wer patzt, trinkt.', target: 'all', kicker: 'Kette', heat: 1 },
  { text: 'Alle stehen auf. Die letzte Person, die steht, trinkt.', target: 'all', kicker: 'Bewegung', heat: 1 },
  { text: 'Alle zeigen gleichzeitig auf die Person, die am häufigsten zu spät kommt. Meiste Finger: trinken.', target: 'all', kicker: 'Abstimmung', heat: 1 },
  { text: 'Handy-Amnestie: Wer sein Handy in der Hand hat, trinkt. Ab jetzt: alle Handys weg bis zur nächsten Karte.', target: 'all', kicker: 'Handy weg', heat: 1 },
  { text: 'Daumen-Duell: Du und die Person rechts von dir. Verlierer trinkt.', kicker: 'Duell', heat: 1 },
  { text: 'Du bist ab jetzt "Der Erzähler". Jedes Mal, wenn jemand "ich" sagt, trinkt diese Person. Gilt für 3 Runden.', kicker: 'Regel', heat: 2 },
  { text: 'Erfinde eine Regel, die bis zum Ende des Spiels gilt. Wer sie bricht, trinkt.', kicker: 'Regel', heat: 2 },
  { text: 'Staffellauf: Alle stehen auf und tauschen im Uhrzeigersinn den Platz. Letzter trinkt.', target: 'all', kicker: 'Bewegung', heat: 2 },
  { text: 'Wortkette ohne den Buchstaben "E". Wer ihn benutzt, trinkt.', target: 'all', kicker: 'Kette', heat: 2 },
  { text: 'Zeig auf die Person, die den besten Musikgeschmack hat. Wer die meisten Stimmen bekommt, verteilt 4 Schlucke.', target: 'all', kicker: 'Abstimmung', heat: 2 },
  { text: 'Alle die noch nie in einem anderen Land gearbeitet haben: trinkt.', target: 'all', kicker: 'Gruppe', heat: 2 },
  { text: 'Balanciere 30 Sekunden auf einem Bein, während die Runde dich ablenkt. Fallen = trinken.', kicker: 'Bewegung', heat: 2 },
  { text: 'Sprich für die nächsten 3 Runden mit Akzent. Aussetzer = trinken.', kicker: 'Regel', heat: 2 },
  { text: 'Blinzelduell mit der Person gegenüber. Verlierer trinkt.', kicker: 'Duell', heat: 2 },
  { text: 'Alle die schon mal etwas gekauft haben und es nie benutzt haben: trinkt. Und nennt es.', target: 'all', kicker: 'Gruppe', heat: 2 },
  { text: 'Handy-Roulette: Gib dein entsperrtes Handy nach links. Die Person darf 10 Sekunden scrollen – ohne etwas zu öffnen. Danach: alle trinken einmal.', target: 'all', kicker: 'Mut', heat: 3, sips: 2 },
  { text: 'Die Runde nennt eine Zahl zwischen 1 und 6. Du würfelst im Kopf (sag eine Zahl). Treffer: alle trinken. Kein Treffer: du trinkst doppelt.', kicker: 'Glück', heat: 3, sips: 5 },
  { text: 'Wahrheitsminute: Die Runde stellt dir 60 Sekunden lang Fragen. Jede Frage, die du nicht beantwortest, kostet einen Schluck.', kicker: 'Mut', heat: 3 },
  { text: 'Zeig auf die Person, die am schnellsten betrunken wird. Diese Person darf 6 Schlucke verteilen.', target: 'all', kicker: 'Abstimmung', heat: 3 },
  { text: 'Alle die heute noch fahren müssen: Hand hoch und Wasser holen. Alle anderen: trinkt.', target: 'all', kicker: 'Vernunft', heat: 1 },
  { text: 'Wasserrunde. Alle trinken ein Glas Wasser. Keine Ausreden.', target: 'all', kicker: 'Vernunft', heat: 1, sips: 0 },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Alle, die schon mal jemanden aus dieser Runde attraktiv fanden: trinkt. Namen bleiben geheim.', target: 'all', kicker: 'Gruppe', heat: 3, spicy: true },
  { text: 'Komplimente-Runde: Jede Person sagt der Person links etwas, das sie an ihr anziehend findet.', target: 'all', kicker: 'Reihum', heat: 3, spicy: true, sips: 0 },
  { text: 'Alle, die schon mal jemanden geküsst haben, den sie am nächsten Tag nicht mehr sehen wollten: trinkt.', target: 'all', kicker: 'Gruppe', heat: 3, spicy: true },
  { text: 'Zeigt gleichzeitig auf die Person mit dem besten Flirtblick. Meiste Finger: verteilt vier Schlucke.', target: 'all', kicker: 'Abstimmung', heat: 3, spicy: true },
  { text: 'Blickduell mit der Person gegenüber. 30 Sekunden, kein Lachen, kein Wegschauen. Wer zuerst blinzelt, trinkt.', kicker: 'Duell', heat: 3, spicy: true },
  { text: 'Alle, die aktuell für jemanden Gefühle haben: trinkt. Der Name ist freiwillig.', target: 'all', kicker: 'Gruppe', heat: 3, spicy: true },
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
