import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Kaputt(): never {
  throw new Error('kaputt');
}

const reload = vi.fn();

beforeEach(() => {
  localStorage.setItem('sdg.player', '{"state":{}}');
  localStorage.setItem('sdg.app', '{"state":{}}');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload },
    configurable: true,
  });
  render(
    <ErrorBoundary>
      <Kaputt />
    </ErrorBoundary>,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  reload.mockClear();
  localStorage.clear();
});

it('löscht nach einem Absturz nichts ohne Rückfrage', () => {
  const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Profil zurücksetzen' }));
  expect(ask).toHaveBeenCalledExactlyOnceWith(
    expect.stringMatching(/Profil.*Trink-Log.*Rückblicke vergangener Abende bleiben/),
  );
  expect(localStorage.getItem('sdg.player')).not.toBeNull();
  expect(localStorage.getItem('sdg.app')).not.toBeNull();
  expect(reload).not.toHaveBeenCalled();
});

it('setzt nach Bestätigung zurück und lädt neu', () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Profil zurücksetzen' }));
  expect(localStorage.getItem('sdg.player')).toBeNull();
  expect(localStorage.getItem('sdg.app')).toBeNull();
  expect(reload).toHaveBeenCalledTimes(1);
});
