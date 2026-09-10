import { describe, expect, it, vi } from 'vitest';
import { migrateApp, rehydrateApp, type AppState } from './app';

vi.mock('../lib/haptics', () => ({ setHapticsEnabled: vi.fn() }));
vi.mock('../lib/sound', () => ({ setSoundEnabled: vi.fn() }));

const { setHapticsEnabled } = await import('../lib/haptics');
const { setSoundEnabled } = await import('../lib/sound');

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

  it('lässt Bestandsnutzern den Ton an', () => {
    // Ohne diese Zeile stuende `sound: undefined` im Speicher, und die
    // Wiederherstellung schaltete den Ton stumm, ohne dass jemand ihn
    // ausgeschaltet hat.
    const alt = { theme: 'dark', gameLength: 'kurz', taskOnSkip: 'aus' } as unknown;
    expect(migrateApp(alt, 4).sound).toBe(true);
  });

  it('lässt einen aktuellen Stand unangetastet', () => {
    // Gegenprobe: eine Migration, die immer schreibt, wuerde die Wahl des
    // Nutzers bei jedem Start ueberbuegeln.
    const aktuell = {
      theme: 'light',
      gameLength: 'kurz',
      taskOnSkip: 'aus',
      sound: false,
    } as unknown;
    const neu = migrateApp(aktuell, 5);
    expect(neu.taskOnSkip).toBe('aus');
    expect(neu.gameLength).toBe('kurz');
    expect(neu.sound).toBe(false);
  });
});

/**
 * Die Wiederherstellung ist der zweite Weg, auf dem ein fehlendes Feld
 * durchschlägt – und der einzige, den die Migration NICHT abdeckt: Sie läuft
 * nur beim Versionswechsel. Ein Eintrag, der die aktuelle Version trägt, aber
 * unvollständig ist (halb geschrieben, von Hand beschnitten), geht ungeprüft
 * durch und schaltete Ton und Vibration still ab.
 */
describe('Wiederherstellung der App-Einstellungen', () => {
  it('schaltet nichts ab, was im Eintrag gar nicht steht', () => {
    const zerrupft = { theme: 'dark' } as unknown as AppState;
    rehydrateApp(zerrupft);
    expect(zerrupft.sound).toBe(true);
    expect(zerrupft.haptics).toBe(true);
    expect(setSoundEnabled).toHaveBeenLastCalledWith(true);
    expect(setHapticsEnabled).toHaveBeenLastCalledWith(true);
  });

  it('respektiert eine bewusste Abschaltung', () => {
    // Gegenprobe: die Absicherung darf die Wahl des Nutzers nicht überschreiben.
    const aus = { theme: 'dark', sound: false, haptics: false } as unknown as AppState;
    rehydrateApp(aus);
    expect(aus.sound).toBe(false);
    expect(setSoundEnabled).toHaveBeenLastCalledWith(false);
    expect(setHapticsEnabled).toHaveBeenLastCalledWith(false);
  });

  it('verkraftet einen Speicher ganz ohne Eintrag', () => {
    expect(() => rehydrateApp(undefined)).not.toThrow();
  });
});
