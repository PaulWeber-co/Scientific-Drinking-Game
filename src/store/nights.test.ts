import { beforeEach, describe, expect, it } from 'vitest';
import type { DrinkEvent, Profile } from '../engine/types';
import { closeStaleNight, defaultProfile, usePlayer } from './player';
import {
  NIGHTS_CAPACITY,
  NIGHTS_KEEP,
  mergeParticipants,
  prune,
  useNights,
  type Night,
  type NightParticipant,
} from './nights';

/** Echte Zeitstempel: mit Werten aus 1970 laeuft die Pegel-Suche ewig. */
const NOW = Date.now();

const LISA: NightParticipant = { id: 'd_lisa', name: 'Lisa', color: 'indigo' };
const PAUL: NightParticipant = { id: 'd_paul', name: 'Paul', color: 'mint' };

function event(at: number, grams = 10): DrinkEvent {
  return { id: `e${at}`, at, drinkId: 'beer-pils', drinkName: 'Pils', sips: 3, alcoholGrams: grams };
}

function night(startedAt: number): Night {
  return {
    id: `n${startedAt}`,
    startedAt,
    endedAt: startedAt + 3_600_000,
    participants: [],
    log: [],
    waterCount: 0,
    peakBac: 0,
    peakAt: startedAt,
    soberAt: startedAt,
  };
}

const profile: Profile = { ...defaultProfile(), name: 'Toby' };

beforeEach(() => {
  localStorage.clear();
  useNights.setState({ nights: [], current: [] });
  usePlayer.setState({ profile, log: [], nightStartedAt: null, waterCount: 0 });
});

describe('Teilnehmer sammeln', () => {
  it('behält, wer zwischendurch geht', () => {
    const { noteParticipants } = useNights.getState();
    noteParticipants([LISA, PAUL]);
    noteParticipants([LISA]);
    expect(useNights.getState().current.map((p) => p.id)).toEqual([LISA.id, PAUL.id]);
  });

  it('zählt jemanden nach Wiedereintritt nur einmal', () => {
    const { noteParticipants } = useNights.getState();
    noteParticipants([LISA]);
    noteParticipants([]);
    noteParticipants([LISA]);
    expect(useNights.getState().current).toHaveLength(1);
  });

  it('führt zwei Gäste mit gleichem Namen NICHT zusammen', () => {
    // Der umgekehrte Fehler waere der schlimmere: einer der beiden Maxe
    // verschwaende sonst spurlos aus dem Rueckblick.
    const maxA = { id: 'd_1', name: 'Max', color: 'indigo' } as const;
    const maxB = { id: 'd_2', name: 'Max', color: 'mint' } as const;
    expect(mergeParticipants([maxA], [maxB])).toHaveLength(2);
  });

  it('übernimmt einen geänderten Namen für dieselbe Kennung', () => {
    const merged = mergeParticipants([LISA], [{ ...LISA, name: 'Lisa M.' }]);
    expect(merged).toEqual([{ ...LISA, name: 'Lisa M.' }]);
  });

  it('trägt eine Umbenennung auch wirklich in den Store ein', () => {
    // Wer ohne Profilnamen beitritt, heisst erst „Spieler". Ohne diesen Weg
    // steht er dauerhaft so im Rueckblick.
    const { noteParticipants } = useNights.getState();
    noteParticipants([{ ...LISA, name: 'Spieler' }]);
    noteParticipants([{ ...LISA, name: 'Lisa' }]);
    expect(useNights.getState().current[0].name).toBe('Lisa');
  });

  it('übernimmt auch eine geänderte Farbe', () => {
    const { noteParticipants } = useNights.getState();
    noteParticipants([LISA]);
    noteParticipants([{ ...LISA, color: 'mint' }]);
    expect(useNights.getState().current[0].color).toBe('mint');
  });
});

describe('Deckel', () => {
  it('lässt alles stehen, solange die Grenze nicht erreicht ist', () => {
    const nights = Array.from({ length: NIGHTS_CAPACITY }, (_, i) => night(i));
    expect(prune(nights)).toHaveLength(NIGHTS_CAPACITY);
  });

  it('wirft beim Überlauf die ältesten weg', () => {
    const nights = Array.from({ length: NIGHTS_CAPACITY + 1 }, (_, i) => night(i));
    const kept = prune(nights);
    expect(kept).toHaveLength(NIGHTS_KEEP);
    // Neueste stehen vorn, also bleibt der vorderste erhalten.
    expect(kept[0].id).toBe(nights[0].id);
  });
});

describe('Abend abschließen', () => {
  it('legt den Abend samt Teilnehmern ins Archiv und leert das Log', () => {
    useNights.getState().noteParticipants([LISA, PAUL]);
    usePlayer.setState({ log: [event(NOW - 3_600_000)], nightStartedAt: NOW - 3_600_000, waterCount: 2 });

    usePlayer.getState().endNight();

    const [n] = useNights.getState().nights;
    expect(n.participants.map((p) => p.name)).toEqual(['Lisa', 'Paul']);
    expect(n.log).toHaveLength(1);
    expect(n.waterCount).toBe(2);
    expect(usePlayer.getState().log).toEqual([]);
    expect(usePlayer.getState().nightStartedAt).toBeNull();
    // Der naechste Abend faengt mit leerer Teilnehmerliste an.
    expect(useNights.getState().current).toEqual([]);
  });

  it('archiviert auch einen Abend ganz ohne Getränke', () => {
    usePlayer.setState({ nightStartedAt: 5_000 });
    usePlayer.getState().endNight();
    expect(useNights.getState().nights).toHaveLength(1);
  });

  it('archiviert nichts, wenn gar kein Abend lief', () => {
    usePlayer.getState().endNight();
    expect(useNights.getState().nights).toEqual([]);
  });

  it('friert den höchsten Pegel ein, statt ihn später neu zu rechnen', () => {
    const at = Date.now() - 3_600_000;
    usePlayer.setState({ log: [event(at, 40)], nightStartedAt: at });
    usePlayer.getState().endNight();
    expect(useNights.getState().nights[0].peakBac).toBeGreaterThan(0);
  });

  it('legt einen zweiten Abend daneben, nicht darüber', () => {
    usePlayer.setState({ nightStartedAt: 1_000 });
    usePlayer.getState().endNight();
    usePlayer.setState({ nightStartedAt: 2_000 });
    usePlayer.getState().endNight();
    expect(useNights.getState().nights).toHaveLength(2);
  });
});

describe('Abendbeginn', () => {
  it('startet mit dem ersten Getränk', () => {
    usePlayer.getState().logEvent(event(7_000));
    expect(usePlayer.getState().nightStartedAt).toBe(7_000);
  });

  it('startet auch ohne Getränk, wenn ein Spiel losgeht', () => {
    usePlayer.getState().beginNight();
    expect(usePlayer.getState().nightStartedAt).not.toBeNull();
  });

  it('verschiebt den Beginn nicht, wenn der Abend schon läuft', () => {
    usePlayer.setState({ nightStartedAt: 4_000 });
    usePlayer.getState().beginNight();
    expect(usePlayer.getState().nightStartedAt).toBe(4_000);
  });
});

describe('Alles zurücksetzen', () => {
  it('nimmt die Rückblicke mit', () => {
    usePlayer.setState({ nightStartedAt: 1_000 });
    usePlayer.getState().endNight();
    usePlayer.getState().resetAll();
    expect(useNights.getState().nights).toEqual([]);
  });
});

describe('Ort und Löschen', () => {
  it('trägt einen Ort ein und entfernt ihn bei leerer Eingabe wieder', () => {
    useNights.setState({ nights: [night(1_000)] });
    const id = useNights.getState().nights[0].id;
    useNights.getState().setPlace(id, '  Bei Paul  ');
    expect(useNights.getState().nights[0].place).toBe('Bei Paul');
    useNights.getState().setPlace(id, '   ');
    expect(useNights.getState().nights[0].place).toBeUndefined();
  });

  it('löscht einen einzelnen Abend', () => {
    useNights.setState({ nights: [night(1_000), night(2_000)] });
    useNights.getState().remove(useNights.getState().nights[0].id);
    expect(useNights.getState().nights).toHaveLength(1);
  });
});

describe('Abgelaufene Nacht beim App-Start', () => {
  it('archiviert sie, statt sie wegzuwerfen', () => {
    // Der dritte Weg, auf dem ein Abend endet: kein Knopf, sondern die
    // 14-Stunden-Regel beim Rehydrieren. Ohne Archivierung waere ein Abend,
    // den niemand ausdruecklich abgeschlossen hat, spurlos weg.
    const vorgestern = NOW - 40 * 3_600_000;
    usePlayer.setState({ log: [event(vorgestern)], nightStartedAt: vorgestern });
    closeStaleNight(usePlayer.getState(), NOW);
    expect(useNights.getState().nights).toHaveLength(1);
    expect(usePlayer.getState().nightStartedAt).toBeNull();
  });

  it('lässt einen laufenden Abend in Ruhe', () => {
    const vorhin = NOW - 2 * 3_600_000;
    usePlayer.setState({ log: [event(vorhin)], nightStartedAt: vorhin });
    closeStaleNight(usePlayer.getState(), NOW);
    expect(useNights.getState().nights).toEqual([]);
    expect(usePlayer.getState().nightStartedAt).toBe(vorhin);
  });
});

describe('Bestehende Stände', () => {
  it('läuft ohne Verlust weiter, wenn es noch gar keine Abende gibt', () => {
    // So sieht der Speicher aus, bevor diese Stage existierte: `sdg.player`
    // in v3, kein `sdg.nights`.
    const log = [event(NOW - 3_600_000)];
    localStorage.setItem(
      'sdg.player',
      JSON.stringify({
        version: 3,
        state: {
          profile,
          onboarded: true,
          currentDrinkId: 'beer-pils',
          customDrinks: [],
          log,
          nightStartedAt: NOW - 3_600_000,
          waterCount: 2,
        },
      }),
    );
    usePlayer.persist.rehydrate();

    const s = usePlayer.getState();
    expect(s.profile?.name).toBe('Toby');
    expect(s.log).toHaveLength(1);
    expect(s.waterCount).toBe(2);
    expect(s.nightStartedAt).toBe(NOW - 3_600_000);
    expect(useNights.getState().nights).toEqual([]);
  });

  it('archiviert einen abgelaufenen Abend aus einem alten Stand vollständig', () => {
    const alt = NOW - 40 * 3_600_000;
    localStorage.setItem(
      'sdg.player',
      JSON.stringify({
        version: 3,
        state: { profile, onboarded: true, log: [event(alt)], nightStartedAt: alt, waterCount: 3 },
      }),
    );
    usePlayer.persist.rehydrate();

    const [n] = useNights.getState().nights;
    expect(n, 'abgelaufener Abend wurde archiviert').toBeTruthy();
    expect(n.log).toHaveLength(1);
    expect(n.waterCount).toBe(3);
    expect(usePlayer.getState().log).toEqual([]);
  });
});
