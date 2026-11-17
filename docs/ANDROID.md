# Android-App (Capacitor)

Die Android-App ist dieselbe Web-App in einer nativen Hülle – genau wie die iOS-App in
`ios/`. Capacitor packt den Build aus `dist/` in eine Android-WebView und stellt die
nativen Plugins bereit (Haptik, Teilen, Dateien, lokale Benachrichtigungen, Statusleiste,
Startbild, Zurück-Taste). Das Projekt liegt in `android/`. Beide Plattformen teilen sich
`capacitor.config.ts`, `npm run build:native` und `src/lib/native.ts` – eine Änderung
dort betrifft immer auch iOS.

## Einmalig einrichten

- **Android Studio** (bringt SDK und Emulator mit). Im Device Manager ein Gerät mit
  aktuellem Android anlegen, z. B. „Medium Phone“.
- **JDK 21.** Capacitor 8 baut mit Gradle 8.14, und das läuft nicht mit dem Java 25, das
  Android Studio mitbringt. Auf dem Mac: `brew install openjdk@21`. In Android Studio
  dann unter *Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK*
  diese JDK wählen. Für die Kommandozeile `JAVA_HOME` darauf setzen:
  `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
  und `export ANDROID_HOME=$HOME/Library/Android/sdk` (Android Studio legt dafür
  `android/local.properties` an; die Datei ist rechnerabhängig und nicht eingecheckt).
- `npm install`

## iOS und Android auf demselben Stand

Beide Apps sind dieselbe Web-App. Eine Änderung in `src/` kommt in beide, sobald sie
neu gebaut und kopiert wird:

```bash
npm run sync:native      # Web-Build für die Apps, dann nach ios/ UND android/ kopieren
```

- **Nur Web-Code geändert:** `npm run sync:native`, danach in Xcode bzw. Android Studio
  starten. In `ios/` und `android/` ändert sich dabei nichts, was eingecheckt wird.
- **Plugin hinzugefügt** (`npm install @capacitor/…`): ebenfalls `npm run sync:native`.
  Dabei ändern sich `ios/App/CapApp-SPM/Package.swift` und die Android-Gradle-Dateien –
  beides mit einchecken.
- **Plattform-eigener Code** gehört in `src/lib/native.ts` (beide) oder hinter
  `Capacitor.getPlatform()`. Android-Eigenes steht in der Tabelle unten.
- **Prüfung:** Der Workflow *Android* (`.github/workflows/android.yml`) baut bei jedem Pull
  Request eine Debug-APK. Die iOS-App baut weiterhin *iOS TestFlight* (`ios.yml`).

## Bauen und starten

```bash
npm run android          # Web-Build für die App, sync, Android Studio öffnen
```

In Android Studio oben das Gerät wählen und auf ▶ *Run* klicken. Der Emulator läuft dann
im Panel *Running Devices* neben dem Code.

Einzeln:

```bash
npm run build:native     # Web-Build mit Basis „/“ und ohne Service Worker (wie für iOS)
npx cap sync android     # dist/ und Plugins ins Android-Projekt kopieren
npx cap run android      # bauen und auf Gerät/Emulator starten (ohne Android Studio)
```

**Nach jeder Änderung am Web-Code** `npm run build:native && npx cap sync android`, sonst
läuft in der App der alte Stand. `npm run build` (für GitHub Pages) reicht dafür nicht: Er
baut mit dem Pfad `/Scientific-Drinking-Game/` und einem Service Worker.

**Versionen gleich halten:** `@capacitor/core`, `cli`, `ios` und `android` immer auf
dieselbe Version heben, sonst passen JavaScript-Brücke und nativer Teil nicht zusammen.

### Fehlersuche

- **WebView untersuchen:** In Chrome `chrome://inspect` öffnen, die App erscheint dort als
  „WebView in app.pegel.party“. Konsole, Netzwerk und DOM wie im Browser.
- **Native Logs:** `adb logcat | grep -iE "Capacitor|chromium"`
- **Tests unter Node 25 oder neuer:** `NODE_OPTIONS=--no-experimental-webstorage npm test`
  (Node 22 wie in der CI braucht das nicht).
- **Emulator langsam?** Nur dann, wenn er ohne Grafikbeschleunigung läuft (Software-
  Rendering). Aus Android Studio gestartet nutzt er die GPU.

## Was Android-spezifisch ist

| Thema | Lösung |
| --- | --- |
| Zurück-Taste/-Geste | `src/app/androidBack.ts`: schließt erst Sheets und Menüs, nimmt dann das Zurück des Bildschirms (dasselbe wie die Wischgeste, `useSwipeBack` → `lib/backHandler.ts`), dann den Verlauf. Auf der Spielewand geht die App in den Hintergrund, statt sich zu beenden. **Im Spiel** fragt sie „Spiel beenden?“ (`GameFrame.tsx`), ein zweites Zurück spielt weiter. |
| Navigationsleiste | Material 3 Expressive (`src/app/MaterialNavBar.tsx`, Stile `.m3nav` in `global.css`): Fläche am unteren Rand bis unter die Gestenleiste, Pille hinter dem aktiven Symbol, Label darunter. iOS und Browser behalten die Glaskapsel (`TabBar.tsx`). |
| Statusleiste, Startbild | Wie unter iOS über `src/lib/native.ts` (`@capacitor/status-bar`, `@capacitor/splash-screen`): Symbole passend zum App-Theme, das Startbild bleibt, bis die Oberfläche steht. Safe Areas kommen als `env(safe-area-inset-*)` an. |
| Kamera | `getUserMedia` in der WebView braucht `CAMERA` im Manifest – ohne lehnt Android stumm ab, ohne zu fragen. |
| Benachrichtigungen | Ab Android 13 fragt die App beim ersten Foto nach (`features/camera/notify.ts`). Geplant wird **ungenau** (`isExactNotification: false`): Sonst schickt das Plugin den Nutzer in die Einstellungen „Wecker & Erinnerungen“, und Google Play erlaubt exakte Wecker nur Wecker-Apps (Berechtigung im Manifest entfernt). Eigenes Statusleisten-Symbol `res/drawable/ic_stat_pegel.xml`. |
| Teilen | Die Android-WebView kennt `navigator.share` nicht. Einladungen und Dateien laufen nativ über `@capacitor/share` (`lib/shareFile.ts`). |
| App vom System beendet | Android beendet Apps im Hintergrund. Wer eine Online-Runde nicht über „Verlassen“ verlassen hat, tritt beim nächsten Start von selbst wieder bei (`features/party/ResumeOnlineRound.tsx`). |
| Systemschrift | Android vergrößert Text in der WebView mit. Gedeckelt auf 115 % (`MainActivity.java`), darüber liefen Titel aus den Karten. |
| Ausrichtung | Hochformat wie die Web-App. Ab Android 16 dreht das System auf Tablets/Faltbaren trotzdem. |
| Backup | Aus (`allowBackup="false"`, `res/xml/data_extraction_rules.xml`): Profil, Trink-Log und Fotos bleiben laut Datenschutzerklärung auf dem Gerät. |
| Einladungslinks | In der App ist die Adresse `https://localhost`; Links und QR-Codes nutzen darum die öffentliche Adresse aus `src/legal/site.ts`. |

## Icon und Startbild

Quelle sind `public/icon-maskable-512.png` und `public/icon-512.png` (dieselben wie für die
Web-App). Neues Icon → `npm run icons:android`. Das Skript erzeugt das Adaptive Icon und die
runden/eckigen Icons für ältere Geräte; das einfarbige Themen-Icon ab Android 13 ist das
Glas aus `res/drawable/ic_stat_pegel.xml`. Das Startbild ist die App-Hintergrundfarbe mit
Icon (`res/drawable/splash.xml`, ab Android 12 `windowSplashScreen*` in `styles.xml`).

## Vor dem ersten Play-Store-Upload

- **App-ID** ist `app.pegel.party`, dieselbe wie unter iOS (`capacitor.config.ts`,
  `android/app/build.gradle`). Nach dem ersten Upload lässt sie sich nie mehr ändern.
- **Versionsnummer** in `android/app/build.gradle`: `versionCode` bei jedem Upload +1,
  `versionName` für Menschen.
- **Signieren:** Upload-Schlüssel erzeugen und *Play App Signing* nutzen. Den Schlüssel
  nie ins Repo. `android/app/build.gradle` liest ihn aus `~/.gradle/gradle.properties`:
  `PEGEL_UPLOAD_STORE_FILE`, `PEGEL_UPLOAD_STORE_PASSWORD`, `PEGEL_UPLOAD_KEY_ALIAS`,
  `PEGEL_UPLOAD_KEY_PASSWORD`.
- **Release-Build:** `cd android && ./gradlew bundleRelease` (oder in Android Studio
  *Build → Generate Signed App Bundle*). Release-Builds laufen mit R8 und
  Ressourcen-Verkleinerung; WebView-Debugging ist dort aus.
- **Play Console:** Entwicklerkonto (einmalig 25 $). Neue private Konten brauchen vor der
  Veröffentlichung einen geschlossenen Test (zuletzt 12 Tester über 14 Tage, vorher in der
  Play Console nachsehen). Inhaltsfragebogen, Datensicherheitsformular und
  Datenschutz-URL ausfüllen. Für Alkohol-Inhalte gelten eigene Richtlinien, siehe
  Release-Audit vom 1.11.2026.
