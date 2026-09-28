import { useEffect } from 'react';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { GameOver } from '../shared/GameOver';
import type { GameRuntime } from '../types';
import type { State } from './game';
import { MemeImage, MemePrint, PointsBadge } from './Meme';
import { SaveMeme, tiltFor } from './parts';
import { templateOf } from './templates';

/**
 * Ende der Partie: die Ruhmeshalle mit dem besten Meme jeder Runde, dann
 * Endstand und die letzte Ansage.
 */
export function Finale({ state, players, me, dispatch, quit }: GameRuntime<State>) {
  const relaxed = state.options.mode === 'entspannt';
  const rows = players
    .filter((p) => state.scores[p.id] !== undefined)
    .map((p) => ({
      player: p,
      value: state.scores[p.id] ?? 0,
      unit: 'Punkt',
      unitPlural: 'Punkte',
    }))
    .sort((a, b) => b.value - a.value);
  const best = rows[0]?.value ?? 0;
  const worst = rows[rows.length - 1]?.value ?? 0;
  const winners = rows.filter((r) => r.value === best);
  const losers = rows.filter((r) => r.value === worst).map((r) => r.player);
  const iWon = winners.some((w) => w.player.id === me.id);
  const rounds = state.round - 1;

  useEffect(() => {
    haptic(iWon ? 'success' : 'heavy');
  }, [iWon]);

  const headline = relaxed
    ? `${rounds} Runden, ${state.hall.length} Memes in der Ruhmeshalle.`
    : winners.length === 1
      ? `${winners[0].player.id === me.id ? 'Du bist' : `${winners[0].player.name} ist`} Meme-Champion mit ${best} Punkten.`
      : `Geteilter Titel: ${winners.map((w) => (w.player.id === me.id ? 'Du' : w.player.name)).join(' und ')}.`;

  return (
    <div className="stack">
      {state.hall.length > 0 && (
        <section className="stack-3">
          <div className="md-hall__title">
            <Icon name="trophy" size={18} /> Ruhmeshalle
          </div>
          <div className="md-hall scroll-x">
            {state.hall.map((h) => {
              const t = templateOf(h.meme.t);
              const caption = `${h.name || 'Anonym'} · Runde ${h.round}`;
              return (
                <div key={h.round} className="md-hall__item">
                  <MemePrint
                    tilt={tiltFor(h.by + h.round, 2.5)}
                    caption={caption}
                    badge={!relaxed ? <PointsBadge points={h.points} tone="gold" /> : undefined}
                  >
                    {t && <MemeImage template={t} texts={h.meme.x} />}
                  </MemePrint>
                  {h.topic && <div className="t-caption t-center">Thema: {h.topic}</div>}
                  <SaveMeme meme={h.meme} caption={caption} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <GameOver
        headline={headline}
        ranking={relaxed ? undefined : rows}
        rankingTitle="Endstand"
        finalCall={
          !relaxed && best > worst
            ? { players: losers, baseSips: 4, label: 'Letzter Platz', source: 'meme-battle' }
            : undefined
        }
        onAgain={() => dispatch({ type: 'restart' })}
        onQuit={quit}
      />
    </div>
  );
}
