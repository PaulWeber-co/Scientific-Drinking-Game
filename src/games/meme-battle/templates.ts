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
  /** Herkunft (meist Know Your Meme) – für die Quellenangabe. */
  src?: string;
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
