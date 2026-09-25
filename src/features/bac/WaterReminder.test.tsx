import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WaterReminder } from './WaterReminder';
import { findDrink } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import { defaultProfile, usePlayer } from '../../store/player';
import { useApp } from '../../store/app';

beforeEach(() => {
  useApp.setState({ waterReminder: true });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Mia' },
    // Vier Schnaps-Shots vor zehn Minuten: gut 25 g, über der Schwelle von 24 g.
    log: [makeDrinkEvent(findDrink('shot-schnaps'), 4, 'test', Date.now() - 10 * 60_000)],
    waterCount: 0,
  });
});

describe('Wasser-Erinnerung', () => {
  it('zählt das Glas mit, wenn es als erledigt bestätigt wird', () => {
    render(<WaterReminder />);
    fireEvent.click(screen.getByRole('button', { name: 'Erledigt' }));
    expect(usePlayer.getState().waterCount).toBe(1);
    expect(screen.queryByRole('button', { name: 'Erledigt' })).toBeNull();
  });

  it('bleibt aus, wenn sie abgeschaltet ist', () => {
    useApp.setState({ waterReminder: false });
    render(<WaterReminder />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
