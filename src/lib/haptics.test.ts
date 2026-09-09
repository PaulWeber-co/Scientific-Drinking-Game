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

/**
 * Der native Weg, an der einzigen Stelle, an der er ohne Gerät prüfbar ist:
 * Was passiert, wenn die Bridge den Aufruf ablehnt?
 *
 * Genau das tut sie, wenn `@capacitor/haptics` zwar im Bundle liegt (der
 * Import gelingt immer), im nativen Projekt aber nie einsynchronisiert wurde.
 * Ohne Rückfall wäre die App dann auf Android stumm — dort, wo der Web-Weg
 * vorher funktioniert hat.
 */
describe('Haptik nativ, aber ohne einsynchronisiertes Plugin', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@capacitor/haptics');
    Reflect.deleteProperty(window, 'Capacitor');
    vi.restoreAllMocks();
  });

  it('fällt auf navigator.vibrate zurück, wenn die Bridge ablehnt', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };

    const abgelehnt = vi.fn(() =>
      Promise.reject(new Error('Haptics does not have an implementation')),
    );
    vi.doMock('@capacitor/haptics', () => ({
      Haptics: {
        impact: abgelehnt,
        notification: abgelehnt,
        selectionStart: abgelehnt,
        selectionChanged: abgelehnt,
        selectionEnd: abgelehnt,
        vibrate: abgelehnt,
      },
      ImpactStyle: { LIGHT: 'LIGHT', MEDIUM: 'MEDIUM', HEAVY: 'HEAVY' },
      NotificationType: { SUCCESS: 'SUCCESS', WARNING: 'WARNING', ERROR: 'ERROR' },
    }));

    vi.resetModules();
    const modul = await import('./haptics');
    // Der Import des Plugins läuft asynchron – einmal die Warteschlange leeren.
    await Promise.resolve();
    await Promise.resolve();

    modul.haptic('heavy');
    // Erst der native Versuch …
    expect(abgelehnt).toHaveBeenCalledTimes(1);
    // … und nach dessen Absage der Web-Weg.
    await vi.waitFor(() => expect(vibrate).toHaveBeenCalledTimes(1));

    // Ab jetzt direkt der Web-Weg: kein zweiter Anlauf gegen die Bridge.
    vi.spyOn(performance, 'now').mockReturnValue(performance.now() + 5_000);
    modul.haptic('tap');
    expect(abgelehnt).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(2);
  });
});
