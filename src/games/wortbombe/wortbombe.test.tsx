import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { wortbombe } from './index';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({
  haptic: vi.fn(),
  // Der Zünder schlägt nicht mehr gleich hart, sondern härter, je näher der
  // Knall kommt.
  hapticRamp: vi.fn(),
  setHapticsEnabled: vi.fn(),
}));
vi.mock('../../lib/sound', () => ({
  sound: vi.fn(),
  stopSounds: vi.fn(),
  setSoundEnabled: vi.fn(),
}));

const { haptic } = await import('../../lib/haptics');
const { sound, stopSounds } = await import('../../lib/sound');

const spieler: GamePlayer[] = [
  { id: 'p0', name: 'Paul', color: 'blue', online: true },
  { id: 'p1', name: 'Toni', color: 'pink', online: true },
  { id: 'p2', name: 'Mia', color: 'green', online: true },
];

type Zustand = ReturnType<typeof wortbombe.createState>;

function Spiel({
  state,
  me,
  online,
  isHost,
}: {
  state: Zustand;
  me: GamePlayer;
  online: boolean;
  isHost: boolean;
}) {
  const Game = wortbombe.Component;
  return (
    <PartyCtx.Provider value={{ me, players: spieler } as unknown as PartyValue}>
      <Game
        state={state}
        players={spieler}
        me={me}
        isHost={isHost}
        online={online}
        dispatch={() => {}}
        quit={() => {}}
      />
    </PartyCtx.Provider>
  );
}

const ticks = () => vi.mocked(sound).mock.calls.filter((c) => c[0] === 'tick').length;
const knalle = () => vi.mocked(sound).mock.calls.filter((c) => c[0] === 'boom').length;

beforeEach(() => {
  vi.mocked(haptic).mockClear();
  vi.mocked(sound).mockClear();
  vi.mocked(stopSounds).mockClear();
});

describe('Wortbombe: der Knall', () => {
  // Reihenfolge festnageln: `createState` mischt, sonst waere der „Nicht-Halter"
  // mal doch der Halter und der Lauf nur manchmal rot.
  const knallt = (): Zustand => ({
    ...wortbombe.createState(spieler),
    phase: 'boom',
    order: ['p0', 'p1', 'p2'],
    holderIndex: 0,
  });

  it('schlägt genau einmal zu, auch wenn derselbe Zustand erneut gerendert wird', () => {
    // Frueher stand hier `rerender(<div />)` - das ist ein Abbau, kein zweiter
    // Durchlauf, und die Zusicherung war trivial wahr.
    const state = knallt();
    const { rerender } = render(<Spiel state={state} me={spieler[0]} online={false} isHost />);
    rerender(<Spiel state={state} me={spieler[0]} online={false} isHost />);
    expect(knalle()).toBe(1);
  });

  it('erreicht als Vibration auch ein Gerät, das weder Halter noch Host ist', () => {
    // Vorher lief der Zuend-Timer fuer diese Person gar nicht: sie sah die
    // Explosion, spuerte und hoerte aber nichts.
    render(<Spiel state={knallt()} me={spieler[2]} online isHost={false} />);
    // 'boom' statt 'error': Der Schlag ist das Ereignis selbst, keine
    // Fehlermeldung – und er muss sich vom letzten Tick des Zünders absetzen.
    expect(haptic).toHaveBeenCalledWith('boom');
  });

  it('klingt online nur dort, wo auch der Zünder klang', () => {
    // Sechs versetzte Knalle sind kein Ereignis, sondern ein Steinschlag.
    render(<Spiel state={knallt()} me={spieler[2]} online isHost={false} />);
    expect(knalle()).toBe(0);
  });

  it('bricht laufende Klänge ab, wenn das Spiel verlassen wird', () => {
    const { unmount } = render(<Spiel state={knallt()} me={spieler[0]} online={false} isHost />);
    unmount();
    expect(stopSounds).toHaveBeenCalled();
  });
});

describe('Wortbombe: der Zünder', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const laeuft = (holderIndex: number): Zustand => ({
    ...wortbombe.createState(spieler),
    phase: 'running',
    order: ['p0', 'p1', 'p2'],
    holderIndex,
    // Beide Zeitpunkte gehoeren zusammen: der Takt kommt aus dem Verhaeltnis
    // von verstrichener zu gesamter Zuendzeit.
    armedAt: Date.now(),
    explodesAt: Date.now() + 30_000,
  });

  it('tickt und zieht dabei an', () => {
    render(<Spiel state={laeuft(0)} me={spieler[0]} online={false} isHost />);
    act(() => void vi.advanceTimersByTime(2_000));
    const frueh = ticks();
    vi.mocked(sound).mockClear();
    // Gleich langes Fenster kurz vor dem Knall: der Takt muss dichter sein.
    act(() => void vi.advanceTimersByTime(26_000));
    vi.mocked(sound).mockClear();
    act(() => void vi.advanceTimersByTime(2_000));
    expect(ticks()).toBeGreaterThan(frueh);
  });

  it('behält den Takt, wenn das Handy weitergegeben wird', () => {
    // Stuende `isHolder` in den Abhaengigkeiten, liefe der Effekt bei jeder
    // Weitergabe neu an: erst 900 ms Ruhe, dann wieder der Anfangstakt.
    const state = laeuft(0);
    const { rerender } = render(<Spiel state={state} me={spieler[0]} online={false} isHost />);
    act(() => void vi.advanceTimersByTime(20_000));
    vi.mocked(sound).mockClear();

    rerender(<Spiel state={{ ...state, holderIndex: 1 }} me={spieler[0]} online={false} isHost />);
    act(() => void vi.advanceTimersByTime(899));
    expect(ticks()).toBeGreaterThan(0);
  });
});
