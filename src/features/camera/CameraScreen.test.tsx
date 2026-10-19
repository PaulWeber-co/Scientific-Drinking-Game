import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useFilm } from '../../store/film';
import { useNights } from '../../store/nights';
import { PAUSE_MS, usePlayer } from '../../store/player';
import CameraScreen from './CameraScreen';

const { setTorch, developFrame, savePhoto } = vi.hoisted(() => ({
  setTorch: vi.fn(async (_on: boolean) => {}),
  developFrame: vi.fn<() => Promise<Blob | null>>(),
  savePhoto: vi.fn<() => Promise<void>>(),
}));
vi.mock('./useViewfinder', () => ({
  useViewfinder: () => ({
    videoRef: { current: null }, state: 'live', hasTorch: true, setTorch, streamSize: null,
  }),
}));
vi.mock('./useFilmStatus', () => ({
  useFilmStatus: () => ({ mineLeft: 27, remaining: 27, developAfterH: 4 }),
}));
vi.mock('./develop', () => ({ developFrame }));
vi.mock('./photoStore', () => ({ savePhoto }));
vi.mock('./notify', () => ({ scheduleDevelopNotice: vi.fn() }));
vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  developFrame.mockResolvedValue(new Blob(['photo'], { type: 'image/jpeg' }));
  savePhoto.mockResolvedValue(undefined);
  useFilm.setState({ mine: 0, rolls: 1, usedHigh: 0, photos: [] });
  useNights.setState({ nights: [], current: [] });
  usePlayer.setState({
    profile: null, log: [], carryoverLog: [], nightStartedAt: null,
    lastActiveAt: null, waterCount: 0, preloadAskedAt: null,
  });
});

describe('Kamera: Aufnahme und Abendwechsel', () => {
  it('archiviert einen pausierten Abend vor der neuen Aufnahme und startet deren Entwicklungszeit neu', async () => {
    const oldAt = Date.now() - PAUSE_MS - 1_000;
    usePlayer.setState({ nightStartedAt: oldAt, lastActiveAt: oldAt });
    useFilm.setState({
      mine: 1,
      photos: [{ id: 'old', nightId: null, at: oldAt, developAt: oldAt + 4 * 3_600_000, file: 'alt.jpg' }],
    });
    render(<MemoryRouter><CameraScreen /></MemoryRouter>);

    await capture();

    const [fresh, old] = useFilm.getState().photos;
    expect(useNights.getState().nights).toHaveLength(1);
    expect(old.nightId).toBe(useNights.getState().nights[0].id);
    expect(fresh.nightId).toBeNull();
    expect(fresh.developAt).toBe(fresh.at + 4 * 3_600_000);
    expect(useFilm.getState().mine).toBe(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('behaelt bei weiteren Aufnahmen die Entwicklungszeit ab dem ersten Foto', async () => {
    const firstAt = Date.now() - 3_600_000;
    usePlayer.setState({ nightStartedAt: firstAt, lastActiveAt: firstAt });
    useFilm.setState({
      mine: 1,
      photos: [{ id: 'first', nightId: null, at: firstAt, developAt: firstAt + 4 * 3_600_000, file: 'erstes.jpg' }],
    });
    render(<MemoryRouter><CameraScreen /></MemoryRouter>);

    await capture();

    expect(useFilm.getState().photos[0].developAt).toBe(firstAt + 4 * 3_600_000);
    expect(useFilm.getState().mine).toBe(2);
    expect(useNights.getState().nights).toHaveLength(0);
  });
});
afterEach(() => vi.useRealTimers());

async function capture() {
  fireEvent.click(screen.getByRole('button', { name: 'Auslösen' }));
  await act(async () => vi.advanceTimersByTimeAsync(220));
}

describe('Kamera: fehlgeschlagene Aufnahme', () => {
  it('schaltet den Blitz auch bei einem Aufnahmefehler aus und verbraucht kein Bild', async () => {
    developFrame.mockRejectedValueOnce(new Error('Kamerabild nicht lesbar'));
    render(<MemoryRouter><CameraScreen /></MemoryRouter>);

    await capture();

    expect(setTorch.mock.calls.map(([on]) => on)).toEqual([true, false]);
    expect(screen.getByRole('alert')).toHaveTextContent('Das Foto konnte nicht aufgenommen oder gespeichert werden.');
    expect(useFilm.getState().mine).toBe(0);
    expect(savePhoto).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Auslösen' })).toBeEnabled();
  });

  it('meldet einen Speicherfehler und erlaubt danach eine erfolgreiche Aufnahme', async () => {
    savePhoto.mockRejectedValueOnce(new Error('Speicher voll'));
    render(<MemoryRouter><CameraScreen /></MemoryRouter>);
    await capture();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(useFilm.getState().photos).toHaveLength(0);

    await act(async () => vi.advanceTimersByTimeAsync(900));
    await capture();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(useFilm.getState().photos).toHaveLength(1);
    expect(useFilm.getState().mine).toBe(1);
  });

  it('meldet auch ein fehlendes Kamerabild, statt die Aufnahme still zu verlieren', async () => {
    developFrame.mockResolvedValueOnce(null);
    render(<MemoryRouter><CameraScreen /></MemoryRouter>);

    await capture();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(savePhoto).not.toHaveBeenCalled();
    expect(useFilm.getState().mine).toBe(0);
  });
});
