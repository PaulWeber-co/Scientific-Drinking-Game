import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { useApp } from '../../store/app';
import type { GameAction, GameActionInput, GamePlayer } from '../types';
import { stichmagie } from './index';
import { actorsOf, hexeTakeable, type State } from './game';
import { cardName, choiceFor, legalCards } from './rules';

/**
 * Stichmagie über die Oberfläche: jeder Zug wird dort getippt, wo ihn eine
 * Person auch tippen würde – auf ihrem eigenen Gerät. Der Test wechselt
 * dafür das Gerät (`me`) zur Person, die dran ist. Der Reducer läuft wie
 * online beim Host; der Zustand geht zwischendurch durch JSON.
 */

const NAMES = ['Anna', 'Ben', 'Cleo', 'Dana', 'Emil'];
const spieler = (n: number): GamePlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: NAMES[i],
    color: 'blue' as const,
    online: true,
    isHost: i === 0,
  }));

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ctl {
  state: State;
  me: string;
  setMe: (id: string) => void;
}

function mount(players: GamePlayer[], online = true) {
  const ctl = {} as Ctl;
  function Harness() {
    const [state, setState] = useState(() => stichmagie.createState(players));
    const [meId, setMe] = useState('p0');
    ctl.state = state;
    ctl.me = meId;
    ctl.setMe = setMe;
    const me = players.find((p) => p.id === meId)!;
    const dispatch = (a: GameActionInput) =>
      setState((s) => {
        const next = stichmagie.reduce(
          s,
          { ...a, by: meId, at: Date.now() } as GameAction,
          players,
        );
        // Wie über Firebase: der Zustand reist als JSON.
        return next === s ? s : JSON.parse(JSON.stringify(next));
      });
    const party = {
      me,
      players,
      mode: online ? 'online' : 'local',
      gameId: 'stichmagie',
      logSipsFor: () => {},
      undoLastFor: () => {},
    } as unknown as PartyValue;
    const C = stichmagie.Component;
    return (
      <MemoryRouter>
        <PartyCtx.Provider value={party}>
          <C
            state={state}
            players={players}
            me={me}
            isHost={meId === 'p0'}
            online={online}
            dispatch={dispatch}
            quit={() => {}}
          />
        </PartyCtx.Provider>
      </MemoryRouter>
    );
  }
  render(<Harness />);
  return ctl;
}

const als = (ctl: Ctl, id: string) => act(() => ctl.setMe(id));
const tippe = (el: Element) => act(() => fireEvent.click(el));

/** Handkarte anhand ihres Namens – Magier und Narren gibt es mehrfach. */
function handCard(card: number): HTMLElement {
  const hand = document.querySelector('.sm-hand') as HTMLElement;
  return within(hand).getAllByRole('button', { name: cardName(card) })[0];
}

beforeEach(() => {
  vi.useFakeTimers();
  useApp.setState({ gameLength: 'mittel' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Ein Zug für die Person am Zug – immer über die Knöpfe. */
async function zug(ctl: Ctl, rng: () => number) {
  const s = ctl.state;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rng() * xs.length)];
  switch (s.phase) {
    case 'trump':
    case 'werwolf': {
      await als(ctl, s.turn);
      const knoepfe = document.querySelectorAll('.sm-suitbtn');
      expect(knoepfe.length).toBe(s.phase === 'werwolf' ? 5 : 4);
      await tippe(knoepfe[Math.floor(rng() * 4)]);
      return;
    }
    case 'bid': {
      await als(ctl, s.turn);
      const frei = [...document.querySelectorAll<HTMLButtonElement>('.sm-bid')].filter(
        (b) => !b.disabled,
      );
      await tippe(pick(frei.slice(0, 3)));
      return;
    }
    case 'play': {
      await als(ctl, s.turn);
      const legal = legalCards(s.hands[s.turn], s.trick, s.vampirAs);
      const card = pick(legal);
      await tippe(handCard(card));
      const choice = choiceFor(card, s.vampirAs);
      if (choice === 'suit') {
        await tippe(document.querySelectorAll('.sm-panel .sm-suitbtn')[Math.floor(rng() * 4)]);
      } else if (choice === 'shape') {
        await tippe(document.querySelectorAll('.sm-shape')[Math.floor(rng() * 2)]);
      } else {
        await tippe(screen.getByRole('button', { name: /ausspielen/ }));
      }
      return;
    }
    case 'trick':
      // Der Host sammelt den Stich nach einer Pause selbst ein.
      await als(ctl, 'p0');
      await act(() => vi.advanceTimersByTimeAsync(2500));
      return;
    case 'wolke': {
      await als(ctl, s.turn);
      await tippe(document.querySelectorAll('.sm-cloud .sm-bid')[Math.floor(rng() * 2)]);
      return;
    }
    case 'pass': {
      const who = actorsOf(s)[0];
      await als(ctl, who);
      await tippe(handCard(pick(s.hands[who])));
      await tippe(screen.getByRole('button', { name: / geben$/ }));
      return;
    }
    case 'hexe': {
      await als(ctl, s.turn);
      await tippe(screen.getByRole('button', { name: `${cardName(hexeTakeable(s)[0])} nehmen` }));
      await tippe(handCard(s.hands[s.turn][0]));
      await tippe(screen.getByRole('button', { name: / rein$/ }));
      return;
    }
    case 'score':
      await als(ctl, pick(s.seats).id);
      await tippe(screen.getByRole('button', { name: /austeilen|Finale/ }));
      return;
  }
}

describe('Stichmagie an der Oberfläche', () => {
  it('zeigt ohne Online-Lobby, dass eigene Handys nötig sind', () => {
    mount(spieler(3), false);
    expect(screen.getByText('Eigene Handys nötig')).toBeInTheDocument();
  });

  it('lässt nur den Host den Tisch einrichten', async () => {
    const ctl = mount(spieler(3));
    expect(screen.getByRole('button', { name: 'Karten austeilen' })).toBeInTheDocument();
    await als(ctl, 'p1');
    expect(screen.queryByRole('button', { name: 'Karten austeilen' })).toBeNull();
    expect(screen.getByText('Richtet den Tisch ein')).toBeInTheDocument();
    // Die Sonderkarten sind für Gäste nur zu sehen, nicht zu schalten.
    const drache = screen.getByRole('button', { name: /Drache/ });
    expect(drache).toBeDisabled();
  });

  it('lässt keine Karte zu, die nicht bedient', async () => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(3));
    const ctl = mount(spieler(3));
    await tippe(screen.getByRole('button', { name: 'Klassisch' }));
    await tippe(screen.getByRole('button', { name: 'Karten austeilen' }));
    const rng = seeded(9);
    // Bis zu einem Stich, in dem jemand bedienen muss und nicht alles darf.
    for (let i = 0; i < 400; i++) {
      const s = ctl.state;
      if (s.phase === 'play' && s.trick.length) {
        const hand = s.hands[s.turn];
        const legal = legalCards(hand, s.trick, s.vampirAs);
        const verboten = hand.find((c) => !legal.includes(c));
        if (verboten !== undefined) {
          await als(ctl, s.turn);
          const vorher = ctl.state;
          await tippe(handCard(verboten));
          expect(ctl.state).toBe(vorher);
          expect(screen.queryByRole('button', { name: /ausspielen/ })).toBeNull();
          return;
        }
      }
      await zug(ctl, rng);
    }
    throw new Error('kein Stich mit Bedienpflicht gefunden');
  });

  it('spielt eine ganze Partie mit allen Sonderkarten bis zum Sieger', async () => {
    vi.spyOn(Math, 'random').mockImplementation(seeded(11));
    const ctl = mount(spieler(4));
    await tippe(screen.getByRole('button', { name: 'Alle 9' }));
    await tippe(screen.getByRole('button', { name: /^Kurz/ }));
    await tippe(screen.getByRole('button', { name: 'Karten austeilen' }));
    const rng = seeded(5);
    const phasen = new Set<string>();
    for (let i = 0; i < 3000 && ctl.state.phase !== 'over'; i++) {
      phasen.add(ctl.state.phase);
      await zug(ctl, rng);
    }
    expect(ctl.state.phase).toBe('over');
    expect(ctl.state.log).toHaveLength(ctl.state.plan.length);
    // Der Abschluss nennt den Sieger und zeigt den Endstand.
    await als(ctl, 'p1');
    expect(screen.getByText('Endstand')).toBeInTheDocument();
    expect(screen.getByText(/gewinn|Geteilter Sieg/)).toBeInTheDocument();
    expect(phasen.has('bid')).toBe(true);
    expect(phasen.has('score')).toBe(true);
  }, 60_000);

  it('bietet an, für jemanden zu übernehmen, der weg ist', async () => {
    const players = spieler(3);
    const ctl = mount(players);
    await tippe(screen.getByRole('button', { name: 'Klassisch' }));
    await tippe(screen.getByRole('button', { name: 'Karten austeilen' }));
    const rng = seeded(1);
    while (ctl.state.phase !== 'bid') await zug(ctl, rng);
    const dran = ctl.state.turn;
    // Die Person ist weg: ihr Handy meldet sich nicht mehr.
    players.find((p) => p.id === dran)!.online = false;
    const helfer = players.find((p) => p.id !== dran)!.id;
    // Gerätewechsel erzwingt ein neues Rendern mit der geänderten Liste.
    await als(ctl, dran);
    await als(ctl, helfer);
    const name = players.find((p) => p.id === dran)!.name;
    await tippe(screen.getByRole('button', { name: `Für ${name} übernehmen` }));
    expect(ctl.state.bids[dran]).toBeGreaterThanOrEqual(0);
    expect(ctl.state.auto[dran]).toBe(true);
  });
});
