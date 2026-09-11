import { useState } from 'react';
import { Icon } from '../../components/icons';
import { Avatar } from '../../components/ui/Avatar';
import { ZONE_META } from '../../engine/bac';
import { findDrink } from '../../engine/drinks';
import { formatEntry, formatGlasses, tally } from '../../engine/tally';
import { formatTime } from '../../lib/format';
import { haptic } from '../../lib/haptics';
import { usePlayer } from '../../store/player';
import { useParty } from '../party/PartyContext';
import type { DrinkEvent } from '../../engine/types';

/**
 * Wer hat wie viel – der Tisch in Gläsern.
 *
 * Lokal (Pass & Play) liegen alle Logs auf diesem Handy, dann steht hier
 * jede Person mit ihren Getränken; ein Tipp auf die Zeile klappt die
 * einzelnen Einträge auf, jeder mit Papierkorb. Online zählt jedes Handy
 * für sich; von den anderen kommt nur die grobe Zone, wie in der Lobby
 * versprochen.
 */
export function TableTally({ hideEmpty = false }: { hideEmpty?: boolean }) {
  const { players, me, mode, removeEventFor } = useParty();
  const myLog = usePlayer((s) => s.log);
  const customs = usePlayer((s) => s.customDrinks);
  const [open, setOpen] = useState<string | null>(null);

  if (players.length < 2) return null;
  if (hideEmpty && !myLog.length && !players.some((p) => p.local?.log.length)) return null;

  return (
    <section className="card stack-3">
      <div className="row-between">
        <span className="t-upper">Der Tisch</span>
        <span className="t-caption">in Gläsern</span>
      </div>
      <div className="stack-3">
        {players.map((p) => {
          const log = p.id === me.id ? myLog : p.local?.log;
          const mine = p.id === me.id;
          // Ein Gerät, eine Liste eigener Getränke – sie gilt auch für Gäste.
          const t = log ? tally(log, customs) : null;
          const name = mine ? 'Du' : p.name;
          const aufgeklappt = open === p.id && !!log?.length;
          const zeile = (
            <>
              <Avatar name={p.name} color={p.color} size="sm" />
              <span className="grow stack-1">
                <span className="row-between">
                  <span className="t-headline">{name}</span>
                  {t && (
                    <span className="t-caption t-mono-num">
                      {formatGlasses(t.glasses)} {Math.round(t.glasses * 2) <= 2 ? 'Glas' : 'Gläser'}
                    </span>
                  )}
                </span>
                <span className="row wrap" style={{ gap: 4 }}>
                  {t ? (
                    t.rows.length ? (
                      t.rows.map((r) => (
                        <span key={r.drink.id} className="chip chip--sm">
                          <Icon name={r.drink.icon} size={12} />
                          {formatGlasses(r.glasses)} {r.name}
                        </span>
                      ))
                    ) : (
                      <span className="t-caption">noch nichts eingetragen</span>
                    )
                  ) : (
                    <span className="t-caption">
                      {p.zone ? ZONE_META[p.zone].label : 'zählt auf dem eigenen Handy'}
                    </span>
                  )}
                </span>
              </span>
            </>
          );
          return (
            <div key={p.id} className="stack-2">
              {log?.length ? (
                <button
                  className="row pressable"
                  style={{ alignItems: 'flex-start', width: '100%', textAlign: 'left' }}
                  aria-expanded={aufgeklappt}
                  aria-label={`Einträge von ${name}`}
                  onClick={() => setOpen(aufgeklappt ? null : p.id)}
                >
                  {zeile}
                  <Icon name={aufgeklappt ? 'chevronUp' : 'chevronDown'} size={15} />
                </button>
              ) : (
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  {zeile}
                </div>
              )}
              {aufgeklappt && log && (
                <Entries
                  log={log}
                  customsFor={customs}
                  onRemove={(id) => {
                    haptic('warn');
                    removeEventFor(p.id, id);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {mode === 'online' && (
        <p className="t-caption t-balance">
          Trinkmengen bleiben auf jedem Handy. Von den anderen siehst du nur die Zone.
        </p>
      )}
    </section>
  );
}

/** Die Einträge einer Person, jüngster zuerst – nach Uhrzeit, nicht nach Eingabe. */
function Entries({
  log,
  customsFor,
  onRemove,
}: {
  log: readonly DrinkEvent[];
  customsFor: Parameters<typeof findDrink>[1];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="list">
      {[...log]
        .sort((a, b) => b.at - a.at)
        .map((e) => (
          <div key={e.id} className="list__item">
            <span className="grow">
              <span className="t-headline" style={{ display: 'block' }}>
                {formatEntry(findDrink(e.drinkId, customsFor), e.sips, e.drinkName)}
              </span>
              <span className="t-caption">{formatTime(e.at)}</span>
            </span>
            <button
              className="btn btn--plain"
              aria-label={`Eintrag ${formatTime(e.at)} entfernen`}
              onClick={() => onRemove(e.id)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
    </div>
  );
}
