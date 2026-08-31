# Architektur

## Bewertung des gewählten Ansatzes

**GitHub Pages + Firebase Realtime Database ist für dieses Projekt richtig gewählt.**
Die Begründung im Implementation Plan trägt: Onboarding und Alkoholberechnung sind reine
Client-Logik, und für den geteilten Lobby-Zustand braucht es kein eigenes Backend.

Ein paar Punkte, die der Plan nicht abdeckt und die in der Umsetzung entschieden wurden:

| Thema | Entscheidung |
|:--|:--|
| **Deep Links auf GitHub Pages** | Pages kann keine Pfade auf `index.html` umschreiben. Statt des üblichen 404.html-Tricks nutzt die App `HashRouter`. Geteilte Lobby-Links (`#/lobby?code=A7K2`) und Reloads funktionieren damit überall gleich. |
| **Leere Arrays in der Realtime DB** | Die Datenbank speichert `[]` und `{}` als `null`. Der Spielzustand geht deshalb als JSON-String über die Leitung. |
| **Endloses Warten bei schlechtem Netz** | Das Firebase-SDK gibt bei fehlender Verbindung nie auf. Alle Lobby-Operationen laufen deshalb gegen ein 12-Sekunden-Timeout mit verständlicher Fehlermeldung. |
| **Kein automatisches Aufräumen** | Die Realtime DB kennt kein TTL. Gelöst über `expiresAt` plus Security Rules statt über eine kostenpflichtige Cloud Function. |
| **Austauschbarkeit** | Der gesamte Firebase-Code steckt in `src/lib/firebase.ts` und `src/features/party/PartyContext.tsx`. Alles darüber kennt nur die `PartyValue`-Schnittstelle. Ein Wechsel zu Supabase Realtime, PartyKit oder einem eigenen WebSocket-Server berührt genau diese zwei Dateien. |

### Wann der Ansatz nicht mehr reicht

- **Accounts / Profil über Geräte hinweg** — dann braucht es Auth und serverseitige
  Profildaten. Firebase kann das (Auth + Firestore), das Datenschutzversprechen der App
  müsste aber neu formuliert werden.
- **Manipulationssichere Spielstände** — momentan kann jeder mit dem Lobby-Code schreiben.
  Für ein Spiel um echte Einsätze wäre serverseitige Validierung nötig.
- **Über ~100 gleichzeitige Verbindungen** — der Spark-Tarif ist dann erschöpft. Sechs
  parallele Partys mit je 16 Leuten passen hinein.
- **Impressum & Datenschutzerklärung** — sobald die App öffentlich erreichbar ist, greift in
  Deutschland die Impressumspflicht; Firebase überträgt IP-Adressen an Google und gehört in
  die Datenschutzerklärung. Das ist unabhängig vom Hosting.

### GitHub Pages oder Vercel?

Beides funktioniert; der Build ist host-unabhängig (`VITE_BASE` steuert den Basispfad).
GitHub Pages ist eingerichtet und ausreichend. Ein Wechsel zu Vercel lohnt sich in dem
Moment, in dem ihr Preview-Deployments pro Pull Request oder Serverless Functions wollt —
etwa für eine spätere serverseitige Lobby-Validierung oder Push-Benachrichtigungen.

---

## Aufbau

```
src/
  engine/          Reine Rechenlogik, kein React
    bac.ts           Widmark, Watson, Resorption, Restalkohol, Ampel
    sips.ts          Spielansage → persönliche Schluckzahl
    drinks.ts        Getränkekatalog + eigene Getränke
    age.ts           Altersstufen
  store/           Zustand-Stores mit localStorage-Persistenz
    player.ts        Profil, Getränk, Trink-Log
    app.ts           Theme, Vibration, zuletzt gespielt
  features/
    party/           Der einzige Ort, an dem Multiplayer stattfindet
      PartyContext   Lokale Runde und Online-Lobby hinter einer Schnittstelle
      sips.ts        Hooks für die persönliche Schluckzahl
    onboarding/ home/ lobby/ bac/ drinks/ games/ settings/
  games/
    types.ts         GameDefinition — das Plugin-Interface
    registry.ts      Eine Zeile pro Spiel
    card-engine/     Fabrik für Kartenspiele (Spiel = eine Datenfile)
    shared/          GameFrame, DrinkCall, BigCard, Countdown, Kartendeck
    <spiel>/         Ein Ordner pro Spiel
  components/
    icons/         Eigenes SVG-Set – die App benutzt bewusst keine Emojis
    ui/            Buttons, Sheets, Stepper, Segmented, Toggle, Avatar, QR-Code
  lib/             firebase, id, haptics, format
  styles/          tokens.css (Design-System), global.css, game.css
```

## Zwei Modi, eine Schnittstelle

`PartyProvider` stellt beide Spielarten hinter derselben API bereit:

- **Pass & Play** (`mode: 'local'`) — ein Handy, Mitspieler werden mit Gewicht und Getränk
  eingetragen. Der Reducer läuft direkt im React-State. Funktioniert ohne Internet.
- **Lobby** (`mode: 'online'`) — 4-stelliger Code, Firebase, Host-Autorität. Jede Person
  sieht ihre eigene Schluckzahl auf ihrem eigenen Gerät.

Ein Spiel merkt vom Unterschied nur eines: das Flag `online`. Ist es `false`, darf das
Gerät auch für die Person am Zug tippen.

## Warum Körperdaten das Gerät nicht verlassen

Gewicht, Größe, Alter und Geschlecht sind Gesundheitsdaten. Sie werden nie hochgeladen.
Daraus folgt direkt die Bauweise der Trinkansage: Ein Spiel meldet nur die **Härte** eines
Zuges (`baseSips`), nie eine fertige Schluckzahl. Jedes Gerät übersetzt diese Härte lokal
in die Menge, die zu seiner Person passt. Auf fremden Bildschirmen steht deshalb bewusst
„sieht seine Menge auf dem eigenen Handy".

Im Pass-&-Play-Modus ist das anders — dort gibt es nur ein Gerät, und die eingetragenen
Mitspielerdaten liegen im Arbeitsspeicher dieser Sitzung. Sie werden nicht persistiert.

## Ausfallsicherheit

| Fall | Verhalten |
|:--|:--|
| Host verliert das Netz | Nach 45 s übernimmt der dienstälteste anwesende Spieler per Transaktion |
| Spieler verliert das Netz | Wird nach ~90 s ausgegraut, nach ~4,5 min entfernt; kann jederzeit mit demselben Code zurückkommen |
| Datenbank nicht erreichbar | Timeout nach 12 s, klare Meldung, Pass-&-Play bleibt nutzbar |
| Unerwarteter Fehler in einem Spiel | `ErrorBoundary` fängt ab und bietet Neuladen statt weißem Bildschirm |
| App zwei Tage später geöffnet | Trink-Log älter als 14 Stunden wird automatisch verworfen |


## Oberfläche

Das Design orientiert sich an iOS und hält sich bewusst zurück:

- **Eine Akzentfarbe** für die ganze App (Systemblau). Spiele färben nur ihren eigenen
  Bildschirm ein, nie die Navigation.
- **Deckende Flächen** statt Milchglas. Unschärfe gibt es genau dort, wo iOS sie auch
  einsetzt: Navigationsleiste, Tab-Leiste, Sheets.
- **Keine Farbverläufe auf Knöpfen, keine farbigen Schlagschatten.** Ein Primärknopf ist
  eine Fläche in einer Farbe.
- **Icons statt Emojis.** Emojis sehen auf jedem System anders aus und lassen sich nicht
  einfärben; das eigene Set teilt Raster, Strichstärke und `currentColor`.
- **Avatare sind Monogramme** auf einer gewählten Farbe – wie in Kontakte-Apps.
- **Bewegung mit Absicht:** kurze Federkurven, gestaffeltes Einlaufen von Listen,
  hochzählende Schluckzahlen, eine Explosion für die Wortbombe. Alles respektiert
  `prefers-reduced-motion`.
