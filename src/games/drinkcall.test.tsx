import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { DrinkCall } from './shared/DrinkCall';
import { PartyCtx, type PartyValue } from '../features/party/PartyContext';
import { usePlayer } from '../store/player';
import { getLoadedGame, loadGame } from './registry';
import type { GameAction, GameActionInput, GamePlayer } from './types';

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const roster = (n: number): GamePlayer[] => [
  me,
  ...Array.from({ length: n - 1 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Gast ${i + 1}`,
    color: 'pink' as const,
    online: true,
  })),
];

function party(players: GamePlayer[], patch: Partial<PartyValue> = {}): PartyValue {
  return {
    mode: 'online',
    code: 'A7K2',
    status: 'playing',
    connection: 'online',
    error: null,
    players,
    me,
    isHost: true,
    gameId: null,
    gameState: {},
    startedBy: 'p0',
    startedAt: 1000,
    createOnline: async () => {},
    joinOnline: async () => {},
    startLocal: () => {},
    leave: () => {},
    addLocalPlayer: () => {},
    updateLocalPlayer: () => {},
    removeLocalPlayer: () => {},
    startGame: () => {},
    endGame: () => {},
    dispatch: () => {},
    logSipsFor: () => {},
    ...patch,
  } as PartyValue;
}

/** Rendert ein Spiel mit lokalem Host-Reducer – wie PartyScreen, nur ohne Firebase. */
function Harness({ gameId, players }: { gameId: string; players: GamePlayer[] }) {
  const def = getLoadedGame(gameId)!;
  const [state, setState] = useState<unknown>(() => def.createState(players));
  const dispatch = (a: GameActionInput) =>
    setState((s: unknown) =>
      def.reduce(s, { ...a, by: a.by ?? me.id, at: Date.now() } as GameAction, players),
    );
  const Game = def.Component;
  return (
    <PartyCtx.Provider value={party(players)}>
      <Game
        state={state}
        players={players}
        me={me}
        isHost
        online
        dispatch={dispatch}
        quit={() => {}}
      />
    </PartyCtx.Provider>
  );
}

beforeAll(() => loadGame('kings-cup'));

beforeEach(() => {
  usePlayer.setState({
    profile: {
      name: 'Paul',
      color: 'blue',
      age: 28,
      weightKg: 82,
      heightCm: 183,
      sex: 'male',
      stomach: 'light',
      targetBac: 0.4,
      alcoholFree: false,
      designatedDriver: false,
    },
    onboarded: true,
    currentDrinkId: 'beer-pils',
    customDrinks: [],
    log: [],
    waterCount: 0,
  });
});

const drinkButton = () =>
  screen.queryByRole('button', { name: /Getrunken|Eingetragen/ }) as HTMLButtonElement | null;

describe('Trinkansage: Zustand pro Runde', () => {
  it('gibt den Getrunken-Button in der naechsten Runde wieder frei (Ring of Fire)', () => {
    render(<Harness gameId="kings-cup" players={roster(5)} />);
    // Karten ziehen, bis eine Ansage fuer mich erscheint
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      const draw = screen.queryByRole('button', { name: 'Karte ziehen' });
      if (draw) fireEvent.click(draw);
      if (drinkButton()) found = true;
      else {
        const next = screen.queryByRole('button', { name: 'Nächster' });
        if (next) fireEvent.click(next);
      }
    }
    expect(found, 'keine Trinkansage gefunden').toBe(true);
    const btn = drinkButton()!;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(drinkButton()!.disabled).toBe(true);

    // Weiter bis zur naechsten Ansage
    let again: HTMLButtonElement | null = null;
    for (let i = 0; i < 20 && !again; i++) {
      const next = screen.queryByRole('button', { name: 'Nächster' });
      if (next) fireEvent.click(next);
      const draw = screen.queryByRole('button', { name: 'Karte ziehen' });
      if (draw) fireEvent.click(draw);
      again = drinkButton();
    }
    expect(again, 'keine zweite Trinkansage gefunden').not.toBeNull();
    expect(again!.disabled, 'Button blieb ueber die Runde hinaus gesperrt').toBe(false);
  });
});

describe('Trinkansage: resetKey', () => {
  it('gibt den Button frei, sobald die Ansage wechselt', () => {
    function Wrap() {
      const [n, setN] = useState(0);
      return (
        <PartyCtx.Provider value={party([me])}>
          <button onClick={() => setN((v) => v + 1)}>Weiter</button>
          <DrinkCall player={me} baseSips={3} source="test" resetKey={n} />
        </PartyCtx.Provider>
      );
    }
    render(<Wrap />);
    fireEvent.click(screen.getByRole('button', { name: 'Getrunken' }));
    expect(screen.getByRole('button', { name: /Eingetragen/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.getByRole('button', { name: 'Getrunken' })).toBeEnabled();
  });

  it('bleibt innerhalb derselben Ansage gesperrt', () => {
    function Wrap() {
      const [, force] = useState(0);
      return (
        <PartyCtx.Provider value={party([me])}>
          <button onClick={() => force((v) => v + 1)}>Neu rendern</button>
          <DrinkCall player={me} baseSips={3} source="test" resetKey="karte-1" />
        </PartyCtx.Provider>
      );
    }
    render(<Wrap />);
    fireEvent.click(screen.getByRole('button', { name: 'Getrunken' }));
    fireEvent.click(screen.getByRole('button', { name: 'Neu rendern' }));
    expect(screen.getByRole('button', { name: /Eingetragen/ })).toBeDisabled();
  });

  it('friert die eingetragene Menge ein, statt sie neu zu berechnen', () => {
    // Kurz vor dem Zielpegel: nach dem Eintragen wuerde die Neuberechnung
    // sofort auf "Aussetzen" springen – die Karte darf das nicht tun, sonst
    // sieht der Spieler nie, was er gerade eingetragen hat.
    const now = Date.now();
    usePlayer.setState({
      log: [
        {
          id: 'seed',
          at: now - 5 * 60_000,
          drinkId: 'beer-pils',
          drinkName: 'Bier (Pils)',
          sips: 16,
          alcoholGrams: 24,
        },
      ],
    });
    render(
      <PartyCtx.Provider
        value={party([me], {
          logSipsFor: (_id: string, sips: number, src?: string) =>
            usePlayer.getState().logSips(sips, src),
        })}
      >
        <DrinkCall player={me} baseSips={3} source="test" resetKey="karte-1" />
      </PartyCtx.Provider>,
    );
    const call = () => document.querySelector('.call')!;
    expect(call().querySelector('.call__big')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Getrunken' }));
    expect(usePlayer.getState().log.length).toBe(2);
    // Ohne das Einfrieren waere die Karte jetzt die "Aussetzen"-Variante ohne Button.
    expect(screen.getByRole('button', { name: /Eingetragen/ })).toBeDisabled();
    expect(call().className).toContain('call--done');
  });

  it('jedes Spiel gibt der Trinkansage eine Rundenkennung mit', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.tsx') && !entry.includes('.test.') && entry !== 'DrinkCall.tsx')
          files.push(full);
      }
    };
    walk('src/games');
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const calls = src.match(/<DrinkCall(?:List)?[\s/>]/g)?.length ?? 0;
      if (!calls) continue;
      const keys = src.split('resetKey=').length - 1;
      expect(keys, `${file}: ${calls} Ansagen, ${keys} resetKey`).toBe(calls);
    }
  });
});

describe('Trinkansage über dem Ziel', () => {
  it('zeigt die Stufe statt immer nur „Aussetzen“', () => {
    // 80 g vor 90 Minuten: rund 1,0 Promille, klar über dem harten Deckel.
    usePlayer.setState({
      log: [
        {
          id: 'e1',
          at: Date.now() - 90 * 60_000,
          drinkId: 'beer-pils',
          drinkName: 'Bier',
          sips: 20,
          alcoholGrams: 80,
        },
      ],
    });
    const { container } = render(
      <PartyCtx.Provider value={party([me])}>
        <DrinkCall player={me} baseSips={3} />
      </PartyCtx.Provider>,
    );
    expect(screen.getByText('Pause')).toBeInTheDocument();
    expect(screen.queryByText('Aussetzen')).toBeNull();
    expect(screen.getByText(/Mach eine Pause/)).toBeInTheDocument();
    expect(container.querySelector('.call--pause')).not.toBeNull();
  });
});
