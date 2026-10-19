import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Router } from './Router';
import { usePlayer } from '../store/player';

const { joinOnline } = vi.hoisted(() => ({ joinOnline: vi.fn(async () => {}) }));
vi.mock('../features/party/PartyContext', () => ({
  useParty: () => ({ code: null, joinOnline }),
}));
vi.mock('./Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { Layout: Outlet, FullLayout: Outlet };
});
vi.mock('../features/lobby/LobbyScreen', () => ({ LobbyScreen: () => <p>Einladungsrunde</p> }));
vi.mock('../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

beforeEach(() => {
  joinOnline.mockClear();
  usePlayer.setState({ profile: null, onboarded: false, log: [] });
});

it('behält einen geteilten Lobby-Code über das vollständige Erst-Onboarding', async () => {
  render(<MemoryRouter initialEntries={['/lobby?code=AB12']}><Router /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Verstanden' }));
  fireEvent.change(screen.getByPlaceholderText('Spitzname'), { target: { value: 'Lea' } });
  for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
  fireEvent.click(screen.getByRole('button', { name: "Los geht's" }));
  await waitFor(() => expect(joinOnline).toHaveBeenCalledWith('AB12'));
  expect(screen.getByText('Einladungsrunde')).toBeInTheDocument();
});
