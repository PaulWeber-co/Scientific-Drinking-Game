import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { PartyProvider, useParty, type PartyValue } from './PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * `logSipsFor` ist der zweite Schreibweg neben `usePlayer.logSips` — über ihn
 * laufen Gäste, die im Pass-&-Play-Modus auf diesem Gerät mitgeführt werden.
 * Er kannte weder Zeitpunkt noch Getränk noch einen Rückweg; ein Fehlgriff bei
 * einem Gast war damit nicht mehr zu korrigieren.
 *
 * Firebase wird hier nie angefasst: `getDb()` initialisiert erst beim Aufruf,
 * und der lokale Modus ruft es nicht.
 */

let api!: PartyValue;

function Probe() {
  api = useParty();
  return null;
}

const setup = () => {
  render(
    <PartyProvider>
      <Probe />
    </PartyProvider>,
  );
  act(() => api.startLocal());
};

const addGuest = (name: string, drinkId = 'wine-red') => {
  act(() =>
    api.addLocalPlayer({
      name,
      color: 'pink',
      profile: { ...defaultProfile(), name },
      drinkId,
    }),
  );
  const guest = api.players.find((p) => p.name === name);
  if (!guest) throw new Error(`Gast ${name} wurde nicht angelegt`);
  return guest;
};

beforeEach(() => {
  // Gäste überleben im `sessionStorage` und werden beim nächsten Mount wieder
  // geladen. Ohne diese Zeile findet `addGuest` die Mia des vorigen Tests samt
  // ihrem Log, und die Datei trägt eine stille Reihenfolge-Annahme.
  sessionStorage.clear();
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
    waterCount: 0,
    nightStartedAt: null,
    preloadAskedAt: null,
  });
});

describe('logSipsFor', () => {
  it('datiert einen Eintrag für mich selbst zurück', () => {
    setup();
    const vorhin = Date.now() - 90 * 60 * 1000;
    act(() => api.logSipsFor(api.me.id, 7, 'vorher', { at: vorhin }));

    const log = usePlayer.getState().log;
    expect(log).toHaveLength(1);
    expect(log[0].at).toBe(vorhin);
    expect(log[0].sips).toBe(7);
  });

  it('bucht auf ein anderes Getränk als das eingestellte', () => {
    setup();
    // Eingestellt ist Bier. Der Shot zwischendurch darf nicht als Bier zählen,
    // sonst stimmt die Gramm-Rechnung des ganzen Abends nicht.
    act(() => api.logSipsFor(api.me.id, 1, 'glas', { drinkId: 'shot-tequila' }));

    const [ev] = usePlayer.getState().log;
    expect(ev.drinkId).toBe('shot-tequila');
    expect(ev.alcoholGrams).toBeGreaterThan(4);
  });

  it('ohne Zusatzangaben bleibt es der Weg, den die Spiele nutzen', () => {
    // Gegenprobe zu den beiden Tests darüber: ohne `opts` gilt das
    // eingestellte Getränk und die Uhrzeit von jetzt.
    setup();
    const vorher = Date.now();
    act(() => api.logSipsFor(api.me.id, 3, 'kings-cup'));

    const [ev] = usePlayer.getState().log;
    expect(ev.drinkId).toBe('beer-pils');
    expect(ev.at).toBeGreaterThanOrEqual(vorher);
  });

  it('schreibt einem Gast mit Zeitpunkt und Getränk ins eigene Log', () => {
    setup();
    const gast = addGuest('Mia');
    const vorhin = Date.now() - 45 * 60 * 1000;
    act(() => api.logSipsFor(gast.id, 4, 'vorher', { at: vorhin, drinkId: 'shot-schnaps' }));

    const nachher = api.players.find((p) => p.id === gast.id);
    expect(nachher?.local?.log).toHaveLength(1);
    expect(nachher?.local?.log[0].at).toBe(vorhin);
    expect(nachher?.local?.log[0].drinkId).toBe('shot-schnaps');
    // Mein eigenes Log bleibt unberührt – sonst wandert der Gast-Schluck auf
    // meinen Pegel.
    expect(usePlayer.getState().log).toHaveLength(0);
  });

  it('ignoriert eine Menge von null oder weniger', () => {
    setup();
    const gast = addGuest('Nils');
    act(() => api.logSipsFor(gast.id, 0, 'glas'));
    act(() => api.logSipsFor(api.me.id, -2, 'glas'));

    expect(api.players.find((p) => p.id === gast.id)?.local?.log).toHaveLength(0);
    expect(usePlayer.getState().log).toHaveLength(0);
  });
});

describe('undoLastFor', () => {
  it('nimmt meinen letzten Eintrag zurück und nur den letzten', () => {
    setup();
    act(() => api.logSipsFor(api.me.id, 2, 'glas'));
    act(() => api.logSipsFor(api.me.id, 5, 'glas'));
    act(() => api.undoLastFor(api.me.id));

    const log = usePlayer.getState().log;
    expect(log).toHaveLength(1);
    expect(log[0].sips).toBe(2);
  });

  it('nimmt den letzten Eintrag eines Gastes zurück', () => {
    setup();
    const gast = addGuest('Mia');
    act(() => api.logSipsFor(gast.id, 6, 'glas'));
    act(() => api.undoLastFor(gast.id));

    expect(api.players.find((p) => p.id === gast.id)?.local?.log).toHaveLength(0);
  });

  it('trifft nur die genannte Person', () => {
    // Ohne diese Zusicherung räumt ein Fehlgriff bei einem Gast still den
    // Eintrag einer anderen Person weg.
    setup();
    const mia = addGuest('Mia');
    const nils = addGuest('Nils');
    act(() => api.logSipsFor(mia.id, 6, 'glas'));
    act(() => api.logSipsFor(nils.id, 3, 'glas'));
    act(() => api.undoLastFor(mia.id));

    expect(api.players.find((p) => p.id === mia.id)?.local?.log).toHaveLength(0);
    expect(api.players.find((p) => p.id === nils.id)?.local?.log).toHaveLength(1);
  });

  it('bleibt ruhig, wenn es nichts zurückzunehmen gibt', () => {
    setup();
    const gast = addGuest('Mia');
    act(() => api.undoLastFor(gast.id));
    act(() => api.undoLastFor(api.me.id));

    expect(api.players.find((p) => p.id === gast.id)?.local?.log).toHaveLength(0);
    expect(usePlayer.getState().log).toHaveLength(0);
  });
});
