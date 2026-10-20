import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { LogDrinkSheet } from './LogDrinkSheet';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink, sipsPerServing } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * Das Sheet ist der eine Weg, ein beliebiges Getränk einzutragen – aus dem
 * Spiel, dem Pegel-Tab und der Lobby. Sein Kern: Der Tipp auf das Getränk
 * bucht, und das eingestellte Spiel-Getränk bleibt unberührt.
 */

const JETZT = new Date('2026-09-11T22:00:00Z').getTime();
const STUNDE = 60 * 60 * 1000;
const PILS = sipsPerServing(findDrink('beer-pils'));
const WEIN = sipsPerServing(findDrink('wine-white'));

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const mia: GamePlayer = {
  id: 'p1',
  name: 'Mia',
  color: 'pink',
  online: true,
  local: {
    profile: { ...defaultProfile(), name: 'Mia' },
    drinkId: 'wine-red',
    log: [makeDrinkEvent(findDrink('shot-schnaps'), 1, 'glas', JETZT - STUNDE)],
  },
};

const onLog = vi.fn();
const onClose = vi.fn();

const mount = (players: GamePlayer[] = [me]) =>
  render(<LogDrinkSheet open onClose={onClose} players={players} meId="p0" onLog={onLog} />);

const tile = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(JETZT);
  onLog.mockClear();
  onClose.mockClear();
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Eintragen', () => {
  it('bucht mit einem Tipp ein ganzes Glas, jetzt', () => {
    mount();
    fireEvent.click(tile(/^1 Glas Weißwein eintragen$/));

    expect(onLog).toHaveBeenCalledTimes(1);
    const [playerId, drink, sips, at] = onLog.mock.calls[0];
    expect(playerId).toBe('p0');
    expect(drink.id).toBe('wine-white');
    expect(sips).toBe(WEIN);
    expect(at).toBe(JETZT);
    expect(onClose).toHaveBeenCalled();
  });

  it('lässt das eingestellte Spiel-Getränk in Ruhe', () => {
    // Der ganze Grund für dieses Sheet: ein Shot zwischendurch darf die
    // nächste Ansage nicht in Shots umstellen.
    mount();
    fireEvent.click(tile(/^1× Tequila \/ Wodka eintragen$/));

    expect(usePlayer.getState().currentDrinkId).toBe('beer-pils');
  });

  it('bucht ein halbes Glas als halbe Schluckzahl', () => {
    mount();
    fireEvent.click(screen.getByText('½ Glas'));
    fireEvent.click(tile(/^½ Glas Bier \(Pils\) eintragen$/));

    expect(onLog.mock.calls[0][2]).toBe(Math.round(PILS / 2));
  });

  it('zeigt auf der Kachel die echte Menge zur gewählten Größe', () => {
    // „Ganzes" und „Halbes" sagten nicht, wie viel. Die Kachel muss beim
    // Umschalten mitrechnen, sonst steht dort eine falsche Menge.
    mount();
    const weizen = () => tile(/Weißbier eintragen$/);
    expect(within(weizen()).getByText('0,5 l · 5,4 %')).toBeTruthy();
    fireEvent.click(screen.getByText('2 Gläser'));
    expect(within(weizen()).getByText('1 l · 5,4 %')).toBeTruthy();
  });

  it('datiert „1 Std her" um eine Stunde zurück', () => {
    // Der teure Fehler ist die fehlende Uhrzeit, nicht das halbe Glas.
    mount();
    fireEvent.click(screen.getByText('1 Std her'));
    fireEvent.click(tile(/^1 Glas Bier \(Pils\) eintragen$/));

    expect(onLog.mock.calls[0][3]).toBe(JETZT - STUNDE);
  });

  it('bietet 0,5-l-Pils mit exakter Menge und sichtbarer Stärke an', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: '0,5 l' }));
    const pils = tile(/^0,5 l Bier \(Pils\) eintragen$/);
    expect(within(pils).getByText('0,5 l · 5 %')).toBeInTheDocument();
    fireEvent.click(pils);
    expect(onLog.mock.calls[0][4]).toBe(500);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lässt eine eigene Menge per Tastatur eingeben und kehrt zur Standardbuchung zurück', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Eigene Menge' }), { detail: 0 });
    fireEvent.change(screen.getByRole('textbox', { name: 'Menge in ml' }), { target: { value: '237' } });
    fireEvent.click(tile(/^0,237 l Bier \(Pils\) eintragen$/), { detail: 0 });
    expect(onLog.mock.calls[0][4]).toBe(237);
    expect(tile(/^1 Glas Bier \(Pils\) eintragen$/)).toBeInTheDocument();
  });

  it.each(['', '-10', '0', 'NaN', 'Infinity', '2001'])('blockiert ungültige eigene Menge %s', (value) => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Eigene Menge' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Menge in ml' }), { target: { value } });
    expect(screen.getByRole('alert')).toHaveTextContent('zwischen 1 und 2000 ml');
    expect(screen.getByRole('button', { name: 'Bier (Pils) – Menge eingeben' })).toBeDisabled();
    expect(onLog).not.toHaveBeenCalled();
  });

  it('macht aus einem halben Shot tatsächlich 1 cl', () => {
    mount();
    fireEvent.click(screen.getByText('½ Glas'));
    const shot = tile(/^½ Glas Tequila \/ Wodka eintragen$/);
    expect(within(shot).getByText('1 cl · 38 %')).toBeInTheDocument();
    fireEvent.click(shot);
    expect(onLog.mock.calls[0][4]).toBe(10);
  });
});

describe('Reihenfolge', () => {
  it('deutet gelöschte eigene Getränke nicht als weitere Pils-Kacheln um', () => {
    const deleted = { ...findDrink('wine-white'), id: 'custom-deleted', name: 'Hauswein' };
    usePlayer.setState({ log: [makeDrinkEvent(deleted, 2), makeDrinkEvent(findDrink('beer-pils'), PILS)] });
    mount();
    expect(screen.getAllByRole('button', { name: '1 Glas Bier (Pils) eintragen' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Hauswein/ })).toBeNull();
    fireEvent.click(tile(/^1 Glas Bier \(Pils\) eintragen$/));
    expect(onLog.mock.calls[0][1].id).toBe('beer-pils');
  });

  it('stellt das eingestellte und die zuletzt getrunkenen Getränke nach vorn', () => {
    usePlayer.setState({
      log: [
        makeDrinkEvent(findDrink('wine-white'), WEIN, 'glas', JETZT - 2 * STUNDE),
        makeDrinkEvent(findDrink('shot-tequila'), 1, 'glas', JETZT - STUNDE),
      ],
    });
    mount();
    const namen = screen
      .getAllByRole('button', { name: /eintragen$/ })
      .map((b) => b.getAttribute('aria-label'));
    // Eingestellt zuerst, dann das Jüngste zuerst.
    expect(namen.slice(0, 3)).toEqual([
      '1 Glas Bier (Pils) eintragen',
      '1× Tequila / Wodka eintragen',
      '1 Glas Weißwein eintragen',
    ]);
    // Kein Getränk doppelt.
    expect(new Set(namen).size).toBe(namen.length);
  });
});

describe('Auf einem geteilten Handy', () => {
  it('bucht auf die gewählte Person und nimmt deren Verlauf', () => {
    mount([me, mia]);
    fireEvent.click(screen.getByRole('button', { name: 'Mia' }));

    // Mias Reihe: ihr eingestellter Rotwein, dann ihr Schnaps von vorhin.
    const namen = screen
      .getAllByRole('button', { name: /eintragen$/ })
      .map((b) => b.getAttribute('aria-label'));
    expect(namen.slice(0, 2)).toEqual([
      '1 Glas Rotwein eintragen',
      '1× Shot (Schnaps) eintragen',
    ]);

    fireEvent.click(tile(/^1 Glas Rotwein eintragen$/));
    expect(onLog.mock.calls[0][0]).toBe('p1');
  });

  it('zeigt bei einer Person keine Auswahl', () => {
    mount([me]);
    expect(screen.queryByRole('group', { name: 'Wer' })).toBeNull();
  });
});
