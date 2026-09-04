import { haptic } from '../../lib/haptics';
import { spicyDeck } from '../shared/prompts';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, VoteGrid, VoteResult, WaitingFor } from '../shared/pieces';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { meta } from './meta';

interface Prompt {
  text: string;
  spicy?: boolean;
}

const PROMPTS: Prompt[] = [
  { text: 'Wer aus der Runde verpasst am ehesten den Flug?' },
  { text: 'Wer würde am ehesten seinen eigenen Geburtstag vergessen?' },
  { text: 'Wer redet im Schlaf?' },
  { text: 'Wer würde am ehesten eine Sekte gründen?' },
  { text: 'Wer schreibt die längsten Sprachnachrichten?' },
  { text: 'Wer würde bei einer Zombie-Apokalypse zuerst draufgehen?' },
  { text: 'Wer hat den chaotischsten Kleiderschrank?' },
  { text: 'Wer würde am ehesten aus Versehen die Polizei rufen?' },
  { text: 'Wer wird als Erstes heiraten?' },
  { text: 'Wer könnte am längsten ohne Handy überleben?' },
  { text: 'Wer würde am ehesten für Geld im Fernsehen auftreten?' },
  { text: 'Wer hat die peinlichste Musik auf dem Handy?' },
  { text: 'Wer weint am ehesten bei einem Film?' },
  { text: 'Wer würde am ehesten einen Marathon spontan mitlaufen?' },
  { text: 'Wer kommt immer zu spät?' },
  { text: 'Wer würde am ehesten ein Haustier nach sich selbst benennen?' },
  { text: 'Wer könnte am besten lügen, ohne rot zu werden?' },
  { text: 'Wer würde am ehesten in eine Touristenfalle tappen?' },
  { text: 'Wer gibt am meisten Geld für Unnötiges aus?' },
  { text: 'Wer wäre der beste Tatort-Kommissar?' },
  { text: 'Wer hat den schlechtesten Orientierungssinn?' },
  { text: 'Wer würde am ehesten seinen Chef versehentlich duzen?' },
  { text: 'Wer wird heute Abend als Erstes müde?' },
  { text: 'Wer würde am ehesten mit Fremden auf einer Hochzeit landen?' },
  { text: 'Wer hat die meisten ungelesenen Mails?' },
  { text: 'Wer würde am ehesten eine Wette verlieren und trotzdem behaupten zu gewinnen?' },
  { text: 'Wer wäre am ehesten in einer Reality-Show?' },
  { text: 'Wer räumt nach der Party auf?' },
  { text: 'Wer erzählt dieselbe Geschichte am häufigsten?' },
  { text: 'Wer würde am ehesten seinen Schlüssel im Kühlschrank finden?' },
  { text: 'Wer ist heimlich am ehrgeizigsten?' },
  { text: 'Wer würde am ehesten ohne Plan auswandern?' },

  // Spicy – nur im Stapel, wenn der Schalter an ist.
  { text: 'Wer flirtet am ehesten mit der Bedienung?', spicy: true },
  { text: 'Wer hat den mutigsten Anmachspruch drauf?', spicy: true },
  { text: 'Wer würde am ehesten den Ex zurücknehmen?', spicy: true },
  { text: 'Wer verliebt sich am schnellsten?', spicy: true },
  { text: 'Wer hat die meisten ungelesenen Dating-Nachrichten?', spicy: true },
  { text: 'Wer würde am ehesten eine Fernbeziehung wirklich durchziehen?', spicy: true },
  { text: 'Wer hat den peinlichsten Flirt-Move?', spicy: true },
  { text: 'Wer würde auf einer fremden Hochzeit als Erstes tanzen?', spicy: true },
  { text: 'Wer ist heimlich in jemanden aus dem Freundeskreis verliebt?', spicy: true },
  { text: 'Wer würde am ehesten eine Nummer auf einen Bierdeckel schreiben?', spicy: true },
];

interface State {
  phase: 'vote' | 'result' | 'over';
  prompt: number;
  deck: number[];
  votes: Record<string, string>;
  round: number;
  /** Ziellinie in Fragen. `null` heißt: ohne Ende. */
  goal: number | null;
  /** Stimmen über die ganze Partie, aus allen ausgezählten Runden. */
  tally: Record<string, number>;
}

export const mostLikely: GameDefinition<State> = {
  ...meta,

  createState: () => {
    const deck = spicyDeck(PROMPTS, 'most-likely');
    return {
      phase: 'vote',
      prompt: deck[0],
      deck: deck.slice(1),
      votes: {},
      round: 1,
      // Eine Runde ist eine Frage. Sechs davon reichen, damit jeder ein paar
      // Mal gemeint war, bevor sich die Fragen abnutzen.
      goal: roundGoal(baseFor('most-likely')),
      tally: {},
    };
  },

  reduce: (state, action, players) => {
    const active = players.filter((p) => p.online !== false).map((p) => p.id);
    switch (action.type) {
      case 'vote': {
        if (state.phase !== 'vote') return state;
        const votes = { ...state.votes, [action.by]: String(action.target) };
        const done = active.every((id) => votes[id]);
        if (!done) return { ...state, votes };
        // Die Runde ist ausgezählt – erst jetzt zählen ihre Stimmen für die Wertung.
        const tally = { ...state.tally };
        for (const id of Object.values(votes)) tally[id] = (tally[id] ?? 0) + 1;
        return { ...state, votes, phase: 'result', tally };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'result') return state;
        const deck = state.deck.length ? state.deck : spicyDeck(PROMPTS, 'most-likely');
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
        return {
          ...state,
          phase: 'vote',
          prompt: deck[0],
          deck: deck.slice(1),
          votes: {},
          round,
        };
      }
      case 'restart':
        return mostLikely.createState(players);
      default:
        return state;
    }
  },

  Component: MostLikelyGame,
};

function MostLikelyGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const prompt = PROMPTS[state.prompt]?.text ?? '';

  if (!online) {
    return (
      <GameFrame title={mostLikely.name} accent={mostLikely.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Der Reiz liegt darin, dass niemand sieht, wer wen wählt. Startet dafür eine Online-Lobby.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  if (state.phase === 'over') {
    const ranking = players.map((p) => ({
      player: p,
      value: state.tally[p.id] ?? 0,
      unit: 'Stimme',
    }));
    const most = Math.max(0, ...ranking.map((r) => r.value));
    const named = ranking.filter((r) => r.value === most).map((r) => r.player);
    return (
      <GameFrame
        title={mostLikely.name}
        accent={mostLikely.accent}
        subtitle="Ausgezählt"
        onQuit={quit}
      >
        <GameOver
          headline={
            most > 0
              ? `${state.round - 1} Fragen ausgezählt. Oben steht, wer am häufigsten gemeint war.`
              : `${state.round - 1} Fragen – und keine einzige Stimme. Auch eine Aussage.`
          }
          ranking={most > 0 ? ranking : undefined}
          rankingTitle="Wer am häufigsten gemeint war"
          rankHighIsBad
          finalCall={
            most > 0
              ? {
                  players: named,
                  baseSips: 4,
                  label: 'am häufigsten gemeint',
                  source: 'most-likely',
                }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  if (state.phase === 'vote') {
    const waiting = players.filter((p) => p.online !== false && !state.votes[p.id]).map((p) => p.name);
    return (
      <GameFrame
        title={mostLikely.name}
        accent={mostLikely.accent}
        subtitle={
          state.goal
            ? `Runde ${Math.min(state.round, state.goal)}/${state.goal}`
            : `Runde ${state.round}`
        }
        onQuit={quit}
      >
        <BigCard kicker="Zeigt auf">{prompt}</BigCard>
        <VoteGrid
          players={players}
          myVote={state.votes[me.id]}
          onVote={(id) => {
            haptic('select');
            send({ type: 'vote', target: id });
          }}
        />
        {state.votes[me.id] && <WaitingFor names={waiting} what="Warten auf" />}
      </GameFrame>
    );
  }

  const counts: Record<string, number> = {};
  for (const t of Object.values(state.votes)) counts[t] = (counts[t] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const winners = players.filter((p) => (counts[p.id] ?? 0) === max && max > 0);

  return (
    <GameFrame
      title={mostLikely.name}
      accent={mostLikely.accent}
      subtitle="Aufgedeckt"
      onQuit={quit}
    >
      <BigCard kicker="Ergebnis">{prompt}</BigCard>
      <VoteResult players={players} counts={counts} highlight={winners[0]?.id ?? null} />
      <DrinkCallList
        players={winners as GamePlayer[]}
        baseSips={Math.min(6, 1 + max)}
        source="most-likely"
        label="pro Stimme"
        resetKey={state.round}
      />
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Frage'}
      </button>
    </GameFrame>
  );
}
