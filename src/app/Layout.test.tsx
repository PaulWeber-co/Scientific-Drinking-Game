import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';

vi.mock('../features/bac/WaterReminder', () => ({ WaterReminder: () => null }));
vi.mock('../features/party/GameInvite', () => ({ GameInvite: () => null }));
vi.mock('../lib/haptics', () => ({ haptic: vi.fn() }));

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

it.each(['/', '/spiele/kings-cup'])('markiert Spiele auf %s', (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Layout />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Spiele' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Runde' })).not.toHaveAttribute('aria-current');
});

it.each(['/lobby', '/pegel', '/album'])('markiert auf %s nur den passenden Tab', (path) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Layout />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Spiele' })).not.toHaveAttribute('aria-current');
  expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
});

it('wechselt per Tipp oder Tastatur den Tab und lässt die Linse folgen', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Layout />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('link', { name: 'Pegel' }));
  expect(screen.getByRole('link', { name: 'Pegel' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Pegel' })).toHaveClass('is-lit');
  expect(screen.getByRole('link', { name: 'Spiele' })).not.toHaveClass('is-lit');
});

it('lässt auf dem Profil die Linse bei den Spielen, ohne sie als aktuelle Seite auszugeben', () => {
  render(
    <MemoryRouter initialEntries={['/profil']}>
      <Layout />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Spiele' })).toHaveClass('is-lit');
  expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
});

it('scrollt beim erneuten Tipp auf den aktiven Tab nach oben, statt neu zu laden', () => {
  render(
    <MemoryRouter initialEntries={['/pegel']}>
      <Layout />
    </MemoryRouter>,
  );
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.click(screen.getByRole('link', { name: 'Pegel' }));
  expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
});
