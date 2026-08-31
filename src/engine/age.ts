import { MIN_AGE_ALCOHOL, MIN_AGE_APP } from './constants';

export type AgeGate = 'blocked' | 'restricted' | 'full';

export function ageGate(age: number): AgeGate {
  if (!Number.isFinite(age) || age < MIN_AGE_APP) return 'blocked';
  if (age < MIN_AGE_ALCOHOL) return 'restricted';
  return 'full';
}

export const AGE_GATE_TEXT: Record<AgeGate, string> = {
  blocked: `Diese App ist erst ab ${MIN_AGE_APP} Jahren.`,
  restricted: `Alkoholfunktionen gibt es ab ${MIN_AGE_ALCOHOL}. Alle Spiele laufen für dich im alkoholfreien Modus.`,
  full: '',
};
