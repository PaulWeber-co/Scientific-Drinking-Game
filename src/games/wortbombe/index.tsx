import { Icon } from '../../components/icons';
import { useEffect, useRef } from 'react';
import { haptic, hapticRamp } from '../../lib/haptics';
import { sound, stopSounds } from '../../lib/sound';
import { pick, shuffle } from '../../lib/format';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { baseFor, isOver, roundGoal } from '../shared/rounds';
import { DrinkCall } from '../shared/DrinkCall';
import { BigCard, PlayerChip } from '../shared/pieces';
import { Bomb } from '../shared/Bomb';
import { Explosion } from '../shared/Explosion';
import type { GameActionInput, GameDefinition, GameRuntime } from '../types';
import { meta } from './meta';

const CATEGORIES = [
  'Dinge, die im Kühlschrank stehen',
  'Automarken',
  'Serien, die alle kennen',
  'Dinge, die man auf einem Festival braucht',
  'Hauptstädte',
  'Cocktails',
  'Ausreden fürs Zuspätkommen',
  'Dinge, die weh tun',
  'Berühmte Paare',
  'Sportarten ohne Ball',
  'Dinge in einer Handtasche',
  'Flüsse und Seen',
  'Tiere mit mehr als vier Beinen',
  'Gründe, ein Date abzusagen',
  'Deutsche Städte mit mehr als 200.000 Einwohnern',
  'Dinge, die man nicht googeln sollte',
  'Pizzabeläge',
  'Superkräfte',
  'Dinge, die im Büro nerven',
  'Songs, die jeder mitsingen kann',
  'Marken, die es seit deiner Kindheit gibt',
  'Dinge im Weltall',
  'Berufe ohne Büro',
  'Was man auf einer Insel braucht',
  'Ausreden, um früher zu gehen',
  'Filme mit einem Wort im Titel',
  'Dinge, die man teilt',
  'Etwas, das man nie zurückbekommt',
];

/** Acht Explosionen sind bei „mittel" eine Partie – jede Runde dauert unter einer Minute. */
const ROUND_BASE = baseFor('wortbombe');

interface State {
  order: string[];
  holderIndex: number;
  phase: 'ready' | 'running' | 'boom' | 'over';
  category: string;
  /** Wann die Bombe scharf gemacht wurde. Ohne diesen Zeitpunkt kennt ein
   *  Gerät, das später dazukommt, die Gesamtdauer nicht – und die Zündschnur
   *  liefe dort von vorn los. */
  armedAt: number;
  explodesAt: number;
  round: number;
  /** Rundenzahl, nach der Schluss ist. `null` = ohne Ende. */
  goal: number | null;
  losses: Record<string, number>;
}

export const wortbombe: GameDefinition<State> = {
  ...meta,

  createState: (players) => ({
    order: shuffle(players.map((p) => p.id)),
    holderIndex: 0,
    phase: 'ready',
    category: pick(CATEGORIES),
    armedAt: 0,
    explodesAt: 0,
    round: 1,
    goal: roundGoal(ROUND_BASE),
    losses: {},
  }),

  reduce: (state, action, players) => {
    switch (action.type) {
      case 'start': {
        const jetzt = Date.now();
        return {
          ...state,
          phase: 'running',
          category: pick(CATEGORIES),
          armedAt: jetzt,
          // Zwischen 22 und 75 Sekunden – niemand kann mitzählen.
          explodesAt: jetzt + 22_000 + Math.random() * 53_000,
        };
      }
      case 'pass': {
        if (state.phase !== 'running') return state;
        const ids = new Set(players.map((p) => p.id));
        const order = [
          ...state.order.filter((id) => ids.has(id)),
          ...players.filter((p) => !state.order.includes(p.id)).map((p) => p.id),
        ];
        return { ...state, order, holderIndex: (state.holderIndex + 1) % Math.max(1, order.length) };
      }
      case 'boom': {
        if (state.phase !== 'running') return state;
        const loser = state.order[state.holderIndex];
        return {
          ...state,
          phase: 'boom',
          losses: { ...state.losses, [loser]: (state.losses[loser] ?? 0) + 1 },
        };
      }
      case 'next': {
        // Nur aus der Auflösung heraus: zwei fast gleichzeitige Taps auf
        // „Weiter" würden sonst zwei Runden zählen, und die letzte Runde
        // fiele still aus. Die Inbox wendet Aktionen nacheinander an.
        if (state.phase !== 'boom') return state;
        const round = state.round + 1;
        if (isOver(round, state.goal)) return { ...state, round, phase: 'over' };
        return {
          ...state,
          phase: 'ready',
          round,
          holderIndex: (state.holderIndex + 1) % Math.max(1, state.order.length),
        };
      }
      case 'restart':
        return wortbombe.createState(players);
      default:
        return state;
    }
  },

  Component: WortbombeGame,
};

function WortbombeGame({ state, players, me, isHost, dispatch, quit, online }: GameRuntime<State>) {
  const holder = players.find((p) => p.id === state.order[state.holderIndex]) ?? players[0];
  const isHolder = holder?.id === me.id;
  const send = (a: GameActionInput) => dispatch(a);

  // Die Bombe zündet auf dem Gerät des Halters (und beim Host als Rückfall).
  useEffect(() => {
    if (state.phase !== 'running') return;
    if (online && !isHolder && !isHost) return;
    const check = () => {
      if (Date.now() >= state.explodesAt) send({ type: 'boom' });
    };
    const t = setInterval(check, 250);
    return () => clearInterval(t);
    // `send` gehört bewusst NICHT in die Abhängigkeiten: die Funktion ist bei
    // jedem Rendern neu, und ein Intervall, das dabei jedes Mal von vorn
    // startet, feuert nie. Genau daran hing das Ticken unten.
  }, [state.phase, state.explodesAt, isHolder, isHost, online]);

  /**
   * Wer die Bombe gerade hält – als Referenz, nicht als Abhängigkeit.
   *
   * Stünde `isHolder` in den Abhängigkeiten des Zünders, liefe der Effekt bei
   * JEDER Weitergabe neu an: der Takt spränge zurück auf den Anfangswert, und
   * nach dem Weitergeben wäre eine Sekunde Ruhe. Die Bombe daneben hat diese
   * Abhängigkeit nicht — beide Kanäle würden ab der ersten Weitergabe
   * auseinanderlaufen: sie glüht rot, während das Handy gemächlich klopft.
   */
  const holderRef = useRef(isHolder);
  holderRef.current = isHolder;

  /**
   * Der Zünder: Vibration und Ton, beide ziehen an, je näher der Knall kommt.
   *
   * Als Kette einzelner Timeouts statt als Intervall mit berechneter Länge.
   * Die alte Fassung hing an einer Zustandsvariablen, die alle 120 ms neu
   * gesetzt wurde, und verwarf ihr Intervall damit jedes Mal, bevor es feuern
   * konnte — bei der Vibration fiel das nicht auf, ein Klang würde hörbar
   * stolpern.
   *
   * Der Fortschritt kommt aus `armedAt`, nicht aus dem Zeitpunkt, an dem
   * dieser Effekt startet: Ein Gerät, das später dazukommt, kennt die
   * Gesamtdauer sonst nicht und finge wieder bei null an — obwohl die Bombe
   * daneben schon glüht.
   *
   * Gespürt und gehört wird nur beim Halter. Die Zündschnur läuft 22 bis 75
   * Sekunden; auf jedem Handy mitzuklopfen hiesse anderthalb Minuten
   * Dauervibration in jeder Hosentasche, und der einzige Ausweg wäre der
   * globale Schalter.
   */
  useEffect(() => {
    if (state.phase !== 'running') return;
    const total = Math.max(1, state.explodesAt - state.armedAt);
    let timer = 0;
    const tick = () => {
      const p = Math.max(0, Math.min(1, (Date.now() - state.armedAt) / total));
      if (!online || holderRef.current) {
        hapticRamp(p);
        sound('tick');
      }
      timer = window.setTimeout(tick, Math.max(180, 880 - p * 700));
    };
    timer = window.setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [state.phase, state.armedAt, state.explodesAt, online]);

  /**
   * Der Knall gehört auf jedes Gerät und genau einmal.
   *
   * Vorher hing er am Zünd-Timer, der beim Host als Rückfall mitläuft: auf
   * einem Host-Gerät, das nicht Halter ist, schlug er ein zweites Mal zu, und
   * ein reiner Gast bekam gar nichts.
   *
   * Gespürt wird er überall — ein einzelner Schlag schadet niemandem. Gehört
   * nur dort, wo auch der Zünder klang: sechs versetzte Knalle sind kein
   * Ereignis, sondern ein Steinschlag.
   *
   * `boom` und nicht `error`: Der Schlag ist das Ereignis selbst, keine
   * Fehlermeldung – und er muss sich vom letzten Tick des Zünders absetzen.
   * Die Sperre in `haptic()` lässt ihn durch, weil sie nur Wiederholungen
   * desselben Musters greift.
   */
  useEffect(() => {
    if (state.phase !== 'boom') return;
    haptic('boom');
    if (!online || holderRef.current) sound('boom');
  }, [state.phase, online]);

  // Ein Knall klingt eine halbe Sekunde nach und hängt am Klang-Kontext, nicht
  // an React. Ohne das hier knallt es noch, wenn längst die Spieleliste steht.
  useEffect(() => () => stopSounds(), []);

  if (state.phase === 'over') {
    const rows = players.map((p) => ({
      player: p,
      value: state.losses[p.id] ?? 0,
      unit: 'Verlust',
      unitPlural: 'Verluste',
    }));
    const values = rows.map((r) => r.value);
    const most = values.length ? Math.max(...values) : 0;
    const fewest = values.length ? Math.min(...values) : 0;
    const top = rows.filter((r) => r.value === most).map((r) => r.player);
    return (
      <GameFrame title={wortbombe.name} accent={wortbombe.accent} subtitle="Ausgezählt" onQuit={quit}>
        <GameOver
          headline={`${state.round - 1} Runden. Ganz oben steht, wem die Bombe am häufigsten in der Hand hochging.`}
          ranking={rows}
          rankingTitle="Wem die Bombe am häufigsten hochging"
          rankHighIsBad
          finalCall={
            // Nur wenn es wirklich ein Schlusslicht gibt – bei Gleichstand
            // träfe die Ansage die ganze Runde und sagte damit nichts.
            most > fewest
              ? { players: top, baseSips: 4, label: 'die meisten Bomben', source: 'wortbombe' }
              : undefined
          }
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  return (
    <GameFrame
      title={wortbombe.name}
      accent={wortbombe.accent}
      subtitle={state.goal ? `Runde ${state.round}/${state.goal}` : `Runde ${state.round}`}
      onQuit={quit}
    >
      <BigCard kicker="Kategorie" tone={state.phase === 'boom' ? 'danger' : 'default'}>
        {state.category}
      </BigCard>

      <div className="row" style={{ justifyContent: 'center' }}>
        <PlayerChip player={holder} note={isHolder ? 'du hast die Bombe' : 'hat die Bombe'} />
      </div>

      {state.phase === 'ready' && (
        <>
          <div className="t-center t-sub t-balance">
            {online
              ? 'Die Bombe springt von Handy zu Handy. Wer sie hat, sagt ein Wort und tippt weiter.'
              : 'Legt das Handy in die Mitte. Es wird reihum weitergereicht.'}
          </div>
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => {
              haptic('press');
              send({ type: 'start' });
            }}
          >
            <Icon name="bomb" size={20} /> Bombe scharf machen
          </button>
        </>
      )}

      {state.phase === 'running' && (
        <>
          <Bomb armedAt={state.armedAt} explodesAt={state.explodesAt} />
          <button
            className="btn btn--brand btn--block btn--lg"
            disabled={online && !isHolder}
            onClick={() => {
              haptic('heavy');
              send({ type: 'pass' });
            }}
          >
            {online && !isHolder ? `${holder?.name} ist dran` : 'Wort gesagt – weitergeben'}
          </button>
        </>
      )}

      {state.phase === 'boom' && (
        <div className="stack-3 shake">
          <Explosion />
          <BigCard tone="danger" kicker="Boom">
            {holder?.name} hatte die Bombe.
          </BigCard>
          <DrinkCall player={holder} baseSips={5} source="wortbombe" resetKey={state.round} />
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => {
              haptic('press');
              send({ type: 'next' });
            }}
          >
            {isOver(state.round + 1, state.goal) ? 'Endstand' : 'Nächste Runde'}
          </button>
        </div>
      )}
    </GameFrame>
  );
}
