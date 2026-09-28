import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { haptic } from '../../lib/haptics';
import { sound } from '../../lib/sound';
import { DrinkCallList } from '../shared/DrinkCall';
import { Explosion } from '../shared/Explosion';
import { GameFrame } from '../shared/GameFrame';
import type { GameActionInput, GamePlayer, GameRuntime } from '../types';
import { MagicCard, SuitMark } from './art';
import {
  actorsOf,
  cardsThisRound,
  dealerId,
  forbiddenNow,
  hexeTakeable,
  nextSeatId,
  prevSeatId,
  sortHand,
  type State,
} from './game';
import { meta } from './meta';
import {
  BidMeter,
  Hint,
  RulesList,
  ScoreBlock,
  SeatStrip,
  SuitButtons,
  TrumpBadge,
  firstName,
  isAway,
  playerFor,
} from './parts';
import {
  MAGIER,
  NARREN,
  SPECIAL_ID,
  cardName,
  choiceFor,
  kindOf,
  ledSuit,
  legalCards,
  playedName,
  suitName,
  type Played,
} from './rules';

/** So lange bleibt ein fertiger Stich liegen, bevor er eingesammelt wird. */
export const SHOW_TRICK_MS = 2300;

/** Wie viel „daneben" wie viel Trinken heißt. */
export function sipsForMiss(diff: number): number {
  return Math.min(3, Math.max(1, diff));
}

export function Table({ state, players, me, dispatch, quit }: GameRuntime<State>) {
  const send = (a: GameActionInput) => dispatch(a);
  const [sheet, setSheet] = useState<null | 'block' | 'regeln'>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [take, setTake] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);

  const seated = state.seats.some((s) => s.id === me.id);
  const cards = cardsThisRound(state);
  const actors = actorsOf(state);
  const myTurn = seated && actors.includes(me.id);
  const seatName = (id: string) => {
    if (id === me.id) return 'Du';
    const seat = state.seats.find((s) => s.id === id);
    return seat ? firstName(seat.name) : 'Jemand';
  };
  const forehead =
    state.options.forehead &&
    cards === 1 &&
    ['trump', 'werwolf', 'bid', 'play'].includes(state.phase);

  // Auswahl gilt nur für diesen Stich und diese Phase.
  useEffect(() => {
    setSel(null);
    setTake(null);
  }, [state.phase, state.trickNo, state.round]);

  const hand = useMemo(
    () => sortHand(state.hands[me.id] ?? [], state.trump),
    [state.hands, me.id, state.trump],
  );
  const legal = useMemo(
    () =>
      state.phase === 'play' && myTurn
        ? new Set(legalCards(state.hands[me.id] ?? [], state.trick, state.vampirAs))
        : null,
    [state.phase, myTurn, state.hands, me.id, state.trick, state.vampirAs],
  );

  // Der fertige Stich: Knall, Jubel oder einfach nur Einsammeln.
  const result = state.result;
  useEffect(() => {
    if (state.phase !== 'trick' || !result) return;
    if (result.bomb) {
      sound('boom');
      haptic('boom');
    } else if (result.winner === me.id) {
      haptic('success');
    } else {
      haptic('heavy');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal je Stich
  }, [state.phase, state.seq]);

  // Rundenbeginn: kurz groß die Rundennummer. Nur für frische Runden – wer
  // mitten in der Ansage neu lädt, bekommt keine Einblendung ins Gesicht.
  const [splash, setSplash] = useState<string | null>(null);
  const roundKey = `${state.round}:${state.dealer}:${state.plan.length}`;
  useEffect(() => {
    if (!['trump', 'werwolf', 'bid'].includes(state.phase)) return;
    if (Object.keys(state.bids).length) return;
    setSplash(roundKey);
    const t = setTimeout(() => setSplash(null), 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur je neuer Runde
  }, [roundKey]);

  // Austeilen spürt man: ein Anschlag, dann ein leises Rattern im Takt der
  // Karten, die in den Fächer fliegen (45 ms je Karte, wie `sm-deal`).
  const handSize = (state.hands[me.id] ?? []).length;
  useEffect(() => {
    if (!seated || !handSize || !['trump', 'werwolf', 'bid'].includes(state.phase)) return;
    if (Object.keys(state.bids).length) return;
    haptic('heavy');
    const ticks = Array.from({ length: Math.min(handSize, 10) }, (_, i) =>
      setTimeout(() => haptic('tick'), 180 + i * 60),
    );
    return () => ticks.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur je neuer Runde
  }, [roundKey]);

  // Legt jemand anderes eine Karte, tippt es kurz – wer das Handy weglegt,
  // merkt so, dass der Stich wächst und er bald dran ist.
  const trickLen = useRef(state.trick.length);
  useEffect(() => {
    const before = trickLen.current;
    trickLen.current = state.trick.length;
    if (state.trick.length <= before) return;
    const last = state.trick[state.trick.length - 1];
    if (last && last.by !== me.id) haptic('tap');
  }, [state.trick, me.id]);

  // Der Stich fliegt zum Gewinner, kurz bevor der Host ihn einsammelt.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    setGone(false);
    if (state.phase !== 'trick' || state.queue.length) return;
    // Früh genug, dass auch bei zehn Karten der letzte Flug fertig ist,
    // bevor der Host den Stich einsammelt.
    const t = setTimeout(() => setGone(true), SHOW_TRICK_MS - 700);
    return () => clearTimeout(t);
  }, [state.phase, state.seq, state.queue.length]);

  const tapCard = (card: number) => {
    if (state.phase === 'play' && myTurn) {
      if (!legal?.has(card)) {
        haptic('error');
        setShake(card);
        setTimeout(() => setShake(null), 400);
        return;
      }
      if (sel === card && !choiceFor(card, state.vampirAs)) {
        play(card);
        return;
      }
      haptic('select');
      setSel(card);
      return;
    }
    if ((state.phase === 'pass' && actors.includes(me.id)) || (state.phase === 'hexe' && myTurn)) {
      haptic('select');
      setSel(sel === card ? null : card);
    }
  };

  const play = (card: number, extra: Record<string, unknown> = {}) => {
    haptic('press');
    setSel(null);
    send({ type: 'play', card, ...extra });
  };

  const subtitle = seated
    ? `Runde ${state.round + 1} von ${state.plan.length} · ${cards} ${cards === 1 ? 'Karte' : 'Karten'}`
    : 'Du schaust zu';

  return (
    <GameFrame
      title={meta.name}
      accent={meta.accent}
      subtitle={subtitle}
      onQuit={quit}
      action={
        <button
          className="sm-headbtn pressable"
          aria-label="Punkteblock"
          onClick={() => {
            haptic('tap');
            setSheet('block');
          }}
        >
          <Icon name="ranking" size={17} />
        </button>
      }
    >
      <div className="sm-table">
        {splash === roundKey && (
          <div className="sm-splash" key={splash} aria-hidden>
            <span className="t-upper">Runde</span>
            <strong>{state.round + 1}</strong>
            <span className="sm-splash__sub">
              {cards} {cards === 1 ? 'Karte' : 'Karten'} ·{' '}
              {state.phase !== 'bid' ? (
                'Trumpf wird gewählt'
              ) : state.trump == null ? (
                'kein Trumpf'
              ) : (
                <>
                  <SuitMark suit={state.trump} size={14} /> {suitName(state.trump)} ist Trumpf
                </>
              )}
            </span>
          </div>
        )}
        <SeatStrip state={state} players={players} me={me} actors={actors} forehead={forehead} />

        <div className="sm-infobar">
          <TrumpBadge state={state} />
          <BidMeter state={state} />
          <button
            className="sm-infobar__help pressable"
            aria-label="Kartenregeln"
            onClick={() => {
              haptic('tap');
              setSheet('regeln');
            }}
          >
            <Icon name="info" size={16} />
          </button>
        </div>

        <Felt
          state={state}
          me={me}
          gone={gone}
          take={take}
          onTake={(c) => {
            haptic('select');
            setTake(take === c ? null : c);
          }}
          seatName={seatName}
        />

        <Panel
          state={state}
          players={players}
          me={me}
          seated={seated}
          myTurn={myTurn}
          sel={sel}
          take={take}
          send={send}
          play={play}
          seatName={seatName}
          blind={forehead}
        />

        {seated && state.phase !== 'score' && (
          <Hand
            state={state}
            hand={hand}
            legal={legal}
            sel={sel}
            shake={shake}
            hidden={forehead}
            active={
              (state.phase === 'play' && myTurn) ||
              (state.phase === 'pass' && actors.includes(me.id)) ||
              (state.phase === 'hexe' && myTurn)
            }
            onTap={tapCard}
          />
        )}
      </div>

      <Sheet open={sheet === 'block'} onClose={() => setSheet(null)} title="Punkteblock">
        <ScoreBlock state={state} me={me} />
      </Sheet>
      <Sheet open={sheet === 'regeln'} onClose={() => setSheet(null)} title="Die Karten">
        <RulesList specials={state.options.specials} />
      </Sheet>
    </GameFrame>
  );
}

// ---------------------------------------------------------------------------
// Der Tisch in der Mitte
// ---------------------------------------------------------------------------

function trickSize(n: number) {
  return n <= 3 ? 'lg' : n <= 5 ? 'md' : 'sm';
}

function Felt({
  state,
  me,
  gone,
  take,
  onTake,
  seatName,
}: {
  state: State;
  me: GamePlayer;
  gone: boolean;
  take: number | null;
  onTake: (card: number) => void;
  seatName: (id: string) => string;
}) {
  const bidding = ['trump', 'werwolf', 'bid'].includes(state.phase);
  const result = state.result;
  const takeable = state.phase === 'hexe' && state.turn === me.id ? hexeTakeable(state) : [];

  // Der Stich fliegt dorthin, wo der Gewinner sitzt: zu seinem Platz oben
  // oder – beim eigenen Stich – hinunter zur eigenen Hand. Gemessen wird erst
  // im Moment des Abflugs, dann liegt alles an seinem Platz.
  const feltRef = useRef<HTMLDivElement>(null);
  const winnerId = result?.winner ?? null;
  useLayoutEffect(() => {
    const felt = feltRef.current;
    if (!gone || !felt || !winnerId) return;
    const target =
      winnerId === me.id
        ? document.querySelector('.sm-handbox')
        : document.querySelector(`[data-seat="${winnerId}"]`);
    if (!target) return;
    const t = target.getBoundingClientRect();
    const tx = t.left + t.width / 2;
    const ty = winnerId === me.id ? t.top + 40 : t.top + t.height / 2;
    felt.querySelectorAll<HTMLElement>('.sm-play').forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--dx', `${Math.round(tx - (r.left + r.width / 2))}px`);
      el.style.setProperty('--dy', `${Math.round(ty - (r.top + r.height / 2))}px`);
    });
  }, [gone, winnerId, me.id]);

  if (bidding) {
    const wolf = state.werwolfBy;
    return (
      <div className="sm-felt">
        <div className="sm-deck" aria-hidden>
          <MagicCard id={null} size="md" className="sm-deck__card sm-deck__card--1" />
          <MagicCard id={null} size="md" className="sm-deck__card sm-deck__card--2" />
        </div>
        <div className="sm-indicator">
          {state.indicator != null ? (
            <MagicCard
              key={`${state.round}-${state.indicator}`}
              id={state.indicator}
              size="lg"
              className="sm-flip"
            />
          ) : (
            <div className="sm-indicator__empty">Kein Stapel mehr</div>
          )}
          <div className="sm-indicator__label">
            {wolf
              ? `${seatName(wolf)} ${wolf === me.id ? 'hast' : 'hat'} getauscht`
              : 'Trumpfkarte'}
          </div>
        </div>
      </div>
    );
  }

  if (state.phase === 'score' || state.phase === 'over') return null;

  const size = trickSize(state.seats.length);
  const leader = state.trick[0]?.by ?? state.turn;
  const winIdx = result
    ? state.trick.findIndex((p) => p.by === (result.winner ?? result.lead))
    : -1;
  const winnerIsMe = result?.winner === me.id;
  const poof = gone && !!result?.bomb;

  return (
    <div
      ref={feltRef}
      className={`sm-felt ${gone ? (poof ? 'sm-felt--poof' : 'sm-felt--gone') : ''}`}
      style={{ ['--to' as string]: winnerIsMe ? '180px' : '-190px' }}
    >
      {result?.bomb && state.phase === 'trick' && <Explosion key={state.seq} />}
      {state.trick.length === 0 && (
        <div className="sm-felt__empty">
          {state.turn === me.id ? 'Du spielst aus' : `${seatName(leader)} spielt aus`}
        </div>
      )}
      <div className="sm-trick">
        {state.trick.map((p, i) => {
          const canTake = takeable.includes(p.card);
          const won = i === winIdx;
          return (
            <div
              key={`${state.round}-${state.trickNo}-${p.by}`}
              className={[
                'sm-play',
                won && result && !result.bomb && 'sm-play--win',
                won && result?.bomb && 'sm-play--lead',
                p.swapped && 'sm-play--swapped',
                canTake && 'sm-play--takeable',
                take === p.card && 'sm-play--taken',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                ['--from' as string]: p.by === me.id ? 1 : -1,
                ['--i' as string]: i,
              }}
            >
              {canTake ? (
                <button
                  className="sm-play__btn"
                  onClick={() => onTake(p.card)}
                  aria-label={`${cardName(p.card)} nehmen`}
                >
                  <MagicCard id={p.card} size={size} badge={badgeFor(p, state)} />
                </button>
              ) : (
                <MagicCard
                  id={p.card}
                  size={size}
                  badge={badgeFor(p, state)}
                  title={playedName(p, state.vampirAs)}
                />
              )}
              <span className="sm-play__who">{seatName(p.by)}</span>
              {won && winnerIsMe && state.phase === 'trick' && (
                <span className="sm-burst" aria-hidden>
                  {Array.from({ length: 12 }, (_, k) => (
                    <i key={k} style={{ ['--a' as string]: `${k * 30 + (k % 2) * 12}deg` }} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {result && state.phase === 'trick' && (
        <div
          className={`sm-banner ${result.bomb ? 'sm-banner--bomb' : winnerIsMe ? 'sm-banner--me' : ''}`}
        >
          {result.bomb
            ? 'Bombe! Den Stich bekommt niemand.'
            : result.fairyBeatsDragon
              ? `Die Fee bezwingt den Drachen – ${winnerIsMe ? 'dein Stich' : `Stich für ${seatName(result.winner!)}`}!`
              : winnerIsMe
                ? 'Dein Stich!'
                : `${seatName(result.winner!)} sticht`}
        </div>
      )}
    </div>
  );
}

function badgeFor(p: Played, state: State) {
  // Von der Hexe hineingelegt: zählt nicht, egal was es für eine Karte ist.
  if (p.swapped) return 'getauscht';
  const kind = kindOf(p.card);
  const copy = kind === 'vampir' ? state.vampirAs : null;
  const eff = copy != null ? kindOf(copy) : kind;
  if (p.suit !== undefined && (eff === 'jongleur' || eff === 'wolke')) {
    return (
      <>
        <SuitMark suit={p.suit} size={10} /> {suitName(p.suit)}
      </>
    );
  }
  if (p.shape) return p.shape === 'magier' ? 'als Magier' : 'als Narr';
  if (kind === 'vampir') return copy != null ? `als ${cardName(copy)}` : 'als Narr';
  return null;
}

// ---------------------------------------------------------------------------
// Was jetzt zu tun ist
// ---------------------------------------------------------------------------

function Panel({
  state,
  players,
  me,
  seated,
  myTurn,
  sel,
  take,
  send,
  play,
  seatName,
  blind,
}: {
  state: State;
  players: GamePlayer[];
  me: GamePlayer;
  seated: boolean;
  myTurn: boolean;
  sel: number | null;
  take: number | null;
  send: (a: GameActionInput) => void;
  play: (card: number, extra?: Record<string, unknown>) => void;
  seatName: (id: string) => string;
  /** Karte an der Stirn: die eigene Karte bleibt auch auf dem Knopf geheim. */
  blind: boolean;
}) {
  const cards = cardsThisRound(state);
  const actors = actorsOf(state);

  // Jemand ist weg und blockiert die Runde: ein Knopf für alle.
  const blocked = actors.filter((id) => id !== me.id && isAway(id, players) && !state.auto[id]);
  const takeover = blocked.length > 0 && (
    <div className="sm-away">
      <span className="t-sub">
        {blocked.map(seatName).join(', ')} {blocked.length === 1 ? 'ist' : 'sind'} gerade weg.
      </span>
      {blocked.map((id) => (
        <button
          key={id}
          className="btn btn--tinted btn--sm"
          onClick={() => {
            haptic('press');
            send({ type: 'autopilot', who: id });
          }}
        >
          Für {seatName(id)} übernehmen
        </button>
      ))}
    </div>
  );

  const autoMe = state.auto[me.id] && (
    <div className="sm-away">
      <span className="t-sub">Die App hat für dich gespielt, während du weg warst.</span>
      <button
        className="btn btn--tinted btn--sm"
        onClick={() => {
          haptic('press');
          send({ type: 'manual' });
        }}
      >
        Selbst weiterspielen
      </button>
    </div>
  );

  const extras = (
    <>
      {takeover}
      {autoMe}
      {!seated && <Hint tone="wait">Du schaust zu – bei der nächsten Partie bist du dabei.</Hint>}
    </>
  );

  switch (state.phase) {
    case 'trump':
      return (
        <div className="sm-panel">
          {myTurn ? (
            <>
              <Hint tone="magic">
                Oben liegt{' '}
                {state.indicator != null ? `ein ${cardName(state.indicator)}` : 'eine Sonderkarte'}{' '}
                – du gibst und bestimmst den Trumpf.
              </Hint>
              <SuitButtons onPick={(suit) => send({ type: 'chooseTrump', suit })} />
            </>
          ) : (
            <Hint tone="wait">{seatName(state.turn)} bestimmt den Trumpf …</Hint>
          )}
          {extras}
        </div>
      );

    case 'werwolf':
      return (
        <div className="sm-panel">
          {myTurn ? (
            <>
              <div className="sm-werwolf">
                <MagicCard id={SPECIAL_ID.werwolf} size="md" className="sm-howl" />
                <div className="t-sub">
                  Du hast den <strong>Werwolf</strong>. Er tauscht mit der Trumpfkarte
                  {state.indicator != null
                    ? ` (${cardName(state.indicator)} kommt auf deine Hand)`
                    : ''}{' '}
                  – und du bestimmst den Trumpf.
                </div>
              </div>
              <SuitButtons allowNone onPick={(suit) => send({ type: 'chooseTrump', suit })} />
            </>
          ) : (
            <Hint tone="magic">
              Werwolf! {seatName(state.turn)} tauscht und bestimmt den Trumpf …
            </Hint>
          )}
          {extras}
        </div>
      );

    case 'bid': {
      const forbidden = forbiddenNow(state);
      const sum = Object.values(state.bids).reduce((a, b) => a + b, 0);
      const last = state.turn === dealerId(state);
      return (
        <div className="sm-panel">
          {myTurn ? (
            <>
              <Hint tone="turn">Wie viele Stiche machst du?</Hint>
              <div className="sm-bids">
                {Array.from({ length: cards + 1 }, (_, v) => (
                  <button
                    key={v}
                    className="sm-bid pressable"
                    disabled={v === forbidden}
                    onClick={() => {
                      haptic('press');
                      send({ type: 'bid', who: me.id, value: v });
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              {forbidden !== null ? (
                <p className="t-caption t-center">
                  Die {forbidden} geht nicht – dann ginge die Runde auf ({sum} + {forbidden} ={' '}
                  {cards}).
                </p>
              ) : last ? (
                <p className="t-caption t-center">
                  Du sagst als Letzte:r an. Bisher: {sum} von {cards}.
                </p>
              ) : null}
            </>
          ) : (
            <Hint tone="wait">
              {seated && state.bids[me.id] !== undefined
                ? `Du hast ${state.bids[me.id]} angesagt. ${seatName(state.turn)} überlegt …`
                : `${seatName(state.turn)} überlegt …`}
            </Hint>
          )}
          {state.werwolfBy && (
            <p className="t-caption t-center">
              Werwolf: {seatName(state.werwolfBy)} {state.werwolfBy === me.id ? 'hast' : 'hat'}{' '}
              getauscht –{' '}
              {state.trump == null
                ? 'es gibt keinen Trumpf.'
                : `${suitName(state.trump)} ist Trumpf.`}
            </p>
          )}
          {extras}
        </div>
      );
    }

    case 'play': {
      const choice = sel !== null ? choiceFor(sel, state.vampirAs) : null;
      const led = ledSuit(state.trick, state.vampirAs);
      const need = (state.bids[me.id] ?? 0) - (state.won[me.id] ?? 0);
      return (
        <div className="sm-panel">
          {state.lastPass && seated && <ReceivedNote state={state} me={me} seatName={seatName} />}
          {state.swap && (
            <p className="t-caption t-center">
              Hexe: {seatName(state.swap.by)} {state.swap.by === me.id ? 'hast' : 'hat'}{' '}
              {cardName(state.swap.took)} aus dem Stich genommen.
            </p>
          )}
          {myTurn ? (
            sel === null ? (
              <Hint tone="turn">
                Du bist dran
                {led !== null ? ` – ${suitName(led)} ist gefragt` : ''}.{' '}
                {need > 0
                  ? `Dir fehlen noch ${need} ${need === 1 ? 'Stich' : 'Stiche'}.`
                  : need === 0
                    ? 'Du hast genug – keinen mehr!'
                    : `Schon ${-need} zu viel.`}
              </Hint>
            ) : choice === 'suit' ? (
              <>
                <Hint tone="magic">{cardName(sel)}: Welche Farbe soll die Karte haben?</Hint>
                <SuitButtons highlight={led} onPick={(suit) => play(sel, { suit })} />
              </>
            ) : choice === 'shape' ? (
              <>
                <Hint tone="magic">{cardName(sel)}: Als was spielst du ihn?</Hint>
                <div className="sm-shapes">
                  <button
                    className="sm-shape pressable"
                    onClick={() => play(sel, { shape: 'magier' })}
                  >
                    <MagicCard id={MAGIER[0]} size="sm" /> Als Magier
                  </button>
                  <button
                    className="sm-shape pressable"
                    onClick={() => play(sel, { shape: 'narr' })}
                  >
                    <MagicCard id={NARREN[0]} size="sm" /> Als Narr
                  </button>
                </div>
              </>
            ) : (
              <button className="btn btn--brand btn--block btn--lg" onClick={() => play(sel)}>
                {blind ? 'Karte blind ausspielen' : `${cardName(sel)} ausspielen`}
              </button>
            )
          ) : (
            <Hint tone="wait">
              {seatName(state.turn)} {state.turn === me.id ? 'bist' : 'ist'} dran …
            </Hint>
          )}
          {extras}
        </div>
      );
    }

    case 'trick':
      return <div className="sm-panel">{extras}</div>;

    case 'wolke': {
      const bid = state.bids[state.turn] ?? 0;
      return (
        <div className="sm-panel">
          {myTurn ? (
            <>
              <Hint tone="magic">
                Die Wolke zieht über dich: Deine Ansage von {bid} muss sich um eins ändern.
              </Hint>
              <div className="sm-cloud">
                <button
                  className="sm-bid sm-bid--wide pressable"
                  onClick={() => {
                    haptic('press');
                    send({ type: 'cloud', who: me.id, value: -1 });
                  }}
                >
                  <Icon name="arrowDown" size={18} /> {bid - 1}
                </button>
                <button
                  className="sm-bid sm-bid--wide pressable"
                  onClick={() => {
                    haptic('press');
                    send({ type: 'cloud', who: me.id, value: 1 });
                  }}
                >
                  <Icon name="arrowUp" size={18} /> {bid + 1}
                </button>
              </div>
            </>
          ) : (
            <Hint tone="wait">Wolke! {seatName(state.turn)} ändert die Ansage …</Hint>
          )}
          {extras}
        </div>
      );
    }

    case 'pass': {
      const mustPass = actors.includes(me.id);
      const to = nextSeatId(state, me.id);
      const waiting = actors.filter((id) => id !== me.id).map(seatName);
      return (
        <div className="sm-panel">
          {mustPass ? (
            sel === null ? (
              <Hint tone="magic">
                Jongleur! Wähl eine Karte, die du nach links an {seatName(to)} gibst.
              </Hint>
            ) : (
              <button
                className="btn btn--brand btn--block btn--lg"
                onClick={() => {
                  haptic('press');
                  send({ type: 'pass', card: sel });
                }}
              >
                {cardName(sel)} an {seatName(to)} geben
              </button>
            )
          ) : (
            <Hint tone="wait">
              Jongleur:{' '}
              {waiting.length ? `Es fehlen noch ${waiting.join(', ')}` : 'Karten wandern …'}
            </Hint>
          )}
          {extras}
        </div>
      );
    }

    case 'hexe': {
      return (
        <div className="sm-panel">
          {myTurn ? (
            take === null || sel === null ? (
              <Hint tone="magic">
                Hexe! Tipp eine Karte im Stich an, die du nimmst, und eine Handkarte, die du
                hineinlegst.
              </Hint>
            ) : (
              <button
                className="btn btn--brand btn--block btn--lg"
                onClick={() => {
                  haptic('press');
                  send({ type: 'hexe', card: sel, take });
                }}
              >
                {cardName(take)} nehmen · {cardName(sel)} rein
              </button>
            )
          ) : (
            <Hint tone="wait">Hexe! {seatName(state.turn)} tauscht mit dem Stich …</Hint>
          )}
          {extras}
        </div>
      );
    }

    case 'score':
      return <Score state={state} players={players} me={me} send={send} />;

    default:
      return null;
  }
}

function ReceivedNote({
  state,
  me,
  seatName,
}: {
  state: State;
  me: GamePlayer;
  seatName: (id: string) => string;
}) {
  const from = prevSeatId(state, me.id);
  const card = state.lastPass?.[from];
  if (card === undefined) return null;
  return (
    <div className="sm-received">
      <MagicCard id={card} size="xs" />
      <span className="t-sub">
        Von {seatName(from)} bekommen: <strong>{cardName(card)}</strong>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Die Hand
// ---------------------------------------------------------------------------

function Hand({
  state,
  hand,
  legal,
  sel,
  shake,
  hidden,
  active,
  onTap,
}: {
  state: State;
  hand: number[];
  legal: Set<number> | null;
  sel: number | null;
  shake: number | null;
  hidden: boolean;
  active: boolean;
  onTap: (card: number) => void;
}) {
  // Gemessen, nicht geschätzt: der Fächer muss genau in die Breite passen,
  // sonst hängen die äußeren Karten über den Rand.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(358);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth || 358);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Welche Karten schon beim Geben da waren: nur die werden gestaffelt
  // ausgeteilt. Was später kommt (Jongleur, Hexe), fliegt einzeln herein.
  const dealt = useRef<{ round: number; cards: Set<number> }>({ round: -1, cards: new Set() });
  if (dealt.current.round !== state.round) {
    dealt.current = { round: state.round, cards: new Set(hand) };
  }

  // Ab elf Karten zwei Reihen – sonst sieht man pro Karte nur noch einen Strich.
  const rows =
    hand.length > 10
      ? [hand.slice(0, Math.ceil(hand.length / 2)), hand.slice(Math.ceil(hand.length / 2))]
      : [hand];
  const cw = 62;
  const ch = Math.round(cw * 1.4);
  const avail = width - 12;
  const rowGap = ch - 34;
  const single = rows.length === 1;
  const maxDip = single ? Math.pow((rows[0].length - 1) / 2, 2) * 0.6 : 0;

  // Jede Karte liegt absolut. So gleiten die übrigen in die Lücke, wenn eine
  // gespielt wird – und eine Karte, die von der zweiten in die erste Reihe
  // rückt, bleibt dieselbe Karte, statt neu ausgeteilt zu werden.
  const placed = rows.flatMap((row, r) => {
    const step = row.length > 1 ? Math.min(cw + 6, (avail - cw) / (row.length - 1)) : 0;
    const x0 = (width - (cw + step * (row.length - 1))) / 2;
    const mid = (row.length - 1) / 2;
    return row.map((card, i) => {
      const offset = i - mid;
      return {
        card,
        left: x0 + i * step,
        top: r * rowGap,
        rot: single ? offset * Math.min(3, 18 / row.length) : 0,
        dip: single ? offset * offset * 0.6 : 0,
        z: r * 20 + i + 1,
        order: r * 10 + i,
      };
    });
  });

  return (
    <div className="sm-handbox" ref={box}>
      {hand.length > 0 && (
        <div className={`sm-hand ${active ? 'sm-hand--active' : ''}`} key={`deal-${state.round}`}>
          <div className="sm-hand__area" style={{ height: single ? ch + maxDip : ch + rowGap }}>
            {placed.map((p) => {
              const ok = !legal || legal.has(p.card);
              const fresh = !dealt.current.cards.has(p.card);
              return (
                <button
                  key={p.card}
                  className={[
                    'sm-hand__card',
                    fresh && 'sm-hand__card--fresh',
                    legal && !ok && 'sm-hand__card--no',
                    sel === p.card && 'sm-hand__card--sel',
                    shake === p.card && 'sm-hand__card--shake',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{
                    // Position als Transform statt left/top: rücken die Karten
                    // nach, gleitet das auf der Grafikkarte, ohne dass der
                    // Browser in jedem Bild das Layout neu rechnet.
                    ['--x' as string]: `${p.left}px`,
                    ['--y' as string]: `${p.top}px`,
                    ['--i' as string]: p.order,
                    ['--rot' as string]: `${p.rot}deg`,
                    ['--dip' as string]: `${p.dip}px`,
                    zIndex: sel === p.card ? 60 : p.z,
                  }}
                  aria-label={hidden ? 'deine verdeckte Karte' : cardName(p.card)}
                  aria-pressed={sel === p.card}
                  onClick={() => onTap(p.card)}
                >
                  <MagicCard id={hidden ? null : p.card} size="md" />
                </button>
              );
            })}
          </div>
          {hidden && (
            <p className="t-caption t-center sm-hand__note">Deine Karte klebt an deiner Stirn.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rundenende
// ---------------------------------------------------------------------------

/**
 * Zählt vom alten zum neuen Punktestand – auch ins Minus. `CountUp` aus den
 * Bausteinen kann nur ab null aufwärts und zeigte negative Stände als 0.
 */
/**
 * Zählt den Gesamtstand hoch. Erst wenn die Zeilen liegen (`delay`), damit
 * Einfliegen und Zählen nicht gegeneinander laufen.
 *
 * `feel`: Die eigene Zeile rastet spürbar ein – vorne dicht, hinten immer
 * langsamer wie ein auslaufendes Zählwerk.
 */
function Tally({
  from,
  to,
  delay = 0,
  feel,
}: {
  from: number;
  to: number;
  delay?: number;
  feel?: boolean;
}) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const still =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (from === to || still || typeof requestAnimationFrame === 'undefined') {
      setValue(to);
      return;
    }
    let raf = 0;
    let step = 0;
    const steps = 8;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / 900));
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      const reached = Math.floor(eased * steps);
      if (feel && reached > step) {
        step = reached;
        haptic(reached >= steps ? 'press' : 'tick');
      }
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, delay, feel]);
  return <>{value}</>;
}

function Score({
  state,
  players,
  me,
  send,
}: {
  state: State;
  players: GamePlayer[];
  me: GamePlayer;
  send: (a: GameActionInput) => void;
}) {
  const log = state.log[state.log.length - 1];
  const last = state.round + 1 >= state.plan.length;
  const rows = state.seats.map((seat) => ({
    seat,
    bid: log?.bids[seat.id] ?? 0,
    won: log?.won[seat.id] ?? 0,
    delta: log?.delta[seat.id] ?? 0,
    total: state.scores[seat.id] ?? 0,
  }));
  const leader = Math.max(...rows.map((r) => r.total));

  // Wer daneben lag, trinkt – gruppiert nach Abstand.
  const groups = new Map<number, GamePlayer[]>();
  for (const r of rows) {
    const diff = Math.abs(r.bid - r.won);
    if (!diff) continue;
    const base = sipsForMiss(diff);
    groups.set(base, [...(groups.get(base) ?? []), playerFor(r.seat, players)]);
  }
  const mine = rows.find((r) => r.seat.id === me.id);

  // Punktlandung oder daneben – das Ergebnis der Runde auch in der Hand.
  useEffect(() => {
    if (mine) haptic(mine.delta > 0 ? 'success' : 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal je Abrechnung
  }, [state.round]);

  return (
    <div className="sm-score stack-3">
      <div
        className={`sm-score__head ${mine ? (mine.delta > 0 ? 'sm-score__head--hit' : 'sm-score__head--miss') : ''}`}
      >
        <div className="t-upper">Runde {state.round + 1} abgerechnet</div>
        {mine && (
          <div className="sm-score__me t-display">
            {mine.delta > 0
              ? 'Punktlandung!'
              : mine.won > mine.bid
                ? 'Zu viele Stiche'
                : 'Zu wenige Stiche'}
          </div>
        )}
      </div>
      <div className="sm-score__rows">
        <div className="sm-row sm-row--head" aria-hidden>
          <span />
          <span className="sm-row__bid">Stiche</span>
          <span className="sm-row__delta">Runde</span>
          <span className="sm-row__total">Gesamt</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.seat.id}
            className={`sm-row ${r.seat.id === me.id ? 'sm-row--me' : ''}`}
            style={{ ['--i' as string]: i }}
          >
            <span className="sm-row__name">
              {r.total === leader && leader > 0 && (
                <Icon name="crown" size={14} className="sm-row__crown" />
              )}
              {r.seat.id === me.id ? 'Du' : r.seat.name}
            </span>
            <span className="sm-row__bid t-mono-num">
              {r.won}/{r.bid}
            </span>
            <span
              className={`sm-row__delta t-mono-num ${r.delta > 0 ? 'sm-row__delta--hit' : 'sm-row__delta--miss'}`}
            >
              {r.delta > 0 ? `+${r.delta}` : r.delta}
            </span>
            <span className="sm-row__total t-mono-num">
              <Tally from={r.total - r.delta} to={r.total} delay={450} feel={r.seat.id === me.id} />
            </span>
          </div>
        ))}
      </div>
      {[...groups.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([base, ps]) => (
          <DrinkCallList
            key={base}
            players={ps}
            baseSips={base}
            label={base === 1 ? 'knapp daneben' : 'deutlich daneben'}
            source="stichmagie"
            resetKey={`${state.round}-${base}`}
          />
        ))}
      {groups.size === 0 && (
        <p className="t-sub t-center">Alle haben getroffen. Niemand trinkt – Respekt.</p>
      )}
      <button
        className="btn btn--brand btn--block btn--lg"
        onClick={() => {
          haptic('press');
          send({ type: 'next' });
        }}
      >
        {last ? 'Zum Finale' : `Runde ${state.round + 2} austeilen`}
      </button>
    </div>
  );
}
