import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database';
import {
  getDb,
  HEARTBEAT_MS,
  HOST_TAKEOVER_MS,
  LOBBY_TTL_MS,
  PLAYER_STALE_MS,
  withTimeout,
} from '../../lib/firebase';
import { deviceId, lobbyCode, uid } from '../../lib/id';
import type { IconName } from '../../components/icons';
import { colorFor, isAvatarColor, type AvatarColor } from '../../components/ui/Avatar';
import { bacZone, estimateBac } from '../../engine/bac';
import { findDrink } from '../../engine/drinks';
import { makeDrinkEvent } from '../../engine/sips';
import type { BacZone, DrinkEvent, Profile } from '../../engine/types';
import type { GameAction, GameActionInput, GamePlayer } from '../../games/types';
import { getGame } from '../../games/registry';
import { usePlayer } from '../../store/player';
import { useApp } from '../../store/app';

export type PartyMode = 'local' | 'online';
export type PartyStatus = 'lobby' | 'playing';
export type Connection = 'idle' | 'connecting' | 'online' | 'offline' | 'error';

interface RemotePlayer {
  id: string;
  name: string;
  color: AvatarColor;
  drinkIcon?: IconName;
  joinedAt: number;
  lastSeen: number;
  online?: boolean;
  ready?: boolean;
  /** Übernimmt heute den Heimweg. */
  driver?: boolean;
  /** Nur die grobe Pegel-Zone – nie ein Zahlenwert. */
  zone?: BacZone;
}

interface LobbySnapshot {
  meta?: {
    code: string;
    host: string;
    status?: PartyStatus;
    gameId?: string;
    /** Wer die aktuelle Runde gestartet hat – für die Einladung an die anderen. */
    startedBy?: string;
    startedAt?: number;
    createdAt: number;
    updatedAt?: number;
    expiresAt: number;
  };
  players?: Record<string, RemotePlayer>;
  /** Der Spielstand liegt als JSON-String in der Datenbank – siehe encodeState(). */
  game?: { id: string; startedAt: number; state: string };
}

export interface PartyValue {
  mode: PartyMode;
  code: string | null;
  status: PartyStatus;
  connection: Connection;
  error: string | null;
  players: GamePlayer[];
  me: GamePlayer;
  isHost: boolean;
  gameId: string | null;
  gameState: unknown;
  /** Wer die laufende Runde gestartet hat (nur im Online-Modus gesetzt). */
  startedBy: string | null;
  startedAt: number;

  createOnline: () => Promise<string>;
  joinOnline: (code: string) => Promise<void>;
  startLocal: () => void;
  leave: () => void;
  addLocalPlayer: (input: { name: string; color: AvatarColor; profile: Profile; drinkId: string }) => void;
  updateLocalPlayer: (id: string, patch: Partial<GamePlayer['local']> & { name?: string; color?: AvatarColor }) => void;
  removeLocalPlayer: (id: string) => void;
  startGame: (gameId: string) => void;
  endGame: () => void;
  dispatch: (action: GameActionInput) => void;
  logSipsFor: (playerId: string, sips: number, source?: string) => void;
}

/** Exportiert, damit Tests eine Runde ohne Firebase nachstellen können. */
export const PartyCtx = createContext<PartyValue | null>(null);

export function useParty(): PartyValue {
  const ctx = useContext(PartyCtx);
  if (!ctx) throw new Error('useParty muss innerhalb von <PartyProvider> benutzt werden');
  return ctx;
}

export function PartyProvider({ children }: { children: ReactNode }) {
  const profile = usePlayer((s) => s.profile);
  const currentDrinkId = usePlayer((s) => s.currentDrinkId);
  const customDrinks = usePlayer((s) => s.customDrinks);
  const logEvent = usePlayer((s) => s.logEvent);
  const log = usePlayer((s) => s.log);
  const setLastLobbyCode = useApp((s) => s.setLastLobbyCode);

  const myId = useMemo(() => deviceId(), []);
  const [mode, setMode] = useState<PartyMode>('local');
  const [code, setCode] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>('idle');
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);

  // --- Lokaler Modus (Pass & Play auf einem Gerät) ---
  // Die Runde überlebt ein Neuladen, aber nicht das Schließen des Tabs:
  // Gastdaten gehören niemandem dauerhaft auf dieses Gerät.
  const [localPlayers, setLocalPlayers] = useState<GamePlayer[]>(loadLocalPlayers);
  const [localGameId, setLocalGameId] = useState<string | null>(null);
  const [localGameState, setLocalGameState] = useState<unknown>(null);
  const [localStatus, setLocalStatus] = useState<PartyStatus>('lobby');

  const myDrink = findDrink(currentDrinkId, customDrinks);

  // Für den Heartbeat: aktuelle Werte ohne das Abo neu aufzubauen.
  const liveRef = useRef({ profile, log, drink: myDrink });
  liveRef.current = { profile, log, drink: myDrink };

  const me: GamePlayer = useMemo(
    () => ({
      id: myId,
      name: profile?.name || 'Du',
      color: profile?.color ?? 'indigo',
      drinkIcon: myDrink.icon,
      driver: profile?.designatedDriver ?? false,
      online: true,
      isHost: mode === 'local' ? true : snapshot?.meta?.host === myId,
    }),
    [myId, profile?.name, profile?.color, myDrink.icon, mode, snapshot?.meta?.host],
  );

  const isHost = mode === 'local' ? true : snapshot?.meta?.host === myId;

  const players: GamePlayer[] = useMemo(() => {
    if (mode === 'local') return [me, ...localPlayers];
    const map = snapshot?.players ?? {};
    return Object.values(map)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: isAvatarColor(p.color) ? p.color : colorFor(p.id),
        drinkIcon: p.drinkIcon,
        driver: p.driver === true,
        zone: p.zone,
        online: p.online !== false && Date.now() - p.lastSeen < PLAYER_STALE_MS,
        isHost: snapshot?.meta?.host === p.id,
      }));
  }, [mode, me, localPlayers, snapshot]);

  const status: PartyStatus =
    mode === 'local' ? localStatus : (snapshot?.meta?.status ?? 'lobby');
  const gameId = mode === 'local' ? localGameId : (snapshot?.meta?.gameId ?? null);
  const startedBy = mode === 'local' ? null : (snapshot?.meta?.startedBy ?? null);
  const startedAt = mode === 'local' ? 0 : (snapshot?.meta?.startedAt ?? 0);
  const remoteStateRaw = snapshot?.game?.state ?? null;
  const remoteState = useMemo(() => decodeState(remoteStateRaw), [remoteStateRaw]);
  const gameState = mode === 'local' ? localGameState : remoteState;

  // ---------- Online: Verbindung ----------
  const lobbyRef = useCallback((c: string, path = '') => ref(getDb(), `lobbies/${c}${path}`), []);

  const writeMe = useCallback(
    async (c: string, extra: Partial<RemotePlayer> = {}) => {
      await update(lobbyRef(c, `/players/${myId}`), {
        id: myId,
        name: (profile?.name || 'Spieler').slice(0, 24),
        color: profile?.color ?? 'indigo',
        drinkIcon: myDrink.icon,
        driver: profile?.designatedDriver ?? false,
        lastSeen: Date.now(),
        online: true,
        ...extra,
      });
    },
    [lobbyRef, myId, profile?.name, profile?.color, myDrink.icon],
  );

  const createOnline = useCallback(async (): Promise<string> => {
    setConnection('connecting');
    setError(null);
    try {
      let c = lobbyCode();
      for (let attempt = 0; attempt < 6; attempt++) {
        const existing = await withTimeout(get(lobbyRef(c, '/meta')), OFFLINE_MSG);
        if (!existing.exists() || (existing.val()?.expiresAt ?? 0) < Date.now()) break;
        c = lobbyCode();
      }
      const now = Date.now();
      await withTimeout(set(lobbyRef(c), {
        meta: {
          code: c,
          host: myId,
          status: 'lobby',
          createdAt: now,
          updatedAt: now,
          expiresAt: now + LOBBY_TTL_MS,
        },
        players: {
          [myId]: {
            id: myId,
            name: (profile?.name || 'Spieler').slice(0, 24),
            color: profile?.color ?? 'indigo',
            drinkIcon: myDrink.icon,
            driver: profile?.designatedDriver ?? false,
            joinedAt: now,
            lastSeen: now,
            online: true,
          },
        },
      }), OFFLINE_MSG);
      setMode('online');
      setCode(c);
      setLastLobbyCode(c);
      return c;
    } catch (e) {
      setConnection('error');
      setError(describe(e));
      throw e;
    }
  }, [lobbyRef, myId, profile?.name, profile?.color, myDrink.icon, setLastLobbyCode]);

  const joinOnline = useCallback(
    async (raw: string) => {
      const c = raw.trim().toUpperCase();
      setConnection('connecting');
      setError(null);
      try {
        const metaSnap = await withTimeout(get(lobbyRef(c, '/meta')), OFFLINE_MSG);
        if (!metaSnap.exists()) throw new Error('Diese Lobby gibt es nicht (mehr).');
        if ((metaSnap.val()?.expiresAt ?? 0) < Date.now())
          throw new Error('Diese Lobby ist abgelaufen.');
        const existing = await withTimeout(get(lobbyRef(c, `/players/${myId}`)), OFFLINE_MSG);
        await withTimeout(writeMe(c, existing.exists() ? {} : { joinedAt: Date.now() }), OFFLINE_MSG);
        setMode('online');
        setCode(c);
        setLastLobbyCode(c);
      } catch (e) {
        setConnection('error');
        setError(describe(e));
        throw e;
      }
    },
    [lobbyRef, myId, writeMe, setLastLobbyCode],
  );

  // Verbindungsstatus der Datenbank beobachten – auf Partys bricht WLAN staendig weg.
  useEffect(() => {
    if (mode !== 'online') return;
    const unsub = onValue(ref(getDb(), '.info/connected'), (snap) => {
      setConnection(snap.val() === true ? 'online' : 'offline');
    });
    return () => unsub();
  }, [mode]);

  // Live-Abo auf die Lobby
  useEffect(() => {
    if (mode !== 'online' || !code) return;
    setConnection('connecting');
    const unsub = onValue(
      lobbyRef(code),
      (snap) => {
        const val = snap.val() as LobbySnapshot | null;
        if (!val || !val.meta) {
          setSnapshot(null);
          setError('Die Lobby wurde geschlossen.');
          setConnection('error');
          return;
        }
        setSnapshot(val);
        setError(null);
      },
      (err) => {
        setConnection('error');
        setError(describe(err));
      },
    );
    return () => unsub();
  }, [mode, code, lobbyRef]);

  // Heartbeat + Verbindungsabbruch-Markierung
  useEffect(() => {
    if (mode !== 'online' || !code) return;
    const meRef = lobbyRef(code, `/players/${myId}`);
    onDisconnect(meRef).update({ online: false }).catch(() => {});
    const beat = () => {
      const { profile: p, log: l, drink } = liveRef.current;
      // Es geht nur die grobe Zone raus – kein Promillewert, kein Gewicht.
      const zone = p ? bacZone(estimateBac(l, p).bac) : 'sober';
      update(meRef, {
        lastSeen: Date.now(),
        online: true,
        zone,
        driver: p?.designatedDriver ?? false,
        drinkIcon: drink.icon,
      }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    const onVis = () => document.visibilityState === 'visible' && beat();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [mode, code, myId, lobbyRef]);

  // Host-Pflichten: Lobby am Leben halten, tote Spieler entfernen
  useEffect(() => {
    if (mode !== 'online' || !code || !isHost) return;
    const tick = () => {
      const now = Date.now();
      update(lobbyRef(code, '/meta'), { updatedAt: now, expiresAt: now + LOBBY_TTL_MS }).catch(
        () => {},
      );
      const ps = snapshotRef.current?.players ?? {};
      for (const p of Object.values(ps)) {
        if (p.id !== myId && now - p.lastSeen > PLAYER_STALE_MS * 3) {
          remove(lobbyRef(code, `/players/${p.id}`)).catch(() => {});
        }
      }
    };
    tick();
    const t = setInterval(tick, HEARTBEAT_MS * 2);
    return () => clearInterval(t);
  }, [mode, code, isHost, myId, lobbyRef]);

  // Host-Uebernahme, wenn der Host verschwunden ist
  useEffect(() => {
    if (mode !== 'online' || !code || isHost || !snapshot?.meta) return;
    const t = setInterval(() => {
      const snap = snapshotRef.current;
      if (!snap?.meta) return;
      const host = snap.players?.[snap.meta.host];
      const hostGone = !host || Date.now() - host.lastSeen > HOST_TAKEOVER_MS;
      if (!hostGone) return;
      const alive = Object.values(snap.players ?? {})
        .filter((p) => Date.now() - p.lastSeen < HOST_TAKEOVER_MS)
        .sort((a, b) => a.joinedAt - b.joinedAt);
      if (alive[0]?.id !== myId) return;
      runTransaction(lobbyRef(code, '/meta/host'), (cur) =>
        cur === snap.meta!.host ? myId : cur,
      ).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [mode, code, isHost, myId, lobbyRef, snapshot?.meta]);

  const snapshotRef = useRef<LobbySnapshot | null>(null);
  snapshotRef.current = snapshot;
  const playersRef = useRef<GamePlayer[]>(players);
  playersRef.current = players;

  // Host verarbeitet die Aktionen aller Spieler (autoritativer Reducer)
  useEffect(() => {
    if (mode !== 'online' || !code || !isHost) return;
    const inbox = lobbyRef(code, '/inbox');
    const unsub = onValue(inbox, async (snap) => {
      const val = snap.val() as Record<string, { by: string; at: number; action: string }> | null;
      if (!val) return;
      const cur = snapshotRef.current;
      const def = cur?.meta?.gameId ? getGame(cur.meta.gameId) : null;
      const entries = Object.entries(val).sort((a, b) => a[1].at - b[1].at);
      if (!def || !cur?.game) {
        await Promise.all(entries.map(([k]) => remove(lobbyRef(code, `/inbox/${k}`))));
        return;
      }
      let next = decodeState(cur.game.state);
      for (const [, msg] of entries) {
        try {
          const action = decodeState(msg.action) as GameAction | null;
          if (action) next = def.reduce(next, { ...action, by: msg.by }, playersRef.current);
        } catch (e) {
          console.error('Spielaktion fehlgeschlagen', e);
        }
      }
      await set(lobbyRef(code, '/game/state'), encodeState(next));
      await Promise.all(entries.map(([k]) => remove(lobbyRef(code, `/inbox/${k}`))));
    });
    return () => unsub();
  }, [mode, code, isHost, lobbyRef]);

  // ---------- Aktionen ----------
  const startLocal = useCallback(() => {
    setMode('local');
    setCode(null);
    setSnapshot(null);
    setConnection('idle');
    setError(null);
  }, []);

  const leave = useCallback(() => {
    if (mode === 'online' && code) {
      remove(lobbyRef(code, `/players/${myId}`)).catch(() => {});
    }
    setMode('local');
    setCode(null);
    setSnapshot(null);
    setConnection('idle');
    setLocalStatus('lobby');
    setLocalGameId(null);
    setLocalGameState(null);
    setLastLobbyCode(null);
  }, [mode, code, lobbyRef, myId, setLastLobbyCode]);

  const addLocalPlayer: PartyValue['addLocalPlayer'] = useCallback((input) => {
    setLocalPlayers((prev) => [
      ...prev,
      {
        id: uid('l_'),
        name: input.name,
        color: input.color,
        drinkIcon: findDrink(input.drinkId).icon,
        driver: input.profile.designatedDriver,
        online: true,
        local: { profile: input.profile, drinkId: input.drinkId, log: [] },
      },
    ]);
  }, []);

  const updateLocalPlayer: PartyValue['updateLocalPlayer'] = useCallback((id, patch) => {
    setLocalPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id || !p.local) return p;
        const { name, color, ...localPatch } = patch as Record<string, unknown>;
        const local = { ...p.local, ...(localPatch as Partial<NonNullable<GamePlayer['local']>>) };
        return {
          ...p,
          name: (name as string) ?? p.name,
          color: (color as AvatarColor) ?? p.color,
          drinkIcon: findDrink(local.drinkId).icon,
          local,
        };
      }),
    );
  }, []);

  const removeLocalPlayer = useCallback((id: string) => {
    setLocalPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const startGame = useCallback(
    (id: string) => {
      const def = getGame(id);
      if (!def) return;
      const roster = playersRef.current;
      const state = def.createState(roster);
      if (mode === 'local') {
        setLocalGameId(id);
        setLocalGameState(state);
        setLocalStatus('playing');
        return;
      }
      if (!code) return;
      const now = Date.now();
      update(lobbyRef(code), {
        'meta/status': 'playing',
        'meta/gameId': id,
        'meta/startedBy': myId,
        'meta/startedAt': now,
        'meta/updatedAt': now,
        game: { id, startedAt: now, state: encodeState(state) },
        inbox: null,
      }).catch((e) => setError(describe(e)));
    },
    [mode, code, lobbyRef, myId],
  );

  const endGame = useCallback(() => {
    if (mode === 'local') {
      setLocalStatus('lobby');
      setLocalGameId(null);
      setLocalGameState(null);
      return;
    }
    if (!code) return;
    update(lobbyRef(code), {
      'meta/status': 'lobby',
      'meta/gameId': null,
      'meta/startedBy': null,
      'meta/startedAt': null,
      'meta/updatedAt': Date.now(),
      game: null,
      inbox: null,
    }).catch(() => {});
  }, [mode, code, lobbyRef]);

  const dispatch = useCallback(
    (action: GameActionInput) => {
      const full: GameAction = { ...action, by: myId, at: Date.now() };
      if (mode === 'local') {
        setLocalGameState((cur: unknown) => {
          const def = localGameIdRef.current ? getGame(localGameIdRef.current) : null;
          if (!def) return cur;
          try {
            return def.reduce(cur, full, playersRef.current);
          } catch (e) {
            console.error('Spielaktion fehlgeschlagen', e);
            return cur;
          }
        });
        return;
      }
      if (!code) return;
      if (isHost) {
        // Host rechnet direkt – spart eine Rundreise und fühlt sich sofort an.
        const cur = snapshotRef.current;
        const def = cur?.meta?.gameId ? getGame(cur.meta.gameId) : null;
        if (!def || !cur?.game) return;
        try {
          const next = def.reduce(decodeState(cur.game.state), full, playersRef.current);
          set(lobbyRef(code, '/game/state'), encodeState(next)).catch(() => {});
        } catch (e) {
          console.error('Spielaktion fehlgeschlagen', e);
        }
        return;
      }
      push(lobbyRef(code, '/inbox'), {
        by: myId,
        at: Date.now(),
        action: encodeState(full),
      }).catch(() => {});
    },
    [mode, code, isHost, myId, lobbyRef],
  );

  const localGameIdRef = useRef<string | null>(null);
  localGameIdRef.current = localGameId;

  useEffect(() => {
    saveLocalPlayers(localPlayers);
  }, [localPlayers]);

  const logSipsFor = useCallback(
    (playerId: string, sips: number, source?: string) => {
      if (sips <= 0) return;
      if (playerId === myId) {
        logEvent(makeDrinkEvent(findDrink(currentDrinkId, customDrinks), sips, source));
        return;
      }
      setLocalPlayers((prev) =>
        prev.map((p) => {
          if (p.id !== playerId || !p.local) return p;
          const drink = findDrink(p.local.drinkId);
          const ev: DrinkEvent = makeDrinkEvent(drink, sips, source);
          return { ...p, local: { ...p.local, log: [...p.local.log, ev] } };
        }),
      );
    },
    [myId, logEvent, currentDrinkId, customDrinks],
  );

  const value: PartyValue = {
    mode,
    code,
    status,
    connection,
    error,
    players,
    me,
    isHost,
    gameId,
    gameState,
    startedBy,
    startedAt,
    createOnline,
    joinOnline,
    startLocal,
    leave,
    addLocalPlayer,
    updateLocalPlayer,
    removeLocalPlayer,
    startGame,
    endGame,
    dispatch,
    logSipsFor,
  };

  return <PartyCtx.Provider value={value}>{children}</PartyCtx.Provider>;
}

const LOCAL_PLAYERS_KEY = 'sdg.local-players';

function loadLocalPlayers(): GamePlayer[] {
  try {
    const raw = sessionStorage.getItem(LOCAL_PLAYERS_KEY);
    const parsed = raw ? (JSON.parse(raw) as GamePlayer[]) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p?.id && p?.local) : [];
  } catch {
    return [];
  }
}

function saveLocalPlayers(players: GamePlayer[]) {
  try {
    if (players.length) sessionStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(players));
    else sessionStorage.removeItem(LOCAL_PLAYERS_KEY);
  } catch {
    /* Privater Modus ohne Speicher – dann eben nur im Arbeitsspeicher. */
  }
}

/**
 * Spielstände gehen als JSON-String in die Datenbank.
 *
 * Die Realtime Database kennt keine leeren Arrays oder Objekte – sie speichert
 * beides als `null` und wirft `null`-Eintraege aus Arrays heraus. Ein leeres
 * Kartendeck käme also als `null` zurück und würde jedes Spiel zerlegen.
 * Als String bleibt der Zustand exakt so, wie der Reducer ihn erzeugt hat.
 */
export function encodeState(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function decodeState(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const OFFLINE_MSG =
  'Keine Verbindung zur Datenbank. Prüf dein Netz – oder spielt so lange auf einem Handy weiter.';

function describe(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/permission_denied/i.test(msg))
    return 'Die Datenbank verweigert den Zugriff. Sind die Security Rules aus database.rules.json hinterlegt?';
  if (/network|offline|unavailable/i.test(msg))
    return 'Keine Verbindung. Auf einer Party ist das Netz oft schlecht – kurz warten.';
  return msg;
}
