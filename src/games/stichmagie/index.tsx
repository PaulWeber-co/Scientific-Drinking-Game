import './stichmagie.css';
import { useEffect } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { BigCard } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';
import { MagicCard } from './art';
import { actorsOf, createState, reduce, type State } from './game';
import { meta } from './meta';
import { firstName, playerFor } from './parts';
import { SPECIAL_ID } from './rules';
import { Setup } from './Setup';
import { SHOW_TRICK_MS, Table } from './Table';

export type { State } from './game';

/** So lange „denkt" der Autopilot, bevor er für jemanden spielt. */
const AUTO_MS = 1100;
/** Hängt der Host, darf nach dieser Zeit jedes Gerät den Stich einsammeln. */
const COLLECT_FALLBACK_MS = 6000;

export const stichmagie: GameDefinition<State> = {
  ...meta,
  createState,
  reduce,
  Component: StichmagieGame,
};

function StichmagieGame(props: GameRuntime<State>) {
  const { state, me, isHost, dispatch, online, quit } = props;
  const send = (a: GameActionInput) => dispatch(a);

  // Den fertigen Stich sammelt der HOST ein – sonst schicken zehn Geräte
  // dieselbe Aktion. Hängt der Host (Handy gesperrt), springen die anderen
  // nach ein paar Sekunden ein; der Reducer nimmt nur die erste an.
  useEffect(() => {
    if (state?.phase !== 'trick') return;
    const t = setTimeout(
      () => send({ type: 'collect' }),
      isHost ? SHOW_TRICK_MS : SHOW_TRICK_MS + COLLECT_FALLBACK_MS,
    );
    return () => clearTimeout(t);
    // `send` ist bei jedem Rendern neu – als Abhängigkeit startete der Wecker
    // ständig von vorn (wie in Lückenfüller und Wortbombe).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, state?.phase, state?.seq]);

  // Autopilot: der Host spielt für alle, die dafür freigegeben sind.
  useEffect(() => {
    if (!isHost || !state) return;
    const due = actorsOf(state).filter((id) => state.auto[id]);
    if (!due.length) return;
    const t = setTimeout(() => {
      for (const who of due) send({ type: 'autopilot', who });
    }, AUTO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `send`, s. oben
  }, [isHost, state?.seq]);

  // Man legt das Handy weg, bis man dran ist – dann soll man es spüren.
  const myTurn = !!state && actorsOf(state).includes(me.id);
  useEffect(() => {
    if (myTurn) haptic('heavy');
  }, [myTurn, state?.phase]);

  if (!online) {
    return (
      <GameFrame title={meta.name} accent={meta.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Bei Stichmagie hält jede Person ihre Karten geheim. Startet eine Online-Lobby – dann hat
          jede Person ihre Hand auf dem eigenen Handy.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  if (!state) return null;

  if (state.phase === 'setup') {
    return (
      <GameFrame
        title={meta.name}
        accent={meta.accent}
        subtitle="Der Tisch wird eingerichtet"
        onQuit={quit}
      >
        <Setup state={state} players={props.players} isHost={isHost} dispatch={dispatch} />
      </GameFrame>
    );
  }

  if (state.phase === 'over') return <Finale {...props} />;

  return <Table {...props} />;
}

function Finale({ state, players, me, dispatch, quit }: GameRuntime<State>) {
  const rows = state.seats.map((seat) => ({
    player: playerFor(seat, players),
    value: state.scores[seat.id] ?? 0,
    unit: 'Punkt',
    unitPlural: 'Punkte',
  }));
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const best = sorted[0]?.value ?? 0;
  const worst = sorted[sorted.length - 1]?.value ?? 0;
  const winners = sorted.filter((r) => r.value === best);
  const losers = sorted.filter((r) => r.value === worst).map((r) => r.player);
  const iWon = winners.some((w) => w.player.id === me.id);
  const podium = sorted.slice(0, 3);
  const hits = state.log.reduce((a, r) => a + (r.delta[me.id] > 0 ? 1 : 0), 0);

  useEffect(() => {
    haptic(iWon ? 'success' : 'heavy');
  }, [iWon]);

  const headline =
    winners.length === 1
      ? `${winners[0].player.id === me.id ? 'Du gewinnst' : `${winners[0].player.name} gewinnt`} mit ${best} Punkten.`
      : `Geteilter Sieg: ${winners
          .map((w) => (w.player.id === me.id ? 'Du' : firstName(w.player.name)))
          .join(' und ')} mit je ${best} Punkten.`;

  return (
    <GameFrame
      title={meta.name}
      accent={meta.accent}
      subtitle="Die Partie ist vorbei"
      onQuit={quit}
    >
      <div className="sm-finale">
        <div className="sm-finale__sky" aria-hidden>
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="sm-spark" style={{ ['--i' as string]: i }} />
          ))}
        </div>
        <MagicCard
          id={SPECIAL_ID.drache}
          size="md"
          className="sm-finale__card sm-finale__card--l"
        />
        <MagicCard id={52} size="md" className="sm-finale__card sm-finale__card--r" />
        <div className="sm-podium">
          {[podium[1], podium[0], podium[2]].map((r, i) =>
            r ? (
              <div
                key={r.player.id}
                className={`sm-podium__place sm-podium__place--${i === 1 ? 1 : i === 0 ? 2 : 3}`}
              >
                {r.value === best && <Icon name="crown" size={22} className="sm-podium__crown" />}
                <Avatar
                  name={r.player.name}
                  color={r.player.color}
                  photo={r.player.id === me.id ? me.photo : undefined}
                  size={i === 1 ? 'lg' : 'md'}
                />
                <span className="sm-podium__name">
                  {r.player.id === me.id ? 'Du' : firstName(r.player.name)}
                </span>
                <span className="sm-podium__pts t-mono-num">{r.value}</span>
                <span className="sm-podium__block" />
              </div>
            ) : (
              <div key={`leer-${i}`} className="sm-podium__place sm-podium__place--empty" />
            ),
          )}
        </div>
        {state.seats.some((s) => s.id === me.id) && (
          <p className="t-caption t-center">
            Du hast {hits} von {state.log.length} Runden genau getroffen.
          </p>
        )}
      </div>
      <GameOver
        headline={headline}
        ranking={rows}
        rankingTitle="Endstand"
        finalCall={
          best > worst
            ? { players: losers, baseSips: 3, label: 'Letzter Platz', source: 'stichmagie' }
            : undefined
        }
        onAgain={() => dispatch({ type: 'restart' })}
        onQuit={quit}
      />
    </GameFrame>
  );
}
