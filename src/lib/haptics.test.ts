import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { haptic, hapticRamp, setHapticsEnabled } from './haptics';

/**
 * Geprüft wird der Web-Weg (`navigator.vibrate`). Der native Weg über die
 * Taptic Engine lässt sich ohne Gerät nicht nachstellen; dort ist die einzige
 * Aussage, dass das Plugin geladen wird, wenn es eins gibt.
 *
 * Die Uhr wird direkt gestellt statt über Fake-Timer: die Sperre misst mit
 * `performance.now()`, und sie soll genau hier nachweisbar monoton bleiben.
 */
describe('Haptik', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  let uhr = 100_000;

  const vorspulen = (ms: number) => {
    uhr += ms;
  };

  beforeEach(() => {
    vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    // Jeder Test beginnt weit hinter der Sperre des vorigen.
    vorspulen(10_000);
    vi.spyOn(performance, 'now').mockImplementation(() => uhr);
    setHapticsEnabled(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setHapticsEnabled(true);
  });

  it('gibt jedem Muster eine eigene Vibration', () => {
    haptic('tap');
    vorspulen(100);
    haptic('error');
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate.mock.calls[0][0]).not.toEqual(vibrate.mock.calls[1][0]);
  });

  it('schweigt, wenn Vibration ausgeschaltet ist', () => {
    setHapticsEnabled(false);
    haptic('heavy');
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('lässt kein Dauerfeuer durch', () => {
    // Ein gedrückt gehaltener Stepper oder eine Liste unter dem Daumen darf
    // die Warteschlange der Engine nicht volllaufen lassen.
    haptic('tap');
    vorspulen(5);
    haptic('tap');
    vorspulen(5);
    haptic('tap');
    expect(vibrate).toHaveBeenCalledTimes(1);

    vorspulen(60);
    haptic('tap');
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it('wird härter, je näher der Knall kommt', () => {
    hapticRamp(0);
    vorspulen(100);
    hapticRamp(1);
    const leicht = Number(vibrate.mock.calls[0][0]);
    const hart = Number(vibrate.mock.calls[1][0]);
    expect(hart).toBeGreaterThan(leicht);
  });

  it('verkraftet Geräte ohne Vibrationsmotor', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(() => haptic('success')).not.toThrow();
  });
});
