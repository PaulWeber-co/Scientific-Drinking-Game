import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Onboarding } from './Onboarding';
import { usePlayer } from '../../store/player';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

beforeEach(() => {
  usePlayer.setState({ profile: null, onboarded: false, currentDrinkId: 'beer-pils', log: [] });
});

const weiter = () =>
  fireEvent.click(screen.getByRole('button', { name: /Verstanden|Weiter|Los geht/ }));
const zurueck = () => fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));

function Destination() {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}`}</p>;
}

/** Start und Name – alle Spielmodi prüfen das Alter vor dem ersten Spiel. */
function bisZumAlter(returnTo?: string) {
  render(
    <MemoryRouter initialEntries={[
      { pathname: '/onboarding', state: returnTo ? { returnTo } : undefined },
    ]}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
  weiter();
  fireEvent.change(screen.getByPlaceholderText('Spitzname'), { target: { value: 'Lea' } });
  weiter();
  expect(screen.getByText('Wie alt bist du?')).toBeInTheDocument();
}

function setAge(age: number, previousAge = 25) {
  const label = age < previousAge ? 'weniger' : 'mehr';
  for (let i = 0; i < Math.abs(previousAge - age); i++) {
    fireEvent.click(screen.getByRole('button', { name: label }));
  }
}

function bisZumModus(age = 25, returnTo?: string) {
  bisZumAlter(returnTo);
  setAge(age);
  weiter();
  expect(screen.getByText('Wie spielst du heute?')).toBeInTheDocument();
}

describe('frühe Auswahl der Spielweise', () => {
  it.each([
    { choice: /^Alkoholfrei/, designatedDriver: false },
    { choice: /^Ich fahre/, designatedDriver: true },
  ])('schließt $choice ohne Körper-, Magen- und Pegelfragen ab', ({ choice, designatedDriver }) => {
    bisZumModus();
    fireEvent.click(screen.getByRole('button', { name: choice }));
    expect(screen.getByRole('button', { name: choice })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: "Los geht's" })).toBeInTheDocument();
    weiter();

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(usePlayer.getState()).toMatchObject({
      onboarded: true,
      currentDrinkId: 'soft',
      profile: { name: 'Lea', alcoholFree: true, designatedDriver },
    });
  });

  it('fragt mit Alkohol ab 18 Körper, Magen, Getränk und Zielpegel ab', () => {
    bisZumModus(18);
    fireEvent.click(screen.getByRole('button', { name: /^Mit Alkohol/ }));
    weiter();
    expect(screen.getByText('Körperdaten')).toBeInTheDocument();
    weiter();
    expect(screen.getByText('Schon was gegessen?')).toBeInTheDocument();
    weiter();
    expect(screen.getByText('Was trinkst du heute?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Weißwein/ }));
    weiter();
    expect(screen.getByText('Dein Zielpegel')).toBeInTheDocument();
    expect(screen.getByText(/Bis zu deinem Pegel/)).toBeInTheDocument();
    weiter();
    expect(usePlayer.getState()).toMatchObject({
      onboarded: true,
      currentDrinkId: 'wine-white',
      profile: { age: 18, alcoholFree: false, designatedDriver: false },
    });
  });

  it('behält Eingaben beim Zurückgehen und wechselt vollständig zwischen den Modi', () => {
    bisZumModus();
    weiter();
    fireEvent.click(screen.getByRole('button', { name: 'weniger' }));
    expect(screen.getByText('74')).toBeInTheDocument();
    zurueck();
    fireEvent.click(screen.getByRole('button', { name: /^Ich fahre/ }));
    expect(screen.getByRole('button', { name: "Los geht's" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Mit Alkohol/ }));
    weiter();
    expect(screen.getByText('74')).toBeInTheDocument();
    zurueck();
    fireEvent.click(screen.getByRole('button', { name: /^Alkoholfrei/ }));
    weiter();
    expect(usePlayer.getState().profile).toMatchObject({ alcoholFree: true, designatedDriver: false });
  });
});

describe('Altersgrenzen bleiben für alle Modi erhalten', () => {
  it.each([16, 17])('fragt bei %i-Jährigen nur nach der alkoholfreien Spielweise', (age) => {
    bisZumModus(age);
    expect(screen.getByText(/Alkoholfunktionen gibt es ab 18/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mit Alkohol/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Alkoholfrei/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: "Los geht's" })).toBeInTheDocument();
    weiter();
    expect(usePlayer.getState()).toMatchObject({
      onboarded: true,
      currentDrinkId: 'soft',
      profile: { age, alcoholFree: true, designatedDriver: false },
    });
  });

  it.each([12, 15])('lässt mit %i Jahren auch alkoholfreies Mitspielen nicht zu', (age) => {
    bisZumAlter();
    setAge(age);
    expect(screen.getByText('Diese App ist erst ab 16 Jahren.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    weiter();
    expect(screen.getByText('Wie alt bist du?')).toBeInTheDocument();
    expect(usePlayer.getState().onboarded).toBe(false);
  });

  it('bewahrt beim korrigierten Alter den Fahrermodus, aber zeigt unter 18 keine Alkoholwahl', () => {
    bisZumModus(18);
    fireEvent.click(screen.getByRole('button', { name: /^Ich fahre/ }));
    zurueck();
    setAge(17, 18);
    weiter();
    expect(screen.getByRole('button', { name: /^Ich fahre/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: /^Mit Alkohol/ })).not.toBeInTheDocument();
    weiter();
    expect(usePlayer.getState().profile).toMatchObject({ age: 17, alcoholFree: true, designatedDriver: true });
  });
});

describe('Einladung nach dem Onboarding', () => {
  it.each([/^Mit Alkohol/, /^Alkoholfrei/, /^Ich fahre/])('behält die Einladung bei %s', (choice) => {
    bisZumModus(25, '/lobby?code=AB12');
    fireEvent.click(screen.getByRole('button', { name: choice }));
    if (choice.test('Mit Alkohol')) {
      weiter(); // Körper
      weiter(); // Magen
      weiter(); // Getränk
      weiter(); // Ziel
    }
    weiter();
    expect(screen.getByText('/lobby?code=AB12')).toBeInTheDocument();
  });

  it('leitet nach dem verkürzten Einstieg nicht zu externen Einladungszielen um', () => {
    bisZumModus(25, '//example.com');
    fireEvent.click(screen.getByRole('button', { name: /^Alkoholfrei/ }));
    weiter();
    expect(screen.getByText('/')).toBeInTheDocument();
  });
});
