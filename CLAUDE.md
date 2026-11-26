# CLAUDE.md

Pegel – Trinkspiele als React-19-/Vite-PWA auf GitHub Pages, Online-Lobby über die
Firebase Realtime Database (anonyme Anmeldung), eine zeitgesteuerte Cloud Function
(`functions/`). Details: `README.md`, `docs/ARCHITEKTUR.md`, `docs/FIREBASE.md`,
`SECURITY_AUDIT.md`.

## Befehle

- `npm test` – Unit-/Komponententests (Vitest, jsdom) inkl. `tests/functions`
- `npm run test:rules` – Database-Rules gegen den echten Emulator (braucht Java)
- `npm run typecheck`, `npm run lint`, `npm run build`
- `npm ci` (nicht `npm install`) – `.npmrc` setzt `ignore-scripts=true`

## Security Rules

Diese Regeln gelten für jede Änderung. Hintergrund: `SECURITY_AUDIT.md`.

1. **Die Database-Rules sind die einzige Vertrauensgrenze.** Alles, was im Client
   geprüft wird (`isHost`, ausgeblendete Knöpfe), ist nur Bedienkomfort. Jeder neue
   Pfad oder jedes neue Feld in der Datenbank braucht in `database.rules.json`:
   - Login (`auth != null`) **und** Besitz/Rolle: eigene Daten nur unter `auth.uid`,
     Host-Aktionen nur, wenn `meta/host === auth.uid`, Mitgliedschaft über
     `players/<auth.uid>`.
   - eine Allowlist der Felder mit Typ und Länge (`$other: { ".validate": false }`).
   - Absender-/Besitzer-Felder (`by`, `id`, `host`, `startedBy`) serverseitig an
     `auth.uid` binden – nie dem Client glauben.
   - **Positive und negative Fälle** in `tests/rules/database.rules.test.ts`
     („User A ändert Daten von User B → permission_denied“), `npm run test:rules` grün.
2. **Keine Secrets im Client.** Alles mit `VITE_*` landet im Bundle und ist öffentlich.
   Der Firebase-Web-API-Key ist kein Geheimnis, wird aber nur über
   `VITE_FIREBASE_API_KEY` (lokal `.env.local`, CI `vars.FIREBASE_API_KEY`) gesetzt,
   nie hartcodiert. Echte Geheimnisse (Service-Accounts, Admin-Keys) gehören nie ins
   Repo; `.env*` außer `.env.example` ist ignoriert, `.env.example` enthält nur
   Platzhalter.
3. **Werte, die zählen, rechnet nicht der Client allein.** Gibt es je Preise,
   Guthaben, Punkte mit Wert oder Einmal-Aktionen: serverseitig berechnen (Function
   oder Rules), atomar per Transaktion, Client schickt nur IDs und ganzzahlige,
   begrenzte Mengen.
4. **Eingaben validieren, Ausgaben nicht vertrauen.** Daten aus der Datenbank
   stammen von fremden Geräten: per Schema/Allowlist prüfen, bevor sie gerendert
   oder in Pfade eingesetzt werden (vgl. `remoteAvatar`, `LOBBY_CODE_RE` in
   `PartyContext.tsx`). Kein `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`new
   Function`; `href`/`src` nur `http(s):`, `mailto:` oder geprüfte `data:image/jpeg`.
   Redirect-Ziele nur als interne Pfade.
5. **CSP nicht aufweichen.** `src/security/csp.ts` kommt ohne `unsafe-inline` und
   `unsafe-eval` aus. Neue externe Quellen nur, wenn unvermeidbar – dann exakt den Host
   eintragen und `src/security/security.test.ts` anpassen. Keine externen Scripts,
   Fonts oder CDNs; alles selbst hosten.
6. **Neue Pakete nur nach Prüfung.** Vorher: existiert das Paket wirklich (kein
   Tippfehler-/Halluzinationsname), ist es etabliert und gepflegt (Downloads, letzte
   Version, Maintainer), braucht es Install-Skripte? Bordmittel von React, Vite und
   Firebase bevorzugen. Danach `npm audit` (CI bricht ab `high` ab).
7. **Datensparsamkeit.** Körperdaten, Trink-Log und Promillewerte verlassen das Gerät
   nie. Was neu in die Lobby geht, muss in `src/legal/site.ts` stehen und eine
   Löschung haben (Lobby-TTL, `functions/cleanup.js`).
8. **Keine Debug-Hintertüren.** Keine Test-Accounts, Default-Passwörter, Debug-Routen
   oder öffentlichen Source Maps (`build.sourcemap: false`) im ausgelieferten Build.
