import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { PartyProvider, useParty, type PartyValue } from './PartyContext';
import { defaultProfile, usePlayer } from '../../store/player';
import { findDrink } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';

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
let connected = true;

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
    disconnectOps.push(`set ${r.path}`);
    setAt(r.path, value);
    notify();
  },
  update: async (r: { path: string }, patch: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(patch)) setAt(`${r.path}/${k}`, v);
    notify();
  },
  remove: async (r: { path: string }) => {
    setAt(r.path, null);
    notify();
  },
  push: async (r: { path: string }, value: unknown) => {
    setAt(`${r.path}/k${Math.random().toString(36).slice(2)}`, value);
    notify();
  },
  runTransaction: async (r: { path: string }, fn: (cur: unknown) => unknown) => {
    setAt(r.path, fn(getAt(r.path)));
    notify();
    return { committed: true };
  },
  onValue: (r: { path: string }, cb: (s: FakeSnap) => void) => {
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

async function beitreten(code = 'ABCDEF') {
  render(
    <PartyProvider>
      <Probe />
    </PartyProvider>,
  );
  await act(async () => {
    await api.joinOnline(code);
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
  connected = true;
  localStorage.setItem('sdg.device-id', ICH);
  sessionStorage.clear();
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Ich' },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
    carryoverLog: [],
  });
});

afterEach(() => {
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
});

describe('Online-Lobby: nach dem Rauswurf wegen Inaktivität', () => {
  it('trägt sich mit dem nächsten Herzschlag vollständig wieder ein', async () => {
    lobby({ h1: spieler('h1', 'Host', START - 120_000, START) }, 'h1');
    await beitreten();
    expect(getAt(`lobbies/ABCDEF/players/${ICH}/name`)).toBe('Ich');

    // Das Handy lag gesperrt, der Host hat den Eintrag entfernt.
    await act(async () => {
      setAt(`lobbies/ABCDEF/players/${ICH}`, null);
      notify();
    });
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });

    // Ein reines Teil-Update (nur lastSeen, zone, …) lehnen die Security
    // Rules ab, weil id und name fehlen – man wäre still verschwunden.
    const eintrag = getAt(`lobbies/ABCDEF/players/${ICH}`) as Record<string, unknown>;
    expect(eintrag.id).toBe(ICH);
    expect(eintrag.name).toBe('Ich');
    expect(typeof eintrag.joinedAt).toBe('number');
    expect(api.players.some((p) => p.id === ICH)).toBe(true);
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
