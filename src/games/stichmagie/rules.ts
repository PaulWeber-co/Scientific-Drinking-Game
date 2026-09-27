/**
 * Die Regeln von Stichmagie – ohne React, ohne Zustand, nur Karten.
 *
 * Das Vorbild ist das Stichspiel mit Zauberern und Narren samt den
 * Sonderkarten der Jubiläumsausgaben. Die Regeln der Sonderkarten folgen den
 * veröffentlichten Regeln des Verlags; wo sie eine Lücke lassen, steht hier,
 * wie die App entscheidet – und warum.
 *
 * Kartennummern (eine Zahl je Karte, damit der Zustand klein bleibt – er geht
 * bei jeder Aktion komplett über die Leitung):
 *
 *   0–51   Farbkarten: Farbe = id / 13, Wert = id % 13 + 1 (1–13)
 *   52–55  Magier
 *   56–59  Narren
 *   60–68  Sonderkarten, siehe SPECIAL_ID
 */

export type Special =
  'drache' | 'fee' | 'bombe' | 'werwolf' | 'jongleur' | 'wolke' | 'wandler' | 'hexe' | 'vampir';

export const SPECIALS: readonly Special[] = [
  'drache',
  'fee',
  'bombe',
  'werwolf',
  'jongleur',
  'wolke',
  'wandler',
  'hexe',
  'vampir',
];

export const SPECIAL_ID: Record<Special, number> = {
  drache: 60,
  fee: 61,
  bombe: 62,
  werwolf: 63,
  jongleur: 64,
  wolke: 65,
  wandler: 66,
  hexe: 67,
  vampir: 68,
};

export const MAGIER = [52, 53, 54, 55] as const;
export const NARREN = [56, 57, 58, 59] as const;

/** Das Grundspiel: 52 Farbkarten, vier Magier, vier Narren. */
export const BASE_DECK = 60;

export type Kind = 'num' | 'magier' | 'narr' | Special;

export function isCard(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 && id <= 68;
}

export function kindOf(id: number): Kind {
  if (id < 52) return 'num';
  if (id < 56) return 'magier';
  if (id < 60) return 'narr';
  return SPECIALS[id - 60] ?? 'narr';
}

export function suitOf(id: number): number | null {
  return id < 52 ? Math.floor(id / 13) : null;
}

export function valueOf(id: number): number | null {
  return id < 52 ? (id % 13) + 1 : null;
}

// ---------------------------------------------------------------------------
// Farben
// ---------------------------------------------------------------------------

/**
 * Vier Farben, jede mit einem eigenen Motiv. Angesagt wird am Tisch aber die
 * FARBE („Rot ist Trumpf") – deshalb heißen sie so und nicht nach dem Motiv.
 */
export const SUITS = [
  { name: 'Rot', motif: 'Flamme', color: '#ff5a4e', deep: '#8f1d16' },
  { name: 'Blau', motif: 'Welle', color: '#3d9bff', deep: '#123f82' },
  { name: 'Grün', motif: 'Blatt', color: '#3fd07a', deep: '#11613a' },
  { name: 'Gelb', motif: 'Sonne', color: '#ffc93c', deep: '#8a5a07' },
] as const;

export function suitName(suit: number | null | undefined): string {
  return suit == null ? 'Kein Trumpf' : (SUITS[suit]?.name ?? '');
}

// ---------------------------------------------------------------------------
// Voreinstellungen
// ---------------------------------------------------------------------------

export type Preset = 'klassisch' | 'jubilaeum' | 'alle';

/** Die sieben Sonderkarten der 25-Jahre-Ausgabe. */
export const JUBILAEUM: readonly Special[] = [
  'drache',
  'fee',
  'bombe',
  'werwolf',
  'jongleur',
  'wolke',
  'wandler',
];

export const PRESETS: Record<Preset, readonly Special[]> = {
  klassisch: [],
  jubilaeum: JUBILAEUM,
  alle: SPECIALS,
};

export function presetOf(specials: readonly Special[]): Preset | null {
  for (const [name, list] of Object.entries(PRESETS) as [Preset, readonly Special[]][]) {
    if (list.length === specials.length && list.every((s) => specials.includes(s))) return name;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Runden
// ---------------------------------------------------------------------------

export type Length = 'kurz' | 'voll' | 'rauf-runter';

/**
 * So viele Runden wie im Grundspiel: 60 Karten durch die Zahl der Leute.
 *
 * Die Sonderkarten verlängern das Spiel bewusst NICHT – wie im Vorbild. Dafür
 * bleibt auch in der letzten Runde ein Stapel übrig und es gibt immer eine
 * Trumpfkarte.
 */
export function maxRounds(players: number): number {
  return Math.max(1, Math.floor(BASE_DECK / Math.max(1, players)));
}

/** Kartenzahl je Runde, in Spielreihenfolge. */
export function planFor(players: number, length: Length): number[] {
  const max = maxRounds(players);
  const rauf = Array.from({ length: max }, (_, i) => i + 1);
  if (length === 'kurz') return rauf.slice(0, Math.ceil(max / 2));
  if (length === 'rauf-runter') return [...rauf, ...rauf.slice(0, -1).reverse()];
  return rauf;
}

// ---------------------------------------------------------------------------
// Trumpf
// ---------------------------------------------------------------------------

/**
 * Was die aufgedeckte Karte für den Trumpf bedeutet.
 *
 * Farbkarte: ihre Farbe. Magier: der Geber wählt. Narr oder keine Karte:
 * kein Trumpf. Bei den Sonderkarten sagen die Regeln für Wolke, Werwolf und
 * Drache ausdrücklich „der Geber wählt". Die App behandelt alle „starken"
 * Karten so (auch Jongleur, Gestaltwandler und Vampir, die jede Farbe sein
 * können) und alle „schwachen" wie einen Narren (Fee, Bombe und – laut
 * Regel – die Hexe).
 */
export function trumpFrom(indicator: number | null): {
  trump: number | null;
  dealerChooses: boolean;
} {
  if (indicator == null) return { trump: null, dealerChooses: false };
  const kind = kindOf(indicator);
  if (kind === 'num') return { trump: suitOf(indicator), dealerChooses: false };
  if (kind === 'narr' || kind === 'fee' || kind === 'bombe' || kind === 'hexe') {
    return { trump: null, dealerChooses: false };
  }
  return { trump: null, dealerChooses: true };
}

/**
 * Welche Karte der Vampir diese Runde kopiert.
 *
 * Laut Regel die aufgedeckte Trumpfkarte. Liegt dort der Werwolf, wird die
 * nächste Karte vom Stapel aufgedeckt und kopiert (`spare`). Gibt es nichts
 * zu kopieren, ist er ein Narr.
 */
export function vampirCopy(indicator: number | null, spare: number | null): number | null {
  if (indicator == null) return null;
  if (indicator === SPECIAL_ID.werwolf) return spare ?? null;
  if (indicator === SPECIAL_ID.vampir) return null;
  return indicator;
}

// ---------------------------------------------------------------------------
// Ausspielen
// ---------------------------------------------------------------------------

export type Shape = 'magier' | 'narr';

/** Eine gelegte Karte samt der Entscheidungen, die beim Legen fielen. */
export interface Played {
  card: number;
  by: string;
  /** Jongleur und Wolke: die angesagte Farbe. */
  suit?: number;
  /** Gestaltwandler: als Magier oder als Narr gespielt. */
  shape?: Shape;
  /** Von der Hexe hineingelegt – zählt nicht mehr, liegt nur noch da. */
  swapped?: boolean;
}

/** Was eine Karte im Stich WIRKLICH ist – nach Wahl und Kopie. */
export type Effective =
  | { t: 'num'; suit: number; value: number; effect?: 'jongleur' | 'wolke' }
  | { t: 'magier' }
  | { t: 'narr' }
  | { t: 'drache' }
  | { t: 'fee' }
  | { t: 'bombe' }
  | { t: 'hexe' };

/** Welche Frage beim Ausspielen dieser Karte gestellt werden muss. */
export function choiceFor(card: number, vampirAs: number | null): 'suit' | 'shape' | null {
  const kind = kindOf(card);
  if (kind === 'jongleur' || kind === 'wolke') return 'suit';
  if (kind === 'wandler') return 'shape';
  if (kind === 'vampir') {
    return vampirAs == null || vampirAs === SPECIAL_ID.vampir ? null : choiceFor(vampirAs, null);
  }
  return null;
}

export function effective(p: Played, vampirAs: number | null): Effective {
  const kind = kindOf(p.card);
  const suit = isSuit(p.suit) ? p.suit : 0;
  switch (kind) {
    case 'num':
      return { t: 'num', suit: suitOf(p.card)!, value: valueOf(p.card)! };
    case 'magier':
    case 'drache':
    case 'fee':
    case 'bombe':
    case 'hexe':
    case 'narr':
      return { t: kind };
    case 'jongleur':
      return { t: 'num', suit, value: 7.5, effect: 'jongleur' };
    case 'wolke':
      return { t: 'num', suit, value: 9.75, effect: 'wolke' };
    case 'wandler':
      return { t: p.shape === 'magier' ? 'magier' : 'narr' };
    case 'vampir': {
      const copy = vampirAs;
      if (copy == null || copy === SPECIAL_ID.vampir || copy === SPECIAL_ID.werwolf) {
        return { t: 'narr' };
      }
      return effective({ ...p, card: copy }, null);
    }
    // Der Werwolf wird nie gespielt – er liegt ab der Ansage als Trumpfkarte.
    default:
      return { t: 'narr' };
  }
}

export function isSuit(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 3;
}

/**
 * Die Farbe, die bedient werden muss – oder `null`, wenn frei gespielt wird.
 *
 * Wie im Vorbild bestimmt die erste FARBKARTE die Farbe. Narren (und was sich
 * wie ein Narr verhält: Fee, Bombe, Hexe) davor zählen nicht. Kommt vor der
 * ersten Farbkarte ein Magier oder der Drache, ist der Stich frei.
 */
export function ledSuit(trick: readonly Played[], vampirAs: number | null): number | null {
  for (const p of trick) {
    const e = effective(p, vampirAs);
    if (e.t === 'num') return e.suit;
    if (e.t === 'magier' || e.t === 'drache') return null;
  }
  return null;
}

/**
 * Welche Handkarten gerade erlaubt sind.
 *
 * Bedienen muss man nur mit echten Farbkarten. Magier, Narren und alle
 * Sonderkarten dürfen immer gespielt werden – auch der Vampir, selbst wenn er
 * eine Karte der geforderten Farbe kopiert (so die Regel der 30-Jahre-Ausgabe).
 */
export function legalCards(
  hand: readonly number[],
  trick: readonly Played[],
  vampirAs: number | null,
): number[] {
  const led = ledSuit(trick, vampirAs);
  if (led === null) return [...hand];
  const canFollow = hand.some((c) => suitOf(c) === led);
  if (!canFollow) return [...hand];
  return hand.filter((c) => c >= 52 || suitOf(c) === led);
}

/** Rang der Karten, die nie einen Farbstich gewinnen – für den Fall ohne Farbkarte. */
const LOW_RANK: Record<string, number> = { narr: 3, fee: 2, hexe: 1, bombe: 0 };

/**
 * Welche Karte den Stich hält – ohne Rücksicht auf die Bombe.
 *
 * 1. Drache schlägt alles. Liegt die Fee daneben, gewinnt die Fee.
 * 2. Sonst gewinnt der erste Magier.
 * 3. Sonst die höchste Trumpfkarte, sonst die höchste Karte der Farbe.
 * 4. Liegt gar keine Farbkarte: der erste Narr (so im Vorbild), danach Fee,
 *    dann Hexe.
 */
export function strongestIndex(
  trick: readonly Played[],
  trump: number | null,
  vampirAs: number | null,
): number {
  const effs = trick.map((p) => effective(p, vampirAs));
  const drache = effs.findIndex((e) => e.t === 'drache');
  if (drache >= 0) {
    const fee = effs.findIndex((e) => e.t === 'fee');
    return fee >= 0 ? fee : drache;
  }
  const magier = effs.findIndex((e) => e.t === 'magier');
  if (magier >= 0) return magier;

  const led = ledSuit(trick, vampirAs);
  const best = (suit: number | null) => {
    if (suit === null) return -1;
    let idx = -1;
    let top = -Infinity;
    effs.forEach((e, i) => {
      if (e.t === 'num' && e.suit === suit && e.value > top) {
        top = e.value;
        idx = i;
      }
    });
    return idx;
  };
  const trumpIdx = best(trump);
  if (trumpIdx >= 0) return trumpIdx;
  const ledIdx = best(led);
  if (ledIdx >= 0) return ledIdx;

  let idx = 0;
  let top = -Infinity;
  effs.forEach((e, i) => {
    const r = LOW_RANK[e.t] ?? -1;
    if (r > top) {
      top = r;
      idx = i;
    }
  });
  return idx;
}

export interface TrickResult {
  /** Wer den Stich bekommt – `null` bei einer Bombe. */
  winner: string | null;
  /** Wer als Nächstes ausspielt. Bei der Bombe: wer die höchste Karte gelegt hat. */
  lead: string;
  bomb: boolean;
  /** Der Drache lag, aber die Fee hat ihn bezwungen. */
  fairyBeatsDragon: boolean;
}

export function resolveTrick(
  trick: readonly Played[],
  trump: number | null,
  vampirAs: number | null,
): TrickResult {
  const effs = trick.map((p) => effective(p, vampirAs));
  const idx = strongestIndex(trick, trump, vampirAs);
  const lead = trick[idx]?.by ?? trick[0]?.by ?? '';
  const bomb = effs.some((e) => e.t === 'bombe');
  return {
    winner: bomb ? null : lead,
    lead,
    bomb,
    fairyBeatsDragon: effs.some((e) => e.t === 'drache') && effs.some((e) => e.t === 'fee'),
  };
}

/** Punkte einer Runde: getroffen 20 + 10 je Stich, sonst −10 je Stich Abstand. */
export function roundScore(bid: number, won: number): number {
  return bid === won ? 20 + 10 * won : -10 * Math.abs(bid - won);
}

/**
 * Welche Ansage der letzten Person verboten ist, wenn „Ansagen dürfen nicht
 * aufgehen" gilt – oder `null`, wenn alles erlaubt ist.
 */
export function forbiddenBid(cards: number, sumSoFar: number, isLast: boolean, rule: boolean) {
  if (!rule || !isLast) return null;
  const f = cards - sumSoFar;
  return f >= 0 && f <= cards ? f : null;
}

// ---------------------------------------------------------------------------
// Anzeige
// ---------------------------------------------------------------------------

export const SPECIAL_INFO: Record<Special, { name: string; edition: string; rule: string }> = {
  drache: {
    name: 'Drache',
    edition: 'Jubiläum',
    rule: 'Schlägt alles, auch jeden Magier. Nur die Fee bezwingt ihn.',
  },
  fee: {
    name: 'Fee',
    edition: 'Jubiläum',
    rule: 'Niedriger als ein Narr – liegt aber der Drache im selben Stich, gewinnt sie.',
  },
  bombe: {
    name: 'Bombe',
    edition: 'Jubiläum',
    rule: 'Den Stich bekommt niemand. Wer die höchste Karte gelegt hat, spielt als Nächstes aus.',
  },
  werwolf: {
    name: 'Werwolf',
    edition: 'Jubiläum',
    rule: 'Wird vor der Ansage gegen die Trumpfkarte getauscht. Wer ihn hat, bestimmt den Trumpf – oder dass es keinen gibt.',
  },
  jongleur: {
    name: 'Jongleur',
    edition: 'Jubiläum',
    rule: 'Wert 7½ in einer Farbe deiner Wahl. Nach dem Stich gibt jede Person eine Handkarte nach links.',
  },
  wolke: {
    name: 'Wolke',
    edition: 'Jubiläum',
    rule: 'Wert 9¾ in einer Farbe deiner Wahl. Wer den Stich gewinnt, muss die Ansage um eins ändern.',
  },
  wandler: {
    name: 'Gestaltwandler',
    edition: '25 Jahre',
    rule: 'Beim Ausspielen entscheidest du: Magier oder Narr.',
  },
  hexe: {
    name: 'Hexe',
    edition: '30 Jahre',
    rule: 'Nach dem Stich tauschst du eine Handkarte gegen eine Karte aus dem Stich. Niedriger als Narr und Fee.',
  },
  vampir: {
    name: 'Vampir',
    edition: '30 Jahre',
    rule: 'Kopiert die aufgedeckte Trumpfkarte samt Effekten. Zum Bedienen musst du ihn nie legen.',
  },
};

export function cardName(id: number): string {
  const kind = kindOf(id);
  if (kind === 'num') return `${SUITS[suitOf(id)!].name} ${valueOf(id)}`;
  if (kind === 'magier') return 'Magier';
  if (kind === 'narr') return 'Narr';
  return SPECIAL_INFO[kind].name;
}

/** Wie eine gelegte Karte heißt, samt Wahl („Wolke · Blau", „Gestaltwandler als Magier"). */
export function playedName(p: Played, vampirAs: number | null): string {
  const kind = kindOf(p.card);
  const base = cardName(p.card);
  if (kind === 'jongleur' || kind === 'wolke') return `${base} · ${suitName(p.suit ?? 0)}`;
  if (kind === 'wandler') return `${base} als ${p.shape === 'magier' ? 'Magier' : 'Narr'}`;
  if (kind === 'vampir') {
    const copy = vampirAs;
    if (copy == null || copy === SPECIAL_ID.vampir || copy === SPECIAL_ID.werwolf) {
      return `${base} als Narr`;
    }
    return `${base} als ${playedName({ ...p, card: copy }, null)}`;
  }
  return base;
}
