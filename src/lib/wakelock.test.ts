import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepScreenAwake } from './wakelock';

/**
 * Ein Sentinel, dessen `released` sich von aussen umlegen laesst – das System
 * gibt die Sperre beim Wechsel in den Hintergrund naemlich selbst frei, und
 * genau danach muss sie neu angefordert werden.
 */
function fakeApi() {
  const release = vi.fn(async () => {});
  const sentinels: { released: boolean }[] = [];
  const request = vi.fn(async () => {
    const sentinel = { released: false, release, addEventListener: () => {} };
    sentinels.push(sentinel);
    return sentinel as unknown as WakeLockSentinel;
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return { request, release, sentinels };
}

const sichtbarkeitswechsel = () => document.dispatchEvent(new Event('visibilitychange'));

afterEach(() => {
  Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
});

describe('Bildschirm wach halten', () => {
  it('fordert die Sperre beim Start an', async () => {
    const { request } = fakeApi();
    const aufhoeren = keepScreenAwake();
    await vi.waitFor(() => expect(request).toHaveBeenCalledWith('screen'));
    aufhoeren();
  });

  it('gibt sie beim Verlassen des Spiels frei', async () => {
    const { request, release } = fakeApi();
    const aufhoeren = keepScreenAwake();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    aufhoeren();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('fordert sie nach der Rückkehr aus dem Hintergrund neu an', async () => {
    // Ohne das waere die Sperre nach dem ersten Anruf oder App-Wechsel fuer
    // den Rest des Abends weg.
    const { request, sentinels } = fakeApi();
    const aufhoeren = keepScreenAwake();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    sentinels[0].released = true; // das System hat sie im Hintergrund freigegeben
    sichtbarkeitswechsel();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    aufhoeren();
  });

  it('fordert keine zweite an, solange die erste noch gilt', async () => {
    // Gegenprobe zum Test darueber: sonst ginge auch ein Leck als "fordert neu
    // an" durch, das bei jedem Sichtbarkeitswechsel eine Sperre mehr haelt.
    const { request } = fakeApi();
    const aufhoeren = keepScreenAwake();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    sichtbarkeitswechsel();
    sichtbarkeitswechsel();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    aufhoeren();
  });

  it('tut nichts, wo es die API nicht gibt', () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
    expect(() => keepScreenAwake()()).not.toThrow();
  });
});
