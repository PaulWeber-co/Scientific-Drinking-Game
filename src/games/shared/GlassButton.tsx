import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/icons';
import { Sheet } from '../../components/ui';
import { findDrink, sipsPerServing } from '../../engine/drinks';
import { formatEntry } from '../../engine/tally';
import { haptic } from '../../lib/haptics';
import { useCurrentDrink, usePlayer } from '../../store/player';
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
 * Ein Tap ist ein volles Glas des eingestellten Getränks. Langer Druck
 * und das Mehr-Menü öffnen anderes Getränk, andere Menge und Zeitpunkt.
 * Danach steht acht Sekunden ein Rückgängig darunter — ein Fehlgriff im
 * Dunkeln darf den Abend nicht verfälschen.
 *
 * Die Schluckzahl kommt aus `sipsPerServing()`, nie aus einer eigenen Zahl:
 * ein Glas ist je Getränk verschieden viele Schlucke, ein Shot ist einer.
 */
export function GlassButton({ moreOpen = false, onMoreClose }: {
  moreOpen?: boolean;
  onMoreClose?: () => void;
}) {
  const { players, me, mode, logSipsFor, removeEventFor } = useParty();
  const drink = useCurrentDrink();
  const customDrinks = usePlayer((s) => s.customDrinks);
  const [sheet, setSheet] = useState<null | 'who' | 'more'>(null);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);
  const pressTimer = useRef<number | undefined>(undefined);
  const wasLong = useRef(false);
  // Eine Spielansage kann vor dem Rückgängig noch einen neueren Eintrag
  // buchen. Die Meldung gehört trotzdem zum konkreten Glas dieser Person.
  const lastEntry = useRef<{ playerId: string; eventId: string } | null>(null);

  // Pass & Play führt fremde Körperdaten auf diesem Gerät mit; online gibt es
  // nur einen selbst, dann entfällt die Rückfrage.
  const guests = useMemo(
    () => mode === 'local' ? players.filter((p) => p.local && p.id !== me.id) : [],
    [mode, players, me.id],
  );

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
      const guest = guests.find((p) => p.id === playerId);
      const selectedDrink = guest?.local ? findDrink(guest.local.drinkId, customDrinks) : drink;
      haptic('sip');
      const eventId = logSipsFor(playerId, sipsPerServing(selectedDrink), 'glas', {
        volumeMl: selectedDrink.defaultVolumeMl,
      });
      if (!eventId) return;
      lastEntry.current = { playerId, eventId };
      showNote(`Glas${whoLabel(playerId)} eingetragen`);
      setSheet(null);
    },
    [drink, guests, customDrinks, logSipsFor, showNote, whoLabel],
  );

  /** Der volle Weg aus dem Sheet: Getränk, Menge und Zeitpunkt frei. */
  const logAny = useCallback(
    (playerId: string, d: DrinkDefinition, sips: number, at: number, volumeMl: number) => {
      const eventId = logSipsFor(playerId, sips, 'glas', { drinkId: d.id, at, volumeMl });
      if (!eventId) return;
      lastEntry.current = { playerId, eventId };
      showNote(`${formatEntry(d, sips, d.name, volumeMl)}${whoLabel(playerId)} eingetragen`);
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

  const activate = () => {
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
        onPointerUp={() => window.clearTimeout(pressTimer.current)}
        onPointerLeave={() => window.clearTimeout(pressTimer.current)}
        onPointerCancel={() => window.clearTimeout(pressTimer.current)}
        onClick={(event) => {
          // Tastatur und Screenreader lösen einen nativen Click ohne
          // Pointer-Ereignisse aus. Ein langer Druck darf dagegen nicht
          // zusätzlich das schnelle Glas eintragen.
          const longClick = wasLong.current && event.detail !== 0;
          wasLong.current = false;
          if (!longClick) activate();
        }}
      >
        <span className="sipbtn__drink">
          <Icon name={drink.icon} size={19} />
          <Icon name="plus" size={10} className="sipbtn__plus" />
        </span>
      </button>
      {note && (
        <div className="sipnote" role="status">
          <span className="grow">{note}</span>
          <button
            className="btn btn--plain sipnote__undo"
            onClick={() => {
              haptic('warn');
              const entry = lastEntry.current;
              if (entry) removeEventFor(entry.playerId, entry.eventId);
              lastEntry.current = null;
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
        open={moreOpen || sheet === 'more'}
        onClose={() => {
          setSheet(null);
          onMoreClose?.();
        }}
        players={[me, ...guests]}
        meId={me.id}
        onLog={logAny}
      />
    </>
  );
}
