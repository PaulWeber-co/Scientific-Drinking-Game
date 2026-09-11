import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { sipsPerServing } from '../../engine/drinks';
import { formatEntry } from '../../engine/tally';
import { haptic } from '../../lib/haptics';
import { useCurrentDrink } from '../../store/player';
import { useParty } from '../../features/party/PartyContext';
import { LogDrinkSheet } from './LogDrinkSheet';
import type { DrinkDefinition } from '../../engine/types';

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

/**
 * Ein Glas eintragen, ohne das Spiel zu verlassen.
 *
 * Ein Tap ist ein volles Glas des eingestellten Getränks, langer Druck öffnet
 * das volle Eintragen: anderes Getränk, andere Menge, vorhin statt jetzt.
 * Danach steht acht Sekunden ein Rückgängig darunter — ein Fehlgriff im
 * Dunkeln darf den Abend nicht verfälschen.
 *
 * Die Schluckzahl kommt aus `sipsPerServing()`, nie aus einer eigenen Zahl:
 * ein Glas ist je Getränk verschieden viele Schlucke, ein Shot ist einer.
 */
export function GlassButton() {
  const { players, me, mode, logSipsFor, undoLastFor } = useParty();
  const drink = useCurrentDrink();
  const [sheet, setSheet] = useState<null | 'who' | 'more'>(null);
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

  const whoLabel = useCallback(
    (playerId: string) =>
      playerId === me.id ? '' : ` für ${players.find((p) => p.id === playerId)?.name}`,
    [me.id, players],
  );

  /** Der schnelle Weg: ein volles Glas des eingestellten Getränks, jetzt. */
  const logGlass = useCallback(
    (playerId: string) => {
      haptic('success');
      logSipsFor(playerId, sipsPerServing(drink), 'glas');
      lastTarget.current = playerId;
      showNote(`Glas${whoLabel(playerId)} eingetragen`);
      setSheet(null);
    },
    [drink, logSipsFor, showNote, whoLabel],
  );

  /** Der volle Weg aus dem Sheet: Getränk, Menge und Zeitpunkt frei. */
  const logAny = useCallback(
    (playerId: string, d: DrinkDefinition, sips: number, at: number) => {
      logSipsFor(playerId, sips, 'glas', { drinkId: d.id, at });
      lastTarget.current = playerId;
      showNote(`${formatEntry(d, sips)}${whoLabel(playerId)} eingetragen`);
    },
    [logSipsFor, showNote, whoLabel],
  );

  const onPressStart = () => {
    wasLong.current = false;
    pressTimer.current = window.setTimeout(() => {
      wasLong.current = true;
      haptic('tap');
      setSheet('more');
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
    logGlass(me.id);
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

      <Sheet open={sheet === 'who'} onClose={() => setSheet(null)} title="Wer hat ausgetrunken?">
        <div className="stack-3">
          <div className="list">
            {[me, ...guests].map((p) => (
              <button
                key={p.id}
                className="list__item row pressable"
                onClick={() => logGlass(p.id)}
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
          {/* Zweiter Weg zu Menge und Getränk – der lange Druck ist nicht
              für jede Hand und jeden Zustand der richtige. */}
          <button className="btn btn--plain btn--block" onClick={() => setSheet('more')}>
            Anderes Getränk oder andere Menge …
          </button>
        </div>
      </Sheet>

      <LogDrinkSheet
        open={sheet === 'more'}
        onClose={() => setSheet(null)}
        players={[me, ...guests]}
        meId={me.id}
        onLog={logAny}
      />
    </>
  );
}
