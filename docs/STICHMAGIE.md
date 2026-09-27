# Stichmagie

Ein Stichspiel für 3–10 Personen mit eigenen Handys, gebaut nach dem Vorbild des
bekannten Kartenspiels mit Zauberern und Narren – mit eigenem Namen, eigenen Karten und
eigenen Bildern. Die Karte, die alles sticht, heißt hier **Magier**.

Code: `src/games/stichmagie/` · Regeln ohne React: `rules.ts` · Ablauf: `game.ts` ·
Autopilot: `bot.ts` · Karten als SVG: `art.tsx`

## Grundspiel

- 60 Karten: vier Farben (Rot/Flamme, Blau/Welle, Grün/Blatt, Gelb/Sonne) mit den Werten
  1–13, vier Magier, vier Narren.
- Runde 1 hat eine Karte je Person, jede weitere eine mehr. Runden = 60 ÷ Personen
  (3 → 20, 4 → 15, 5 → 12, 6 → 10, 8 → 7, 10 → 6).
- Die nächste Karte vom Stapel bestimmt den Trumpf. Magier: der Geber wählt. Narr oder
  kein Stapel: kein Trumpf.
- Reihum links vom Geber sagt jede Person an, wie viele Stiche sie macht.
- Farbe bedienen ist Pflicht. Magier und Narren gehen immer. Der erste Magier gewinnt,
  sonst der höchste Trumpf, sonst die höchste Karte der Farbe; nur Narren: der erste Narr.
- Punkte: getroffen 20 + 10 je Stich, daneben −10 je Stich Abstand.

## Sonderkarten (einzeln oder per Voreinstellung zuschaltbar)

| Karte | Ausgabe | Wirkung |
|:--|:--|:--|
| Drache | 20 Jahre | Schlägt alles, auch Magier. Nur die Fee bezwingt ihn. |
| Fee | 20 Jahre | Niedriger als ein Narr – gewinnt aber, wenn der Drache im selben Stich liegt. |
| Bombe | 20 Jahre | Den Stich bekommt niemand. Wer die höchste Karte gelegt hat, spielt aus. |
| Werwolf | 20 Jahre | Wird vor der Ansage gegen die Trumpfkarte getauscht; wer ihn hat, bestimmt den Trumpf oder „kein Trumpf". |
| Jongleur | 20 Jahre | Wert 7½ in frei gewählter Farbe. Nach dem Stich gibt jede Person eine Karte nach links. |
| Wolke | 20 Jahre | Wert 9¾ in frei gewählter Farbe. Wer den Stich gewinnt, ändert die Ansage um ±1. |
| Gestaltwandler | 25 Jahre | Beim Ausspielen Magier oder Narr. |
| Hexe | 30 Jahre | Nach dem Stich eine Handkarte gegen eine Karte aus dem Stich tauschen (nicht die Hexe). |
| Vampir | 30 Jahre | Kopiert die aufgedeckte Trumpfkarte samt Effekten. |

Voreinstellungen: **Klassisch** (keine), **Jubiläum** (die sieben der 25-Jahre-Ausgabe,
Standard), **Alle 9** (plus Hexe und Vampir aus der 30-Jahre-Ausgabe).

Sonderkarten dürfen immer gelegt werden, auch wenn man bedienen könnte. Sie verlängern
das Spiel nicht – dafür gibt es auch in der letzten Runde eine Trumpfkarte.

### Wo die Regeln eine Lücke lassen – so entscheidet die App

- **Sonderkarte als Trumpfkarte:** Drache, Wolke, Werwolf (laut Regel) sowie Jongleur,
  Gestaltwandler und Vampir → der Geber wählt. Fee, Bombe und Hexe (laut Regel) → kein
  Trumpf.
- **Bombe ohne Farbkarte im Stich:** Rang für „höchste Karte" ist Narr > Fee > Hexe.
- **Wolke mit nur einer möglichen Richtung** (Ansage 0 oder = Kartenzahl): die App ändert
  sie ohne Rückfrage.
- **Reihenfolge nach dem Stich:** Wolke → Jongleur → Hexe (die Hexe handelt laut Regel
  zuletzt).
- **Vampir und Werwolf:** Liegt der Werwolf als Trumpfkarte, kopiert der Vampir die
  nächste Karte vom Stapel (so die Regel der 30-Jahre-Ausgabe).

## Optionale Regeln

- **Ansagen dürfen nicht aufgehen:** Die letzte Ansage darf die Summe nicht auf die
  Kartenzahl bringen.
- **Karte an der Stirn:** In Runden mit einer Karte sieht man alle Karten außer der
  eigenen.
- **Länge:** Kurz (bis zur Hälfte), Voll, Rauf & runter (1 … max … 1).

## Trinken

Nach jeder Runde trinkt, wer danebenlag – Härte 1 bis 3 je nach Abstand. Am Ende trinkt
der letzte Platz (Härte 3). Wie immer rechnet jedes Gerät die Menge selbst aus.

## Lobby-Robustheit

- Der Host sammelt fertige Stiche nach 2,3 s ein; hängt er, springt nach weiteren 6 s
  jedes Gerät ein (der Reducer nimmt nur das erste „Einsammeln" an).
- Ist jemand weg, erscheint bei allen „Für … übernehmen". Danach spielt der Autopilot
  (auf dem Host) für die Person, bis sie „Selbst weiterspielen" tippt.
- Wer mitten in der Partie dazukommt, schaut zu und ist bei „Noch eine Runde" dabei.
