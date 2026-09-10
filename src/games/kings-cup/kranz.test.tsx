import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Kranz } from './Kranz';
import { nearestFilled, slotAngle, slotJitter, SLOTS } from './geometrie';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * jsdom kennt kein Layout. Das Kranzfeld wird auf die Masse aus
 * `references/kranz-mechanik.md` gestellt, sonst liegt jeder Zeigerpunkt
 * im Nullpunkt und die Geste kann gar nicht laufen.
 */
const FELD = 340;
const MITTE = FELD / 2;
const RADIUS = (FELD - FELD * 0.124) / 2;

const spieler: GamePlayer[] = [
  { id: 'p0', name: 'Mira', color: 'blue', online: true },
  { id: 'p1', name: 'Ben', color: 'pink', online: true },
];

beforeEach(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0, y: 0, left: 0, top: 0, right: FELD, bottom: FELD,
      width: FELD, height: FELD, toJSON: () => ({}),
    }),
  });
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'getBoundingClientRect');
});

/** Ein voller Kranz mit Loechern an den genannten Plaetzen. */
function kranz(...loecher: number[]): (number | null)[] {
  return Array.from({ length: SLOTS }, (_, i) => (loecher.includes(i) ? null : i));
}

/** Bildschirmpunkt auf einem Platz, `r` Punkte von der Mitte entfernt. */
function punkt(slot: number, r = RADIUS) {
  const bogen = (slotAngle(slot) * Math.PI) / 180;
  return { clientX: MITTE + Math.sin(bogen) * r, clientY: MITTE - Math.cos(bogen) * r };
}

function zeichne(deck: (number | null)[], onDraw = vi.fn(), pours: string[] = []) {
  render(
    <Kranz deck={deck} pours={pours} players={spieler} canDraw onDraw={onDraw} />,
  );
  return onDraw;
}

const feld = () => screen.getByRole('button');
const karten = () => Array.from(document.querySelectorAll('.kranz__karte'));
/** Welche Plaetze gerade im Kranz liegen – aus dem gezeichneten Winkel zurueck. */
const gezeichnetePlaetze = () =>
  karten()
    .map((el) => Number((el as HTMLElement).style.getPropertyValue('--kranz-winkel').replace('deg', '')))
    .map((grad) => Math.round((grad * SLOTS) / 360))
    .sort((a, b) => a - b);

describe('Kranz: was liegt', () => {
  it('zeichnet genau die Karten, die noch im Kranz liegen', () => {
    // Faelle aus der Quelle erzeugt statt handgepflegt: jede Fuellstufe vom
    // vollen Blatt bis zur letzten Karte.
    for (const weg of [0, 1, 13, 26, 51]) {
      const loecher = Array.from({ length: weg }, (_, i) => i * 1);
      const { unmount } = render(
        <Kranz deck={kranz(...loecher)} pours={[]} players={spieler} canDraw onDraw={() => {}} />,
      );
      expect(karten().length, `${weg} gezogen`).toBe(SLOTS - weg);
      unmount();
    }
  });

  it('laesst die Luecke da stehen, wo gezogen wurde', () => {
    zeichne(kranz(7, 30));
    const plaetze = gezeichnetePlaetze();
    expect(plaetze).not.toContain(7);
    expect(plaetze).not.toContain(30);
    expect(plaetze).toContain(8);
    expect(plaetze.length).toBe(SLOTS - 2);
  });

  it('nennt Screenreadern, wie viele Karten noch da sind', () => {
    zeichne(kranz(1, 2, 3));
    expect(feld().getAttribute('aria-label')).toBe('Karte aus dem Kranz ziehen, 49 übrig');
  });
});

describe('Kranz: die Geste', () => {
  it('zieht die Karte, an der der Finger aufsetzt', () => {
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(17) });
    fireEvent.pointerUp(feld(), { pointerId: 1, ...punkt(17) });
    expect(onDraw.mock.calls[0][0]).toBe(17);
  });

  it('folgt dem Finger am Kranz entlang und zieht, wo er loslaesst', () => {
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(10) });
    expect(document.querySelector('.kranz__karte--auf')).not.toBeNull();
    fireEvent.pointerMove(feld(), { pointerId: 1, ...punkt(20) });
    // Nach aussen ueber die Schwelle, damit es ein Zug ist und kein Tipp.
    fireEvent.pointerMove(feld(), { pointerId: 1, ...punkt(20, RADIUS + 60) });
    fireEvent.pointerUp(feld(), { pointerId: 1, ...punkt(20, RADIUS + 60) });
    expect(onDraw.mock.calls[0][0]).toBe(20);
  });

  it('ueberspringt Loecher und nimmt den naechsten belegten Platz', () => {
    const onDraw = zeichne(kranz(40, 41, 42));
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(41) });
    fireEvent.pointerUp(feld(), { pointerId: 1, ...punkt(41) });
    expect(onDraw).toHaveBeenCalledTimes(1);
    const platz = onDraw.mock.calls[0][0];
    expect([39, 43]).toContain(platz);
  });

  it('zieht nicht, wenn der Finger nur am Kranz entlangfaehrt', () => {
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(10) });
    fireEvent.pointerMove(feld(), { pointerId: 1, ...punkt(24) });
    fireEvent.pointerUp(feld(), { pointerId: 1, ...punkt(24) });
    expect(onDraw).not.toHaveBeenCalled();
  });

  it('zieht NIE bei pointercancel – iOS schickt das bei einem Anruf', () => {
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(5) });
    fireEvent.pointerMove(feld(), { pointerId: 1, ...punkt(5, RADIUS + 90) });
    fireEvent.pointerCancel(feld(), { pointerId: 1 });
    expect(onDraw).not.toHaveBeenCalled();
  });

  it('zieht NIE bei entzogener Zeigerbindung – iOS nimmt sie bei Systemgesten', () => {
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(5) });
    fireEvent.pointerMove(feld(), { pointerId: 1, ...punkt(5, RADIUS + 90) });
    fireEvent.lostPointerCapture(feld(), { pointerId: 1 });
    expect(onDraw).not.toHaveBeenCalled();
  });

  it('zieht genau einmal, wenn der Zeiger sein Klick-Ereignis nachschiebt', () => {
    // Ein Zeiger-Zug loest ZUSAETZLICH ein `click` aus. Ohne Riegel zoege jede
    // Geste zweimal, und der Reducer faenge das nur bei perfekter Reihenfolge.
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(3) });
    fireEvent.pointerUp(feld(), { pointerId: 1, ...punkt(3) });
    fireEvent.click(feld());
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it('zieht per Tastatur, ohne dass je ein Zeiger im Spiel war', () => {
    // Ohne diesen Weg ist der Kranz bei eingeschraenkter Motorik unbedienbar.
    // WELCHER Platz es wird, ist beliebig – er muss nur belegt sein. Vom
    // Nullpunkt aus liegt Platz 51 einen Schritt entfernt, Platz 2 zwei.
    const deck = kranz(0, 1);
    const onDraw = zeichne(deck);
    fireEvent.click(feld());
    expect(onDraw).toHaveBeenCalledTimes(1);
    expect(deck[onDraw.mock.calls[0][0]]).not.toBeNull();
  });

  it('zieht nicht, wenn der Finger in der Mitte auf den Becher tippt', () => {
    // Dort steht der Becher, und `atan2` ist nahe dem Mittelpunkt so instabil,
    // dass 3 px Zittern rund 17 Grad sind - die Auswahl spraenge ueber den
    // ganzen Kranz.
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, clientX: MITTE + 4, clientY: MITTE - 3 });
    fireEvent.pointerUp(feld(), { pointerId: 1, clientX: MITTE + 4, clientY: MITTE - 3 });
    // Das `click` MUSS mitgefeuert werden: im Browser kommt es immer, und ohne
    // es hier zieht der Tipp auf den Becher am Zeigerweg vorbei doch noch.
    fireEvent.click(feld());
    expect(onDraw).not.toHaveBeenCalled();
    expect(document.querySelector('.kranz__karte--auf')).toBeNull();
  });

  it('laesst den Tastaturweg nach einem Tipp auf den Becher weiterleben', () => {
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, clientX: MITTE, clientY: MITTE });
    fireEvent.pointerUp(feld(), { pointerId: 1, clientX: MITTE, clientY: MITTE });
    fireEvent.click(feld());
    expect(onDraw).not.toHaveBeenCalled();
    // Der Riegel gilt genau fuer dieses eine nachgeschobene Ereignis.
    fireEvent.click(feld());
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it('zieht auch aus einem LEEREN Kranz – sonst steht das Spiel still', () => {
    // Der Kranz ist der einzige Ziehweg. Verschluckt er den leeren Fall, kommt
    // der Reducer nie zum Neumischen, und „ohne Ende" haengt ab Zug 53.
    const leer = Array.from({ length: SLOTS }, () => null);
    const onDraw = vi.fn();
    render(<Kranz deck={leer} pours={[]} players={spieler} canDraw onDraw={onDraw} />);
    fireEvent.click(feld());
    expect(onDraw).toHaveBeenCalledTimes(1);
    const nochmal = vi.fn();
    render(<Kranz deck={leer} pours={[]} players={spieler} canDraw onDraw={nochmal} />);
    const felder = screen.getAllByRole('button');
    fireEvent.pointerDown(felder[1], { pointerId: 2, ...punkt(0) });
    expect(nochmal).toHaveBeenCalledTimes(1);
  });

  it('laesst den Tastaturweg nach einem Abbruch weiterleben', () => {
    // Der Riegel gegen das nachgeschobene `click` darf nach `pointercancel`
    // nicht stehenbleiben: dort kommt gar kein `click`, und die naechste
    // Aktivierung per Enter oder VoiceOver waere verschluckt.
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(9) });
    fireEvent.pointerCancel(feld(), { pointerId: 1 });
    expect(onDraw).not.toHaveBeenCalled();
    fireEvent.click(feld());
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it('meldet mit, wo die Karte lag – ohne das kann der Flug nichts messen', () => {
    const onDraw = zeichne(kranz());
    fireEvent.pointerDown(feld(), { pointerId: 1, ...punkt(6) });
    fireEvent.pointerUp(feld(), { pointerId: 1, ...punkt(6) });
    expect(onDraw.mock.calls[0][1]).toBeDefined();
  });

  it('laesst niemanden ziehen, der nicht dran ist', () => {
    const onDraw = vi.fn();
    render(
      <Kranz deck={kranz()} pours={[]} players={spieler} canDraw={false} onDraw={onDraw} />,
    );
    expect(feld()).toBeDisabled();
    fireEvent.click(feld());
    expect(onDraw).not.toHaveBeenCalled();
  });
});

describe('Becher', () => {
  it('zeigt je Guss eine Schicht, hoechstens drei', () => {
    // Drei, nicht vier: Koenig 1 bis 3 giessen, der vierte trinkt.
    for (const guesse of [[], ['p0'], ['p0', 'p1'], ['p0', 'p1', 'p0']]) {
      const { unmount } = render(
        <Kranz deck={kranz()} pours={guesse} players={spieler} canDraw onDraw={() => {}} />,
      );
      expect(document.querySelectorAll('.becher__guss').length, `${guesse.length} Guesse`)
        .toBe(guesse.length);
      unmount();
    }
  });

  it('faerbt jede Schicht nach der Person, die gegossen hat', () => {
    zeichne(kranz(), vi.fn(), ['p1', 'p0']);
    const schichten = Array.from(document.querySelectorAll('.becher__guss'));
    expect((schichten[0] as HTMLElement).style.getPropertyValue('--guss')).toBe('var(--pink)');
    expect((schichten[1] as HTMLElement).style.getPropertyValue('--guss')).toBe('var(--blue)');
  });
});

describe('slotJitter', () => {
  it('streut jeden Platz, aber immer gleich', () => {
    // Ohne Streuung sind 52 gleich gedrehte Karten auf einem exakten Kreis ein
    // Zahnrad. Mit `Math.random` spraenge der Kranz bei jedem Rendern neu.
    for (let slot = 0; slot < SLOTS; slot++) {
      expect(slotJitter(slot)).toEqual(slotJitter(slot));
    }
    const drehungen = Array.from({ length: SLOTS }, (_, i) => slotJitter(i).dreh);
    const radien = Array.from({ length: SLOTS }, (_, i) => slotJitter(i).raus);
    expect(new Set(drehungen).size).toBeGreaterThan(SLOTS / 2);
    expect(Math.max(...drehungen.map(Math.abs))).toBeGreaterThan(2);
    expect(Math.max(...radien.map(Math.abs))).toBeGreaterThan(0.01);
  });

  it('bleibt in Grenzen, die den Kranz nicht zerreissen', () => {
    for (let slot = 0; slot < SLOTS; slot++) {
      const { dreh, raus } = slotJitter(slot);
      expect(Math.abs(dreh), `Platz ${slot}`).toBeLessThanOrEqual(6.5);
      expect(Math.abs(raus), `Platz ${slot}`).toBeLessThanOrEqual(0.0375);
    }
  });
});

describe('nearestFilled', () => {
  it('findet jeden belegten Platz von jedem Startpunkt aus', () => {
    // Werte GENERIERT: jeder Startplatz gegen jedes Loch-Muster, statt drei
    // handgewaehlter Faelle.
    const deck = kranz(0, 1, 2, 3, 50, 51);
    for (let start = 0; start < SLOTS; start++) {
      const treffer = nearestFilled(deck, start);
      expect(deck[treffer], `Start ${start}`).not.toBeNull();
    }
  });

  it('nimmt wirklich den naechsten, nicht irgendeinen belegten', () => {
    const deck = kranz(...Array.from({ length: 20 }, (_, i) => i + 5));
    // Belegt sind 0..4 und 25..51. Von Platz 14 aus ist 25 elf Schritte weg,
    // 4 dagegen zehn - der kuerzere Weg muss gewinnen.
    expect(nearestFilled(deck, 14)).toBe(4);
    expect(nearestFilled(deck, 16)).toBe(25);
  });

  it('meldet -1, wenn nichts mehr liegt', () => {
    expect(nearestFilled(Array.from({ length: SLOTS }, () => null), 3)).toBe(-1);
    expect(nearestFilled([], 0)).toBe(-1);
  });

  it('faellt bei unbrauchbarer Eingabe auf einen gueltigen Platz zurueck', () => {
    // Ueber die Lobby kommt beliebiger Text; `Number(undefined)` ist NaN.
    const deck = kranz();
    expect(nearestFilled(deck, Number.NaN)).toBe(0);
    expect(nearestFilled(deck, -3)).toBe(SLOTS - 3);
    expect(nearestFilled(deck, SLOTS + 5)).toBe(5);
  });
});
