import { useEffect, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import { DrinkCallList } from '../shared/DrinkCall';
import { BigCard, RankTag } from '../shared/pieces';
import { isOver } from '../shared/rounds';
import type { GameActionInput, GamePlayer } from '../types';
import { creators, type State } from './game';
import { MemeLightbox, type LightboxEntry } from './Lightbox';
import { MemeImage, MemePrint, PointsBadge } from './Meme';
import { CountTo, SaveMeme, Tally, TopicNote, tallyOf, tiltFor } from './parts';
import { templateOf } from './templates';

/**
 * Auflösung einer Runde: das Meme der Runde groß, darunter der Rest des
 * Stapels mit Namen, dann Punktestand und wer trinkt.
 *
 * Alles kommt gestaffelt herein – erst der Gewinner, dann wird das Etikett
 * aufgeklebt, dann fallen die übrigen Abzüge auf den Tisch.
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
  const [open, setOpen] = useState<LightboxEntry | null>(null);
  const relaxed = state.options.mode === 'entspannt';
  const byId = (id: string) => players.find((p) => p.id === id);
  const nameOf = (id: string) =>
    id === me.id ? 'Du' : (byId(id)?.name ?? state.names[id] ?? 'Weg');
  const ranked = [...state.order].sort((a, b) => (state.points[b] ?? 0) - (state.points[a] ?? 0));
  const best = ranked[0];
  const rest = ranked.slice(1);
  const last = isOver(state.round + 1, state.goal);

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

  // Gewonnen fühlt sich anders an als erwischt – und beides anders als zuschauen.
  const iLost = losers.includes(me.id) || noShows.includes(me.id);
  useEffect(() => {
    haptic(relaxed ? 'press' : best === me.id ? 'success' : iLost ? 'warn' : 'press');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal je Auflösung
  }, [state.round]);

  const next = (
    <button
      className="btn btn--brand btn--block btn--lg md-rise"
      style={{ ['--i' as string]: 6 }}
      onClick={() => {
        haptic('press');
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
  const bestCaption = `${byId(best)?.name ?? state.names[best] ?? ''} · Runde ${state.round}`;
  const rows = players
    .filter((p) => state.scores[p.id] !== undefined || state.points[p.id] !== undefined)
    .map((p) => {
      const gain =
        (state.points[p.id] ?? 0) + (state.bonus[p.id] ?? 0) + (state.riderPts[p.id] ?? 0);
      return {
        p,
        total: state.scores[p.id] ?? 0,
        gain,
        meme: state.points[p.id],
        ride: state.bonus[p.id],
        riders: state.riderPts[p.id],
      };
    })
    .sort((a, b) => b.total - a.total);

  const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

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
            !relaxed ? <PointsBadge points={state.points[best] ?? 0} tone="gold" slap /> : undefined
          }
        >
          {bestTemplate && <MemeImage template={bestTemplate} texts={bestMeme.x} />}
        </MemePrint>
        <div className="row-between md-hero__meta md-rise" style={{ ['--i' as string]: 1 }}>
          <Tally {...tallyOf(state.votes[best])} />
          <SaveMeme meme={bestMeme} caption={bestCaption} />
        </div>
      </div>

      {rest.length > 0 && (
        <div className="md-stack">
          {rest.map((id, i) => {
            const m = state.memes[id];
            const t = templateOf(m?.t);
            const caption = nameOf(id);
            const badge = !relaxed ? <PointsBadge points={state.points[id] ?? 0} /> : undefined;
            return (
              <div
                key={id}
                className="md-stack__item md-deal"
                style={{
                  ['--i' as string]: i,
                  ['--tilt' as string]: `${tiltFor(id + state.round)}deg`,
                }}
              >
                <MemePrint
                  tilt={tiltFor(id + state.round)}
                  stamp={false}
                  caption={caption}
                  badge={badge}
                  ar={t ? t.w / t.h : undefined}
                  onOpen={() => {
                    haptic('tap');
                    setOpen({
                      meme: m,
                      caption: `${caption} · Runde ${state.round}`,
                      badge,
                      footer: <Tally {...tallyOf(state.votes[id])} />,
                    });
                  }}
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
            <div
              key={r.p.id}
              className={`result-row md-row md-rise ${r.p.id === me.id ? 'md-row--me' : ''}`}
              style={{ ['--i' as string]: i + 2 }}
            >
              <RankTag place={i + 1} />
              <Avatar name={r.p.name} color={r.p.color} photo={r.p.photo} size="sm" />
              <div className="grow">
                <div className="t-headline">{r.p.id === me.id ? 'Du' : r.p.name}</div>
                <div className="md-breakdown t-mono-num">
                  <span>{r.meme !== undefined ? `Meme ${signed(r.meme)}` : 'kein Meme'}</span>
                  {r.ride !== undefined && <span>Trittbrett {signed(r.ride)}</span>}
                  {r.riders !== undefined && <span>Mitfahrer {signed(r.riders)}</span>}
                </div>
              </div>
              <div className="md-score-col">
                <div className="t-mono-num md-score">
                  <CountTo from={r.total - r.gain} to={r.total} feel={r.p.id === me.id} />
                </div>
                {r.gain !== 0 && (
                  <div className={`md-gain t-mono-num ${r.gain < 0 ? 'md-gain--neg' : ''}`}>
                    {signed(r.gain)}
                  </div>
                )}
              </div>
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

      <MemeLightbox entry={open} onClose={() => setOpen(null)} />
    </div>
  );
}
