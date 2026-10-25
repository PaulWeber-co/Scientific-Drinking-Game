// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DRINK_CATALOG } from '../../../engine/drinks';
import { Glass } from './Glass';
import { splash } from './glassPhysics';

vi.mock('./glassPhysics', async (orig) => ({
  ...(await orig<typeof import('./glassPhysics')>()),
  splash: vi.fn(),
}));

const props = {
  bac: 0.25,
  pending: 0.1,
  target: 0.4,
  drink: DRINK_CATALOG[0],
  showTarget: true,
  still: false,
};
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(17));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('zeichnet ein zugängliches Canvas', () => {
  render(<Glass {...props} />);
  expect(screen.getByRole('img').tagName).toBe('CANVAS');
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('0,25 Promille');
});
it('fordert im Stillstand kein Bild an, auch bei neuen Props', () => {
  const view = render(<Glass {...props} still />);
  view.rerender(<Glass {...props} bac={0.4} still />);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
it('bricht beim Unmount ab', () => {
  const { unmount } = render(<Glass {...props} />);
  unmount();
  expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
});
it('pausiert im Hintergrund und startet bei Rückkehr', () => {
  render(<Glass {...props} />);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  fireEvent(document, new Event('visibilitychange'));
  expect(cancelAnimationFrame).toHaveBeenCalledWith(17);
  vi.mocked(requestAnimationFrame).mockClear();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  fireEvent(document, new Event('visibilitychange'));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
});

it('schwappt beim Eintragen, nicht erst wenn der Alkohol im Blut ankommt', () => {
  vi.mocked(splash).mockClear();
  const view = render(<Glass {...props} bac={0} pending={0} />);
  // Frisch eingetragen: alles liegt noch im Magen, der Blutwert ist 0.
  view.rerender(<Glass {...props} bac={0} pending={0.3} />);
  expect(splash).toHaveBeenCalledTimes(1);
  // Umschichten vom Magen ins Blut ist kein neues Getränk.
  view.rerender(<Glass {...props} bac={0.1} pending={0.2} />);
  view.rerender(<Glass {...props} bac={0.08} pending={0.2} />);
  expect(splash).toHaveBeenCalledTimes(1);
});
