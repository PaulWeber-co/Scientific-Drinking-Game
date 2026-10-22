import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { decodeState, encodeState, PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import { useCustomCards } from '../../store/cards';
import type { GameAction, GamePlayer } from '../types';
import { CATEGORIES } from './categories';
import {
  activeRing,
  categoryText,
  createState,
  DEAL_SIPS,
  LAST_SIPS,
  reduce,
  targetOf,
  UNDO_MS,
  type State,
} from './game';
import { werBinIch } from './index';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn(), setHapticsEnabled: vi.fn() }));

/** Zählt, wie oft eine Trinkansage NEU entsteht – eine neue verliert „Eingetragen". */
const mounts = vi.hoisted(() => ({ n: 0 }));
vi.mock('../shared/DrinkCall', async () => {
  const { useEffect } = await import('react');
  return {
    DrinkCall: ({ player, baseSips }: { player: { id: string }; baseSips: number }) => {
      useEffect(() => {
        mounts.n++;
      }, []);
      return <div data-testid="drinkcall">{`${player.id}:${baseSips}`}</div>;
    },
  };
});

const players = (n: number): GamePlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Spieler ${i}`,
    color: 'indigo',
    online: true,
  }));

const T0 = 1_000_000;
const act = (type: string, by = 'p0', extra: Record<string, unknown> = {}): GameAction => ({
  type,
  by,
  at: T0,
  ...extra,
});

/** Alle nehmen die Kategorie an – danach ist der Kreis gelost. */
function accepted(roster: GamePlayer[]): State {
  let s = createState(roster);
  for (const p of roster) s = reduce(s, act('accept', p.id), roster);
  return s;
}

/** Alle schreiben; der Begriff sagt, für wen er ist. */
function written(roster: GamePlayer[]): State {
  let s = accepted(roster);
  for (const p of roster) s = reduce(s, act('write', p.id, { text: `Begriff ${p.id}` }), roster);
  return s;
}

/** Wessen Ziel `target` ist – rückwärts im Kreis. */
const writerOf = (s: State, roster: GamePlayer[], target: string) =>
  roster.find((p) => targetOf(s, roster, p.id) === target)!.id;

afterEach(() => {
  useApp.setState({ spicy: {} });
  useCustomCards.setState({ byGame: {} });
});

describe('Wer bin ich: Kreis', () => {
  it('lost für 2 bis 10 Personen einen einzigen Kreis ohne Selbstzuteilung', () => {
    for (let n = 2; n <= 10; n++) {
      const roster = players(n);
      // Die Losung ist Zufall – oft genug ziehen, dass ein Fehler auffällt.
      for (let k = 0; k < 40; k++) {
        const s = accepted(roster);
        expect(s.phase, `${n} Personen`).toBe('write');
        expect([...s.ring].sort()).toEqual(roster.map((p) => p.id).sort());
        const targets = roster.map((p) => targetOf(s, roster, p.id));
        expect(targets.every((t, i) => t !== null && t !== roster[i].id), `${n}: niemand für sich`).toBe(true);
        expect(new Set(targets).size, `${n}: jede Person genau einmal`).toBe(n);
        // EIN Kreis: vom Ersten aus erreicht man alle, bevor man zurückkommt.
        const seen = new Set<string>();
        let at = roster[0].id;
        while (!seen.has(at)) {
          seen.add(at);
          at = targetOf(s, roster, at)!;
        }
        expect(seen.size, `${n}: ein Kreis, keine Teilkreise`).toBe(n);
      }
    }
  });
});

describe('Wer bin ich: Kategorie', () => {
  it('nimmt bei 3 zu 2 an', () => {
    const roster = players(5);
    let s = createState(roster);
    for (const id of ['p0', 'p1', 'p2']) s = reduce(s, act('accept', id), roster);
    for (const id of ['p3', 'p4']) s = reduce(s, act('reject', id), roster);
    expect(s.phase).toBe('write');
    expect(s.lastVote).toEqual({ ja: 3, neu: 2 });
  });

  it('lost bei Gleichstand neu', () => {
    const roster = players(4);
    let s = createState(roster);
    const vorher = s.cat;
    for (const id of ['p0', 'p1']) s = reduce(s, act('accept', id), roster);
    for (const id of ['p2', 'p3']) s = reduce(s, act('reject', id), roster);
    expect(s.phase).toBe('vote');
    expect(s.cat).not.toBe(vorher);
    expect(s.votes).toEqual({});
    expect(s.lastVote).toEqual({ ja: 2, neu: 2 });
  });

  it('lost bei 2 zu 3 neu', () => {
    const roster = players(5);
    let s = createState(roster);
    const vorher = s.cat;
    for (const id of ['p0', 'p1']) s = reduce(s, act('accept', id), roster);
    for (const id of ['p2', 'p3', 'p4']) s = reduce(s, act('reject', id), roster);
    expect(s.phase).toBe('vote');
    expect(s.cat).not.toBe(vorher);
  });

  it('wartet, bis alle abgestimmt haben – der Host kann vorziehen', () => {
    const roster = players(3).map((p, i) => ({ ...p, isHost: i === 0 }));
    let s = createState(roster);
    s = reduce(s, act('accept', 'p0'), roster);
    s = reduce(s, act('accept', 'p1'), roster);
    expect(s.phase).toBe('vote');
    expect(reduce(s, act('skip', 'p1'), roster), 'nur der Host zieht vor').toBe(s);
    expect(reduce(s, act('skip', 'p0'), roster).phase).toBe('write');
  });

  it('nimmt Spicy-Kategorien nur mit Schalter in den Stapel', () => {
    const roster = players(3);
    const spicy = (s: State) => [s.cat, ...s.catDeck].filter((i) => i >= 0 && CATEGORIES[i].spicy);
    for (let k = 0; k < 10; k++) expect(spicy(createState(roster))).toEqual([]);
    useApp.setState({ spicy: { 'wer-bin-ich': true } });
    expect(spicy(createState(roster)).length).toBe(CATEGORIES.filter((c) => c.spicy).length);
  });

  it('mischt eigene Kategorien ein', () => {
    useCustomCards.setState({
      byGame: { 'wer-bin-ich': [{ id: 'c1', text: 'Leute aus unserer WG', heat: 1 }] },
    });
    const s = createState(players(3));
    expect(s.customCats).toEqual(['Leute aus unserer WG']);
    expect([s.cat, ...s.catDeck]).toContain(-1);
    expect(categoryText({ cat: -1, customCats: s.customCats })).toBe('Leute aus unserer WG');
  });
});

describe('Wer bin ich: Schreiben', () => {
  it('rät erst, wenn alle geschrieben haben', () => {
    const roster = players(3);
    let s = accepted(roster);
    s = reduce(s, act('write', 'p0', { text: 'Ned Flanders' }), roster);
    s = reduce(s, act('write', 'p1', { text: 'Magnum' }), roster);
    expect(s.phase).toBe('write');
    s = reduce(s, act('write', 'p2', { text: 'Poirot' }), roster);
    expect(s.phase).toBe('guess');
    expect(s.terms[targetOf(s, roster, 'p0')!]).toEqual({ text: 'Ned Flanders', by: 'p0' });
  });

  it('lässt den eigenen Begriff zurücknehmen, aber keinen fremden überschreiben', () => {
    const roster = players(3);
    let s = accepted(roster);
    s = reduce(s, act('write', 'p0', { text: '  Ned   Flanders ' }), roster);
    const ziel = targetOf(s, roster, 'p0')!;
    expect(s.terms[ziel].text).toBe('Ned Flanders');
    s = reduce(s, act('unwrite', 'p0'), roster);
    expect(s.terms[ziel]).toBeUndefined();
    expect(reduce(s, act('write', 'p0', { text: '   ' }), roster), 'leer zählt nicht').toBe(s);
  });

  it('schließt den Kreis, wenn jemand vor dem Raten geht', () => {
    const roster = players(4);
    let s = accepted(roster);
    const weg = targetOf(s, roster, 'p0')!;
    const hinter = targetOf(s, roster, weg)!;
    s = reduce(s, act('write', 'p0', { text: 'für den, der geht' }), roster);
    const ohne = roster.map((p) => (p.id === weg ? { ...p, online: false } : p));
    // p0 schreibt jetzt für die Person, die der Gegangene bekommen hätte.
    expect(targetOf(s, ohne, 'p0')).toBe(hinter);
    s = reduce(s, act('write', 'p0', { text: 'Neu für dich' }), ohne);
    expect(s.terms[hinter]).toEqual({ text: 'Neu für dich', by: 'p0' });
    for (const p of ohne) {
      if (p.online === false || p.id === 'p0') continue;
      s = reduce(s, act('write', p.id, { text: `von ${p.id}` }), ohne);
    }
    expect(s.phase).toBe('guess');
    expect(activeRing(s, ohne)).not.toContain(weg);
  });

  it('behält den Begriff, den der Gegangene schon geschrieben hat', () => {
    const roster = players(4);
    let s = accepted(roster);
    const weg = targetOf(s, roster, 'p0')!;
    const hinter = targetOf(s, roster, weg)!;
    s = reduce(s, act('write', weg, { text: 'vom Gegangenen' }), roster);
    const ohne = roster.map((p) => (p.id === weg ? { ...p, online: false } : p));
    expect(reduce(s, act('write', 'p0', { text: 'drüber' }), ohne), 'kein Überschreiben').toBe(s);
    expect(s.terms[hinter].text).toBe('vom Gegangenen');
  });
});

describe('Wer bin ich: Raten', () => {
  it('hält fest, WESSEN Begriff erraten ist – nicht, wer getippt hat', () => {
    const roster = players(3);
    let s = written(roster);
    s = reduce(s, act('mark', 'p0', { target: 'p1' }), roster);
    expect(s.marks.map((m) => m.id)).toEqual(['p1']);
    // Auch für sich selbst.
    s = reduce(s, act('mark', 'p2', { target: 'p2' }), roster);
    expect(s.marks.map((m) => m.id)).toEqual(['p1', 'p2']);
  });

  it('nimmt ein „Richtig" innerhalb der Frist zurück, danach nicht mehr', () => {
    const roster = players(3);
    let s = written(roster);
    s = reduce(s, act('mark', 'p0', { target: 'p1' }), roster);
    expect(reduce(s, act('undo', 'p2', { target: 'p1' }), roster).marks).toEqual([]);
    const spaet = { ...act('undo', 'p2', { target: 'p1' }), at: T0 + UNDO_MS };
    expect(reduce(s, spaet, roster), 'nach der Frist gilt es').toBe(s);
  });

  it('lässt die letzte Person übrig und beendet erst nach der Frist', () => {
    const roster = players(4);
    let s = written(roster);
    for (const id of ['p2', 'p0', 'p3']) s = reduce(s, act('mark', 'p1', { target: id }), roster);
    expect(reduce(s, act('mark', 'p0', { target: 'p1' }), roster), 'die Letzte bleibt').toBe(s);
    expect(reduce(s, act('settle'), roster), 'Rückgängig ist noch möglich').toBe(s);
    s = reduce(s, { ...act('settle'), at: T0 + UNDO_MS }, roster);
    expect(s.phase).toBe('done');
    expect(s.last).toBe('p1');
    expect(s.losses).toEqual({ p1: 1 });
  });

  it('lässt niemanden ohne Begriff ins Raten zurück', () => {
    // Weg (Handy gesperrt), bevor jemand für ihn schreibt; die anderen werden
    // fertig, er kommt im Raten zurück. Vorher stand er ohne Begriff im Kreis.
    const roster = players(4);
    let s = accepted(roster);
    const weg = targetOf(s, roster, 'p0')!;
    const ohne = roster.map((p) => (p.id === weg ? { ...p, online: false } : p));
    for (const p of ohne) {
      if (p.online === false) continue;
      s = reduce(s, act('write', p.id, { text: `von ${p.id}` }), ohne);
    }
    expect(s.phase).toBe('guess');
    expect(s.terms[weg]).toBeUndefined();
    expect(activeRing(s, roster), 'zurück, aber diese Runde Zuschauer').not.toContain(weg);
    expect(reduce(s, act('mark', 'p0', { target: weg }), roster)).toBe(s);
  });

  it('zählt den Begriff einer gegangenen Person als erraten', () => {
    const roster = players(4);
    let s = written(roster);
    s = reduce(s, act('mark', 'p0', { target: 'p0' }), roster);
    s = reduce(s, act('mark', 'p0', { target: 'p1' }), roster);
    const ohne = roster.map((p) => (p.id === 'p2' ? { ...p, online: false } : p));
    s = reduce(s, { ...act('settle'), at: T0 + UNDO_MS }, ohne);
    expect(s.phase).toBe('done');
    expect(s.last).toBe('p3');
  });

  it('lässt nur die Erste verteilen, erst nach der Frist und genau die Menge', () => {
    const roster = players(4);
    let s = written(roster);
    s = reduce(s, act('mark', 'p1', { target: 'p2' }), roster);
    const deal = (by: string, counts: Record<string, number>, at = T0 + UNDO_MS) => ({
      ...act('deal', by, { counts }),
      at,
    });
    expect(reduce(s, deal('p2', { p0: 3 }, T0), roster), 'vor der Frist').toBe(s);
    expect(reduce(s, deal('p1', { p0: 3 }), roster), 'nur die Erste').toBe(s);
    expect(reduce(s, deal('p2', { p0: 2 }), roster), 'zu wenig').toBe(s);
    expect(reduce(s, deal('p2', { p0: 2, p1: 2 }), roster), 'zu viel').toBe(s);
    expect(reduce(s, deal('p2', { p2: 1, p0: 2 }), roster), 'nicht an sich selbst').toBe(s);
    s = reduce(s, deal('p2', { p0: 2, p3: 1 }), roster);
    expect(s.dealt).toEqual({ p0: 2, p3: 1 });
    expect(reduce(s, deal('p2', { p1: 3 }), roster), 'nur einmal').toBe(s);
  });

});

describe('Wer bin ich: Phasen', () => {
  it('weist jede Aktion außerhalb ihrer Phase ab', () => {
    const roster = players(3).map((p, i) => ({ ...p, isHost: i === 0 }));
    const vote = createState(roster);
    const write = accepted(roster);
    const guess = written(roster);
    const versuche: [string, State, GameAction][] = [
      ['accept beim Schreiben', write, act('accept', 'p1')],
      ['reject beim Raten', guess, act('reject', 'p1')],
      // Mit übrig gebliebener Stimme bzw. Treffer: sonst sperrt schon das
      // fehlende Material, und die Phasenprüfung selbst bliebe ungetestet.
      ['skip beim Schreiben', { ...write, votes: { p1: 'ja' } }, act('skip', 'p0')],
      ['write beim Abstimmen', vote, act('write', 'p1', { text: 'x' })],
      ['write beim Raten', guess, act('write', 'p1', { text: 'x' })],
      ['unwrite beim Raten', guess, act('unwrite', 'p0')],
      ['mark beim Schreiben', write, act('mark', 'p1', { target: 'p2' })],
      ['undo beim Abstimmen', { ...vote, marks: [{ id: 'p2', at: T0 }] }, act('undo', 'p1', { target: 'p2' })],
      [
        'deal beim Schreiben',
        { ...write, marks: [{ id: 'p1', at: T0 - UNDO_MS }] },
        act('deal', 'p1', { counts: { p0: 3 } }),
      ],
      ['next beim Raten', guess, act('next', 'p0')],
      ['settle beim Abstimmen ohne Stimmen', vote, act('settle')],
      ['restart beim Raten', guess, act('restart', 'p0')],
    ];
    for (const [name, s, a] of versuche) expect(reduce(s, a, roster), name).toBe(s);
  });

  it('lässt nur den Host zur nächsten Runde und endet nach der Rundenzahl', () => {
    const roster = players(2).map((p, i) => ({ ...p, isHost: i === 0 }));
    let s = written(roster);
    s = reduce(s, act('mark', 'p1', { target: 'p0' }), roster);
    s = reduce(s, { ...act('settle'), at: T0 + UNDO_MS }, roster);
    expect(s.phase).toBe('done');
    expect(reduce(s, act('next', 'p1'), roster), 'Gast schaltet nicht weiter').toBe(s);
    const weiter = reduce(s, act('next', 'p0'), roster);
    expect(weiter.phase).toBe('vote');
    expect(weiter.round).toBe(2);
    expect(weiter.marks).toEqual([]);
    expect(weiter.losses).toEqual({ p1: 1 });
    const letzte = reduce({ ...s, goal: 1 }, act('next', 'p0'), roster);
    expect(letzte.phase).toBe('over');
  });

  it('übersteht die Firebase-Runde mitten im Spiel', () => {
    const roster = players(4);
    let s = written(roster);
    s = reduce(s, act('mark', 'p0', { target: 'p1' }), roster);
    expect(decodeState(encodeState(s))).toEqual(s);
  });
});

describe('Wer bin ich: Ansicht', () => {
  function zeigen(state: State, roster: GamePlayer[], me = roster[0]) {
    const Game = werBinIch.Component;
    return render(
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players: roster } as unknown as PartyValue}>
          <Game state={state} players={roster} me={me} isHost online dispatch={() => {}} quit={() => {}} />
        </PartyCtx.Provider>
      </MemoryRouter>,
    );
  }

  it('zeigt die Begriffe der anderen, den eigenen nicht', () => {
    const roster = players(3);
    const s = written(roster);
    const { container } = zeigen(s, roster);
    const text = container.ownerDocument.body.textContent ?? '';
    expect(text).toContain('Begriff ' + writerOf(s, roster, 'p1'));
    expect(text).toContain('Begriff ' + writerOf(s, roster, 'p2'));
    expect(text, 'eigener Begriff steht nirgends im DOM').not.toContain(
      'Begriff ' + writerOf(s, roster, 'p0'),
    );
  });

  it('behält die Trinkansage beim Wechsel ins Ende, die Letzte bekommt LAST_SIPS', () => {
    const roster = players(3);
    const nach = T0 + UNDO_MS;
    let s = written(roster);
    s = reduce(s, act('mark', 'p1', { target: 'p2' }), roster);
    s = reduce(s, { ...act('deal', 'p2', { counts: { p0: DEAL_SIPS } }), at: nach }, roster);
    s = reduce(s, act('mark', 'p0', { target: 'p1' }), roster);
    const done = reduce(s, { ...act('settle'), at: nach }, roster);
    expect(done.last).toBe('p0');

    mounts.n = 0;
    const Game = werBinIch.Component;
    const me = roster[0];
    const zeige = (state: State) => (
      <MemoryRouter>
        <PartyCtx.Provider value={{ me, players: roster } as unknown as PartyValue}>
          <Game state={state} players={roster} me={me} isHost online dispatch={() => {}} quit={() => {}} />
        </PartyCtx.Provider>
      </MemoryRouter>
    );
    const view = render(zeige(s));
    expect(screen.getAllByTestId('drinkcall').map((e) => e.textContent)).toEqual([`p0:${DEAL_SIPS}`]);
    view.rerender(zeige(done));
    expect(screen.getAllByTestId('drinkcall').map((e) => e.textContent).sort()).toEqual(
      [`p0:${DEAL_SIPS}`, `p0:${LAST_SIPS}`].sort(),
    );
    // Verteilt-Ansage bleibt dieselbe, nur die der Letzten kommt neu dazu.
    expect(mounts.n).toBe(2);
    expect(LAST_SIPS).toBe(5);
    expect(DEAL_SIPS).toBe(3);
  });

  it('deckt den eigenen Begriff auf, sobald er erraten ist', () => {
    const roster = players(3);
    let s = written(roster);
    s = reduce(s, act('mark', 'p1', { target: 'p0' }), roster);
    const { container } = zeigen(s, roster);
    expect(container.ownerDocument.body.textContent).toContain('Begriff ' + writerOf(s, roster, 'p0'));
  });
});
