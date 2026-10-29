import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameSettings } from './shared/GameSettings';
import { usePlayer, defaultProfile } from '../store/player';
import { useApp } from '../store/app';

beforeEach(() => {
  usePlayer.setState({ profile: { ...defaultProfile(), name: 'Tobi' }, currentDrinkId: 'beer-pils' });
  useApp.setState({ spicy: {} });
});

describe('Einstellungen im Spiel', () => {
  it('zeigt dem Gast statt eines toten Schalters, wer Spicy stellt', () => {
    // Der Kartenstapel entsteht beim Host. Ein Schalter, der beim Gast nichts
    // tut, sieht aus wie ein Fehler.
    render(<GameSettings open onClose={() => {}} spicy={{ gameId: 'x', hostOnly: true, onChange: () => {} }} />);
    expect(screen.getByText(/wer die Runde gestartet hat/)).toBeTruthy();
    expect(screen.queryByRole('switch', { name: /Spicy/ })).toBeNull();
  });

  it('gibt dem Host den Schalter', () => {
    render(<GameSettings open onClose={() => {}} spicy={{ gameId: 'x', hostOnly: false, onChange: () => {} }} />);
    expect(screen.queryByText(/wer die Runde gestartet hat/)).toBeNull();
    expect(screen.getByLabelText('Spicy-Karten')).toBeTruthy();
  });

  it('beschriftet jede Härtestufe für Screenreader', () => {
    render(<GameSettings open onClose={() => {}} heat={{ value: 2, onChange: () => {} }} />);
    for (const stufe of [1, 2, 3]) {
      expect(screen.getByRole('button', { name: `Härtegrad ${stufe}` })).toBeTruthy();
    }
  });
});
