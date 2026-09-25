import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PreloadSheet } from './PreloadSheet';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink, sipsPerServing } from '../../engine/drinks';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * Die Frage nach dem Vorglühen ist der einzige Weg, wie ein Startwert in die
 * App kommt. Ohne sie beginnt jede Runde bei null Promille, und wer seit drei
 * Stunden trinkt, bekommt dieselbe Ansage wie der, der gerade kommt.
 */

const JETZT = new Date('2026-09-10T22:00:00Z').getTime();
const STUNDE = 60 * 60 * 1000;
const PILS = sipsPerServing(findDrink('beer-pils'));

const mount = (onClose = () => {}) => render(<PreloadSheet open onClose={onClose} />);
const mehr = () => screen.getByRole('button', { name: 'mehr' });
const eintragen = () => screen.getByRole('button', { name: 'Eintragen' });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(JETZT);
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
    nightStartedAt: null,
    preloadAskedAt: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Frage nach dem Vorglühen', () => {
  it('schreibt je Glas einen eigenen Eintrag', () => {
    mount();
    fireEvent.click(mehr());
    fireEvent.click(mehr());
    fireEvent.click(eintragen());

    const log = usePlayer.getState().log;
    expect(log).toHaveLength(3);
    expect(log.every((e) => e.sips === PILS)).toBe(true);
    expect(log.every((e) => e.source === 'vorher')).toBe(true);
  });

  it('legt das erste Glas genau an den Anfang des Fensters', () => {
    // Der Zeitpunkt ist der teure Teil: zwei Stunden Versatz sind rund
    // 0,3 Promille. Voreingestellt ist „1 Std".
    mount();
    fireEvent.click(eintragen());

    expect(usePlayer.getState().log[0].at).toBe(JETZT - STUNDE);
  });

  it('verteilt mehrere Gläser über das Fenster, statt sie zu stapeln', () => {
    // Drei Gläser auf einen Zeitpunkt behaupten einen Rausch, den es so nie
    // gab – der Körper hätte alles gleichzeitig aufgenommen.
    mount();
    fireEvent.click(screen.getByText('2 Std'));
    fireEvent.click(mehr());
    fireEvent.click(mehr());
    fireEvent.click(eintragen());

    const at = usePlayer.getState().log.map((e) => e.at);
    expect(at).toEqual([JETZT - 2 * STUNDE, JETZT - STUNDE - 20 * 60 * 1000, JETZT - 40 * 60 * 1000]);
  });

  it('folgt der gewählten Zeitstufe', () => {
    // Gegenprobe zur Voreinstellung: „gerade" ist eine halbe Stunde.
    mount();
    fireEvent.click(screen.getByText('gerade'));
    fireEvent.click(eintragen());

    expect(usePlayer.getState().log[0].at).toBe(JETZT - STUNDE / 2);
  });

  it('bucht auf das eingestellte Getränk', () => {
    usePlayer.setState({ currentDrinkId: 'wine-red' });
    mount();
    fireEvent.click(eintragen());

    const [ev] = usePlayer.getState().log;
    expect(ev.drinkId).toBe('wine-red');
    expect(ev.sips).toBe(sipsPerServing(findDrink('wine-red')));
  });

  it('fragt nach dem Eintragen nicht noch einmal', () => {
    mount();
    fireEvent.click(eintragen());
    expect(usePlayer.getState().preloadAskedAt).toBe(JETZT);
  });

  it('schreibt nichts, wenn nichts getrunken war, merkt sich die Frage aber', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Noch nichts getrunken' }));

    expect(usePlayer.getState().log).toHaveLength(0);
    expect(usePlayer.getState().preloadAskedAt).toBe(JETZT);
  });

  it('gilt auch als beantwortet, wenn weggewischt wird', () => {
    // Wer die Frage wegwischt, will sie nicht gleich wieder sehen. Ohne das
    // springt sie bei jedem Rendern der Lobby erneut auf.
    const onClose = vi.fn();
    mount(onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(usePlayer.getState().preloadAskedAt).toBe(JETZT);
    expect(onClose).toHaveBeenCalled();
  });

  it('lässt sich nicht unter ein Glas drehen', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'weniger' }));
    fireEvent.click(eintragen());

    expect(usePlayer.getState().log).toHaveLength(1);
  });
});
