# Firebase Realtime Database

## Warum überhaupt

GitHub Pages ist ein statischer Dateiserver: kein serverseitiger Code, keine WebSockets,
keine Datenbank. Onboarding und Alkoholberechnung laufen komplett im Browser und brauchen
das auch nicht. Sobald aber mehrere Handys denselben Spielstand sehen sollen, braucht es
einen Ort, an dem dieser Zustand liegt. Genau das — und nur das — macht Firebase hier.

## Was in der Datenbank landet

```
lobbies/
  A7K2/
    meta/     { code, host, status, gameId, startedBy, startedAt,
                createdAt, updatedAt, expiresAt }
    players/  { <geräteId>: { id, name, color, drinkIcon, driver, zone,
                              joinedAt, lastSeen, online } }
    game/     { id, startedAt, state: "<JSON-String>" }
    inbox/    { <pushId>: { by, at, action: "<JSON-String>" } }
```

`startedBy` trägt die Spieleinladung: wechselt `status` auf `playing`, bekommen alle
anderen Geräte ein „X hat gestartet – mitspielen?" statt selbst suchen zu müssen.

`zone` ist bewusst grob: `sober`, `warmup`, `sweet`, `edge` oder `over` – fünf Stufen, kein
Zahlenwert. Daraus baut die Lobby die anonyme Gruppenanzeige. `driver` markiert die Person,
die den Heimweg übernimmt, damit ihr niemand nachschenkt.

**Nicht** in der Datenbank: Alter, Gewicht, Größe, Geschlecht, Zielpegel, Trink-Log,
Promillewerte. Diese Daten liegen ausschließlich im `localStorage` des jeweiligen
Geräts. Deshalb berechnet auch jedes Gerät seine eigene Schluckzahl selbst — auf dem
Bildschirm der anderen steht nur „sieht seine Menge auf dem eigenen Handy".

## Warum der Spielstand ein JSON-String ist

Die Realtime Database kennt weder leere Arrays noch leere Objekte: sie speichert beides als
`null` und entfernt `null`-Einträge auch aus Arrays. Ein leergespieltes Kartendeck (`[]`)
käme also als `null` zurück und würde jeden Reducer zerlegen. Als String bleibt der Zustand
exakt so, wie ihn der Reducer erzeugt hat (`encodeState` / `decodeState` in
`src/features/party/PartyContext.tsx`).

## Wer schreibt was (Host-Autorität)

Es gibt genau eine Instanz, die den Reducer ausführt: den Host.

- Alle Clients schreiben ihre Aktionen nach `inbox/`.
- Der Host liest die Inbox, wendet `game.reduce()` an, schreibt den neuen `game/state`
  und löscht die verarbeiteten Einträge.
- Der Host selbst rechnet direkt und spart sich die Runde über die Inbox.

Das hält Zufall (Kartenmischen, Bombentimer) an einer Stelle und verhindert, dass zwei
Geräte gleichzeitig widersprüchliche Zustände schreiben.

**Host-Übergabe:** Meldet sich der Host 45 Sekunden nicht (`lastSeen`), übernimmt der
Spieler mit dem ältesten `joinedAt` per Transaktion. Niemand muss die Runde neu starten,
wenn dem Host das Handy ausgeht.

## Aufräumen

Die Realtime Database kennt kein TTL. Deshalb:

- Jede Lobby trägt `expiresAt` (jetzt + 8 Stunden), das der Host bei jedem Heartbeat
  verlängert.
- Die Security Rules verbieten Schreibzugriffe auf abgelaufene Lobbys. Der Code wird damit
  wieder frei, ohne dass jemand aufräumen muss.
- Spieler, die drei Heartbeat-Intervalle (~90 s) still sind, entfernt der Host aus der
  Spielerliste.

Wer die Datenbank wirklich leer haben will, kann einen [Cloud-Function-Cronjob][cf] auf
`expiresAt` setzen — das braucht allerdings den Blaze-Tarif.

[cf]: https://firebase.google.com/docs/functions/schedule-functions

## Security Rules setzen (einmalig, sonst geht die Lobby nicht)

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only database        # nutzt firebase.json + database.rules.json
```

Alternativ in der Firebase-Konsole unter **Realtime Database → Regeln** den Inhalt von
`database.rules.json` einfügen und veröffentlichen.

### Was die Rules tun

- `.read` / `.write` sind auf oberster Ebene **aus**. Nur unterhalb von `lobbies/<CODE>`
  wird gearbeitet, und nur wenn der Code dem Muster `[A-Z0-9]{4,6}` entspricht.
- Schreiben ist gesperrt, sobald `meta/expiresAt` in der Vergangenheit liegt.
- `expiresAt` darf höchstens 12 Stunden in der Zukunft liegen — niemand kann eine Lobby
  dauerhaft blockieren.
- Feldweise Validierung: Namen maximal 24 Zeichen, Emojis maximal 8, keine unbekannten
  Felder (`$other: false`).

### Was die Rules bewusst nicht tun

Es gibt keine Authentifizierung. Wer einen gültigen Lobby-Code errät, kann mitlesen und
mitschreiben. Bei vier Zeichen aus 32 Symbolen sind das rund eine Million Kombinationen —
für eine Party unter Freunden ausreichend, für sensible Daten nicht. Genau deshalb liegen
in der Lobby ausschließlich Spitzname, Emoji und Spielzustand.

Wenn das später härter werden soll: anonyme Firebase-Auth einschalten (`signInAnonymously`),
in den Rules `auth != null` verlangen und `players/$playerId` an `auth.uid` binden. Der
Client bräuchte dann zusätzlich den Web-API-Key in `src/lib/firebase.ts`.

## Kosten

Spark (kostenlos) deckt 100 gleichzeitige Verbindungen, 1 GB Speicher und 10 GB Download
pro Monat ab. Eine Lobby mit 16 Spielern belegt 16 Verbindungen — es können also rund sechs
Partys gleichzeitig laufen. Der Spielzustand liegt im Bereich weniger Kilobyte pro Lobby.
