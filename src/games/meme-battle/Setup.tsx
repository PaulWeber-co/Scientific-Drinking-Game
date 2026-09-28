import { Icon, type IconName } from '../../components/icons';
import { Segmented, Toggle } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import { WaitingFor } from '../shared/pieces';
import type { GameActionInput, GamePlayer } from '../types';
import {
  REROLL_OPTIONS,
  RIDER_BONUS,
  ROUND_OPTIONS,
  TIMER_OPTIONS,
  type Mode,
  type State,
} from './game';
import { MemeImage, MemePrint } from './Meme';
import { TEMPLATES, templateOf } from './templates';

const MODE_INFO: Record<Mode, { title: string; text: string; icon: IconName }> = {
  klassisch: {
    title: 'Klassisch',
    text: 'Jede Person zieht ihre eigene Vorlage.',
    icon: 'shuffle',
  },
  gleich: {
    title: 'Gleiches Meme',
    text: 'Alle bekommen dieselbe Vorlage. Nur die Pointe zählt.',
    icon: 'swap',
  },
  themen: {
    title: 'Themen',
    text: 'Jede Runde ein Thema, jede Person ihr eigenes Bild.',
    icon: 'quotes',
  },
  entspannt: {
    title: 'Entspannt',
    text: 'Ohne Punkte und ohne Trinkansage. Nur Memes.',
    icon: 'heart',
  },
};

/** Drei Beispiele fürs Titelbild – deutsch, damit klar ist, was hier passiert. */
const HERO: { id: string; texts: string[]; tilt: number }[] = [
  { id: 'fine', texts: ['4 Uhr', 'Alles gut'], tilt: -7 },
  { id: 'drake', texts: ['Früh ins Bett', 'Noch ein Meme-Duell'], tilt: 2 },
  { id: 'db', texts: ['Memes', 'Ich', 'Bett'], tilt: 7 },
];

/**
 * Der Tisch wird eingerichtet. Alle sehen die Einstellung live, ändern kann
 * sie nur, wer die Lobby hält – sonst ziehen zwei Leute am selben Schalter.
 */
export function Setup({
  state,
  players,
  isHost,
  dispatch,
}: {
  state: State;
  players: GamePlayer[];
  isHost: boolean;
  dispatch: (a: GameActionInput) => void;
}) {
  const count = players.filter((p) => p.online !== false).length;
  const enough = count >= 3;
  const host = players.find((p) => p.isHost);
  const { mode, seconds, trittbrett, rerolls } = state.options;

  return (
    <div className="md-setup stack">
      <div className="md-fan" aria-hidden>
        {HERO.map((h, i) => {
          const t = templateOf(h.id);
          return t ? (
            <MemePrint
              key={h.id}
              className={`md-fan__print md-fan__print--${i}`}
              tilt={h.tilt}
              stamp={i === 1}
              ar={t.w / t.h}
            >
              <MemeImage template={t} texts={h.texts} />
            </MemePrint>
          ) : null;
        })}
      </div>
      <p className="t-sub t-center t-balance">
        Vorlage ziehen, Text rein, abstimmen. Das beste Meme holt die Punkte, das schwächste trinkt.
      </p>

      <section className="stack-3">
        <span className="t-upper">Modus</span>
        <div className="md-modes">
          {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
            <button
              key={m}
              className={`md-mode pressable ${mode === m ? 'md-mode--on' : ''}`}
              aria-pressed={mode === m}
              disabled={!isHost}
              onClick={() => {
                haptic('select');
                dispatch({ type: 'mode', mode: m });
              }}
            >
              <Icon name={MODE_INFO[m].icon} size={22} />
              <span className="md-mode__title">{MODE_INFO[m].title}</span>
              <span className="md-mode__text">{MODE_INFO[m].text}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="stack-3">
        <span className="t-upper">Zeit zum Basteln</span>
        {isHost ? (
          <Segmented<string>
            value={String(seconds)}
            onChange={(v) => dispatch({ type: 'timer', seconds: Number(v) })}
            options={TIMER_OPTIONS.map((s) => ({ value: String(s), label: `${s} s` }))}
          />
        ) : (
          <div className="t-sub">{seconds} Sekunden je Meme</div>
        )}
      </section>

      <div className="md-setup__pair">
        <section className="stack-3">
          <span className="t-upper">Runden</span>
          {isHost ? (
            <Segmented<string>
              value={String(state.goal ?? 0)}
              onChange={(v) => dispatch({ type: 'rounds', rounds: Number(v) })}
              options={ROUND_OPTIONS.map((r) => ({ value: String(r), label: r ? String(r) : '∞' }))}
            />
          ) : (
            <div className="t-sub">{state.goal ?? 'Ohne Ende'}</div>
          )}
        </section>
        {mode !== 'gleich' && (
          <section className="stack-3">
            <span className="t-upper">Neu würfeln</span>
            {isHost ? (
              <Segmented<string>
                value={String(rerolls)}
                onChange={(v) => dispatch({ type: 'rerolls', count: Number(v) })}
                options={REROLL_OPTIONS.map((r) => ({
                  value: String(r),
                  label: r ? String(r) : 'Aus',
                }))}
              />
            ) : (
              <div className="t-sub">{rerolls ? `${rerolls}× pro Partie` : 'Aus'}</div>
            )}
          </section>
        )}
      </div>

      {mode !== 'entspannt' && (
        <div className={`md-option ${isHost ? '' : 'md-option--locked'}`}>
          <Icon name="bus" size={22} />
          <div className="grow">
            <div className="t-headline">Trittbrett</div>
            <div className="t-caption" id="md-rule-ride">
              Einmal je Runde auf ein fremdes Meme aufspringen: die Hälfte seiner Punkte geht an
              dich, auch die Hälfte eines Minus. Das Meme bekommt +{RIDER_BONUS} je Mitfahrer.
            </div>
          </div>
          <Toggle
            checked={trittbrett}
            label="Trittbrett"
            describedBy="md-rule-ride"
            onChange={(on) => isHost && dispatch({ type: 'trittbrett', on })}
          />
        </div>
      )}

      <p className="t-caption t-center">
        {state.goal ? `${state.goal} Runden` : 'Ohne Ende'} ·{' '}
        {mode === 'gleich' || !rerolls ? 'ohne Würfeln' : `${rerolls}× neu würfeln`} ·{' '}
        {TEMPLATES.length} Vorlagen
      </p>

      {!enough && (
        <div className="notice notice--orange">
          Das Meme-Duell braucht mindestens drei Leute in der Lobby – sonst weiß jede Person, von
          wem das andere Meme ist.
        </div>
      )}

      {isHost ? (
        <button
          className="btn btn--brand btn--block btn--lg"
          disabled={!enough}
          onClick={() => {
            haptic('heavy');
            dispatch({ type: 'start' });
          }}
        >
          Vorlagen austeilen
        </button>
      ) : (
        <WaitingFor names={[host?.name ?? 'Host']} what="Richtet die Runde ein" />
      )}
    </div>
  );
}
