# UX-Feedback zur App

Hinweis zur Zusammenführung: Diese Liste dokumentiert den ursprünglichen Review-Stand. Der anschließend integrierte Kollegen-Stand aus PR #34 verbessert bereits mehrere der hier beschriebenen Abläufe, darunter den schnellen Getränkeeinstieg, sichtbare Mengen und den Album-Abschluss. Die ursprünglichen Beobachtungen bleiben zur Nachvollziehbarkeit erhalten.

Stand: 19. Oktober 2026. Diese Punkte sind Vorschläge zur Entscheidung; an den beschriebenen Produktabläufen wurde für dieses Review nichts geändert. Grundlage ist ein Durchgang durch die implementierten Einstiegs-, Spiele-, Lobby-, Pegel- und Kameraflows im Quellcode. Das ist keine Befragung echter Nutzer. Reproduzierbare Funktionsfehler wurden separat zur Behebung gemeldet und stehen nicht als offene Designwünsche in dieser Liste.

## Zuerst entscheiden

### 1. Zwei gleiche Getränkesymbole lösen verschiedene Aktionen aus

**Priorität: hoch.** Im laufenden Spiel zeigt die Kopfzeile direkt nebeneinander zweimal das Symbol des aktuellen Getränks: Das erste trägt ein volles Glas ein, das zweite öffnet die Einstellungen. Bei Bier sind das beispielsweise zwei Bierkrüge. Die unterschiedlichen Screenreader-Beschriftungen helfen sehenden Nutzern beim Unterscheiden nicht.

**Nutzersituation:** Ich will nachsehen, was eingestellt ist, und tippe auf den falschen Krug. Damit verändere ich bereits mein Trink-Log und die nächste Berechnung. Rückgängig ist vorhanden, setzt aber voraus, dass ich den Fehlgriff bemerke.

**Vorschlag:** Für die Einstellungen ein eindeutiges Zahnrad verwenden; die Buchungsaktion als „+ Glas“ oder sichtbar mit Plus kennzeichnen. Den erweiterten Eintrag zusätzlich per sichtbarer Aktion anbieten. Ohne lokale Gäste gibt es für ein anderes Getränk oder eine andere Menge derzeit nur den nicht erklärten langen Druck.

**Beleg:** `src/games/shared/GameFrame.tsx`, `GlassButton.tsx` und `GameSettings.tsx`.

### 2. Ein „ganzes“ Getränk hat keine sichtbare Größe

**Priorität: hoch.** Beim manuellen Eintragen wähle ich „Halbes“, „Ganzes“ oder „Zwei“ und anschließend ein Getränk. Auf den Kacheln steht nur dessen Name. Die zugrunde gelegte Glasgröße und Stärke sehe ich vor der Buchung nicht. Pils bedeutet beispielsweise 330 ml, Helles 500 ml und Weißwein 200 ml. Ein 500-ml-Pils ist mit der angebotenen Auswahl nicht genau erfassbar.

**Nutzersituation:** Ich trage meine 0,5-l-Flasche Pils als „Ganzes“ ein. Die App nimmt 0,33 l an; die Anzeige wirkt für mich trotzdem richtig. Bei Cocktails und Longdrinks sind zudem Stärke und Füllmenge weniger selbstverständlich als der Name.

**Vorschlag:** Menge und Stärke auf der Eintragskachel zeigen, zum Beispiel „Pils · 0,33 l · 5 %“, und eine kleine Auswahl typischer Größen oder eine eigene Menge anbieten. Die schnelle Buchung kann erhalten bleiben.

**Beleg:** `src/games/shared/LogDrinkSheet.tsx`; Standardgrößen in `src/engine/drinks.ts`.

### 3. Alkoholfreier Einstieg wird erst nach dem Onboarding auffindbar

**Priorität: hoch.** Ein erwachsener neuer Nutzer durchläuft Körperdaten, Magenzustand, alkoholisches Getränk und Zielpegel. Eine Auswahl „alkoholfrei“ oder „Ich fahre“ gibt es im Onboarding nicht; beide Optionen stehen später im Profil und in den Spieleinstellungen. Selbst bei 16- und 17-Jährigen entfallen zwar Getränk und Ziel, Körperdaten und Magen werden aber weiterhin abgefragt.

**Nutzersituation:** Ich möchte als Fahrer einfach mitspielen. Der Einstieg vermittelt mir zunächst, dass die App einen Alkoholpegel für mich planen will und dafür persönliche Daten benötigt. Die vorhandene alkoholfreie Funktion erkenne ich dabei nicht.

**Vorschlag:** Früh zwischen „mit Alkohol“, „alkoholfrei“ und „Ich fahre“ wählen lassen. Nur die für den gewählten Modus erforderlichen Fragen zeigen und die Entscheidung später änderbar halten.

**Beleg:** `src/features/onboarding/Onboarding.tsx`, `src/features/settings/ProfileScreen.tsx`.

## Danach verbessern

### 4. Dieselbe Spielkachel verhält sich je nach Tab anders

**Priorität: mittel.** Im Tab „Spiele“ öffnet die Kachel die Detailseite. Unter „Passt zu euch“ in der Runde startet dieselbe Kachel sofort das Spiel. Eine sichtbare Kennzeichnung für den Sofortstart fehlt.

**Nutzersituation:** Ich habe gelernt, dass ich über ein Bild die Regeln und Optionen ansehen kann. In der Lobby tippe ich nun auf ein unbekanntes Spiel, um es kennenzulernen, und starte damit bereits die Runde.

**Vorschlag:** Kacheln einheitlich zur Detailseite führen oder den Sofortstart mit einer ausdrücklichen „Starten“-Aktion kenntlich machen. Für eine Gruppe, die ein Spiel bereits kennt, könnte ein eigener Schnellstart erhalten bleiben.

**Beleg:** `src/features/games/GamesScreen.tsx` und `src/features/lobby/LobbyScreen.tsx`.

### 5. Unbekannte Spiele erklären ihren Grundgedanken erst hinter dem Info-Symbol

**Priorität: mittel.** Die Detailseite besteht sichtbar vor allem aus großem Bild, Titel, Einstellchips und Startknopf. Kurzbeschreibung, Dauer und Regeln liegen vollständig im Info-Sheet. Gerade bei eigenen Namen wie „Erste Zeile“, „Lückenfüller“ oder „Stichmagie“ verrät der Titel allein wenig über die Aktivität.

**Nutzersituation:** Wir suchen etwas Kreatives für zehn Minuten. Ich öffne mehrere Spiele und muss bei jedem zusätzlich das kleine Info-Symbol finden, bevor ich sie vergleichen kann.

**Vorschlag:** Den bereits vorhandenen `tagline`-Text und die Spieldauer direkt unter Titel oder Bild zeigen. Die ausführlichen Regeln können im Sheet bleiben.

**Beleg:** `GameDetail` in `src/features/games/GamesScreen.tsx`; Beschreibungen und Dauer existieren bereits in den jeweiligen `meta.ts`-Dateien.

### 6. Der häufige Weg „Drink eintragen“ liegt im Pegel-Tab weit unten

**Priorität: mittel.** Vor dem Trink-Log und dessen Eintragsbutton liegen Pegelanzeige, gegebenenfalls Fahrerkarte, vier Statistikfelder, Verlauf sowie die komplette Fahrtauglichkeitskarte. Mitspieler können zwar auch in der Runde etwas eintragen; der Pegel-Tab selbst bietet die naheliegende Routineaktion aber erst hinter den Auswertungen an.

**Nutzersituation:** Ich schaue auf meinen aktuellen Pegel und möchte direkt mein eben getrunkenes Glas ergänzen. Dafür muss ich an Rechenfaktor, Prognose und Fahrtzeit vorbei scrollen.

**Vorschlag:** Den Eintragsbutton direkt unter der Pegelanzeige anbieten und den ausführlichen Log weiter unten lassen. Technische Angaben wie der Verteilungsfaktor könnten in eine aufklappbare Erklärung wandern.

**Beleg:** Reihenfolge in `src/features/bac/PegelScreen.tsx`.

### 7. Vor dem ersten Spiel erklärt das Album nicht, wie ich die Kamera starte

**Priorität: mittel.** Das Album zeigt „Foto machen“ nur, wenn bereits ein Abend läuft. Ein Abend entsteht durch einen Spielstart oder einen ersten Trinkeintrag. Wer nach dem Onboarding zuerst das Album öffnet, sieht nur den Hinweis, dass noch kein Bild geschossen wurde. Eine Handlung zum Starten des Films oder eine Erklärung der Voraussetzung gibt es dort nicht.

**Nutzersituation:** Ich entdecke die Einwegkamera und möchte zum Ankommen ein Gruppenbild machen. Der Tab sagt mir, dass keine Bilder da sind, bietet aber keine Kamera an. Ich weiß nicht, dass ich erst spielen oder ein Getränk eintragen muss.

**Vorschlag:** Im leeren Album „Abend und Film starten“ anbieten oder die Voraussetzung mit einem direkten Weg zum Start erklären. Der Film sollte auch für einen alkoholfreien Fotoabend verständlich nutzbar sein.

**Beleg:** `src/features/camera/AlbumScreen.tsx`, `src/features/camera/useFilmStatus.ts`, `beginNight` in `src/store/player.ts`.

### 8. Bilder mit Wartezeit zeigen den Freischaltzeitpunkt nicht

**Priorität: mittel.** Noch nicht entwickelte Bilder sind leere Rahmen mit einem Uhrsymbol. Weder am Rahmen noch in der Filmübersicht steht ein konkreter Freischaltzeitpunkt. Die Einstellung nennt nur „Morgen früh“ oder eine Stundenzahl ab Abendbeginn. Die Uhrzeit existiert mit `Photo.developAt` bereits pro Bild; spätere Einstellungsänderungen verändern ältere Bilder absichtlich nicht.

**Nutzersituation:** Es ist morgens, meine Bilder sind noch leer, und ich weiß nicht, ob ich auf neun Uhr warten muss, die Entwicklung länger eingestellt war oder die App hängt. Nach einer Änderung der Wartezeit können zudem verschiedene Bilder unterschiedliche Zeitpunkte haben.

**Vorschlag:** Einen klaren Status wie „Wird heute um 09:00 sichtbar“ oder „Noch 23 Minuten“ anzeigen. Bei unterschiedlichen Zeiten den Status pro Bild oder pro Entwicklungsgruppe angeben.

**Beleg:** `Frame` in `src/features/camera/AlbumScreen.tsx`; `Photo.developAt` und `developAt` in `src/store/film.ts`.

## Feedback aus den einzelnen Spielen

### 9. Zwei Wahrheiten fragt nach derselben Festlegung zweimal

**Priorität: mittel.** Der Autor markiert seine Lüge bereits vor dem Verhör unter vier Augen. Sobald alle geraten haben, fragt die Ansicht erneut „Welche deiner drei Aussagen war die Lüge?“ und zeigt drei auswählbare Aussagen. Der Reducer ignoriert diese zweite Auswahl und deckt immer die zuvor festgelegte Lüge auf.

**Nutzersituation:** Ich glaube, dass ich meine erste Markierung noch korrigieren oder die Lüge jetzt erst benennen soll. Tippe ich eine andere Aussage an, wirkt die anschließende Auflösung falsch, obwohl die zuvor gespeicherte Festlegung korrekt erhalten bleibt.

**Vorschlag:** Vor der Auflösung ausdrücklich sagen, dass die Lüge bereits feststeht, und eine eindeutige Aktion „Lüge aufdecken“ anbieten.

**Beleg:** `src/games/zwei-wahrheiten/index.tsx`, Ansichten `commit` und `guess` sowie Reducer `revealLie`.

### 10. Top Ten braucht online einen klaren Moment zum Vorlesen

**Priorität: mittel.** Online tippt jede Person ihre Antwort ein. Beim anschließenden Sortieren sieht der Kapitän nur Namen; die eingetippten Antworten erscheinen erst in der Auflösung. Die allgemeine Anleitung erwähnt das laute Antworten, die Online-Spielansicht fordert beim Übergang aber nicht dazu auf.

**Nutzersituation:** Ich habe meine Antwort abgeschickt und warte. Der Kapitän soll sortieren, weiß aber nicht, ob er Antworten vorlesen lassen oder die Reihenfolge schon festlegen soll.

**Vorschlag:** Vor dem Sortieren einen ausdrücklichen Vorlesemoment einführen oder die Antworten ohne geheime Zahlen für den Kapitän anzeigen. Beide Varianten sollten die Antwort klar der jeweiligen Person zuordnen.

**Beleg:** `src/games/top-ten/index.tsx`, Ansichten `writing`, `revealing` und `results`.

### 11. Meme-Duell beschreibt „Entspannt“ widersprüchlich

**Priorität: niedrig.** Die Modusbeschreibung verspricht für „Entspannt“ ein Spiel ohne Trinkansagen. Der allgemeine Setup-Text behauptet gleichzeitig, das schwächste Meme trinke.

**Vorschlag:** Den Text an den gewählten Modus anpassen, damit vor dem Start eindeutig ist, wie gewertet wird.

**Beleg:** `src/games/meme-battle/Setup.tsx`.

### 12. Beim Meme-Speichern fehlt eine sichtbare Fehlermeldung

**Priorität: mittel.** Wenn Laden oder Exportieren des Meme-Bilds scheitert, wird der Fehler nur in der Konsole protokolliert. In der Ansicht bleibt unklar, ob das Bild gespeichert wurde oder erneut versucht werden sollte.

**Vorschlag:** Einen sichtbaren Fehler mit Wiederholen anbieten; eine kurze Bestätigung nach erfolgreichem Export würde die Aktion ebenfalls verständlicher machen.

**Beleg:** `src/games/meme-battle/parts.tsx`, Speicheraktion.

### 13. Stichmagie verlangt vor der ersten Partie viele Regelentscheidungen

**Priorität: niedrig.** Das Setup bietet zahlreiche Sonderkarten, Voreinstellungen und Regelvarianten. Die Auswahl ist für erfahrene Spieler nützlich; beim ersten Kontakt ist aber schwer einzuschätzen, welche Kombination einen einfachen Einstieg bietet.

**Vorschlag:** Eine Einsteiger-Voreinstellung klar hervorheben und zusätzliche Varianten als optionale Anpassungen präsentieren. Die bestehenden Möglichkeiten können erhalten bleiben.

**Beleg:** `src/games/stichmagie/Setup.tsx`.

### 14. Ältere Trinkeinträge sind im Pegel-Tab nicht erreichbar

**Priorität: mittel.** Der persönliche Trink-Log zeigt höchstens die 20 neuesten Einträge. Bei einem längeren Spieleabend verschwinden frühere Einträge aus dieser Ansicht; ein Hinweis auf die Begrenzung oder eine Aktion „Ältere Einträge anzeigen“ fehlt. In einer lokalen Runde ist die vollständige Liste über „Der Tisch“ erreichbar, allein jedoch nicht.

**Nutzersituation:** Ich bemerke später einen falschen Eintrag vom Anfang des Abends und finde ihn im persönlichen Log nicht mehr, obwohl er weiterhin in die Berechnung einfließt.

**Vorschlag:** Ältere Einträge aufklappbar machen oder eine vollständige Verlaufsliste anbieten. Die ersten 20 Einträge können für eine kompakte Ansicht erhalten bleiben.

**Beleg:** `.slice(0, 20)` im Trink-Log von `src/features/bac/PegelScreen.tsx`.

## Sinnvolle Reihenfolge

Zuerst die beiden Aktionen in der Spielkopfzeile unterscheidbar machen und die Glasgrößen klären: Beide Punkte können die Einträge beeinflussen, ohne dass sich ein Nutzer seines Fehlgriffs bewusst ist. Danach den alkoholfreien Einstieg und das Verhalten der Spielkacheln entscheiden. Die übrigen Punkte machen vorhandene Funktionen leichter auffindbar; sie benötigen keine zusätzliche Spiellogik.
