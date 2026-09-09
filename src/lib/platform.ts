/**
 * Läuft die App in einer nativen Hülle oder im Browser?
 *
 * Im Container ist `location.origin` NICHT die öffentliche Adresse der App,
 * sondern `capacitor://localhost` (iOS) bzw. `http://localhost` (Android).
 * Alles, was das Gerät verlässt – Einladungslinks, QR-Codes –, muss deshalb
 * die echte Web-Adresse benutzen, sonst landet der Empfänger im Nichts.
 *
 * Die Bridge setzt `window.Capacitor`, sobald die App nativ läuft. Wir fragen
 * das global ab statt `@capacitor/core` zu importieren: der Web-Build soll
 * kein Byte davon mitschleppen.
 */
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      /** Macht aus einem nativen Dateipfad eine im WebView ladbare Adresse. */
      convertFileSrc?: (uri: string) => string;
    };
  }
}

export function isNativeApp(): boolean {
  return window.Capacitor?.isNativePlatform?.() === true;
}
