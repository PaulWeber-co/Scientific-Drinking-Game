import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PartyScreen } from './PartyScreen';
import { PartyCtx, type PartyValue } from './PartyContext';
import type { GamePlayer } from '../../games/types';

// Das Spielmodul kommt als eigener Chunk – hier steuern wir, ob er kommt.
const loader = vi.hoisted(() => ({ impl: () => new Promise<never>(() => {}) as Promise<unknown> }));
vi.mock('../../games/registry', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../games/registry')>();
  return { ...real, getLoadedGame: () => null, loadGame: () => loader.impl() };
});

const me: GamePlayer = { id: 'me', name: 'Paul', color: 'blue', online: true, isHost: true };

function party(patch: Partial<PartyValue> = {}): PartyValue {
  return {
    mode: 'local',
    code: null,
    status: 'playing',
    connection: 'offline',
    error: null,
    players: [me],
    me,
    isHost: true,
    gameId: 'kings-cup',
    gameState: {},
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

function renderScreen(value: PartyValue) {
  return render(
    <MemoryRouter initialEntries={['/spiel']}>
      <PartyCtx.Provider value={value}>
        <Routes>
          <Route path="/spiel" element={<PartyScreen />} />
          <Route path="/lobby" element={<div>LOBBY</div>} />
        </Routes>
      </PartyCtx.Provider>
    </MemoryRouter>,
  );
}

describe('Spielbildschirm, wenn der Chunk nicht kommt', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('bietet nach einem Ladefehler den Weg zurück in die Lobby', async () => {
    loader.impl = () => Promise.reject(new Error('Chunk nicht erreichbar'));
    const value = party();
    renderScreen(value);
    expect(await screen.findByText('Spiel lädt nicht.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Lobby' }));
    expect(value.endGame).toHaveBeenCalled();
    expect(screen.getByText('LOBBY')).toBeInTheDocument();
  });

  it('zeigt den Ausweg auch, wenn das Laden nur ewig dauert', () => {
    vi.useFakeTimers();
    loader.impl = () => new Promise(() => {});
    const value = party({ isHost: false });
    renderScreen(value);
    expect(screen.queryByText('Spiel lädt nicht.')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByText('Spiel lädt nicht.')).toBeInTheDocument();
    // Ein Gast geht nur zurück – die Runde der anderen läuft weiter.
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zur Lobby' }));
    expect(value.endGame).not.toHaveBeenCalled();
    expect(screen.getByText('LOBBY')).toBeInTheDocument();
  });
});
