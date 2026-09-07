import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { topTen } from './index';

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

type State = ReturnType<typeof topTen.createState>;
const tun = (s: State, a: GameActionInput, players: GamePlayer[]) =>
  topTen.reduce(s, { ...a, by: a.by ?? me.id, at: Date.now() } as GameAction, players);

beforeEach(() => {
  useApp.setState({ gameLength: 'endlos', spicy: {}, taskOnSkip: 'aus' });
  useSeen.setState({ seen: {}, cursor: 0 });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
  });
  // jsdom kennt weder Layout noch Pointer-Capture – beides stellt die
  // Aufdeck-Karte (PeekCard), sonst loest der Tipp-zum-Aufdecken-Pfad nie aus.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 200,
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
});

/** Tippt die Aufdeck-Karte auf, ohne zu ziehen – die Bedienung ohne Wischen. */
function tippeKarteAuf() {
  const deckel = document.querySelector('.peekcard__lid') as HTMLElement;
  fireEvent.pointerDown(deckel, { pointerId: 1, clientY: 300 });
  fireEvent.pointerUp(deckel, { pointerId: 1 });
}

describe('Top Ten auf einem geteilten Handy', () => {
  it('bietet sich ohne eigene Geräte an', () => {
    expect(meta.requiresOwnDevice).toBe(false);
  });

  it('läuft an einem Gerät von der Zahlen-Übergabe bis in die nächste Runde durch', () => {
    const players = runde(3);
    function Harness() {
      const [state, setState] = useState<State>(() => topTen.createState(players));
      const Game = topTen.Component;
      return (
        <PartyCtx.Provider value={{ me, players } as unknown as PartyValue}>
          <Game
            state={state}
            players={players}
            me={me}
            isHost
            online={false}
            dispatch={(a: GameActionInput) => setState((s) => tun(s, a, players))}
            quit={() => {}}
          />
        </PartyCtx.Provider>
      );
    }
    render(<Harness />);

    // Übergabe: jede Person sieht ihre Zahl per Aufdeck-Karte, sagt sie laut
    // (im Test: notiert), dann weiter ans nächste Handy.
    const gesehen: { name: string; zahl: number }[] = [];
    for (const p of players) {
      fireEvent.click(screen.getByRole('button', { name: `Ich bin ${p.name}` }));
      tippeKarteAuf();
      const zahl = Number(document.querySelector('.secret__num')!.textContent);
      gesehen.push({ name: p.name, zahl });
      fireEvent.click(screen.getByRole('button', { name: 'Habe ich gesehen' }));
    }

    // Aufdecken: der Kapitän tippt in der richtigen Reihenfolge – keine Fehler.
    const richtig = [...gesehen].sort((a, b) => a.zahl - b.zahl);
    for (const p of richtig) {
      fireEvent.click(screen.getByRole('button', { name: p.name }));
    }

    // Auflösung, dann weiter in Runde 2 – die Übergabe beginnt von vorn.
    expect(screen.getByText('Perfekt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nächste Runde' }));
    expect(screen.getByRole('button', { name: /^Ich bin / })).toBeTruthy();
  });

  it('online: sammelt getippte Antworten, bevor das Aufdecken beginnt', () => {
    // Die Online-Fassung tippt weiter, statt laut zu sagen – das darf der
    // Umbau auf das geteilte Handy nicht anfassen.
    const players = runde(4);
    let s = topTen.createState(players);
    for (const p of players) {
      s = tun(s, { type: 'submit', text: `Antwort von ${p.name}`, by: p.id }, players);
    }
    expect(s.phase).toBe('revealing');
    expect(Object.keys(s.answers)).toHaveLength(4);
  });

  it('kostet beim Aufdecken ein Plättchen, wenn eine Zahl kleiner ist als die vorherige', () => {
    const players = runde(4);
    let s = topTen.createState(players);
    const startTokens = s.tokens;
    s = tun(s, { type: 'startReveal' }, players);
    const byNumber = [...s.order].sort((a, b) => s.numbers[a] - s.numbers[b]);
    const [kleinste, zweitkleinste] = byNumber;
    s = tun(s, { type: 'reveal', id: zweitkleinste }, players);
    expect(s.tokens, 'die erste aufgedeckte Zahl kann keinen Fehler auslösen').toBe(startTokens);
    s = tun(s, { type: 'reveal', id: kleinste }, players);
    expect(s.tokens, 'eine kleinere Zahl nach einer größeren muss ein Plättchen kosten').toBe(
      startTokens - 1,
    );
  });

  it('beendet die Partie sofort, wenn der Plättchenvorrat leer ist', () => {
    const players = runde(3);
    let s = topTen.createState(players);
    expect(s.tokens).toBe(3);
    // Volle Absteige-Reihenfolge je Runde: garantiert bei drei Spielern zwei
    // Fehler, unabhängig davon, wie die Zahlen ausgeteilt wurden.
    for (let runden = 0; runden < 10 && s.phase !== 'over'; runden++) {
      s = tun(s, { type: 'startReveal' }, players);
      const absteigend = [...s.order].sort((a, b) => s.numbers[b] - s.numbers[a]);
      for (const id of absteigend) {
        if (s.phase !== 'revealing') break;
        s = tun(s, { type: 'reveal', id }, players);
      }
      if (s.phase === 'results') s = tun(s, { type: 'next' }, players);
    }
    expect(s.phase).toBe('over');
    expect(s.tokens).toBe(0);
    expect(s.lostGame).toBe(true);
  });
});
