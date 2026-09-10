import { useCallback, useRef, useState } from 'react';
import { haptic } from '../../lib/haptics';
import { colorFor, isAvatarColor } from '../../components/ui/Avatar';
import { nearestFilled, slotAngle, slotJitter } from './geometrie';
import type { GamePlayer } from '../types';

/** Ab hier loest sich die Karte vom Kranz und folgt dem Finger. */
const ZUG_PX = 44;
/** Weiter als das zieht der Finger nur noch gegen ein Gummiband. */
const ZUG_MAX = 120;
/** Bis hierhin gilt ein Zeigerweg als Tipp und nicht als Zug. */
const TIPP_PX = 8;
const TIPP_MS = 500;
/**
 * Tote Zone um die Kranzmitte, als Anteil des Radius.
 *
 * Zwei Gruende, beide gemessen: in der Mitte steht der Becher, und ein Tipp
 * darauf zoege sonst eine Karte. Und `atan2` wird nahe dem Mittelpunkt
 * instabil - bei 10 px Abstand sind 3 px Zittern schon rund 17 Grad, also
 * zwei bis drei Plaetze. Die Hervorhebung spraenge ueber den ganzen Kranz.
 */
const TOTE_ZONE = 0.45;
/** Mindestabstand zwischen zwei Haptik-Pulsen beim Schieben. */
const PULS_MS = 60;

/** Gummiband wie in `PeekCard`: der Weg wird immer kleiner, hoert nie auf. */
function gummi(ueber: number, spielraum: number): number {
  return (ueber * spielraum) / (ueber + spielraum);
}

interface Props {
  /** 52 feste Plaetze, `null` = hier wurde gezogen. */
  deck: (number | null)[];
  /** Wer in den Becher gegossen hat, aelteste zuerst. */
  pours: string[];
  players: GamePlayer[];
  /** Nur wer dran ist, zieht. Online sehen alle denselben Kranz. */
  canDraw: boolean;
  /**
   * `von` ist der Bildschirmplatz der gezogenen Karte, Grundlage fuer den
   * Flug in die Mitte. Fehlt er (leerer Kranz), fliegt nichts.
   */
  onDraw: (slot: number, von?: DOMRect) => void;
}

/**
 * Der Kartenkranz als Tischobjekt: 52 feste Plaetze, aus denen der Finger
 * sich eine Karte zieht.
 *
 * Die ganze Flaeche ist EIN Knopf. Damit gibt es Tastatur, VoiceOver und den
 * Tipp-Weg geschenkt - eine reine Ziehgeste waere bei eingeschraenkter
 * Motorik unbedienbar (WCAG 2.5.7).
 */
export function Kranz({ deck, pours, players, canDraw, onDraw }: Props) {
  const feldRef = useRef<HTMLButtonElement>(null);
  const kartenRef = useRef(new Map<number, HTMLElement | null>());
  const refFuer = useRef(new Map<number, (el: HTMLElement | null) => void>());
  /** Ein Rueckruf JE PLATZ, einmal erzeugt. Ein Inline-`ref` bekommt bei jedem
   *  Render eine neue Identitaet, React loest und setzt dann alle 52 neu. */
  const kartenRefFuer = useCallback((slot: number) => {
    let f = refFuer.current.get(slot);
    if (!f) {
      f = (el: HTMLElement | null) => kartenRef.current.set(slot, el);
      refFuer.current.set(slot, f);
    }
    return f;
  }, []);
  const [aktiv, setAktiv] = useState<number | null>(null);
  /**
   * true zwischen einem behandelten `pointerup` und dem `click`, das der
   * Browser danach nachschiebt.
   *
   * Bewusst NICHT bei `pointerdown` gesetzt: ein Abbruch (`pointercancel`,
   * entzogene Bindung) schickt gar kein `click`, der Riegel bliebe stehen und
   * verschluckte die naechste Aktivierung per Enter, VoiceOver oder Switch
   * Control - also genau den Weg, fuer den der Tipp-Pfad existiert.
   */
  const vomZeiger = useRef(false);
  const letzterPuls = useRef(0);
  const zug = useRef<{
    pointerId: number;
    startR: number;
    startX: number;
    startY: number;
    startZeit: number;
    slot: number;
    weit: boolean;
  } | null>(null);

  const uebrig = deck.reduce<number>((n, c) => n + (c == null ? 0 : 1), 0);

  /** Zeigerposition -> Platz, Abstand zur Mitte und halbe Feldbreite. */
  const messen = useCallback(
    (x: number, y: number) => {
      const box = feldRef.current?.getBoundingClientRect();
      if (!box || !box.width) return null;
      const dx = x - (box.left + box.width / 2);
      const dy = y - (box.top + box.height / 2);
      // atan2(dx, -dy): 0 Grad zeigt nach oben, im Uhrzeigersinn wachsend -
      // dieselbe Zaehlrichtung wie `slotAngle`.
      const grad = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
      const n = Math.max(1, deck.length);
      return {
        slot: Math.round(grad / (360 / n)) % n,
        r: Math.hypot(dx, dy),
        aussen: box.width / 2,
      };
    },
    [deck.length],
  );

  /** Den Zugweg direkt auf das Element schreiben, nicht ueber React. */
  const setWeg = useCallback((slot: number | null, px: number) => {
    const el = slot == null ? null : kartenRef.current.get(slot);
    if (el) el.style.setProperty('--kranz-zug', `${Math.round(px)}px`);
  }, []);

  const loesen = useCallback(
    (slot: number | null) => {
      setWeg(slot, 0);
      zug.current = null;
      setAktiv(null);
    },
    [setWeg],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canDraw || zug.current) return;
    // Jede Zeigerfolge faengt mit sauberem Riegel an - blieb er von einer
    // abgebrochenen Folge stehen, verschluckte er sonst den naechsten Zug.
    vomZeiger.current = false;
    const m = messen(e.clientX, e.clientY);
    if (!m) return;
    // Finger in der toten Mitte: das ist der Becher, kein Kranz.
    if (m.r < m.aussen * TOTE_ZONE) return;
    const slot = nearestFilled(deck, m.slot);
    // Leerer Kranz: NICHT verschlucken. Der Reducer mischt bei leerem Kranz
    // neu, und der Kranz ist der einzige Ziehweg - ohne das steht „ohne Ende"
    // ab Zug 53 still, und nur noch „Beenden" geht.
    if (slot < 0) {
      onDraw(0);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    zug.current = {
      pointerId: e.pointerId,
      startR: m.r,
      startX: e.clientX,
      startY: e.clientY,
      startZeit: Date.now(),
      slot,
      weit: false,
    };
    setAktiv(slot);
    haptic('select');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = zug.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const m = messen(e.clientX, e.clientY);
    if (!m) return;

    // Solange die Karte noch im Kranz sitzt, folgt die Auswahl dem Finger.
    // Ist sie einmal heraus, bleibt sie es - sonst springt sie beim Ziehen
    // nach aussen auf den Nachbarplatz, weil der Winkel dort schon kippt.
    if (!d.weit) {
      const slot = nearestFilled(deck, m.slot);
      if (slot >= 0 && slot !== d.slot) {
        setWeg(d.slot, 0);
        d.slot = slot;
        setAktiv(slot);
        // Ohne Sperre sind das ueber den halben Kranz rund 25 Pulse - in der
        // Hosentasche Dauervibration statt Rueckmeldung.
        const jetzt = Date.now();
        if (jetzt - letzterPuls.current >= PULS_MS) {
          letzterPuls.current = jetzt;
          haptic('select');
        }
      }
    }

    const roh = m.r - d.startR;
    if (roh <= 0) {
      setWeg(d.slot, 0);
      return;
    }
    if (roh >= ZUG_PX && !d.weit) {
      d.weit = true;
      haptic('tap');
    }
    setWeg(d.slot, roh <= ZUG_MAX ? roh : ZUG_MAX + gummi(roh - ZUG_MAX, ZUG_MAX));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = zug.current;
    if (!d || d.pointerId !== e.pointerId) {
      // Zeigerfolge ohne Zug - etwa ein Tipp in die tote Mitte auf den Becher.
      // Das `click`, das der Browser gleich nachschiebt, gehoert trotzdem
      // diesem Zeiger und darf nicht doch noch ziehen.
      vomZeiger.current = true;
      return;
    }
    const weg = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    const tipp = weg < TIPP_PX && Date.now() - d.startZeit < TIPP_MS;
    const slot = d.slot;
    const von = kartenRef.current.get(slot)?.getBoundingClientRect();
    loesen(slot);
    vomZeiger.current = true;
    if (d.weit || tipp) onDraw(slot, von);
  };

  /**
   * iOS entzieht die Zeigerbindung bei Systemgesten, und ein Anruf schickt
   * `pointercancel`. Beides darf NIE ziehen - sonst zieht ein Wischen von
   * oben eine Karte.
   */
  const abbrechen = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = zug.current;
    if (!d || d.pointerId !== e.pointerId) return;
    loesen(d.slot);
    vomZeiger.current = false;
  };

  /**
   * Der Knopf zieht per Tastatur die naechste Karte. Die Geste bleibt ein
   * Zusatz, kein Ersatz (WCAG 2.5.7).
   *
   * Der Riegel ist noetig, weil ein Zeiger-Zug ZUSAETZLICH ein `click`
   * ausloest: ohne ihn zoege jede Geste zweimal, und die Phasenpruefung im
   * Reducer faenge das nur, wenn der erste Zug vorher angekommen ist.
   */
  const geklickt = () => {
    if (vomZeiger.current) {
      vomZeiger.current = false;
      return;
    }
    if (!canDraw) return;
    // `-1` heisst leerer Kranz. Der Reducer mischt dann neu - verschlucken
    // wuerde das Spiel anhalten.
    const slot = Math.max(0, nearestFilled(deck, 0));
    onDraw(slot, kartenRef.current.get(slot)?.getBoundingClientRect());
  };

  return (
    <div className="kranzfeld">
      <button
        ref={feldRef}
        type="button"
        className="kranz"
        disabled={!canDraw}
        aria-label={`Karte aus dem Kranz ziehen, ${uebrig} übrig`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={abbrechen}
        onLostPointerCapture={abbrechen}
        onClick={geklickt}
      >
        {deck.map((karte, slot) =>
          karte == null ? null : (
            <span
              key={slot}
              ref={kartenRefFuer(slot)}
              className={`kranz__karte${aktiv === slot ? ' kranz__karte--auf' : ''}`}
              style={{
                ['--kranz-winkel' as string]: `${slotAngle(slot, deck.length)}deg`,
                ['--kranz-dreh' as string]: `${slotJitter(slot).dreh}deg`,
                ['--kranz-raus' as string]: `${slotJitter(slot).raus}`,
              }}
            />
          ),
        )}
      </button>
      {/* Ausserhalb des Knopfes: dessen `aria-label` verdeckt jeden Inhalt,
          der Becher waere darin nie ansagbar. Zeiger gehen durch ihn hindurch,
          damit er dem Kranz keine Flaeche wegnimmt. */}
      <Becher pours={pours} players={players} />
    </div>
  );
}

/**
 * Der Becher in der Mitte des Kranzes. Drei Schichten, eine je Guss, in der
 * Farbe der giessenden Person - der Becher zeigt WER, nie wie viel. Ein
 * simulierter Fuellstand widerspraeche dem echten Becher auf dem Tisch, und
 * dann glaubt der Tisch der App nicht mehr.
 *
 * Bewusst klein und ruhig: der Kranz ist der Held (User-Entscheid 2026-09-10).
 */
export function Becher({ pours, players }: { pours: string[]; players: GamePlayer[] }) {
  const farbe = (id: string) => {
    const p = players.find((x) => x.id === id);
    return isAvatarColor(p?.color) ? p.color : colorFor(id);
  };
  // Wer die Runde verlassen hat, hat trotzdem gegossen - die Schicht bleibt.
  // Deshalb zaehlt die Ansage die GUESSE und nennt die Namen, die es noch gibt.
  const namen = pours
    .map((id) => players.find((x) => x.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const ansage = pours.length
    ? `Becher: ${pours.length} ${pours.length === 1 ? 'Guss' : 'Güsse'}${namen ? ` von ${namen}` : ''}`
    : undefined;
  return (
    <span
      className="becher"
      aria-hidden={pours.length === 0}
      aria-label={ansage}
      role={ansage ? 'img' : undefined}
    >
      <span className="becher__glas">
        {pours.map((id, i) => (
          <span
            key={`${i}-${id}`}
            className="becher__guss"
            style={{ ['--guss' as string]: `var(--${farbe(id)})` }}
          />
        ))}
      </span>
    </span>
  );
}
