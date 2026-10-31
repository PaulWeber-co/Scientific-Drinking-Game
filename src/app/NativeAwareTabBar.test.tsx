import { afterEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NativeAwareTabBar } from './NativeAwareTabBar';

const native = vi.hoisted(() => ({
  available: true,
  onSelect: null as null | ((event: { index: number }) => void),
  show: vi.fn(async (_options: { selected: number }) => {}),
  setSelected: vi.fn(async (_options: { selected: number }) => {}),
  hide: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'ios', isPluginAvailable: () => native.available },
  registerPlugin: () => ({
    show: native.show,
    setSelected: native.setSelected,
    hide: native.hide,
    addListener: async (_event: string, callback: (event: { index: number }) => void) => {
      native.onSelect = callback;
      return { remove: native.remove };
    },
  }),
}));

afterEach(() => {
  delete window.Capacitor;
  native.available = true;
  native.onSelect = null;
  vi.clearAllMocks();
});

function view() {
  return render(
    <MemoryRouter initialEntries={['/pegel']}>
      <NativeAwareTabBar />
      <Routes>
        <Route path="/pegel" element={<p>Pegel-Seite</p>} />
        <Route path="/album" element={<p>Album-Seite</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

it('laesst die Web-Leiste stehen, wenn der native Build das Plugin nicht enthaelt', async () => {
  window.Capacitor = { isNativePlatform: () => true };
  native.available = false;
  view();
  await waitFor(() => expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument());
  expect(native.show).not.toHaveBeenCalled();
});

it('uebernimmt native Tabs erst nach show und synchronisiert die Routen in beide Richtungen', async () => {
  window.Capacitor = { isNativePlatform: () => true };
  const result = view();
  await waitFor(() => expect(native.show).toHaveBeenCalledWith({ selected: 2 }));
  await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).toBeNull());
  act(() => native.onSelect?.({ index: 3 }));
  await waitFor(() => expect(screen.getByText('Album-Seite')).toBeInTheDocument());
  await waitFor(() => expect(native.setSelected).toHaveBeenCalledWith({ selected: 3 }));
  result.unmount();
  expect(native.hide).toHaveBeenCalled();
});
