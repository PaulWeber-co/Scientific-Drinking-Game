import './wbi.css';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { Avatar } from '../../components/ui/Avatar';
import { formatStamp } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { markTextsSeen } from '../../store/seen';
import { DrinkCall } from '../shared/DrinkCall';
import { GameFrame } from '../shared/GameFrame';
import { GameOver } from '../shared/GameOver';
import { BigCard, RankTag, WaitingFor } from '../shared/pieces';
import type { GameActionInput, GameDefinition, GamePlayer, GameRuntime } from '../types';
import { CATEGORIES, type CategoryGroup } from './categories';
import {
  activeRing,
  canSettle,
  categoryText,
  choosableCats,
  createState,
  DEAL_SIPS,
  firstFinal,
  isFinal,
  isGuessed,
  LAST_SIPS,
  LEVELS,
  MAX_TERM,
  mayPickRandom,
  missingWriters,
  openIds,
  reduce,
  targetOf,
  type Level,
  type State,
} from './game';
import { hasIdeas, loadPool, nextIdea } from './ideas';
import { meta } from './meta';

export type { State } from './game';

/**
 * Hängt der Host (Handy gesperrt), springen die anderen nach dieser Zeit ein.
 * Der Reducer prüft selbst, ob die Phase wirklich abschließbar ist.
 */
const FALLBACK_MS = 4_000;
const RESEND_MS = { host: 1_000, guest: 3_000 };

export const werBinIch: GameDefinition<State> = {
  ...meta,
  createState,
  reduce,
  Component: WerBinIchGame,
};

/** Uhr für alles, was an der Rückgängig-Frist hängt. Läuft nur, solange sie gebraucht wird. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  return active ? now : Date.now();
}

function WerBinIchGame({ state, players, me, isHost, dispatch, online, quit }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const category = state ? categoryText(state) : '';
  const pending = state ? state.marks.some((m) => !isFinal(m, Date.now())) : false;
  const firstOpen = !!state && state.marks.length > 0 && !state.dealt;
  const now = useNow(pending || firstOpen);

  useEffect(() => {
    if (category) markTextsSeen([category]);
  }, [category]);

  // Eine Phase kann auch durch Weggehen fertig werden – dann kommt keine
  // Aktion, die sie weiterschiebt. Das übernimmt der Host, die anderen nur,
  // wenn er hängt. Die Startzeit bleibt stehen, solange die Bedingung gilt.
  const settleSince = useRef<number | null>(null);
  const lastSent = useRef(0);
  useEffect(() => {
    if (!state || !['write', 'guess'].includes(state.phase)) return;
    const t = setInterval(() => {
      const at = Date.now();
      if (!canSettle(state, players, at)) {
        settleSince.current = null;
        return;
      }
      settleSince.current ??= at;
      if (at - settleSince.current < (isHost ? 0 : FALLBACK_MS)) return;
      if (at - lastSent.current < (isHost ? RESEND_MS.host : RESEND_MS.guest)) return;
      lastSent.current = at;
      dispatch({ type: 'settle' });
    }, 300);
    return () => clearInterval(t);
  }, [state, players, isHost, dispatch]);

  if (!online) {
    return (
      <GameFrame title={meta.name} accent={meta.accent} onQuit={quit}>
        <BigCard kicker="Eigene Handys nötig">
          Bei Wer bin ich sieht jede Person die Begriffe der anderen – nur den eigenen nicht.
          Startet dafür eine Online-Lobby.
        </BigCard>
        <button className="btn btn--brand btn--block btn--lg" onClick={quit}>
          Zurück
        </button>
      </GameFrame>
    );
  }

  if (!state) return null;

  const nameOf = (id: string) =>
    id === me.id ? 'Du' : (players.find((p) => p.id === id)?.name ?? state.names[id] ?? 'Jemand');
  const roundLabel = state.goal ? `Runde ${state.round}/${state.goal}` : `Runde ${state.round}`;

  if (state.phase === 'over') {
    const rows = players.map((p) => ({
      player: p,
      value: state.losses[p.id] ?? 0,
      unit: 'Mal',
      unitPlural: 'Mal',
    }));
    return (
      <GameFrame title={meta.name} accent={meta.accent} subtitle="Ausgespielt" onQuit={quit}>
        <GameOver
          headline={`${state.round - 1} Runden Wer bin ich.`}
          ranking={rows.some((r) => r.value > 0) ? rows : undefined}
          rankingTitle="Am häufigsten zuletzt übrig"
          rankHighIsBad
          onAgain={() => send({ type: 'restart' })}
          onQuit={quit}
        />
      </GameFrame>
    );
  }

  const subtitle =
    state.phase === 'pick'
      ? `${roundLabel} · Kategorie`
      : state.phase === 'write'
        ? `${roundLabel} · Schreiben`
        : state.phase === 'guess'
          ? `${roundLabel} · ${state.marks.length} erraten`
          : `${roundLabel} · Auflösung`;

  return (
    <GameFrame title={meta.name} accent={meta.accent} subtitle={subtitle} onQuit={quit}>
      {state.phase === 'pick' && (
        <PickStep state={state} players={players} me={me} roundLabel={roundLabel} nameOf={nameOf} send={send} />
      )}
      {state.phase === 'write' && (
        <WriteStep state={state} players={players} me={me} category={category} nameOf={nameOf} send={send} />
      )}
      {/* Eine feste Stelle für Raten UND Auflösung: sonst baut React die
          Trinkansage beim Phasenwechsel neu, „Eingetragen" ginge verloren
          und die Schlucke ließen sich ein zweites Mal buchen. */}
      {(state.phase === 'guess' || state.phase === 'done') && (
        <DealSection state={state} players={players} me={me} now={now} nameOf={nameOf} send={send} />
      )}
      {state.phase === 'guess' && (
        <GuessStep state={state} players={players} me={me} now={now} category={category} nameOf={nameOf} send={send} />
      )}
      {state.phase === 'done' && (
        <DoneStep state={state} players={players} me={me} isHost={isHost} nameOf={nameOf} send={send} />
      )}
    </GameFrame>
  );
}

interface StepProps {
  state: State;
  players: GamePlayer[];
  me: GamePlayer;
  send: (a: GameActionInput) => void;
}

const GROUPS: CategoryGroup[] = ['Menschen', 'Figuren', 'Eigenschaften', 'Dinge'];

type Choice = { cat: number } | { text: string };

function PickStep({
  state,
  players,
  me,
  roundLabel,
  nameOf,
  send,
}: StepProps & { roundLabel: string; nameOf: (id: string) => string }) {
  if (state.chooser === me.id) return <ChooseCategory state={state} players={players} roundLabel={roundLabel} send={send} />;
  return <WaitForChooser state={state} players={players} me={me} roundLabel={roundLabel} nameOf={nameOf} send={send} />;
}

function ChooseCategory({
  state,
  players,
  roundLabel,
  send,
}: Omit<StepProps, 'me'> & { roundLabel: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [level, setLevel] = useState<Level>(state.level);
  const [rolls, setRolls] = useState(0);
  const [list, setList] = useState(false);
  const [query, setQuery] = useState('');
  const allowed = choosableCats(state, players.length);
  // Der Würfel geht den gemischten Stapel des Hosts entlang – kein Zufall auf
  // diesem Gerät, und Frisches kommt zuerst.
  const deck = state.catDeck.filter((c) => allowed.includes(c));
  const dice = deck.length ? deck : allowed;
  const text = choice
    ? 'cat' in choice
      ? categoryText({ cat: choice.cat, customCats: state.customCats })
      : choice.text
    : '';
  const typed = choice && 'text' in choice ? choice.text : '';
  const needle = query.trim().toLocaleLowerCase('de');
  const matches = (c: number) =>
    !needle || categoryText({ cat: c, customCats: state.customCats }).toLocaleLowerCase('de').includes(needle);

  const roll = () => {
    haptic('select');
    let i = rolls;
    if (dice.length > 1 && choice && 'cat' in choice && dice[i % dice.length] === choice.cat) i++;
    setChoice({ cat: dice[i % dice.length] });
    setRolls(i + 1);
  };
  const confirm = () => {
    if (!choice) return;
    haptic('success');
    send({ type: 'pick', level, ...choice });
  };

  return (
    <div className="stack-3">
      <BigCard
        kicker={`Du bist dran · ${roundLabel}`}
        footer={
          !text
            ? 'Alle anderen warten auf dich.'
            : hasIdeas(text)
              ? `Ideen: ${level}`
              : 'Zu dieser Kategorie gibt es keine Ideen.'
        }
      >
        {text || <span className="wbi-placeholder">Was wird’s diesmal?</span>}
      </BigCard>

      <div className="wbi-pair">
        <button className="btn btn--glass btn--lg" onClick={roll}>
          <Icon name="shuffle" size={18} /> Würfeln
        </button>
        <button
          className="btn btn--glass btn--lg"
          onClick={() => {
            haptic('tap');
            setList(true);
          }}
        >
          <Icon name="cards" size={18} /> Liste
        </button>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="wbi-kategorie">
          Oder selbst eintippen
        </label>
        <input
          id="wbi-kategorie"
          className="input wbi-input"
          value={typed}
          maxLength={MAX_TERM}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="z. B. Unsere Lehrer"
          onChange={(e) => setChoice(e.target.value.trim() ? { text: e.target.value } : null)}
          onKeyDown={(e) => e.key === 'Enter' && confirm()}
        />
      </div>

      {(!text || hasIdeas(text)) && (
        <div className="field">
          <span className="field__label">Schwierigkeit der Ideen</span>
          <div className="segmented" role="group" aria-label="Schwierigkeit der Ideen">
            {LEVELS.map((l) => (
              <button
                key={l}
                className="segmented__opt"
                aria-pressed={level === l}
                onClick={() => {
                  haptic('select');
                  setLevel(l);
                }}
              >
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn--brand btn--block btn--lg" disabled={!choice} onClick={confirm}>
        Los geht’s
      </button>

      <Sheet open={list} onClose={() => setList(false)} title="Kategorie wählen">
        <div className="stack-3">
          <input
            className="input"
            type="search"
            aria-label="Kategorie suchen"
            placeholder="Suchen"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {[
            ...GROUPS.map((g) => ({
              title: g,
              cats: allowed.filter((c) => c >= 0 && CATEGORIES[c].group === g),
            })),
            { title: 'Eure eigenen', cats: allowed.filter((c) => c < 0) },
          ]
            .map((sec) => ({ ...sec, cats: sec.cats.filter(matches) }))
            .filter((sec) => sec.cats.length)
            .map((sec) => (
              <section key={sec.title} className="stack-2">
                <h3 className="t-caption t-upper">{sec.title}</h3>
                <div className="wbi-cats">
                  {sec.cats.map((c) => (
                    <button
                      key={c}
                      className={`chip chip--outline pressable${choice && 'cat' in choice && choice.cat === c ? ' chip--on' : ''}`}
                      aria-pressed={!!choice && 'cat' in choice && choice.cat === c}
                      onClick={() => {
                        haptic('select');
                        setChoice({ cat: c });
                        setList(false);
                        setQuery('');
                      }}
                    >
                      {categoryText({ cat: c, customCats: state.customCats })}
                    </button>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </Sheet>
    </div>
  );
}

function WaitForChooser({
  state,
  players,
  me,
  roundLabel,
  nameOf,
  send,
}: StepProps & { roundLabel: string; nameOf: (id: string) => string }) {
  const chooser = players.find((p) => p.id === state.chooser);
  const name = nameOf(state.chooser);
  // Der Host bekommt erst nach der Frist einen Knopf – die Uhr läuft nur bei ihm.
  const host = players.find((p) => p.isHost)?.id === me.id;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!host) return;
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, [host]);
  const away = chooser?.online === false || !chooser;

  return (
    <div className="stack-3">
      <BigCard
        kicker={`${roundLabel} · Kategorie`}
        footer="wählt die Kategorie. Danach schreibst du für jemanden aus der Runde."
      >
        <div className="wbi-target">
          {chooser && <Avatar name={chooser.name} color={chooser.color} photo={chooser.photo} size="lg" />}
          <div>{name}</div>
        </div>
      </BigCard>
      {host && mayPickRandom(state, players, me.id, now) && (
        <>
          <button
            className="btn btn--glass btn--block"
            onClick={() => {
              haptic('select');
              send({ type: 'pick', random: true });
            }}
          >
            <Icon name="shuffle" size={18} /> Für {name} würfeln
          </button>
          <div className="t-caption t-center">
            {away ? `${name} ist gerade nicht da.` : `${name} antwortet nicht.`} Nur du als Host siehst das.
          </div>
        </>
      )}
    </div>
  );
}

function WriteStep({
  state,
  players,
  me,
  category,
  nameOf,
  send,
}: StepProps & { category: string; nameOf: (id: string) => string }) {
  const target = targetOf(state, players, me.id);
  const targetPlayer = players.find((p) => p.id === target);
  const term = target ? state.terms[target] : undefined;
  const [seen, setSeen] = useState('');
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState<string[]>([]);
  const key = `${state.round}:${state.cat}:${target}`;
  const ideas = hasIdeas(category);
  // Schon beim Auslosen laden, damit „Idee" sofort antwortet.
  useEffect(() => {
    if (ideas) void loadPool();
  }, [ideas]);
  const missing = missingWriters(state, players)
    .filter((id) => id !== me.id)
    .map(nameOf);

  if (!target || !targetPlayer) {
    return (
      <div className="stack-3">
        <BigCard kicker="Diese Runde schaust du zu">
          Du steigst in der nächsten Runde ein.
        </BigCard>
        <WaitingFor names={missing} what="Schreiben noch" />
      </div>
    );
  }

  if (seen !== key && !term) {
    return (
      <div className="stack-3">
        <BigCard
          kicker="Ausgelost · du schreibst für"
          footer={`Kategorie: ${category}. Wer für dich schreibt, bleibt geheim.`}
        >
          <div className="wbi-target">
            <Avatar name={targetPlayer.name} color={targetPlayer.color} photo={targetPlayer.photo} size="lg" />
            <div>{targetPlayer.name}</div>
          </div>
        </BigCard>
        <button
          className="btn btn--brand btn--block btn--lg"
          onClick={() => {
            haptic('tap');
            setSeen(key);
          }}
        >
          Begriff für {targetPlayer.name} schreiben
        </button>
      </div>
    );
  }

  if (term && term.by !== me.id) {
    return (
      <div className="stack-3">
        <BigCard kicker={`Für ${targetPlayer.name} ist gesorgt`}>
          Jemand ist gegangen – {nameOf(term.by)} hat schon für {targetPlayer.name} geschrieben.
        </BigCard>
        <WaitingFor names={missing} what="Schreiben noch" />
      </div>
    );
  }

  if (term) {
    return (
      <div className="stack-3">
        <BigCard kicker={`Abgegeben für ${targetPlayer.name}`}>{term.text}</BigCard>
        <WaitingFor names={missing} what="Schreiben noch" />
        <button
          className="btn btn--glass btn--block"
          onClick={() => {
            setDraft(term.text);
            send({ type: 'unwrite' });
          }}
        >
          Ändern
        </button>
      </div>
    );
  }

  const text = draft.trim();
  const submit = () => {
    if (!text) return;
    haptic('success');
    send({ type: 'write', text });
  };
  const idea = () => {
    haptic('select');
    void loadPool().then((pool) => {
      const taken = Object.values(state.terms).map((t) => t.text);
      const next = nextIdea(pool[category]?.[state.level] ?? [], taken, shown);
      if (!next) return;
      setDraft(next);
      setShown((s) => [...s, next]);
    });
  };

  return (
    <div className="stack-3">
      <BigCard kicker={`Für ${targetPlayer.name} · ${category}`}>Wer ist {targetPlayer.name}?</BigCard>
      <div className="field">
        <label className="field__label" htmlFor="wbi-begriff">
          Begriff
        </label>
        <input
          id="wbi-begriff"
          className="input wbi-input"
          value={draft}
          maxLength={40}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Name oder Begriff"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      {ideas && (
        <button className="btn btn--glass btn--block" onClick={idea}>
          <Icon name={shown.length ? 'refresh' : 'sparkles'} size={18} /> {shown.length ? 'Andere Idee' : 'Idee'}
        </button>
      )}
      <div className="t-caption t-center">
        {shown.length
          ? `Passend zu „${state.level}“. Ändern oder selbst schreiben geht immer.`
          : `${targetPlayer.name} sieht das nicht – alle anderen schon.`}
      </div>
      <button className="btn btn--brand btn--block btn--lg" disabled={!text} onClick={submit}>
        Bestätigen
      </button>
    </div>
  );
}

function GuessStep({
  state,
  players,
  me,
  now,
  category,
  nameOf,
  send,
}: StepProps & { now: number; category: string; nameOf: (id: string) => string }) {
  const [confirm, setConfirm] = useState(false);
  const ring = activeRing(state, players);
  const open = openIds(state, players);
  const canMark = open.length > 1;
  const inRing = ring.includes(me.id);
  const meGuessed = isGuessed(state, me.id);
  const placeOf = (id: string) => state.marks.findIndex((m) => m.id === id) + 1;
  const lastPending = [...state.marks].reverse().find((m) => !isFinal(m, now));
  const pendingOf = (id: string) => {
    const m = state.marks.find((x) => x.id === id);
    return !!m && !isFinal(m, now);
  };
  const mark = (id: string) => {
    haptic('success');
    send({ type: 'mark', target: id });
  };
  const undo = (id: string) => {
    haptic('tap');
    send({ type: 'undo', target: id });
  };

  return (
    // Der Toast schwebt unten: Platz lassen, damit er keinen „Richtig"-Knopf verdeckt.
    <div className={`stack-3 ${lastPending ? 'wbi-guess--toast' : ''}`}>
      <div className="wbi-cat">{category}</div>

      {inRing ? (
        <>
          <div className="abzug bigcard wbi-own">
            <div className={`abzug__foto ${meGuessed ? '' : 'abzug__foto--leer'}`}>
              <div className="bigcard__kicker">{meGuessed ? 'Du warst' : 'Du bist'}</div>
              {/* Der eigene Begriff kommt erst ins DOM, wenn er erraten ist. */}
              <div className="bigcard__text t-balance">
                {meGuessed ? state.terms[me.id]?.text : '? ? ?'}
              </div>
              <div className="bigcard__footer">
                {meGuessed
                  ? `Als ${placeOf(me.id)}. erraten`
                  : canMark
                    ? 'Frag reihum mit Ja-/Nein-Fragen.'
                    : 'Du bist als Letztes übrig.'}
              </div>
            </div>
            <span className="abzug__stempel" aria-hidden>
              {formatStamp()}
            </span>
          </div>
          {meGuessed && pendingOf(me.id) && (
            <button className="btn btn--glass btn--block" onClick={() => undo(me.id)}>
              <Icon name="undo" size={16} /> Rückgängig
            </button>
          )}
          {!meGuessed && canMark && (
            <button
              className="btn btn--tinted btn--block wbi-right"
              onClick={() => {
                haptic('tap');
                setConfirm(true);
              }}
            >
              Bei mir richtig geraten
            </button>
          )}
        </>
      ) : (
        <div className="notice notice--neutral">Diese Runde schaust du zu.</div>
      )}

      <div className="t-upper">Die anderen</div>
      <div className="wbi-list">
        {ring
          .filter((id) => id !== me.id)
          .map((id) => {
            const p = players.find((x) => x.id === id);
            const term = state.terms[id];
            if (!p || !term) return null;
            const place = placeOf(id);
            return (
              <div key={id} className={`wbi-row ${place ? 'wbi-row--done' : ''}`}>
                <Avatar name={p.name} color={p.color} photo={p.photo} />
                <div className="grow wbi-row__text">
                  <div className="t-caption">
                    {p.name} · von {term.by === me.id ? 'dir' : nameOf(term.by)}
                  </div>
                  <div className="wbi-row__term">{term.text}</div>
                </div>
                {pendingOf(id) ? (
                  <button
                    className="btn btn--plain btn--sm"
                    aria-label={`Richtig bei ${p.name} zurücknehmen`}
                    onClick={() => undo(id)}
                  >
                    <Icon name="undo" size={16} /> Rückgängig
                  </button>
                ) : place > 0 ? (
                  <span className="wbi-row__place">
                    <Icon name="check" size={18} strokeWidth={2.4} /> {place}.
                  </span>
                ) : canMark ? (
                  <button
                    className="btn btn--tinted btn--sm wbi-right"
                    aria-label={`${p.name} hat richtig geraten`}
                    onClick={() => mark(id)}
                  >
                    Richtig
                  </button>
                ) : (
                  <span className="t-caption">übrig</span>
                )}
              </div>
            );
          })}
      </div>

      {lastPending && (
        <div className="wbi-toast" role="status">
          <span className="grow">
            {lastPending.id === me.id ? 'Du bist' : `${nameOf(lastPending.id)} ist`}{' '}
            {state.terms[lastPending.id]?.text}
          </span>
          <button className="btn btn--plain btn--sm" onClick={() => undo(lastPending.id)}>
            <Icon name="undo" size={16} /> Rückgängig
          </button>
        </div>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Richtig geraten?">
        <div className="stack-3">
          <div className="notice notice--orange">
            Dein Begriff wird aufgedeckt. Die anderen können es zurücknehmen – du hast ihn dann
            aber schon gesehen.
          </div>
          <button
            className="btn btn--brand btn--block btn--lg"
            onClick={() => {
              setConfirm(false);
              mark(me.id);
            }}
          >
            Ja, aufdecken
          </button>
          <button className="btn btn--glass btn--block" onClick={() => setConfirm(false)}>
            Abbrechen
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/** Die erste Person verteilt – und wer etwas abbekommt, sieht seine Menge. */
function DealSection({
  state,
  players,
  me,
  now,
  nameOf,
  send,
}: StepProps & { now: number; nameOf: (id: string) => string }) {
  const first = firstFinal(state, now);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [closed, setClosed] = useState(false);
  if (!first) return null;

  if (state.dealt) {
    const parts = Object.entries(state.dealt).map(([id, n]) => `${nameOf(id)} ${n}`);
    const mine = state.dealt[me.id];
    return (
      <div className="stack-3">
        <div className="notice notice--orange" role="status">
          {first === me.id ? 'Du hast' : `${nameOf(first)} hat`} verteilt: {parts.join(', ')}.
        </div>
        {mine && (
          <DrinkCall
            player={me}
            baseSips={mine}
            label={`von ${nameOf(first)}`}
            source="wer-bin-ich"
            resetKey={`deal-${state.round}`}
          />
        )}
      </div>
    );
  }

  if (first !== me.id) {
    return (
      <div className="notice notice--orange" role="status">
        {nameOf(first)} war am schnellsten und verteilt gleich {DEAL_SIPS} Schlucke.
      </div>
    );
  }

  const given = Object.values(counts).reduce((a, b) => a + b, 0);
  const others = players.filter((p) => p.id !== me.id && p.online !== false);
  return (
    <div>
      <button className="notice notice--mint wbi-deal-open" onClick={() => setClosed(false)}>
        <span>Du warst am schnellsten – verteile {DEAL_SIPS} Schlucke.</span>
        <Icon name="chevronRight" size={16} />
      </button>
      <Sheet open={!closed} onClose={() => setClosed(true)} title={`Verteile ${DEAL_SIPS - given} Schlucke`}>
        <div className="stack-3">
          <div className="wbi-deal">
            {others.map((p) => {
              const n = counts[p.id] ?? 0;
              return (
                <button
                  key={p.id}
                  className={`pchip pchip--pick wbi-deal__pick ${n ? 'wbi-deal__pick--on' : ''}`}
                  disabled={given >= DEAL_SIPS}
                  onClick={() => {
                    haptic('select');
                    setCounts({ ...counts, [p.id]: n + 1 });
                  }}
                >
                  <Avatar name={p.name} color={p.color} photo={p.photo} size="sm" />
                  <span className="pchip__name grow">{p.name}</span>
                  <span className="wbi-deal__count t-mono-num">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="wbi-pair">
            <button className="btn btn--glass btn--lg" onClick={() => setCounts({})}>
              Zurücksetzen
            </button>
            <button
              className="btn btn--brand btn--lg"
              disabled={given !== DEAL_SIPS}
              onClick={() => {
                haptic('success');
                send({ type: 'deal', counts });
              }}
            >
              Verteilen
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

function DoneStep({
  state,
  players,
  me,
  isHost,
  nameOf,
  send,
}: StepProps & { isHost: boolean; nameOf: (id: string) => string }) {
  const last = state.last ? players.find((p) => p.id === state.last) : undefined;
  const order = [...state.marks.map((m) => m.id), ...(state.last ? [state.last] : [])];
  const finalRound = state.goal !== null && state.round >= state.goal;
  const host = players.find((p) => p.isHost);

  return (
    <div className="stack-3">
      {state.last ? (
        <BigCard tone="danger" kicker={`Zuletzt übrig · ${state.terms[state.last]?.text ?? ''}`}>
          {state.last === me.id ? 'Du trinkst' : `${nameOf(state.last)} trinkt`}
        </BigCard>
      ) : (
        <BigCard kicker="Runde vorbei">Niemand ist übrig geblieben.</BigCard>
      )}
      {last && (
        <DrinkCall
          player={last}
          baseSips={LAST_SIPS}
          label="zuletzt übrig"
          source="wer-bin-ich"
          resetKey={`last-${state.round}`}
        />
      )}

      <div className="stack-2">
        {order.map((id, i) => {
          const p = players.find((x) => x.id === id);
          const isLast = id === state.last;
          return (
            <div key={id} className="result-row" style={{ ['--i' as string]: i }}>
              <RankTag place={i + 1} />
              {p && <Avatar name={p.name} color={p.color} photo={p.photo} size="sm" />}
              <div className="grow">
                <div className="t-caption">{nameOf(id)}</div>
                <div className="t-headline">{state.terms[id]?.text}</div>
              </div>
              {i === 0 && <span className="t-caption wbi-note--first">verteilt</span>}
              {isLast && <span className="t-caption wbi-note--last">trinkt</span>}
            </div>
          );
        })}
      </div>

      {isHost || !host ? (
        <button className="btn btn--brand btn--block btn--lg" onClick={() => send({ type: 'next' })}>
          {finalRound ? 'Zum Endstand' : 'Nächste Runde'}
        </button>
      ) : (
        <div className="t-caption t-center">{host.name} startet die nächste Runde.</div>
      )}
    </div>
  );
}
