// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTilt } from './useTilt';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function sensor(choice: string) {
  const permission = vi.fn().mockResolvedValue(choice);
  vi.stubGlobal(
    'DeviceOrientationEvent',
    Object.assign(class {}, { requestPermission: permission }),
  );
  return permission;
}
it('fragt erst auf Anfrage und nur einmal', async () => {
  const permission = sensor('granted');
  const { result } = renderHook(useTilt);
  expect(permission).not.toHaveBeenCalled();
  await act(async () => {
    await Promise.all([result.current.request(), result.current.request()]);
  });
  expect(permission).toHaveBeenCalledTimes(1);
  expect(result.current.state).toBe('on');
});
it('hängt nach Ablehnung keinen Sensor ein, auch nach neuem Mount', async () => {
  const permission = sensor('denied');
  const spy = vi.spyOn(window, 'addEventListener');
  const { result, unmount } = renderHook(useTilt);
  await act(async () => {
    await result.current.request();
  });
  expect(result.current.state).toBe('denied');
  unmount();
  const next = renderHook(useTilt);
  await act(async () => {
    await next.result.current.request();
  });
  expect(permission).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls.filter(([type]) => type === 'deviceorientation')).toHaveLength(0);
});
it('rechnet Gamma um und entfernt den Listener', async () => {
  sensor('granted');
  const remove = vi.spyOn(window, 'removeEventListener');
  const { result, unmount } = renderHook(useTilt);
  await act(async () => {
    await result.current.request();
  });
  act(() => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { gamma: 90 })));
  expect(result.current.target).toBe(0.6);
  unmount();
  expect(remove.mock.calls.some(([type]) => type === 'deviceorientation')).toBe(true);
});

it('fragt nach eigenem Nein nie beim System nach', async () => {
  const permission = sensor('granted');
  const { result, unmount } = renderHook(useTilt);
  act(() => result.current.decline());
  expect(result.current.state).toBe('denied');
  await act(async () => {
    await result.current.request();
  });
  unmount();
  const next = renderHook(useTilt);
  expect(next.result.current.state).toBe('denied');
  expect(permission).not.toHaveBeenCalled();
});
