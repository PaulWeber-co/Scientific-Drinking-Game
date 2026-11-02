import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Sheet } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));
afterEach(() => { document.body.style.overflow = ''; });

function Stacked() {
  const [parent, setParent] = useState(false);
  const [child, setChild] = useState(false);
  return <>
    <button onClick={() => setParent(true)}>Einstellungen öffnen</button>
    <Sheet open={parent} onClose={() => setParent(false)} title="Einstellungen">
      <button onClick={() => setChild(true)}>Getränke öffnen</button>
      <Sheet open={child} onClose={() => setChild(false)} title="Getränke"><button>Auswählen</button></Sheet>
    </Sheet>
  </>;
}

it('schließt mit Escape nur das obere Sheet, hält die Scrollsperre und gibt den Fokus zurück', () => {
  document.body.style.overflow = 'clip';
  render(<Stacked />);
  const opener = screen.getByText('Einstellungen öffnen');
  opener.focus();
  fireEvent.click(opener);
  const childOpener = screen.getByText('Getränke öffnen');
  childOpener.focus();
  fireEvent.click(childOpener);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Getränke' })).toBeNull();
  expect(screen.getByRole('dialog', { name: 'Einstellungen' })).toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  expect(childOpener).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.overflow).toBe('clip');
  expect(opener).toHaveFocus();
});

it('hält Tab und Shift+Tab im Dialog und verhindert Fokus auf dem Hintergrund', () => {
  render(<><button>Hintergrund</button><Sheet open onClose={() => {}} title="Auswahl"><button>Letzter Knopf</button></Sheet></>);
  const first = screen.getByRole('button', { name: 'Fertig' });
  const last = screen.getByRole('button', { name: 'Letzter Knopf' });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: 'Tab' });
  expect(first).toHaveFocus();
  screen.getByText('Hintergrund').focus();
  expect(first).toHaveFocus();
});

it('behält den Fokus bei Neu-Rendern mit neuem onClose und nutzt den aktuellen Callback', () => {
  const oldClose = vi.fn();
  const newClose = vi.fn();
  const view = render(<Sheet open title="Test" onClose={oldClose}><input aria-label="Name" /></Sheet>);
  screen.getByLabelText('Name').focus();
  view.rerender(<Sheet open title="Test" onClose={newClose}><input aria-label="Name" /></Sheet>);
  expect(screen.getByLabelText('Name')).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(oldClose).not.toHaveBeenCalled();
  expect(newClose).toHaveBeenCalledTimes(1);
});
