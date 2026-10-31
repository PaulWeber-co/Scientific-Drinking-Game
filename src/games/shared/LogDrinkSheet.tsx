import { useMemo, useState } from 'react';
import { DrinkPhoto } from '../../components/ui/DrinkPhoto';
import { Segmented, Sheet } from '../../components/ui';
import { DRINK_CATALOG, findDrink } from '../../engine/drinks';
import { formatEntry, formatVolume, sipsForGlasses } from '../../engine/tally';
import { haptic } from '../../lib/haptics';
import { usePlayer } from '../../store/player';
import type { DrinkDefinition } from '../../engine/types';
import type { GamePlayer } from '../types';

type Amount = 'half' | 'full' | 'double';

const AMOUNTS: { value: Amount; label: string }[] = [
  { value: 'half', label: '½ Glas' },
  { value: 'full', label: '1 Glas' },
  { value: 'double', label: '2 Gläser' },
];
const GLASSES: Record<Amount, number> = { half: 0.5, full: 1, double: 2 };
const VOLUMES = [20, 40, 200, 330, 500];

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
  onLog: (playerId: string, drink: DrinkDefinition, sips: number, at: number, volumeMl: number) => void;
}

/**
 * Der eine Weg, ein Getränk einzutragen – egal welches, egal wann, egal wer.
 *
 * Muster wie die Favoriten in DrinkControl: Menge und Zeit stehen vorab
 * (Standard: ganzes Glas, gerade eben), der Tipp auf das Getränk BUCHT.
 * Der häufigste Fall ist damit ein Tap, ein Sonderfall zwei oder drei.
 * Typische Größen und eine eigene Menge ergänzen die schnelle Standardbuchung.
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
  const [exactVolume, setExactVolume] = useState(false);
  const [volumeInput, setVolumeInput] = useState('500');
  const volumeMl = Number(volumeInput.replace(',', '.'));
  const validVolume = volumeInput.trim() !== '' && Number.isFinite(volumeMl) && volumeMl >= 1 && volumeMl <= 2000;

  const playerId = who ?? initialPlayerId ?? players[0]?.id ?? meId;
  const player = players.find((p) => p.id === playerId);

  // Zuerst, was diese Person zuletzt hatte und was sie eingestellt hat:
  // am Tisch trinkt man meist dasselbe weiter.
  const { recent, rest } = useMemo(() => {
    const log = player?.local ? player.local.log : myLog;
    const settled = player?.local ? player.local.drinkId : currentDrinkId;
    const all = [...customDrinks, ...DRINK_CATALOG];
    const available = new Map(all.map((drink) => [drink.id, drink]));
    const ids: string[] = [];
    for (const e of [...log].reverse()) {
      // Ein gelöschtes eigenes Getränk bleibt im Verlauf, kann aber nicht
      // mehr gebucht werden. Seine ID darf hier niemals auf Pils fallen.
      if (!available.has(e.drinkId)) continue;
      if (!ids.includes(e.drinkId)) ids.push(e.drinkId);
      if (ids.length >= RECENT) break;
    }
    const selected = findDrink(settled, customDrinks).id;
    if (!ids.includes(selected)) ids.unshift(selected);
    const recent = ids.slice(0, RECENT).map((id) => available.get(id)!);
    const rest = all.filter((d) => !recent.some((r) => r.id === d.id));
    return { recent, rest };
  }, [player, myLog, currentDrinkId, customDrinks]);

  const close = () => {
    setWho(null);
    setAmount('full');
    setAgo('0');
    setExactVolume(false);
    setVolumeInput('500');
    onClose();
  };

  const pick = (drink: DrinkDefinition) => {
    if (exactVolume && !validVolume) return;
    const volume = exactVolume ? volumeMl : drink.defaultVolumeMl * GLASSES[amount];
    const sips = exactVolume ? Math.max(1, Math.round(volume / drink.sipSizeMl)) : sipsForGlasses(drink, GLASSES[amount]);
    const at = Date.now() - Number(ago) * HOUR_MS;
    haptic('sip');
    onLog(playerId, drink, sips, at, volume);
    close();
  };

  const tile = (d: DrinkDefinition) => {
    const volume = exactVolume ? volumeMl : d.defaultVolumeMl * GLASSES[amount];
    const sips = exactVolume ? Math.max(1, Math.round(volume / d.sipSizeMl)) : sipsForGlasses(d, GLASSES[amount]);
    const canLog = !exactVolume || validVolume;
    const strength = `${String(d.abvPercent).replace('.', ',')} %`;
    return (
      <button
        key={d.id}
        className="drinktile pressable"
        aria-label={canLog ? `${formatEntry(d, sips, d.name, volume)} eintragen` : `${d.name} – Menge eingeben`}
        aria-description={canLog ? `${formatVolume(d, sips, volume)} · ${strength}` : undefined}
        disabled={!canLog}
        onClick={() => pick(d)}
      >
        <DrinkPhoto id={d.id} fallback={d.icon} />
        <span className="drinktile__name">{d.name}</span>
        <span className="drinktile__vol">{canLog ? formatVolume(d, sips, volume) : 'Menge fehlt'} · {strength}</span>
      </button>
    );
  };

  return (
    // Der Tipp aufs Getränk bucht – der Kopfknopf speichert nichts, also
    // heißt er auch nicht „Fertig".
    <Sheet open={open} onClose={close} title="Getränk eintragen" closeLabel="Abbrechen">
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
        <Segmented<Amount | ''> value={exactVolume ? '' : amount} options={AMOUNTS} onChange={(next) => {
          if (!next) return;
          setAmount(next);
          setExactVolume(false);
        }} />
        <div className="logdrink__volumes" role="group" aria-label="Genaue Menge">
          {VOLUMES.map((ml) => (
            <button
              key={ml}
              className={`chip ${exactVolume && volumeMl === ml ? 'chip--on' : 'chip--outline'}`}
              aria-pressed={exactVolume && volumeMl === ml}
              onClick={() => {
                setVolumeInput(String(ml));
                setExactVolume(true);
              }}
            >
              {ml < 100 ? `${ml / 10} cl` : `${String(ml / 1000).replace('.', ',')} l`}
            </button>
          ))}
          <button
            className={`chip ${exactVolume && !VOLUMES.includes(volumeMl) ? 'chip--on' : 'chip--outline'}`}
            aria-expanded={exactVolume}
            onClick={() => setExactVolume(!exactVolume)}
          >
            Eigene Menge
          </button>
        </div>
        {exactVolume && (
          <div className="field">
            <label className="field__label" htmlFor="logdrink-volume">Menge in ml</label>
            <input
              className="input"
              id="logdrink-volume"
              type="text"
              inputMode="decimal"
              value={volumeInput}
              aria-invalid={!validVolume}
              aria-describedby={!validVolume ? 'logdrink-volume-error' : undefined}
              onChange={(event) => setVolumeInput(event.target.value)}
            />
            {!validVolume && <span id="logdrink-volume-error" role="alert" className="t-caption">Bitte eine Menge zwischen 1 und 2000 ml eingeben.</span>}
          </div>
        )}
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
