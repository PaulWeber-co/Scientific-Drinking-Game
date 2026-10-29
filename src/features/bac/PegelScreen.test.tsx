import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PegelScreen } from './PegelScreen';
import { PartyCtx, type PartyValue } from '../party/PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink, sipsPerServing } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import { residualBac } from '../../engine/bac';
import { formatBac } from '../../lib/format';
import type { GamePlayer } from '../../games/types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * Die heutigen Einträge im Pegel-Tab: seit Einträge rückdatiert werden können,
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
    ...usePlayer.getInitialState(),
    profile: { ...defaultProfile(), name: 'Paul' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
    nightStartedAt: JETZT - 2 * STUNDE,
  });
});

afterEach(() => vi.useRealTimers());

it('behält den schnellen Eintrag und berücksichtigt Restalkohol im aufgeklappten Fahr-Check', () => {
  const events = [makeDrinkEvent(findDrink('beer-pils'), 40, 'glas', JETZT - STUNDE)];
  usePlayer.setState({ log: events });
  usePlayer.getState().endNight();
  mount();

  expect(screen.getByRole('button', { name: 'Getränk eintragen' })).toBeInTheDocument();
  expect(screen.getByText('Restalkohol aus abgeschlossenen Abenden wird weiter berücksichtigt.')).toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: 'Fahrtauglichkeit' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole('button', { name: 'weniger' }));

  const target = new Date(JETZT);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() <= JETZT) target.setDate(target.getDate() + 1);
  const expected = residualBac(events, usePlayer.getState().profile!, target.getTime());
  expect(expected).toBeGreaterThan(0);
  expect(screen.getByText(new RegExp(`Geschätzt ${formatBac(expected)} ‰ um 00:00`))).toBeInTheDocument();
});

describe('Heute', () => {
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

it('zeigt Heute vor dem Verlauf und erklärt die Schätzung am Glas', () => {
  usePlayer.setState({
    log: [makeDrinkEvent(findDrink('beer-pils'), 3, 'glas', JETZT - STUNDE)],
  });
  mount();

  const today = screen.getByRole('heading', { name: 'Heute' });
  const chart = screen.getByText('Verlauf & Prognose');
  expect(today.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText('Schätzung, kein Messwert')).toBeVisible();
});

it('zeigt die Berechnungsdetails erst nach dem Aufklappen', () => {
  mount();

  expect(screen.queryByText(/Verteilungsfaktor|Körperwasser|Ansagen/)).not.toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: 'So rechnet Pegel' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Körperwasser-Anteil')).toBeVisible();
  expect(screen.getByText(/Widmark-Faktor · (Watson|Standard) · bleibt auf diesem Handy/)).toBeVisible();
  expect(screen.queryByText('Ansagen')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.queryByText('Körperwasser-Anteil')).not.toBeInTheDocument();
});

it('zeigt zunächst die drei jüngsten Einträge und klappt die übrigen auf und zu', () => {
  usePlayer.setState({
    log: [4, 1, 3, 0, 2].map((hours) =>
      makeDrinkEvent(findDrink('beer-pils'), hours + 1, 'glas', JETZT - hours * STUNDE),
    ),
  });
  mount();

  const entries = () => screen.getAllByRole('button', { name: /^Eintrag .* entfernen$/ });
  expect(entries()).toHaveLength(3);
  expect(screen.getAllByText(/^\d Schlucke? Bier \(Pils\)$/).map((el) => el.textContent))
    .toEqual(['1 Schluck Bier (Pils)', '2 Schlucke Bier (Pils)', '3 Schlucke Bier (Pils)']);
  fireEvent.click(screen.getByRole('button', { name: 'Alle Einträge (5)' }));
  expect(entries()).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'Weniger zeigen' }));
  expect(entries()).toHaveLength(3);
});

it.each([0, 1, 3])('braucht bei %i Einträgen keinen Knopf zum Aufklappen', (count) => {
  usePlayer.setState({
    log: Array.from({ length: count }, (_, i) =>
      makeDrinkEvent(findDrink('beer-pils'), 3, 'glas', JETZT - i * STUNDE),
    ),
  });
  mount();

  expect(screen.queryByRole('button', { name: /Alle Einträge|Weniger zeigen/ })).not.toBeInTheDocument();
});

it('zeigt aufgeklappt wirklich alle Einträge, auch mehr als zwanzig', () => {
  const anzahl = 25;
  usePlayer.setState({
    log: Array.from({ length: anzahl }, (_, i) =>
      makeDrinkEvent(findDrink('beer-pils'), 1, 'glas', JETZT - i * 60_000),
    ),
  });
  mount();

  fireEvent.click(screen.getByRole('button', { name: `Alle Einträge (${anzahl})` }));
  expect(screen.getAllByRole('button', { name: /^Eintrag .* entfernen$/ })).toHaveLength(anzahl);
});
