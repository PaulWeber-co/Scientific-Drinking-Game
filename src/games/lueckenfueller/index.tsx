import { useEffect, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { spicyDeck } from '../shared/prompts';
import { markTextsSeen } from '../../store/seen';
import { customCardsFor } from '../../store/cards';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { BLACK, WHITE } from './cards';
import { meta } from './meta';

/** Handkarten je Person – wie im Vorbild. */
const HAND = 10;
/** Gnadenfrist, sobald die Mehrheit gelegt hat. */
const GRACE_MS = 20_000;
/** Ab hier wird die Restzeit hervorgehoben. */
const WARN_MS = 5_000;
/** Sechs Runden fühlen sich auf „mittel" rund an. */
const ROUND_BASE = baseFor('lueckenfueller');

/**
 * Eine Kartenreferenz. `>= 0` zeigt in die eingebaute Liste, `< 0` auf
 * `state.custom` – eigene Karten reisen als Text, eingebaute als Nummer.
 *
 * Grund: der GANZE Zustand geht bei jeder Aktion neu über die Leitung.
 * 600 Kartentexte wären rund 20 KB je Schreibvorgang, Nummern rund 2 KB.
 */
type Ref = number;

export interface State {
  phase: 'submit' | 'reveal' | 'score' | 'over';
  round: number;
  goal: number | null;
  judgeId: string;
  black: Ref;
  pick: 1 | 2;
  blackDeck: Ref[];
  whiteDeck: Ref[];
  custom: string[];
  hands: Record<string, Ref[]>;
  played: Record<string, Ref[]>;
  order: string[];
  revealed: number;
  deadline: number | null;
  winnerId: string | null;
  scores: Record<string, number>;
}

const blackDeckOf = () => spicyDeck(BLACK, 'lueckenfueller', (c) => c.text);

function whiteDeckOf(custom: string[]): Ref[] {
  const eingebaut = spicyDeck(WHITE, 'lueckenfueller', (c) => c.text);
  return shuffle([...eingebaut, ...custom.map((_, i) => -i - 1)]);
}

export function whiteText(state: Pick<State, 'custom'>, ref: Ref): string {
  return ref >= 0 ? (WHITE[ref]?.text ?? '') : (state.custom[-ref - 1] ?? '');
}

/**
 * Rundenteilnehmer: online, hat eine Hand, ist nicht der Richter.
 *
 * Alle Mehrheits- und Fertig-Rechnungen laufen über DIESE Menge, nie über
 * `players`. Wer mitten in der Runde dazukommt, hat noch keine Hand und darf
 * die Phase deshalb nicht blockieren.
 */
function participants(state: State, players: GamePlayer[]): string[] {
  return players
    .filter((p) => p.online !== false && p.id !== state.judgeId && state.hands[p.id])
    .map((p) => p.id);
}

/** Der nächste Richter überspringt, wer gerade weg ist. */
function nextJudge(players: GamePlayer[], currentId: string): string {
  const da = players.filter((p) => p.online !== false);
  if (!da.length) return currentId;
  const i = da.findIndex((p) => p.id === currentId);
  return da[(i + 1) % da.length].id;
}

/**
 * Neue Runde: Richter rotiert, neue Lückenkarte, alle Hände auf zehn.
 *
 * Auch der Richter bekommt eine volle Hand – er spielt sie diese Runde nicht,
 * ist aber in der nächsten dran. Ohne das stünde er dann ohne Karten da.
 */
function startRound(state: State, players: GamePlayer[], round: number): State {
  const judgeId = nextJudge(players, state.judgeId);
  const blackDeck = state.blackDeck.length ? state.blackDeck : blackDeckOf();
  const black = blackDeck[0];

  let whiteDeck = state.whiteDeck;
  const hands: Record<string, Ref[]> = { ...state.hands };
  for (const p of players) {
    if (p.online === false && !hands[p.id]) continue;
    const hand = hands[p.id] ?? [];
    const fehlt = HAND - hand.length;
    if (fehlt <= 0) continue;
    if (whiteDeck.length < fehlt) whiteDeck = [...whiteDeck, ...whiteDeckOf(state.custom)];
    hands[p.id] = [...hand, ...whiteDeck.slice(0, fehlt)];
    whiteDeck = whiteDeck.slice(fehlt);
  }

  return {
    ...state,
    phase: 'submit',
    round,
    judgeId,
    black,
    pick: BLACK[black]?.pick === 2 ? 2 : 1,
    blackDeck: blackDeck.slice(1),
    whiteDeck,
    hands,
    played: {},
    order: [],
    revealed: 0,
    deadline: null,
    winnerId: null,
  };
}

export const lueckenfueller: GameDefinition<State> = {
  ...meta,

  createState: (players) => {
    const custom = customCardsFor('lueckenfueller').map((c) => c.text);
    const leer: State = {
      phase: 'submit',
      round: 1,
      goal: roundGoal(ROUND_BASE),
      // startRound rotiert weiter – damit ist der erste Spieler der erste Richter.
      judgeId: players[players.length - 1]?.id ?? '',
      black: 0,
      pick: 1,
      blackDeck: blackDeckOf(),
      whiteDeck: whiteDeckOf(custom),
      custom,
      hands: {},
      played: {},
      order: [],
      revealed: 0,
      deadline: null,
      winnerId: null,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
    return startRound(leer, players, 1);
  },

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'submit': {
        // Jeder Zweig prüft die Phase selbst: online wendet die Inbox
        // nacheinander an, zwei fast gleichzeitige Taps sind normal.
        if (state.phase !== 'submit') return state;
        if (action.by === state.judgeId) return state;
        if (state.played[action.by]) return state;
        const hand = state.hands[action.by];
        if (!hand) return state;
        const cards = Array.isArray(action.cards) ? (action.cards as Ref[]) : [];
        if (cards.length !== state.pick) return state;
        if (new Set(cards).size !== cards.length) return state;
        if (!cards.every((c) => hand.includes(c))) return state;

        const played = { ...state.played, [action.by]: cards };
        const hands = { ...state.hands, [action.by]: hand.filter((c) => !cards.includes(c)) };
        const dabei = participants(state, players);
        const fertig = dabei.filter((id) => played[id]).length;

        if (fertig >= dabei.length) {
          return {
            ...state,
            played,
            hands,
            phase: 'reveal',
            order: shuffle(Object.keys(played)),
            revealed: 0,
            deadline: null,
          };
        }
        // Solange geredet wird, läuft nichts. Erst ab der HÄLFTE tickt es.
        //
        // Nicht „mehr als die Hälfte": bei drei Spielern gibt es nur zwei
        // Mitspieler, und eine echte Mehrheit von zwei ist erst erreicht, wenn
        // beide gelegt haben – dann ist die Phase ohnehin vorbei. Der
        // Countdown wäre bei der kleinsten erlaubten Runde nie gelaufen, und
        // ein Spieler, der sein Handy weglegt, hätte sie eingefroren.
        const deadline =
          state.deadline ?? (fertig * 2 >= dabei.length ? (action.at ?? Date.now()) + GRACE_MS : null);
        return { ...state, played, hands, deadline };
      }

      case 'timeout': {
        if (state.phase !== 'submit') return state;
        if (state.deadline === null) return state;
        if ((action.at ?? Date.now()) < state.deadline) return state;
        const abgegeben = Object.keys(state.played);
        // Ohne eine einzige Karte gibt es nichts zu richten – dann wird
        // weiter gewartet statt eine leere Runde aufzudecken.
        if (!abgegeben.length) return { ...state, deadline: null };
        return {
          ...state,
          phase: 'reveal',
          order: shuffle(abgegeben),
          revealed: 0,
          deadline: null,
        };
      }

      case 'flip': {
        if (state.phase !== 'reveal') return state;
        if (action.by !== state.judgeId) return state;
        if (state.revealed >= state.order.length) return state;
        return { ...state, revealed: state.revealed + 1 };
      }

      case 'pick-winner': {
        if (state.phase !== 'reveal') return state;
        if (action.by !== state.judgeId) return state;
        if (state.revealed < state.order.length) return state;
        const winnerId = String(action.target);
        if (!state.played[winnerId]) return state;
        return {
          ...state,
          phase: 'score',
          winnerId,
          scores: { ...state.scores, [winnerId]: (state.scores[winnerId] ?? 0) + 1 },
        };
      }

      case 'next': {
        // Jeder darf weiter, nicht nur der Richter – sonst hängt die Runde
        // an einer Person, die vielleicht gerade nicht hinschaut.
        if (state.phase !== 'score') return state;
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
        return startRound(state, players, round);
      }

      case 'judge-left': {
        if (state.phase === 'over') return state;
        const richter = players.find((p) => p.id === state.judgeId);
        if (richter && richter.online !== false) return state;
        // Die Runde wird verworfen, nicht gewertet: der Richter hat die
        // Karten nie gesehen. Gespieltes geht zurück auf die Hand,
        // `round` steigt NICHT.
        const hands = { ...state.hands };
        for (const [id, cards] of Object.entries(state.played)) {
          hands[id] = [...(hands[id] ?? []), ...cards];
        }
        return startRound({ ...state, hands }, players, state.round);
      }

      case 'restart':
        return lueckenfueller.createState(players);

      default:
        return state;
    }
  },

  Component: LueckenfuellerGame,
};

/** Setzt die gelegten Karten in den Lückentext ein. */
export function fill(text: string, teile: string[]): string {
  let i = 0;
  return text.replace(/_{2,}/g, () => {
    const wert = teile[i++] ?? '____';
    return wert;
  });
}

/** Am Satzanfang gehört der Artikel groß – gespeichert ist er klein. */
function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function Countdown({ until }: { until: number }) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, until - Date.now())), 200);
    return () => clearInterval(t);
  }, [until]);
  const sek = Math.ceil(left / 1000);
  return (
    <span
      role="timer"
      aria-label={`Noch ${sek} Sekunden`}
      className={left <= WARN_MS ? 'lf-clock lf-clock--warn' : 'lf-clock'}
    >
      {sek} s
    </span>
  );
}

function LueckenfuellerGame({
  state,
  players,
  me,
  isHost,
  dispatch,
  quit,
  online,
}: GameRuntime<State>) {
  const [gewaehlt, setGewaehlt] = useState<Ref[]>([]);
  const send = (a: GameActionInput) => dispatch(a);
  const byId = (id: string) => players.find((p) => p.id === id);
  const schwarz = BLACK[state.black];
  const bin = { richter: me.id === state.judgeId };
  const hand = state.hands[me.id] ?? [];
  const dabei = participants(state, players);

  // Gemerkt, damit der nächste Abend mit ungesehenem Stoff anfängt.
  useEffect(() => {
    if (schwarz?.text) markTextsSeen([schwarz.text]);
  }, [schwarz?.text]);

  // Die Frist lässt der HOST ablaufen, sonst schicken zehn Geräte dieselbe
  // Aktion. Der Reducer prüft die Zeit trotzdem selbst.
  useEffect(() => {
    if (!isHost || state.phase !== 'submit' || state.deadline === null) return;
    const t = setInterval(() => {
      if (Date.now() >= state.deadline!) send({ type: 'timeout' });
    }, 250);
    return () => clearInterval(t);
  }, [isHost, state.phase, state.deadline]);

  // Verschwindet der Richter, verwirft der Host die Runde. Ohne diesen
  // Wecker wartet die ganze Gruppe auf jemanden, der nicht wiederkommt.
  useEffect(() => {
    if (!isHost || state.phase === 'over') return;
    const t = setInterval(() => {
      const r = players.find((p) => p.id === state.judgeId);
      if (!r || r.online === false) send({ type: 'judge-left' });
    }, 2000);
    return () => clearInterval(t);
  }, [isHost, state.phase, state.judgeId, players]);

  useEffect(() => {
    setGewaehlt([]);
  }, [state.round, state.black, state.phase]);

  if (!online) {
    return (
      <GameFrame title={meta.name} accent={meta.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Lückenfüller lebt davon, dass niemand die Hand der anderen sieht. Startet dafür eine
          Online-Lobby – dann legt jede Person auf ihrem eigenen Handy.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  if (state.phase === 'over') {
    const rows = players.map((p) => ({ player: p, value: state.scores[p.id] ?? 0, unit: 'Punkt' }));
    const werte = rows.map((r) => r.value);
    const best = werte.length ? Math.max(...werte) : 0;
    const schlecht = werte.length ? Math.min(...werte) : 0;
    const sieger = rows.filter((r) => r.value === best);
    const letzte = rows.filter((r) => r.value === schlecht).map((r) => r.player);
    return (
      <GameFrame title={meta.name} accent={meta.accent} subtitle="Ausgespielt" onQuit={quit}>
        <GameOver
          headline={
            sieger.length === 1
              ? `${state.round - 1} Runden. ${sieger[0].player.name} hat die meisten Lücken gefüllt.`
              : `${state.round - 1} Runden. An der Spitze bleibt es unentschieden.`
          }
          ranking={rows}
          rankingTitle="Die meisten Punkte"
          finalCall={
            best > schlecht
              ? { players: letzte, baseSips: 4, label: 'die wenigsten Punkte', source: 'lueckenfueller' }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  const richterName = byId(state.judgeId)?.name ?? 'Der Richter';
  const kopf = (
    <BigCard kicker={`Runde ${state.round}${state.goal ? ` von ${state.goal}` : ''}`}>
      {schwarz?.text ?? ''}
    </BigCard>
  );

  if (state.phase === 'submit') {
    const abgegeben = !!state.played[me.id];
    const fehlen = dabei.filter((id) => !state.played[id]).map((id) => byId(id)?.name ?? '');

    return (
      <GameFrame
        title={meta.name}
        accent={meta.accent}
        subtitle={
          state.deadline !== null ? <Countdown until={state.deadline} /> : `${richterName} richtet`
        }
        onQuit={quit}
      >
        {kopf}

        {bin.richter ? (
          <>
            <div className="notice notice--orange">
              Du bist der Richter. Lies die Lücke laut vor – du entscheidest gleich.
            </div>
            <div className="t-headline t-center">
              {dabei.length - fehlen.length} von {dabei.length} haben gelegt
            </div>
            <WaitingFor names={fehlen} what="Legen gerade" />
          </>
        ) : abgegeben ? (
          <WaitingFor names={fehlen} what="Fehlen noch" />
        ) : (
          <>
            <div className="t-caption t-center">
              {state.pick === 2 ? 'Zwei Karten, die Reihenfolge zählt' : 'Eine Karte'}
            </div>
            <div className="lf-hand">
              {hand.map((ref) => {
                const platz = gewaehlt.indexOf(ref);
                return (
                  <button
                    key={ref}
                    className={`lf-card ${platz >= 0 ? 'lf-card--picked' : ''}`}
                    onClick={() => {
                      haptic('select');
                      setGewaehlt((prev) =>
                        prev.includes(ref)
                          ? prev.filter((r) => r !== ref)
                          : prev.length >= state.pick
                            ? [...prev.slice(1), ref]
                            : [...prev, ref],
                      );
                    }}
                  >
                    {state.pick === 2 && platz >= 0 && <span className="lf-card__no">{platz + 1}</span>}
                    {whiteText(state, ref)}
                  </button>
                );
              })}
            </div>
            <button
              className="btn btn--brand btn--block btn--lg"
              disabled={gewaehlt.length !== state.pick}
              onClick={() => {
                haptic('success');
                send({ type: 'submit', cards: gewaehlt });
              }}
            >
              {gewaehlt.length === state.pick ? 'Legen' : `Noch ${state.pick - gewaehlt.length} wählen`}
            </button>
          </>
        )}
      </GameFrame>
    );
  }

  if (state.phase === 'reveal') {
    const offen = state.order.slice(0, state.revealed);
    const alleOffen = state.revealed >= state.order.length;
    return (
      <GameFrame
        title={meta.name}
        accent={meta.accent}
        subtitle={`${richterName} deckt auf`}
        onQuit={quit}
      >
        {kopf}
        <div className="stack-2">
          {offen.map((id) => (
            <button
              key={id}
              className="lf-answer"
              disabled={!bin.richter || !alleOffen}
              onClick={() => {
                haptic('success');
                send({ type: 'pick-winner', target: id });
              }}
            >
              {capitalize(fill(schwarz?.text ?? '', state.played[id].map((r) => whiteText(state, r))))}
            </button>
          ))}
        </div>
        {bin.richter ? (
          !alleOffen ? (
            <button
              className="btn btn--brand btn--block btn--lg"
              onClick={() => {
                haptic('tap');
                send({ type: 'flip' });
              }}
            >
              {state.revealed === 0 ? 'Erste aufdecken' : 'Nächste aufdecken'}
            </button>
          ) : (
            <div className="notice">Tipp die beste an.</div>
          )
        ) : (
          <div className="t-caption t-center">
            {alleOffen ? `${richterName} entscheidet` : `${richterName} liest vor`}
          </div>
        )}
      </GameFrame>
    );
  }

  // phase === 'score'
  const gewinner = byId(state.winnerId ?? '');
  const verlierer = players.filter(
    (p) => p.online !== false && p.id !== state.winnerId && p.id !== state.judgeId,
  );
  return (
    <GameFrame title={meta.name} accent={meta.accent} subtitle={`${gewinner?.name} gewinnt`} onQuit={quit}>
      <BigCard kicker={`${gewinner?.name} macht den Punkt`} tone="accent">
        {capitalize(
          fill(
            schwarz?.text ?? '',
            (state.played[state.winnerId ?? ''] ?? []).map((r) => whiteText(state, r)),
          ),
        )}
      </BigCard>
      <DrinkCallList
        players={verlierer}
        baseSips={1}
        label="nicht gewonnen"
        source="lueckenfueller"
        resetKey={state.round}
      />
      <button
        className="btn btn--brand btn--block btn--lg"
        onClick={() => {
          haptic('tap');
          send({ type: 'next' });
        }}
      >
        Nächste Runde
      </button>
    </GameFrame>
  );
}
