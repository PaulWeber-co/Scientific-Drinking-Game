import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Verpackt den fertigen Vite-Build als native App.
 *
 * Die Kennung `app.pegel.party` traegt bewusst keinen Personennamen: sie ist
 * nach der ersten Veroeffentlichung unveraenderlich, waehrend noch offen ist,
 * wer die App spaeter im Store fuehrt.
 *
 * Gebaut wird mit VITE_BASE=/ (siehe `npm run build:native`) – der Standard
 * `/Scientific-Drinking-Game/` ist der Unterpfad von GitHub Pages und waere
 * im Container ein toter Pfad.
 */
const config: CapacitorConfig = {
  appId: 'app.pegel.party',
  appName: 'Pegel',
  webDir: 'dist',
  // Gleiche Farbe wie `theme-color` in index.html. Ohne das blitzt beim Start
  // kurz Weiss auf, bevor die dunkle App-Oberflaeche steht.
  backgroundColor: '#08080B',
  android: {
    // Fehlersuche per chrome://inspect nur in Debug-Builds (Capacitor-Standard).
    webContentsDebuggingEnabled: undefined,
  },
  ios: {
    // Die App zeichnet ihre eigenen Abstaende (safe-area-inset in tokens.css);
    // WebKit soll nichts zusaetzlich einruecken.
    contentInset: 'never',
    backgroundColor: '#08080B',
  },
  plugins: {
    SplashScreen: {
      // Das Startbild bleibt stehen, bis die Oberflaeche steht - `initNative`
      // blendet es aus. Das Auto-Hide ist die Rueckfallebene: laeuft unser
      // JavaScript gar nicht, verschwindet es trotzdem nach zwei Sekunden,
      // statt die App stehen zu lassen.
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#08080B',
    },
    LocalNotifications: {
      // Nur Android: einfarbiges Glas in der Statusleiste
      // (android/app/src/main/res/drawable/ic_stat_pegel.xml). Ohne eigenes
      // Symbol zeigt Android dort ein weißes Quadrat.
      smallIcon: 'ic_stat_pegel',
      iconColor: '#FF8A1E',
    },
  },
};

export default config;
