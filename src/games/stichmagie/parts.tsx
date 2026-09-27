import type { ReactNode } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Icon } from '../../components/icons';
import { haptic } from '../../lib/haptics';
import type { GamePlayer } from '../types';
import { MagicCard, SuitMark } from './art';
import { cardsThisRound, type Seat, type State } from './game';
import {
  MAGIER,
  NARREN,
  SPECIAL_ID,
  SPECIAL_INFO,
  SUITS,
  playedName,
  suitName,
  type Special,
} from './rules';

/** Spieler zu einem Sitzplatz – auch wenn die Person die Lobby verlassen hat. */
export function playerFor(seat: Seat, players: GamePlayer[]): GamePlayer {
  return (
    players.find((p) => p.id === seat.id) ?? {
      id: seat.id,
      name: seat.name,
      color: seat.color,
      online: false,
    }
  );
}

export function isAway(id: string, players: GamePlayer[]): boolean {
  const p = players.find((x) => x.id === id);
  return !p || p.online === false;
}

/** Sitzplätze ab der Person links von mir – ich stehe am Ende. */
export function seatsFromMe(state: State, meId: string): Seat[] {
  const i = state.seats.findIndex((s) => s.id === meId);
  if (i < 0) return state.seats;
  return [...state.seats.slice(i + 1), ...state.seats.slice(0, i + 1)];
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

// ---------------------------------------------------------------------------
// Die Runde oben: wer sitzt wo, wer hat was angesagt
// ---------------------------------------------------------------------------

export function SeatStrip({
  state,
  players,
  me,
  actors,
  forehead,
}: {
  state: State;
  players: GamePlayer[];
  me: GamePlayer;
  actors: string[];
  forehead: boolean;
}) {
  const bidding = ['trump', 'werwolf', 'bid'].includes(state.phase);
  const dealer = state.seats[state.dealer]?.id;
  return (
    <div
      className={`sm-seats ${state.seats.length > 6 ? 'sm-seats--many' : ''}`}
      style={{ ['--cols' as string]: Math.ceil(state.seats.length / 2) }}
      role="list"
      aria-label="Die Runde"
    >
      {seatsFromMe(state, me.id).map((seat) => {
        const p = playerFor(seat, players);
        const mine = seat.id === me.id;
        const bid = state.bids[seat.id];
        const won = state.won[seat.id] ?? 0;
        const shift = state.shifts[seat.id] ?? 0;
        const turn = actors.includes(seat.id);
        const away = isAway(seat.id, players);
        const auto = state.auto[seat.id];
        const tone =
          bid === undefined || bidding
            ? ''
            : won === bid
              ? 'sm-seat__score--hit'
              : won > bid
                ? 'sm-seat__score--over'
                : '';
        const other = forehead && !mine ? state.hands[seat.id]?.[0] : undefined;
        return (
          <div
            key={seat.id}
            data-seat={seat.id}
            role="listitem"
            className={[
              'sm-seat',
              turn && 'sm-seat--turn',
              mine && 'sm-seat--me',
              away && 'sm-seat--away',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="sm-seat__avatar">
              <Avatar name={p.name} color={p.color} photo={mine ? me.photo : undefined} size="sm" />
              {seat.id === dealer && (
                <span className="sm-seat__dealer" title="gibt diese Runde">
                  G
                </span>
              )}
            </span>
            <span className="sm-seat__name">{mine ? 'Du' : firstName(seat.name)}</span>
            <span className={`sm-seat__score t-mono-num ${tone}`}>
              {bid === undefined ? (
                turn && state.phase === 'bid' ? (
                  '…'
                ) : (
                  '–'
                )
              ) : bidding ? (
                bid
              ) : (
                <>
                  {won}
                  <span className="sm-seat__of">/{bid}</span>
                  {shift !== 0 && (
                    <span className="sm-seat__shift">{shift > 0 ? `+${shift}` : shift}</span>
                  )}
                </>
              )}
            </span>
            {(away || auto) && <span className="sm-seat__tag">{auto ? 'Autopilot' : 'weg'}</span>}
            {other !== undefined && (
              <MagicCard id={other} size="xs" className="sm-seat__forehead" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trumpf und Ansagen
// ---------------------------------------------------------------------------

export function TrumpBadge({ state }: { state: State }) {
  const choosing = state.phase === 'trump' || state.phase === 'werwolf';
  return (
    <span className="sm-trump">
      {state.indicator != null ? (
        <MagicCard id={state.indicator} size="xs" />
      ) : (
        <span className="sm-trump__none" />
      )}
      <span className="sm-trump__text">
        <span className="t-caption">Trumpf</span>
        <strong>
          {choosing ? (
            'wird gewählt'
          ) : state.trump == null ? (
            'Keiner'
          ) : (
            <>
              <SuitMark suit={state.trump} size={14} /> {suitName(state.trump)}
            </>
          )}
        </strong>
      </span>
    </span>
  );
}

/** „Ansagen 4 / 5" – die Zahl, auf die am Tisch alle schauen. */
export function BidMeter({ state }: { state: State }) {
  const cards = cardsThisRound(state);
  const values = Object.values(state.bids);
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const diff = sum - cards;
  const complete = values.length === state.seats.length;
  return (
    <span
      className={`sm-meter ${complete ? (diff > 0 ? 'sm-meter--over' : diff < 0 ? 'sm-meter--under' : 'sm-meter--even') : ''}`}
    >
      <span className="t-caption">Ansagen</span>
      <strong className="t-mono-num">
        {sum}
        <span className="sm-meter__of"> / {cards}</span>
      </strong>
      {complete && (
        <span className="sm-meter__hint">
          {diff === 0 ? 'geht auf' : diff > 0 ? `${diff} zu viel` : `${-diff} frei`}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Auswahlknöpfe
// ---------------------------------------------------------------------------

export function SuitButtons({
  onPick,
  allowNone,
  highlight,
}: {
  onPick: (suit: number) => void;
  allowNone?: boolean;
  highlight?: number | null;
}) {
  return (
    <div className="sm-suits">
      {SUITS.map((s, i) => (
        <button
          key={s.name}
          className={`sm-suitbtn pressable ${highlight === i ? 'sm-suitbtn--hint' : ''}`}
          style={{ ['--suit' as string]: s.color }}
          onClick={() => {
            haptic('select');
            onPick(i);
          }}
        >
          <SuitMark suit={i} size={22} />
          <span>{s.name}</span>
        </button>
      ))}
      {allowNone && (
        <button
          className="sm-suitbtn sm-suitbtn--none pressable"
          onClick={() => {
            haptic('select');
            onPick(-1);
          }}
        >
          <Icon name="ban" size={18} />
          <span>Kein Trumpf</span>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Punkteblock
// ---------------------------------------------------------------------------

export function ScoreBlock({ state, me }: { state: State; me: GamePlayer }) {
  const seats = state.seats;
  return (
    <div className="sm-block">
      <table className="sm-block__table">
        <thead>
          <tr>
            <th className="sm-block__round">Rd.</th>
            {seats.map((s) => (
              <th key={s.id} className={s.id === me.id ? 'sm-block__me' : ''}>
                {s.id === me.id ? 'Du' : firstName(s.name).slice(0, 7)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.log.map((r, i) => (
            <tr key={i}>
              <td className="sm-block__round">
                {i + 1}
                <span className="t-caption"> · {r.cards}</span>
                {r.trump != null && <SuitMark suit={r.trump} size={10} />}
              </td>
              {seats.map((s) => {
                const d = r.delta[s.id] ?? 0;
                return (
                  <td key={s.id} className={d > 0 ? 'sm-block__hit' : 'sm-block__miss'}>
                    <span className="sm-block__delta">{d > 0 ? `+${d}` : d}</span>
                    <span className="sm-block__bid">
                      {r.won[s.id] ?? 0}/{r.bids[s.id] ?? 0}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
          {!state.log.length && (
            <tr>
              <td colSpan={seats.length + 1} className="t-caption t-center">
                Nach der ersten Runde steht hier, wer wie viel angesagt und gemacht hat.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="sm-block__round">Σ</td>
            {seats.map((s) => (
              <td key={s.id} className="t-mono-num">
                {state.scores[s.id] ?? 0}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="t-caption t-center">Oben die Punkte der Runde, darunter Stiche / Ansage.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Regeln
// ---------------------------------------------------------------------------

export function RulesList({ specials }: { specials: readonly Special[] }) {
  return (
    <div className="stack-3">
      <div className="sm-rule">
        <MagicCard id={MAGIER[0]} size="sm" />
        <div>
          <div className="t-headline">Magier</div>
          <p className="t-sub">
            Schlägt jede Farbkarte. Der erste Magier im Stich gewinnt. Darf immer gespielt werden.
          </p>
        </div>
      </div>
      <div className="sm-rule">
        <MagicCard id={NARREN[0]} size="sm" />
        <div>
          <div className="t-headline">Narr</div>
          <p className="t-sub">
            Verliert immer – außer es liegen nur Narren, dann der erste. Darf immer gespielt werden.
          </p>
        </div>
      </div>
      {specials.map((s) => (
        <div key={s} className="sm-rule">
          <MagicCard id={SPECIAL_ID[s]} size="sm" />
          <div>
            <div className="t-headline">
              {SPECIAL_INFO[s].name} <span className="t-caption">· {SPECIAL_INFO[s].edition}</span>
            </div>
            <p className="t-sub">{SPECIAL_INFO[s].rule}</p>
          </div>
        </div>
      ))}
      <div className="notice notice--neutral">
        Farbe bedienen ist Pflicht – mit Farbkarten. Magier, Narren und alle Sonderkarten dürfen
        immer gelegt werden. Getroffen: 20 Punkte plus 10 je Stich. Daneben: minus 10 je Stich
        Abstand.
      </div>
    </div>
  );
}

export function PlayedLabel({ state, index }: { state: State; index: number }) {
  const p = state.trick[index];
  if (!p) return null;
  return <>{playedName(p, state.vampirAs)}</>;
}

export function Hint({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: 'turn' | 'wait' | 'magic';
}) {
  return <div className={`sm-hint ${tone ? `sm-hint--${tone}` : ''}`}>{children}</div>;
}
