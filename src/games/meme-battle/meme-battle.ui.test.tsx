import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import type { GamePlayer } from '../types';
import { memeBattle, type State } from './index';

describe('Meme-Duell: Update während einer alten Runde', () => {
  it('zeigt den Neustart an, obwohl der alte Zustand keine Vorlagen hat', () => {
    const me: GamePlayer = { id: 'p0', name: 'Anna', color: 'blue', online: true };
    const dispatch = vi.fn();
    const state = {
      phase: 'writing',
      prompt: 3,
      deck: [1, 2],
      answers: {},
      votes: {},
    } as unknown as State;
    const party = {
      me,
      players: [me],
      mode: 'online',
      gameId: 'meme-battle',
      logSipsFor: vi.fn(),
      undoLastFor: vi.fn(),
    } as unknown as PartyValue;
    const Component = memeBattle.Component;

    render(
      <MemoryRouter>
        <PartyCtx.Provider value={party}>
          <Component
            state={state}
            players={[me]}
            me={me}
            isHost
            online
            dispatch={dispatch}
            quit={vi.fn()}
          />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Neue Version')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Neu starten' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'restart' });
  });
});
