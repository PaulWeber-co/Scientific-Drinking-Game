import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
