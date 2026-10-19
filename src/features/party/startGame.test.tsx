import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { defaultProfile, usePlayer } from '../../store/player';
import { PartyProvider, useParty, type PartyValue } from './PartyContext';
import { meta } from '../../games/top-ten/meta';
import type { GameDefinition } from '../../games/types';

const loader = vi.hoisted(() => ({ loadGame: vi.fn() }));
vi.mock('../../games/registry', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../games/registry')>(),
  loadGame: loader.loadGame,
}));

let api: PartyValue;
const createState = vi.fn(() => ({ ready: true }));
const definition = { ...meta, createState } as unknown as GameDefinition;

function Probe() {
  api = useParty();
  return null;
}

function setup(count: number) {
  render(<PartyProvider><Probe /></PartyProvider>);
  for (let i = 1; i < count; i++) {
    act(() => api.addLocalPlayer({
      name: `Gast ${i}`, color: 'pink', profile: defaultProfile(), drinkId: 'beer-pils',
    }));
  }
}

beforeEach(() => {
  sessionStorage.clear();
  usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul' }, log: [], customDrinks: [] });
  loader.loadGame.mockReset().mockResolvedValue(definition);
  createState.mockClear();
});

describe('Spielstart prüft die aktuelle Runde', () => {
  it('verweigert den Start oberhalb der maximalen Spielerzahl', async () => {
    setup(11);
    await act(async () => api.startGame('top-ten'));
    expect(api.status).toBe('lobby');
    expect(api.error).toBe('Top Ten ist für 3 bis 10 Spieler ausgelegt.');
    expect(createState).not.toHaveBeenCalled();
  });

  it('verweigert den Start unterhalb der Mindestspielerzahl', async () => {
    setup(2);
    await act(async () => api.startGame('top-ten'));
    expect(api.status).toBe('lobby');
    expect(createState).not.toHaveBeenCalled();
  });

  it('berücksichtigt eine während des Ladens hinzugekommene Person', async () => {
    let resolve!: (def: GameDefinition) => void;
    loader.loadGame.mockImplementationOnce(() => new Promise<GameDefinition>((done) => { resolve = done; }));
    setup(10);
    let starting!: Promise<void>;
    act(() => { starting = api.startGame('top-ten'); });
    act(() => api.addLocalPlayer({ name: 'Noch jemand', color: 'blue', profile: defaultProfile(), drinkId: 'beer-pils' }));
    await act(async () => {
      resolve(definition);
      await starting;
    });
    expect(api.status).toBe('lobby');
    expect(createState).not.toHaveBeenCalled();
  });

  it('startet an der erlaubten oberen Grenze', async () => {
    setup(10);
    await act(async () => api.startGame('top-ten'));
    expect(api.status).toBe('playing');
    expect(api.gameState).toEqual({ ready: true });
    expect(createState).toHaveBeenCalledTimes(1);
  });

  it('verweigert lokale Spiele, die eigene Handys voraussetzen', async () => {
    loader.loadGame.mockResolvedValueOnce({ ...definition, requiresOwnDevice: true });
    setup(4);
    await act(async () => api.startGame('top-ten'));
    expect(api.status).toBe('lobby');
    expect(api.error).toContain('Online-Lobby');
    expect(createState).not.toHaveBeenCalled();
  });
});
