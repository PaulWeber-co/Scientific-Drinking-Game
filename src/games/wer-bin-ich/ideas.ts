import { shuffle } from '../../lib/format';
import { markTextsSeen, orderByFreshness } from '../../store/seen';
import { CATEGORIES } from './categories';
import type { Level } from './game';

/**
 * „Idee" beim Schreiben: EIN Vorschlag aus einem festen Pool je Kategorie,
 * nie eine Liste zum Durchblättern. Die Ideen bleiben auf dem schreibenden
 * Gerät – sie reisen nicht durch den Spielstand.
 */
export type Pool = Record<string, Record<Level, string[]>>;

/** Kategorien ohne Ideen: Vorschläge wären dort Behauptungen über echte Menschen. */
export const NO_POOL: ReadonlySet<string> = new Set(['Jemand mit Skandal']);

/**
 * Eigene und frei getippte Kategorien haben keinen Pool. Groß und klein zählt
 * nicht – so wie der Reducer getippte Namen eingebauten Kategorien zuordnet.
 */
export function hasIdeas(category: string): boolean {
  const key = category.trim().toLocaleLowerCase('de');
  const builtIn = CATEGORIES.find((c) => c.text.toLocaleLowerCase('de') === key);
  return !!builtIn && !NO_POOL.has(builtIn.text);
}

let pool: Promise<Pool> | null = null;

/** Der Pool ist groß und lädt erst, wenn jemand schreibt. */
export function loadPool(): Promise<Pool> {
  pool ??= import('./pools.json').then((m) => m.default as Pool);
  return pool;
}

const norm = (t: string) => t.trim().toLocaleLowerCase('de');

/**
 * Nächste Idee: nichts, was schon als Begriff am Tisch liegt, nichts, was
 * dieses Gerät gerade schon gezeigt hat; Ungesehenes vor Bekanntem. Sind alle
 * gezeigt, beginnt die Runde der Vorschläge von vorn.
 *
 * Mischt per Zufall – deshalb nur aus einem Klick heraus aufrufen, nie beim Rendern.
 */
export function nextIdea(
  ideas: readonly string[],
  taken: readonly string[],
  shown: readonly string[],
): string | null {
  const blocked = new Set(taken.map(norm));
  const free = ideas.filter((t) => !blocked.has(norm(t)));
  const fresh = free.filter((t) => !shown.includes(t));
  const pick = orderByFreshness(shuffle(fresh.length ? fresh : free), (t) => t)[0] ?? null;
  if (pick) markTextsSeen([pick]);
  return pick;
}
