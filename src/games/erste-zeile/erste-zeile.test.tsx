import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ersteZeile } from './index';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import { useApp } from '../../store/app';
import { useSeen } from '../../store/seen';
import type { GameAction, GameActionInput, GamePlayer } from '../types';

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const players: GamePlayer[] = [
  me,
  { id: 'p1', name: 'Lena', color: 'pink', online: true },
  { id: 'p2', name: 'Tobi', color: 'green', online: true },
];

beforeEach(() => {
  useApp.setState({ gameLength: 'mittel', spicy: {}, taskOnSkip: 'aus' });
  useSeen.setState({ seen: {}, cursor: 0 });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
  });
});

function Harness() {
  const [state, setState] = useState(() => ersteZeile.createState(players));
  const Game = ersteZeile.Component;
  const party = {
    me,
    players,
    mode: 'local',
    gameId: 'erste-zeile',
    logSipsFor: () => {},
    undoLastFor: () => {},
  } as unknown as PartyValue;
  return (
    <MemoryRouter>
      <PartyCtx.Provider value={party}>
        <Game
          state={state}
          players={players}
          me={me}
          isHost
          online={false}
          dispatch={(a: GameActionInput) =>
            setState((s) =>
              ersteZeile.reduce(s, { ...a, by: me.id, at: Date.now() } as GameAction, players),
            )
          }
          quit={() => {}}
        />
      </PartyCtx.Provider>
    </MemoryRouter>
  );
}

describe('Erste Zeile', () => {
  it('geht nach „Keiner wusste es" weiter, statt auf eine Gewinnerwahl zu warten', () => {
    // Vorher blieb „Nächster" gesperrt: der Knopf wartete auf die Wahl, wer
    // den Song zuerst hatte – die nach dem Kneifen gar nicht angezeigt wird.
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Keiner wusste es' }));
    const weiter = screen.getByRole('button', { name: /Nächster|Endstand/ });
    expect(weiter).toBeEnabled();
    fireEvent.click(weiter);
    expect(screen.getByRole('button', { name: 'Erraten' })).toBeInTheDocument();
  });

  it('wartet nach „Erraten" weiterhin auf die Wahl, wer es zuerst hatte', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Erraten' }));
    expect(screen.getByRole('button', { name: /Nächster|Endstand/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Niemand von uns' }));
    expect(screen.getByRole('button', { name: /Nächster|Endstand/ })).toBeEnabled();
  });
});
