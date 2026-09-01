import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GameInvite } from './GameInvite';
import { PartyCtx, type PartyValue } from './PartyContext';
import type { GamePlayer } from '../../games/types';

const me: GamePlayer = { id: 'me', name: 'Paul', color: 'blue', online: true };
const lisa: GamePlayer = { id: 'lisa', name: 'Lisa', color: 'pink', online: true };

function party(patch: Partial<PartyValue> = {}): PartyValue {
  return {
    mode: 'online',
    code: 'A7K2',
    status: 'playing',
    connection: 'online',
    error: null,
    players: [me, lisa],
    me,
    isHost: false,
    gameId: 'kings-cup',
    gameState: {},
    startedBy: 'lisa',
    startedAt: 1000,
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

function renderInvite(value: PartyValue, route = '/lobby') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PartyCtx.Provider value={value}>
        <GameInvite />
      </PartyCtx.Provider>
    </MemoryRouter>,
  );
}

describe('Spieleinladung', () => {
  it('lädt ein, wenn jemand anderes startet', () => {
    renderInvite(party());
    expect(screen.getByText('Lisa hat gestartet')).toBeInTheDocument();
    expect(screen.getByText('Ring of Fire')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mitspielen' })).toBeInTheDocument();
  });

  it('zeigt nichts, wenn ich selbst gestartet habe', () => {
    const { container } = renderInvite(party({ startedBy: 'me' }));
    expect(container).toBeEmptyDOMElement();
  });

  it('zeigt nichts, solange kein Spiel läuft', () => {
    const { container } = renderInvite(party({ status: 'lobby', gameId: null }));
    expect(container).toBeEmptyDOMElement();
  });

  it('zeigt nichts im Pass-&-Play-Modus', () => {
    const { container } = renderInvite(party({ mode: 'local', startedBy: null }));
    expect(container).toBeEmptyDOMElement();
  });

  it('stört nicht, wenn ich schon im Spiel bin', () => {
    const { container } = renderInvite(party(), '/spiel');
    expect(container).toBeEmptyDOMElement();
  });

  it('macht aus "Später" eine Leiste zum Nachrücken', () => {
    renderInvite(party());
    fireEvent.click(screen.getByRole('button', { name: 'Später' }));
    expect(screen.queryByText('Lisa hat gestartet')).not.toBeInTheDocument();
    expect(screen.getByText('Ring of Fire läuft')).toBeInTheDocument();
  });

  it('kommt bei einem unbekannten Spiel nicht ins Straucheln', () => {
    const { container } = renderInvite(party({ gameId: 'gibt-es-nicht' }));
    expect(container).toBeEmptyDOMElement();
  });
});
