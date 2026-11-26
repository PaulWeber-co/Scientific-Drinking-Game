/**
 * Content Security Policy der ausgelieferten App.
 *
 * GitHub Pages setzt keine eigenen Response-Header. Die Policy kommt deshalb
 * als `<meta http-equiv>` ins gebaute index.html (vite.config.ts, nur im
 * Build – der Dev-Server braucht Inline-Skripte für Hot Reload).
 *
 * Was per Meta-Tag NICHT geht und deshalb hier fehlt: `frame-ancestors`
 * (Clickjacking – dafür src/security/frameGuard.ts), `report-uri`,
 * `sandbox`. Siehe SECURITY_AUDIT.md.
 *
 * Bewusst ohne `upgrade-insecure-requests`: Die Android-Hülle von Capacitor
 * läuft unter http://localhost – hochgestuft fände sie ihre eigenen Dateien
 * nicht mehr.
 */
const FIREBASE_DB = [
  'https://*.firebasedatabase.app',
  'wss://*.firebasedatabase.app',
  'https://*.firebaseio.com',
  'wss://*.firebaseio.com',
];
const FIREBASE_AUTH = [
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
];

export const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  // Kein 'unsafe-inline', kein 'unsafe-eval': Vite bündelt alles in Dateien.
  'script-src': ["'self'"],
  // React setzt `style={…}` über das CSSOM – das deckt 'self' ab, ohne Inline.
  'style-src': ["'self'"],
  // Profilbilder (data:), Album (blob:, native Datei-URL = gleiche Herkunft).
  'img-src': ["'self'", 'data:', 'blob:'],
  'media-src': ["'self'", 'blob:'],
  'font-src': ["'self'"],
  // fetch(blob:/data:) beim Teilen eines Fotos; Firebase nur bei Online-Lobby.
  'connect-src': ["'self'", 'data:', 'blob:', ...FIREBASE_DB, ...FIREBASE_AUTH],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export function contentSecurityPolicy(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');
}
