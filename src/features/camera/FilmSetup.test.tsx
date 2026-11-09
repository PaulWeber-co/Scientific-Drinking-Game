import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FilmSetup } from './FilmSetup';
import { useFilm } from '../../store/film';

const { setFilm, status } = vi.hoisted(() => ({
  setFilm: vi.fn(),
  status: { remaining: 5, canSetup: true },
}));

vi.mock('../party/PartyContext', () => ({ useParty: () => ({ film: null, setFilm }) }));
// Ohne Runde liest der echte Hook die Zeit aus dem Film-Speicher – hier ebenso.
vi.mock('./useFilmStatus', () => ({
  useFilmStatus: () => ({ ...status, developAfterH: useFilm((s) => s.developAfterH) }),
}));
vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

beforeEach(() => {
  setFilm.mockClear();
  status.canSetup = true;
  useFilm.setState({ developAfterH: 0 });
});

it('zeigt die Entwicklungszeit als Zeile statt als eigene Karte', () => {
  render(<FilmSetup />);
  expect(screen.getByRole('button', { name: /Entwickeln\s*Morgen früh/ })).toBeInTheDocument();
  expect(screen.queryByText('Wann wird entwickelt?')).toBeNull();
});

it('wählt die Zeit im Sheet, schließt es und teilt sie der Runde mit', async () => {
  render(<FilmSetup />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Entwickeln/ })));
  const dialog = screen.getByRole('dialog', { name: 'Wann wird entwickelt?' });
  expect(within(dialog).getByRole('button', { name: 'Morgen früh' })).toHaveAttribute('aria-pressed', 'true');
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: '8 Std.' })));
  expect(setFilm).toHaveBeenCalledWith({ developAfterH: 8 });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button', { name: /Entwickeln\s*8 Std\./ })).toBeInTheDocument();
});

it('zeigt Mitspielenden ohne Gastgeberrolle keine Zeile', () => {
  status.canSetup = false;
  render(<FilmSetup />);
  expect(screen.queryByRole('button', { name: /Entwickeln/ })).toBeNull();
});
