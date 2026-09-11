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
export function formatEntry(drink: DrinkDefinition, sips: number, name = drink.name): string {
  if (drink.sipIsUnit) return `${sips}× ${name}`;
  return `${formatAmount(drink, sips)} ${name}`;
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
    const row = map.get(e.drinkId);
    if (row) {
      row.sips += e.sips;
      row.grams += e.alcoholGrams;
      row.glasses = glassesOf(row.drink, row.sips);
      continue;
    }
    const drink = findDrink(e.drinkId, customs);
    map.set(e.drinkId, {
      drink,
      name: e.drinkName,
      sips: e.sips,
      glasses: glassesOf(drink, e.sips),
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
