import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PeekCard } from './PeekCard';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));
const { haptic } = await import('../../lib/haptics');

/**
 * jsdom kennt weder Layout noch Pointer-Capture. Beides wird gestellt, damit
 * die Geste ueberhaupt laufen kann - die Kartenhoehe bestimmt jeden Schwellwert.
 */
const HOEHE = 200;
const MAX = HOEHE * 0.6;

beforeEach(() => {
  vi.mocked(haptic).mockClear();
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: HOEHE,
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
});

const deckel = () => screen.getByRole('button');
const geheim = () => document.querySelector('.peekcard__under') as HTMLElement;
const hub = () => {
  const t = (document.querySelector('.peekcard__lid') as HTMLElement).style.transform;
  return Number(/translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(t)?.[1] ?? 0);
};

/** Zieht von der Ruhelage um `px` nach oben. */
function ziehen(px: number) {
  fireEvent.pointerDown(deckel(), { pointerId: 1, clientY: 300 });
  fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - px });
}

describe('Aufdeck-Karte', () => {
  it('verbirgt das Geheimnis vor Screenreadern, solange sie zu ist', () => {
    // Sonst liest VoiceOver das Wort vor, waehrend die Karte geschlossen daliegt.
    render(<PeekCard>SEEHUND</PeekCard>);
    expect(geheim().getAttribute('aria-hidden')).toBe('true');
  });

  it('folgt dem Finger', () => {
    render(<PeekCard>SEEHUND</PeekCard>);
    ziehen(40);
    expect(hub()).toBe(-40);
    fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - 80 });
    expect(hub()).toBe(-80);
  });

  it('bremst jenseits des Anschlags nach der iOS-Formel', () => {
    // Gegen den GERECHNETEN Wert, nicht gegen ein Toleranzband: die Formel ist
    // nach oben ohnehin durch `dim` beschraenkt, deshalb waere jede positive
    // Konstante durch ein Band zwischen MAX und MAX+100 gekommen - der Test
    // haette „gibt es ueberhaupt Daempfung" geprueft, nicht „stimmt 0,55".
    const gummi = (over: number, dim: number) => (1 - 1 / ((over * 0.55) / dim + 1)) * dim;
    render(<PeekCard>SEEHUND</PeekCard>);
    for (const ueber of [40, 100, 400]) {
      fireEvent.pointerDown(deckel(), { pointerId: 1, clientY: 300 });
      fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - (MAX + ueber) });
      const erwartet = MAX + gummi(ueber, HOEHE * 0.4);
      expect(Math.abs(hub()), `${ueber} px ueber dem Anschlag`).toBeCloseTo(erwartet, 0);
      fireEvent.pointerUp(deckel(), { pointerId: 1 });
    }
  });

  it('meldet genau einmal an der Lesbarkeitsschwelle', () => {
    render(<PeekCard>SEEHUND</PeekCard>);
    ziehen(MAX * 0.2);
    expect(vi.mocked(haptic).mock.calls.filter((c) => c[0] === 'select')).toHaveLength(0);
    fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - MAX * 0.5 });
    expect(geheim().getAttribute('aria-hidden')).toBe('false');
    const nachSchwelle = vi.mocked(haptic).mock.calls.filter((c) => c[0] === 'select').length;
    expect(nachSchwelle).toBe(1);
    // Zittern zwischen den beiden Schwellen darf nicht rattern.
    fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - MAX * 0.36 });
    fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - MAX * 0.5 });
    expect(vi.mocked(haptic).mock.calls.filter((c) => c[0] === 'select')).toHaveLength(1);

    // Aber wer wirklich zumacht und neu aufzieht, MUSS wieder einen Tick
    // bekommen. Ohne diesen Teil bliebe eine Haptik unbemerkt, die nur beim
    // allerersten Aufdecken feuert und danach fuer immer verstummt.
    fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - MAX * 0.1 });
    expect(geheim().getAttribute('aria-hidden')).toBe('true');
    fireEvent.pointerMove(deckel(), { pointerId: 1, clientY: 300 - MAX * 0.5 });
    expect(vi.mocked(haptic).mock.calls.filter((c) => c[0] === 'select')).toHaveLength(2);
  });

  it('legt sich beim Loslassen zurück', () => {
    render(<PeekCard>SEEHUND</PeekCard>);
    ziehen(MAX * 0.8);
    fireEvent.pointerUp(deckel(), { pointerId: 1 });
    expect(hub()).toBe(0);
    expect(geheim().getAttribute('aria-hidden')).toBe('true');
  });

  it('legt sich auch zurück, wenn das System die Geste abbricht', () => {
    // Anruf oder Kontrollzentrum: es kommt kein pointerup. Ohne diesen Zweig
    // bliebe das Geheimwort offen liegen, waehrend das Handy weitergereicht wird.
    render(<PeekCard>SEEHUND</PeekCard>);
    ziehen(MAX * 0.8);
    fireEvent.pointerCancel(deckel(), { pointerId: 1 });
    expect(hub()).toBe(0);
    expect(geheim().getAttribute('aria-hidden')).toBe('true');
  });

  it('geht auch ohne Ziehen: ein Tipp rastet sie offen, der nächste schließt', () => {
    // WCAG 2.2 SC 2.5.7 verlangt eine Bedienung ohne Ziehbewegung.
    render(<PeekCard>SEEHUND</PeekCard>);
    fireEvent.pointerDown(deckel(), { pointerId: 1, clientY: 300 });
    fireEvent.pointerUp(deckel(), { pointerId: 1 });
    expect(geheim().getAttribute('aria-hidden')).toBe('false');
    fireEvent.pointerDown(deckel(), { pointerId: 2, clientY: 300 });
    fireEvent.pointerUp(deckel(), { pointerId: 2 });
    expect(geheim().getAttribute('aria-hidden')).toBe('true');
  });

  it('geht auch mit der Tastatur', () => {
    render(<PeekCard>SEEHUND</PeekCard>);
    fireEvent.keyDown(deckel(), { key: 'Enter' });
    expect(geheim().getAttribute('aria-hidden')).toBe('false');
  });

  it('meldet einmal, sobald zum ersten Mal lesbar war', () => {
    const gesehen = vi.fn();
    render(<PeekCard onRevealed={gesehen}>SEEHUND</PeekCard>);
    ziehen(MAX * 0.9);
    fireEvent.pointerUp(deckel(), { pointerId: 1 });
    ziehen(MAX * 0.9);
    expect(gesehen).toHaveBeenCalledTimes(1);
  });
});
