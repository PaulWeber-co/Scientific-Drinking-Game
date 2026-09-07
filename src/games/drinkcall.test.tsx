import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { DrinkCall, DrinkCallList } from './shared/DrinkCall';
import { PartyCtx, type PartyValue } from '../features/party/PartyContext';
import { usePlayer, defaultProfile } from '../store/player';
import { useApp } from '../store/app';
import { useSeen } from '../store/seen';
import { TASKS } from '../engine/tasks';
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
  // Alle drei Stores zuruecksetzen, nicht nur den Spieler: sonst laufen die
  // vorderen Bloecke mit dem, was ein spaeterer Test hinterlassen hat, und die
  // Datei traegt eine unausgesprochene Reihenfolge-Annahme.
  useApp.setState({ taskOnSkip: 'manchmal', spicy: {} });
  useSeen.setState({ seen: {}, cursor: 0 });
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
    nightStartedAt: null,
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

describe('Aufgaben statt leerer Ansagen', () => {
  /** Ein Log, das den Spieler auf den gewuenschten Pegel hebt. */
  const trunken = (gramm: number) => {
    usePlayer.setState({
      log: [
        {
          id: 'seed',
          at: Date.now() - 60 * 60_000,
          drinkId: 'beer-pils',
          drinkName: 'Bier (Pils)',
          sips: 1,
          alcoholGrams: gramm,
        },
      ],
    });
  };

  const zeigen = () =>
    render(
      <PartyCtx.Provider value={party([me], { gameId: 'kings-cup' })}>
        <DrinkCall player={me} baseSips={3} source="test" resetKey="karte-1" />
      </PartyCtx.Provider>,
    );

  /** Der Aufgabentext ist alles unter der Trennlinie. */
  const aufgabe = () => document.querySelector('.call__tasktext')?.textContent ?? null;

  beforeEach(() => {
    useApp.setState({ taskOnSkip: 'immer' });
  });

  it('gibt dem Fahrer eine echte Aufgabe statt nur der Überschrift', () => {
    // Das Versprechen steht an sieben Stellen in der App. Bis hierher war
    // "Aufgabe" eine Ueberschrift ohne Inhalt.
    usePlayer.setState({ profile: { ...usePlayer.getState().profile!, designatedDriver: true } });
    zeigen();
    expect(document.querySelector('.call__big')!.textContent).toBe('Aufgabe');
    const text = aufgabe();
    expect(text, 'keine Aufgabe angezeigt').not.toBeNull();
    expect(TASKS.some((t) => t.text === text)).toBe(true);
  });

  it('gibt sie dem Fahrer auch dann, wenn Aufgaben beim Aussetzen abgeschaltet sind', () => {
    useApp.setState({ taskOnSkip: 'aus' });
    usePlayer.setState({ profile: { ...usePlayer.getState().profile!, designatedDriver: true } });
    zeigen();
    expect(aufgabe()).not.toBeNull();
  });

  it('schweigt beim Aussetzen, wenn der Schalter auf „Nie" steht', () => {
    useApp.setState({ taskOnSkip: 'aus' });
    trunken(40);
    zeigen();
    expect(document.querySelector('.call__big')!.textContent).toBe('Aussetzen');
    expect(aufgabe()).toBeNull();
  });

  it('gibt beim Aussetzen eine, wenn der Schalter auf „Immer" steht', () => {
    // Gegenprobe zum Test darueber: sonst ginge ein kaputter Aufgabenpfad als
    // "Schalter wirkt" durch.
    trunken(40);
    zeigen();
    expect(document.querySelector('.call__big')!.textContent).toBe('Aussetzen');
    expect(aufgabe()).not.toBeNull();
  });

  it('gibt der mildesten Stufe über dem Ziel noch etwas zu tun', () => {
    trunken(55);
    zeigen();
    expect(document.querySelector('.call__big')!.textContent).toBe('Wasser');
    expect(aufgabe()).not.toBeNull();
  });

  it('lässt Pause, Stopp und Gefahr ohne Aufgabe', () => {
    // Sicherheitsansagen. Eine Spielaufgabe daneben wuerde sie relativieren.
    // Jede Stufe einzeln benannt: eine Liste erlaubter Stufen wuerde nicht
    // auffallen, wenn zwei der drei Faelle nie erreicht werden.
    const stufen: [number, string][] = [
      [70, 'Pause'],
      [90, 'Stopp'],
      [150, 'Gefahr'],
    ];
    for (const [gramm, erwartet] of stufen) {
      trunken(gramm);
      const { unmount } = zeigen();
      expect(document.querySelector('.call__big')!.textContent, `${gramm} g`).toBe(erwartet);
      expect(aufgabe(), `${erwartet} zeigte eine Aufgabe`).toBeNull();
      unmount();
    }
  });

  it('behält dieselbe Aufgabe über einen Re-Render', () => {
    // Das Gedaechtnis merkt sich die Aufgabe, sobald sie einmal dastand. Ohne
    // das Einfrieren stuende beim naechsten Render eine andere da.
    usePlayer.setState({ profile: { ...usePlayer.getState().profile!, designatedDriver: true } });
    function Wrap() {
      const [, force] = useState(0);
      return (
        <PartyCtx.Provider value={party([me], { gameId: 'kings-cup' })}>
          <button onClick={() => force((v) => v + 1)}>Neu rendern</button>
          <DrinkCall player={me} baseSips={3} source="test" resetKey="karte-1" />
        </PartyCtx.Provider>
      );
    }
    render(<Wrap />);
    const erst = aufgabe();
    fireEvent.click(screen.getByRole('button', { name: 'Neu rendern' }));
    expect(aufgabe()).toBe(erst);
  });

  it('gibt jedem Spieler am selben Gerät eine eigene Aufgabe', () => {
    // Pass & Play: DrinkCallList rendert alle lokalen Spieler. Bekaeme die
    // Auswahl keinen Spieler-Anteil im Seed, stuende bei allen dasselbe.
    const fahrer = (id: string, name: string): GamePlayer => ({
      id,
      name,
      color: 'pink',
      online: true,
      local: {
        profile: { ...defaultProfile(), name, designatedDriver: true, alcoholFree: true },
        drinkId: 'beer-pils',
        log: [],
      },
    });
    const runde = [me, fahrer('g1', 'Anna'), fahrer('g2', 'Ben'), fahrer('g3', 'Cem')];
    usePlayer.setState({ profile: { ...usePlayer.getState().profile!, designatedDriver: true } });
    render(
      <PartyCtx.Provider value={party(runde, { mode: 'local', gameId: 'kings-cup' })}>
        <DrinkCallList players={runde} baseSips={3} source="test" resetKey="karte-1" />
      </PartyCtx.Provider>,
    );
    const texte = [...document.querySelectorAll('.call__tasktext')].map((e) => e.textContent);
    expect(texte, 'nicht jeder Spieler hat eine Aufgabe').toHaveLength(runde.length);
    expect(new Set(texte).size, `doppelte Aufgaben: ${texte.join(' | ')}`).toBe(runde.length);
  });

  it('gibt in der nächsten Runde eine andere Aufgabe', () => {
    usePlayer.setState({ profile: { ...usePlayer.getState().profile!, designatedDriver: true } });
    function Wrap() {
      const [n, setN] = useState(0);
      return (
        <PartyCtx.Provider value={party([me], { gameId: 'kings-cup' })}>
          <button onClick={() => setN((v) => v + 1)}>Weiter</button>
          <DrinkCall player={me} baseSips={3} source="test" resetKey={n} />
        </PartyCtx.Provider>
      );
    }
    render(<Wrap />);
    const erst = aufgabe();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(aufgabe()).not.toBe(erst);
  });
});
