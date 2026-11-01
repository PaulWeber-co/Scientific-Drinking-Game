# Pegel – separater Sicherheitsbericht

> Archivierter Audit vom 1. November 2026. Zugehörige HTML-Berichte, Testskripte, Messwerte und Nachweise liegen vollständig im [Audit-Paket](pegel-audit.zip). Lokale Dateiverweise beziehen sich auf den Inhalt dieses ZIPs.

**Stand:** 1. November 2026 · **Commit:** `018c2d33f980bf1b746352fded27267985c21d0d`.

**Ergebnis: Öffentlicher Online-Launch vor Behebung von S01 nicht freigegeben.** Die Repository-Rules erlauben ohne Authentifizierung weitreichende Zugriffe auf bekannte Räume. Die produktiv deployten Rules wurden nicht ausgelesen; ein produktiver Angriff oder Datenabfluss wurde nicht festgestellt.

Dies ist der gesonderte Security-Teil des [vollständigen Audits](AUDIT.md). Anwendungscode, Rules und Lockfiles blieben unverändert. Keine Produktionsdatenbankzugriffe, Cloud-Lasttests, Deployments oder Veröffentlichung.

## Leseschlüssel und Prüfgrenzen

- **NACHGEWIESEN – Test:** Mit vorhandenen Tests, echtem lokalen Browser oder einer ausdrücklich beschriebenen isolierten Reproduktion bestätigt.
- **NACHGEWIESEN – Code:** Die Eigenschaft folgt unmittelbar aus dem geprüften Quellcode beziehungsweise der Konfiguration. Das bestätigt nicht, dass genau diese Konfiguration produktiv deployt ist.
- **UNBESTÄTIGT:** Plausibles Risiko, offene Betriebs-/Rechtsfrage oder noch nicht ausgeführtes Szenario. Keine Behauptung eines bereits eingetretenen Vorfalls.
- **VERBESSERUNG / OPTIONAL:** Architektur- beziehungsweise Komfortmaßnahme ohne belegten Fehler.
- **GUT IMPLEMENTIERT:** Nachweisbar vorhandener Schutz oder funktionierende Komponente, jeweils innerhalb der angegebenen Prüfgrenzen.

Die Inventur umfasst alle **671 versionierten Dateien**, **301 Dateien unter `src/`**, **87 Testdateien**, beide Lockfiles, Rules, Functions, CI, Assets und die lokale Git-Historie mit **124 Commits**. Unter `src/` liegen rund **58.048 Zeilen TypeScript, TSX und CSS**, einschließlich Test- und Inhaltsdaten. Die manuelle Tiefenprüfung konzentriert sich auf Vertrauensgrenzen, zentrale Datenpfade, Multiplayer-Protokoll, Gesundheitsdaten und Releasefunktionen. Nicht jede einzelne Spielkarte wurde redaktionell oder juristisch freigegeben. Eine vollständige Funktions- oder Sicherheitsgarantie ist daraus nicht ableitbar.

**Wesentliche Lücken:** Kein Firebase-Administrationszugriff, keine ausgelesenen deployten Rules, keine Abrechnungs-/Monitoringdaten, keine Gerätefarm, kein macOS/Xcode und keine signierten nativen Artefakte. GitHub-Metadaten bestätigen ein öffentliches Repository; Branch Protection, Secret-Scanning-Konfiguration, Repository-Secrets und Actions-Einstellungen sind über die verfügbaren normalisierten Connector-Daten nicht nachgewiesen. Fehlende Nachweise werden nicht als abgeschaltete Kontrollen ausgegeben.

Die Emulator Suite konnte nicht starten: Der Download des offiziellen Database-Emulators von `storage.googleapis.com` wurde vom ausgehenden Netzwerkproxy mit **HTTP 403** blockiert. Die reproduzierbaren Tests liegen vor, **wurden aber nicht ausgeführt**. Es handelt sich um eine Netzwerkeinschränkung der Audit-Umgebung, nicht um einen Fehler der App.

## Priorisierte Sicherheits- und Integritätsbefunde

Aufwand in Entwicklertagen (ET), ohne externe Freigaben; überlappende Änderungen nicht doppelt addieren.

| ID | Priorität | Kategorie / Status | Problem | Evidenz | Auswirkung | Aufwand | Empfehlung |
|---|---|---|---|---|---|---|---|
| S01 | **P0** | Security, Code nachgewiesen | Jeder mit Raumcode darf fremde Daten lesen, ändern, übernehmen und löschen | [database.rules.json:10–11](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/database.rules.json#L10-L11), [src/lib/firebase.ts:20](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/lib/firebase.ts#L20) | Vertraulichkeits-, Integritäts- und Verfügbarkeitsverlust ganzer Runden | 3–6 ET Basis; Serveraktionen zusätzlich | Auth, Mitgliederrechte, keine breite Elternfreigabe; Emulator-Negativtests |
| M01 | **P1** | Datenintegrität, Browsertest nachgewiesen | Zweiter Tab überschreibt Trinklog des ersten | [src/store/player.ts:106](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/store/player.ts#L106), [src/lib/id.ts:21](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/lib/id.ts#L21); `two-tabs-results.json` | Fehlende Getränke in Persistenz, unvollständige Grundlage der Schätzung | 1–3 ET | Eine schreibende Instanz oder transaktionales lokales Eventjournal |
| S02 | P1 | Abuse, fehlende Kontrollen nachgewiesen | Keine Nutzer-/Raumquoten; beliebig viele Player-/Inbox-Kinder | [database.rules.json:34](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/database.rules.json#L34), `:68` | Spam, Überlastung, Kosten; Angriff nicht durchgeführt | 2–5 ET | Raum-/Beitrittskontrolle serverseitig, Größen-/Zeitbudgets und App Check ergänzen |
| S03 | P1 | Spielfairness, Code nachgewiesen | Geheime Hände im für alle lesbaren Gesamtzustand | [src/games/stichmagie/game.ts:229](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/games/stichmagie/game.ts#L229), [src/games/lueckenfueller/index.tsx:64](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/games/lueckenfueller/index.tsx#L64), [src/features/party/PartyContext.tsx:414](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L414) | Teilnehmer können fremde Karten auslesen | 3–7 ET je nach Spielen | Private Spieleransichten und vertrauenswürdige Auswertung |
| M02 | P1 | Nebenläufigkeit, Protokolllücke nachgewiesen; Timing UNBESTÄTIGT | Raumerstellung ist `get` gefolgt von überschreibendem `set` | [src/features/party/PartyContext.tsx:320–354](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L320-L354) | Zwei Ersteller desselben Codes verlieren die erste Lobby | 0,5–1,5 ET | Atomare Reservierung; nur bei Nichtvorhandensein anlegen |
| M03 | P1 | Nebenläufigkeit, Protokolllücke nachgewiesen | Zustandsschreiben und Inbox-Löschen nicht atomar; `seen` nur im RAM; Nachricht ohne Round-ID | [src/features/party/PartyContext.tsx:625](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L625), `:652–654`, `:847` | Wiederholung nach Absturz, verspätete Aktion in neuer Runde möglich; Betriebsvorfall UNBESTÄTIGT | 3–5 ET mit M04 | Persistente actionId, roundId, Revision; atomar State und Ack schreiben |
| M04 | P1 | Nebenläufigkeit, Code nachgewiesen | Hostwechsel schützt nur `meta/host`; bereits laufender alter Hostjob ist nicht serverseitig eingezäunt | [src/features/party/PartyContext.tsx:563](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L563), `:585–614` | Veralteter Host kann neueren Zustand überschreiben | 2–4 ET mit M03 | Host-Epoche/Lease und Versionsprüfung in derselben Transaktion |
| S04 | P1 | Validierung, Code nachgewiesen | `state` und `action` nur Stringlänge, kein JSON-/Spielschemaschutz | [database.rules.json:63](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/database.rules.json#L63), `:73`; [src/features/party/PartyContext.tsx:1030](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L1030) | Beliebige Spielzustände akzeptierbar; konkreter UI-Absturz je Zustand UNBESTÄTIGT | 2–4 ET | Server-Schemas je Aktion und Zustand; Protokollversion |
| L01 | P1 | Datenschutz, Übertragung nachgewiesen; Rechtsgrundlage UNBESTÄTIGT | Alkohol-Zone geht regelmäßig mit Identität an RTDB; Art.-9-Bewertung fehlt | [src/features/party/PartyContext.tsx:485–509](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L485-L509), [src/legal/site.ts:118–125](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/legal/site.ts#L118-L125) | Sensible Datenverarbeitung, unzutreffende Sicherheits-/Anonymitätsannahme | 1–3 ET + Rechtsprüfung | Zone möglichst entfernen, sonst getrennte ausdrückliche Freigabe und tragfähige Grundlagen |
| L03 | P1 | Löschung, Betrieb UNBESTÄTIGT | Datenschutzerklärung verspricht zeitnahe Löschung; deployter Cleanup nicht belegt | [src/legal/site.ts:125](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/legal/site.ts#L125), [functions/index.js:25](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/functions/index.js#L25), [firebase.json](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/firebase.json) | Aufbewahrung kann Zusagen überschreiten | 1–2 ET | Deployment-/Ausführungsnachweis, Alarm, präzise Fristbeschreibung |
| D01 | P1 | Supply Chain, Auditmeldungen nachgewiesen | 47 gemeldete Pakete im Hauptprojekt, 14 im Functions-Lockfile | npm-Audit-JSONs, beide Lockfiles | Unterschiedliche Dev-/Runtime-Risiken; Ausnutzbarkeit nicht pauschal bestätigt | 1–3 ET | Triage, gezielte Updates, Tests; keine blinde `audit fix --force`-Ausführung |
| O01 | P1 | QA/CI, Code nachgewiesen | Vorhandene PR-CI prüft keine echten Rules oder Functions; Multiplayer überwiegend gemockt | [src/features/party/online.test.tsx:65](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/online.test.tsx#L65), [.github/workflows/ci.yml:3–21](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/.github/workflows/ci.yml#L3-L21), [functions/package.json](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/functions/package.json) | Regressionen an Vertrauensgrenzen werden von bisherigen Checks nicht erkannt | 1–3 ET | Bestehende PR-CI um Rules-, Protokoll- und Functions-Prüfungen ergänzen |
| M05 | P2 | Verteilung/Zeiten, UNBESTÄTIGT | Hostwahl, Presence, Ablauf und Reihenfolge verlassen sich auf Clientzeit | [src/features/party/PartyContext.tsx:503](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L503), `:557`, `:633` | Uhrabweichungen, verspätete Events, falsche Hostwahl | 1–2 ET | Serverzeit/Offset für Anzeige, serverseitige Sequenz und Lease |
| M06 | P2 | Lebenszyklus, Code/Reproduktion | Letzter-Teilnehmer-Löschung nutzt alten Snapshot; Cleanup kann neu angelegten Ersatzraum löschen | [src/features/party/PartyContext.tsx:680–685](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/features/party/PartyContext.tsx#L680-L685); [functions/index.js:14–19](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/functions/index.js#L14-L19) | Seltene Löschrennen; Cleanup mit Fake-DB reproduziert | 1–2 ET | Transaktion mit Raumgeneration und erneut geprüfter Ablaufzeit |

## Konkrete Reproduktionen und Abnahmekriterien

**S01/S02/S04 – Zugriffe ohne Identitätsnachweis.** Nach den vorhandenen Rules genügt ein sechsstelliger gültiger Pfad. Anlegen einer gültigen Lobby, Lesen des gesamten Raums, Ersetzen von `meta/host`, Schreiben auf `players/<fremde-id>/name`, Setzen von `game/state` auf einen beliebigen kurzen String und Löschen des Raums sind durch die Elternregel autorisiert. Bei Löschung greifen `.validate`-Regeln nicht als Löschschutz. Die Root-Regel verhindert zwar das Auflisten sämtlicher Lobbys; sie verhindert nicht den Einzelzugriff auf einen bekannten oder erratenen Code. Das Script `tests/rules-audit.mjs` enthält diese Fälle und negative Kontrollen für unzulässige Felder/Überlängen. Es ist ausschließlich auf `127.0.0.1:9000` und ein `demo-`-Projekt eingestellt. **Nicht ausgeführt wegen Emulator-Downloadblockade.** Nach der Korrektur müssen nicht autorisierte Reads/Writes/Löschungen scheitern; erlaubte eigene Aktionen müssen funktionieren. Ein bloß längerer Code behebt das Rechteproblem nicht.

**M01 – echter Tab-Datenverlust.** Zwei Tabs desselben Browserkontexts laden dasselbe leere Profil. Tab A trägt über „Getränk eintragen“ ein Glas ein. Tab B trägt anschließend ein Glas ein, ohne neu zu laden. Erwartung: zwei Ereignisse. Ergebnis: **ein Ereignis, erste ID nicht mehr vorhanden**. Beide Tabs besitzen eigene Zustand-Instanzen; `persist` schreibt jeweils den eigenen Gesamtstand in denselben Storage-Key. Es existiert keine tabübergreifende Synchronisation. Das kann über verlorene Getränke indirekt auch eine zu niedrige Schätzung erzeugen; dieser Folgeeffekt wurde nicht als medizinische Messung getestet. Lösung: entweder zweite schreibende Instanz blockieren (mit robuster Ownership/Lease), oder append-only Events in IndexedDB mit eindeutigen IDs und Transaktionen; BroadcastChannel allein ist keine Transaktion. Abnahme: parallel 100 Events, alle genau einmal; Reload, Tababsturz, Undo und Nachtwechsel erhalten Konsistenz.

**M02 – Raumerstellung.** Zwei Clients erhalten für denselben noch freien Code einen leeren `get`-Snapshot. Beide `set`-Aufrufe sind zulässig; der zweite ersetzt die erste Lobby. Das Kryptozufallsverfahren reduziert Kollisionswahrscheinlichkeit, beseitigt das Race nicht. Lösung: `runTransaction`/serverseitige Transaktion, die nur bei `current === null` anlegt; begrenzte Wiederholungen bei Kollision. Bei Client-Transaktionen keine zufällige Neuberechnung im Retry-Callback. Ein Testszenario erzwingt denselben Code, statt auf einen zufälligen Treffer zu warten.

**M03/M04 – Aktion, Ack und Autorität.** Ein Host schreibt den neuen State (`:613`), stürzt vor `remove(inbox/key)` ab (`:654`), und ein neuer Host liest die Nachricht erneut. Das flüchtige `seen`-Set kennt sie nicht. Nicht idempotente Aktionen können doppelt wirken. Zusätzlich enthält die transportierte Nachricht keine Round-ID; ein verspäteter Offline-Push kann nach Start einer anderen Runde ankommen. Die Hostrolle wird zu Beginn des Effects geprüft, aber der bereits gestartete asynchrone Job erhält keine serverseitige Absicherung gegen eine inzwischen gewechselte Rolle. Diese Protokollpfade sind im Code belegt, die zeitlichen Abläufe wurden nicht mit echten Firebase-Clients ausgeführt.

Zielstruktur, als **Entwurf**, nicht als angewendeter Patch:

```ts
type ActionEnvelope = {
  roomId: string;
  roomGeneration: string;
  roundId: string;
  actionId: string;
  expectedRevision: number;
  type: string;
  payload: unknown;
};
// Im vertrauenswürdigen Handler:
// Identität aus Auth, nicht aus payload.by.
// Mitgliedschaft, Schema, erlaubte Aktion, Runde und Revision prüfen.
// State + neue Revision + verarbeitete actionId atomar persistieren.
// Wiederholte actionId liefert dieselbe Antwort, ohne die Aktion erneut auszuführen.
```

**M06 – präzise Reichweite des Löschrennens.** Ein gewöhnlicher Client kann eine bereits abgelaufene Lobby nach den vorhandenen Rules nicht einfach verlängern. Das isoliert reproduzierte Problem betrifft einen inzwischen **gelöschten und unter demselben Code neu angelegten Ersatzraum**, nachdem der Cleanup seinen Query-Snapshot aufgenommen hat. Die Function löscht anschließend nur anhand des Codes. Das ist selten, aber mit einer unveränderlichen Raumgeneration und einer transaktionalen erneuten Prüfung behebbar. Zusätzlich kann `leave()` eine gerade beitretende Person übersehen, wenn der lokale Snapshot noch keinen weiteren Spieler enthält.

**R02 – tatsächliche Altersgrenze.** Die Prüfung `age < 18` verbirgt den Schalter auf dem lokalen Gerät. Die Deck-Erstellung liest aber die Einstellung des startenden Geräts, und die Online-Spielerliste führt keine gruppenweite Inhaltsfreigabe. Ein jüngerer Teilnehmer kann damit Inhalte eines von einem Erwachsenen gestarteten Spicy-Spiels erhalten, ohne selbst einen Schalter manipuliert zu haben. Die technische Schutzlücke ist belegt; welche Inhalte rechtlich oder im Store unzulässig sind, muss einzeln geprüft werden. Ein geeignetes Design fragt nach Inhaltsfreigabe, nicht nach Übertragung vollständiger Geburtsdaten.

## Sicherheitskontrollen und tatsächlich ausgeführte Prüfungen

### Sicherheitslage und Angriffsvoraussetzungen

| Bereich | Bewertung, Bedingung und Nachweis | Maßnahme |
|---|---|---|
| Broken Access Control / IDOR | Kritisch: Kenntnis eines gültigen Lobby-Codes genügt; kein Auth-Token erforderlich. S01. | UID-basierte Mitgliedschaft und untergeordnete Schreibrechte |
| Authentication / Session | Kein Accountsystem; lokale Geräte-ID ist kein Token. Behauptete IDs lassen sich direkt setzen, Inbox-`by` ist nicht gebunden. | Anonyme Auth genügt für den Start; Gerätekennung nur als UI-/Installationsmerkmal |
| Privilegieneskalation | `meta/host` ist wie andere Felder frei beschreibbar. Clientseitiges `isHost` schützt die API nicht. | Serverentscheidung über Hostwechsel, Lease-Epoche |
| Vertrauliche Spielinformationen | Kartenhände werden gemeinsam repliziert. Auch korrekte Auth allein würde das nicht beheben. | Private Pfade/Sichten; Server übernimmt notwendige Geheimhaltung |
| Eingabevalidierung | Typ-/Längen-/Feldlisten sind vorhanden, aber Anzahl und semantisches JSON fehlen. | Schemata für bekannte Aktionen, Feldgrenzen und Gesamtbudgets |
| XSS | Kein belegter XSS-Pfad. Keine produktiven `dangerouslySetInnerHTML`-/`innerHTML`-Sinks in den durchsuchten Quellen gefunden; React rendert Texte regulär escaped. | Beibehalten; individuelle URL-/Avatar-/UGC-Pfade weiter negativ testen |
| Injection / SSRF | Keine SQL-Abfragen, kein frei wählbarer serverseitiger Fetch-Endpunkt im untersuchten Laufzeitcode. Kein Nachweis einer SQL-Injection oder SSRF. | Beim späteren Backend neue Angriffsfläche ausdrücklich prüfen |
| Dateiuploads | Avatar wird lokal zu JPEG verarbeitet und begrenzt. Rules prüfen Data-URL-Präfix/Länge, keine tatsächliche Dekodierbarkeit. Elternfreigabe gilt auch hier. | Eigener Avatarpfad, sichere Bildprüfung falls serverseitig verarbeitet; kein unnötiger Uploaddienst |
| Secrets | 1.287 lokale historische Textblobs auf erkennbare Private-Key-, GitHub-Token-, AWS-Key- und Service-Account-Formate geprüft: kein Treffer. Kein vollständiger Entropie-/Provider-Scan. | GitHub Secret Scanning verifizieren; bei tatsächlichem Fund erst widerrufen, dann Historie bereinigen |
| API-Key/DB-URL | Datenbankadresse ist öffentlicher Client-Konfigurationswert, kein kompromittiertes Secret. Kein Schlüssel muss allein wegen dieser URL rotiert werden. | Zugriff mit Rules absichern, keine „URL verstecken“-Scheinlösung |
| Transport/Headers | SDK-URL verwendet HTTPS. In Repository/HTML keine CSP-Konfiguration; produktive Response-Header nicht geprüft. | CSP/Referrer-Policy/Permissions-Policy am gewählten Hosting prüfen; keine Behauptung fehlender produktiver HSTS |
| Abuse/Kosten | Kein App-Check-Code, kein verifizierter Enforcementschutz, keine API-Ratelimits. Sechsstellige Codes sind kein generelles Schutzsystem. | App Check als Zusatz, serverseitige Erstell-/Joinlimits, Kapazitäts- und Budgetalarme |
| Native Sicherheit | Aktuell keine nativen Projekte. Zertifikate, Keychain/Keystore, Backup-Ausschlüsse, WebView-Bridge und Release-Debugging noch nicht prüfbar. | MASVS-orientierter Durchgang nach Capacitor-Integration |

Die Prüforientierung ist [OWASP Top 10 2025](https://owasp.org/projects/top-ten), [ASVS 5.0.0](https://asvs.owasp.org/) und für die spätere native App [OWASP MASVS](https://mas.owasp.org/MASVS/). Das ist keine Behauptung einer vollständigen ASVS-/MASVS-Konformitätsprüfung. Relevant sind insbesondere Zugriffskontrolle, sichere Architektur, Konfiguration, Supply Chain, Validierung, Fehlerbehandlung und Logging. Eine isolierte Auswahl von Tests ersetzt keine normative Anforderungsmatrix.

### Acht konkret angefragte Rechteprüfungen

Bewertung gilt für **Repository-Rules**, nicht für unzugängliche produktive Konfiguration:

| Kann ein normaler/unauthentifizierter Nutzer … | Ergebnis |
|---|---|
| Andere Nutzer lesen? | **Ja**, innerhalb eines bekannten Raumcodes; kein globales Listing aller Räume. |
| Andere Nutzer verändern? | **Ja**, unter Beachtung der vorhandenen Feld-/Typvalidierung. |
| Fremde Sessions übernehmen? | **Ja**, Hostfeld und Spielzustand können überschrieben werden. |
| Administrative Funktionen auslösen? | Hostähnliche Spielfunktionen ja; kein Nachweis eines Zugriffs auf GCP-IAM, Scheduler-Verwaltung oder Firebase-Admin-API. |
| Fremde Daten löschen? | **Ja**, die Elternfreigabe und explizite Löschbedingung erlauben dies. |
| Eigene Rechte erhöhen? | **Ja**, Hostrolle frei setzbar; keine tatsächliche Identitätsbindung. |
| Unbegrenzt Daten erzeugen? | Praktisch unbeschränkt durch Nutzer-/Zeitquoten; technische RTDB-/Schlüssel-/Payloadgrenzen bleiben bestehen. |
| Ungültige/übergroße Daten einschleusen? | Ungültiges JSON innerhalb erlaubter Stringlänge ja; einzelne Überlängen/unerwartete Felder werden begrenzt, Gesamtkindanzahl nicht. |

### Dependency- und Buildprüfung

| Prüfung | Tatsächliches Ergebnis | Aussagegrenze |
|---|---|---|
| `npm test` | **87 Dateien, 1.048 Tests bestanden**, 103,58 s | Unit-/Komponententests; Multiplayer größtenteils Mocks |
| `npm run lint` | Exit 0 | Kein Sicherheitsbeweis |
| `npm run build` | TypeScript + Vite erfolgreich | Keine native Kompilierung |
| Sauberer Install-/Buildlauf | `npm ci --ignore-scripts`, anschließend Build in separater Kopie erfolgreich; **390/390 Dateien byteidentisch** | Linux/Node 24; kein plattformübergreifender Reproduzierbarkeitsbeweis |
| `npm audit` Hauptprojekt | **47 Paketmeldungen:** 2 kritisch, 18 hoch, 21 mittel, 6 niedrig | Transitive Sammelmeldungen, keine 47 unabhängigen ausnutzbaren App-Lücken |
| `npm audit --omit=dev` | **5 hohe Paketmeldungen** | Firebase/Firestore-Abhängigkeitszweig; Firestore nicht von der App importiert |
| `npm audit` Functions | **14 Paketmeldungen:** 3 hoch, 11 mittel | Deployment und konkrete Ausnutzbarkeit offen |
| Lokaler historischer Musterscan | 1.287 Textblobs, kein Treffer der geprüften Credentialformate | Nur lokal erreichbare Historie; keine GitHub-Secrets/gelöschten Remote-Refs |
| Zusätzliche Stategrößen-Prüfung | 20 reale `createState`-Funktionen ausgeführt; **140–4.378 UTF-8-Bytes** bei sechs synthetischen Spielern | Initialzustände, keine über Stunden gewachsenen Zustände |
| Browser | Chromium, sechs Ansichten und drei weitere Breiten; keine JavaScript-Pageerrors in diesen Flows | Kein Safari-/Android-/iOS-Hardwaretest |
| Zwei Tabs | **Datenverlust reproduziert** | Lokale Browserpersistenz, keine Firebase-Verbindung |
| Cleanup-Race | Originalfunktion im isolierten VM-Harness mit Fake-DB: Ersatzraum wird gelöscht | Kontrollierte Interleaving-Reproduktion, kein Firebase-Test |
| Rules-Emulator | 20 Fälle vorbereitet; **nicht ausgeführt** | Emulator-Download HTTP 403 |
| Last/Kapazität | **Keine Produktions- oder Staginglasttests** | Nur Rechenmodell und ausformulierter Plan |

Die beiden kritischen npm-Sammelmeldungen betreffen **Vitest/Tinypool im Entwicklungszweig**. Tinypool-Advisories beschreiben RCE-Gadgets unter zusätzlichen Bedingungen wie Prototype Pollution/gefährlichen Workeroptionen; daraus folgt keine Browser-RCE in der veröffentlichten PWA. Die fünf Produktionsmeldungen laufen über `firebase → @firebase/firestore → @grpc/grpc-js/re2js`. Im Appcode wird RTDB verwendet. Erreichbarkeit und ausgelieferte Module müssen getrennt von der Lockfilemeldung beurteilt werden. In Functions sind unter anderem Express/body-parser betroffen; der vorhandene Export ist eine geplante Cleanup-Funktion, kein selbst definierter öffentlicher Formularendpunkt. Trotzdem sind zeitnahe geprüfte Updates sinnvoll.

Die konkreten Advisory-URLs und betroffenen Versionen stehen in den Audit-JSONs. Beispiele: [Tinypool](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [Vitest Mocker](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [RE2JS](https://github.com/advisories/GHSA-gg6h-894w-4m9c). Kein Lockfile wurde durch das Audit geändert.

Lockfile-Lizenzmetadaten sind überwiegend MIT/Apache/BSD/ISC; außerdem sind u. a. BlueOak, Python-2.0 und CC-BY-4.0 enthalten. Keine Copyleft-Inkompatibilität wurde damit nachgewiesen. Eine SBOM und NOTICE-Zusammenstellung müssen direkte und tatsächlich ausgelieferte transitive Komponenten getrennt erfassen. **Die Bildrechte sind davon unabhängig.** Lokal mitgelieferte Schriftlizenzen sind positiv vorhanden.

### Automatisierte Tests und Testpyramide

Die bestehende Testbasis sollte erhalten bleiben. Priorität haben ergänzende Tests an den bisher nicht geprüften Grenzen:

| Ebene | Konkrete Fälle | Abnahmekriterium |
|---|---|---|
| Unit | Reducer, Grenzen/ungültige Aktionen, Zeit-/Round-ID-Wechsel, lokale Eventjournal-Merges | Keine mutierbaren Fremdzustände; nachvollziehbare Fehler statt stiller Beschädigung |
| Rules positiv | Authentifizierter Raumersteller, Mitglied liest öffentlichen State, eigene Presence, eigene erlaubte Aktion, eigener Austritt | Legitime Wege funktionieren mit echten Rules |
| Rules negativ | unauthentifiziert, anderer Raum, fremder Playerpfad, fremder Avatar, fremde Hand, gefälschter Absender, Hostübernahme, zu große Payload/Anzahl, unbekannte Felder | Alle unzulässigen Versuche werden vom Emulator abgewiesen |
| Protokollintegration | Zwei gleichzeitige Create/Start-Aktionen, duplicate actionId, alter Host nach Failover, Ackverlust, verspätete Inbox-Nachricht nach Rundenwechsel | Genau eine Zustandsänderung pro Aktion, keine alte Runde wird verändert |
| Lebenszyklus | Offline beim Join, Timeout und spätes ACK, Reconnect, App-Kill, letzter Teilnehmer gegen gleichzeitigen Join, TTL/Cleanup gegen neue Raumgeneration | Keine Geisterräume, keine unbemerkten Löschungen oder verspäteten Schreibungen |
| Browser-E2E | Alters-/Modus-Onboarding, Pass & Play, Einladung, zwei Browserkontexte, zwei Tabs, Löschen/Reset/Export | Kritische Journeys einschließlich Wiederanlauf erfolgreich |
| Native | App im Hintergrund, Telefonanruf, Kamera-/Notification-Berechtigung abgelehnt, Filesystem voll, Upgrade, Kaufrestore | Kontrollierter Zustand und verständliche Fehlermeldungen |
| Accessibility | Tastatur, VoiceOver/TalkBack, 200 % Text, Kontrast hell/dunkel, reduzierte Bewegung, 320 px und Querformat | WCAG-2.2-AA-Ziel und Plattformbedienbarkeit überprüft |
| CI | Bestehende Pull-Request-Prüfungen für install, lint, types, unit und build um Rules/Functions und kleine E2E-Suite ergänzen; signierter Build vor Release | Veröffentlichung erst mit vollständigen relevanten Checks |

Registrierungs-/Passwortresettests sind heute **nicht relevant**, weil keine Konten existieren. Nach anonymer Auth werden Tokenwechsel, gelöschter Browserzustand, Authfehler und späteres Verknüpfen eines Kontos relevant. Bloßes Testen einer sichtbaren UI-Sperre reicht bei keiner Berechtigung aus.

Die vorhandenen Listener werden überwiegend sauber abgemeldet; Timer und Sichtbarkeitslistener werden bereinigt. Ein genereller Listener-Leak ist **nicht nachgewiesen**. `withTimeout` beendet allerdings nur das Warten, nicht den Firebase-Schreibauftrag ([src/lib/firebase.ts:36](https://github.com/PaulWeber-co/Scientific-Drinking-Game/blob/018c2d33f980bf1b746352fded27267985c21d0d/src/lib/firebase.ts#L36)). Ein verspätet bestätigter Auftrag nach angezeigtem Timeout ist deshalb als eigener Integrationstest notwendig.

## Freigabekriterien

1. Anonyme Auth und echte Mitglieds-/Hostrechte sind serverseitig durchgesetzt; fremde Räume und Playerpfade werden abgewiesen. Alle legitimen Pfade funktionieren.
2. Create, Runde, actionId, State/Ack und Hostwechsel sind unter konkurrierenden Clients konsistent; doppelte Zustellung verändert den Zustand höchstens einmal.
3. Private Hände liegen in privaten Sichten; Zone und Avatare sind minimiert und nur im freigegebenen Umfang erreichbar.
4. Zwei-Tab-Regression, Reconnect/Failover, manipulierte Eingaben und Cleanup-Rennen werden mit echten Integrationen getestet.
5. Geprüfte Rules-Version, Cleanup-Deployment, Kostenalarme und Abhängigkeits-Triage sind dokumentiert.

Die vorbereiteten Emulatorfälle in `tests/rules-audit.mjs` wurden **nicht ausgeführt**: Der offizielle Emulator-Download wurde mit HTTP 403 blockiert. Manche Fälle erwarten bewusst den unsicheren Ist-Zustand, um ihn zu reproduzieren; sie sind keine Freigabe-Suite für eine gehärtete Version. Nach Korrektur sind diese Erwartungen in serverseitige Ablehnungen umzuwandeln und authentifizierte positive Fälle zu ergänzen.

Reproduktionsbefehle, alle Evidenzdateien, Architektur, Store- und Rechtsfragen stehen im [Hauptbericht](AUDIT.md).
