import { useMemo, useState } from 'react';
import { Icon } from '../../components/icons';
import { Segmented, Sheet } from '../../components/ui';
import { DRINK_CATALOG, findDrink } from '../../engine/drinks';
import { formatEntry, sipsForGlasses } from '../../engine/tally';
import { haptic } from '../../lib/haptics';
import { usePlayer } from '../../store/player';
import type { DrinkDefinition } from '../../engine/types';
import type { GamePlayer } from '../types';

type Amount = 'half' | 'full' | 'double';

const AMOUNTS: { value: Amount; label: string }[] = [
  { value: 'half', label: 'Halbes' },
  { value: 'full', label: 'Ganzes' },
  { value: 'double', label: 'Zwei' },
];
const GLASSES: Record<Amount, number> = { half: 0.5, full: 1, double: 2 };

/** Wie lange es her ist, in Stunden als Text für `Segmented`. */
const AGO: { value: string; label: string }[] = [
  { value: '0', label: 'gerade' },
  { value: '0.5', label: '30 min her' },
  { value: '1', label: '1 Std her' },
  { value: '2', label: '2 Std her' },
];
const HOUR_MS = 60 * 60 * 1000;

/** So viele zuletzt getrunkene Getränke stehen vorn. */
const RECENT = 4;

export interface LogDrinkSheetProps {
  open: boolean;
  onClose: () => void;
  /** Wer in Frage kommt. Bei einer Person entfällt die Auswahl. */
  players: GamePlayer[];
  meId: string;
  /** Vorgewählt; sonst die erste Person. */
  initialPlayerId?: string;
  onLog: (playerId: string, drink: DrinkDefinition, sips: number, at: number) => void;
}

/**
 * Der eine Weg, ein Getränk einzutragen – egal welches, egal wann, egal wer.
 *
 * Muster wie die Favoriten in DrinkControl: Menge und Zeit stehen vorab
 * (Standard: ganzes Glas, gerade eben), der Tipp auf das Getränk BUCHT.
 * Der häufigste Fall ist damit ein Tap, ein Sonderfall zwei oder drei.
 * Kein Tippen, keine Tastatur.
 *
 * Das eingestellte Spiel-Getränk bleibt unberührt: Wer beim Kings Cup Bier
 * trinkt und zwischendurch einen Shot nimmt, trägt den Shot ein, ohne dass
 * die nächste Ansage in Shots kommt.
 */
export function LogDrinkSheet({
  open,
  onClose,
  players,
  meId,
  initialPlayerId,
  onLog,
}: LogDrinkSheetProps) {
  const currentDrinkId = usePlayer((s) => s.currentDrinkId);
  const customDrinks = usePlayer((s) => s.customDrinks);
  const myLog = usePlayer((s) => s.log);
  const [who, setWho] = useState<string | null>(null);
  const [amount, setAmount] = useState<Amount>('full');
  const [ago, setAgo] = useState('0');

  const playerId = who ?? initialPlayerId ?? players[0]?.id ?? meId;
  const player = players.find((p) => p.id === playerId);

  // Zuerst, was diese Person zuletzt hatte und was sie eingestellt hat:
  // am Tisch trinkt man meist dasselbe weiter.
  const { recent, rest } = useMemo(() => {
    const log = player?.local ? player.local.log : myLog;
    const settled = player?.local ? player.local.drinkId : currentDrinkId;
    const ids: string[] = [];
    for (const e of [...log].reverse()) {
      if (!ids.includes(e.drinkId)) ids.push(e.drinkId);
      if (ids.length >= RECENT) break;
    }
    if (!ids.includes(settled)) ids.unshift(settled);
    const recent = ids.slice(0, RECENT).map((id) => findDrink(id, customDrinks));
    const all = [...customDrinks, ...DRINK_CATALOG];
    const rest = all.filter((d) => !recent.some((r) => r.id === d.id));
    return { recent, rest };
  }, [player, myLog, currentDrinkId, customDrinks]);

  const close = () => {
    setWho(null);
    setAmount('full');
    setAgo('0');
    onClose();
  };

  const pick = (drink: DrinkDefinition) => {
    const sips = sipsForGlasses(drink, GLASSES[amount]);
    const at = Date.now() - Number(ago) * HOUR_MS;
    haptic('success');
    onLog(playerId, drink, sips, at);
    close();
  };

  const tile = (d: DrinkDefinition) => {
    const sips = sipsForGlasses(d, GLASSES[amount]);
    return (
      <button
        key={d.id}
        className="drinktile pressable"
        aria-label={`${formatEntry(d, sips)} eintragen`}
        onClick={() => pick(d)}
      >
        <Icon name={d.icon} size={24} className="drinktile__icon" />
        <span className="drinktile__name">{d.name}</span>
      </button>
    );
  };

  return (
    <Sheet open={open} onClose={close} title="Getrunken">
      <div className="stack-3">
        {players.length > 1 && (
          <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Wer">
            {players.map((p) => (
              <button
                key={p.id}
                className={`chip ${p.id === playerId ? 'chip--on' : 'chip--outline'}`}
                aria-pressed={p.id === playerId}
                onClick={() => {
                  haptic('select');
                  setWho(p.id);
                }}
              >
                {p.id === meId ? 'Ich' : p.name}
              </button>
            ))}
          </div>
        )}

        <div className="list-header t-upper" style={{ paddingTop: 0 }}>
          Wie viel
        </div>
        <Segmented value={amount} options={AMOUNTS} onChange={setAmount} />
        <div className="list-header t-upper" style={{ paddingTop: 0 }}>
          Wann
        </div>
        <Segmented value={ago} options={AGO} onChange={setAgo} />

        <div className="t-caption">Der Tipp auf das Getränk trägt es ein.</div>

        {/* „Zuletzt" erst, wenn es mehr als das eingestellte Getränk gibt –
            eine einzelne Kachel unter einer Überschrift sieht kaputt aus. */}
        {recent.length > 1 ? (
          <>
            <div className="list-header t-upper" style={{ paddingTop: 0 }}>
              Zuletzt
            </div>
            <div className="drinkgrid drinkgrid--compact">{recent.map(tile)}</div>
            <div className="list-header t-upper">Alle</div>
            <div className="drinkgrid drinkgrid--compact">{rest.map(tile)}</div>
          </>
        ) : (
          <div className="drinkgrid drinkgrid--compact">{[...recent, ...rest].map(tile)}</div>
        )}
      </div>
    </Sheet>
  );
}
