import { useEffect, useMemo } from 'react';
import { Icon } from '../../components/icons';
import { Avatar } from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import { GameOver } from '../shared/GameOver';
import type { GamePlayer, GameRuntime } from '../types';
import type { State, Tally } from './game';
import { MemeImage, MemePrint, PointsBadge } from './Meme';
import { SaveMeme, tiltFor } from './parts';
import { templateOf } from './templates';

const NO_TALLY: Tally = { meme: 0, ride: 0, riders: 0 };
const PLACE_LABEL = ['1.', '2.', '3.'];

/**
 * Ende der Partie – aufgebaut wie im Vorbild: oben das Podest, darunter der
 * Endstand mit der Herkunft der Punkte, dann Trinkansage und Knöpfe, und
 * ganz unten jedes Meme der Partie, vom besten bis zum schwächsten.
 */
export function Finale({ state, players, me, dispatch, quit }: GameRuntime<State>) {
  const relaxed = state.options.mode === 'entspannt';
  const nameOf = (id: string) =>
    id === me.id ? 'Du' : (players.find((p) => p.id === id)?.name ?? state.names[id] ?? 'Weg');

  // Auch wer gegangen ist, steht im Endstand – mit dem Namen aus dem Spielstand.
  const rows = useMemo(() => {
    const ids = new Set([...Object.keys(state.scores), ...Object.keys(state.totals)]);
    return [...ids]
      .map((id) => {
        const player: GamePlayer = players.find((p) => p.id === id) ?? {
          id,
          name: state.names[id] ?? 'Weg',
          color: 'indigo',
          online: false,
        };
        return {
          player,
          value: state.scores[id] ?? 0,
          tally: state.totals[id] ?? NO_TALLY,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [state.scores, state.totals, state.names, players]);

  const best = rows[0]?.value ?? 0;
  const worst = rows[rows.length - 1]?.value ?? 0;
  const winners = rows.filter((r) => r.value === best);
  const losers = rows.filter((r) => r.value === worst).map((r) => r.player);
  const iWon = winners.some((w) => w.player.id === me.id);
  const rounds = state.round - 1;
  const sorted = [...state.history].sort((a, b) => b.p - a.p);

  useEffect(() => {
    haptic(iWon ? 'success' : 'heavy');
  }, [iWon]);

  const headline = relaxed
    ? `${rounds} Runden, ${state.history.length} Memes.`
    : winners.length === 1
      ? `${winners[0].player.id === me.id ? 'Du bist' : `${winners[0].player.name} ist`} Meme-Champion mit ${best} Punkten.`
      : `Geteilter Titel: ${winners.map((w) => (w.player.id === me.id ? 'Du' : w.player.name)).join(' und ')}.`;

  const podium = rows.slice(0, 3);

  return (
    <div className="stack">
      {!relaxed && podium.length > 0 && (
        <div className="md-podium" aria-label="Podest">
          {[podium[1], podium[0], podium[2]].map((r, i) => {
            const place = i === 1 ? 0 : i === 0 ? 1 : 2;
            return r ? (
              <div key={r.player.id} className={`md-podium__place md-podium__place--${place + 1}`}>
                {place === 0 && <Icon name="crown" size={24} className="md-podium__crown" />}
                <div
                  className="abzug md-podium__print"
                  style={{ ['--tilt' as string]: `${[-4, 3, 5][place]}deg` }}
                >
                  <div className="md-podium__foto">
                    <Avatar
                      name={r.player.name}
                      color={r.player.color}
                      photo={r.player.id === me.id ? me.photo : undefined}
                      size={place === 0 ? 'lg' : 'md'}
                    />
                  </div>
                  <span className={`md-podium__no md-podium__no--${place + 1}`}>
                    {PLACE_LABEL[place]}
                  </span>
                </div>
                <span className="md-podium__name">{nameOf(r.player.id)}</span>
                <span className="md-podium__pts t-mono-num">{r.value}</span>
                <span className="md-podium__block" />
              </div>
            ) : (
              <div key={`leer-${i}`} className="md-podium__place" />
            );
          })}
        </div>
      )}

      {!relaxed && (
        <div className="stack-2">
          <div className="t-upper t-center">Endstand</div>
          {rows.map((r, i) => (
            <div
              key={r.player.id}
              className={`result-row md-final-row ${r.player.id === me.id ? 'md-row--me' : ''}`}
            >
              <div className="result-row__rank">{i + 1}</div>
              <Avatar
                name={r.player.name}
                color={r.player.color}
                photo={r.player.id === me.id ? me.photo : undefined}
                size="sm"
              />
              <div className="grow">
                <div className="t-headline">{nameOf(r.player.id)}</div>
                <div className="md-breakdown t-mono-num">
                  <span>Memes {signed(r.tally.meme)}</span>
                  {state.options.trittbrett && (
                    <>
                      <span>Trittbrett {signed(r.tally.ride)}</span>
                      <span>Mitfahrer {signed(r.tally.riders)}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="t-mono-num md-score">{r.value}</div>
            </div>
          ))}
        </div>
      )}

      <GameOver
        headline={headline}
        finalCall={
          !relaxed && best > worst
            ? { players: losers, baseSips: 4, label: 'Letzter Platz', source: 'meme-battle' }
            : undefined
        }
        onAgain={() => dispatch({ type: 'restart' })}
        onQuit={quit}
      />

      {sorted.length > 0 && (
        <section className="stack-3">
          <div className="md-gallery__title">
            <Icon name="flame" size={18} /> Von Feuer bis Lahm <Icon name="arrowDown" size={18} />
          </div>
          <div className="md-gallery">
            {sorted.map((h, i) => {
              const t = templateOf(h.t);
              const caption = `${nameOf(h.by)} · Runde ${h.r}`;
              return (
                <div
                  key={`${h.r}-${h.by}`}
                  className={`md-gallery__item ${i === 0 ? 'md-gallery__item--top' : ''}`}
                >
                  <MemePrint
                    tilt={tiltFor(h.by + h.r, i === 0 ? 1.5 : 2.5)}
                    stamp={i === 0}
                    caption={caption}
                    badge={
                      !relaxed ? (
                        <PointsBadge points={h.p} tone={i === 0 ? 'gold' : undefined} />
                      ) : undefined
                    }
                  >
                    {t && <MemeImage template={t} texts={h.x} />}
                  </MemePrint>
                  <SaveMeme meme={h} caption={caption} compact={i !== 0} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function signed(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;
}
