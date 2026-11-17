import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NativeAwareTabBar } from './NativeAwareTabBar';

vi.mock('../lib/haptics', () => ({ haptic: vi.fn() }));
// Android meldet sich nie als iOS: die native UIKit-Leiste bleibt aus.
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => false },
  registerPlugin: () => ({}),
}));

afterEach(() => {
  delete window.Capacitor;
});

const view = (path = '/pegel') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <NativeAwareTabBar />
      <Routes>
        <Route path="/" element={<p>Spielewand</p>} />
        <Route path="/pegel" element={<p>Pegel-Seite</p>} />
        <Route path="/album" element={<p>Album-Seite</p>} />
      </Routes>
    </MemoryRouter>,
  );

it('zeigt unter Android die Material-Leiste mit dem aktiven Tab', () => {
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
  const { container } = view();
  expect(container.querySelector('.m3nav')).not.toBeNull();
  expect(container.querySelector('.tabbar')).toBeNull();
  expect(screen.getByRole('link', { name: 'Pegel' })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('link', { name: 'Album' }));
  expect(screen.getByText('Album-Seite')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Album' })).toHaveAttribute('aria-current', 'page');
});

it('lässt Browser und iOS bei der Glaskapsel', () => {
  const { container, unmount } = view();
  expect(container.querySelector('.tabbar')).not.toBeNull();
  expect(container.querySelector('.m3nav')).toBeNull();
  unmount();
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
  const ios = view();
  expect(ios.container.querySelector('.m3nav')).toBeNull();
});
