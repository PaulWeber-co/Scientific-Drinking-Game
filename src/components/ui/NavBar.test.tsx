import { afterEach, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NavBar } from './index';

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event('scroll'));
  });
}

it('ist in Ruhe durchsichtig und bekommt Milchglas, sobald Inhalt darunter scrollt', () => {
  render(<NavBar title="Runde" />);
  const bar = screen.getByRole('banner');
  expect(bar).not.toHaveClass('navbar--edge');
  scrollTo(120);
  expect(bar).toHaveClass('navbar--edge');
  scrollTo(0);
  expect(bar).not.toHaveClass('navbar--edge');
});

it('reicht bis unter die Statusleiste, damit sie beim Scrollen nicht nach oben rutscht', () => {
  // Klebt die Leiste bei top: 0, muss sie dort auch schon beginnen: sie zieht
  // sich um genau den oberen Innenabstand des Bildschirms nach oben und
  // schiebt ihren Inhalt um denselben Betrag zurück.
  const css = readFileSync(join(__dirname, '../../styles/global.css'), 'utf8');
  const screenTop = css.match(/\.screen \{[^}]*padding: (calc\(var\(--safe-top\) \+ var\(--s-3\)\))/)?.[1];
  expect(screenTop).toBe('calc(var(--safe-top) + var(--s-3))');
  const navbar = css.match(/\.navbar \{([^}]*)\}/)?.[1] ?? '';
  expect(navbar).toMatch(/top: 0;/);
  expect(navbar).toMatch(/margin: calc\(-1 \* \(var\(--safe-top\) \+ var\(--s-3\)\)\)/);
  expect(navbar).toMatch(/padding: calc\(var\(--safe-top\) \+ var\(--s-3\) \+ var\(--s-2\)\)/);
});
