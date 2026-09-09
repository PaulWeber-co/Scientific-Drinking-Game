import { describe, expect, it } from 'vitest';
import { squareCrop } from './portrait';

describe('Zuschnitt fürs Profilbild', () => {
  it('nimmt bei einem Querformat die Mitte', () => {
    const c = squareCrop(1600, 900);
    expect(c.size).toBe(900);
    expect(c.y).toBe(0);
    // Links und rechts bleibt gleich viel liegen.
    expect(c.x).toBe((1600 - 900) / 2);
  });

  it('lässt bei einem Hochformat oben mehr stehen als unten', () => {
    const c = squareCrop(900, 1600);
    expect(c.size).toBe(900);
    expect(c.x).toBe(0);
    // Der Kopf sitzt im oberen Drittel: ein mittiger Schnitt (350) würde ihn
    // anschneiden, deshalb liegt der Ausschnitt deutlich höher.
    expect(c.y).toBeLessThan((1600 - 900) / 2);
    expect(c.y).toBeGreaterThan(0);
  });

  it('lässt ein quadratisches Bild unangetastet', () => {
    expect(squareCrop(500, 500)).toEqual({ x: 0, y: 0, size: 500 });
  });

  it('bleibt bei jedem Seitenverhältnis im Bild', () => {
    for (const [w, h] of [
      [4000, 3000],
      [3000, 4000],
      [1080, 1920],
      [17, 400],
      [400, 17],
    ]) {
      const c = squareCrop(w, h);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.x + c.size).toBeLessThanOrEqual(w);
      expect(c.y + c.size).toBeLessThanOrEqual(h);
    }
  });
});
