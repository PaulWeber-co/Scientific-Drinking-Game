import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { Sheet, Stepper } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

it('hält den Fokus im benannten Sheet und gibt ihn nach Escape zurück', () => {
  function Example() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Öffnen</button>
        <Sheet open={open} onClose={() => setOpen(false)} title="Auswahl">
          <button>Letzter</button>
        </Sheet>
      </>
    );
  }
  render(<Example />);
  const trigger = screen.getByRole('button', { name: 'Öffnen' });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Auswahl' });
  expect(dialog).toHaveAttribute('aria-labelledby');
  expect(screen.getByText('Auswahl')).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Letzter' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Fertig' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(trigger).toHaveFocus();
});

it('benennt Feld, Richtung, Wert und Einheit des Steppers und begrenzt die Eingabe', () => {
  const change = vi.fn();
  render(<Stepper label="Gewicht" value={70} min={35} max={200} unit="kg" onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Gewicht erhöhen, aktuell 70 kg' }));
  expect(change).toHaveBeenCalledWith(71);
  fireEvent.click(screen.getByRole('button', { name: 'Gewicht verringern, aktuell 70 kg' }));
  expect(change).toHaveBeenLastCalledWith(69);
  const value = screen.getByRole('spinbutton', { name: 'Gewicht' });
  expect(value).toHaveAttribute('aria-valuenow', '70');
  expect(value).toHaveAttribute('aria-valuemin', '35');
  expect(value).toHaveAttribute('aria-valuemax', '200');
  fireEvent.keyDown(value, { key: 'ArrowUp' });
  expect(change).toHaveBeenLastCalledWith(71);
});

it('lässt einem Feld mit autoFocus den Fokus, damit die Tastatur offen bleibt', () => {
  render(
    <Sheet open onClose={() => {}} title="Blankokarte">
      <input aria-label="Antwort" autoFocus />
    </Sheet>,
  );
  expect(screen.getByRole('textbox', { name: 'Antwort' })).toHaveFocus();
});

it('gibt das Scrollen erst frei, wenn das letzte Sheet zu ist – in jeder Reihenfolge', () => {
  let api!: { a: (v: boolean) => void; b: (v: boolean) => void };
  function Zwei() {
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);
    api = { a: setA, b: setB };
    return (
      <>
        <Sheet open={a} onClose={() => setA(false)} title="A">
          <button>x</button>
        </Sheet>
        <Sheet open={b} onClose={() => setB(false)} title="B">
          <button>y</button>
        </Sheet>
      </>
    );
  }
  render(<Zwei />);
  act(() => api.a(true));
  act(() => api.b(true));
  act(() => api.a(false));
  expect(document.body.style.overflow, 'B ist noch offen').toBe('hidden');
  act(() => api.b(false));
  expect(document.body.style.overflow).toBe('');
});
