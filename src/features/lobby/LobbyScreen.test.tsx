import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LobbyScreen } from './LobbyScreen';
import { PartyCtx, type PartyValue } from '../party/PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import type { GamePlayer } from '../../games/types';
import { findDrink, sipsPerServing } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';

const me: GamePlayer = { id: 'me', name: 'Paul', color: 'blue', online: true, isHost: true };

function party(patch: Partial<PartyValue> = {}): PartyValue {
  return {
    mode: 'local',
    code: null,
    status: 'lobby',
    connection: 'offline',
    error: null,
    players: [me],
    me,
    isHost: true,
    gameId: null,
    gameState: null,
    startedBy: null,
    startedAt: 0,
    createOnline: vi.fn(),
    joinOnline: vi.fn(),
    startLocal: vi.fn(),
    leave: vi.fn(),
    addLocalPlayer: vi.fn(),
    updateLocalPlayer: vi.fn(),
    removeLocalPlayer: vi.fn(),
    startGame: vi.fn(),
    endGame: vi.fn(),
    dispatch: vi.fn(),
    logSipsFor: vi.fn(),
    ...patch,
  } as PartyValue;
}

function openGuestSheet() {
  const addLocalPlayer = vi.fn();
  render(
    <MemoryRouter initialEntries={['/lobby']}>
      <PartyCtx.Provider value={party({ addLocalPlayer })}>
        <LobbyScreen />
      </PartyCtx.Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mitspieler hinzufügen' }));
  fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Anna' } });
  return addLocalPlayer;
}

function submitted(addLocalPlayer: ReturnType<typeof vi.fn>) {
  fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
  expect(addLocalPlayer).toHaveBeenCalledTimes(1);
  return addLocalPlayer.mock.calls[0][0] as Parameters<PartyValue['addLocalPlayer']>[0];
}

describe('Mitspieler auf diesem Handy', () => {
  beforeEach(() => {
    // Der Host hat auffällige Werte – nichts davon darf beim Gast landen.
    usePlayer.setState({
      profile: {
        ...defaultProfile(),
        name: 'Paul',
        age: 34,
        heightCm: 190,
        stomach: 'empty',
        targetBac: 0.6,
        alcoholFree: true,
      },
      onboarded: true,
    });
  });

  it('erbt nichts vom Host, sondern bekommt App-Standardwerte', () => {
    const { profile, drinkId } = submitted(openGuestSheet());
    expect(profile).toEqual({
      name: 'Anna',
      color: expect.any(String),
      sex: 'female',
      age: 25,
      weightKg: 65,
      heightCm: undefined,
      stomach: 'light',
      targetBac: 0.4,
      alcoholFree: false,
      designatedDriver: false,
    });
    expect(drinkId).toBe('beer-pils');
  });

  it('übernimmt Zielpegel, Magen und Körpergröße aus dem Formular', () => {
    const add = openGuestSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Leer' }));
    fireEvent.change(screen.getByLabelText('Zielpegel'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Körpergröße angeben (genauer)' }));
    // Zweiter Stepper im Sheet ist die Körpergröße (nach dem Gewicht, wie im Profil).
    fireEvent.click(screen.getAllByRole('button', { name: 'mehr' })[1]);
    const { profile } = submitted(add);
    expect(profile.stomach).toBe('empty');
    expect(profile.targetBac).toBeCloseTo(0.55);
    expect(profile.heightCm).toBe(176);
  });

  it('lässt die Körpergröße wieder weg, wenn sie entfernt wird', () => {
    const add = openGuestSheet();
    fireEvent.click(screen.getByRole('button', { name: '+ Körpergröße angeben (genauer)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Körpergröße rechnen' }));
    expect(submitted(add).profile.heightCm).toBeUndefined();
  });

  it('kann alkoholfrei mitspielen und bekommt dann kein alkoholisches Getränk', () => {
    const add = openGuestSheet();
    fireEvent.click(screen.getByRole('switch', { name: 'Alkoholfrei' }));
    expect(screen.queryByText(/^Getränk:/)).toBeNull();
    const { profile, drinkId } = submitted(add);
    expect(profile.alcoholFree).toBe(true);
    expect(profile.designatedDriver).toBe(false);
    expect(drinkId).toBe('soft');
  });

  it('startet für den nächsten Gast wieder mit Standardwerten', () => {
    const add = openGuestSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Leer' }));
    fireEvent.change(screen.getByLabelText('Zielpegel'), { target: { value: '55' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Körpergröße angeben (genauer)' }));
    // Gewicht und Alter hochzählen – genau die Felder, die früher hängen blieben.
    fireEvent.click(screen.getAllByRole('button', { name: 'mehr' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'mehr' })[2]);
    fireEvent.click(screen.getByRole('switch', { name: 'Alkoholfrei' }));
    submitted(add);
    fireEvent.click(screen.getByRole('button', { name: 'Mitspieler hinzufügen' }));
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Ben' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    const second = add.mock.calls[1][0] as Parameters<PartyValue['addLocalPlayer']>[0];
    expect(second.profile).toMatchObject({
      name: 'Ben',
      age: 25,
      weightKg: 65,
      stomach: 'light',
      targetBac: 0.4,
      heightCm: undefined,
      alcoholFree: false,
    });
    expect(second.drinkId).toBe('beer-pils');
  });

  it('fährt heute heißt auch alkoholfrei', () => {
    const add = openGuestSheet();
    fireEvent.click(screen.getByRole('switch', { name: 'Fährt heute' }));
    expect(screen.getByRole('switch', { name: 'Alkoholfrei' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    const { profile } = submitted(add);
    expect(profile.designatedDriver).toBe(true);
    expect(profile.alcoholFree).toBe(true);
  });

  it('wer den Alkoholfrei-Schalter ausmacht, fährt auch nicht – die Schalter zeigen, was gilt', () => {
    const add = openGuestSheet();
    fireEvent.click(screen.getByRole('switch', { name: 'Fährt heute' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Alkoholfrei' }));
    expect(screen.getByRole('switch', { name: 'Fährt heute' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByText(/^Getränk:/)).toBeInTheDocument();
    const { profile, drinkId } = submitted(add);
    expect(profile.designatedDriver).toBe(false);
    expect(profile.alcoholFree).toBe(false);
    expect(drinkId).toBe('beer-pils');
  });
});

describe('Wer mitspielt, steht einmal', () => {
  const mia: GamePlayer = {
    id: 'p1',
    name: 'Mia',
    color: 'pink',
    online: true,
    local: {
      profile: { ...defaultProfile(), name: 'Mia' },
      drinkId: 'wine-red',
      log: [makeDrinkEvent(findDrink('wine-red'), sipsPerServing(findDrink('wine-red')), 'glas')],
    },
  };

  beforeEach(() => {
    usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul' }, onboarded: true, log: [], customDrinks: [] });
  });

  it('zeigt die Gläser in der Spielerzeile statt in einem zweiten Tisch', () => {
    // Rückmeldung aus dem Test: „Das muss nicht zweimal stehen, wer mitspielt."
    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <PartyCtx.Provider value={party({ players: [me, mia] })}>
          <LobbyScreen />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Der Tisch')).toBeNull();
    expect(screen.getAllByText('Mia')).toHaveLength(1);
    expect(screen.getByText(/1 Glas · Rotwein/)).toBeTruthy();
  });

  it('öffnet beim Tipp auf den Namen das Eintragen für diese Person', () => {
    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <PartyCtx.Provider value={party({ players: [me, mia] })}>
          <LobbyScreen />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Getränk für Mia eintragen' }));
    expect(screen.getByRole('button', { name: 'Mia' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('trägt über den Glas-Knopf je Zeile ein, ein Knopf unter der Liste fehlt', () => {
    // Rückmeldung: „Getränk eintragen" unter der Liste sah aus wie „Person hinzufügen".
    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <PartyCtx.Provider value={party({ players: [me, mia] })}>
          <LobbyScreen />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /^Getränk eintragen$/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Getränk für Paul eintragen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mitspieler hinzufügen' })).toBeTruthy();
  });

  it('entfernt einen Gast aus dem Bearbeiten heraus', () => {
    const removeLocalPlayer = vi.fn();
    render(
      <MemoryRouter initialEntries={['/lobby']}>
        <PartyCtx.Provider value={party({ players: [me, mia], removeLocalPlayer })}>
          <LobbyScreen />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Entfernen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ändern' }));
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(removeLocalPlayer).toHaveBeenCalledWith('p1');
  });
});

describe('Gast-Formular: Abbrechen und Fertig', () => {
  it('Abbrechen legt niemanden an', () => {
    const add = openGuestSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(add).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Name')).toBeNull();
  });

  it('Fertig legt an und schließt', () => {
    const add = openGuestSheet();
    expect(submitted(add).name).toBe('Anna');
    expect(screen.queryByPlaceholderText('Name')).toBeNull();
  });
});
