import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { zweiWahrheiten } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

import { meta } from './meta';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { usePlayer, defaultProfile } from '../../store/player';
import { useApp } from '../../store/app';
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

type State = ReturnType<typeof zweiWahrheiten.createState>;
const tun = (s: State, a: GameActionInput, players: GamePlayer[]) =>
  zweiWahrheiten.reduce(s, { ...a, by: a.by ?? me.id, at: Date.now() } as GameAction, players);

/** Schreiben und die Lüge festlegen – der Weg bis zum Verhör. */
function bisVerhoer(
  players: GamePlayer[],
  statements = ['Wahr 1', 'Wahr 2', 'Erfunden'],
  lie = 0,
): State {
  const s = tun(zweiWahrheiten.createState(players), { type: 'submit', statements }, players);
  return tun(s, { type: 'markLie', index: lie }, players);
}

/** Von `write` bis zur Abstimmung: schreiben, festlegen, alle Rückfragen durch. */
function bisGuess(
  players: GamePlayer[],
  statements = ['Wahr 1', 'Wahr 2', 'Erfunden'],
  lie = 0,
): State {
  let s = bisVerhoer(players, statements, lie);
  const authorId = s.order[s.authorIndex % Math.max(1, s.order.length)];
  const askers = s.order.filter((id) => id !== authorId);
  for (let i = 0; i < askers.length; i++) s = tun(s, { type: 'nextQuestion' }, players);
  return s;
}

beforeEach(() => {
  useApp.setState({ gameLength: 'endlos', spicy: {}, taskOnSkip: 'aus' });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
  });
});

describe('Zwei Wahrheiten ohne eigenes Gerät', () => {
  it('bietet sich ohne eigene Geräte an', () => {
    // Vorher hielt `requiresOwnDevice` das Spiel aus dem Pass-&-Play-Modus
    // heraus – dabei kennt nur der Autor die Lüge, und zwar im Kopf.
    expect(meta.requiresOwnDevice).toBe(false);
  });

  it('verlangt beim Schreiben keine Lüge – die verrät der Autor erst nach dem Raten', () => {
    const players = runde(4);
    const s = tun(zweiWahrheiten.createState(players), { type: 'submit', statements: ['A', 'B', 'C'] }, players);
    // Erst legt sich der Autor unter vier Augen fest, dann kommt das Verhoer.
    expect(s.phase).toBe('commit');
    expect(tun(s, { type: 'markLie', index: 1 }, players).phase).toBe('interrogate');
    expect(s.lie).toBeNull();
    expect(new Set(s.statements)).toEqual(new Set(['A', 'B', 'C']));
  });

  it('lehnt unvollständige Aussagen ab', () => {
    const players = runde(3);
    const start = zweiWahrheiten.createState(players);
    const s = tun(start, { type: 'submit', statements: ['A', '', 'C'] }, players);
    expect(s, 'unveraendert bei ungueltiger Eingabe').toBe(start);
  });

  it('durchläuft eine Rückfrage je Mitspieler, bevor die Abstimmung beginnt', () => {
    const players = runde(4);
    let s = bisVerhoer(players, ['A', 'B', 'C']);
    const askerCount = players.length - 1;
    for (let i = 0; i < askerCount - 1; i++) {
      s = tun(s, { type: 'nextQuestion' }, players);
      expect(s.phase, 'noch nicht alle haben gefragt').toBe('interrogate');
    }
    s = tun(s, { type: 'nextQuestion' }, players);
    expect(s.phase).toBe('guess');
  });

  it('online: der Autor darf nicht mitraten', () => {
    const players = runde(4);
    const s = bisGuess(players);
    const authorId = s.order[s.authorIndex % Math.max(1, s.order.length)];
    const vorher = s.guesses;
    const nachher = tun(s, { type: 'guess', index: 0, by: authorId }, players);
    expect(nachher.guesses).toBe(vorher);
  });

  it('geteiltes Handy: trägt alle Tipps auf einmal ein', () => {
    const players = runde(4);
    let s = bisGuess(players);
    const authorId = s.order[s.authorIndex % Math.max(1, s.order.length)];
    const others = players.filter((p) => p.id !== authorId);
    const guesses = Object.fromEntries(others.map((p) => [p.id, 0]));
    s = tun(s, { type: 'guessAll', guesses }, players);
    expect(Object.keys(s.guesses)).toHaveLength(others.length);
    expect(s.phase, 'Aufloesen ist ein eigener Schritt, keine neue Phase').toBe('guess');
  });

  it('löst erst auf, wenn wirklich alle getippt haben (Phase-Schutz)', () => {
    // Gegenprobe: ohne diese Pruefung koennte der Autor nach den ersten
    // Tipps noch umentscheiden, welche Aussage die Luege war.
    const players = runde(4);
    let s = bisGuess(players);
    const authorId = s.order[s.authorIndex % Math.max(1, s.order.length)];
    const others = players.filter((p) => p.id !== authorId);
    s = tun(s, { type: 'guessAll', guesses: { [others[0].id]: 0 } }, players);
    const versuch = tun(s, { type: 'revealLie' }, players);
    expect(versuch, 'zu frueh aufgeloest').toBe(s);
  });

  it('lässt den Autor die Lüge nicht mehr an die Tipps anpassen', () => {
    // Der Kern der Fairness. Auf einem geteilten Handy traegt zwangslaeufig der
    // Autor die Tipps der anderen ein – er ist der Einzige, der beim
    // Fingerzeigen nichts zu zeigen hat. Duerfte er DANACH noch festlegen,
    // welche Aussage gelogen war, naehme er immer die, die am wenigsten Leute
    // getroffen haben, und wuerde nie trinken.
    const players = runde(4);
    let s = bisGuess(players, ['A', 'B', 'C'], 1);
    const authorId = s.order[s.authorIndex % Math.max(1, s.order.length)];
    const others = players.filter((p) => p.id !== authorId);
    s = tun(
      s,
      { type: 'guessAll', guesses: Object.fromEntries(others.map((p) => [p.id, 1])) },
      players,
    );
    // Der Versuch, beim Aufloesen eine andere Luege zu behaupten.
    s = tun(s, { type: 'revealLie', lie: 2 }, players);
    expect(s.lie, 'die Lüge wurde nachträglich verschoben').toBe(1);
    for (const p of others) expect(s.hits[p.id], `${p.name} bekam keinen Treffer`).toBe(1);
  });

  it('wertet nach dem Verraten korrekt aus, wer die Lüge erkannt hat', () => {
    const players = runde(4);
    let s = bisGuess(players, ['Wahr 1', 'Wahr 2', 'Erfunden'], 2);
    const authorId = s.order[s.authorIndex % Math.max(1, s.order.length)];
    const others = players.filter((p) => p.id !== authorId);
    // Die ersten beiden tippen auf die tatsächliche Lüge (Index 2), die
    // dritte Person tippt daneben.
    s = tun(
      s,
      {
        type: 'guessAll',
        guesses: { [others[0].id]: 2, [others[1].id]: 2, [others[2].id]: 0 },
      },
      players,
    );
    s = tun(s, { type: 'revealLie' }, players);
    expect(s.phase).toBe('result');
    expect(s.lie).toBe(2);
    expect(s.hits[others[0].id]).toBe(1);
    expect(s.hits[others[1].id]).toBe(1);
    expect(s.hits[others[2].id] ?? 0).toBe(0);
  });

  it('zählt Treffer über mehrere Runden zusammen und wechselt den Autor', () => {
    const players = runde(3);
    let s = bisGuess(players, ['A1', 'B1', 'C1']);
    const ersterAutor = s.order[s.authorIndex % Math.max(1, s.order.length)];
    let others = players.filter((p) => p.id !== ersterAutor);
    s = tun(s, { type: 'guessAll', guesses: Object.fromEntries(others.map((p) => [p.id, 0])) }, players);
    s = tun(s, { type: 'revealLie' }, players);
    expect(s.phase).toBe('result');

    s = tun(s, { type: 'next' }, players);
    expect(s.phase).toBe('write');
    const zweiterAutor = s.order[s.authorIndex % Math.max(1, s.order.length)];
    expect(zweiterAutor, 'die naechste Person ist dran').not.toBe(ersterAutor);

    s = tun(s, { type: 'submit', statements: ['A2', 'B2', 'C2'] }, players);
    s = tun(s, { type: 'markLie', index: 1 }, players);
    others = players.filter((p) => p.id !== zweiterAutor);
    for (let i = 0; i < others.length; i++) s = tun(s, { type: 'nextQuestion' }, players);
    s = tun(s, { type: 'guessAll', guesses: Object.fromEntries(others.map((p) => [p.id, 1])) }, players);
    s = tun(s, { type: 'revealLie' }, players);
    for (const p of others) {
      expect(s.hits[p.id], `${p.id} sollte ueber beide Runden Treffer sammeln`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Zwei Wahrheiten: Ablauf an einem geteilten Handy', () => {
  it('läuft von den Aussagen über das Verhör bis zum Endstand durch', () => {
    // "kurz" statt "endlos", damit die Partie tatsaechlich im Endstand endet
    // (Completion-Kriterium der Stage: bis zum Ende durchlaufen).
    useApp.setState({ gameLength: 'kurz', spicy: {}, taskOnSkip: 'aus' });
    const players = runde(4);
    const initial = zweiWahrheiten.createState(players);
    const goal = initial.goal;
    expect(goal, 'Rundenziel muss fuer diesen Test gesetzt sein').toBeGreaterThan(0);
    const askerCount = players.length - 1;

    function Harness() {
      const [s, setS] = useState(initial);
      const Game = zweiWahrheiten.Component;
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
      // Schreiben: das Formular ist auf dem geteilten Handy immer da – egal,
      // wer laut Rotation gerade Autor ist.
      fireEvent.change(screen.getByPlaceholderText('Aussage 1'), {
        target: { value: `Wahr A Runde ${runde_}` },
      });
      fireEvent.change(screen.getByPlaceholderText('Aussage 2'), {
        target: { value: `Wahr B Runde ${runde_}` },
      });
      fireEvent.change(screen.getByPlaceholderText('Aussage 3'), {
        target: { value: `Erfunden Runde ${runde_}` },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Abschicken' }));

      // Unter vier Augen: das Handy geht zum Autor, der sich festlegt. Das
      // muss VOR dem Raten passieren – sonst koennte er die Aussage benennen,
      // die am wenigsten Leute getroffen haben, und nie verlieren.
      fireEvent.click(screen.getByRole('button', { name: /^Ich bin / }));
      const auswahl = screen.getAllByRole('button', { name: /^Wahr|^Erfunden/ });
      expect(auswahl.length, 'keine Auswahl der Lüge').toBeGreaterThan(0);
      fireEvent.click(auswahl[0]);

      // Verhör: eine Rückfrage je Mitspieler außer dem Autor.
      for (let i = 0; i < askerCount; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Gefragt – weiter' }));
      }

      // Raten: die Runde zeigt gleichzeitig Finger, das Handy sammelt sie ein.
      const ersteWahl = screen.getAllByRole('button', { name: /tippt auf Aussage 1$/ });
      expect(ersteWahl).toHaveLength(askerCount);
      for (const btn of ersteWahl) fireEvent.click(btn);
      fireEvent.click(screen.getByRole('button', { name: 'Eingetragen' }));

      // Auflösen: der Autor verrät die Lüge.
      fireEvent.click(screen.getByRole('button', { name: `Erfunden Runde ${runde_}` }));
      expect(screen.getByText(/Aufgelöst/)).toBeTruthy();

      const weiter = runde_ === goal ? 'Endstand' : 'Nächste Person';
      fireEvent.click(screen.getByRole('button', { name: weiter }));
    }

    expect(screen.getByText('Noch eine Runde')).toBeTruthy();
  });
});
