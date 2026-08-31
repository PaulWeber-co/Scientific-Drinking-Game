import { haptic } from '../../lib/haptics';
import { shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, VoteGrid, VoteResult, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';

const PROMPTS = [
  'Wer aus der Runde verpasst am ehesten den Flug?',
  'Wer würde am ehesten seinen eigenen Geburtstag vergessen?',
  'Wer redet im Schlaf?',
  'Wer würde am ehesten eine Sekte gründen?',
  'Wer schreibt die längsten Sprachnachrichten?',
  'Wer würde bei einer Zombie-Apokalypse zuerst draufgehen?',
  'Wer hat den chaotischsten Kleiderschrank?',
  'Wer würde am ehesten aus Versehen die Polizei rufen?',
  'Wer wird als Erstes heiraten?',
  'Wer könnte am längsten ohne Handy überleben?',
  'Wer würde am ehesten für Geld im Fernsehen auftreten?',
  'Wer hat die peinlichste Musik auf dem Handy?',
  'Wer weint am ehesten bei einem Film?',
  'Wer würde am ehesten einen Marathon spontan mitlaufen?',
  'Wer kommt immer zu spät?',
  'Wer würde am ehesten ein Haustier nach sich selbst benennen?',
  'Wer könnte am besten lügen, ohne rot zu werden?',
  'Wer würde am ehesten in eine Touristenfalle tappen?',
  'Wer gibt am meisten Geld für Unnötiges aus?',
  'Wer wäre der beste Tatort-Kommissar?',
  'Wer hat den schlechtesten Orientierungssinn?',
  'Wer würde am ehesten seinen Chef versehentlich duzen?',
  'Wer wird heute Abend als Erstes müde?',
  'Wer würde am ehesten mit Fremden auf einer Hochzeit landen?',
  'Wer hat die meisten ungelesenen Mails?',
  'Wer würde am ehesten eine Wette verlieren und trotzdem behaupten zu gewinnen?',
  'Wer wäre am ehesten in einer Reality-Show?',
  'Wer räumt nach der Party auf?',
  'Wer erzählt dieselbe Geschichte am häufigsten?',
  'Wer würde am ehesten seinen Schlüssel im Kühlschrank finden?',
  'Wer ist heimlich am ehrgeizigsten?',
  'Wer würde am ehesten ohne Plan auswandern?',
];

interface State {
  phase: 'vote' | 'result';
  prompt: number;
  deck: number[];
  votes: Record<string, string>;
  round: number;
}

export const mostLikely: GameDefinition<State> = {
  id: 'most-likely',
  name: 'Wer aus der Runde',
  tagline: 'Alle zeigen gleichzeitig. Meiste Stimmen trinkt.',
  icon: 'people',
  accent: 'var(--orange)',
  minPlayers: 4,
  maxPlayers: 16,
  duration: '10-20 Min',
  intensity: 2,
  tags: ['geheim', 'schnell', 'reden'],
  requiresOwnDevice: true,
  howTo: [
    'Jede Person braucht ihr eigenes Handy – niemand soll sehen, wer wen wählt.',
    'Frage lesen, tippen. Erst wenn alle gewählt haben, wird aufgedeckt.',
    'Wer die meisten Stimmen bekommt, trinkt pro Stimme.',
  ],

  createState: () => {
    const deck = shuffle(PROMPTS.map((_, i) => i));
    return { phase: 'vote', prompt: deck[0], deck: deck.slice(1), votes: {}, round: 1 };
  },

  reduce: (state, action, players) => {
    const active = players.filter((p) => p.online !== false).map((p) => p.id);
    switch (action.type) {
      case 'vote': {
        if (state.phase !== 'vote') return state;
        const votes = { ...state.votes, [action.by]: String(action.target) };
        const done = active.every((id) => votes[id]);
        return { ...state, votes, phase: done ? 'result' : 'vote' };
      }
      case 'next': {
        const deck = state.deck.length ? state.deck : shuffle(PROMPTS.map((_, i) => i));
        return {
          phase: 'vote',
          prompt: deck[0],
          deck: deck.slice(1),
          votes: {},
          round: state.round + 1,
        };
      }
      default:
        return state;
    }
  },

  Component: MostLikelyGame,
};

function MostLikelyGame({ state, players, me, dispatch, quit, online }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const prompt = PROMPTS[state.prompt];

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

  if (state.phase === 'vote') {
    const waiting = players.filter((p) => p.online !== false && !state.votes[p.id]).map((p) => p.name);
    return (
      <GameFrame
        title={mostLikely.name}
        accent={mostLikely.accent}
        subtitle={`Runde ${state.round}`}
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
      />
      <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
        Nächste Frage
      </button>
    </GameFrame>
  );
}
