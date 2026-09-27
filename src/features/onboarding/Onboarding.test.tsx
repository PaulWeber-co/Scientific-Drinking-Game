import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Onboarding } from './Onboarding';
import { usePlayer } from '../../store/player';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

beforeEach(() => {
  usePlayer.setState({ profile: null, onboarded: false, currentDrinkId: 'beer-pils', log: [] });
});

const weiter = () =>
  fireEvent.click(screen.getByRole('button', { name: /Verstanden|Weiter|Los geht/ }));

/** Bis zur Altersfrage: Start, Name. */
function bisZumAlter() {
  render(
    <MemoryRouter>
      <Onboarding />
    </MemoryRouter>,
  );
  weiter();
  fireEvent.change(screen.getByPlaceholderText('Spitzname'), { target: { value: 'Lea' } });
  weiter();
  expect(screen.getByText('Wie alt bist du?')).toBeTruthy();
}

describe('Onboarding unter 18', () => {
  it('rechnet keine Schlucke bis zum Pegel vor und fragt kein Getränk ab', () => {
    bisZumAlter();
    // Voreinstellung 25 → neunmal weniger = 16.
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: 'weniger' }));
    expect(screen.getByText(/Alkoholfunktionen gibt es ab 18/)).toBeTruthy();
    weiter(); // Körper
    weiter(); // Magen
    expect(screen.getByText('Schon was gegessen?')).toBeTruthy();
    // Der Magen ist jetzt der letzte Schritt.
    expect(screen.getByRole('button', { name: "Los geht's" })).toBeTruthy();
    expect(screen.queryByText('Was trinkst du heute?')).toBeNull();
    weiter();

    const s = usePlayer.getState();
    expect(s.onboarded).toBe(true);
    expect(s.profile?.age).toBe(16);
    expect(s.profile?.alcoholFree).toBe(true);
    expect(s.currentDrinkId).toBe('soft');
  });

  it('fragt ab 18 weiter Getränk und Zielpegel ab', () => {
    bisZumAlter();
    weiter(); // Körper
    weiter(); // Magen
    weiter(); // Getränk
    expect(screen.getByText('Was trinkst du heute?')).toBeTruthy();
    weiter();
    expect(screen.getByText('Dein Zielpegel')).toBeTruthy();
    expect(screen.getByText(/Bis zu deinem Pegel/)).toBeTruthy();
  });
});
