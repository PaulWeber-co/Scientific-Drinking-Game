import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { GamePlayer } from '../../games/types';
import { useApp } from '../../store/app';
import { defaultProfile, usePlayer } from '../../store/player';
import { PartyCtx, type PartyValue } from '../party/PartyContext';
import { GameDetail, GamesScreen } from './GamesScreen';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

function mount(count: number, path = '/spiele/top-ten') {
  const players: GamePlayer[] = Array.from({ length: count }, (_, i) => ({
    id: `p${i}`, name: `Person ${i}`, color: 'blue', online: true,
  }));
  const startGame = vi.fn();
  const party = { mode: 'local', players, me: players[0], startGame } as unknown as PartyValue;
  render(
    <MemoryRouter initialEntries={[path]}>
      <PartyCtx.Provider value={party}>
        <Routes>
          <Route path="/spiele" element={<GamesScreen />} />
          <Route path="/spiele/:id" element={<GameDetail />} />
          <Route path="/lobby" element={<p>Runde bearbeiten</p>} />
          <Route path="/spiel" element={<p>Spiel gestartet</p>} />
        </Routes>
      </PartyCtx.Provider>
    </MemoryRouter>,
  );
  return startGame;
}

beforeEach(() => {
  usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul' }, log: [] });
  useApp.setState({ recentGames: [], gameLength: 'mittel' });
});

describe('Spielergrenzen in der Spieleauswahl', () => {
  it('kennzeichnet Spiele, deren maximale Spielerzahl überschritten ist', () => {
    mount(11, '/spiele');
    const card = screen.getByRole('button', { name: /Top Ten/ });
    expect(card).toHaveClass('gametile--dim');
    expect(card).toHaveTextContent('Max. 10');
  });

  it('startet Top Ten mit elf Leuten nicht und führt zur Anpassung der Runde', () => {
    const startGame = mount(11);
    expect(screen.queryByRole('button', { name: "Los geht's" })).toBeNull();
    expect(screen.getByText(/Top Ten ist für höchstens 10 Leute/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Runde anpassen' }));
    expect(screen.getByText('Runde bearbeiten')).toBeInTheDocument();
    expect(startGame).not.toHaveBeenCalled();
  });

  it('lässt ein Spiel an seiner oberen Grenze starten', async () => {
    const startGame = mount(10);
    fireEvent.click(screen.getByRole('button', { name: "Los geht's" }));
    expect(startGame).toHaveBeenCalledExactlyOnceWith('top-ten');
    expect(await screen.findByText('Spiel gestartet')).toBeInTheDocument();
  });
});
