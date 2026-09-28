import { useEffect } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard } from '../shared/pieces';
import { isOver } from '../shared/rounds';
import type { GameActionInput, GamePlayer } from '../types';
import { creators, type State } from './game';
import { MemeImage, MemePrint, PointsBadge } from './Meme';
import { SaveMeme, Tally, TopicNote, tallyOf, tiltFor } from './parts';
import { templateOf } from './templates';

/**
 * Auflösung einer Runde: das Meme der Runde groß, darunter der Rest des
 * Stapels mit Namen, dann Punktestand und wer trinkt.
 */
export function Results({
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
  const relaxed = state.options.mode === 'entspannt';
  const byId = (id: string) => players.find((p) => p.id === id);
  const nameOf = (id: string) => (id === me.id ? 'Du' : (byId(id)?.name ?? 'Weg'));
  const ranked = [...state.order].sort((a, b) => (state.points[b] ?? 0) - (state.points[a] ?? 0));
  const best = ranked[0];
  const rest = ranked.slice(1);
  const last = isOver(state.round + 1, state.goal);

  useEffect(() => {
    haptic(best === me.id ? 'success' : 'tap');
  }, [best, me.id]);

  // --- Wer trinkt ---
  const values = ranked.map((id) => state.points[id] ?? 0);
  const top = values.length ? Math.max(...values) : 0;
  const low = values.length ? Math.min(...values) : 0;
  const losers = top > low ? ranked.filter((id) => (state.points[id] ?? 0) === low) : [];
  const noShows = creators(state, players).filter((id) => !state.memes[id]);
  const wrongHorse = Object.entries(state.riders)
    .filter(([, author]) => (state.points[author] ?? 0) < 0)
    .map(([rider]) => rider);
  const asPlayers = (ids: string[]) => ids.map(byId).filter(Boolean) as GamePlayer[];

  const next = (
    <button
      className="btn btn--brand btn--block btn--lg"
      onClick={() => {
        haptic('tap');
        dispatch({ type: 'next' });
      }}
    >
      {last ? 'Zum Finale' : 'Nächste Runde'}
    </button>
  );

  if (!best) {
    return (
      <div className="stack-3">
        <BigCard kicker={`Runde ${state.round}`}>
          Kein einziges Meme. Die Uhr war schneller als alle.
        </BigCard>
        {!relaxed && (
          <DrinkCallList
            players={asPlayers(noShows)}
            baseSips={2}
            label="kein Meme abgegeben"
            source="meme-battle"
            resetKey={`${state.round}-none`}
          />
        )}
        {next}
      </div>
    );
  }

  const bestMeme = state.memes[best];
  const bestTemplate = templateOf(bestMeme?.t);
  const bestCaption = `${byId(best)?.name ?? ''} · Runde ${state.round}`;
  const rows = players
    .filter((p) => state.scores[p.id] !== undefined || state.points[p.id] !== undefined)
    .map((p) => ({
      p,
      total: state.scores[p.id] ?? 0,
      gain: state.points[p.id],
      bonus: state.bonus[p.id],
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="md-results stack">
      {topic && <TopicNote text={topic} />}

      <div className="md-hero">
        <div className="md-hero__kicker">
          {best === me.id ? 'Dein Meme gewinnt die Runde' : 'Meme der Runde'}
        </div>
        <MemePrint
          className="md-print--winner"
          tilt={-2}
          ar={bestTemplate ? bestTemplate.w / bestTemplate.h : undefined}
          caption={nameOf(best)}
          badge={
            !relaxed ? <PointsBadge points={state.points[best] ?? 0} tone="gold" /> : undefined
          }
        >
          {bestTemplate && <MemeImage template={bestTemplate} texts={bestMeme.x} />}
        </MemePrint>
        <div className="row-between md-hero__meta">
          <Tally {...tallyOf(state.votes[best])} />
          <SaveMeme meme={bestMeme} caption={bestCaption} />
        </div>
      </div>

      {rest.length > 0 && (
        <div className="md-stack">
          {rest.map((id) => {
            const m = state.memes[id];
            const t = templateOf(m?.t);
            return (
              <div key={id} className="md-stack__item">
                <MemePrint
                  tilt={tiltFor(id + state.round)}
                  stamp={false}
                  caption={nameOf(id)}
                  badge={!relaxed ? <PointsBadge points={state.points[id] ?? 0} /> : undefined}
                >
                  {t && <MemeImage template={t} texts={m.x} />}
                </MemePrint>
                <Tally {...tallyOf(state.votes[id])} />
              </div>
            );
          })}
        </div>
      )}

      {!relaxed && (
        <div className="stack-2">
          <div className="t-upper t-center">Punktestand</div>
          {rows.map((r, i) => (
            <div key={r.p.id} className={`result-row ${r.p.id === me.id ? 'md-row--me' : ''}`}>
              <div className="result-row__rank">{i + 1}</div>
              <Avatar name={r.p.name} color={r.p.color} photo={r.p.photo} size="sm" />
              <div className="grow">
                <div className="t-headline">{r.p.id === me.id ? 'Du' : r.p.name}</div>
                <div className="t-caption">
                  {r.gain !== undefined
                    ? `${r.gain >= 0 ? '+' : '−'}${Math.abs(r.gain)} fürs Meme`
                    : 'kein Meme'}
                  {r.bonus !== undefined &&
                    ` · ${r.bonus >= 0 ? '+' : '−'}${Math.abs(r.bonus)} Trittbrett`}
                </div>
              </div>
              <div className="t-mono-num md-score">{r.total}</div>
            </div>
          ))}
        </div>
      )}

      {!relaxed && (
        <div className="stack-3">
          {losers.length > 0 && (
            <DrinkCallList
              players={asPlayers(losers)}
              baseSips={low < 0 ? 4 : 3}
              label={low < 0 ? 'Minuspunkte' : 'schwächstes Meme'}
              source="meme-battle"
              resetKey={`${state.round}-low`}
            />
          )}
          {noShows.length > 0 && (
            <DrinkCallList
              players={asPlayers(noShows)}
              baseSips={2}
              label="kein Meme abgegeben"
              source="meme-battle"
              resetKey={`${state.round}-none`}
            />
          )}
          {wrongHorse.length > 0 && (
            <DrinkCallList
              players={asPlayers(wrongHorse)}
              baseSips={1}
              label="aufs falsche Trittbrett gesprungen"
              source="meme-battle"
              resetKey={`${state.round}-ride`}
            />
          )}
        </div>
      )}

      {next}
    </div>
  );
}
