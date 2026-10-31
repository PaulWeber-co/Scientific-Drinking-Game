# App-Prüfung und Fehlerkorrekturen – 31. Oktober 2026

## Ergebnis und Umfang

Ausgangspunkt ist der aktuelle Main-Stand `1066362` mit den Änderungen aus PR #44. Der Branch wurde vor der Prüfung erneut mit `origin/main` abgeglichen. Die ausgewählten 18 freigestellten Getränke-Motive (54 px) und das Foto für „Wer bin ich?“ bleiben Bestandteil des PRs.

Geprüft wurden der neue Web-/Native-Wechsel, die umgebende Navigation, Dialoge und ihre Gesten, Getränkewahl und manuelle Buchung, Onboarding, lokale Runde, Spielemenüs, Album und Profil. Die vollständige automatisierte Suite deckt zusätzlich Berechnungen, Spielabläufe und simulierte Online-Zustände ab. Der Gyro-/Physik-Bereich wurde entsprechend der ausdrücklichen Vorgabe nicht geändert.

## Behobene Fehler

### 1. Native Leiste wurde bei Routenwechseln ab- und wieder angemeldet

**Auslöser:** Ein nativer Tab ändert die Route, etwa Pegel → Album. `useNavigate()` kann im verwendeten deklarativen Router seine Funktionsidentität ändern. Der bisherige Effekt hing davon ab und meldete Listener und native Leiste bei jedem Wechsel neu an.

**Folge:** Unnötiges Verstecken/Zeigen, verspätete Rückmeldungen und konkurrierende Bridge-Aufträge. Beim schnellen Wechsel Spiel → Lobby konnte ein altes `hide()` die gerade angezeigte neue Leiste wieder ausblenden.

**Korrektur:** Eine Sitzung pro Mount, aktuelle Route/Navigationsfunktion über Ref, geordnete native Aufträge über eine gemeinsame Queue. Unmount deaktiviert die Sitzung und räumt ihre Listener auf; ein verspätetes `show` wird vor dem abschließenden `hide` abgearbeitet. Änderungen der Route bauen den Listener nicht neu auf. StrictMode und verspätete Antworten werden ebenfalls berücksichtigt.

**Beleg:** Regressionen in `src/app/NativeAwareTabBar.test.tsx` prüfen genau einen Listener über Tab-Wechsel, kein zwischenzeitliches `hide`, ausstehendes `show` beim Unmount sowie StrictMode.

### 2. Native Leiste blieb über Web-Dialogen bedienbar

**Auslöser:** Getränkepicker, eigene Karten oder Spieleinladung öffnen, während UIKit über der WebView liegt. Ein höherer CSS-z-index innerhalb der WebView kann UIKit nicht überdecken.

**Folge:** Wechsel in einen anderen Reiter trotz offenem Dialog; Dialog und Eingaben konnten dabei verschwinden.

**Korrektur:** Die Anbindung beobachtet modale Dialoge und App-Sichtbarkeit, versteckt UIKit darunter und zeigt es nachher wieder. Tab-Ereignisse werden während eines Dialogs und nach Beendigung einer Sitzung verworfen. Der Web-Layout-Abstand und der Update-Hinweis behalten ihren Platz.

**Beleg:** Bridge-Test öffnet einen Dialog, erwartet `hide`, verwirft einen Tab-Wechsel und erwartet nach Schließen erneut `show`. Die reale UIKit-Ebene benötigt weiterhin den Gerätetest.

### 3. Fehler einer nativen Bridge ließen Listener zurück

**Auslöser:** `show`, Listener-Anmeldung oder Aufräumen schlägt fehl. Vorher wurden Fehler teilweise ignoriert, während Listener weiter aktiv waren; einzelne `hide`-/`remove`-Promises hatten keinen Fehlerpfad.

**Korrektur:** Fehlgeschlagene Sitzungen können keine Navigation mehr auslösen, entfernen ihre Listener und kehren zum Web-Fallback zurück. Auch Fehler beim Aufräumen werden abgefangen. Ungültige und nicht ganzzahlige Tab-Indizes werden verworfen.

**Beleg:** Regression für abgelehntes `show`, entfernten Listener und wirkungslose spätere Ereignisse. Die native Vorlage übernimmt jetzt außerdem das App-Farbschema. Erneute Auswahl des aktuellen Tabs scrollt wie die Web-Leiste nach oben.

### 4. Escape schloss mehrere übereinanderliegende Sheets

**Auslöser:** Spieldetail → Eigene Karten → Bearbeiten; es liegen zwei Sheets übereinander. Beide hatten ihren eigenen globalen Escape-Handler.

**Folge:** Ein Tastendruck konnte beide Dialoge schließen. Beim Schließen nur eines Sheets wurde außerdem die Scrollsperre des weiterhin offenen Dialogs aufgehoben. Neue `onClose`-Referenzen bauten diese Sperre bei Neu-Rendern ständig ab und wieder auf.

**Korrektur:** Gemeinsamer Modal-Stack für Sheets und Spieleinladungen. Nur die oberste Ebene behandelt Escape; der ursprüngliche `body.style.overflow` wird erst nach Schließen der letzten Ebene wiederhergestellt. Der aktuelle Callback wird über eine stabile Referenz gelesen.

**Beleg:** Drei Modal-Regressionen; realer Browserablauf mit zwei eigenen-Karten-Sheets und anschließend einem weiter offenen Elterndialog. [Screenshot nach Escape](review-2026-10-31/nested-sheet.png).

### 5. Tastaturfokus verließ modale Dialoge

**Auslöser:** Mehrfach Tab/Shift+Tab drücken oder den Fokus im Hintergrund ändern. `aria-modal` allein implementiert keine Tastaturführung.

**Folge:** Unsichtbare oder verdeckte Bedienelemente der Hauptseite wurden erreicht, während der Dialog offen blieb.

**Korrektur:** Fokus beim Öffnen in den Dialog führen, Tab/Shift+Tab an den Grenzen umlenken und Fokus beim Schließen zum verbundenen Auslöser bzw. Elterndialog zurückgeben. Bereits fokussierte Eingaben bleiben bei Neu-Rendern erhalten. Auch die Spieleinladung verwendet diese Führung und kann per Escape zurückgestellt werden.

**Beleg:** Fokus-/Tab-Regressionen, bestehende Einladungs- und Formular-Tests sowie Browserprüfung verschachtelter Dialoge.

### 6. Abgeschlossene Wischgesten navigierten noch nach einem Unmount

**Auslöser:** Wisch-Zurück bzw. Sheet-Schließen läuft bereits animiert; die Seite oder der Dialog wird vor Ablauf der Animation auf anderem Weg verlassen.

**Folge:** Ein nicht abgeräumter Timeout rief später noch die alte Zurück-/Schließen-Aktion auf. Das konnte die anschließend sichtbare Seite beeinflussen.

**Korrektur:** Alle verzögerten Aktionen der jeweiligen Gesteninstanz werden gesammelt und beim Unmount abgebrochen, einschließlich verschachtelter Nachläufe.

**Beleg:** Zwei Regressionen ziehen eine Seite bzw. ein Sheet, unmounten vor Animationsende und lassen alle Timer ablaufen: kein alter Callback wird ausgelöst. Bestehende 12 Gestentests bleiben grün.

### 7. Web-Tab-Leiste verschluckte Tastatur-Klicks und akzeptierte einen abgebrochenen Zug

**Auslöser:** Klick in den ersten 700 ms nach Start oder Tastaturklick kurz nach einem Pointer-Ereignis; Loslassen weit links/rechts außerhalb der Leiste. Die Klicksperre unterschied vorher nicht zwischen Tastatur und dem doppelten Folge-Klick eines Fingers. Die Abbruchgrenze prüfte nur die senkrechte Position.

**Korrektur:** Sperre anfangs inaktiv; Tastatur-/Screenreader-Klicks bleiben möglich. Horizontales Loslassen weit neben der Leiste bricht ebenfalls ab. Modifizierte Links, etwa Ctrl-/Cmd-Klick zum Öffnen in einem neuen Tab, behalten Browser-Verhalten.

**Beleg:** Zwei zusätzliche Layout-Regressionen für frühen Tastaturklick und horizontales Abbrechen mit anschließender Tastaturbedienung.

### 8. Getränkewahl war für Screenreader nicht eindeutig

**Auslöser:** Aktuelles Getränk in der Liste erkennen oder eines von mehreren eigenen Getränken löschen. Sichtbare Markierung und Häkchen waren nicht als Auswahlzustand beschrieben; mehrere Knöpfe hießen nur „Löschen“.

**Korrektur:** Standard- und eigene Getränke geben `aria-pressed` aus. Löschen nennt das konkrete Getränk im zugänglichen Namen. Die Icons bleiben dekorativ, weil der Name daneben das Getränk vollständig beschreibt.

**Beleg:** Browserprüfung des gewählten Pils mit `aria-pressed=true`; Erstellen und gezieltes Löschen eines eigenen Getränks.

## Verifikation

- **1.059 Tests in 89 Dateien bestanden**. Vor der Prüfung waren es 1.047 Tests; die zwölf zusätzlichen Regressionen betreffen die beschriebenen Fehlerfälle.
- Typecheck, ESLint, Produktionsbuild und `git diff --check` erfolgreich. Der bestehende Vite-Hinweis zu gleichzeitigen statischen/dynamischen Capacitor-Imports ist kein Buildfehler.
- **Chromium, 320 und 390 px, Hell und Dunkel:** alle 20 Spieldetailseiten und sieben Haupt-/Nebenbereiche besucht. Kein weiterer horizontaler Überlauf außer dem unten dokumentierten Glas-Befund bei 320 px.
- **Echtes Browser-Onboarding:** Fahrer-Modus endet mit `designatedDriver=true`, alkoholfrei und Getränk `soft`; Alkohol-Modus läuft über Körperdaten/Magen/Getränk/Ziel und übernimmt ausgewähltes Radler.
- **Getränke:** alle 18 Motive, Auswahlwechsel, ungültige eigene Menge gesperrt, eigenes Getränk mit Dezimalvolumen angelegt/ausgewählt/gelöscht; 175,5 ml exakt verbucht und rückgängig gemacht.
- **Lokale Runde:** drei Gäste angelegt, Wahrheit oder Pflicht gestartet, Mehr-Menü und Regeln geöffnet, Beenden abgebrochen und danach bestätigt; Rückkehr in die Runde.
- **Dialoge:** Eigene Karten → Bearbeiten → Escape schließt nur die obere Ebene; Scrollsperre bleibt bis zum letzten Schließen bestehen.
- Keine JavaScript-Laufzeitfehler in diesen Browserabläufen. [Getränkepicker dunkel](review-2026-10-31/drink-picker-dark.png), [hell](review-2026-10-31/drink-picker-light.png).

Die Spiele wurden nicht alle manuell bis zum Ende gespielt. Automatisierte Spiel-/Reducer-Tests und simulierte Mehrspieler-Tests ersetzen keine beobachtete Party oder reale Mehrgeräte-Runde. Kamera-Hardware, iOS-Safari, native Haptik, UIKit, Signierung und TestFlight-Upload wurden hier nicht geprüft. Der neue Swift-Code ist eine Integrationsvorlage; die [iOS-Anleitung](NATIVE-TABBAR.md) enthält die nötigen Schritte und Gerätetests.

## Offener bestätigter Befund: Glas bei 320 px

Die `280px` breite `.glass`/`.glass__canvas` passt nicht in den schmaler gewordenen Fotopapier-Rahmen. Sie ragt rechts heraus und erzeugt horizontalen Seitenüberlauf. [Screenshot bei 320 px](review-2026-10-31/pegel-320.png).

Dieser Fehler bleibt bewusst offen, weil der Auftrag den parallel bearbeiteten Gyro-/Glas-Bereich ausdrücklich von Änderungen ausgenommen hat. Zuständig sind `src/features/bac/glass/glass.css` und das Zusammenspiel mit `.pegelabzug`. Im Glas-Branch die Darstellung responsiv skalieren, das Seitenverhältnis erhalten und anschließend die Touch-Koordinaten am skalierten Canvas prüfen. Bloßes Abschneiden per `overflow:hidden` würde den Darstellungsfehler verdecken.

## Empfehlungen zur Benutzerfreundlichkeit

1. **Getränkewahl verkürzen:** „Zuletzt gewählt“ bzw. Favoriten oben und bei Bedarf Suche. Name und Stärke sollten zuerst erfassbar sein; die vollständige Schluckrechnung könnte erst auf Nachfrage erscheinen. Die jetzige Liste ist mit 18 Getränken und Berechnungstexten lang.
2. **Fotos konsistent nutzen:** dieselben freigestellten Motive auch im Onboarding und beim schnellen Eintragen zeigen. Dort werden momentan noch die bisherigen SVG-Symbole verwendet; das erschwert das Wiedererkennen.
3. **Dialogkopf beim Scrollen stehen lassen:** Titel und Fertig/Abbrechen verschwinden in langen Getränke- und Formularlisten oberhalb des sichtbaren Bereichs. Ein fester Kopf mit scrollendem Inhalt würde den Abschluss erreichbar halten; Gestenkonflikte dabei gesondert prüfen.
4. **Gäste wie im Onboarding führen:** „Mit Alkohol / alkoholfrei / ich fahre“ am Anfang der Gästeingabe anbieten und danach nur nötige Fragen zeigen. Das jetzige Gastformular fragt Körperdaten vor der Spielweise ab und ist für eine größere Runde aufwendig.
5. **Leeres Album mit klarer Aktion:** einen direkten Einstieg „Film starten“/„Foto machen“ anbieten. Der aktuelle Leerzustand erklärt die Idee, zeigt aber keinen unmittelbaren ersten Schritt.
6. **Vor TestFlight native Integration abschließen:** echte iPhone-Prüfung mit großen Schriften/VoiceOver, Tastatur, modalen Dialogen und schnellen Wechseln. Ein natives `UITabBarController`-Layout wäre der nächste Schritt, wenn zusätzlich vollständige System-Containerübergänge und minimierendes Verhalten gewünscht sind.

Diese Empfehlungen sind bewusst keine stillschweigenden Produktänderungen im PR. Sie beruhen auf den geprüften Ansichten und Abläufen; es liegt keine Nutzerstudie vor.
