import { useEffect } from 'react';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import type { GameActionInput, GamePlayer } from '../types';
import { currentAuthor, votersFor, VOTE_MS, type State, type Vote } from './game';
import { Label, MemeImage, MemePrint } from './Meme';
import { SaveMeme, TimerBar, TopicNote, tiltFor } from './parts';
import { ReactionBar, ReactionLayer } from './Reactions';
import { templateOf } from './templates';

const CHOICES: {
  value: Vote;
  label: string;
  icon: 'flame' | 'minus' | 'arrowDown';
  tone: string;
}[] = [
  { value: -1, label: 'Lame', icon: 'arrowDown', tone: 'down' },
  { value: 0, label: 'OK', icon: 'minus', tone: 'meh' },
  { value: 1, label: 'Fire', icon: 'flame', tone: 'up' },
];

/**
 * Abstimmen: ein Meme nach dem anderen, auf allen Handys gleichzeitig und
 * ohne Namen. Wer es gebaut hat, sieht nur „Pokerface".
 */
export function VoteView({
  state,
  players,
  me,
  topic,
  dispatch,
}: {
  state: State;
  players: GamePlayer[];
  me: GamePlayer;
  topic: string | null;
  dispatch: (a: GameActionInput) => void;
}) {
  const author = currentAuthor(state);
  const meme = author ? state.memes[author] : undefined;
  const template = templateOf(meme?.t);
  const mineIsUp = author === me.id;
  const myVote = author ? state.votes[author]?.[me.id] : undefined;
  const riding = state.riders[me.id];
  const canRide =
    state.options.trittbrett && state.options.mode !== 'entspannt' && !mineIsUp && !riding;
  const cast = author ? Object.keys(state.votes[author] ?? {}).length : 0;
  const voters = author ? votersFor(players, author).length : 0;

  // Jedes neue Meme ist ein Anschlag: das erste der Runde kräftig (die
  // Abstimmung beginnt), das eigene spürbar anders als die fremden.
  useEffect(() => {
    haptic(state.showing === 0 ? 'heavy' : mineIsUp ? 'press' : 'tap');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal je Meme
  }, [state.round, state.showing]);

  if (!author || !meme) return null;

  return (
    <div className="md-vote stack-3">
      <div className="md-vote__head">
        <span className="t-upper">
          Meme {state.showing + 1} von {state.order.length}
        </span>
        {state.deadline !== null && (
          <TimerBar key={state.deadline} until={state.deadline} total={VOTE_MS} />
        )}
        <SaveMeme meme={meme} caption={`Meme-Duell · Runde ${state.round}`} compact />
      </div>

      {topic && <TopicNote text={topic} />}

      <div className="md-vote__stage">
        <MemePrint
          key={`${state.round}-${state.showing}`}
          className="md-print--develop"
          tilt={tiltFor(author + state.round, 2)}
          ar={template ? template.w / template.h : undefined}
          caption={mineIsUp ? 'Dein Meme · Pokerface' : 'Anonym'}
          badge={
            riding === author ? (
              <Label tone="mint" icon="bus">
                Mit dabei
              </Label>
            ) : undefined
          }
        >
          {template ? (
            <MemeImage template={template} texts={meme.x} />
          ) : (
            <div className="md-missing">{meme.x.filter(Boolean).join(' / ')}</div>
          )}
        </MemePrint>
        {/* Auf dem eigenen Meme spürt man jede Reaktion – die Lacher der anderen. */}
        <ReactionLayer
          key={`fx-${state.round}-${state.showing}`}
          reactions={state.reactions}
          feel={mineIsUp}
        />
      </div>

      {mineIsUp ? (
        <div className="notice notice--neutral t-center">
          Das ist deins. Keine Miene verziehen – niemand weiß es.
        </div>
      ) : (
        <div className="md-votebar" role="group" aria-label="Wie findest du das Meme?">
          {CHOICES.map((c) => (
            <button
              key={c.value}
              className={`md-votebtn md-votebtn--${c.tone}`}
              aria-pressed={myVote === c.value}
              onClick={() => {
                haptic(c.value === 1 ? 'success' : c.value === -1 ? 'press' : 'select');
                dispatch({ type: 'vote', target: author, value: c.value });
              }}
            >
              <Icon name={c.icon} size={26} strokeWidth={2.2} />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      )}

      <ReactionBar dispatch={dispatch} />

      {state.options.trittbrett && state.options.mode !== 'entspannt' && !mineIsUp && (
        <button
          className={`md-ride ${riding === author ? 'md-ride--on' : ''}`}
          disabled={!canRide}
          onClick={() => {
            haptic('heavy');
            dispatch({ type: 'ride', target: author });
          }}
        >
          <Icon name="bus" size={20} />
          <span className="grow">
            <span className="md-ride__title">
              {riding === author
                ? 'Du fährst auf diesem Meme mit'
                : riding
                  ? 'Trittbrett ist für diese Runde vergeben'
                  : 'Aufs Trittbrett springen'}
            </span>
            <span className="md-ride__sub">
              Halbe Punkte dieses Memes gehen an dich – auch ein halbes Minus. Einmal je Runde.
            </span>
          </span>
        </button>
      )}

      <div className="md-dots" aria-label={`${cast} von ${voters} haben abgestimmt`}>
        {Array.from({ length: voters }, (_, i) => (
          <span key={i} className={`md-dot ${i < cast ? 'md-dot--on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
