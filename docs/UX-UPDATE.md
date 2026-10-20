# UX-Umsetzung und erneute App-Prüfung

Stand: 19. Oktober 2026. Branch: `codex/ux-improvements-and-game-review`, ausgehend vom zusammengeführten Main-Stand mit den ausgewählten Spielbildern. Beauftragt waren die ersten drei Vorschläge aus [UX-FEEDBACK.md](UX-FEEDBACK.md), neue Meme-Vorlagen, ein wählbares Wechselbudget und eine vertiefte Prüfung von Meme-Duell und Stichmagie. Weitere Produktideen bleiben Feedback.

## Die drei freigegebenen UX-Punkte

1. **Getränk und Einstellungen unterscheiden:** Die Einstellungen zeigen ein Zahnrad. Die schnelle Glasbuchung zeigt das Getränk mit Plus. Eine sichtbare Pfeilaktion öffnet andere Getränke, Mengen und Zeitpunkte, auch allein und online. Langer Druck funktioniert weiterhin. Auf schmalen Displays stehen Titel und Untertitel über den Aktionen, damit alle Knöpfe ihre 44-Pixel-Trefffläche behalten und die Spielbezeichnung lesbar bleibt.
2. **Menge vor dem Buchen erkennen:** Jede Getränkekachel zeigt die tatsächliche Menge und Alkoholstärke. Neben halbem, ganzem und doppeltem Glas gibt es 2 cl, 4 cl, 0,2 l, 0,33 l und 0,5 l sowie eine eigene Menge von 1 bis 2000 ml. Der Tipp auf die Getränkekachel bucht den angezeigten Wert. Die schnelle Glasbuchung verwendet weiterhin die Standardgröße des ausgewählten Getränks.
3. **Alkoholfrei und als Fahrer einsteigen:** Nach der Altersangabe folgt „Mit Alkohol“, „Alkoholfrei“ oder „Ich fahre“. Alkoholfreie Spieler, Fahrer und 16-/17-Jährige überspringen Körperdaten, Magen, Getränk und Zielpegel. Unter 18 wird kein Alkoholmodus angeboten. Fahrerstatus und alkoholfreier Modus bleiben später im Profil änderbar. Wer anschließend Alkohol aktiviert, wird auf die Prüfung von Körperdaten und Getränk hingewiesen.

## Zusätzliche Fehler bei den Getränkeeingaben

- **Exakte Menge statt Schluckrundung:** Historisch wurden Glasgrößen über eine gerundete Schluckzahl zurückgerechnet. Eine 330-ml-Pilsflasche konnte dadurch als 320 ml eingehen, ein halber Shot als ganzer. Neue manuelle Einträge speichern die tatsächlichen Milliliter zusätzlich zur bestehenden Schluckzahl. Alkoholmenge, Anzeige und Tischsumme nutzen diese Menge. Spiele behalten ihre bisherigen Schluckansagen, alte Einträge bleiben kompatibel.
- **Gezieltes Rückgängig:** Bucht man ein Glas und bestätigt unmittelbar danach eine Spielansage, entfernte „Rückgängig“ der Glas-Meldung bisher den neuesten Eintrag. Jetzt wird die konkrete Eintrags-ID des Glases entfernt; der spätere Spieleintrag bleibt erhalten. Das gilt auch für lokale Gäste.
- **Gelöschte eigene Getränke:** Historische Kennungen eines gelöschten eigenen Getränks wurden in der Schnellauswahl als Pils angezeigt und konnten doppelte Pils-Kacheln erzeugen. Die Auswahl bietet nur aktuell verfügbare Getränke. Historische Einträge behalten ihre gespeicherte Getränkebeschreibung.

## Spiele und neue Memes

Beim Meme-Duell wählt der Host Anzahl und Gültigkeit der Vorlagenwechsel: **pro Runde** oder **für das ganze Spiel**. Neue Partien starten mit fünf Wechseln pro Runde. Bereits laufende ältere Partien behalten ihr bisheriges Gesamtbudget. „Gleiches Meme“ verwendet weiterhin eine gemeinsame Vorlage ohne individuelle Wechsel. Regeln, Sonderfälle und elf behobene Fehler stehen im [Meme-Duell-Review](MEME-DUELL-REVIEW.md).

Zwölf neuere Vorlagen erweitern den Katalog von 308 auf **320**: Absolute Cinema, Sad Hamster, Symphony Dolphin, Bro Visited His Friend, What Kind of American, Chill Guy, zwei Moo-Deng-Reaktionen, 100 Men vs. 1 Gorilla, Meowl, Jon Hamm Dancing und High/Low Cortisol. Ihre Quellen und die belegte Verbreitung 2024–2026 stehen in [MEME-VORLAGEN-QUELLEN.md](MEME-VORLAGEN-QUELLEN.md). Die vorhandenen Vorlagen bleiben erhalten; Bilder werden lokal mit der App ausgeliefert.

Bei Stichmagie wurden Hostrechte, fremde Spielaktionen und ein verzögerter Start mit zu wenigen Personen korrigiert. Der [Stichmagie-Review](STICHMAGIE-REVIEW.md) beschreibt die Belege und die Einschätzung des Spielerlebnisses. Die umfangreichen Sonderkarten wurden überprüft; eine veränderte Einsteigerführung bleibt ein Vorschlag.

## Verifikation

- **877 Tests in 74 Dateien erfolgreich**, einschließlich aller Spiele, Berechnungen, Onboarding, Getränkebuchungen und alter Spielstände. Neue Regressionen decken insbesondere die konkreten Fehlerfälle ab.
- **Typecheck, ESLint, Produktionsbuild und `git diff --check` erfolgreich.**
- **Browser, echte Komponenten:** Fahrer-Onboarding ohne Pegelfragen; Buchungen mit 500 ml und 175,5 ml; ungültige Menge verhindert; Meme-Duell von Einrichtung über Wechsel/Zurück mit erhaltenem Entwurf, Abgabe und Abstimmung bis zur Auflösung und nächsten Runde mit neuem Budget; Stichmagie von der Einrichtung über Ansagen und Kartenlegen bis zur ersten Wertung. Keine JavaScript-Laufzeitfehler in diesen Durchläufen.
- **Schmale Ansichten:** Zehn Headerfälle bei 320, 360, 390, 400 und 520 Pixeln mit Stichmagie und langem Spieltitel, einschließlich Punkteblock. Alle Aktionen haben 44 × 44 Pixel Trefffläche; Titel bleiben lesbar und es gibt keinen horizontalen Überlauf.
- **Bilder:** Alle 320 Meme-WebPs sind vollständig dekodierbar; IDs, Bildmaße und Textfelder sind geprüft, Zusatzimport ist wiederholbar. Die bisherigen 308 Vorlagen und Bilder bleiben unverändert. Im Produktionsbrowser stimmen außerdem alle 18 gewählten Spiel-Thumbnails und ihre Detailansichten mit der Auswahl überein; Ring of Fire ist unverändert.

Online-Zustandsübergänge werden mit mehreren Spielern simuliert; eine reale Runde mit mehreren Geräten, deren Netzverbindung und nativer Haptik ist damit nicht abgedeckt. Die Nutzerbeurteilung bewertet die implementierten Abläufe und die Browseransichten, keine beobachtete Gruppe.
