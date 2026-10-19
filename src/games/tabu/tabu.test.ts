import { describe, expect, it } from 'vitest';
import { tabu } from './index';
import type { GamePlayer } from '../types';

const players: GamePlayer[] = Array.from({ length: 4 }, (_, i) => ({
  id: `p${i}`,
  name: `Spieler ${i}`,
  color: 'blue',
  online: true,
}));

function playing() {
  return {
    ...tabu.createState(players),
    phase: 'playing' as const,
    wordIndex: 0,
    endsAt: 60_000,
    hits: 3,
    fouls: 1,
    score: { A: 2, B: 4 },
  };
}

describe('Tabu Rush: Ablauf der 60 Sekunden', () => {
  it('zählt einen Treffer unmittelbar vor der Frist', () => {
    const result = tabu.reduce(playing(), { type: 'hit', by: 'p0', at: 59_999 }, players);
    expect(result.phase).toBe('playing');
    expect(result.hits).toBe(4);
    expect(result.score.A).toBe(2);
  });

  it.each(['hit', 'skip', 'foul'])(
    'beendet bei %s nach Ablauf ohne zusätzliche Wertung',
    (type) => {
      const state = playing();
      const result = tabu.reduce(state, { type, by: 'p0', at: 60_000 }, players);
      expect(result.phase).toBe('result');
      expect(result.hits).toBe(3);
      expect(result.fouls).toBe(1);
      expect(result.wordIndex).toBe(state.wordIndex);
      expect(result.deck).toBe(state.deck);
      expect(result.score).toEqual({ A: 5, B: 4 });
      expect(tabu.reduce(result, { type: 'timeUp', by: 'p0', at: 60_250 }, players)).toBe(result);
    },
  );
});
