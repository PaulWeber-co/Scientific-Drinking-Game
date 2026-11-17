import { afterEach, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { handleBack } from './androidBack';
import { useBackHandler } from '../lib/backHandler';

const setup = (historyIndex: number, pathname: string) => {
  const navigate = vi.fn();
  const minimize = vi.fn();
  return {
    navigate,
    minimize,
    run: () => handleBack({ historyIndex, pathname, navigate, minimize }),
  };
};

let detach: (() => void) | undefined;
afterEach(() => detach?.());

it('schließt zuerst eine offene Ebene, die auf Escape hört', () => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') e.preventDefault();
  };
  document.addEventListener('keydown', onKey);
  detach = () => document.removeEventListener('keydown', onKey);
  const { navigate, minimize, run } = setup(2, '/lobby');
  expect(run()).toBe('closed-overlay');
  expect(navigate).not.toHaveBeenCalled();
  expect(minimize).not.toHaveBeenCalled();
});

it('geht eine Seite zurück, wenn es einen Verlauf gibt', () => {
  const { navigate, run } = setup(2, '/spiele/kings-cup');
  expect(run()).toBe('back');
  expect(navigate).toHaveBeenCalledWith(-1);
});

it('springt ohne Verlauf zur Spielewand statt die App zu schließen', () => {
  const { navigate, minimize, run } = setup(0, '/profil');
  expect(run()).toBe('home');
  expect(navigate).toHaveBeenCalledWith('/', { replace: true, state: { back: true } });
  expect(minimize).not.toHaveBeenCalled();
});

it('legt die App auf der Spielewand in den Hintergrund', () => {
  const { navigate, minimize, run } = setup(0, '/');
  expect(run()).toBe('minimize');
  expect(minimize).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
});

it('nimmt das Zurück des obersten Bildschirms vor dem Verlauf', () => {
  const unten = vi.fn();
  const oben = vi.fn();
  renderHook(() => useBackHandler(unten));
  const { unmount } = renderHook(() => useBackHandler(oben));
  const { navigate, run } = setup(2, '/profil');
  expect(run()).toBe('screen');
  expect(oben).toHaveBeenCalledOnce();
  expect(unten).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  unmount();
  run();
  expect(unten).toHaveBeenCalledOnce();
});

it('ignoriert ein abgeschaltetes Bildschirm-Zurück', () => {
  const back = vi.fn();
  const { unmount } = renderHook(() => useBackHandler(back, false));
  const { navigate, run } = setup(1, '/onboarding');
  expect(run()).toBe('back');
  expect(back).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith(-1);
  unmount();
});
