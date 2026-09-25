/**
 * Der Einwegkamera-Look.
 *
 * Nicht dekorativ, sondern der halbe Sinn des Features: ein sauber
 * belichtetes Handyfoto mit einem Filter darüber sieht nach Instagram aus,
 * nicht nach Kodak FunSaver. Was den Look ausmacht, ist die Optik einer
 * Kamera mit fester Blende und hartem Direktblitz – Mitte überbelichtet,
 * Ecken abgesoffen, dazu Korn und ein warmer Stich vom Film.
 *
 * Die Rechnung liegt bewusst als reine Funktion über den Pixeldaten hier
 * und nicht am Canvas: so lässt sie sich prüfen, ohne einen Browser zu
 * starten. Das Canvas-Drumherum steht in `develop.ts`.
 */

export interface FilmLook {
  /** Wie hell der Blitz die Bildmitte zieht. 0 = aus. */
  flash: number;
  /** Wie dunkel die Ecken werden. 0 = aus. */
  vignette: number;
  /** Warmer Farbstich des Films. 0 = neutral. */
  warmth: number;
  /** Stärke des Korns in Helligkeitsstufen (0–255). */
  grain: number;
}

/**
 * Werte einer Wegwerfkamera mit eingebautem Blitz.
 *
 * Gefunden durch Vergleich mit echten Abzügen: weniger Vignette wirkt wie
 * ein Handyfoto, mehr wie ein Effektfilter. Die Zahlen gehören zusammen –
 * einzeln gedreht kippt der Look schnell ins Kitschige.
 */
export const DISPOSABLE: FilmLook = {
  flash: 0.34,
  vignette: 0.55,
  warmth: 0.18,
  grain: 11,
};

/**
 * Dieselbe Optik, deutlich zurueckgenommen – fuer ein Portraet.
 *
 * Ein Profilbild muss auch als 26 Pixel grosser Punkt in einer Liste noch
 * erkennbar sein. Die harten Werte von `DISPOSABLE` fressen dort genau das
 * Gesicht weg: Der Blitzfleck sitzt mitten drauf und die Vignette frisst
 * Haare und Schultern. Weniger Blitz, weniger Vignette, dafuer bleibt der
 * warme Stich – der macht den Wiedererkennungswert aus.
 */
export const PORTRAIT: FilmLook = {
  flash: 0.16,
  vignette: 0.3,
  warmth: 0.14,
  grain: 7,
};

/**
 * Verfremdet ein Bild an Ort und Stelle.
 *
 * `rng` wird hereingereicht, damit ein Test dasselbe Korn zweimal erzeugen
 * kann; im Betrieb ist es `Math.random`.
 */
export function applyFilmLook(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  look: FilmLook = DISPOSABLE,
  rng: () => number = Math.random,
): void {
  const cx = width / 2;
  const cy = height / 2;
  // Halbe Diagonale: der am weitesten vom Zentrum entfernte Punkt liegt bei 1.
  const maxDist = Math.hypot(cx, cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const d = Math.hypot(x - cx, y - cy) / maxDist;

      // Der Blitz fällt zum Rand hin quadratisch ab – nah dran ist zu hell,
      // der Hintergrund säuft weg. Genau das macht Blitzbilder unverkennbar.
      const lit = 1 + look.flash * (1 - d * d) - look.vignette * d * d;

      const noise = (rng() - 0.5) * 2 * look.grain;

      // Warm heißt: Rot rauf, Blau runter. Grün bleibt fast stehen, sonst
      // kippen Hauttöne ins Orange.
      data[i] = clamp(data[i] * lit * (1 + look.warmth * 0.5) + noise);
      data[i + 1] = clamp(data[i + 1] * lit * (1 + look.warmth * 0.1) + noise);
      data[i + 2] = clamp(data[i + 2] * lit * (1 - look.warmth * 0.35) + noise);
    }
  }
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Lange und kurze Kante eines Abzugs, Kleinbild 3:2 in Abzugsgröße. */
const LONG_EDGE = 1620;
const SHORT_EDGE = 1080;

/**
 * Format des Fotos, das aus einem Stream dieser Größe wird.
 *
 * Es folgt der Haltung des Geräts: aufrecht liefert die Kamera ein hohes
 * Bild, dann wird auch das Foto hoch. Ein Querstreifen aus einem hohen
 * Sucherbild wäre genau das, was eine echte Kamera nie tut – sie belichtet
 * den Film so herum, wie man sie hält.
 */
export function photoFormat(width: number, height: number): { w: number; h: number } {
  return width < height ? { w: SHORT_EDGE, h: LONG_EDGE } : { w: LONG_EDGE, h: SHORT_EDGE };
}

/**
 * Zuschnitt vom Sucherbild auf das, was wirklich belichtet wird.
 *
 * Eine Einwegkamera hat einen optischen Sucher NEBEN dem Objektiv – was man
 * sieht, ist nicht ganz das, was auf den Film kommt. Der Versatz ist hier
 * absichtlich nachgebaut: er ist der Grund, warum man das Ergebnis nicht
 * vorhersagen kann, ohne dass man den Leuten den Sucher wegnehmen müsste.
 *
 * Seitenverhältnis wie Kleinbild, 3:2 oder 2:3 – je nachdem, wie herum der
 * Stream kommt (siehe `photoFormat`). Der Sucher zeigt denselben Ausschnitt
 * als Fenster, nur ohne Zoom und Versatz.
 */
export function viewfinderCrop(
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const format = photoFormat(width, height);
  const targetRatio = format.w / format.h;
  // Erst aufs Format beschneiden, dann leicht hineinzoomen: der Sucher zeigt
  // etwas mehr Rand, als am Ende drauf ist.
  const zoom = 0.94;
  let w = width;
  let h = width / targetRatio;
  if (h > height) {
    h = height;
    w = height * targetRatio;
  }
  w *= zoom;
  h *= zoom;
  // Parallaxe: das Objektiv sitzt etwas unterhalb und links vom Sucher.
  const shiftX = width * 0.012;
  const shiftY = height * 0.02;
  return {
    x: (width - w) / 2 - shiftX,
    y: (height - h) / 2 + shiftY,
    w,
    h,
  };
}
