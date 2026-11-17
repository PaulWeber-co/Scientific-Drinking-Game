import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const party = vi.hoisted(() => ({ mode: 'local', joinOnline: vi.fn() }));
const app = vi.hoisted(() => ({ lastLobbyCode: 'ABC234' as string | null }));
vi.mock('./PartyContext', () => ({ useParty: () => party }));
vi.mock('../../store/app', () => ({ useApp: (pick: (s: typeof app) => unknown) => pick(app) }));

const { ResumeOnlineRound } = await import('./ResumeOnlineRound');

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <ResumeOnlineRound />
      <Routes>
        <Route path="/" element={<p>Spielewand</p>} />
        <Route path="/lobby" element={<p>Runde</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  party.mode = 'local';
  party.joinOnline.mockReset().mockResolvedValue(undefined);
  app.lastLobbyCode = 'ABC234';
  window.Capacitor = { isNativePlatform: () => true };
});
afterEach(() => {
  delete window.Capacitor;
});

it('tritt in der App nach einem Neustart der letzten Runde wieder bei', async () => {
  const view = renderAt();
  expect(party.joinOnline).toHaveBeenCalledWith('ABC234');
  await waitFor(() => expect(view.getByText('Runde')).toBeTruthy());
});

it('bleibt auf der Spielewand, wenn die Runde nicht mehr da ist', async () => {
  party.joinOnline.mockRejectedValue(new Error('Diese Lobby ist abgelaufen.'));
  const view = renderAt();
  await waitFor(() => expect(party.joinOnline).toHaveBeenCalled());
  expect(view.getByText('Spielewand')).toBeTruthy();
});

it('tut im Browser und ohne offene Runde nichts', () => {
  delete window.Capacitor;
  renderAt();
  window.Capacitor = { isNativePlatform: () => true };
  app.lastLobbyCode = null;
  renderAt();
  expect(party.joinOnline).not.toHaveBeenCalled();
});
