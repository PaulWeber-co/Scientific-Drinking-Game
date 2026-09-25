import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PegelScreen } from './PegelScreen';
import { PartyCtx, type PartyValue } from '../party/PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink, sipsPerServing } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import type { GamePlayer } from '../../games/types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * Das Trink-Log im Pegel-Tab: seit Einträge rückdatiert werden können,
 * muss die Liste nach Uhrzeit stehen, nicht nach Eingabe – und jeder
 * Eintrag muss einzeln herausgehen.
 */

const JETZT = new Date('2026-09-11T22:00:00Z').getTime();
const STUNDE = 3_600_000;
const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };

function mount() {
  const value = {
    mode: 'local',
    players: [me],
    me,
    logSipsFor: vi.fn(),
    removeEventFor: vi.fn(),
  } as unknown as PartyValue;
  return render(
    <MemoryRouter initialEntries={['/pegel']}>
      <PartyCtx.Provider value={value}>
        <PegelScreen />
      </PartyCtx.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(JETZT);
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
    nightStartedAt: JETZT - 2 * STUNDE,
  });
});

describe('Trink-Log', () => {
  it('steht nach Uhrzeit, auch wenn ein Eintrag nachgetragen wurde', () => {
    const pils = findDrink('beer-pils');
    const per = sipsPerServing(pils);
    // Erst das Glas von jetzt, DANN der Nachtrag „vor 1 Std".
    usePlayer.setState({
      log: [
        makeDrinkEvent(pils, per, 'glas', JETZT),
        makeDrinkEvent(pils, 3, 'vorher', JETZT - STUNDE),
      ],
    });
    mount();

    const zeilen = screen.getAllByText(/^(\d|½).* Bier \(Pils\)$/).map((el) => el.textContent);
    expect(zeilen).toEqual(['1 Glas Bier (Pils)', '3 Schlucke Bier (Pils)']);
  });

  it('entfernt einen bestimmten Eintrag, nicht den letzten', () => {
    const pils = findDrink('beer-pils');
    const alt = makeDrinkEvent(pils, 2, 'glas', JETZT - STUNDE);
    const neu = makeDrinkEvent(pils, 5, 'glas', JETZT);
    usePlayer.setState({ log: [alt, neu] });
    mount();

    const knoepfe = screen.getAllByRole('button', { name: /^Eintrag .* entfernen$/ });
    // Zweite Zeile = der ältere Eintrag.
    fireEvent.click(knoepfe[1]);

    expect(usePlayer.getState().log.map((e) => e.sips)).toEqual([5]);
  });
});
