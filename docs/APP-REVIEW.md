# App-Durchgang und Bugfixes

Stand: 19. Oktober 2026. Geprüft wurden die App als Nutzer im mobilen Chromium, die lokale Runde mit vier Testpersonen, eine echte Firebase-Lobby mit zwei getrennten Browserprofilen sowie die vorhandenen automatisierten Tests aller Spiele. Die nicht als Fehler belegten UX- und Optimierungsvorschläge stehen separat in [UX-FEEDBACK.md](./UX-FEEDBACK.md); sie wurden nicht umgesetzt.

## Behobene Fehler

| Bereich | Auslöser und bisheriges Verhalten | Korrektur |
| --- | --- | --- |
| Einladungslink | Neues Gerät öffnet einen Lobby-Link; nach Onboarding ist der Code weg. | Ursprüngliche Route einschließlich Code bleibt erhalten und wird nach Onboarding geöffnet. |
| Restalkohol | „Abend abschließen“ leert das aktuelle Log und damit auch die Pegel-/Dosierungsgrundlage. | Getrennte, persistierte Resthistorie hält relevante Ereignisse für Anzeige, Prognose, Online-Zone und Dosierung vor. Aktuelle Abendstatistik bleibt getrennt. |
| Rückblick | Nach Abschluss und Weitertrinken berechnet die Rückblickkarte eine zu frühe Nüchternzeit aus dem neuen Log allein. | Rückblick und Archiv berücksichtigen die komplette relevante BAC-Historie; der Peak wird auf den aktuellen Abend begrenzt. |
| Zeitablauf | Eine bereits angezeigte Schluckempfehlung bleibt beim längeren Aussetzen unverändert. | Dosierung aktualisiert sich mit der Uhr und nach Rückkehr aus dem Hintergrund. |
| Pass & Play | Ein Gastdrink allein startet keinen Abend; nach Abschluss bleiben Gastdrinks im aktuellen Tischlog. | Gastdrinks eröffnen den Abend. Abschluss trennt aktuelle Gastlogs und Resthistorie, einschließlich Wiederherstellung nach Neuladen. |
| Schnelles Gastglas | Die Schluckzahl eines Gastglases wird aus dem Getränk des Gerätebesitzers statt aus dem Gastgetränk bestimmt. | Menge wird aus dem Getränk der ausgewählten Person berechnet. |
| Bedienung Glas-Knopf | Tastatur und Screenreader erzeugen einen Klick, der bisher keine Buchung auslöst. | Nativer Klick unterstützt diese Eingaben; Pointer und Longpress erzeugen keine zusätzliche Doppelbuchung. |
| Eigene Getränke | Ungültige oder leere Eingaben werden still geklemmt; Vorschau und gespeicherte Menge widersprechen sich. | Eingabebereich entspricht der Engine; ungültige/leere Werte lassen sich nicht speichern. |
| Historische Getränkemenge | Nach Löschen eines eigenen Getränks wird ein Eintrag mit der Pils-Definition formatiert. | Neue Ereignisse bewahren einen Getränkesnapshot für spätere Mengenanzeige und Gläsersummen. Alte Einträge ohne Snapshot verwenden weiterhin den verfügbaren Katalog. |
| Album | Ein offen gelassenes Album bleibt nach der Entwicklungszeit gesperrt, bis ein anderes Ereignis einen Render auslöst. | Album aktualisiert sich zur Freischaltzeit und nach Hintergrundwechsel. |
| Kamera | Fehler beim Aufnehmen/Speichern bleiben unbehandelt; der Blitz kann eingeschaltet bleiben. | Blitz wird auch bei Fehlern ausgeschaltet; sichtbare Fehlermeldung und erneuter Versuch, ohne ein Bild zu verbrauchen. |
| Spielergrenzen | Über die Spielewand lassen sich Spiele mit mehr als ihrer maximalen Teilnehmerzahl starten. | Übersicht, Detailseite und tatsächlicher Spielstart berücksichtigen beide Grenzen; Start prüft nach dem Laden die aktuelle Besetzung. |
| Online-Status | Eine bereits bestehende Datenbankverbindung wird beim Abonnieren der Lobby wieder mit „Verbinde …“ überschrieben. | Der echte Verbindungsstatus bleibt maßgeblich, auch beim Wechsel des Codes. |
| Meme-Duell | Ein alter synchronisierter Spielstand ohne Vorlagenauswahl stürzt vor dem vorgesehenen Neustart-Hinweis ab. | Fehlendes Feld wird abgefangen; Hinweis und Neustart sind erreichbar. |
| Wortbombe | Weitergeben kurz nach der Zündzeit kann die Niederlage auf die nächste Person schieben. | Zeitgrenze wird bei der Aktion selbst geprüft; die bisherige Person verliert. |
| Wortbombe | Verlässt eine frühere Person die Runde, kann der aktive Platzindex auf die falsche Person zeigen. | Sitzfolge und aktuelle Person bleiben konsistent. |
| Tabu | Kurz nach Ablauf der 60 Sekunden werden Treffer noch gezählt, bevor das nächste Timer-Ereignis ankommt. | Aktionen nach der tatsächlichen Zeitgrenze werten keine zusätzlichen Treffer. |
| Undercover | Andere Online-Spieler können den letzten Rateversuch der enttarnten Person bedienen. | Nur die betroffene Person kann ihre Auswahl/Antwort abgeben. |
| Karten-Spiele | Zwei Geräte klicken zugleich „Nächste Karte“ und überspringen Karten oder Personen. | Aktionen tragen eine Zugkennung; verspätete Aktionen aus dem vorigen Zug werden ignoriert. |
| Busfahrer | Schon bei weniger als fünf Restkarten wird neu gemischt; das erzeugt unnötige Wiederholungen. | Nachmischen erfolgt erst bei leerem Stapel. Bei Mehrfachkarten entfernt Ablegen genau ein Exemplar; React-Schlüssel sind eindeutig. |

## Prüfung

- Ausgangsstand: 705 Tests in 59 Dateien erfolgreich.
- Abschließender Gesamtlauf mit den ausgewählten Bildern: 765 Tests in 70 Dateien erfolgreich, einschließlich der zwei zusätzlichen Regressionstests für den Online-Verbindungsstatus.
- Produktionsbuild einschließlich TypeScript und PWA-Erzeugung erfolgreich; nach dem letzten Statusfix Typecheck, ESLint und `git diff --check` erneut erfolgreich.
- Mobiler Browserdurchgang: vollständiges Onboarding, drei lokale Gäste hinzufügen, Ring of Fire starten, Gastglas buchen/zurücknehmen, Spiel beenden, Pegel/Album öffnen, Besetzung nach Reload erhalten.
- Desktopdurchgang: kein horizontaler Überlauf bei 1280 Pixeln Breite.
- Echte Firebase-Prüfung: eigene Testlobby erstellt, zweites Browserprofil über Einladungslink inklusive Erst-Onboarding beigetreten, beide Geräte sehen zwei Personen und „Live verbunden“, Spielstart erzeugt Einladung auf dem zweiten Gerät. Eigene Testlobbies anschließend entfernt.
- Browserdurchgänge ohne unbehandelte JavaScript-Fehler. Screenshots und maschinenlesbare Ergebnisse sind als lokale Review-Artefakte gespeichert.
- Bildprüfung im Produktionsbuild: Alle 19 Spielkacheln laden, die 18 ausgewählten Motive stimmen auf Übersicht und allen 18 Detailseiten bytegenau mit der Nutzerwahl überein. Ring of Fire ist unverändert.

Es wurde nicht jede Kombination von Spiel, Personenzahl und Verbindungsabbruch manuell durchgespielt. Alle registrierten Spiel-Reducer werden durch den bestehenden automatisierten Spieltest abgedeckt; für die gefundenen Fehler kamen gezielte Regressionstests hinzu. Native iOS-/Android-Hardware, reale Kamerahardware und installierte PWA-Updates wurden in dieser Umgebung nicht geprüft.

Bereits früher gelöschte Daten lassen sich durch den Fix nicht rekonstruieren: Das betrifft insbesondere schon vor diesem Update abgeschlossene und verworfene Alkoholereignisse sowie gelöschte eigene Getränkedefinitionen bei alten Logeinträgen ohne Snapshot.

## Neue Bilder

Aus 36 mit ChatGPT Image Generation erstellten Entwürfen wurden die 18 vom Nutzer ausgewählten Motive übernommen. Sie ersetzen die bisherigen Bilddateien unter `src/assets/games/` und erscheinen dadurch in Spieleübersicht, Lobby und Detailseiten. Die Zuordnung A/B samt Dateipfaden und SHA-256-Hashes steht in [thumbnail-selection.json](./thumbnail-selection.json). Ring of Fire bleibt die unveränderte Stilvorlage.
