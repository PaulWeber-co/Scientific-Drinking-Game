# Stichmagie: Spielerlebnis und erneute Prüfung

Stand: 19. Oktober 2026. Die Prüfung kombiniert Codeprüfung, reproduzierbare Fehlerfälle und Oberflächentests. Das ist keine Befragung echter Spieler. Zusätzliche Produktideen in diesem Bericht wurden nicht umgesetzt.

## Wie sich das Spiel für eine neue Runde anfühlt

Stichmagie hat einen nachvollziehbaren Kern: Hand ansehen, die eigene Stichzahl festlegen und danach genau diese Zahl treffen. Die Anzeige „gewonnen / angesagt“, das farbige Trumpfsymbol und der persönliche Hinweis „Dir fehlen noch …“ helfen während der Runde. Die Bedienpflicht wird tatsächlich geprüft; ein versehentlicher Tipp auf die falsche Farbe spielt keine unerlaubte Karte aus. Vor dem Legen muss ich eine ausgewählte Karte noch einmal bestätigen. Sonderkarten fragen nötige Entscheidungen an der passenden Stelle ab. Die Zwischenwertung verbindet Ansage, erreichte Stiche und Punktveränderung, der Punkteblock lässt frühere Runden nachschlagen.

Die eigenen Handys sind für die geheimen Karten richtig erklärt. Wer aussteigt oder kurz nicht erreichbar ist, blockiert den Tisch nicht dauerhaft: Andere können den ausdrücklich angebotenen Autopiloten starten, und die zurückkehrende Person kann selbst weiterspielen. Der Autopilot ersetzt keinen anspruchsvollen Gegner; er hält eine laufende Partie handlungsfähig.

Für Menschen, die Stichspiele kennen, ist das Spiel gut lesbar und bietet Abwechslung. Für Anfänger ist der Einstieg anspruchsvoll: Schon im Setup stehen neun Sonderkarten, drei Voreinstellungen, zwei Varianten und drei Längen zur Wahl. Außerdem setzt „Stich“, „Trumpf“ und „Bedienen“ bereits Regelwissen voraus. Das passt eher zu einer Gruppe, die sich auf ein längeres Kartenspiel einlässt, als zu einem kurzen Einstieg zwischen zwei Partyspielen.

## Gefundene und behobene Fehler

### Hostrechte waren nur in der Oberfläche geschützt

Der Gast sah zwar keine Startaktion und konnte die Sonderkarten nicht über die normalen Knöpfe ändern. Eine direkt an die Online-Inbox geschickte Aktion wie `preset` oder `deal` wurde jedoch trotzdem angenommen. Damit konnte ein Gast das gemeinsam angezeigte Setup ändern oder selbst austeilen. Der Reducer prüft jetzt für Sonderkarten, Voreinstellung, Regeln, Länge und Austeilen die aktuelle Hostkennung aus der Spielerliste. Nach einer Hostübernahme funktionieren die Aktionen für den neuen Host; ein alter Host erhält keine Sonderrechte.

### Fremde Ansagen und Handkarten konnten angenommen werden

Der Reducer kontrollierte die Phase, die Zugreihenfolge und den Kartenbesitz, verband diese Prüfung aber nicht mit dem sendenden Gerät. So konnte beispielsweise Ben eine Ansage mit `who: Anna` senden oder Annas Handkarte ausspielen. Auch Trumpfwahl, Wolkenentscheidung, Jongleur und Hexe waren betroffen. Jetzt müssen Absender und handelnde Person übereinstimmen. Der ausdrücklich freigegebene Autopilot bleibt nutzbar: Er handelt intern für eine abwesende Person und unterliegt weiterhin seiner bisherigen Freigabeprüfung.

Das ist eine Prüfung innerhalb der bestehenden App-Architektur. Sie ist keine serverseitige Abschirmung geheimer Hände gegenüber manipulierten Clients.

### Ein verzögerter Start konnte mit zwei Personen beginnen

Das Setup verlangt mindestens drei Personen; der Reducer ließ zwei zu. Verließ jemand nach der Anzeige des Startknopfs die Lobby, konnte eine noch eintreffende Austeilaktion eine Partie zu zweit starten. Die Mindestzahl wird jetzt unmittelbar beim Austeilen erneut mit drei Personen geprüft.

## Weiteres Feedback, noch nicht umgesetzt

| Priorität | Beobachtung aus Nutzersicht                                                                                                                                                                                        | Vorschlag                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoch      | In der Zwischenwertung kann jede Person sofort die nächste Runde austeilen. Jemand anderes kann noch den Punktestand lesen oder seine persönliche Trinkansage bestätigen. Es gibt keine gemeinsame Bereit-Anzeige. | Gemeinsam entscheiden, ob nur der Host weitergeht oder alle aktiven Personen ein einfaches „Bereit“ bestätigen. Bei Abwesenden muss der Tisch weiterkommen.    |
| Mittel    | „Klassisch“ ist vorhanden, aber die Vorgabe aktiviert sieben Sonderkarten. Anfänger müssen deren Bedeutung schon vor der ersten Hand einschätzen.                                                                  | Den bereits dokumentierten Einsteiger-Vorschlag aus UX-Punkt 13 entscheiden: eine klare Einsteigerempfehlung und zusätzliche Regeln als optionale Anpassungen. |
| Mittel    | Die Kartenhilfe erklärt Sonderkarten und Punkte, führt aber den Grundbegriff „Stich“ und ein einfaches Beispiel für Trumpf/Bedienen nicht Schritt für Schritt ein.                                                 | Eine kurze erste Beispielrunde oder ein jederzeit abrufbares Beispiel „Rot liegt, Rot bedienen; sonst darfst du abwerfen“ anbieten.                            |
| Mittel    | „Kurz“ bedeutet bei drei Personen immer noch zehn Runden mit insgesamt 55 Stichen. Die Rundenzahl steht im Setup; eine Zeitabschätzung für die ausgewählte Länge fehlt.                                            | Eine grobe Dauer passend zu Personenzahl und Länge zeigen. Eine zusätzliche schnelle Lernpartie wäre eine gesonderte Produktentscheidung.                      |
| Niedrig   | Ein fertiger Stich verschwindet nach 2,3 Sekunden. Für Anfänger kann das zu schnell sein, um Drache/Fee oder die Rangfolge nachzuvollziehen. Es gibt kein Stichprotokoll.                                          | Optional längere Anzeige oder „Letzten Stich ansehen“ entscheiden.                                                                                             |
| Niedrig   | Bei vielen Handkarten bleibt der Fächer kompakt. Auf schmalen Geräten sind die sichtbaren seitlichen Trefferflächen kleiner als die eigentliche Kartenfläche; die zweite Bestätigung hilft gegen Fehlgriffe.       | Nach einer echten Runde auf kleinen Geräten entscheiden, ob eine vergrößerte ausgewählte Karte oder eine alternative Handansicht sinnvoll ist.                 |

Das absichtliche Beenden einer laufenden Online-Partie über die gemeinsame Spielnavigation und die Frage, wer die nächste Partie startet, sollten zusammen mit den allgemeinen Lobbyregeln beurteilt werden. In diesem Auftrag wurde dafür kein neuer Bestätigungsablauf eingeführt.

## Prüfung und Grenzen

- `npm test -- src/games/stichmagie`: 54 Tests erfolgreich. Darin enthalten: 96 vollständige Partien mit drei bis zehn Personen und drei Kartenvoreinstellungen, weitere vollständige Autopilot-Partien sowie eine komplette Partie über die Oberfläche.
- ESLint für die geänderte Spiellogik und ihre Regressionstests sowie `git diff --check` erfolgreich.
- Neue Regressionen wurden zunächst gegen den alten Stand ausgeführt und schlugen für alle drei beschriebenen Fehlergruppen fehl.
- Die bestehenden vollständigen Partien prüfen klassische Regeln sowie alle Sonderkarten mit drei bis zehn Personen. Dabei werden gleiche Handgrößen, eindeutige Karten, richtige Wertung, erreichbarer nächster Zug und ein tatsächliches Partieende kontrolliert.
- Die bestehenden Oberflächentests führen eine komplette Partie über die sichtbaren Knöpfe aus, prüfen Host/Gast-Setup, Bedienpflicht und Übernahme bei Abwesenheit.
- „Offline“ ist bei diesem Spiel kein gemeinsames Gerät: Die Oberfläche erklärt, dass jede Person ihr eigenes Handy benötigt. Der Autopilot ist die Übernahme für abwesende Online-Mitspieler.
- Native Haptik, gesperrte echte Handys und das Spielerlebnis einer anwesenden Gruppe sind durch diese automatisierte Prüfung nicht abgedeckt. Die Zeit- und Lernkurveneinschätzung ist eine Review-Einschätzung aus den implementierten Abläufen.
