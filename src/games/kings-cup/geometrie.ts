/**
 * Geometrie des Kartenkranzes. Eigene Datei, damit `Kranz.tsx` sie nutzen
 * kann, ohne einen Zyklus mit `index.tsx` zu bauen.
 */

/** Feste Plätze im Kranz. 52, weil ein Blatt 52 Karten hat. */
export const SLOTS = 52;

/**
 * Der nächste belegte Platz zu `slot`, im Ring nach beiden Seiten gesucht.
 *
 * Zwei Aufrufer, beide brauchen genau das: der Finger liegt zwischen zwei
 * Karten oder über einem Loch, und die Aktion darf trotzdem nicht ins Leere
 * laufen. `-1`, wenn kein Platz mehr belegt ist.
 */
export function nearestFilled(deck: readonly (number | null)[], slot: number): number {
  const n = deck.length;
  if (!n) return -1;
  // Auch ein NaN aus einer fremden Aktion landet so auf einem gueltigen Platz.
  const start = Number.isFinite(slot) ? ((Math.round(slot) % n) + n) % n : 0;
  for (let d = 0; d <= n / 2; d++) {
    const vor = (start + d) % n;
    if (deck[vor] != null) return vor;
    const zurueck = (start - d + n) % n;
    if (deck[zurueck] != null) return zurueck;
  }
  return -1;
}

/**
 * Winkel eines Platzes in Grad, 0 = oben, im Uhrzeigersinn.
 *
 * `total` ist Pflichtparameter mit Vorgabe: `nearestFilled` rechnet mit
 * `deck.length`, und ein Kranz aus einem AELTEREN Zustand kann kuerzer als 52
 * sein (Host-Uebernahme). Rechneten beide mit verschiedenen Zahlen, hoebe der
 * Finger dauerhaft eine Karte an ganz anderer Stelle.
 */
export function slotAngle(slot: number, total: number = SLOTS): number {
  return (slot * 360) / Math.max(1, total);
}

/**
 * Kleine, feste Unregelmaessigkeit je Platz.
 *
 * Ohne sie sind 52 gleich gedrehte Karten auf einem exakten Kreis ein
 * Zahnrad, kein Kranz - am Tisch legt niemand so. Der Wert haengt nur am
 * Platz, wackelt also zwischen zwei Renderings nie.
 */
export function slotJitter(slot: number): { dreh: number; raus: number } {
  // Billiger, aber gut gestreuter Hash. `Math.random` ginge nicht: der Kranz
  // spraenge bei jedem Rendern neu.
  const h = Math.sin(slot * 12.9898) * 43758.5453;
  const a = h - Math.floor(h);
  const b = (h * 1.618) - Math.floor(h * 1.618);
  return { dreh: (a - 0.5) * 13, raus: (b - 0.5) * 0.075 };
}
