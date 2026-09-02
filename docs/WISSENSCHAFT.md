# Die Berechnung

Alle Formeln stehen in `src/engine/`, die Tests dazu in `src/engine/bac.test.ts`.

## 1. Verteilungsfaktor r

Widmark beschreibt den Körper als Raum, in dem sich Alkohol verteilt:

```
BAC [‰] = A / (r · W)      A = reiner Alkohol [g], W = Gewicht [kg]
```

Ohne Körpergröße nutzen wir die üblichen Tabellenwerte (m 0,68 / w 0,55 / divers 0,615).

Mit Körpergröße wird es individueller. Das Körperwasser nach **Watson et al. (1980)**:

```
Männer:  TBW = 2,447 − 0,09516·Alter + 0,1074·Größe + 0,3362·Gewicht
Frauen:  TBW = −2,097 + 0,1069·Größe + 0,2466·Gewicht
```

Alkohol verteilt sich im Körperwasser, Vollblut besteht zu 80,6 % aus Wasser. Daraus:

```
r = TBW / Gewicht / 0,806
```

Der Wert wird auf 0,45–0,85 begrenzt, damit extreme BMI-Eingaben keinen Unsinn erzeugen.
Bei „divers" wird zwischen beiden Formeln gemittelt.

## 2. Resorption — warum reines Widmark hier nicht reicht

Die Widmark-Formel unterstellt, dass Alkohol sofort im Blut ist. Für eine App, die alle paar
Minuten entscheidet „trink noch etwas", ist das gefährlich falsch: direkt nach einem Shot
wäre der angezeigte Wert zu hoch, zehn Minuten später zu niedrig — und die App würde
nachschenken lassen, während der Shot noch wirkt.

Deshalb steigt jeder Drink exponentiell ins Blut:

```
resorbiert(t) = 1 − e^(−t/τ)
τ = 14 min (leerer Magen) | 22 min (Snack) | 32 min (satt)
```

Die τ-Werte sind am **Zeitpunkt des Maximums** kalibriert, nicht frei gewählt: die Literatur
nennt 30–60 Minuten nüchtern und 60–90 Minuten nach dem Essen. Genau dort liegt mit diesen
Werten auch das Maximum des Modells (`__verify.test.ts` prüft das gegen die geschlossene
Lösung t\* = τ · ln(A / (V · τ · β)) ).

Die Simulation läuft in Minutenschritten: pro Schritt wird der neu resorbierte Alkohol
addiert und gleichzeitig linear abgebaut. Der Abbau greift nur, solange etwas im Blut ist.
Statt in jedem Schritt über alle Drinks zu summieren, führt `estimateBac` den noch nicht
resorbierten Rest als eine Zahl mit — mathematisch identisch, aber in O(Minuten + Drinks)
statt O(Minuten · Drinks). Ein langer Abend kostet dadurch Millisekunden statt einer halben
Sekunde pro Berechnung.

Zusätzlich wird ein **Resorptionsdefizit von 10 %** angesetzt — ein Teil des Alkohols
erreicht das Blut durch den First-Pass-Metabolismus nie.

## 3. Zwei Abbauraten

| Zweck | β | Warum |
|:--|:--|:--|
| Live-Anzeige, Schluckberechnung | 0,15 ‰/h | Literaturmittel |
| „Nüchtern um", Fahr-Check | **0,10 ‰/h**, Resorptionsdefizit 0 % | Unteres Ende der Bandbreite. Der Fehler geht in die sichere Richtung: die App sagt eher zu spät „nüchtern" als zu früh. |

Grün gibt es beim Fahr-Check erst bei rechnerisch **0,00 ‰** — nicht bei 0,5 und auch nicht
bei 0,3.

## 4. Von der Spielansage zur persönlichen Schluckzahl

`personalSips()` in `src/engine/sips.ts`:

```
effektiv  = aktueller BAC + noch nicht resorbierter Alkohol
kopfraum  = Zielpegel − effektiv
bedarfG   = kopfraum · r · Gewicht / 0,9      ← zu *trinkende* Gramm
tempoG    = 0,09 ‰ · r · Gewicht / 0,9 · Härte
Schlucke  = round(min(bedarfG, tempoG, Notbremse) / Alkohol pro Schluck)
```

Zwei Details, die leicht falsch laufen:

**Getrunken ≠ resorbiert.** Vom Resorptionsdefizit (10 %) erreicht ein Teil das Blut nie.
`kopfraum · r · Gewicht` sind die Gramm, die *ankommen* müssen — getrunken werden müssen
darum `/ 0,9` mehr. Ohne diese Division dosiert die App systematisch 10 % zu wenig.

**Lücke schließen, Tempo begrenzen — nicht umgekehrt.** Eine Regel wie „gib pro Ansage ein
Drittel der Lücke aus" ist ein Proportionalregler und erreicht das Ziel nie, weil zwischen
zwei Ansagen weiter abgebaut wird. Deshalb rechnet die App die **ganze** Lücke und deckelt
stattdessen den Anstieg pro Ansage (`MAX_RISE_PER_TURN`, 0,09 ‰). Die Spielhärte skaliert
diesen Deckel: eine milde Ansage steigt langsamer, eine Strafe schneller.

Sicherungen darüber:

1. `kopfraum ≤ 0` → **0 Schlucke**, Hinweis „Pegel sitzt, du darfst aussetzen".
2. **Notbremse**: Nie so viel, dass der harte Deckel von **0,8 ‰** gerissen wird —
   unabhängig davon, was das Spiel ansagt.
3. Maximal 6 Schlucke pro Ansage.
4. Grobe Einheiten: Ein ganzer Shot ist größer als das Tempolimit einer einzelnen Ansage.
   Damit Shot-Trinker nicht dauerhaft leer ausgehen, ist ein einzelner Shot erlaubt, sobald
   mindestens ein halber gebraucht wird **und** die Notbremse ihn zulässt.

Weil gegen `effektiv` (inklusive Magen) dosiert wird, pendelt sich der tatsächliche Pegel
etwas **unter** dem Ziel ein. Das ist Absicht — die Abweichung geht in die sichere Richtung.
Eine Simulation über vier Stunden landet bei Zielpegel 0,40 ‰ tatsächlich bei 0,32–0,36 ‰.

## 4a. Woher wir wissen, dass die Rechnung stimmt

`src/engine/__verify.test.ts` prüft die Engine nicht gegen sich selbst, sondern gegen die
**geschlossene Lösung** derselben Differentialgleichung:

```
BAC(t) = A/V · (1 − e^(−t/τ)) − β · t
```

Geprüft werden: Kurvenverlauf mit und ohne Abbau (Abweichung < 0,006 ‰), der analytische
Zeitpunkt des Maximums, die Widmark-Asymptote, Massenerhaltung (`bac + pending` entspricht
exakt der getrunkenen Menge geteilt durch das Verteilungsvolumen), die Watson-Formel auf
sechs Nachkommastellen und die Nüchternzeit. `src/engine/__sim.test.ts` hält zusätzlich die
schnelle inkrementelle Simulation und die naive Referenzrechnung über zufällige Abende
deckungsgleich.

## 5. Altersregelung

| Alter | Verhalten |
|:--|:--|
| unter 16 | Kein Zugang |
| 16–17 | Voller Zugang zu allen Spielen, aber alkoholfreier Modus erzwungen — statt Schlucken gibt es Aufgaben |
| ab 18 | Voller Funktionsumfang |

Die Angabe erfolgt auf Vertrauensbasis, ohne Ausweisprüfung.

## Grenzen

Die Widmark-Formel wurde an einer kleinen Stichprobe entwickelt. Reale Einzelwerte streuen
erheblich: Medikamente, Leberfunktion, Trinkgewöhnung, Schlafmangel, Krankheit und
Tagesform verändern sowohl Resorption als auch Abbau. Ein Rechenmodell ist kein Messgerät.
Die App ist als Bremse gebaut, nicht als Freibrief.
