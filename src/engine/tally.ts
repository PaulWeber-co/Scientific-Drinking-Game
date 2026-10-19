import { findDrink, sipUnit, sipsPerServing } from './drinks';
import { plural } from '../lib/format';
import type { DrinkDefinition, DrinkEvent } from './types';

/**
 * Zählen in Gläsern.
 *
 * Intern rechnet die App in Schlucken und Gramm, der Mensch am Tisch denkt
 * in Gläsern. Hier liegt die Umrechnung in beide Richtungen und die Summe je
 * Getränk – rein, damit sie ohne Browser prüfbar ist.
 */

/** Wie viele Gläser diese Schluckzahl bei diesem Getränk sind. Ein Shot ist ein Glas. */
export function glassesOf(drink: DrinkDefinition, sips: number): number {
  return sips / sipsPerServing(drink);
}

/** Schlucke für so viele Gläser – mindestens einer, sonst wäre der Eintrag leer. */
export function sipsForGlasses(drink: DrinkDefinition, glasses: number): number {
  return Math.max(1, Math.round(sipsPerServing(drink) * glasses));
}

/**
 * Lesbare Menge: „1 Glas", „½ Glas", „1½ Gläser", „2 Shots" – und wenn es
 * kein rundes Glas ist, ehrlich „3 Schlucke". Ein Spiel sagt Schlucke an,
 * der Glas-Knopf bucht Gläser; beides landet im selben Log und muss dort
 * unterscheidbar bleiben.
 */
export function formatAmount(drink: DrinkDefinition, sips: number): string {
  if (drink.sipIsUnit) return `${sips} ${sipUnit(drink, sips)}`;
  const halves = Math.round(glassesOf(drink, sips) * 2);
  if (halves >= 1 && sipsForGlasses(drink, halves / 2) === sips) {
    const whole = Math.floor(halves / 2);
    const half = halves % 2 === 1;
    const zahl = whole === 0 ? '½' : half ? `${whole}½` : String(whole);
    return `${zahl} ${plural(halves > 2 ? 2 : 1, 'Glas', 'Gläser')}`;
  }
  return `${sips} ${sipUnit(drink, sips)}`;
}

/**
 * Menge samt Getränk: „1 Glas Bier (Pils)", „2× Shot (Schnaps)", „3 Schlucke
 * Weißwein". `name` kommt aus dem Eintrag, wenn das Getränk hier nicht mehr
 * bekannt ist (gelöschtes eigenes Getränk, Gast von einem anderen Handy).
 */
export function formatEntry(
  drink: DrinkDefinition,
  sips: number,
  name = drink.name,
  volumeMl?: number,
): string {
  if (volumeMl !== undefined) {
    const glasses = volumeMl / drink.defaultVolumeMl;
    const halves = Math.round(glasses * 2);
    // Nur genaue halbe/ganze Standardgläser so benennen. Eine 0,5-l-Flasche
    // Pils ist keine gerundete 1½-Portion des 0,33-l-Katalogglases.
    if (Math.abs(glasses * 2 - halves) < 1e-8 && halves > 0) {
      if (drink.sipIsUnit && Number.isInteger(glasses)) return `${glasses}× ${name}`;
      return `${formatGlassCount(glasses)} ${name}`;
    }
    return `${formatVolume(drink, sips, volumeMl)} ${name}`;
  }
  if (drink.sipIsUnit) return `${sips}× ${name}`;
  return `${formatAmount(drink, sips)} ${name}`;
}

/** Historische Mengen hängen vom damaligen Glas ab, nicht vom heutigen Katalog. */
export function eventDrink(event: DrinkEvent, customs: DrinkDefinition[] = []): DrinkDefinition {
  return event.drink ?? findDrink(event.drinkId, customs);
}

export interface TallyRow {
  drink: DrinkDefinition;
  /** Name aus dem Eintrag – auch dann richtig, wenn das Getränk hier unbekannt ist. */
  name: string;
  sips: number;
  glasses: number;
  grams: number;
}

export interface Tally {
  rows: TallyRow[];
  glasses: number;
  grams: number;
}

/**
 * Summe je Getränk, das Schwerste zuerst. Gläser sind hier eine Kommazahl;
 * gerundet wird erst bei der Anzeige.
 */
export function tally(log: readonly DrinkEvent[], customs: DrinkDefinition[] = []): Tally {
  const map = new Map<string, TallyRow>();
  for (const e of log) {
    const drink = eventDrink(e, customs);
    const glasses = e.volumeMl === undefined
      ? glassesOf(drink, e.sips)
      : e.volumeMl / drink.defaultVolumeMl;
    const row = map.get(e.drinkId);
    if (row) {
      row.sips += e.sips;
      row.grams += e.alcoholGrams;
      row.glasses += glasses;
      continue;
    }
    map.set(e.drinkId, {
      drink,
      name: e.drinkName,
      sips: e.sips,
      glasses,
      grams: e.alcoholGrams,
    });
  }
  const rows = [...map.values()].sort((a, b) => b.grams - a.grams);
  return {
    rows,
    glasses: rows.reduce((s, r) => s + r.glasses, 0),
    grams: rows.reduce((s, r) => s + r.grams, 0),
  };
}

/** Gläser gerundet auf ein halbes: 2,4 → „2½", 0,2 → „¼" wäre Scheingenauigkeit. */
export function formatGlasses(glasses: number): string {
  const halves = Math.round(glasses * 2);
  if (halves === 0) return '0';
  const whole = Math.floor(halves / 2);
  return halves % 2 === 1 ? (whole === 0 ? '½' : `${whole}½`) : String(whole);
}

/** „1 Glas", „½ Glas", „2½ Gläser" – die Zahl samt richtigem Wort. */
export function formatGlassCount(glasses: number): string {
  return `${formatGlasses(glasses)} ${Math.round(glasses * 2) <= 2 ? 'Glas' : 'Gläser'}`;
}

/**
 * Menge eines Eintrags: „0,5 l", „2 cl". Manuelle Einträge übergeben ihr
 * exaktes Volumen; bei älteren Einträgen bleibt die bisherige Umrechnung.
 */
export function formatVolume(drink: DrinkDefinition, sips: number, volumeMl?: number): string {
  const ml = volumeMl ?? glassesOf(drink, sips) * drink.defaultVolumeMl;
  const zahl = (n: number, stellen: number) => String(Number(n.toFixed(stellen))).replace('.', ',');
  return ml < 100 ? `${zahl(ml / 10, 2)} cl` : `${zahl(ml / 1000, 3)} l`;
}
