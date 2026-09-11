import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { Segmented, Sheet } from '../../components/ui';
import { sipsPerServing } from '../../engine/drinks';
import { haptic } from '../../lib/haptics';
import { useCurrentDrink } from '../../store/player';
import { useParty } from '../../features/party/PartyContext';

/** Ab hier gilt der Druck als lang und öffnet die Mengen. */
const LONG_PRESS_MS = 450;
/**
 * So lange bleibt das Rückgängig stehen.
 *
 * Acht statt fünf Sekunden: im dunklen, lauten Raum greift man daneben,
 * schaut erst dann auf den Bildschirm und muss den Knopf noch lesen und
 * treffen. Fünf Sekunden sind dafür die untere Grenze, nicht das Maß.
 */
const NOTE_MS = 8000;

type Amount = 'half' | 'full' | 'double';

const AMOUNTS: { value: Amount; label: string }[] = [
  { value: 'half', label: 'Halbes' },
  { value: 'full', label: 'Ganzes' },
  { value: 'double', label: 'Zwei' },
];

/**
 * Ein Glas eintragen, ohne das Spiel zu verlassen.
 *
 * Ein Tap ist ein volles Glas des eingestellten Getränks, langer Druck öffnet
 * die Mengen. Danach steht acht Sekunden ein Rückgängig darunter — ein
 * Fehlgriff im Dunkeln darf den Abend nicht verfälschen.
 *
 * Die Schluckzahl kommt aus `sipsPerServing()`, nie aus einer eigenen Zahl:
 * ein Glas ist je Getränk verschieden viele Schlucke, ein Shot ist einer.
 */
export function GlassButton() {
  const { players, me, mode, logSipsFor, undoLastFor } = useParty();
  const drink = useCurrentDrink();
  const [sheet, setSheet] = useState<null | 'who' | 'amount'>(null);
  const [amount, setAmount] = useState<Amount>('full');
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);
  const pressTimer = useRef<number | undefined>(undefined);
  const wasLong = useRef(false);
  // Rückgängig muss dieselbe Person treffen wie das Eintragen, auch wenn
  // inzwischen jemand anders im Auswahl-Sheet steht.
  const lastTarget = useRef<string>(me.id);

  // Pass & Play führt fremde Körperdaten auf diesem Gerät mit; online gibt es
  // nur einen selbst, dann entfällt die Rückfrage.
  const guests = mode === 'local' ? players.filter((p) => p.local && p.id !== me.id) : [];

  useEffect(() => () => {
    window.clearTimeout(noteTimer.current);
    window.clearTimeout(pressTimer.current);
  }, []);

  const showNote = useCallback((text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), NOTE_MS);
  }, []);

  const log = useCallback(
    (playerId: string, which: Amount) => {
      const per = sipsPerServing(drink);
      const sips =
        which === 'half' ? Math.max(1, Math.round(per / 2)) : which === 'double' ? per * 2 : per;
      haptic('success');
      logSipsFor(playerId, sips, 'glas');
      lastTarget.current = playerId;
      const who = playerId === me.id ? '' : ` für ${players.find((p) => p.id === playerId)?.name}`;
      const label = which === 'half' ? 'Halbes Glas' : which === 'double' ? 'Zwei Gläser' : 'Glas';
      showNote(`${label}${who} eingetragen`);
      setSheet(null);
      setAmount('full');
    },
    [drink, logSipsFor, me.id, players, showNote],
  );

  const onPressStart = () => {
    wasLong.current = false;
    pressTimer.current = window.setTimeout(() => {
      wasLong.current = true;
      haptic('tap');
      setSheet('amount');
    }, LONG_PRESS_MS);
  };

  const onPressEnd = () => {
    window.clearTimeout(pressTimer.current);
    if (wasLong.current) return;
    if (guests.length) {
      haptic('tap');
      setSheet('who');
      return;
    }
    log(me.id, 'full');
  };

  return (
    <>
      <button
        className="sipbtn"
        aria-label={`Glas ${drink.name} eintragen`}
        onPointerDown={onPressStart}
        onPointerUp={onPressEnd}
        onPointerLeave={() => window.clearTimeout(pressTimer.current)}
        onPointerCancel={() => window.clearTimeout(pressTimer.current)}
      >
        <Icon name={drink.icon} size={19} />
      </button>

      {note && (
        <div className="sipnote" role="status">
          <span className="grow">{note}</span>
          <button
            className="btn btn--plain sipnote__undo"
            onClick={() => {
              haptic('warn');
              undoLastFor(lastTarget.current);
              setNote(null);
            }}
          >
            Rückgängig
          </button>
        </div>
      )}

      <Sheet
        open={sheet !== null}
        onClose={() => {
          setSheet(null);
          setAmount('full');
        }}
        title={sheet === 'who' ? 'Wer hat ausgetrunken?' : `${drink.name} eintragen`}
      >
        <div className="stack-3">
          {sheet === 'amount' && (
            <>
              <Segmented value={amount} options={AMOUNTS} onChange={setAmount} />
              <div className="t-caption">
                Ein ganzes Glas sind {sipsPerServing(drink)} Schlucke {drink.name}. Ein anderes
                Getränk stellst du im Zahnrad daneben ein.
              </div>
            </>
          )}
          <div className="list">
            {(guests.length ? [me, ...guests] : [me]).map((p) => (
              <button
                key={p.id}
                className="list__item row pressable"
                onClick={() => log(p.id, sheet === 'amount' ? amount : 'full')}
              >
                <span className="listicon">
                  <Icon name={drink.icon} size={19} />
                </span>
                <span className="grow t-headline" style={{ textAlign: 'left' }}>
                  {p.id === me.id ? 'Ich' : p.name}
                </span>
                <Icon name="plus" size={17} />
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
