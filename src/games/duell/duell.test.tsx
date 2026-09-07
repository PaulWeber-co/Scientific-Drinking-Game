import { beforeEach, describe, expect, it } from 'vitest';
import { duell, pairFor } from './index';
import { useApp } from '../../store/app';
import type { GameAction, GamePlayer } from '../types';

const spielerIds = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i}`);

const players = (n: number): GamePlayer[] =>
  spielerIds(n).map((id, i) => ({ id, name: `Spieler ${i}`, color: 'indigo', online: true }));

const act = (type: string, extra: Record<string, unknown> = {}): GameAction => ({
  type,
  by: 'p0',
  at: Date.now(),
  ...extra,
});

describe('Reaktions-Duell: Paarung (Rundlauf-Verfahren statt fortlaufender Nachbarn)', () => {
  it('lässt bei 8 Spielern über 6 Runden niemanden aus', () => {
    // Vorher: (0,1)-(1,2)-…-(5,6) – Person 7 kam nie dran. Generiert aus der
    // Spielerliste, nicht von Hand aufgezählt.
    const order = spielerIds(8);
    const angetreten = new Set<string>();
    for (let runde = 0; runde < 6; runde++) {
      const [a, b] = pairFor(order, runde);
      angetreten.add(a);
      angetreten.add(b);
    }
    const fehlend = order.filter((id) => !angetreten.has(id));
    expect(fehlend).toEqual([]);
  });

  it('wiederholt kein Paar, bevor der Rundlauf einmal komplett war', () => {
    const order = spielerIds(8);
    const gesamtzahlPaare = (order.length * (order.length - 1)) / 2;
    const gesehen = new Set<string>();
    for (let runde = 0; runde < gesamtzahlPaare; runde++) {
      const [a, b] = pairFor(order, runde);
      expect(a).not.toBe(b);
      const key = [a, b].sort().join('::');
      expect(gesehen.has(key)).toBe(false);
      gesehen.add(key);
    }
  });

  it('deckt auch bei ungerader Spielerzahl (Freilos) jede Person ab', () => {
    const order = spielerIds(7);
    const angetreten = new Set<string>();
    for (let runde = 0; runde < order.length; runde++) {
      const [a, b] = pairFor(order, runde);
      angetreten.add(a);
      angetreten.add(b);
    }
    const fehlend = order.filter((id) => !angetreten.has(id));
    expect(fehlend).toEqual([]);
  });
});

describe('Reaktions-Duell: eine ganze Partie', () => {
  beforeEach(() => {
    useApp.setState({ gameLength: 'mittel' });
  });

  it('spielt bei 8 Spielern 6 Runden durch, ohne dass jemand ausfällt', () => {
    const spieler = players(8);
    let state = duell.createState(spieler);
    expect(state.goal).toBe(6);

    const angetreten = new Set<string>();
    let runden = 0;
    while (state.phase !== 'over') {
      state = duell.reduce(state, act('arm'), spieler);
      state = duell.reduce(state, act('go'), spieler);
      state = duell.reduce(state, act('tap', { side: 0 }), spieler);
      if (state.winner) angetreten.add(state.winner);
      if (state.loser) angetreten.add(state.loser);
      state = duell.reduce(state, act('next'), spieler);
      runden += 1;
      expect(runden).toBeLessThan(20); // Notbremse gegen eine Endlosschleife
    }

    expect(runden).toBe(6);
    const fehlend = spieler.filter((p) => !angetreten.has(p.id));
    expect(fehlend).toEqual([]);
  });
});
