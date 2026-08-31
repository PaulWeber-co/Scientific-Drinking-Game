import { Icon } from '../../components/icons';
import { Avatar } from '../../components/ui/Avatar';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { GamePlayer } from '../types';

/** Große Spielkarte – der zentrale visuelle Anker fast aller Spiele. */
export function BigCard({
  kicker,
  children,
  footer,
  tone = 'default',
  animateKey,
}: {
  kicker?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  tone?: 'default' | 'accent' | 'danger';
  animateKey?: string | number;
}) {
  return (
    <div key={animateKey} className={`bigcard bigcard--${tone}`}>
      {kicker && <div className="bigcard__kicker">{kicker}</div>}
      <div className="bigcard__text t-balance">{children}</div>
      {footer && <div className="bigcard__footer">{footer}</div>}
    </div>
  );
}

export function PlayerChip({ player, note }: { player: GamePlayer; note?: ReactNode }) {
  return (
    <span className={`pchip ${player.online === false ? 'pchip--off' : ''}`}>
      <Avatar name={player.name} color={player.color} size="sm" />
      <span className="pchip__name">{player.name}</span>
      {player.drinkIcon && <Icon name={player.drinkIcon} size={15} className="pchip__drink" />}
      {note && <span className="t-caption">{note}</span>}
    </span>
  );
}

export function WaitingFor({ names, what }: { names: string[]; what: string }) {
  return (
    <div className="waiting">
      <div className="spinner" />
      <div className="stack-2">
        <div className="t-headline">{what}</div>
        <div className="t-sub">{names.length ? names.join(', ') : 'niemand mehr'}</div>
      </div>
    </div>
  );
}

/** Countdown. Ruft onDone genau einmal auf. */
export function Countdown({
  until,
  onDone,
  size = 'lg',
}: {
  until: number;
  onDone?: () => void;
  size?: 'sm' | 'lg';
}) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()));
  const fired = useRef(false);
  useEffect(() => {
    fired.current = false;
    const t = setInterval(() => {
      const l = Math.max(0, until - Date.now());
      setLeft(l);
      if (l <= 0 && !fired.current) {
        fired.current = true;
        onDone?.();
      }
    }, 100);
    return () => clearInterval(t);
  }, [until, onDone]);
  const s = Math.ceil(left / 1000);
  return (
    <div className={`countdown countdown--${size} t-mono-num ${s <= 5 ? 'countdown--hot' : ''}`}>
      {s}
    </div>
  );
}

/** Ein einfacher Fortschrittsring (Rundenanzeige, Timer). */
export function Ring({ value, label }: { value: number; label?: ReactNode }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div
      className="ring"
      style={{ ['--pct' as string]: `${pct * 360}deg` }}
      role="img"
      aria-label={typeof label === 'string' ? label : undefined}
    >
      <div className="ring__inner">{label}</div>
    </div>
  );
}

export function Choice({
  options,
  onPick,
  disabled,
}: {
  options: { id: string; label: ReactNode; tone?: string }[];
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="choice">
      {options.map((o) => (
        <button
          key={o.id}
          className="choice__btn pressable"
          style={o.tone ? { ['--tint' as string]: o.tone } : undefined}
          disabled={disabled}
          onClick={() => onPick(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Gleichzeitige Abstimmung auf einen Mitspieler. */
export function VoteGrid({
  players,
  myVote,
  onVote,
  exclude = [],
  disabled,
}: {
  players: GamePlayer[];
  myVote?: string;
  onVote: (id: string) => void;
  exclude?: string[];
  disabled?: boolean;
}) {
  return (
    <div className="votegrid">
      {players
        .filter((p) => !exclude.includes(p.id))
        .map((p, i) => (
          <button
            key={p.id}
            className={`votecard pressable ${myVote === p.id ? 'votecard--on' : ''}`}
            style={{ ['--i' as string]: i }}
            disabled={disabled || Boolean(myVote)}
            onClick={() => onVote(p.id)}
          >
            <Avatar name={p.name} color={p.color} />
            <span className="votecard__name">{p.name}</span>
          </button>
        ))}
    </div>
  );
}

/** Ergebnis einer Abstimmung als animierte Balken. */
export function VoteResult({
  players,
  counts,
  highlight,
}: {
  players: GamePlayer[];
  counts: Record<string, number>;
  highlight?: string | null;
}) {
  const max = Math.max(1, ...Object.values(counts));
  const ranked = [...players].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
  return (
    <div className="stack-2">
      {ranked.map((p, i) => {
        const n = counts[p.id] ?? 0;
        return (
          <div
            key={p.id}
            className={`votebar ${highlight === p.id ? 'votebar--top' : ''}`}
            style={{ ['--i' as string]: i, ['--pct' as string]: `${(n / max) * 100}%` }}
          >
            <span className="votebar__fill" />
            <Avatar name={p.name} color={p.color} size="sm" />
            <span className="grow t-headline">{p.name}</span>
            <span className="t-mono-num t-headline">{n}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Zahl, die beim Erscheinen hochzählt. */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value <= 0) {
      setShown(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Weiches Ausklingen statt linearem Hochzaehlen
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown}</>;
}
