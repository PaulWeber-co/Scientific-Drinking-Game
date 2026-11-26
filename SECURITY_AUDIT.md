# Security-Audit – Pegel (Scientific Drinking Game)

**Stand:** 26. November 2026 · **Branch:** `security-hardening` (Basis: `main` @ `0d641fe`, inkl. PR #51)
**Vorgänger:** Release-Audit vom 1. November 2026 (PR #45, nicht gemergt) – dessen Befunde S01, S02, S04, M02, M04, M06 sind hier am aktuellen Code nachgeprüft und, wo möglich, behoben.

## Kurzfassung

| | Vorher | Nachher |
|---|---|---|
| Lobby-Zugriff | Wer den 6-stelligen Code kennt, darf **ohne Anmeldung** Host werden, fremde Spieler ändern/löschen, Spielstand überschreiben, im Namen anderer handeln, Lobby löschen | Anonyme Firebase-Anmeldung, jede Schreibung serverseitig an `auth.uid` gebunden; 17 Angriffsfälle im Emulator abgewiesen, 14 legitime Abläufe grün |
| `npm audit` App | 24 Meldungen (2 kritisch, 9 hoch) | **0** |
| `npm audit` Functions | 10 Meldungen (1 hoch) | **0** |
| Security-Header | keine CSP | CSP ohne `unsafe-inline`/`unsafe-eval`, Referrer-Policy, Clickjacking-Schutz (JS), HSTS (GitHub) |
| Secrets im Repo / in der Historie | – | **keine gefunden** (gitleaks 8.28.0, 215 Commits aller Branches + Arbeitsbaum + Audit-ZIP aus PR #45) |
| Tests | 1391 | 1405 Unit/Komponente + 31 Rules-Emulator-Fälle (neuer CI-Job) |

Nichts wurde deployt, keine Produktiv-Datenbank angefasst, keine Dashboard-Einstellung geändert. **Die neuen Database-Rules wirken erst nach dem manuellen Deploy** – Reihenfolge siehe [Manuell zu erledigen](#manuell-zu-erledigen).

## Phase 1 – Bestandsaufnahme

### Stack

| Bereich | Befund |
|---|---|
| Framework | React 19.2.8 + Vite 7.3.8, Single-Page-App mit `HashRouter`, PWA (vite-plugin-pwa/Workbox). **Kein** Next.js, keine Server Components, keine Server Actions. |
| Hosting | GitHub Pages (statisch), Deploy per `.github/workflows/deploy.yml`. Live: `https://paulweber-co.github.io/Scientific-Drinking-Game/` |
| DB / BaaS | Firebase Realtime Database (`scientificgame-5b7e7`, europe-west1). Kein Firestore, kein Storage, kein Supabase. |
| Server-Code | Eine Cloud Function (geplant, stündlich): Lobby-Aufräumen. Jetzt zusätzlich täglich: alte anonyme Konten löschen. Keine HTTP-Endpunkte. |
| Auth | Vorher **keine**. Jetzt anonyme Firebase-Anmeldung, nur für die Online-Lobby. Keine Passwörter, keine E-Mails. |
| Payment | keins |
| LLM | keins |
| Mobile | Capacitor-Plugins im Bundle (`@capacitor/*`), nativer Code nur `native/ios/NativeTabsPlugin.swift`; das eigentliche iOS/Android-Projekt liegt laut PR-#45-Kommentar im Fork (`feat/capacitor`) und ist hier nicht prüfbar. |

### Angriffsfläche

| Fläche | Wo | Bemerkung |
|---|---|---|
| Realtime-Database-Pfade | `database.rules.json`, Client `src/features/party/PartyContext.tsx` | `lobbies/<CODE>/{meta,players,avatars,game,inbox}` – die einzige serverseitige Vertrauensgrenze |
| Cloud Functions | `functions/index.js`, `functions/cleanup.js` | nur zeitgesteuert, Admin-SDK |
| Einladungslink | `src/app/Router.tsx:62` (`?code=`) | Code wird per Regex geprüft, bevor er in einen DB-Pfad geht (`PartyContext.tsx:402`) |
| Uploads | Profilbild (`src/features/profile/portrait.ts`), Kamera/Album (`src/features/camera/*`) | Bild wird im Browser per Canvas neu als JPEG kodiert und verkleinert; Album verlässt das Gerät nie |
| Admin-Bereiche, Webhooks, API-Routen | – | keine |
| Externe Scripts/CDNs | – | keine; Schriften selbst gehostet (`src/assets/fonts`), kein polyfill.io |
| Env-Variablen (alle im Client-Bundle) | `VITE_FIREBASE_DB_URL`, `VITE_FIREBASE_API_KEY` (neu), `VITE_FIREBASE_PROJECT_ID` (neu), `VITE_BASE` | alle öffentlich by design – Firebase-Web-Keys sind keine Geheimnisse, Schutz durch Rules |
| Lokale Speicher | `localStorage`/`sessionStorage` `sdg.*`, IndexedDB `firebaseLocalStorageDb` (neu) | in der Datenschutzerklärung aufgeführt (`src/legal/site.ts`, Test `src/legal/storage.test.ts`) |
| DNS/Domains im Repo | keine `CNAME`-Datei, keine DNS-Konfiguration | nur `*.github.io` und Firebase-Standarddomains |

### Secrets-Scan

- **gitleaks 8.28.0** (offizielles Release, im Scratchpad, nicht ins Repo): `git --log-opts=--all` über alle 215 Commits aller 21 Remote-Branches → **0 Funde**; Arbeitsverzeichnis → **0 Funde**.
- Zusatz-Regex über die komplette Historie (Firebase `AIza…`, `sk_live_`, `ghp_`, AWS, Private Keys, Service-Accounts): **0 Funde**.
- Je hinzugefügte Datei der Historie nach `.env*`, `*.pem`, `*.key`, Service-Account, `*.sql`/`*.bak`/`*.zip`: einziger Treffer `docs/audits/2026-11-01/pegel-audit.zip` auf dem PR-#45-Branch (nicht in `main`) – entpackt und gescannt: **keine Secrets**.
- **Es muss kein Schlüssel rotiert werden.**

### Dependencies (vorher)

App: 24 Meldungen – kritisch `vitest`/`tinypool` (Prototype-Pollution → RCE, Dev), hoch u. a. `vite` 7.3.6, `@grpc/grpc-js` (über ungenutztes Firestore), `re2js`, `source-map-js`, `zod`, `brace-expansion`. Functions: 10 Meldungen, hoch `body-parser` (DoS).

## Phase 2/3 – Checkliste 1–37

Legende: ✅ behoben bzw. erfüllt · ⚠️ offen/teilweise · N/A nicht zutreffend (am Code geprüft)

| # | Punkt | Status | Severity | Datei:Zeile | Änderung / Befund | Test / Nachweis |
|---|---|---|---|---|---|---|
| 1 | Auth-Bypass per Header (CVE-2025-29927, CVE-2025-55182) | N/A | – | `package.json` | Kein Next.js, keine Middleware, keine React Server Components (`react-server-dom-*` nicht installiert). React 19.2.8 ist ohnehin gepatcht. Zugriff wird **nur** von den Database-Rules entschieden, nicht von Client oder Proxy. | curl mit `x-middleware-subrequest` liefert identische Antwort (Hash gleich) |
| 2 | .git & Dotfiles, Backups | ✅ | Low | `.gitignore:4-37` | Ausgeliefert wird nur `dist/` (0 Dotfiles, 0 Maps). `.gitignore` ignorierte `.env.production` u. ä. **nicht** → jetzt `.env.*` (außer `.env.example`), Schlüssel, Service-Accounts, Dumps, Backups, Firebase-Debug-Logs. | curl lokal: SPA-Fallback statt Inhalt für `/.git/HEAD`, `/.env*`, `*.sql`, `*.zip`; live: 404 |
| 3 | Storage / private Dateien | ✅ / N/A | – | `src/features/camera/photoStore.ts:27` | Kein Firebase Storage. Fotos bleiben auf dem Gerät. Profilbild nur mit Zustimmung als kleine JPEG-Kopie in der Lobby, per `onDisconnect` gelöscht. | `online.test.tsx` „teilt ohne Zustimmung nichts“ |
| 4 | Preise serverseitig | N/A | – | – | Keine Preise, kein Shop. | – |
| 5 | Credential Stuffing | N/A | – | – | Kein Login mit Passwort. | – |
| 6 | Offene DB | ✅ | **Critical** | `database.rules.json:9-155` | Vorher: Elternregel erlaubte jedem mit Code Lesen/Schreiben/Löschen ohne Auth. Jetzt: `auth != null`; Anlegen nur auf freiem Pfad mit sich als Host; `players/$uid`, `avatars/$uid` nur eigene UID (Host darf Inaktive entfernen); `meta`/`game` Host, Mitglieder nur Runde starten, solange keine läuft; `expiresAt`/`film` nur Host; `inbox/$id.by === auth.uid`; Host-Übernahme nur bei stillem Host (45 s); Lobby löschen Host oder Mitglied bei verschwundenem Host; Zeitstempel ≤ now+10 min. Root bleibt `false`, kein Listing. | `tests/rules/database.rules.test.ts` (31 Fälle, Emulator): neue Rules 31/31 grün, alte Rules 17 rot. CI-Job `rules`. |
| 7 | Third-Party-Scripts | ✅ | – | `index.html` | Keine externen Scripts/Fonts/CDNs, kein polyfill.io. CSP erzwingt `script-src 'self'`. | Bundle-Scan, CSP-Browsercheck |
| 8 | SMS-Pumping | N/A | – | – | Kein SMS/OTP. | – |
| 9 | Prompt Injection | N/A | – | – | Kein LLM im Code (`grep` openai/anthropic/gemini/llm: 0). | – |
| 10 | JWT | ✅ / N/A | – | `src/lib/firebase.ts:77` | Keine eigenen JWTs. Firebase-ID-Tokens werden von Firebase signiert und serverseitig von den Rules verifiziert (`auth.uid`); der Client vertraut keinem eigenen Token. | Rules-Tests mit Emulator-Tokens |
| 11 | Race Conditions | ✅ / ⚠️ | Medium | `PartyContext.tsx:365`, `:587`; `functions/cleanup.js:18` | Lobby-Anlage jetzt **eine** Transaktion + Rule „nur wenn leer“ (vorher `get`+`set`, zweite Lobby überschrieb die erste). Host-Übernahme bricht ab statt fremden Wert zurückzuschreiben. Cleanup prüft pro Lobby in einer Transaktion (löschte vorher eine inzwischen neu angelegte Lobby). Alter Host verliert serverseitig das Schreibrecht. **Offen:** Inbox-Aktionen haben keine persistente Action-ID/Round-ID – nach einem Host-Absturz zwischen „State schreiben“ und „Inbox löschen“ kann eine Aktion doppelt wirken (kein Geld/Guthaben betroffen). | Rules „alter Host schreibt keinen Spielstand mehr“, „überschreibt keine bestehende Lobby“; `online.test.tsx` „überschreibt beim Anlegen keine laufende Lobby“; `tests/functions/cleanup.test.ts` „neu angelegte Lobby“ + Smoke-Test mit echtem Admin-SDK gegen Emulator |
| 12 | Account Pre-Hijacking | N/A | – | – | Keine E-Mail-Konten, kein OAuth. | – |
| 13 | Subdomain Takeover | N/A | – | – | Keine DNS-Konfiguration, keine `CNAME`-Datei im Repo. Domains: `paulweber-co.github.io`, `scientificgame-5b7e7-default-rtdb.europe-west1.firebasedatabase.app`. Siehe Manuell-Liste (eigene Domains prüfen). | – |
| 14 | SSRF | N/A | – | – | Der Server ruft keine User-URLs ab (Function liest nur die eigene DB). | – |
| 15 | Path Traversal | ✅ | – | `PartyContext.tsx:402`, `CameraScreen.tsx:74` | Lobby-Code per `^[A-Z0-9]{6}$` geprüft, bevor er in einen DB-Pfad geht; Rules prüfen dasselbe. Foto-Dateinamen zufällig (`uid('f_')`). | `online.test.tsx` „weist einen kaputten Code ab“ (`../x`) |
| 16 | Reset Poisoning | N/A | – | – | Keine Mails, keine Reset-Links. | – |
| 17 | Source Maps | ✅ | Low | `vite.config.ts:129` | `build.sourcemap: false` jetzt explizit. | `dist`: 0 `.map`, 0 `sourceMappingURL`; live `*.js.map` → 404 |
| 18 | Clickjacking | ✅ / ⚠️ | Low | `src/security/frameGuard.ts`, `src/main.tsx:15` | GitHub Pages kann weder `X-Frame-Options` noch `frame-ancestors` (wirkt nicht im Meta-Tag). Ersatz: App rendert in einem fremden Rahmen nur einen Link nach draußen. Header-Lösung → Manuell-Liste. | `src/security/security.test.ts`; Playwright: gerahmt erscheint nur „Pegel in einem eigenen Fenster öffnen“ |
| 19 | Open Redirect | ✅ | Low | `src/features/onboarding/Onboarding.tsx:76` | `/\example.com` ging durch (Browser lesen es wie `//`). Jetzt nur interne Pfade. HashRouter – es gibt sonst keine Redirect-Ziele, kein OAuth. | `Onboarding.test.tsx` für `/\…`, `https://…`, `javascript:` (alter Code: `/\…` rot) |
| 20 | User Enumeration | N/A | – | – | Keine Konten. Lobby-Existenz ist per Design sichtbar (Code = Einladung); Brute-Force-Bremse siehe #31. | – |
| 21 | Zugriffskontrolle / IDOR | ✅ / ⚠️ | Critical → Medium | `database.rules.json` | Siehe #6: fremde Spieler, Host, Spielstand, Inbox, Avatar, Lobby jetzt geschützt. **Offen:** Mitglieder lesen den ganzen Spielstand, auch „geheime“ Hände (z. B. `src/games/stichmagie/game.ts:229`). Lösung bräuchte private Pfade pro Spieler und vertrauenswürdige Auswertung – Spieldesign-Umbau. | Rules-Tests (Gruppe „angemeldetes Mitglied, aber nicht Host“) |
| 22 | Mass Assignment / Over-Fetching | ✅ | Medium | `database.rules.json` (`$other: false`, `by === auth.uid`, `id === $playerId`) | Allowlist pro Feld bleibt; `isAdmin` u. ä. abgewiesen; Absender nicht mehr fälschbar. Lesen liefert nur Lobby-Daten (keine Körperdaten, kein Log – die bleiben lokal). Fremde Avatare im Client nur als JPEG-Data-URL angenommen (`PartyContext.tsx:1075`). | Rules „fremde Felder“, „im Namen eines anderen“; `online.test.tsx` „keine Tracking-URL, kein SVG“ |
| 23 | Secrets | ✅ | – | `src/lib/firebase.ts:23`, `.env.example`, `.github/workflows/deploy.yml` | Keine Geheimnisse im Code/Bundle. Neuer Web-API-Key ist öffentlich by design und kommt aus `vars.FIREBASE_API_KEY` (nicht hartcodiert). `.env.example` nur Platzhalter. | gitleaks 0 Funde |
| 24 | Injection | ✅ | – | `PartyContext.tsx` `decodeState` | Keine SQL/Shell. Remote-JSON nur per `JSON.parse`, kein `eval`/`new Function` (auch nicht im Bundle). | Bundle-Scan 0 Treffer |
| 25 | XSS | ✅ | – | – | Kein `dangerouslySetInnerHTML`/`innerHTML` im App-Code; React escaped. `href` nur Konstanten bzw. `mailto:`. Avatar-`src` nur `data:image/jpeg`. CSP ohne Inline-Skripte als zweite Linie. | `grep`, Tests zu #22 |
| 26 | Security-Header | ✅ / ⚠️ | Medium | `src/security/csp.ts`, `vite.config.ts:36` | CSP (Meta, nur Build) ohne `unsafe-inline`/`unsafe-eval`, Referrer-Policy (Meta). HSTS setzt GitHub (`max-age=31556952`). `X-Powered-By` gibt es nicht. **Nicht setzbar auf GitHub Pages:** `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`, `frame-ancestors` → Manuell-Liste. | Playwright gegen `vite preview`: 9 Bildschirme, 0 CSP-Verstöße, 0 Seitenfehler; `security.test.ts` |
| 27 | Sessions & CSRF | ✅ / N/A | – | `src/lib/firebase.ts:55` | Keine Cookies → kein CSRF. Firebase-Tokens vom SDK in IndexedDB (Standard). „Alles zurücksetzen“ löscht jetzt auch das anonyme Konto (`ProfileScreen.tsx:323`). | `src/lib/firebase.test.ts` |
| 28 | CORS | N/A | – | – | Keine eigene API. GitHub Pages sendet `Access-Control-Allow-Origin: *` für öffentliche statische Dateien ohne Credentials – unkritisch. | live `curl -I` |
| 29 | Payments / Webhooks | N/A | – | – | – | – |
| 30 | Uploads | ✅ | – | `portrait.ts:26`, `database.rules.json:107` | Bild wird im Browser per Canvas neu kodiert (JPEG, 256 px, ≤ 120 kB lokal, ≤ 24 000 Zeichen in der Lobby), Rules prüfen Präfix/Größe/eigene UID. Album nie hochgeladen; Dateinamen zufällig. | Rules „javascript:“-Avatar abgewiesen |
| 31 | Rate Limiting & Kosten | ⚠️ | Medium | – | Keine eigenen Endpunkte; Firebase hat keine Quoten pro Nutzer. Anonyme Auth macht Missbrauch zuordenbar, begrenzt ihn aber nicht. Kein LLM. → **App Check + Budget-Alarme** (Manuell-Liste). | – |
| 32 | Supply Chain | ✅ | High | `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.npmrc`, `package.json` (`overrides`) | `npm audit` 0/0 (Vitest 4.1.12, firebase-admin 14.5.1, gezielte Overrides). Lockfiles committet, `npm ci --ignore-scripts`, `.npmrc ignore-scripts=true`, Actions auf SHA gepinnt, `permissions: contents: read`, `persist-credentials: false`, Audit-Gate `--audit-level=high`, Dependabot (npm ×2, Actions). Rules-Emulator-JAR mit fester SHA-256. | CI-Lauf auf `security-hardening` |
| 33 | Fehler & Debug | ✅ | – | `PartyContext.tsx:1083` | Kein Server, der Stacktraces leaken könnte; keine Debug-/Test-Routen im Build (`scripts/*` landen nicht in `dist`); keine Test-Accounts/Default-Passwörter; kein GraphQL. Fehlermeldungen für fehlende Einrichtung verständlich, ohne Interna. | – |
| 34 | Logging | N/A | – | – | Keine Logins/Resets/Rechteänderungen. Functions loggen nichts Personenbezogenes. | – |
| 35 | Passwörter | N/A | – | – | Keine eigene Auth. | – |
| 36 | DSGVO | ✅ / ⚠️ | Medium | `src/legal/site.ts`, `functions/cleanup.js:58` | Fonts/Scripts selbst gehostet, kein Tracking. Neu: anonyme Konten nach 30 Tagen gelöscht, „Alles zurücksetzen“ löscht das Konto sofort, Datenschutztext ergänzt. **Offen (Rechtsfrage):** grobe Pegel-Zone (`PartyContext.tsx:507`) geht mit Spitzname an die Lobby – Art.-9-Bewertung fehlt (Befund L01 aus PR #45). | `storage.test.ts`, `firebase.test.ts`, `cleanup.test.ts` |
| 37 | Mobile App | ⚠️ | Low | `src/lib/firebase.ts:55` | Kein Secret im App-Code. Auth ohne Popup-Resolver (läuft unter `capacitor://`). Token liegt im WebView-IndexedDB statt Keychain/Keystore – für anonyme Lobby-Tokens vertretbar. Deep Link `?code=` wird validiert. Das native Projekt (Fork) war nicht prüfbar. | – |

## Verhaltensänderungen

1. **Online-Lobby braucht die anonyme Anmeldung.** Ohne `VITE_FIREBASE_API_KEY` und aktivierte anonyme Anmeldung lehnen die neuen Rules jeden Zugriff ab; die App meldet „Online-Lobby ist nicht eingerichtet“. Pass & Play ist nicht betroffen.
2. **Spieler-IDs online = Firebase-UID** statt Geräte-ID. Lobbys, die beim Rules-Deploy laufen, sind danach nicht mehr beschreibbar → in einer ruhigen Phase deployen. Alte, gecachte PWA-Versionen bekommen „Zugriff verweigert“, bis sie die Update-Leiste bestätigen.
3. **Rechte in der Lobby:** Nicht-Hosts können eine laufende Runde nicht mehr per Datenbank beenden/überschreiben, Lobby nicht verlängern, Film nicht ändern, niemanden entfernen. (Die UI hat das schon vorher nur dem Host angeboten.) Lobby löschen darf ein Nicht-Host nur, wenn der Host verschwunden ist.
4. **Zeitstempel > 10 Minuten in der Zukunft** werden abgewiesen – ein Handy mit völlig falscher Uhr kann nicht beitreten.
5. **CSP blockiert den Long-Polling-Fallback des Firebase-SDK** (iframe mit Inline-Skript). Betrifft nur Netze, die WebSockets sperren; dort geht die Online-Lobby nicht mehr.
6. **In einem fremden iframe** zeigt die App nur noch einen Link.
7. **„Alles zurücksetzen“** löscht zusätzlich das anonyme Firebase-Konto.
8. **Neue Cloud Function** `cleanupAnonymousUsers` (täglich) – wird erst mit `firebase deploy --only functions` aktiv.
9. **Entwicklung:** Vitest 4, `.npmrc` mit `ignore-scripts=true`, neuer Befehl `npm run test:rules` (braucht Java).

## Offene Punkte

| Punkt | Severity | Warum offen | Vorschlag |
|---|---|---|---|
| Geheime Karten im gemeinsamen Spielstand (#21, S03) | Medium | Spieldesign: Host-Reducer schreibt den ganzen Zustand; private Sichten bräuchten Umbau aller betroffenen Spiele | Private Pfade `hands/$uid` mit Rule „nur eigene UID lesen“, Host schreibt dorthin |
| Inbox ohne Action-/Round-ID (#11, M03) | Low | Doppelte Anwendung nur bei Host-Absturz im falschen Moment; keine Werte betroffen | `actionId` + `roundId` in der Nachricht, verarbeitete IDs im State |
| Mengenbegrenzung / Abuse (#31, S02) | Medium | RTDB-Rules können nicht zählen | App Check erzwingen, Budget-Alarm |
| HTTP-Security-Header (#18, #26) | Low | GitHub Pages erlaubt keine Header | Hosting mit Header-Support (siehe unten) |
| Pegel-Zone als Gesundheitsdatum (#36, L01) | Medium (rechtlich) | Produkt-/Rechtsentscheidung | Zone weglassen oder eigene Einwilligung |

## Manuell zu erledigen

**Reihenfolge für den Rollout (wichtig):**

1. **Firebase-Konsole → Authentication → Sign-in method → „Anonym“ aktivieren.**
2. **Web-API-Key** (Projekteinstellungen → Web-App → `apiKey`) als **Repository-Variable** anlegen: GitHub → Settings → Secrets and variables → Actions → *Variables* → `FIREBASE_API_KEY`. Lokal: `.env.local` nach Vorlage `.env.example`.
3. **Key einschränken** (Google Cloud Console → APIs & Dienste → Anmeldedaten): Anwendungseinschränkung HTTP-Referrer `https://paulweber-co.github.io/*` (für die native App ggf. eigener Key oder App-Einschränkung), API-Einschränkung auf *Identity Toolkit API* und *Token Service API*.
4. Branch `security-hardening` reviewen und nach `main` mergen → GitHub Pages baut mit Key. Warten, bis die neue Version ausgeliefert ist.
5. **Dann erst** `firebase deploy --only database,functions` (Rules + beide Cleanup-Functions). In der Konsole prüfen, dass die Regeln dem Repo entsprechen.

**Weitere Punkte:**

- **Geleakte Keys rotieren:** nicht nötig – keine Secrets in Code oder Historie gefunden.
- **Firebase App Check** einrichten (reCAPTCHA Enterprise für Web, App Attest / Play Integrity nativ) und für die Realtime Database erzwingen – bremst Code-Raten und Spam.
- **Budget-Alarm** im Google-Cloud-Billing (Functions laufen im Blaze-Tarif) und RTDB-Nutzungsalarme.
- **GitHub-Repo-Einstellungen:** Secret Scanning + Push Protection, Dependabot security updates aktivieren; Branch Protection für `main` mit Pflicht-Checks `test` und `rules`.
- **Security-Header per Hosting:** GitHub Pages kann es nicht. Optionen: eigene Domain hinter Cloudflare (Transform Rules) oder Firebase Hosting mit `headers` in `firebase.json`. Gewünschte Werte: `Content-Security-Policy: frame-ancestors 'none'` (+ restliche CSP aus `src/security/csp.ts`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), geolocation=(), microphone=(), payment=()`.
- **2FA** auf allen Konten: GitHub (auch Collaborators), Google-/Firebase-Konto, Apple Developer, Google Play Console, ggf. Domain-Registrar.
- **DNS:** Im Repo gibt es keine. Falls ihr eigene Domains habt, die einmal auf GitHub Pages oder Firebase Hosting zeigten: verwaiste CNAMEs entfernen (Subdomain-Takeover).
- **Backups:** Die Lobby-Daten sind flüchtig (≤ 8 h) – Backups unnötig. Falls künftig Dauerhaftes in Firebase liegt: tägliche RTDB-Backups (Blaze) und einmal Restore testen.
- **PR #45** (Codex-Audit): enthält ein 1,2-MB-ZIP. Nicht mergen; PR schließen oder nur die Markdown-Berichte übernehmen, ZIP als Release-Anhang. Branch `codex/release-audit-2026-11-01` danach löschen. Da das ZIP nicht in `main` ist und keine Secrets enthält, ist **kein History-Rewrite nötig**. Nur falls es doch gemergt wurde: `git filter-repo --path docs/audits/2026-11-01/pegel-audit.zip --invert-paths` (danach Force-Push – nur nach Absprache im Team).
- **Rechtliches:** Datenschutztext zur anonymen Anmeldung (`src/legal/site.ts`) gegenlesen; Art.-9-Frage zur Pegel-Zone klären.
- **Native App (Fork):** CSP aus `src/security/csp.ts` übernehmen, Key-Einschränkung für die App prüfen, dieselben Rules gelten automatisch.

## Verifikation

| Prüfung | Ergebnis |
|---|---|
| `npm run typecheck`, `npm run lint` | grün |
| `npm test` | 99 Dateien (vorher 97), **1405 Tests grün** (vorher 1391) |
| `npm run test:rules` (Database-Emulator 4.11.2, SHA-256 geprüft) | **31/31 grün**; gegen die alten Rules 17 rot (= Angriffe gingen durch) |
| `npm run build` | grün, keine Chunk-Zyklen |
| `npm audit` App / Functions | **0 / 0** |
| Neue Tests gegen alten Code | Client-Identität, Avatar-Filter: 3 rot; Open Redirect `/\…`: rot |
| Cleanup mit echtem Admin-SDK gegen Emulator | 2 abgelaufene gelöscht, gültige bleibt |
| Playwright gegen `vite preview` (CSP aktiv) | 9 Bildschirme, 0 CSP-Verstöße, 0 Seitenfehler; im fremden iframe nur Link |
| curl lokal (`vite preview`) | `/.git/HEAD`, `/.git/config`, `/.env*`, `/.npmrc`, `/backup.sql`, `/dist.zip`, `/sw.js.map` → nur SPA-Fallback, kein Dateiinhalt; 0 Maps, 0 Dotfiles in `dist`; `x-middleware-subrequest` ändert nichts |
| curl live (nur GET) | `/.git/HEAD`, `/.env`, `/database.rules.json`, `/package.json`, Bundle-`.map` → 404; HSTS vorhanden; CSP folgt mit dem nächsten Deploy |
| Fremde IDs | Rules-Emulator: fremder Spieler/Avatar/Inbox-Absender/Host → `permission_denied` |
| Manipulierter Preis | N/A – keine Preise |
| CI auf `security-hardening` (GitHub Actions, Lauf 130) | `test` (typecheck, lint, test, build, audit App + Functions) und `rules` grün |

**Nicht verifiziert:** echte anonyme Anmeldung gegen das Produktivprojekt (kein API-Key verfügbar, und kein Produktivzugriff gewollt) – abgedeckt durch Unit-Tests mit Attrappe und Emulator-Tests mit Emulator-Tokens. Nach dem Rollout einmal mit zwei Handys Lobby anlegen, beitreten, spielen, Host-Übernahme, verlassen.
