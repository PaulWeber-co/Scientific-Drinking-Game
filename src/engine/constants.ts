/** Dichte von Ethanol in g/ml. */
export const ETHANOL_DENSITY = 0.789;

/** Durchschnittliche Abbaurate in Promille pro Stunde (Literatur: 0.10 - 0.20). */
export const BETA_TYPICAL = 0.15;

/** Konservative Abbaurate für Sicherheitsaussagen (Nüchternzeit, Fahrtauglichkeit). */
export const BETA_CONSERVATIVE = 0.1;

/**
 * Resorptionsdefizit: 10-30 % des getrunkenen Alkohols erreichen das Blut nie
 * (First-Pass-Metabolismus in Magen/Leber). Für die Live-Schätzung nehmen wir
 * den unteren, realistischen Wert. Sicherheitsrechnungen laufen mit 0.
 */
export const RESORPTION_DEFICIT = 0.1;

/**
 * Zeitkonstante der Resorption in Minuten, je nach Magenfüllung.
 *
 * Kalibriert am Zeitpunkt des Maximums: die Literatur nennt 30–60 Minuten auf
 * nüchternen Magen und 60–90 Minuten nach dem Essen. Mit diesen Werten liegt
 * das Maximum eines halben Liters Bier bei rund 33 / 41 / 51 Minuten und
 * wandert bei größeren Mengen erwartungsgemäß nach hinten.
 */
export const ABSORPTION_TAU_MIN = {
  empty: 14,
  light: 22,
  full: 32,
} as const;

/** Standard-Widmark-Faktoren, wenn keine Körpergröße hinterlegt ist. */
export const WIDMARK_R = {
  male: 0.68,
  female: 0.55,
  diverse: 0.615,
} as const;

/** Wasseranteil im Vollblut – Umrechnung Körperwasser -> Widmark-Faktor. */
export const BLOOD_WATER_FRACTION = 0.806;

/** Ziel-Pegel Voreinstellung (Mitte des "Sweet Spots"). */
export const DEFAULT_TARGET_BAC = 0.4;
export const MIN_TARGET_BAC = 0.2;
export const MAX_TARGET_BAC = 0.6;

/** Ab hier greift die Notbremse: es wird nie mehr ausgegeben. */
export const HARD_CAP_BAC = 0.8;

/**
 * Wie viel Promille eine einzelne Ansage höchstens aufbaut.
 *
 * Der Regler schließt die Lücke zum Zielpegel vollständig, aber nie schneller
 * als das hier – sonst stünde am Anfang eines Abends "trink 16 Schlucke".
 * Eine feste Obergrenze statt eines festen Bruchteils der Lücke ist wichtig:
 * ein Regler, der immer nur einen Bruchteil der Lücke ausgibt, bleibt
 * dauerhaft unter dem Ziel stehen.
 */
export const MAX_RISE_PER_TURN = 0.09;

/** Wie stark ein harter Spielzug diese Obergrenze anheben darf. */
export const MAX_HARSHNESS = 2;

/** Ein Spielzug ohne besondere Gewichtung entspricht so vielen "Basis-Schlucken". */
export const NEUTRAL_BASE_SIPS = 3;

/** Obergrenze pro Ansage, egal was die Rechnung sagt. */
export const MAX_SIPS_PER_TURN = 6;

/**
 * Anteil des getrunkenen Alkohols, der im Blut ankommt.
 *
 * Muss zum Wert in der Simulation passen: `alcoholPerSip` ist getrunkener
 * Alkohol, die Pegelrechnung arbeitet mit dem resorbierten Anteil. Ohne diese
 * Umrechnung dosiert die App systematisch zu niedrig.
 */
export const DOSING_ABSORPTION = 1 - RESORPTION_DEFICIT;

/** Mindestalter für die App bzw. für die Alkoholfunktionen. */
export const MIN_AGE_APP = 16;
export const MIN_AGE_ALCOHOL = 18;
