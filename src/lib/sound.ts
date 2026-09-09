/**
 * Kurze Klänge, zur Laufzeit erzeugt.
 *
 * Kein einziges Audio-File: Rauschen plus Hüllkurve reicht für einen Zünder
 * und einen Knall. Das spart Lizenzfragen, Ladegewicht und einen Netzzugriff
 * mitten im Spiel.
 *
 * Bewusst ein sehr kleines Vokabular. `haptic()` steht an rund 150 Stellen —
 * ein Klang an jeder davon wäre unerträglich. Ton markiert MOMENTE, keine
 * Tipper, und bekommt erst dann einen Namen, wenn es einen Aufrufer gibt.
 *
 * Der Klingelschalter des iPhones wird RESPEKTIERT. Web-Audio schweigt dort
 * von sich aus, und das bleibt so: Wer stummgeschaltet hat, hat einen Grund.
 * Deshalb trägt kein Klang eine Information allein — jeder hat einen
 * sichtbaren oder haptischen Zwilling.
 */

export type Sound = 'tick' | 'boom';

let enabled = true;
export function setSoundEnabled(v: boolean) {
  enabled = v;
  if (!v) stopSounds();
}

/**
 * Woher der Kontext kommt.
 *
 * Einhängbar, weil jsdom kein Web-Audio hat: ohne diesen Haken liesse sich
 * an dieser Schicht gar nichts prüfen, und ein Test, der nichts prüfen kann,
 * ist keiner. Im Browser bleibt es bei der Voreinstellung.
 */
type Factory = () => AudioContext | null;

function defaultFactory(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    // Safari wirft, wenn das Kontingent an Kontexten erschöpft ist. Ohne
    // diesen Fang reisst der Wurf die Timeout-Kette des Zünders ab.
    return null;
  }
}

let factory: Factory = defaultFactory;
export function setAudioFactory(f: Factory | null) {
  reset();
  factory = f ?? defaultFactory;
}

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let dead = false;

/** Kopfraum: Filter überhöhen im Durchlassbereich, und Zünder und Knall
 *  können sich überlappen. Bei 1.0 schneidet Web-Audio hart ab. */
const MASTER = 0.65;

function reset() {
  ctx = null;
  bus = null;
  noise = null;
  dead = false;
}

/**
 * Der Kontext entsteht erst beim ersten Klang, nicht beim Laden des Moduls.
 *
 * Safari zählt auch schlafende Kontexte gegen sein Limit von wenigen Stück
 * je Seite, und ein vor der ersten Nutzergeste gebauter Kontext startet
 * ohnehin angehalten.
 */
function ensure(): AudioContext | null {
  if (dead) return null;
  if (!ctx) {
    try {
      ctx = factory();
    } catch {
      // Auch eine eingehängte Fabrik darf werfen. Ein Wurf hier würde die
      // Timeout-Kette des Zünders abreissen.
      ctx = null;
    }
    if (!ctx) {
      dead = true;
      return null;
    }
  }
  if (!bus) {
    bus = ctx.createGain();
    bus.gain.value = MASTER;
    // Ein Begrenzer davor, damit zwei überlappende Klänge nicht in die
    // harte Kante bei 1.0 laufen.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    bus.connect(limiter);
    limiter.connect(ctx.destination);
  }
  return ctx;
}

/** Zwei Sekunden weisses Rauschen, einmal gebaut und wiederverwendet. */
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const frames = Math.max(1, Math.floor(c.sampleRate * 2));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  noise = buffer;
  return buffer;
}

/**
 * Aufwecken.
 *
 * Muss bei JEDER Rückkehr laufen, nicht nur einmal: iOS hält den Kontext bei
 * Hintergrund, Anruf und Bildschirmsperre erneut an. Wer das einmalig macht,
 * hat nach dem ersten Anruf eine stumme App und sucht den Fehler woanders.
 */
export function resumeSound(): void {
  const c = ensure();
  if (!c || c.state !== 'suspended') return;
  // Ältere Safaris geben hier `undefined` statt eines Promise zurück.
  const p = c.resume() as Promise<void> | undefined;
  p?.catch?.(() => {});
}

/**
 * Hängt die zwei Aufwecker ein. Läuft einmal beim Start, wie `initNative()`.
 *
 * Der Zuhörer an der ersten Geste ist bewusst NICHT `once`: Lehnt iOS das
 * Aufwachen ab, wäre der einzige Weg zurück sonst ein Hintergrundwechsel,
 * und Tippen hülfe nie wieder. Er hängt sich selbst ab, sobald es läuft.
 */
export function initSound(): void {
  if (typeof document === 'undefined') return;
  const wake = () => {
    if (ctx?.state === 'running') {
      document.removeEventListener('pointerdown', wake, true);
      return;
    }
    resumeSound();
  };
  document.addEventListener('pointerdown', wake, true);
  document.addEventListener('visibilitychange', () => {
    if (ctx && document.visibilityState === 'visible') resumeSound();
  });
}

/**
 * Alles Laufende abbrechen.
 *
 * Ein Knall klingt eine halbe Sekunde nach und hängt am Kontext, nicht an
 * React. Ohne das hier knallt es noch, wenn längst der Spiele-Bildschirm
 * dasteht. Der alte Sammelpunkt wird abgehängt statt gestoppt: laufende
 * Quellen spielen ins Leere und räumen sich selbst ab.
 */
export function stopSounds(): void {
  if (!bus) return;
  try {
    bus.disconnect();
  } catch {
    /* Schon abgehängt – dann ist ohnehin still. */
  }
  bus = null;
}

/**
 * Streuung. Ohne sie klingt jeder Tick exakt gleich, und im Sekundentakt
 * hört man das Muster heraus statt eines Zünders.
 *
 * `Math.random` ist hier unbedenklich: Klang hat keine Folge für den
 * Spielzustand und wird nie über die Lobby geteilt.
 */
function jitter(spanne: number): number {
  return 1 + (Math.random() * 2 - 1) * spanne;
}

export function sound(name: Sound): void {
  if (!enabled) return;
  const c = ensure();
  if (!c || c.state === 'suspended') return;
  const out = bus;
  if (!out) return;
  const now = c.currentTime;

  const src = c.createBufferSource();
  const puffer = noiseBuffer(c);
  src.buffer = puffer;
  src.playbackRate.value = jitter(0.1);
  const gain = c.createGain();
  const filter = c.createBiquadFilter();
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.onended = () => {
    try {
      gain.disconnect();
      filter.disconnect();
    } catch {
      /* Schon abgeräumt. */
    }
  };
  // Zufälliger Startpunkt im Puffer, sonst ist jeder Klang derselbe Ausschnitt.
  const offset = Math.random() * Math.max(0, puffer.duration - 1);

  if (name === 'tick') {
    // Ein Tick lebt oben. Bei 2 kHz kam ein dumpfes „Tuff" heraus; der
    // übliche Bereich für einen trockenen Klick liegt bei 4 bis 7 kHz.
    filter.type = 'highpass';
    filter.frequency.value = 5000 * jitter(0.15);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
    src.start(now, offset, 0.02);
    return;
  }

  /**
   * Der Knall braucht BEWEGUNG, sonst ist er nur Rauschen, das leiser wird.
   *
   * Zwei Dinge fahren nach unten: der Filter von 5 kHz auf 400 Hz und eine
   * tiefe Schicht von 120 auf 40 Hz. Ein fester Tiefpass bei 800 Hz lag
   * ausserdem genau auf der Abbruchkante eines Handylautsprechers — davon
   * kam am Tisch nichts an.
   */
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(5000, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.25);
  gain.gain.setValueAtTime(0.9, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  src.start(now, offset, 0.65);

  const sub = c.createOscillator();
  const subGain = c.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, now);
  sub.frequency.exponentialRampToValueAtTime(40, now + 0.25);
  subGain.gain.setValueAtTime(0.7, now);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  sub.connect(subGain);
  subGain.connect(out);
  sub.onended = () => {
    try {
      subGain.disconnect();
    } catch {
      /* Schon abgeräumt. */
    }
  };
  sub.start(now);
  sub.stop(now + 0.45);
}
