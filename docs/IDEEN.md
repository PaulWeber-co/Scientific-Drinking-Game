# Ideen für später

Priorisiert nach Verhältnis von Aufwand zu Wirkung. „1 Datei" heißt: geht über
`createCardGame()` ohne eigenen UI-Code (siehe `docs/SPIEL-HINZUFUEGEN.md`).

---

## Spiele

### Sehr empfohlen

| Spiel | Idee | Aufwand |
|:--|:--|:--|
| **Undercover** | Alle bekommen dasselbe Wort – eine Person ein leicht anderes. Reihum beschreibt jede Person ihr Wort mit einem Satz, dann wird abgestimmt. Wer rausfliegt, trinkt; wird der Undercover nicht gefunden, trinken alle. Braucht eigene Handys und ist genau die Sorte Spiel, bei der man sich anschaut statt aufs Display. | mittel, eigene Komponente |
| **Wer aus der Runde …** | „Wer würde am ehesten den Flug verpassen?" Alle tippen gleichzeitig auf einen Namen, dann Auflösung. Wer die meisten Stimmen hat, trinkt pro Stimme. Extrem schnell, extrem lustig, funktioniert ab 4 Leuten. | klein, eigene Komponente (Abstimmung gibt es schon in Meme Battle) |
| **Schätzfrage** | „Wie viele Liter Bier trinkt Deutschland pro Kopf und Jahr?" Alle tippen eine Zahl, die am weitesten daneben liegende Person trinkt. Trainiert nebenbei das Gefühl für Zahlen – passt thematisch. | klein, eigene Komponente |
| **Zwei Wahrheiten, eine Lüge** | Jede Person schreibt drei Aussagen, die Runde rät die Lüge. Wer falsch rät, trinkt; wird die Lüge von allen erkannt, trinkt der Autor. | klein, Bausteine aus Meme Battle wiederverwendbar |
| **Kategorien-Kette** | „Automarken", reihum, wer hängt trinkt. Klassiker, funktioniert auf einem Handy. | **1 Datei** |
| **Mäxchen** | Würfel-Bluffspiel. Zwei Würfel verdeckt, ansagen oder höher lügen, aufdecken lassen. Der Verlierer trinkt. | mittel, eigene Komponente |
| **Reaktions-Duell** | Handy liegt in der Mitte, zwei Namen erscheinen, nach zufälliger Wartezeit wird der Bildschirm grün. Wer zuletzt tippt, trinkt. Bringt Bewegung in eine müde Runde. | klein, eigene Komponente |

### Weitere Kandidaten

| Spiel | Idee | Aufwand |
|:--|:--|:--|
| **Silbenbombe** | Wortbombe-Variante: statt Kategorie eine Silbe („STR"), jedes Wort muss sie enthalten. Nutzt den bestehenden Bomben-Reducer. | klein |
| **Ich packe meinen Koffer** | Gedächtniskette, wer patzt trinkt. | **1 Datei** |
| **Beer-Pong-Schiedsrichter** | Becherzähler für zwei Teams; getroffener Becher = Trinkansage an das Gegenteam, individuell umgerechnet. Die App ergänzt ein physisches Spiel, statt es zu ersetzen. | klein |
| **Der heiße Stuhl** | 60 Sekunden Schnellfeuerfragen an eine Person, jede nicht beantwortete Frage kostet einen Schluck. Timer und Kartenstapel sind vorhanden. | klein |
| **Party-Bingo** | Jede Person bekommt eine Karte mit Ereignissen („jemand verschüttet etwas", „jemand redet über die Arbeit"). Läuft den ganzen Abend nebenher. | mittel |
| **Stille Post zum Zeichnen** | Gartic-Phone-Prinzip: Satz schreiben, zeichnen, raten, abwechselnd. Braucht eine Zeichenfläche und mehr Zustand als alles bisherige – aber es ist der Spieleabend-Selbstläufer schlechthin. | groß |
| **Musikquiz „Erste Zeile"** | Eine Person singt die erste Zeile eines Songs, die Runde rät. Kein Streaming nötig, keine Lizenzfragen. | **1 Datei** |

---

## Features

### Hoher Nutzen, kleiner Aufwand

- **QR-Code für die Lobby.** Statt vier Zeichen abzutippen: Code scannen. Der Einladungslink
  existiert schon (`#/lobby?code=…`), es fehlt nur die Darstellung. Ein kleiner
  QR-Encoder ist dafür ausreichend, keine externe Abhängigkeit nötig.
- **Abend-Rückblick.** Beim „Abend beenden" eine Zusammenfassung: Gesamtmenge, höchster
  Pegel, meistgespieltes Spiel, längste Aussetz-Serie. Als teilbare Bildkarte am nächsten
  Morgen deutlich unterhaltsamer als eine Zahl.
- **Rolle „Designierte:r Fahrer:in".** Ein Schalter, der die Person sichtbar in der Lobby
  markiert, alle Ansagen in Aufgaben verwandelt und ihr eine eigene Kachel mit Wasserzähler
  und Heimweg-Countdown gibt. Der alkoholfreie Modus ist da – ihm fehlt nur die Bühne.
- **Eigene Karten.** Fragen und Aufgaben selbst hinzufügen, lokal gespeichert und optional
  in die Lobby geteilt. Verlängert die Lebensdauer jedes Kartenspiels erheblich.
- **Gruppen-Pegelanzeige.** In der Lobby eine anonyme Verteilung („3 im Sweet Spot, 1 noch
  im Aufbau"). Zeigt nur Zonen, keine Werte – dann bleiben die Gesundheitsdaten lokal.

### Mittelfristig

- **PWA mit Service Worker.** Onboarding, Berechnung und alle Ein-Handy-Spiele funktionieren
  offline. Auf Partys mit schlechtem Netz ist das mehr wert, als es klingt.
- **Nüchtern-Wecker.** „Weck mich, wenn ich wieder bei 0,0 bin." Web-Notification zur
  berechneten Uhrzeit.
- **Adaptive Spielvorschläge.** Ist die Gruppe im Schnitt über dem Pegel, schlägt die App
  ruhigere Spiele vor, sonst schnellere. Die Daten dafür liegen bereits vor.
- **Kater-Prognose.** Am nächsten Morgen: Gesamtmenge, Trinkgeschwindigkeit,
  Wasser-Quote → eine ehrliche Einschätzung plus konkreter Rat.
- **Heimweg-Hilfe.** Taxi-Deeplink, Standort teilen, „Ich bin zu Hause"-Nachricht an die
  Lobby. Passt zur Haltung der App und kostet wenig.
- **Turniermodus.** Mehrere Spiele hintereinander mit Punktetabelle über den Abend.

### Wenn es größer wird

- **Konto und Geräteweschsel.** Aktuell hängt das Profil am Browser. Firebase Auth könnte
  das lösen – dann muss aber das Datenschutzversprechen neu formuliert werden, weil
  Gesundheitsdaten das Gerät verlassen würden.
- **Serverseitige Validierung.** Wer den Lobby-Code hat, kann heute alles schreiben. Für
  ein Spiel um echte Einsätze bräuchte es Cloud Functions und damit den Blaze-Tarif.
- **Internationalisierung.** Die Kartentexte sind der Aufwand, nicht die Oberfläche. Vorher
  klären, ob es sich lohnt.
- **Sound.** Bombenticken, Kartenrascheln, Timer. Auf einer lauten Party allerdings
  fraglich – Vibration trägt oft weiter als Ton.

---

## Bewusst nicht geplant

- **Wettkampf um Trinkmenge.** Bestenlisten nach konsumiertem Alkohol würden genau das
  belohnen, was die App verhindern soll.
- **Spiele, die auf Ausnüchterung setzen.** Alles, was „schneller trinken" zur
  Gewinnbedingung macht, widerspricht der Pegel-halten-Logik.
- **Echtzeit-Pegel anderer Spieler im Klartext.** Zonen ja, Zahlen nein. Sonst wird aus dem
  Sicherheitsfeature ein Gruppenzwang.
