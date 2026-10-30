import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { AlbumScreen } from './AlbumScreen';
import { useFilm } from '../../store/film';
import { photoUrl } from './photoStore';

vi.mock('./photoStore', () => ({ photoUrl: vi.fn(), releasePhotoUrl: vi.fn() }));
vi.mock('./sweep', () => ({ sweepOrphans: vi.fn() }));
vi.mock('./useFilmStatus', () => ({ useFilmStatus: () => ({ running: false }) }));
vi.mock('../bac/NightReview', () => ({ NightReview: () => null }));
vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

beforeEach(() => {
  useFilm.setState({
    photos: [
      { id: 'a', file: 'a', at: 1000, nightId: null, developAt: 0 },
      { id: 'latent', file: 'latent', at: 2000, nightId: null, developAt: Date.now() + 100000 },
      { id: 'b', file: 'b', at: 3000, nightId: null, developAt: 0 },
    ],
  });
  vi.mocked(photoUrl).mockReset();
});

it('unterscheidet Laden und fehlendes Foto und lädt auf Wunsch erneut', async () => {
  let finish!: (url: string | null) => void;
  vi.mocked(photoUrl).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <MemoryRouter>
      <AlbumScreen />
    </MemoryRouter>,
  );
  expect(screen.getAllByRole('status')[0]).toHaveTextContent('Foto wird geladen …');
  await act(async () => finish(null));
  const retry = screen.getByText('Foto gerade nicht verfügbar – erneut laden');
  vi.mocked(photoUrl).mockResolvedValue('data:image/jpeg;base64,AA');
  await act(async () => fireEvent.click(retry));
  expect(photoUrl).toHaveBeenCalledTimes(3);
  expect(screen.queryByText('Foto gerade nicht verfügbar – erneut laden')).toBeNull();
});

it('blättert per Knopf und horizontalem Wisch ausschließlich durch entwickelte Fotos', async () => {
  vi.mocked(photoUrl).mockResolvedValue('data:image/jpeg;base64,AA');
  render(
    <MemoryRouter>
      <AlbumScreen />
    </MemoryRouter>,
  );
  await act(async () => {});
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: /Foto von/ })[0]));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Bild 1 von 2')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Zurück' })).toBeDisabled();
  await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Vor' })));
  expect(within(dialog).getByText('Bild 2 von 2')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Vor' })).toBeDisabled();
  const viewer = dialog.querySelector('.album-viewer')!;
  fireEvent.touchStart(viewer, { touches: [{ clientX: 10, clientY: 100 }] });
  await act(async () =>
    fireEvent.touchEnd(viewer, { changedTouches: [{ clientX: 120, clientY: 105 }] }),
  );
  expect(within(dialog).getByText('Bild 1 von 2')).toBeInTheDocument();
  expect(photoUrl).not.toHaveBeenCalledWith('latent');
});
