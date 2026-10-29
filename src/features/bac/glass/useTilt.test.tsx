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
function orientation(beta: number, gamma: number) {
  window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma, alpha: 0 }));
}
function motion(x: number, y: number) {
  window.dispatchEvent(
    Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x, y, z: 0 } }),
  );
}

it('rechnet die Lage in die Schwerkraft auf dem Bildschirm um und entfernt die Listener', async () => {
  sensor('granted');
  const remove = vi.spyOn(window, 'removeEventListener');
  const { result, unmount } = renderHook(useTilt);
  await act(async () => {
    await result.current.request();
  });
  // Aufrecht gehalten: Schwerkraft zeigt nach unten.
  act(() => orientation(90, 0));
  expect(result.current.gravity.current?.x).toBeCloseTo(0, 5);
  expect(result.current.gravity.current?.y).toBeCloseTo(1, 5);
  // Rechts nach unten gekippt: die Schwerkraft wandert nach rechts.
  for (let i = 0; i < 20; i++) act(() => orientation(45, 30));
  expect(result.current.gravity.current?.x).toBeCloseTo(Math.sin(Math.PI / 6) * Math.cos(Math.PI / 4), 3);
  expect(result.current.gravity.current?.y).toBeCloseTo(Math.sin(Math.PI / 4), 3);
  unmount();
  expect(remove.mock.calls.some(([type]) => type === 'deviceorientation')).toBe(true);
  expect(remove.mock.calls.some(([type]) => type === 'devicemotion')).toBe(true);
});

it.each([
  ['nach Spezifikation', 1],
  ['mit umgekehrtem Vorzeichen wie iOS', -1],
])('nimmt die Beschleunigung %s mit, damit Schütteln schwappt', async (_, sign) => {
  sensor('granted');
  const { result } = renderHook(useTilt);
  await act(async () => {
    await result.current.request();
  });
  // Aufrecht und still: Lage und Beschleunigung müssen dasselbe sagen.
  for (let i = 0; i < 10; i++) {
    act(() => {
      orientation(90, 0);
      motion(0, 9.81 * sign);
    });
  }
  expect(result.current.gravity.current?.y).toBeCloseTo(1, 2);
  // Ruck nach rechts: die Flüssigkeit spürt eine Kraft nach links.
  for (let i = 0; i < 10; i++) act(() => motion(4 * sign, 9.81 * sign));
  expect(result.current.gravity.current!.x).toBeLessThan(-0.3);
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
