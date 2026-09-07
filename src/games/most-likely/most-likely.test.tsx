import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { mostLikely } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

import { meta } from './meta';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { usePlayer, defaultProfile } from '../../store/player';
import { useApp } from '../../store/app';
import { useSeen } from '../../store/seen';
import type { GameAction, GameActionInput, GamePlayer } from '../types';

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const runde = (n: number): GamePlayer[] => [
  me,
  ...Array.from({ length: n - 1 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Gast ${i + 1}`,
    color: 'pink' as const,
    online: true,
  })),
];

type State = ReturnType<typeof mostLikely.createState>;
const tun = (s: State, a: GameActionInput, players: GamePlayer[]) =>
  mostLikely.reduce(s, { ...a, by: a.by ?? me.id, at: Date.now() } as GameAction, players);

/** Wie viele Stimmen jede Zielperson in der laufenden Runde hat. */
function auszaehlen(s: State): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of Object.values(s.votes)) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

beforeEach(() => {
  useApp.setState({ gameLength: 'endlos', spicy: {}, taskOnSkip: 'aus' });
  useSeen.setState({ seen: {}, cursor: 0 });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
  });
});

describe('Wer aus der Runde ohne eigene Geräte', () => {
  it('bietet sich ohne eigene Geräte an', () => {
    // Vorher hielt `requiresOwnDevice` das Spiel aus dem Pass-&-Play-Modus
    // heraus – dabei hatte das Original nie ein Geheimnis.
    expect(meta.requiresOwnDevice).toBe(false);
  });

  it('online: eine Stimme pro Gerät zaehlt wie bisher zusammen', () => {
    const players = runde(3);
    let s = mostLikely.createState(players);
    s = tun(s, { type: 'vote', target: 'p1', by: 'p0' }, players);
    expect(s.phase, 'noch nicht alle dran').toBe('vote');
    s = tun(s, { type: 'vote', target: 'p1', by: 'p1' }, players);
    s = tun(s, { type: 'vote', target: 'p2', by: 'p2' }, players);
    expect(s.phase).toBe('result');
    expect(auszaehlen(s)).toEqual({ p1: 2, p2: 1 });
    expect(s.tally).toEqual({ p1: 2, p2: 1 });
  });

  it('geteiltes Handy: jede Person trinkt pro Stimme, nicht nur die Meistgewählten', () => {
    // Kernaenderung dieses Pakets: frueher zaehlte nur der Sieger, jetzt hat
    // jede einzelne Stimme eine Folge.
    const players = runde(4);
    let s = mostLikely.createState(players);
    s = tun(s, { type: 'countVotes', counts: { p0: 2, p1: 1, p2: 0 } }, players);
    expect(s.phase).toBe('result');
    expect(auszaehlen(s)).toEqual({ p0: 2, p1: 1 });
    expect(s.tally).toEqual({ p0: 2, p1: 1 });
  });

  it('zaehlt Finger-Stimmen ueber mehrere Runden zusammen', () => {
    const players = runde(3);
    let s = mostLikely.createState(players);
    s = tun(s, { type: 'countVotes', counts: { p0: 2 } }, players);
    s = tun(s, { type: 'next' }, players);
    s = tun(s, { type: 'countVotes', counts: { p0: 1, p1: 3 } }, players);
    expect(s.tally).toEqual({ p0: 3, p1: 3 });
  });

  it('deckelt Finger je Person auf die Spielerzahl und ignoriert Unsinn', () => {
    const players = runde(3);
    let s = mostLikely.createState(players);
    s = tun(s, { type: 'countVotes', counts: { p0: 99, p1: -5, p2: NaN } }, players);
    const counts = auszaehlen(s);
    expect(counts.p0, 'Deckel bei der Spielerzahl').toBe(players.length);
    expect(counts.p1 ?? 0, 'negative Eingabe ignoriert').toBe(0);
    expect(counts.p2 ?? 0, 'NaN ignoriert').toBe(0);
  });

  it('ignoriert eine zweite Auszaehlung ausserhalb der Abstimmung (Phase-Schutz)', () => {
    // Gegenprobe zur Phase-Pruefung: ohne sie wuerde ein doppelter Tap auf
    // "Aufdecken" die Stimmen ein zweites Mal verbuchen.
    const players = runde(3);
    let s = mostLikely.createState(players);
    s = tun(s, { type: 'countVotes', counts: { p0: 1 } }, players);
    expect(s.phase).toBe('result');
    const nochmal = tun(s, { type: 'countVotes', counts: { p1: 5 } }, players);
    expect(nochmal, 'zweiter Aufruf darf den Zustand nicht veraendern').toBe(s);
  });
});

describe('Wer aus der Runde: Ablauf an einem geteilten Handy', () => {
  it('laeuft vom Fingerzaehlen bis zum Endstand durch', () => {
    // "kurz" statt "endlos", damit die Partie tatsaechlich im Endstand endet
    // (Completion-Kriterium der Stage: bis zum Ende durchlaufen).
    useApp.setState({ gameLength: 'kurz', spicy: {}, taskOnSkip: 'aus' });
    const players = runde(4);
    const initial = mostLikely.createState(players);
    const goal = initial.goal;
    expect(goal, 'Rundenziel muss fuer diesen Test gesetzt sein').toBeGreaterThan(0);

    function Harness() {
      const [s, setS] = useState(initial);
      const Game = mostLikely.Component;
      return (
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game
            state={s}
            players={players}
            me={me}
            isHost
            online={false}
            dispatch={(a: GameActionInput) => setS((cur) => tun(cur, a, players))}
            quit={() => {}}
          />
        </PartyCtx.Provider>
      );
    }
    render(<Harness />);

    for (let runde_ = 1; runde_ <= goal!; runde_++) {
      // Auf drei zeigen: Paul bekommt zwei Finger, Gast 1 einen.
      fireEvent.click(screen.getByRole('button', { name: `Mehr Finger bei ${players[0].name}` }));
      fireEvent.click(screen.getByRole('button', { name: `Mehr Finger bei ${players[0].name}` }));
      fireEvent.click(screen.getByRole('button', { name: `Mehr Finger bei ${players[1].name}` }));
      expect(screen.getByText('Insgesamt eingetragen: 3 von 4')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Aufdecken' }));

      const weiter = runde_ === goal ? 'Endstand' : 'Nächste Frage';
      fireEvent.click(screen.getByRole('button', { name: weiter }));
    }

    expect(screen.getByText('Noch eine Runde')).toBeTruthy();
  });

  it('der Weniger-Knopf faellt nicht unter null', () => {
    const players = runde(3);
    const initial = mostLikely.createState(players);
    function Harness() {
      const [s, setS] = useState(initial);
      const Game = mostLikely.Component;
      return (
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game
            state={s}
            players={players}
            me={me}
            isHost
            online={false}
            dispatch={(a: GameActionInput) => setS((cur) => tun(cur, a, players))}
            quit={() => {}}
          />
        </PartyCtx.Provider>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: `Weniger Finger bei ${players[0].name}` }));
    expect(screen.getByText('Insgesamt eingetragen: 0 von 3')).toBeTruthy();
  });
});
