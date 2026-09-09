/**
 * Haptik.
 *
 * Zwei Wege, weil `navigator.vibrate` nur die halbe Welt abdeckt:
 *
 * - **Android** (Browser wie App-Hülle) kennt die API. Dort hat die Vibration
 *   schon immer funktioniert.
 * - **WebKit** kennt sie nicht – weder Safari noch der WKWebView. Auf einem
 *   iPhone lief deshalb keiner der Haptik-Aufrufe ins Ziel, in der Web- wie in
 *   der App-Fassung.
 *
 * Läuft die App nativ, geht die Haptik darum über `@capacitor/haptics` und
 * damit über die System-Haptik (Taptic Engine bzw. HapticFeedback). Das schließt
 * nicht nur die iOS-Lücke: Ein `impact` mit Stärke fühlt sich auch auf Android
 * anders an als ein flaches `vibrate(8)` auf dem nackten Motor.
 *
 * Das Plugin wird nur nativ geladen (dynamischer Import): der Web-Build soll
 * kein Byte davon mitschleppen. Solange es nicht da ist – und wenn die Bridge
 * den Aufruf ablehnt – greift der Web-Weg.
 *
 * Die Muster sind nach ihrer BEDEUTUNG benannt, nicht nach ihrer Länge. Nur so
 * lässt sich später an einer Stelle nachjustieren, ohne 150 Aufrufe zu suchen.
 */

export type Pattern =
  /** Leichtes Antippen: Navigation, Listen, Stepper. */
  | 'tap'
  /** Auswahl geändert: Segmente, Farben, Kacheln. */
  | 'select'
  /** Hauptknopf gedrückt: „Weiter", „Starten", „Aufdecken". */
  | 'press'
  /** Spürbarer Anschlag: Karte aufgedeckt, Handy weitergeben, Würfel. */
  | 'heavy'
  /** Es hat geklappt: Runde gewonnen, Foto gespeichert, Lobby verbunden. */
  | 'success'
  /** Achtung: Zeit läuft ab, Wasser trinken, Grenzwert erreicht. */
  | 'warn'
  /** Es ist etwas schiefgegangen oder es hat jemanden erwischt. */
  | 'error'
  /** Trinkansage: zwei kurze Stöße wie zwei Schlucke. */
  | 'sip'
  /** Zünder-Tick der Wortbombe. Kurz und trocken. */
  | 'tick'
  /** Explosion: harter Schlag mit Nachbeben. */
  | 'boom';

/** Web-Fallback: Millisekunden bzw. Muster für `navigator.vibrate`. */
const WEB: Record<Pattern, number | number[]> = {
  tap: 8,
  select: 12,
  press: 18,
  heavy: 45,
  success: [12, 40, 22],
  warn: [24, 60, 24],
  error: [40, 50, 40, 50, 60],
  sip: [14, 70, 14],
  tick: 10,
  boom: [60, 40, 30, 30, 90],
};

/**
 * Native Entsprechung.
 *
 * `impact` ist ein einzelner Schlag, `notification` das dreiteilige
 * System-Muster für Erfolg/Warnung/Fehler, `selection` das feine Rasten des
 * Auswahlrads. `vibrate` ist der grobe Motor – nur für die Explosion, weil
 * dafür kein System-Muster lang genug ist.
 */
type NativeCall =
  | { kind: 'impact'; style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }
  | { kind: 'notification'; type: 'SUCCESS' | 'WARNING' | 'ERROR' }
  | { kind: 'selection' }
  | { kind: 'vibrate'; duration: number };

const NATIVE: Record<Pattern, NativeCall> = {
  tap: { kind: 'impact', style: 'LIGHT' },
  select: { kind: 'selection' },
  press: { kind: 'impact', style: 'MEDIUM' },
  heavy: { kind: 'impact', style: 'HEAVY' },
  success: { kind: 'notification', type: 'SUCCESS' },
  warn: { kind: 'notification', type: 'WARNING' },
  error: { kind: 'notification', type: 'ERROR' },
  sip: { kind: 'impact', style: 'MEDIUM' },
  tick: { kind: 'impact', style: 'LIGHT' },
  boom: { kind: 'vibrate', duration: 260 },
};

/** Was wir vom Plugin brauchen – ohne den Typ des Pakets zu importieren. */
interface HapticsPlugin {
  impact(o: { style: string }): Promise<void>;
  notification(o: { type: string }): Promise<void>;
  selectionStart(): Promise<void>;
  selectionChanged(): Promise<void>;
  selectionEnd(): Promise<void>;
  vibrate(o: { duration: number }): Promise<void>;
}

let plugin: HapticsPlugin | null = null;
let laedt = false;
/** Der native Weg hat sich als Sackgasse erwiesen – siehe `haptic()`. */
let nativeAus = false;
let styles: Record<string, string> = {};
let types: Record<string, string> = {};

/**
 * Lädt das Plugin, sobald die App nativ läuft.
 *
 * Bewusst ohne `await` an der Aufrufstelle: Haptik ist Beiwerk. Sie darf
 * einen Tap nie verzögern und schon gar nicht blockieren.
 *
 * Wird beim Laden des Moduls UND bei jedem Impuls versucht. Der zweite Weg
 * ist die Absicherung: Wann die Capacitor-Bridge `window.Capacitor` setzt,
 * ist nicht garantiert – steht sie beim ersten Versuch noch nicht, bliebe
 * die App sonst die ganze Sitzung lang auf dem Web-Weg.
 */
export function initHaptics(): void {
  if (plugin || laedt || nativeAus) return;
  // `window` fehlt in Tests ohne DOM – dann gibt es auch nichts zu vibrieren.
  if (typeof window === 'undefined') return;
  if (window.Capacitor?.isNativePlatform?.() !== true) return;
  laedt = true;
  void import('@capacitor/haptics')
    .then((m) => {
      plugin = m.Haptics as unknown as HapticsPlugin;
      styles = m.ImpactStyle as unknown as Record<string, string>;
      types = m.NotificationType as unknown as Record<string, string>;
    })
    .catch(() => {
      // Paket nicht ladbar: dann bleibt es beim Web-Weg.
      nativeAus = true;
    });
}

let enabled = true;
export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

/**
 * Sperre gegen Dauerfeuer.
 *
 * Die Taptic Engine stellt Aufrufe in eine Warteschlange. Wer in einer Liste
 * schnell scrollt oder einen Stepper gedrückt hält, spürt sonst noch Sekunden
 * später ein Nachrattern. 40 ms sind kürzer als jede bewusste Doppelgeste und
 * lang genug, um das zu verhindern.
 *
 * Gemessen mit `performance.now()` und nicht mit `Date.now()`: die Uhr eines
 * Telefons springt (Zeitzone, Zeitabgleich). Ein Rücksprung würde die Sperre
 * sonst für die Dauer des Sprungs zumachen — die Haptik wäre still, und
 * niemand käme auf die Idee, warum.
 */
const MIN_GAP_MS = 40;
let zuletzt = -Infinity;

function jetzt(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function haptic(pattern: Pattern = 'tap'): void {
  if (!enabled) return;
  const now = jetzt();
  if (now - zuletzt < MIN_GAP_MS) return;
  zuletzt = now;

  if (!plugin) initHaptics();
  if (plugin) {
    const h = plugin;
    void fireNative(h, NATIVE[pattern]).catch(() => {
      // WICHTIG: Das Paket lässt sich immer importieren – es liegt im Bundle.
      // Ob im nativen Projekt auch der PLUGIN-Teil steckt, zeigt sich erst
      // hier: ohne `npx cap sync` lehnt die Bridge jeden Aufruf ab
      // („Haptics does not have an implementation"). Würden wir das nur
      // schlucken, wäre die App auf Android schlagartig stumm — dort hat der
      // Web-Weg vorher funktioniert. Also einmal zurückfallen und ab jetzt
      // gleich den Web-Weg nehmen.
      nativeAus = true;
      plugin = null;
      webVibrate(pattern);
    });
    return;
  }
  webVibrate(pattern);
}

function webVibrate(pattern: Pattern): void {
  try {
    navigator.vibrate?.(WEB[pattern]);
  } catch {
    /* Gerät ohne Vibrationsmotor – kein Grund für einen Fehler. */
  }
}

function fireNative(h: HapticsPlugin, call: NativeCall): Promise<void> {
  switch (call.kind) {
    case 'impact':
      return h.impact({ style: styles[call.style] ?? call.style });
    case 'notification':
      return h.notification({ type: types[call.type] ?? call.type });
    case 'selection':
      // Start/Changed/End gehören zusammen; einzeln ausgelöst bleibt die
      // Engine unter iOS im „Auswahl läuft"-Zustand hängen.
      return h.selectionStart().then(() => h.selectionChanged()).then(() => h.selectionEnd());
    case 'vibrate':
      return h.vibrate({ duration: call.duration });
  }
}

/**
 * Ein Schlag, dessen Härte mit der Spannung wächst (0 … 1).
 *
 * Für alles, was sich aufbaut – der Zünder der Wortbombe, ein ablaufender
 * Timer. Ein gleichbleibendes Ticken fühlt sich nach Uhr an, ein härter
 * werdendes nach „gleich knallt es".
 */
export function hapticRamp(intensity: number): void {
  const t = Math.max(0, Math.min(1, intensity));
  haptic(t > 0.82 ? 'heavy' : t > 0.5 ? 'press' : 'tick');
}

// Beim Laden des Moduls, nicht erst beim ersten Tap: sonst käme genau der
// erste Impuls einer Sitzung zu spät oder gar nicht.
initHaptics();
