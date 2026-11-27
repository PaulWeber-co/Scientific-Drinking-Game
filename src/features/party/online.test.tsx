import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LobbyScreen } from '../lobby/LobbyScreen';
import { PartyProvider, useParty, type PartyValue } from './PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import { useApp } from '../../store/app';
import { loadGame } from '../../games/registry';

/**
 * Die Online-Lobby gegen eine Datenbank im Arbeitsspeicher.
 *
 * Bis hierher lief kein Test durch den Online-Zweig von `PartyContext` –
 * Firebase wurde nie angefasst. Die Attrappe kann genau das, was der Kontext
 * benutzt: lesen, schreiben, abonnieren, Transaktion. Security Rules prüft sie
 * nicht; wo es auf die ankommt, prüft der Test die Form der Daten.
 */

type Tree = Record<string, unknown>;
const db: { root: Tree } = { root: {} };
type Listener = { path: string; cb: (snap: FakeSnap) => void };
const listeners = new Set<Listener>();
const cancelDisconnect = vi.fn(() => Promise.resolve());
/** onDisconnect-Anweisungen und `set`-Aufrufe in Reihenfolge: „remove <pfad>", „set <pfad>". */
const disconnectOps: string[] = [];
const writes: string[] = [];
let connected = true;
let rejectHeartbeat = false;
let rejectRemoval = false;
let beforeSubscribe: ((path: string) => void) | undefined;

interface FakeSnap {
  exists: () => boolean;
  val: () => unknown;
}

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parts = (path: string) => path.split('/').filter(Boolean);

function getAt(path: string): unknown {
  if (path === '.info/connected') return connected;
  let node: unknown = db.root;
  for (const key of parts(path)) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Tree)[key];
  }
  return node ?? null;
}

function setAt(path: string, value: unknown) {
  const keys = parts(path);
  let node = db.root;
  for (const key of keys.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key] as Tree;
  }
  const last = keys[keys.length - 1];
  if (value === null || value === undefined) delete node[last];
  else node[last] = clone(value);
}

const snap = (path: string): FakeSnap => {
  const v = clone(getAt(path));
  return { exists: () => v !== null && v !== undefined, val: () => v };
};

function notify() {
  for (const l of [...listeners]) l.cb(snap(l.path));
}

vi.mock('firebase/database', () => ({
  // Wie das echte SDK: Punkte, #, $ und eckige Klammern sind im Pfad verboten.
  ref: (_db: unknown, path: string) => {
    if (path !== '.info/connected' && /[.#$[\]]/.test(path)) {
      throw new Error(`Firebase Database: Invalid path "${path}"`);
    }
    return { path };
  },
  get: async (r: { path: string }) => snap(r.path),
  set: async (r: { path: string }, value: unknown) => {
    writes.push(r.path);
    disconnectOps.push(`set ${r.path}`);
    setAt(r.path, value);
    notify();
  },
  update: async (r: { path: string }, patch: Record<string, unknown>) => {
    writes.push(r.path);
    if (rejectHeartbeat && 'zone' in patch) throw new Error('Verbindung unterbrochen');
    if (rejectRemoval && Object.keys(patch).some((key) => key.startsWith('players/'))) {
      throw new Error('network unavailable');
    }
    for (const [k, v] of Object.entries(patch)) setAt(`${r.path}/${k}`, v);
    notify();
  },
  remove: async (r: { path: string }) => {
    writes.push(r.path);
    setAt(r.path, null);
    notify();
  },
  push: async (r: { path: string }, value: unknown) => {
    writes.push(r.path);
    setAt(`${r.path}/k${Math.random().toString(36).slice(2)}`, value);
    notify();
  },
  runTransaction: async (r: { path: string }, fn: (cur: unknown) => unknown) => {
    writes.push(r.path);
    setAt(r.path, fn(getAt(r.path)));
    notify();
    return { committed: true };
  },
  onValue: (r: { path: string }, cb: (s: FakeSnap) => void) => {
    beforeSubscribe?.(r.path);
    const l = { path: r.path, cb };
    listeners.add(l);
    cb(snap(r.path));
    return () => listeners.delete(l);
  },
  onDisconnect: (r: { path: string }) => ({
    update: () => (disconnectOps.push(`update ${r.path}`), Promise.resolve()),
    remove: () => (disconnectOps.push(`remove ${r.path}`), Promise.resolve()),
    cancel: () => (disconnectOps.push(`cancel ${r.path}`), cancelDisconnect()),
  }),
}));

// Ein Canvas gibt es in jsdom nicht; die Kopie ist hier am Inhalt erkennbar.
vi.mock('../profile/portrait', () => ({
  makeShareCopy: async (photo: string) => `${photo}-KOPIE`,
}));

vi.mock('../../lib/firebase', async (original) => ({
  ...(await original<typeof import('../../lib/firebase')>()),
  getDb: () => ({}),
}));

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

const ICH = 'd_ich';
const START = 1_800_000_000_000;

let api!: PartyValue;
function Probe() {
  api = useParty();
  return null;
}

const spieler = (id: string, name: string, joinedAt: number, lastSeen: number) => ({
  id,
  name,
  color: 'blue',
  joinedAt,
  lastSeen,
  online: true,
});

function lobby(players: Record<string, unknown>, host: string, code = 'ABCDEF') {
  setAt(`lobbies/${code}`, {
    meta: { code, host, status: 'lobby', createdAt: START - 60_000, expiresAt: START + 3_600_000 },
    players,
  });
}

const lobbyScreen = <MemoryRouter initialEntries={['/lobby']}><LobbyScreen /></MemoryRouter>;

async function beitreten(code = 'ABCDEF', children?: ReactNode) {
  render(
    <PartyProvider>
      <Probe />
      {children}
    </PartyProvider>,
  );
  await act(async () => {
    await api.joinOnline(code);
  });
}

function fixRandomBytes() {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((bytes) => {
    if (bytes instanceof Uint8Array) bytes.fill(0);
    return bytes;
  });
}

beforeEach(() => {
  vi.useFakeTimers({
    now: START,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
  db.root = {};
  listeners.clear();
  cancelDisconnect.mockClear();
  disconnectOps.length = 0;
  writes.length = 0;
  connected = true;
  rejectHeartbeat = false;
  rejectRemoval = false;
  beforeSubscribe = undefined;
  useApp.getState().setLastLobbyCode(null);
  localStorage.setItem('sdg.device-id', ICH);
  sessionStorage.clear();
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Ich' },
    onboarded: true,
    preloadAskedAt: START,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
    carryoverLog: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Online-Lobby: Restalkohol', () => {
  it('meldet nach dem Abendabschluss weiterhin die bestehende Pegelzone', async () => {
    usePlayer.setState({
      log: [makeDrinkEvent(findDrink('beer-pils'), 40, 'glas', START - 3_600_000)],
      nightStartedAt: START - 3_600_000,
    });
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    const before = getAt(`lobbies/ABCDEF/players/${ICH}/zone`);
    expect(before).not.toBe('sober');

    act(() => usePlayer.getState().endNight());
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(getAt(`lobbies/ABCDEF/players/${ICH}/zone`)).toBe(before);
  });
});

describe('Online-Lobby: Host-Übernahme', () => {
  it('zeigt eine bereits bestehende Verbindung nach dem Beitritt als online', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    expect(api.connection).toBe('online');
  });

  it('bleibt nach Wechsel des Lobby-Codes ohne neuen Verbindungsaufbau online', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    lobby({ h2: spieler('h2', 'Host 2', START - 120_000, START) }, 'h2', 'EFGHJK');
    await beitreten();
    await act(async () => { await api.joinOnline('EFGHJK'); });
    expect(api.code).toBe('EFGHJK');
    expect(api.connection).toBe('online');
  });

  it('übernimmt den Host, auch wenn die anderen laufend Herzschläge schicken', async () => {
    // Der Host ist seit einer Minute weg. Vorher setzte jedes neue Abbild der
    // Lobby – also jeder Herzschlag irgendeines Geräts – den 20-Sekunden-Takt
    // der Übernahme zurück. Ab zwei verbliebenen Geräten kam er nie zum Zug.
    lobby(
      {
        h1: spieler('h1', 'Host', START - 120_000, START - 60_000),
        p2: spieler('p2', 'Zweite', START + 1, START),
      },
      'h1',
    );
    await beitreten();
    expect(api.isHost).toBe(false);

    for (let i = 0; i < 6; i++) {
      await act(async () => {
        vi.advanceTimersByTime(5_000);
        setAt('lobbies/ABCDEF/players/p2/lastSeen', Date.now());
        notify();
      });
    }

    expect(getAt('lobbies/ABCDEF/meta/host')).toBe(ICH);
    expect(api.isHost).toBe(true);
  });

  it('überspringt unvollständige Einträge bei der Host-Übernahme', async () => {
    lobby({
      h1: { id: 'h1', lastSeen: START, joinedAt: START - 120_000 },
      p2: { id: 'p2', lastSeen: START, joinedAt: START - 60_000 },
    }, 'h1');
    await beitreten();
    expect(api.isHost).toBe(false);

    await act(async () => vi.advanceTimersByTime(20_000));
    expect(getAt('lobbies/ABCDEF/meta/host')).toBe(ICH);
    expect(api.isHost).toBe(true);
  });
});

describe('Online-Lobby: unvollständige Spielereinträge', () => {
  const path = 'lobbies/ABCDEF';
  const playerPath = `${path}/players/${ICH}`;

  it('zeigt fremde Teil-Einträge weder in der Lobby noch in der Runde', async () => {
    lobby({
      p2: { name: 'Ohne ID', lastSeen: START, online: true, zone: 'sober' },
      p3: { ...spieler('p3', 'Anna', START, START - 300_000), name: 3 },
      p4: spieler('p4', 'Kim', START + 1, START),
    }, ICH);
    await beitreten();
    expect(api.mode).toBe('online');
    expect(api.players.map((p) => p.id)).toEqual([ICH, 'p4']);
    expect(api.gamePlayers.map((p) => p.id)).toEqual([ICH, 'p4']);
    expect(getAt(`${path}/players/p3/name`)).toBe(3);
  });

  it('zeigt beim eigenen Teil-Eintrag nach längerer Stille den Weg-Hinweis', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten('ABCDEF', lobbyScreen);
    vi.setSystemTime(START + 121_000);
    writes.length = 0;

    await act(async () => {
      setAt(playerPath, { lastSeen: Date.now(), online: true, zone: 'sober' });
      notify();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Du warst eine Weile weg und bist nicht mehr in der Runde.');
    expect(api.mode).toBe('local');
    expect(useApp.getState().lastLobbyCode).toBe('ABCDEF');

    await act(async () => vi.advanceTimersByTime(60_000));
    expect(writes).toEqual([]);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zurück in Lobby ABCDEF' })));
    expect(api.mode).toBe('online');
    expect(getAt(playerPath)).toMatchObject({ id: ICH, name: 'Ich', joinedAt: Date.now() });
  });

  it('zeigt beim eigenen Teil-Eintrag mit frischem Herzschlag den Rauswurf-Hinweis', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten('ABCDEF', lobbyScreen);
    vi.setSystemTime(START + 130_000);
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(getAt(`${playerPath}/lastSeen`)).toBe(Date.now());

    await act(async () => {
      setAt(playerPath, { lastSeen: Date.now(), online: true, zone: 'sober' });
      notify();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Der Host hat dich aus der Runde genommen.');
    expect(api.mode).toBe('local');
    expect(useApp.getState().lastLobbyCode).toBeNull();
  });
});

describe('Online-Lobby: nach längerer Funkstille', () => {
  it('zeigt den Hinweis nach längerer Abwesenheit und tritt erst nach einem Tipp auf den gemerkten Code wieder bei', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    usePlayer.setState({ profile: { ...defaultProfile(), name: 'Ich', sharePhoto: true, photo: 'FOTO' } });
    const player = `lobbies/ABCDEF/players/${ICH}`;
    const avatar = `lobbies/ABCDEF/avatars/${ICH}`;
    await beitreten('ABCDEF', lobbyScreen);
    expect(disconnectOps).toContain(`update ${player}`);
    expect(disconnectOps).toContain(`remove ${avatar}`);
    writes.length = 0;
    disconnectOps.length = 0;

    vi.setSystemTime(START + 271_000);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => {
      setAt('lobbies/ABCDEF/players/h1/lastSeen', Date.now());
      setAt(player, null);
      setAt(avatar, null);
      notify();
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.mode).toBe('local');
    expect(api.code).toBeNull();
    expect(useApp.getState().lastLobbyCode).toBe('ABCDEF');
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Du warst eine Weile weg und bist nicht mehr in der Runde.');
    expect(notice).toHaveClass('notice', 'notice--neutral');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(disconnectOps).toEqual([`cancel ${player}`, `cancel ${avatar}`]);

    await act(async () => vi.advanceTimersByTime(60_000));
    expect(writes).toEqual([]);
    expect(getAt(player)).toBeNull();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Zurück in Lobby ABCDEF' })));
    expect(api.mode).toBe('online');
    expect(getAt(player)).toMatchObject({ id: ICH, name: 'Ich', joinedAt: Date.now() });
    expect(notice).not.toBeInTheDocument();
  });

  it('wertet einen fehlgeschlagenen Herzschlag an der 120-Sekunden-Grenze nicht als Lebenszeichen', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();

    vi.setSystemTime(START + 100_000);
    rejectHeartbeat = true;
    await act(async () => {
      setAt('lobbies/ABCDEF/players/h1/lastSeen', Date.now());
      notify();
      vi.advanceTimersByTime(20_000);
    });
    expect(getAt(`lobbies/ABCDEF/players/${ICH}/lastSeen`)).toBe(START);
    await act(async () => {
      setAt(`lobbies/ABCDEF/players/${ICH}`, null);
      notify();
    });
    expect(api.notice).toBe('Du warst eine Weile weg und bist nicht mehr in der Runde.');
  });
});

describe('Online-Lobby: Spieler entfernen', () => {
  const playerPath = (id: string) => `lobbies/ABCDEF/players/${id}`;
  const avatarPath = (id: string) => `lobbies/ABCDEF/avatars/${id}`;

  it('löscht als Host Spieler und Avatar in demselben Update', async () => {
    lobby({ p2: spieler('p2', 'Anna', START, START) }, ICH);
    setAt(avatarPath('p2'), 'data:image/jpeg;base64,ANNA');
    await beitreten();
    writes.length = 0;
    await act(async () => api.removePlayer('p2'));
    expect(writes).toEqual(['lobbies/ABCDEF']);
    expect(getAt(playerPath('p2'))).toBeNull();
    expect(getAt(avatarPath('p2'))).toBeNull();
    expect(api.players.map((p) => p.id)).toEqual([ICH]);
  });

  it('zeigt einen Netzfehler beim Entfernen als rote Fehlermeldung', async () => {
    lobby({ p2: spieler('p2', 'Anna', START, START) }, ICH);
    rejectRemoval = true;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await beitreten('ABCDEF', lobbyScreen);

    fireEvent.click(screen.getByRole('button', { name: 'Anna' }));
    const sheet = screen.getByRole('dialog', { name: 'Anna' });
    await act(async () => fireEvent.click(within(sheet).getByRole('button', { name: 'Aus der Runde nehmen' })));

    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Keine Verbindung. Auf einer Party ist das Netz oft schlecht – kurz warten.');
    expect(error).toHaveClass('notice', 'notice--red');
    expect(screen.getByRole('button', { name: 'Anna' })).toBeInTheDocument();
  });

  it.each([
    ['Mitspieler können den Host nicht entfernen', 'h1', 'h1'],
    ['Der Host kann sich nicht selbst entfernen', ICH, ICH],
  ])('%s', async (_fall, host, target) => {
    lobby({ h1: spieler('h1', 'Andere Person', START, START) }, host);
    await beitreten();
    setAt(avatarPath(target), 'data:image/jpeg;base64,FOTO');
    writes.length = 0;
    await act(async () => api.removePlayer(target));
    expect(writes).toEqual([]);
    expect(getAt(playerPath(target))).not.toBeNull();
    expect(getAt(avatarPath(target))).not.toBeNull();
  });

  it('zeigt den Rauswurf-Hinweis auch bei offenem Trink-Sheet und bleibt ohne Lobby-Code draußen', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    usePlayer.setState({
      profile: { ...defaultProfile(), name: 'Ich', sharePhoto: true, photo: 'FOTO' },
      preloadAskedAt: null,
    });
    await beitreten('ABCDEF', lobbyScreen);
    expect(screen.getByRole('dialog', { name: 'Schon was getrunken?' })).toBeInTheDocument();
    expect(disconnectOps).toContain(`update ${playerPath(ICH)}`);
    expect(disconnectOps).toContain(`remove ${avatarPath(ICH)}`);
    vi.setSystemTime(START + 130_000);
    await act(async () => {
      setAt('lobbies/ABCDEF/players/h1/lastSeen', Date.now());
      notify();
      vi.advanceTimersByTime(20_000);
    });
    expect(getAt(`${playerPath(ICH)}/lastSeen`)).toBe(Date.now());
    expect(useApp.getState().lastLobbyCode).toBe('ABCDEF');

    writes.length = 0;
    disconnectOps.length = 0;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => {
      setAt(playerPath(ICH), null);
      setAt(avatarPath(ICH), null);
      notify();
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(api.mode).toBe('local');
    expect(api.code).toBeNull();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Der Host hat dich aus der Runde genommen. Mit dem Code kannst du wieder beitreten.');
    expect(notice).toHaveClass('notice', 'notice--neutral');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Schon was getrunken?' })).toBeNull();
    expect(useApp.getState().lastLobbyCode).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zurück in Lobby ABCDEF' })).toBeNull();
    expect(disconnectOps).toEqual([`cancel ${playerPath(ICH)}`, `cancel ${avatarPath(ICH)}`]);
    for (let i = 0; i < 3; i++) {
      await act(async () => vi.advanceTimersByTime(20_000));
      expect(getAt(playerPath(ICH))).toBeNull();
    }
    expect(writes).toEqual([]);

    fixRandomBytes();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Eigene Handys/ })));
    expect(api.mode).toBe('online');
    expect(api.code).toBe('AAAAAA');
    expect(notice).not.toBeInTheDocument();
  });

  it('entfernt den Rauswurf-Hinweis beim Hinzufügen eines lokalen Gasts', async () => {
    fixRandomBytes();
    lobby({ h1: spieler('h1', 'Host', START, START) }, 'h1');
    await beitreten('ABCDEF', lobbyScreen);
    await act(async () => {
      setAt(playerPath(ICH), null);
      notify();
    });
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Der Host hat dich aus der Runde genommen.');

    fireEvent.click(screen.getByRole('button', { name: 'Mitspieler hinzufügen' }));
    const sheet = screen.getByRole('dialog', { name: 'Mitspieler auf diesem Handy' });
    fireEvent.change(within(sheet).getByPlaceholderText('Name'), { target: { value: 'Anna' } });
    expect(notice).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Fertig' }));

    expect(screen.getByRole('button', { name: 'Anna' })).toBeInTheDocument();
    expect(notice).not.toBeInTheDocument();
  });

  it('entfernt den Weg-Hinweis beim Start eines lokalen Spiels', async () => {
    fixRandomBytes();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    lobby({ h1: spieler('h1', 'Host', START, START) }, 'h1');
    render(<PartyProvider><Probe />{lobbyScreen}</PartyProvider>);
    act(() => api.addLocalPlayer({
      name: 'Anna',
      color: 'blue',
      profile: { ...defaultProfile(), name: 'Anna', color: 'blue' },
      drinkId: 'beer-pils',
    }));
    await act(async () => {
      await api.joinOnline('ABCDEF');
    });

    vi.setSystemTime(START + 271_000);
    await act(async () => {
      setAt(playerPath(ICH), null);
      notify();
    });
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Du warst eine Weile weg und bist nicht mehr in der Runde.');
    expect(api.mode).toBe('local');

    await act(async () => {
      expect(await api.startGame('most-likely')).toBe(true);
    });

    expect(api.status).toBe('playing');
    expect(api.gameId).toBe('most-likely');
    expect(notice).not.toBeInTheDocument();
  });

  it('lässt die Lobby bestehen, auch wenn das entfernte Gerät zuletzt aktiv war', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 900_000, START - 600_000) }, 'h1');
    await beitreten();
    writes.length = 0;
    await act(async () => {
      setAt(playerPath(ICH), null);
      notify();
    });
    expect(api.mode).toBe('local');
    expect(writes).toEqual([]);
    expect(getAt('lobbies/ABCDEF/meta/host')).toBe('h1');
  });

  it('verwirft einen noch ladenden Spielstart nach Verlust des eigenen Eintrags', async () => {
    await loadGame('most-likely');
    lobby({ p2: spieler('p2', 'Anna', START, START) }, ICH);
    await beitreten();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    writes.length = 0;

    await act(async () => {
      const starting = api.startGame('most-likely');
      setAt(playerPath(ICH), null);
      notify();
      expect(await starting).toBe(false);
    });
    expect(writes).toEqual([]);
  });

  it('wartet ohne Herzschlag, solange der eigene Eintrag noch nie im Lobby-Abbild stand', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    beforeSubscribe = (path) => {
      if (path === 'lobbies/ABCDEF') setAt(playerPath(ICH), null);
    };
    await beitreten();
    expect(writes).toEqual([playerPath(ICH)]);
    expect(api.mode).toBe('online');
    expect(api.error).toBeNull();
    expect(api.notice).toBeNull();

    await act(async () => {
      setAt(playerPath(ICH), spieler(ICH, 'Ich', START, START));
      notify();
      vi.advanceTimersByTime(20_000);
    });
    expect(getAt(`${playerPath(ICH)}/lastSeen`)).toBe(START + 20_000);
  });

  it('lässt ein bewusst wieder beigetretenes Gerät erneut Herzschläge senden', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    await act(async () => {
      setAt(playerPath(ICH), null);
      notify();
    });
    expect(api.mode).toBe('local');
    await act(async () => { await api.joinOnline('ABCDEF'); });
    await act(async () => vi.advanceTimersByTime(20_000));
    expect(api.mode).toBe('online');
    expect(api.error).toBeNull();
    expect(getAt(`${playerPath(ICH)}/lastSeen`)).toBe(START + 20_000);
  });

  it('entfernt das zweite Gerät und lässt das laufende Spiel beim Host weiterlaufen', async () => {
    await loadGame('most-likely');
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    setAt('lobbies/ABCDEF/meta/status', 'playing');
    setAt('lobbies/ABCDEF/meta/gameId', 'most-likely');
    setAt('lobbies/ABCDEF/game', {
      id: 'most-likely', startedAt: START, state: '{"phase":"vote","votes":{},"tally":{}}',
    });
    let host!: PartyValue;
    function Host() {
      host = useParty();
      return null;
    }
    localStorage.setItem('sdg.device-id', 'h1');
    render(<PartyProvider><Host /></PartyProvider>);
    await act(async () => { await host.joinOnline('ABCDEF'); });
    localStorage.setItem('sdg.device-id', ICH);
    await beitreten();
    expect(api.status).toBe('playing');
    expect(host.players.map((p) => p.id)).toContain(ICH);

    await act(async () => host.removePlayer(ICH));
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(api.mode).toBe('local');
    expect(getAt(playerPath(ICH))).toBeNull();
    expect(host.players.map((p) => p.id)).toEqual(['h1']);
    expect(host.status).toBe('playing');
    await act(async () => host.dispatch({ type: 'vote', target: 'h1' }));
    expect(host.gameState).toMatchObject({ votes: { h1: 'h1' } });
  });
});

describe('Online-Lobby: Inbox-Absender', () => {
  const path = 'lobbies/ABCDEF';
  const state = () => JSON.parse(getAt(`${path}/game/state`) as string);
  const vote = (id: string, by: string, target: string) => setAt(`${path}/inbox/${id}`, {
    by,
    at: Date.now(),
    action: JSON.stringify({ type: 'vote', by: 'ignorieren', target }),
  });

  beforeEach(async () => {
    await loadGame('most-likely');
    lobby({ p2: spieler('p2', 'Anna', START, START) }, ICH);
    setAt(`${path}/meta/status`, 'playing');
    setAt(`${path}/meta/gameId`, 'most-likely');
    setAt(`${path}/game`, {
      id: 'most-likely',
      startedAt: START,
      state: JSON.stringify({ phase: 'vote', votes: {}, tally: {} }),
    });
    await beitreten();
  });

  it('verwirft die Stimme einer entfernten Person und räumt ihren Inbox-Eintrag ab', async () => {
    writes.length = 0;
    await act(async () => {
      vote('a', 'p2', ICH);
      notify();
      api.removePlayer('p2');
    });
    expect(getAt(`${path}/inbox/a`)).toBeNull();
    expect(state().votes).toEqual({});
    expect(writes).not.toContain(`${path}/game/state`);

    await act(async () => api.dispatch({ type: 'vote', target: ICH }));
    expect(state().votes).toEqual({ [ICH]: ICH });
  });

  it('verwirft eine Stimme auch bei einer Entfernung während der Inbox-Verarbeitung', async () => {
    await act(async () => {
      vote('a', 'schon-weg', ICH);
      vote('b', 'p2', ICH);
      notify();
      await Promise.resolve();
      api.removePlayer('p2');
    });
    expect(getAt(`${path}/inbox/a`)).toBeNull();
    expect(getAt(`${path}/inbox/b`)).toBeNull();
    expect(state().votes).toEqual({});
  });

  it('beendet nach Verlust des eigenen Eintrags auch die Schreibzugriffe des Hosts', async () => {
    vi.setSystemTime(START + 121_000);
    writes.length = 0;
    await act(async () => {
      vote('a', ICH, 'p2');
      notify();
      setAt(`${path}/players/${ICH}`, null);
      notify();
      vi.advanceTimersByTime(40_000);
    });
    expect(api.mode).toBe('local');
    expect(writes).toEqual([]);
  });

  it('verwirft Züge aus Teil-Einträgen und akzeptiert sie nach vollständigem Beitritt', async () => {
    await act(async () => {
      setAt(`${path}/players/p3`, { id: 'p3', lastSeen: START, online: true });
      notify();
      vote('a', 'p3', 'p2');
      notify();
    });
    expect(getAt(`${path}/inbox/a`)).toBeNull();
    expect(state().votes).toEqual({});

    await act(async () => {
      setAt(`${path}/players/p3`, spieler('p3', 'Kim', START + 1, START));
      notify();
      vote('b', 'p3', 'p2');
      notify();
    });
    expect(getAt(`${path}/inbox/b`)).toBeNull();
    expect(state().votes).toEqual({ p3: 'p2' });
  });

  it('berücksichtigt Beitritte bei der Auszählung schon vor dem nächsten Rendern', async () => {
    await act(async () => api.dispatch({ type: 'vote', target: 'p2' }));
    await act(async () => {
      setAt(`${path}/players/p3`, spieler('p3', 'Kim', START + 1, START));
      notify();
      vote('a', 'p2', ICH);
      notify();
    });
    expect(state()).toMatchObject({ phase: 'vote', votes: { [ICH]: 'p2', p2: ICH } });
    await act(async () => {
      vote('b', 'p3', 'p2');
      notify();
    });
    expect(state()).toMatchObject({ phase: 'result', votes: { [ICH]: 'p2', p2: ICH, p3: 'p2' } });
  });
});

describe('Online-Lobby: verlassen', () => {
  it('löscht die Lobby, wenn die letzte aktive Person geht', async () => {
    // Die andere Person ist seit zehn Minuten weg – so lange, dass auch der
    // Host sie schon als inaktiv entfernt hätte.
    lobby({ alt: spieler('alt', 'Weg', START - 900_000, START - 600_000) }, ICH);
    await beitreten();
    act(() => api.leave());
    await act(async () => {});
    expect(getAt('lobbies/ABCDEF')).toBeNull();
    expect(cancelDisconnect).toHaveBeenCalled();
  });

  it('nimmt nur den eigenen Eintrag heraus, solange noch jemand da ist', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    act(() => api.leave());
    await act(async () => {});
    expect(getAt(`lobbies/ABCDEF/players/${ICH}`)).toBeNull();
    expect(getAt('lobbies/ABCDEF/players/h1')).not.toBeNull();
  });
});

describe('Online-Lobby: Codes', () => {
  it('weist einen kaputten Code ab, bevor er in einen Datenbankpfad gerät', async () => {
    render(
      <PartyProvider>
        <Probe />
      </PartyProvider>,
    );
    await act(async () => {
      await api.joinOnline('../x').catch(() => {});
    });
    expect(api.error).toBe('Diese Lobby gibt es nicht (mehr).');
    expect(api.mode).toBe('local');
  });

  it('benutzt keinen Code einer abgelaufenen Lobby neu', async () => {
    // Die Security Rules sperren jeden Schreibzugriff auf eine abgelaufene
    // Lobby. Vorher galt ihr Code als frei, und `set` scheiterte daran.
    const crypto = globalThis.crypto;
    const bytes = [
      [0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1],
    ]; // „AAAAAA", dann „BBBBBB"
    const spy = vi
      .spyOn(crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView | null>(arr: T): T => {
        (arr as unknown as Uint8Array).set(bytes.shift() ?? [2, 2, 2, 2, 2, 2]);
        return arr;
      });
    setAt('lobbies/AAAAAA', {
      meta: { code: 'AAAAAA', host: 'x', createdAt: 0, expiresAt: START - 1 },
    });
    render(
      <PartyProvider>
        <Probe />
      </PartyProvider>,
    );
    let code = '';
    await act(async () => {
      code = await api.createOnline();
    });
    spy.mockRestore();
    expect(code).toBe('BBBBBB');
    expect(getAt('lobbies/AAAAAA/meta/host')).toBe('x');
  });
});

const FOTO = 'data:image/jpeg;base64,ORIGINAL';
const KOPIE = `${FOTO}-KOPIE`;
const mitFoto = (sharePhoto: boolean) =>
  usePlayer.setState({ profile: { ...defaultProfile(), name: 'Ich', photo: FOTO, sharePhoto } });

describe('Online-Lobby: Profilbilder', () => {
  it('zeigt das freigegebene Bild eines Mitspielers', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    setAt('lobbies/ABCDEF/avatars/h1', 'data:image/jpeg;base64,H1');
    await beitreten();
    expect(api.players.find((p) => p.id === 'h1')?.photo).toBe('data:image/jpeg;base64,H1');
  });

  it('teilt ohne Zustimmung nichts', async () => {
    mitFoto(false);
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    await act(async () => {});
    expect(getAt(`lobbies/ABCDEF/avatars/${ICH}`)).toBeNull();
    expect(api.players.find((p) => p.id === ICH)?.photo).toBe(FOTO);
  });

  it('teilt mit Zustimmung nur die Kopie und meldet vorher die Löschung an', async () => {
    mitFoto(true);
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    await act(async () => {});
    expect(getAt(`lobbies/ABCDEF/avatars/${ICH}`)).toBe(KOPIE);
    const loeschen = disconnectOps.indexOf(`remove lobbies/ABCDEF/avatars/${ICH}`);
    const schreiben = disconnectOps.indexOf(`set lobbies/ABCDEF/avatars/${ICH}`);
    expect(loeschen).toBeGreaterThanOrEqual(0);
    expect(loeschen).toBeLessThan(schreiben);
  });

  it('nimmt das Bild beim Ausschalten sofort heraus', async () => {
    mitFoto(true);
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    await act(async () => {});
    await act(async () => mitFoto(false));
    expect(getAt(`lobbies/ABCDEF/avatars/${ICH}`)).toBeNull();
    expect(disconnectOps).toContain(`cancel lobbies/ABCDEF/avatars/${ICH}`);
  });

  it('meldet nach dem Wiederverbinden Löschung und Offline neu an und schreibt das Bild neu', async () => {
    mitFoto(true);
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    await act(async () => {});
    const zaehle = (op: string) => disconnectOps.filter((o) => o === op).length;
    const offline = `update lobbies/ABCDEF/players/${ICH}`;
    const loeschen = `remove lobbies/ABCDEF/avatars/${ICH}`;
    expect([zaehle(offline), zaehle(loeschen)]).toEqual([1, 1]);

    // Verbindung weg: der Server führt die Anweisung aus und vergisst sie.
    await act(async () => {
      connected = false;
      setAt(`lobbies/ABCDEF/avatars/${ICH}`, null);
      notify();
    });
    expect(api.connection).toBe('offline');
    await act(async () => {
      connected = true;
      notify();
    });
    expect([zaehle(offline), zaehle(loeschen)]).toEqual([2, 2]);
    expect(getAt(`lobbies/ABCDEF/avatars/${ICH}`)).toBe(KOPIE);
  });

  it('nimmt beim Verlassen Eintrag und Bild heraus', async () => {
    mitFoto(true);
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    await act(async () => {});
    act(() => api.leave());
    await act(async () => {});
    expect(getAt(`lobbies/ABCDEF/players/${ICH}`)).toBeNull();
    expect(getAt(`lobbies/ABCDEF/avatars/${ICH}`)).toBeNull();
    expect(disconnectOps).toContain(`cancel lobbies/ABCDEF/avatars/${ICH}`);
  });
});

describe('Online-Lobby: Runde beenden', () => {
  const laufend = () => {
    setAt('lobbies/ABCDEF/meta/status', 'playing');
    setAt('lobbies/ABCDEF/meta/gameId', 'kings-cup');
    setAt('lobbies/ABCDEF/meta/startedAt', START);
    setAt('lobbies/ABCDEF/game', { id: 'kings-cup', startedAt: START, state: '{}' });
  };

  it('beendet als Mitspieler nicht für alle, sondern verlässt nur selbst', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    laufend();
    await beitreten();
    act(() => api.endGame());
    await act(async () => {});
    expect(getAt('lobbies/ABCDEF/meta/status')).toBe('playing');
    expect(api.leftRound).toBe(false);
    act(() => api.leaveRound());
    expect(api.leftRound).toBe(true);
  });

  it('ersetzt als Mitspieler die laufende Runde nicht durch ein neues Spiel', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    laufend();
    await beitreten();
    await act(async () => {
      await api.startGame('most-likely');
    });
    expect(getAt('lobbies/ABCDEF/meta/gameId')).toBe('kings-cup');
    expect(getAt('lobbies/ABCDEF/game/state')).toBe('{}');
  });

  it('beendet als Host für alle', async () => {
    lobby({ h1: spieler('h1', 'Zweite', START - 120_000, START) }, ICH);
    laufend();
    await beitreten();
    act(() => api.endGame());
    await act(async () => {});
    expect(getAt('lobbies/ABCDEF/meta/status')).toBe('lobby');
    expect(getAt('lobbies/ABCDEF/game')).toBeNull();
  });
});
