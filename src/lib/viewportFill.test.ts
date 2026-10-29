import { describe, expect, it } from 'vitest';
import { viewportFill } from './viewportFill';

describe('Seite bis zum Bildschirmrand auffüllen', () => {
  it('gleicht die fehlende Statusleiste auf dem Homescreen aus', () => {
    // iPhone mit Dynamic Island: 852 pt Bildschirm, die Seite rechnet mit 793.
    expect(viewportFill({ visible: 852, layout: 793, safeTop: 59 })).toBe(59);
  });

  it('lässt alles, wie es ist, wenn Seite und Bildschirm gleich hoch sind', () => {
    expect(viewportFill({ visible: 852, layout: 852, safeTop: 59 })).toBe(0);
  });

  it('greift nicht bei Lücken, die nicht die Statusleiste sind', () => {
    // Geteilter Bildschirm auf dem iPad oder Browserleisten: viel größer.
    expect(viewportFill({ visible: 1180, layout: 700, safeTop: 24 })).toBe(0);
    // Ohne Statusleiste (Desktop, Browser im Hochformat) nie.
    expect(viewportFill({ visible: 800, layout: 760, safeTop: 0 })).toBe(0);
  });

  it('bleibt bei fehlenden Messwerten bei null', () => {
    expect(viewportFill({ visible: 852, layout: 0, safeTop: 59 })).toBe(0);
    expect(viewportFill({ visible: Number.NaN, layout: 793, safeTop: 59 })).toBe(0);
    expect(viewportFill({ visible: 780, layout: 793, safeTop: 59 })).toBe(0);
  });
});
