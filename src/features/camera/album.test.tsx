import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PartyCtx, type PartyValue } from '../party/PartyContext';
import { useFilm, type Photo } from '../../store/film';
import { useNights } from '../../store/nights';
import { usePlayer } from '../../store/player';
import { AlbumScreen } from './AlbumScreen';

// Das Dateisystem gibt es im Test nicht. Wichtig ist nur, OB nach einer
// Bildadresse gefragt wird – genau daran haengt die Sperre.
const photoUrl = vi.fn(async (_name: string) => 'blob:egal');
vi.mock('./photoStore', () => ({
  photoUrl: (name: string) => photoUrl(name),
  releasePhotoUrl: () => {},
  deletePhotos: async () => {},
  savePhoto: async () => {},
}));

const party = {
  mode: 'local',
  players: [],
  me: { id: 'd_ich', name: 'Ich', color: 'indigo' },
  isHost: true,
  film: null,
  setFilm: () => {},
} as unknown as PartyValue;

function foto(patch: Partial<Photo>): Photo {
  return { id: 'p1', nightId: null, at: Date.now(), developAt: 0, file: 'a.jpg', ...patch };
}

function zeige() {
  return render(
    <MemoryRouter>
      <PartyCtx.Provider value={party}>
        <AlbumScreen />
      </PartyCtx.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  photoUrl.mockClear();
  useNights.setState({ nights: [], current: [] });
  useFilm.setState({ mine: 0, rolls: 1, usedHigh: 0, photos: [], pendingDeletes: [], endings: 0 });
  usePlayer.setState({ nightStartedAt: Date.now() });
});

afterEach(() => vi.useRealTimers());

describe('Album: die Sperre an ihrer Wirkstelle', () => {
  it('kann den Abend abschliessen und gibt seine Fotos trotzdem erst zur Entwicklungszeit frei', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    usePlayer.setState({ profile: null, log: [], carryoverLog: [], waterCount: 0 });
    useFilm.setState({ photos: [foto({ developAt: now + 1_000 })] });
    zeige();

    fireEvent.click(screen.getByRole('button', { name: 'Abend beenden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abend abschließen' }));

    expect(usePlayer.getState().nightStartedAt).toBeNull();
    expect(useFilm.getState().photos[0].nightId).toBe(useNights.getState().nights[0].id);
    expect(screen.getByLabelText('Noch nicht entwickelt')).toBeInTheDocument();
    expect(photoUrl).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1_000));

    expect(screen.queryByLabelText('Noch nicht entwickelt')).toBeNull();
    expect(photoUrl).toHaveBeenCalledWith('a.jpg');
  });

  it('gibt Bilder im offenen Album genau zur jeweiligen Entwicklungszeit frei', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    useFilm.setState({
      photos: [
        foto({ id: 'p1', file: 'erstes.jpg', developAt: now + 1_000 }),
        foto({ id: 'p2', file: 'zweites.jpg', developAt: now + 2_000 }),
      ],
    });
    zeige();
    expect(screen.getAllByLabelText('Noch nicht entwickelt')).toHaveLength(2);
    await act(async () => vi.advanceTimersByTime(999));
    expect(photoUrl).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTime(1));
    expect(screen.getAllByLabelText('Noch nicht entwickelt')).toHaveLength(1);
    expect(photoUrl).toHaveBeenCalledWith('erstes.jpg');
    expect(photoUrl).not.toHaveBeenCalledWith('zweites.jpg');

    await act(async () => vi.advanceTimersByTime(1_000));
    expect(screen.queryByLabelText('Noch nicht entwickelt')).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('aktualisiert die Sperre nach der Rückkehr aus dem Hintergrund', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    useFilm.setState({ photos: [foto({ developAt: now + 1_000 })] });
    zeige();
    vi.setSystemTime(now + 2_000);

    await act(async () => fireEvent(document, new Event('visibilitychange')));

    expect(screen.queryByLabelText('Noch nicht entwickelt')).toBeNull();
    expect(photoUrl).toHaveBeenCalledWith('a.jpg');
  });

  it('zeigt ein unentwickeltes Bild nicht und fragt es gar nicht erst ab', async () => {
    useFilm.setState({ photos: [foto({ developAt: Date.now() + 3_600_000 })] });
    zeige();
    expect(await screen.findByLabelText('Noch nicht entwickelt')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    // Entscheidend: die Datei wird nicht einmal geoeffnet.
    expect(photoUrl).not.toHaveBeenCalled();
  });

  it('zeigt ein entwickeltes Bild', async () => {
    useFilm.setState({ photos: [foto({ developAt: Date.now() - 1 })] });
    zeige();
    expect(await screen.findByRole('img')).toBeTruthy();
    expect(photoUrl).toHaveBeenCalledWith('a.jpg');
  });

  it('zeigt das geoeffnete Bild als Abzug', async () => {
    // Was man sich ansieht, ist ein Abzug auf Papier - und derselbe Rahmen
    // wird beim Teilen in die Datei gerechnet (siehe print.ts).
    useFilm.setState({ photos: [foto({ developAt: Date.now() - 1 })] });
    zeige();
    fireEvent.click(await screen.findByRole('button', { name: /Foto von/ }));
    expect(await screen.findByText('PEGEL')).toBeTruthy();
    expect(document.querySelector('.abzug .photofull')).toBeTruthy();
  });

  it('trennt entwickelte und wartende Bilder im selben Abend', async () => {
    useFilm.setState({
      photos: [
        foto({ id: 'p1', file: 'alt.jpg', developAt: Date.now() - 1 }),
        foto({ id: 'p2', file: 'neu.jpg', developAt: Date.now() + 3_600_000 }),
      ],
    });
    zeige();
    // Erst abwarten, bis das entwickelte Bild steht: sonst laufen die
    // Zusicherungen, waehrend die Adresse noch geladen wird.
    await screen.findByRole('img');
    expect(screen.getAllByLabelText('Noch nicht entwickelt')).toHaveLength(1);
    expect(photoUrl).toHaveBeenCalledTimes(1);
    expect(photoUrl).toHaveBeenCalledWith('alt.jpg');
  });
});
