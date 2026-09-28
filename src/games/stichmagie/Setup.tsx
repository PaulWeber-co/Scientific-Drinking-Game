import { useState } from 'react';
import { Segmented, Sheet, Toggle } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import type { GameActionInput, GamePlayer } from '../types';
import { WaitingFor } from '../shared/pieces';
import { MagicCard } from './art';
import type { State } from './game';
import { RulesList } from './parts';
import {
  BASE_DECK,
  MAGIER,
  SPECIALS,
  SPECIAL_ID,
  SPECIAL_INFO,
  planFor,
  presetOf,
  type Length,
  type Preset,
} from './rules';

/**
 * Der Tisch wird eingerichtet: welche Sonderkarten, welche Regeln, wie lang.
 *
 * Alle sehen dieselbe Einstellung live – so wird am Tisch darüber geredet,
 * nicht in einem Menü. Ändern kann sie nur, wer die Lobby hält; sonst ziehen
 * zwei Leute gleichzeitig an denselben Schaltern.
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
  const [regeln, setRegeln] = useState(false);
  const da = players.filter((p) => p.online !== false);
  const count = da.length || players.length;
  const plan = planFor(count, state.options.length);
  const preset = presetOf(state.options.specials);
  const host = players.find((p) => p.isHost);
  const enough = count >= 3;

  const lengths: { value: Length; label: string }[] = [
    { value: 'kurz', label: `Kurz · ${planFor(count, 'kurz').length}` },
    { value: 'voll', label: `Voll · ${planFor(count, 'voll').length}` },
    { value: 'rauf-runter', label: `Rauf & runter · ${planFor(count, 'rauf-runter').length}` },
  ];

  return (
    <div className="sm-setup stack-4">
      <div className="sm-hero" aria-hidden>
        <MagicCard id={SPECIAL_ID.fee} size="lg" className="sm-hero__card sm-hero__card--l" />
        <MagicCard id={MAGIER[0]} size="xl" className="sm-hero__card sm-hero__card--m" />
        <MagicCard id={SPECIAL_ID.drache} size="lg" className="sm-hero__card sm-hero__card--r" />
      </div>
      <p className="t-sub t-center t-balance">
        Jede Runde eine Karte mehr. Sag an, wie viele Stiche du machst – und triff genau.
      </p>

      <section className="stack-3">
        <div className="row-between">
          <span className="t-upper">Sonderkarten</span>
          <button className="btn btn--plain btn--sm" onClick={() => setRegeln(true)}>
            Was können die?
          </button>
        </div>
        {isHost && (
          <Segmented<Preset | 'eigene'>
            value={preset ?? 'eigene'}
            onChange={(v) => {
              if (v !== 'eigene') dispatch({ type: 'preset', preset: v });
            }}
            options={[
              { value: 'klassisch', label: 'Klassisch' },
              { value: 'jubilaeum', label: 'Jubiläum' },
              { value: 'alle', label: 'Alle 9' },
            ]}
          />
        )}
        <div className="sm-specials">
          {SPECIALS.map((s) => {
            const on = state.options.specials.includes(s);
            return (
              <button
                key={s}
                className={`sm-special pressable ${on ? 'sm-special--on' : ''}`}
                aria-pressed={on}
                disabled={!isHost}
                onClick={() => {
                  haptic('select');
                  dispatch({ type: 'toggleSpecial', special: s });
                }}
              >
                <MagicCard id={SPECIAL_ID[s]} size="md" />
                <span className="sm-special__name">{SPECIAL_INFO[s].name}</span>
                <span className="sm-special__ed">{SPECIAL_INFO[s].edition}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack-3">
        <span className="t-upper">Regeln</span>
        <div className={`sm-option ${isHost ? '' : 'sm-option--locked'}`}>
          <div className="grow">
            <div className="t-headline">Ansagen dürfen nicht aufgehen</div>
            <div className="t-caption" id="sm-rule-even">
              Wer zuletzt ansagt, darf die Summe nicht auf die Kartenzahl bringen. Einer liegt immer
              daneben.
            </div>
          </div>
          <Toggle
            checked={state.options.noEvenBids}
            label="Ansagen dürfen nicht aufgehen"
            describedBy="sm-rule-even"
            onChange={(on) => isHost && dispatch({ type: 'rule', rule: 'noEvenBids', on })}
          />
        </div>
        <div className={`sm-option ${isHost ? '' : 'sm-option--locked'}`}>
          <div className="grow">
            <div className="t-headline">Karte an der Stirn</div>
            <div className="t-caption" id="sm-rule-forehead">
              In Runden mit einer Karte siehst du die Karten aller anderen – nur deine eigene nicht.
            </div>
          </div>
          <Toggle
            checked={state.options.forehead}
            label="Karte an der Stirn"
            describedBy="sm-rule-forehead"
            onChange={(on) => isHost && dispatch({ type: 'rule', rule: 'forehead', on })}
          />
        </div>
      </section>

      <section className="stack-3">
        <span className="t-upper">Länge</span>
        {isHost ? (
          <Segmented<Length>
            value={state.options.length}
            onChange={(length) => dispatch({ type: 'length', length })}
            options={lengths}
          />
        ) : (
          <div className="t-sub">
            {lengths.find((l) => l.value === state.options.length)?.label} Runden
          </div>
        )}
      </section>

      <p className="t-caption t-center">
        {count} Leute · {plan.length} Runden · {BASE_DECK + state.options.specials.length} Karten
      </p>

      {!enough && (
        <div className="notice notice--orange">
          Stichmagie braucht mindestens drei Leute in der Lobby.
        </div>
      )}

      {isHost ? (
        <button
          className="btn btn--brand btn--block btn--lg"
          disabled={!enough}
          onClick={() => {
            haptic('heavy');
            dispatch({ type: 'deal' });
          }}
        >
          Karten austeilen
        </button>
      ) : (
        <WaitingFor names={[host?.name ?? 'Host']} what="Richtet den Tisch ein" />
      )}

      <Sheet open={regeln} onClose={() => setRegeln(false)} title="Die Karten">
        <RulesList specials={SPECIALS} />
      </Sheet>
    </div>
  );
}
