import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useSwipeBack, useSwipeDown } from './gestures';

/** Ein Touch-Ereignis mit Zeitstempel – daraus rechnen die Gesten das Tempo. */
function touch(
  el: Element,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  x: number,
  y: number,
  t: number,
) {
  const points = type === 'touchEnd' ? [] : [{ clientX: x, clientY: y }];
  const event = createEvent[type](el, { touches: points, changedTouches: [{ clientX: x, clientY: y }] });
  Object.defineProperty(event, 'timeStamp', { value: t });
  fireEvent(el, event);
}

/** Zieht in Schritten von (x0,y0) nach (x1,y1) über `ms` Millisekunden. */
function drag(el: Element, from: [number, number], to: [number, number], ms: number, steps = 8) {
  touch(el, 'touchStart', from[0], from[1], 0);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    touch(el, 'touchMove', from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, ms * k);
  }
  touch(el, 'touchEnd', to[0], to[1], ms);
}

function Page({ onBack, stay }: { onBack: () => void; stay?: boolean }) {
  const ref = useSwipeBack<HTMLDivElement>(onBack, { stay });
  return (
    <div ref={ref} data-testid="page">
      <p>Inhalt</p>
      <input aria-label="Feld" />
      <div data-testid="karussell" style={{ overflowX: 'auto' }} />
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Wisch nach rechts', () => {
  it('geht nach einem langen Zug zurück und folgt dabei dem Finger', () => {
    const onBack = vi.fn();
    render(<Page onBack={onBack} />);
    const page = screen.getByTestId('page');
    touch(page, 'touchStart', 120, 300, 0);
    touch(page, 'touchMove', 140, 302, 16);
    touch(page, 'touchMove', 300, 305, 400);
    // Die Seite hängt am Finger, gemessen ab dem Moment, ab dem es ein Wisch ist.
    expect(page.style.translate).toBe('160px 0');
    touch(page, 'touchMove', 600, 305, 1200);
    touch(page, 'touchEnd', 600, 305, 1200);
    expect(onBack).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('reicht auch ein kurzer, schneller Schnipser', () => {
    const onBack = vi.fn();
    render(<Page onBack={onBack} />);
    drag(screen.getByTestId('page'), [100, 300], [190, 300], 90);
    vi.runAllTimers();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('federt bei einem kurzen, langsamen Zug zurück', () => {
    const onBack = vi.fn();
    render(<Page onBack={onBack} />);
    const page = screen.getByTestId('page');
    drag(page, [100, 300], [180, 300], 900);
    vi.runAllTimers();
    expect(onBack).not.toHaveBeenCalled();
    expect(page.style.translate).toBe('');
  });

  it('lässt senkrechtes Scrollen und Wischen nach links in Ruhe', () => {
    const onBack = vi.fn();
    render(<Page onBack={onBack} />);
    const page = screen.getByTestId('page');
    drag(page, [200, 500], [230, 100], 200);
    drag(page, [600, 300], [100, 300], 100);
    vi.runAllTimers();
    expect(onBack).not.toHaveBeenCalled();
    expect(page.style.translate).toBe('');
  });

  it('überlässt Eingabefelder und Karussells sich selbst – außer vom Rand', () => {
    const onBack = vi.fn();
    render(<Page onBack={onBack} />);
    const field = screen.getByLabelText('Feld');
    const karussell = screen.getByTestId('karussell');
    Object.defineProperty(karussell, 'scrollWidth', { value: 800 });
    Object.defineProperty(karussell, 'clientWidth', { value: 300 });
    drag(field, [200, 300], [700, 300], 100);
    drag(karussell, [200, 300], [700, 300], 100);
    vi.runAllTimers();
    expect(onBack).not.toHaveBeenCalled();
    drag(karussell, [10, 300], [600, 300], 100);
    vi.runAllTimers();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('springt bei `stay` sofort heim, statt hinauszugleiten', () => {
    const onBack = vi.fn();
    render(<Page onBack={onBack} stay />);
    const page = screen.getByTestId('page');
    drag(page, [100, 300], [700, 300], 300);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(page.style.translate).toBe('');
  });
});

function SheetLike({ onClose }: { onClose: () => void }) {
  const scrim = useRef<HTMLDivElement>(null);
  const ref = useSwipeDown<HTMLDivElement>(onClose, scrim);
  return (
    <div ref={scrim} data-testid="scrim">
      <div ref={ref} data-testid="sheet">
        <p>Liste</p>
      </div>
    </div>
  );
}

describe('Sheet nach unten wegziehen', () => {
  it('schließt nach einem Zug über ein Drittel und hellt den Hintergrund dabei auf', () => {
    const onClose = vi.fn();
    render(<SheetLike onClose={onClose} />);
    const sheet = screen.getByTestId('sheet');
    touch(sheet, 'touchStart', 200, 300, 0);
    touch(sheet, 'touchMove', 202, 320, 16);
    touch(sheet, 'touchMove', 202, 420, 400);
    expect(sheet.style.translate).toBe('0 100px');
    expect(screen.getByTestId('scrim').style.backgroundColor).not.toBe('');
    touch(sheet, 'touchMove', 202, 700, 900);
    touch(sheet, 'touchEnd', 202, 700, 900);
    vi.runAllTimers();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bleibt offen, solange der Inhalt gescrollt ist', () => {
    const onClose = vi.fn();
    render(<SheetLike onClose={onClose} />);
    const sheet = screen.getByTestId('sheet');
    sheet.getBoundingClientRect = () => ({ top: 0, height: 600, width: 400 }) as DOMRect;
    sheet.scrollTop = 120;
    drag(screen.getByText('Liste'), [200, 300], [200, 700], 100);
    vi.runAllTimers();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('federt nach einem kleinen Zupfer zurück', () => {
    const onClose = vi.fn();
    render(<SheetLike onClose={onClose} />);
    const sheet = screen.getByTestId('sheet');
    sheet.getBoundingClientRect = () => ({ top: 0, height: 600, width: 400 }) as DOMRect;
    drag(sheet, [200, 300], [200, 360], 900);
    vi.runAllTimers();
    expect(onClose).not.toHaveBeenCalled();
    expect(sheet.style.translate).toBe('');
  });
});
