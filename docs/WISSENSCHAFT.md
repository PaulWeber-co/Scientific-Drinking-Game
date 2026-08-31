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
τ = 9 min (leerer Magen) | 16 min (Snack) | 26 min (satt)
```

Die Simulation läuft in Minutenschritten: pro Schritt wird der neu resorbierte Alkohol
addiert und gleichzeitig linear abgebaut. Der Abbau greift nur, solange etwas im Blut ist.

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
effektiv   = aktueller BAC + noch nicht resorbierter Alkohol
kopfraum   = Zielpegel − effektiv
fehlendeG  = kopfraum · r · Gewicht
rohSchluck = fehlendeG / Alkohol pro Schluck
Schlucke   = round(rohSchluck / 3 · Spielhärte / 3)
```

Vier Sicherungen greifen darüber:

1. `kopfraum ≤ 0` → **0 Schlucke**, Hinweis „Pegel sitzt, du darfst aussetzen".
2. `rohSchluck < 0,35` → **0 Schlucke** statt Aufrunden. Verhindert, dass ein Shot-Trinker
   für 0,4 g Restbedarf einen ganzen Shot bekommt.
3. Harter Deckel bei **0,8 ‰**: mehr wird nie ausgegeben, egal was das Spiel sagt.
4. Maximal 6 Schlucke pro Ansage.

Weil gegen `effektiv` (inklusive Magen) dosiert wird, pendelt sich der tatsächliche Pegel
etwas **unter** dem Ziel ein. Das ist Absicht — die Abweichung geht in die sichere Richtung.

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
