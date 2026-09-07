import { describe, expect, it } from 'vitest';
import { migrateApp } from './app';

/**
 * Die Migration ist der Pfad, den JEDE bestehende Installation nimmt. Fehlt
 * dort ein neues Feld, geht sie mit `undefined` in die Auswahl – und niemand
 * merkt es, weil frische Installationen den Default aus dem Store bekommen.
 */
describe('Migration der App-Einstellungen', () => {
  it('setzt Altbeständen ohne Aufgaben-Schalter „manchmal"', () => {
    const alt = { theme: 'dark', gameLength: 'lang' } as unknown;
    expect(migrateApp(alt, 3).taskOnSkip).toBe('manchmal');
  });

  it('setzt noch älteren Ständen auch die Spiellänge', () => {
    const alt = { theme: 'dark' } as unknown;
    const neu = migrateApp(alt, 2);
    expect(neu.gameLength).toBe('mittel');
    expect(neu.taskOnSkip).toBe('manchmal');
  });

  it('lässt einen aktuellen Stand unangetastet', () => {
    // Gegenprobe: eine Migration, die immer schreibt, wuerde die Wahl des
    // Nutzers bei jedem Start ueberbuegeln.
    const aktuell = { theme: 'light', gameLength: 'kurz', taskOnSkip: 'aus' } as unknown;
    const neu = migrateApp(aktuell, 4);
    expect(neu.taskOnSkip).toBe('aus');
    expect(neu.gameLength).toBe('kurz');
  });
});
