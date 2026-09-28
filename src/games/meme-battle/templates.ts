import raw from './templates.json';

/**
 * Ein Textfeld auf der Vorlage. Alle Maße sind Anteile des Bildes (0–1), damit
 * dasselbe Feld auf einem kleinen Abzug im Ergebnis und auf dem großen im
 * Editor an derselben Stelle sitzt.
 *
 * Die kurzen Schlüssel kommen aus `scripts/memes/import_memegen.py`: der
 * Katalog reist mit dem Spiel-Chunk, nicht mit dem Haupt-Bundle.
 */
export interface MemeBox {
  /** Ecke oben links. */
  x: number;
  y: number;
  /** Breite und Höhe. */
  w: number;
  h: number;
  /** Drehung in Grad, gegen den Uhrzeigersinn (wie in memegen). */
  r?: number;
  /** Textfarbe; ohne Angabe weiß mit schwarzer Kontur. */
  c?: string;
  /** Schrift; ohne Angabe die dicke Meme-Schrift. */
  f?: 'thin' | 'comic';
  /** `none` = so, wie getippt; ohne Angabe Großbuchstaben. */
  s?: 'none';
  a?: 'left' | 'right';
}

export interface MemeTemplate {
  id: string;
  name: string;
  /** Pixelmaße der ausgelieferten Datei. */
  w: number;
  h: number;
  boxes: MemeBox[];
  /** Herkunft (Know Your Meme bzw. die Sammlung) – für die Quellenangabe. */
  src?: string;
  /** Nur mit Spicy-Schalter (ab 18): Drogen, Mord-Witz, vulgärer Titel. */
  sp?: 1;
}

export const TEMPLATES = raw as MemeTemplate[];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

/**
 * Vorlage zu einer ID. `null`, wenn es sie auf DIESEM Gerät nicht gibt – etwa
 * weil jemand mit einer älteren App-Fassung in der Lobby sitzt. Deshalb reisen
 * IDs und keine Listenplätze: eine neue Vorlage verschiebt sonst alle
 * Nummern, und zwei Geräte zeigten zu derselben Runde verschiedene Bilder.
 */
export function templateOf(id: string | undefined | null): MemeTemplate | null {
  return (id && BY_ID.get(id)) || null;
}

/** Die Bilder liegen neben der App (`public/memes`), nicht in der Datenbank. */
export function memeUrl(id: string): string {
  return `${import.meta.env.BASE_URL}memes/${id}.webp`;
}

/** Wie viele Zeichen ein Feld höchstens trägt. Mehr passt auf kein Meme. */
export const MAX_CHARS = 90;

/** Nie weniger – ein kurzer Satz muss in jedes Feld. */
const MIN_CHARS = 14;
/** Breite des Abzugs auf einem kleinen Handy, in CSS-Pixeln. */
const REF_W = 300;
/** Kleinste Schrift, die man am Tisch noch liest. */
const MIN_FS = 7;

/**
 * Wie viel Text in DIESES Feld passt, ohne dass die Schrift unleserlich klein
 * wird oder der Text aus dem Feld quillt.
 *
 * Das Einpassen in `MemeText` verkleinert die Schrift notfalls bis auf 2 px –
 * passt dann, ist aber nicht mehr lesbar. In winzigen Feldern (Boardroom,
 * Distracted Boyfriend) wäre das schon bei 25 Zeichen so. Gerechnet für einen kleinen Abzug, mit Luft für
 * Zeilenumbrüche an Wortgrenzen; hohe Vorlagen sind im Editor schmaler, weil
 * ihre Höhe begrenzt ist.
 */
export function maxCharsFor(template: MemeTemplate, index: number): number {
  const box = template.boxes[index];
  if (!box) return MAX_CHARS;
  const ar = template.w / template.h;
  const width = Math.min(REF_W, 280 * ar);
  const perLine = (box.w * width) / (MIN_FS * 0.55);
  const lines = Math.max(1, Math.floor((box.h * width) / ar / (MIN_FS * 1.12)));
  return Math.max(MIN_CHARS, Math.min(MAX_CHARS, Math.floor(perLine * lines * 0.75)));
}
