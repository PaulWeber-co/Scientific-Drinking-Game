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
    players/  { <auth.uid>: { id, name, color, drinkIcon, driver, zone,
                              joinedAt, lastSeen, online, shots } }
    avatars/  { <auth.uid>: "data:image/jpeg;base64,…" }
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

- Jede Lobby trägt `expiresAt` (jetzt + 8 Stunden), das der Host alle 40 Sekunden
  verlängert.
- Die Security Rules verbieten Schreibzugriffe auf abgelaufene Lobbys – auch das
  Neuanlegen unter demselben Code. Ihr Code bleibt belegt, bis die Cloud Function sie
  löscht. `createOnline` legt deshalb nur auf einem leeren Pfad an und würfelt sonst neu.
- Spieler, die länger als drei `PLAYER_STALE_MS` (~4,5 Minuten) still sind, entfernt der
  Host aus der Spielerliste. Kommt das Gerät zurück, trägt es der nächste Heartbeat
  vollständig wieder ein.
- Wer eine Lobby verlässt, nimmt seinen Eintrag mit. Geht die letzte aktive Person, wird
  die ganze Lobby gelöscht.

Lobbys, die niemand verlässt (App einfach zugemacht), räumt der
[Cloud-Function-Cronjob][cf] `cleanupLobbies` (stündlich, `functions/cleanup.js`) ab –
pro Lobby per Transaktion, damit eine inzwischen unter demselben Code neu angelegte Lobby
stehen bleibt. `cleanupAnonymousUsers` löscht täglich anonyme Anmeldungen, die 30 Tage
nicht benutzt wurden.

[cf]: https://firebase.google.com/docs/functions/schedule-functions

## Einrichtung (einmalig, sonst geht die Lobby nicht)

Die Lobby läuft seit dem Security-Audit (siehe `SECURITY_AUDIT.md`) mit **anonymer
Anmeldung**. Reihenfolge einhalten – erst der Client mit Key, dann die neuen Rules:

1. **Anonyme Anmeldung aktivieren:** Firebase-Konsole → Authentication → Sign-in method →
   *Anonym* einschalten.
2. **Web-API-Key eintragen:** Projekteinstellungen → Allgemein → Web-App → `apiKey`.
   Der Key ist kein Geheimnis (er steht in jedem Firebase-Client), gehört aber in der
   Google-Cloud-Konsole unter *APIs & Dienste → Anmeldedaten* eingeschränkt:
   HTTP-Referrer auf die eigene Domain (z. B. `https://paulweber-co.github.io/*`) und
   API-Einschränkung auf *Identity Toolkit API* und *Token Service API*.
   - Lokal: `.env.local` mit `VITE_FIREBASE_API_KEY=…` (Vorlage: `.env.example`).
   - GitHub Pages: Repository → Settings → Secrets and variables → Actions →
     **Variables** → `FIREBASE_API_KEY`. `deploy.yml` reicht ihn an den Build weiter.
3. **Client deployen** (Push auf `main`) und warten, bis die neue Version ausgeliefert ist.
4. **Rules und Functions deployen:**

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only database,functions   # nutzt firebase.json + database.rules.json
```

Ohne Schritt 1–3 lehnen die neuen Rules jeden Zugriff ab; die App meldet dann
„Online-Lobby ist nicht eingerichtet“. Pass & Play funktioniert ohne Firebase weiter.

### Was die Rules tun

- `.read` / `.write` sind auf oberster Ebene **aus**. Gearbeitet wird nur unterhalb von
  `lobbies/<CODE>` mit sechsstelligem Code (`[A-Z0-9]{6}`) – und nur **angemeldet**
  (`auth != null`). Alle Lobbys auflisten geht nicht.
- **Lesen:** wer angemeldet ist und den Code kennt. Der Code ist die Einladung – wer ihn
  hat, darf beitreten und sieht damit ohnehin alles.
- **Anlegen:** nur auf einem freien Code und nur mit sich selbst als Host und Spieler
  (atomar per Transaktion – zwei Geräte mit demselben Code überschreiben sich nicht mehr).
- **Eigener Spielereintrag / eigenes Profilbild:** nur unter der eigenen `auth.uid`.
  Fremde Einträge ändern oder löschen darf nur der Host (Inaktive entfernen).
- **Host-Posten (`meta/host`):** nur die eigene UID, nur als Mitglied und nur, wenn der
  bisherige Host fehlt oder 45 Sekunden still ist. Ein alter Host verliert damit
  serverseitig das Schreibrecht auf den Spielstand.
- **`meta`, `game`:** Host; Mitglieder dürfen nur eine Runde *starten*, solange keine
  läuft. Lobby verlängern (`expiresAt`) und Film setzen: nur der Host.
- **`inbox`:** Mitglieder legen neue Nachrichten an, `by` muss die eigene UID sein.
  Löschen darf nur der Host.
- **Lobby löschen:** Host – oder ein Mitglied, wenn der Host verschwunden ist.
- Schreiben ist gesperrt, sobald `meta/expiresAt` in der Vergangenheit liegt;
  `expiresAt` höchstens 12 Stunden, `lastSeen`/`joinedAt`/`at` höchstens 10 Minuten in
  der Zukunft.
- Feldweise Validierung: Namen maximal 24 Zeichen, Getränke-Symbol maximal 24, Zone
  maximal 12, Profilbild nur als JPEG-Data-URL bis 24 000 Zeichen, keine unbekannten
  Felder (`$other: false`).

Geprüft wird das gegen den echten Database-Emulator: `npm run test:rules` (braucht
Java; lädt den Emulator mit fester Prüfsumme). Läuft auch in der CI.

### Was die Rules bewusst nicht tun

- Mitglieder sehen den ganzen Spielstand, auch „geheime“ Karten anderer (Stichmagie,
  Lückenfüller). Das zu ändern bräuchte private Pfade pro Spieler und eine
  vertrauenswürdige Auswertung – offen, siehe `SECURITY_AUDIT.md`.
- Es gibt keine Mengenbegrenzung pro Lobby (Spieler, Inbox-Nachrichten). Dafür:
  App Check und Budget-Alarme im Firebase-Projekt (manuell).

## Kosten

Spark (kostenlos) deckt 100 gleichzeitige Verbindungen, 1 GB Speicher und 10 GB Download
pro Monat ab. Eine Lobby mit 16 Spielern belegt 16 Verbindungen — es können also rund sechs
Partys gleichzeitig laufen. Der Spielzustand liegt im Bereich weniger Kilobyte pro Lobby.
