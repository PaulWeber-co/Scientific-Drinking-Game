/**
 * Meme-Duell ohne Lobby ausprobieren: drei Handys nebeneinander, ein
 * gemeinsamer Spielstand, die anderen beiden spielen auf Knopfdruck mit.
 *
 *   npx vite
 *   http://localhost:5173/Scientific-Drinking-Game/scripts/meme-preview/
 *
 * `?phones=1` zeigt nur das eigene Handy (für Bildschirmfotos), `?w=360&h=640`
 * setzt die Größe der Handys (kleine Geräte prüfen). Firebase wird nicht
 * angefasst – der Reducer läuft direkt hier, wie beim Host.
 */
import { StrictMode, useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../src/styles/global.css';
import '../../src/styles/game.css';
import { PartyCtx, type PartyValue } from '../../src/features/party/PartyContext';
import { memeBattle } from '../../src/games/meme-battle';
import { currentAuthor, type State } from '../../src/games/meme-battle/game';
import { templateOf } from '../../src/games/meme-battle/templates';
import type { GameActionInput, GamePlayer } from '../../src/games/types';

const PLAYERS: GamePlayer[] = [
  { id: 'p0', name: 'Paul', color: 'indigo', online: true, isHost: true },
  { id: 'p1', name: 'Lisa', color: 'pink', online: true },
  { id: 'p2', name: 'Tobi', color: 'orange', online: true },
  { id: 'p3', name: 'Mia', color: 'teal', online: true },
];

const IDEAS = [
  'Ich um 3 Uhr nachts',
  'Nur noch ein Bier',
  'Der Wecker',
  'Montag',
  'Meine Leber',
  'Die Gruppe',
  'Wer hat die Musik aus gemacht',
  'Nächstes Mal wirklich',
  'Pizza',
  'Das Gruppenfoto',
];
const idea = () => IDEAS[Math.floor(Math.random() * IDEAS.length)];

const params = new URLSearchParams(location.search);
const PHONE_W = Number(params.get('w') ?? 390);
const PHONE_H = Number(params.get('h') ?? 844);

function Preview() {
  const phones = Number(params.get('phones') ?? 3);
  const [state, setState] = useState<State>(() => memeBattle.createState(PLAYERS));

  const run = useCallback((by: string, a: GameActionInput) => {
    setState((s) => memeBattle.reduce(s, { at: Date.now(), ...a, by }, PLAYERS));
  }, []);

  const bots = PLAYERS.slice(1);
  const botsCreate = () => {
    for (const p of bots) {
      const t = templateOf(state.drawn[p.id]);
      if (!t || state.memes[p.id]) continue;
      run(p.id, { type: 'submit', texts: t.boxes.map(idea) });
    }
  };
  const botsVote = () => {
    const author = currentAuthor(state);
    if (!author) return;
    for (const p of bots) {
      if (p.id === author) continue;
      run(p.id, {
        type: 'vote',
        target: author,
        value: [1, 1, 0, -1][Math.floor(Math.random() * 4)],
      });
    }
  };
  const botsReact = () => {
    const kinds = ['lachen', 'tot', 'herz', 'cringe'];
    bots.forEach((p, i) =>
      setTimeout(
        () => run(p.id, { type: 'react', kind: kinds[Math.floor(Math.random() * kinds.length)] }),
        i * 250,
      ),
    );
  };
  const skip = () => {
    const far = Date.now() + 3_600_000;
    if (state.phase === 'create') run('p0', { type: 'timeout', at: far });
    if (state.phase === 'vote')
      run('p0', { type: 'advance', target: currentAuthor(state), at: far });
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn btn--sm btn--glass" onClick={botsCreate}>
          Bots basteln
        </button>
        <button className="btn btn--sm btn--glass" onClick={botsVote}>
          Bots stimmen ab
        </button>
        <button className="btn btn--sm btn--glass" onClick={botsReact}>
          Bots reagieren
        </button>
        <button className="btn btn--sm btn--glass" onClick={skip}>
          Uhr vorspulen
        </button>
        <button
          className="btn btn--sm btn--glass"
          onClick={() => setState(memeBattle.createState(PLAYERS))}
        >
          Neu
        </button>
        <span className="t-caption" style={{ alignSelf: 'center' }}>
          Phase: {state.phase} · Runde {state.round}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {PLAYERS.slice(0, phones).map((p) => (
          <Phone key={p.id} me={p} state={state} run={run} />
        ))}
      </div>
    </div>
  );
}

function Phone({
  me,
  state,
  run,
}: {
  me: GamePlayer;
  state: State;
  run: (by: string, a: GameActionInput) => void;
}) {
  const dispatch = useCallback((a: GameActionInput) => run(me.id, a), [run, me.id]);
  const party = useMemo(
    () =>
      ({
        mode: 'online',
        code: 'DEMO',
        status: 'playing',
        connection: 'online',
        error: null,
        players: PLAYERS,
        me,
        isHost: !!me.isHost,
        gameId: 'meme-battle',
        gameState: state,
        startedBy: 'p0',
        startedAt: 0,
        film: null,
        dispatch,
        logSipsFor: () => {},
        undoLastFor: () => {},
        removeEventFor: () => {},
      }) as unknown as PartyValue,
    [me, state, dispatch],
  );
  const Game = memeBattle.Component;
  return (
    <PartyCtx.Provider value={party}>
      <div
        style={{
          width: PHONE_W,
          height: PHONE_H,
          overflow: 'auto',
          borderRadius: 28,
          border: '1px solid #333',
          flexShrink: 0,
          // Eigener Bezugsrahmen, damit 100dvh nicht über das Handy hinausragt.
          transform: 'translateZ(0)',
        }}
      >
        <Game
          state={state}
          players={PLAYERS}
          me={me}
          isHost={!!me.isHost}
          online
          dispatch={dispatch}
          quit={() => {}}
        />
      </div>
    </PartyCtx.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Das Finale verlinkt in die App (Einwegkamera) – ohne Router stürzt es ab. */}
    <MemoryRouter>
      <Preview />
    </MemoryRouter>
  </StrictMode>,
);
