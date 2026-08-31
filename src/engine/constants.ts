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

/** Zeitkonstante der Resorption in Minuten, je nach Magenfüllung. */
export const ABSORPTION_TAU_MIN = {
  empty: 9,
  light: 16,
  full: 26,
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

/** Ueber wie viele Trinkansagen der Weg zum Zielpegel gestreckt wird. */
export const PACE_ROUNDS = 3;

/** Ein Spielzug ohne besondere Gewichtung entspricht so vielen "Basis-Schlucken". */
export const NEUTRAL_BASE_SIPS = 3;

/** Obergrenze pro Ansage, egal was die Rechnung sagt. */
export const MAX_SIPS_PER_TURN = 6;

/** Unter diesem Rechenwert wird ausgesetzt statt aufgerundet. */
export const SIP_ROUND_FLOOR = 0.35;

/** Mindestalter für die App bzw. für die Alkoholfunktionen. */
export const MIN_AGE_APP = 16;
export const MIN_AGE_ALCOHOL = 18;
