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
    profile/         Profilbild: Auswahl, Zuschnitt, Film-Look (nur lokal)
    onboarding/ home/ lobby/ bac/ camera/ drinks/ games/ settings/
  games/
    types.ts         GameMeta (Stammdaten) + GameDefinition — das Plugin-Interface
    registry.ts      Stammdaten statisch, Spielmodule per import() als eigene Chunks
    card-engine/     Fabrik für Kartenspiele (Spiel = Kartenliste + meta.ts)
    shared/          GameFrame, DrinkCall, BigCard, Countdown, Kartendeck
    <spiel>/         Ein Ordner pro Spiel: meta.ts + index.ts(x)
  components/
    icons/         Eigenes SVG-Set – die App benutzt bewusst keine Emojis
    ui/            Buttons, Sheets, Stepper, Segmented, Toggle, Avatar, QR-Code
  lib/             firebase, id, haptics, format, platform, wakelock
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

## Haptik

`navigator.vibrate` deckt nur die halbe Welt ab: **WebKit kennt die API nicht** — weder Safari
noch der WKWebView. Auf Android gibt es sie, im Browser wie in der App-Hülle; dort hat die
Vibration also immer funktioniert. Auf einem iPhone dagegen lief keiner der rund 150
Haptik-Aufrufe ins Ziel, in der Web- wie in der App-Fassung.

Läuft die App nativ, geht die Haptik darum über die System-Haptik. Das schließt nicht nur die
iOS-Lücke: Ein `impact` mit Stärke fühlt sich auch auf Android anders an als ein flaches
`vibrate(8)` auf dem nackten Motor.

`src/lib/haptics.ts` hat deshalb zwei Wege:

| | Web (Android, Desktop) | Nativ (iOS, Android) |
|:--|:--|:--|
| Weg | `navigator.vibrate` | `@capacitor/haptics` → Taptic Engine / HapticFeedback |
| Geladen | immer | per `import()`, nur wenn `window.Capacitor` da ist |
| Fällt zurück | — | auf den Web-Weg, sobald die Bridge einen Aufruf ablehnt |

Die Muster heißen nach ihrer **Bedeutung**, nicht nach ihrer Länge (`tap`, `select`, `press`,
`heavy`, `success`, `warn`, `error`, `sip`, `tick`, `boom`). Nur so lässt sich die Stärke an
einer Stelle nachjustieren, statt 150 Aufrufe zu suchen. `hapticRamp(0…1)` gibt einen Schlag,
der mit der Anspannung härter wird — dafür gibt es genau einen Fall, den Zünder der Wortbombe.

Zwei Dinge, die von außen unsichtbar sind, aber den Unterschied machen:

- **Sperre von 40 ms** zwischen zwei Impulsen. Die Taptic Engine stellt Aufrufe in eine
  Warteschlange; ohne die Sperre rattert ein gedrückt gehaltener Stepper noch Sekunden später
  nach.
- Gemessen wird mit `performance.now()`, nicht mit `Date.now()`. Die Uhr eines Telefons
  springt (Zeitzone, Zeitabgleich), und ein Rücksprung würde die Sperre sonst für die Dauer
  des Sprungs zumachen.

> **Für die native Hülle:** `@capacitor/haptics` ist eine neue Abhängigkeit und braucht einmal
> `npx cap sync`. Das JS-Paket liegt danach so oder so im Bundle — ob im nativen Projekt auch
> der Plugin-Teil steckt, zeigt sich erst beim ersten Aufruf. Fehlt er, lehnt die Bridge ihn
> ab („Haptics does not have an implementation"), und `haptic()` fällt für den Rest der
> Sitzung auf `navigator.vibrate` zurück. Auf Android bleibt damit alles wie vorher, unter
> iOS bleibt es still — aber nichts geht kaputt.

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
- **Avatare sind Monogramme** auf einer gewählten Farbe – wie in Kontakte-Apps. Wer ein
  eigenes Bild hinterlegt, sieht es statt der Initialen; die Farbe bleibt als Ring stehen,
  weil man sie in einer Liste schneller erkennt als ein 26 Pixel großes Gesicht.
- **Bewegung mit Absicht:** kurze Federkurven, gestaffeltes Einlaufen von Listen,
  hochzählende Schluckzahlen, eine Explosion für die Wortbombe. Alles respektiert
  `prefers-reduced-motion`.
