import { useState, type ReactNode } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { Icon } from '../../components/icons';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCall, DrinkCallList } from '../shared/DrinkCall';
import { BigCard, Choice, PlayerChip, WaitingFor } from '../shared/pieces';
import { PassDevice } from '../shared/PassDevice';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

interface State {
  phase: 'write' | 'commit' | 'interrogate' | 'guess' | 'result' | 'over';
  authorIndex: number;
  order: string[];
  statements: string[];
  /** Wer als Nächstes eine Rückfrage stellt – Index in `order` ohne den Autor. */
  askIndex: number;
  guesses: Record<string, number>;
  /**
   * Index der Lüge. Wird in der Phase `commit` festgeschrieben, BEVOR jemand
   * rät – und zwar auf einem Bildschirm, den nur der Autor sieht.
   *
   * Die Festlegung nachträglich zuzulassen wäre bequemer gewesen, macht das
   * Spiel aber kaputt: Auf einem geteilten Handy trägt zwangsläufig der Autor
   * die Tipps der anderen ein (er ist der Einzige, der nichts zu zeigen hat)
   * und säße Sekunden später mit der ganzen Verteilung vor Augen da. Er könnte
   * immer die Aussage benennen, die am wenigsten Leute getroffen haben, und
   * würde nie verlieren.
   */
  lie: number | null;
  round: number;
  goal: number | null;
  /** Wie oft jemand die Lüge erkannt hat. */
  hits: Record<string, number>;
}

/** Eine Runde ist eine Person mit ihren drei Aussagen. Fünf sind „mittel". */
const ROUND_BASE = baseFor('zwei-wahrheiten');

export const zweiWahrheiten: GameDefinition<State> = {
  ...meta,

  createState: (players) => ({
    phase: 'write',
    authorIndex: 0,
    order: shuffle(players.map((p) => p.id)),
    statements: [],
    askIndex: 0,
    guesses: {},
    lie: null,
    round: 1,
    goal: roundGoal(ROUND_BASE),
    hits: {},
  }),

  reduce: (state, action, players) => {
    const authorId = state.order[state.authorIndex % Math.max(1, state.order.length)];
    switch (action.type) {
      case 'submit': {
        if (state.phase !== 'write') return state;
        const raw = (action.statements as string[]) ?? [];
        if (raw.length !== 3 || raw.some((t) => !t.trim())) return state;
        // Blind mischen, dann legt der Autor auf dem gemischten Stand fest,
        // welche die Lüge war – sonst müsste er sich die Reihenfolge merken.
        return {
          ...state,
          statements: shuffle(raw.map((t) => t.trim())),
          phase: 'commit',
          askIndex: 0,
          guesses: {},
          lie: null,
        };
      }
      case 'markLie': {
        if (state.phase !== 'commit') return state;
        const lie = Number(action.index);
        if (!(lie >= 0 && lie <= 2)) return state;
        return { ...state, lie, phase: 'interrogate', askIndex: 0 };
      }
      case 'nextQuestion': {
        if (state.phase !== 'interrogate') return state;
        const askers = state.order.filter((id) => id !== authorId);
        const next = state.askIndex + 1;
        if (next >= askers.length) return { ...state, phase: 'guess', askIndex: 0 };
        return { ...state, askIndex: next };
      }
      case 'guess': {
        // Eigenes Gerät je Person: eine Stimme pro Handy.
        if (state.phase !== 'guess' || action.by === authorId) return state;
        const guesses = { ...state.guesses, [action.by]: Number(action.index) };
        return { ...state, guesses };
      }
      case 'guessAll': {
        // Ein geteiltes Handy: die Runde zeigt gleichzeitig Finger, die
        // Person mit dem Handy trägt danach alle Tipps auf einmal ein.
        if (state.phase !== 'guess') return state;
        const raw = (action.guesses as Record<string, number>) ?? {};
        const others = players.filter((p) => p.id !== authorId && p.online !== false);
        const guesses = { ...state.guesses };
        for (const p of others) {
          const v = raw[p.id];
          if (typeof v === 'number' && v >= 0 && v <= 2) guesses[p.id] = v;
        }
        return { ...state, guesses };
      }
      case 'revealLie': {
        // Auflösen heißt nur noch anzeigen: die Lüge steht seit `commit` fest
        // und kann nicht mehr an die Tipps angepasst werden.
        if (state.phase !== 'guess') return state;
        const lie = state.lie;
        if (lie === null) return state;
        const others = players.filter((p) => p.id !== authorId && p.online !== false);
        const done = others.length > 0 && others.every((p) => state.guesses[p.id] !== undefined);
        if (!done) return state;
        const hits = { ...state.hits };
        for (const p of others) {
          if (state.guesses[p.id] === lie) hits[p.id] = (hits[p.id] ?? 0) + 1;
        }
        return { ...state, hits, phase: 'result' };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'result') return state;
        const order = state.order.filter((id) => players.some((p) => p.id === id));
        const added = players.filter((p) => !order.includes(p.id)).map((p) => p.id);
        const full = [...order, ...added];
        const round = state.round + 1;
        if (isOver(round, state.goal)) {
          return { ...state, order: full, round, phase: 'over' };
        }
        return {
          ...state,
          order: full,
          authorIndex: (state.authorIndex + 1) % Math.max(1, full.length),
          phase: 'write',
          statements: [],
          askIndex: 0,
          guesses: {},
          lie: null,
          round,
        };
      }
      case 'restart':
        return zweiWahrheiten.createState(players);
      default:
        return state;
    }
  },

  Component: ZweiWahrheitenGame,
};

function ZweiWahrheitenGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const [texts, setTexts] = useState(['', '', '']);
  // Uebergabe vor der privaten Festlegung. Bewusst lokal: geht niemanden sonst an.
  const [handedOver, setHandedOver] = useState(false);
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const author =
    players.find((p) => p.id === state.order[state.authorIndex % Math.max(1, state.order.length)]) ??
    players[0];
  const isAuthor = author?.id === me.id;
  const others = players.filter((p) => p.id !== author?.id && p.online !== false);
  const progress = state.goal ? `${Math.min(state.round, state.goal)}/${state.goal}` : `${state.round}`;

  if (state.phase === 'over') {
    const guessers = players.filter((p) => p.online !== false);
    const ranking = guessers.map((p) => ({
      player: p,
      value: state.hits[p.id] ?? 0,
      unit: 'Lüge',
    }));
    const fewest = Math.min(...ranking.map((r) => r.value));
    const trailing = ranking.filter((r) => r.value === fewest).map((r) => r.player);
    const played = state.goal ?? state.round - 1;
    return (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle="Vorbei"
        onQuit={quit}
      >
        <GameOver
          headline={`${played} Runden, ${played} Lügen. Oben steht, wer sie am häufigsten erkannt hat.`}
          ranking={ranking}
          rankingTitle="Wer die meisten Lügen erkannt hat"
          finalCall={{
            // Liegen alle gleichauf, gibt es kein Schlusslicht – dann trinkt niemand.
            players: trailing.length < ranking.length ? trailing : [],
            baseSips: 3,
            label: 'am seltensten durchschaut',
            source: 'zwei-wahrheiten',
          }}
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'write') {
    const showForm = !online || isAuthor;
    const authorNote = !online ? 'ist dran' : isAuthor ? 'du schreibst' : 'schreibt';
    return (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle={`Runde ${progress}`}
        onQuit={quit}
      >
        {author && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={author} note={authorNote} />
          </div>
        )}
        {showForm ? (
          <div className="stack-3">
            <p className="t-sub t-balance t-center">
              Zwei wahre Aussagen, eine erfundene – in beliebiger Reihenfolge. Gleich
              markierst du unter vier Augen, welche gelogen war.
            </p>
            {texts.map((t, i) => (
              <input
                key={i}
                className="input"
                placeholder={`Aussage ${i + 1}`}
                maxLength={120}
                value={t}
                onChange={(e) => setTexts(texts.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            <button
              className="btn btn--brand btn--block btn--lg"
              disabled={texts.some((t) => !t.trim())}
              onClick={() => {
                haptic('success');
                send({ type: 'submit', statements: texts });
                setTexts(['', '', '']);
              }}
            >
              Abschicken
            </button>
          </div>
        ) : (
          <>
            <BigCard kicker="Gleich geht's los">{author?.name} denkt sich gerade etwas aus.</BigCard>
            <WaitingFor names={[author?.name ?? '']} what="Warten auf" />
          </>
        )}
      </GameFrame>
    );
  }

  if (state.phase === 'commit') {
    // Der Autor legt sich fest, BEVOR jemand rät – auf einem Bildschirm, den
    // nur er sieht. Online ist das sein eigenes Gerät, sonst schiebt die
    // Übergabe das Handy vorher zu ihm.
    const mark = (i: number) => {
      haptic('success');
      setHandedOver(false);
      send({ type: 'markLie', index: i });
    };
    const rahmen = (inner: ReactNode) => (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle={`Runde ${progress}`}
        onQuit={quit}
      >
        {inner}
      </GameFrame>
    );
    if (online && !isAuthor) {
      return rahmen(
        <>
          <BigCard kicker="Gleich geht's los">{author?.name} legt sich gerade fest.</BigCard>
          <WaitingFor names={[author?.name ?? '']} what="Warten auf" />
        </>,
      );
    }
    if (!online && !handedOver && author) {
      return rahmen(
        <PassDevice player={author} step={1} total={1} onConfirm={() => setHandedOver(true)} />,
      );
    }
    return rahmen(
      <div className="stack-3">
        <div className="t-upper t-center">Nur für {author?.name}</div>
        <BigCard kicker="Unter vier Augen">Welche der drei war gelogen?</BigCard>
        <Choice
          options={state.statements.map((t, i) => ({ id: String(i), label: t }))}
          onPick={(id: string) => mark(Number(id))}
        />
        <p className="t-sub t-center t-balance">
          Danach wandert das Handy zurück in die Runde. Die Antwort steht dann fest.
        </p>
      </div>,
    );
  }

  if (state.phase === 'interrogate') {
    const askers = state.order.filter((id) => id !== author?.id);
    const asker = byId(askers[state.askIndex % Math.max(1, askers.length)]);
    return (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle={`Runde ${progress} · Verhör ${state.askIndex + 1}/${askers.length}`}
        onQuit={quit}
      >
        {asker && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={asker} note={asker.id === me.id ? 'du fragst' : 'fragt'} />
          </div>
        )}
        <BigCard kicker="Eine Rückfrage">
          {asker?.id === me.id
            ? `Stell ${author?.name} eine Frage zu den drei Aussagen.`
            : `${asker?.name} befragt ${author?.name}.`}
        </BigCard>
        <p className="t-sub t-center t-balance">
          Eine offene Frage, keine Ja/Nein-Frage – {author?.name} antwortet, ohne sich zu
          verraten.
        </p>
        <button
          className="btn btn--brand btn--block btn--lg"
          onClick={() => send({ type: 'nextQuestion' })}
        >
          Gefragt – weiter
        </button>
      </GameFrame>
    );
  }

  if (state.phase === 'guess') {
    const myGuess = state.guesses[me.id];
    const complete = others.length > 0 && others.every((p) => state.guesses[p.id] !== undefined);
    const canReveal = !online || isAuthor;

    if (complete) {
      return (
        <GameFrame
          title={zweiWahrheiten.name}
          accent={zweiWahrheiten.accent}
          subtitle={`Runde ${progress} · Auflösung`}
          onQuit={quit}
        >
          {canReveal ? (
            <>
              <BigCard kicker="Nur du weißt es">Welche deiner drei Aussagen war die Lüge?</BigCard>
              <div className="stack-3">
                {state.statements.map((t, i) => (
                  <button
                    key={i}
                    className="answer-card"
                    style={{ ['--i' as string]: i }}
                    onClick={() => {
                      haptic('success');
                      send({ type: 'revealLie', lie: i });
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <BigCard kicker="Alle haben getippt">
                {author?.name} verrät gleich, welche Aussage gelogen war.
              </BigCard>
              <WaitingFor names={[author?.name ?? '']} what="Warten auf" />
            </>
          )}
        </GameFrame>
      );
    }

    return (
      <GameFrame
        title={zweiWahrheiten.name}
        accent={zweiWahrheiten.accent}
        subtitle={`Runde ${progress} · Welche ist gelogen?`}
        onQuit={quit}
      >
        {author && (
          <div className="row" style={{ justifyContent: 'center' }}>
            <PlayerChip player={author} note="behauptet" />
          </div>
        )}
        <div className="stack-3">
          {state.statements.map((t, i) =>
            online ? (
              <button
                key={i}
                className={`answer-card ${myGuess === i ? 'answer-card--picked' : ''}`}
                style={{ ['--i' as string]: i }}
                disabled={isAuthor || myGuess !== undefined}
                onClick={() => {
                  haptic('select');
                  send({ type: 'guess', index: i });
                }}
              >
                {t}
              </button>
            ) : (
              <div key={i} className="answer-card" style={{ ['--i' as string]: i }}>
                {t}
              </div>
            ),
          )}
        </div>
        {online ? (
          (isAuthor || myGuess !== undefined) && (
            <WaitingFor
              names={others.filter((p) => state.guesses[p.id] === undefined).map((p) => p.name)}
              what="Warten auf"
            />
          )
        ) : (
          <>
            <p className="t-sub t-center t-balance">
              Auf drei zeigen alle gleichzeitig 1, 2 oder 3 Finger. Trag danach ein, wer worauf
              getippt hat.
            </p>
            <GuessEntry
              players={others}
              onSubmit={(guesses) => {
                haptic('success');
                send({ type: 'guessAll', guesses });
              }}
            />
          </>
        )}
      </GameFrame>
    );
  }

  // phase === 'result' – wer offline gegangen ist, hat nicht danebengetippt: er war gar nicht da.
  const wrong = others.filter((p) => state.guesses[p.id] !== state.lie);
  const allRight = wrong.length === 0 && others.length > 0;

  return (
    <GameFrame
      title={zweiWahrheiten.name}
      accent={zweiWahrheiten.accent}
      subtitle={`Runde ${progress} · Aufgelöst`}
      onQuit={quit}
    >
      <div className="stack-3">
        {state.statements.map((t, i) => (
          <div
            key={i}
            className={`answer-card ${i === state.lie ? 'answer-card--lie' : 'answer-card--true'}`}
            style={{ ['--i' as string]: i }}
          >
            <span className="row" style={{ justifyContent: 'center', gap: 8 }}>
              <Icon name={i === state.lie ? 'ban' : 'check'} size={17} />
              {t}
            </span>
            <div className="t-caption">
              {others.filter((p) => state.guesses[p.id] === i).map((p) => p.name).join(', ') || '–'}
            </div>
          </div>
        ))}
      </div>
      {allRight && author ? (
        <DrinkCall
          player={author}
          baseSips={4}
          source="zwei-wahrheiten"
          label="alle durchschaut"
          resetKey={state.round}
        />
      ) : (
        <DrinkCallList
          players={wrong as GamePlayer[]}
          baseSips={3}
          source="zwei-wahrheiten"
          label="danebengetippt"
          resetKey={state.round}
        />
      )}
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Person'}
      </button>
    </GameFrame>
  );
}

/**
 * Eintragen auf einem geteilten Handy: die Gruppe zeigt gleichzeitig 1, 2
 * oder 3 Finger, danach trägt die Person mit dem Handy für jede*n ein,
 * welche Zahl sie gesehen hat. Drei feste Werte statt eines Zahlenfelds –
 * kein Vertippen, keine Tastatur.
 */
function GuessEntry({
  players,
  onSubmit,
}: {
  players: GamePlayer[];
  onSubmit: (guesses: Record<string, number>) => void;
}) {
  const [picks, setPicks] = useState<Record<string, number>>({});
  const ready = players.length > 0 && players.every((p) => picks[p.id] !== undefined);
  return (
    <div className="stack-3">
      <div className="stack-2">
        {players.map((p, i) => (
          <div key={p.id} className="result-row" style={{ ['--i' as string]: i }}>
            <PlayerChip player={p} />
            <span className="grow" />
            <div className="row" style={{ gap: 6 }}>
              {[0, 1, 2].map((n) => (
                <button
                  key={n}
                  className={`btn btn--sm ${picks[p.id] === n ? 'btn--tinted' : 'btn--gray'}`}
                  aria-pressed={picks[p.id] === n}
                  aria-label={`${p.name} tippt auf Aussage ${n + 1}`}
                  onClick={() => {
                    haptic('select');
                    setPicks((c) => ({ ...c, [p.id]: n }));
                  }}
                >
                  {n + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        className="btn btn--brand btn--block btn--lg"
        disabled={!ready}
        onClick={() => onSubmit(picks)}
      >
        Eingetragen
      </button>
    </div>
  );
}
