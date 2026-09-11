import { describe, expect, it } from 'vitest';
import { BLACK, WHITE } from './cards';

/**
 * Die Kartenbibliothek ist der größte Teil dieses Spiels und der einzige, den
 * kein Typ und kein Lint prüft. Hier stehen die Formregeln als Zusicherung.
 *
 * Was hier NICHT geprüft werden kann: ob eine Karte witzig ist und ob sie auf
 * eine Gruppe zielt statt auf eine Lage. Das bleibt der blinde Fleck dieser
 * Datei und braucht ein Auge.
 */

const LUECKE = /_{4}/g;
const luecken = (t: string) => (t.match(LUECKE) ?? []).length;
const norm = (t: string) => t.toLowerCase().replace(/[^a-zäöüß]/g, '');

/** Nach einer Präposition zerreißt der Nominativ der Antwortkarte. */
const PRAEPOSITIONEN = [
  'um', 'an', 'auf', 'für', 'mit', 'bei', 'von', 'zu', 'in', 'über', 'durch',
  'gegen', 'ohne', 'nach', 'aus', 'vor', 'unter', 'wegen', 'seit', 'ab',
  'hinter', 'neben', 'zwischen', 'im', 'am', 'zum', 'zur', 'beim', 'vom',
  'ins', 'aufs',
];

/** Grobe Wortliste für die Tabus. Fängt Ausrutscher, nicht jede Formulierung. */
const TABU = [
  'jude', 'jüdisch', 'moslem', 'muslim', 'christ', 'kirche', 'allah', 'islam',
  'neger', 'zigeuner', 'schwul', 'lesbe', 'homo', 'transe', 'behindert',
  'spasti', 'mongo', 'krebs', 'demenz', 'hitler', 'nazi', 'führer',
  'selbstmord', 'suizid', 'vergewalt', 'kinderporno', 'pädo',
];

describe('Kartenbibliothek', () => {
  it('ist vollzählig', () => {
    expect(BLACK.length).toBeGreaterThanOrEqual(120);
    expect(WHITE.length).toBeGreaterThanOrEqual(600);
  });

  it('hat einen tragfähigen Stapel ohne Spicy', () => {
    // Ohne Schalter muss ein volles Spiel laufen – der normale Stapel ist
    // kein Rumpf. Bei zehn Spielern liegen 90 Karten auf den Händen.
    expect(BLACK.filter((c) => !c.spicy).length).toBeGreaterThanOrEqual(80);
    expect(WHITE.filter((c) => !c.spicy).length).toBeGreaterThanOrEqual(380);
  });

  it('hält den Spicy-Anteil bei rund einem Drittel', () => {
    const anteil = WHITE.filter((c) => c.spicy).length / WHITE.length;
    expect(anteil).toBeGreaterThan(0.25);
    expect(anteil).toBeLessThan(0.45);
  });

  it('bringt Karten mit zwei Lücken mit, aber keine mit dreien', () => {
    const zwei = BLACK.filter((c) => c.pick === 2);
    expect(zwei.length).toBeGreaterThanOrEqual(8);
    expect(BLACK.every((c) => luecken(c.text) <= 2)).toBe(true);
  });

  it('nennt so viele Lücken, wie die Karte verlangt', () => {
    // Zu wenige Marken heißt: eine gelegte Karte verschwindet spurlos.
    const falsch = BLACK.filter((c) => luecken(c.text) !== (c.pick ?? 1));
    expect(falsch.map((c) => c.text)).toEqual([]);
  });

  it('setzt die Lücke nie hinter eine Präposition', () => {
    // Antwortkarten stehen im Nominativ. Nach „um", „an", „mit" bräuchte es
    // Akkusativ oder Dativ, und der Satz zerbricht beim Einsetzen.
    const falsch = BLACK.filter((c) =>
      c.text.split('____').slice(0, -1).some((vor) => {
        const rest = vor.trimEnd();
        if (rest.endsWith('?') || rest.endsWith(':')) return false;
        const wort = rest.split(/\s+/).pop()?.toLowerCase().replace(/[^a-zäöüß]/g, '') ?? '';
        return PRAEPOSITIONEN.includes(wort);
      }),
    );
    expect(falsch.map((c) => c.text)).toEqual([]);
  });

  it('hält die Längen ein, damit nichts abgeschnitten wird', () => {
    expect(BLACK.filter((c) => c.text.length > 90).map((c) => c.text)).toEqual([]);
    expect(WHITE.filter((c) => c.text.length > 45).map((c) => c.text)).toEqual([]);
  });

  it('schreibt Antwortkarten klein und ohne Schlusspunkt', () => {
    // Sie werden in Sätze eingesetzt; ein großer Artikel oder ein Punkt
    // mitten im Satz verrät sofort, dass da eine Karte klebt.
    const gross = WHITE.filter((c) => c.text[0] !== c.text[0].toLowerCase());
    const punkt = WHITE.filter((c) => /[.!]$/.test(c.text));
    expect(gross.map((c) => c.text)).toEqual([]);
    expect(punkt.map((c) => c.text)).toEqual([]);
  });

  it('wiederholt keinen Text', () => {
    for (const liste of [BLACK, WHITE]) {
      const gesehen = new Map<string, string>();
      const doppelt: string[] = [];
      for (const c of liste) {
        const k = norm(c.text);
        if (gesehen.has(k)) doppelt.push(c.text);
        gesehen.set(k, c.text);
      }
      expect(doppelt).toEqual([]);
    }
  });

  it('berührt keines der Tabus', () => {
    const treffer: string[] = [];
    for (const c of [...BLACK, ...WHITE]) {
      const t = c.text.toLowerCase();
      for (const wort of TABU) if (t.includes(wort)) treffer.push(`${wort}: ${c.text}`);
    }
    expect(treffer).toEqual([]);
  });

  it('fängt ein Tabu wirklich ab', () => {
    // Gegenprobe zur Prüfzeile darüber: ohne sie prüft die Liste nichts.
    const t = 'Was denkt ein Nazi beim Frühstück? ____'.toLowerCase();
    expect(TABU.some((w) => t.includes(w))).toBe(true);
  });
});
