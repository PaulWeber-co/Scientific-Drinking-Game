import { StrictMode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { NativeAwareTabBar } from './NativeAwareTabBar';
import { useApp } from '../store/app';

const native = vi.hoisted(() => ({
  available: true,
  onSelect: null as null | ((event: { index: number }) => void),
  show: vi.fn(async (_options: { selected: number; theme: string }) => {}),
  hide: vi.fn(async () => {}),
  remove: vi.fn(async () => {}),
  addListener: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'ios', isPluginAvailable: () => native.available },
  registerPlugin: () => ({ show: native.show, hide: native.hide, addListener: native.addListener }),
}));

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  window.Capacitor = { isNativePlatform: () => true };
  native.available = true;
  native.onSelect = null;
  native.show.mockReset().mockResolvedValue(undefined);
  native.hide.mockReset().mockResolvedValue(undefined);
  native.remove.mockReset().mockResolvedValue(undefined);
  native.addListener.mockReset().mockImplementation(async (_event, callback) => {
    native.onSelect = callback;
    return { remove: native.remove };
  });
  useApp.setState({ theme: 'dark' });
});
afterEach(() => { delete window.Capacitor; vi.restoreAllMocks(); });

function View() {
  return <MemoryRouter initialEntries={['/pegel']}><NativeAwareTabBar /><Routes>
    <Route path="/pegel" element={<p>Pegel-Seite</p>} />
    <Route path="/album" element={<p>Album-Seite</p>} />
  </Routes></MemoryRouter>;
}
const ready = async () => {
  await waitFor(() => expect(native.show).toHaveBeenCalledWith({ selected: 2, theme: 'dark' }));
  await waitFor(() => expect(screen.queryByRole('navigation', { name: 'Hauptnavigation' })).toBeNull());
};

it('behält den Web-Fallback ohne registriertes Plugin', async () => {
  native.available = false;
  render(<View />);
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
  expect(native.show).not.toHaveBeenCalled();
});

it('synchronisiert Routen, ohne beim Tab-Wechsel Listener neu aufzubauen oder die Leiste zu verstecken', async () => {
  render(<View />);
  await ready();
  act(() => native.onSelect?.({ index: 3 }));
  await waitFor(() => expect(screen.getByText('Album-Seite')).toBeInTheDocument());
  await waitFor(() => expect(native.show).toHaveBeenLastCalledWith({ selected: 3, theme: 'dark' }));
  expect(native.addListener).toHaveBeenCalledTimes(1);
  expect(native.hide).not.toHaveBeenCalled();
  expect(native.remove).not.toHaveBeenCalled();
});

it('versteckt UIKit unter Web-Dialogen und ignoriert deren verspätete Tab-Ereignisse', async () => {
  const view = render(<View />);
  await ready();
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
  act(() => { document.body.appendChild(dialog); });
  await waitFor(() => expect(native.hide).toHaveBeenCalledTimes(1));
  act(() => native.onSelect?.({ index: 3 }));
  expect(screen.getByText('Pegel-Seite')).toBeInTheDocument();
  act(() => { dialog.remove(); });
  await waitFor(() => expect(native.show).toHaveBeenCalledTimes(2));
  view.unmount();
});

it('gibt bei fehlerhaftem show die Web-Leiste frei und entfernt den Listener', async () => {
  native.show.mockRejectedValueOnce(new Error('Bridge down'));
  render(<View />);
  await waitFor(() => expect(native.hide).toHaveBeenCalled());
  expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
  expect(native.remove).toHaveBeenCalledTimes(1);
  act(() => native.onSelect?.({ index: 3 }));
  expect(screen.getByText('Pegel-Seite')).toBeInTheDocument();
});

it('wartet beim Unmount auf ein ausstehendes show, bevor hide ausgeführt wird', async () => {
  let finish!: () => void;
  native.show.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const view = render(<View />);
  await waitFor(() => expect(native.show).toHaveBeenCalled());
  const stale = native.onSelect;
  view.unmount();
  expect(native.hide).not.toHaveBeenCalled();
  await act(async () => { finish(); });
  await waitFor(() => expect(native.hide).toHaveBeenCalledTimes(1));
  act(() => stale?.({ index: 3 }));
  expect(native.remove).toHaveBeenCalledTimes(1);
});

it('behandelt StrictMode ohne doppelte native Leiste und aktualisiert das App-Farbschema', async () => {
  render(<StrictMode><View /></StrictMode>);
  await ready();
  expect(native.addListener).toHaveBeenCalledTimes(1);
  act(() => useApp.setState({ theme: 'light' }));
  await waitFor(() => expect(native.show).toHaveBeenLastCalledWith({ selected: 2, theme: 'light' }));
});

it('scrollt bei erneuter Wahl des aktiven Tabs nach oben und verwirft ungültige Indizes', async () => {
  render(<View />);
  await ready();
  act(() => { native.onSelect?.({ index: -1 }); native.onSelect?.({ index: 1.5 }); native.onSelect?.({ index: 4 }); });
  expect(screen.getByText('Pegel-Seite')).toBeInTheDocument();
  act(() => native.onSelect?.({ index: 2 }));
  expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
});
