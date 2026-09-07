import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { createCardGame, type CardDef, type CardGameState } from './card-engine/createCardGame';
import { PartyCtx, type PartyValue } from '../features/party/PartyContext';
import { useApp } from '../store/app';
import { usePlayer, defaultProfile } from '../store/player';
import { markTextsSeen, useSeen } from '../store/seen';
import { spicyDeck } from './shared/prompts';
import { GAMES, loadGame } from './registry';
import type { GameAction, GameActionInput, GamePlayer } from './types';

const DEFS = await Promise.all(GAMES.map((g) => loadGame(g.id)));

/**
 * Wiederholen sich Karten?
 *
 * Zwei getrennte Quellen, beide hier geprueft:
 *  1. Spiele mit Moduswahl bauten bei JEDEM Zug einen kompletten Stapel neu
 *     und zogen die oberste Karte – Ziehen mit Zuruecklegen, Wiederholung
 *     schon in derselben Partie.
 *  2. Jede neue Partie fing wieder bei null an.
 *
 * Geprueft wird an einem eigenen Spiel mit bekanntem Stapel, nicht an einem
 * echten: nur so steht die Topfgroesse fest und der Test sagt „nach N Zuegen
 * N verschiedene Karten" statt „vermutlich keine Wiederholung".
 */

const KARTEN: CardDef[] = Array.from({ length: 10 }, (_, i) => ({ text: `Karte ${i + 1}` }));

/**
 * Zuege je Partie im Zweite-Partie-Test. Muss deutlich unter der halben
 * Stapelgroesse bleiben: nur dann sind nach Partie 1 garantiert genug
 * ungesehene Karten uebrig, dass Partie 2 zwingend aus ihnen zieht. Zoege
 * eine Partie mehr als die Haelfte, haenge das Ergebnis am Zufall.
 */
const ZUEGE_JE_PARTIE = 4;

/** Wie das Testspiel, aber mit einem doppelten Kartentext. */
const DOPPELT: CardDef[] = [
  { text: 'Karte A' },
  { text: 'Karte B' },
  { text: 'Karte C' },
  { text: 'Karte C' },
];

const spiel = createCardGame({
  id: 'test-gedaechtnis',
  name: 'Test',
  tagline: 'Test',
  icon: 'cards',
  accent: 'var(--blue)',
  minPlayers: 2,
  maxPlayers: 8,
  duration: '10 min',
  intensity: 3,
  tags: [],
  howTo: ['Test'],
  // Moduswahl: genau der Pfad, der den Stapel bei jedem Zug neu baute.
  actor: 'turn',
  modes: [{ id: 'a', label: 'Modus A' }],
  baseSips: 3,
  drink: 'none',
  cards: KARTEN,
});

const me: GamePlayer = { id: 'p0', name: 'Paul', color: 'blue', online: true };
const spieler: GamePlayer[] = [me, { id: 'p1', name: 'Anna', color: 'pink', online: true }];

function party(): PartyValue {
  return {
    mode: 'local',
    code: null,
    status: 'playing',
    connection: 'online',
    error: null,
    players: spieler,
    me,
    isHost: true,
    gameId: 'test-gedaechtnis',
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
  } as unknown as PartyValue;
}

/** Rendert das Spiel mit lokalem Reducer – wie der Host, nur ohne Firebase. */
function Harness() {
  const [state, setState] = useState<CardGameState>(() => spiel.createState(spieler));
  const dispatch = (a: GameActionInput) =>
    setState((s) => spiel.reduce(s, { ...a, by: me.id, at: Date.now() } as GameAction, spieler));
  const Game = spiel.Component;
  return (
    <PartyCtx.Provider value={party()}>
      <Game
        state={state}
        players={spieler}
        me={me}
        isHost
        online={false}
        dispatch={dispatch}
        quit={() => {}}
      />
    </PartyCtx.Provider>
  );
}

/** Ein Zug: Modus waehlen, Kartentext ablesen, aufloesen, weiter. */
function ziehen(): string {
  fireEvent.click(screen.getByRole('button', { name: /Modus A/ }));
  const text = document.querySelector('.bigcard__text, .bigcard')!.textContent ?? '';
  const treffer = text.match(/Karte \d+/);
  expect(treffer, `keine Karte sichtbar, stattdessen: ${text}`).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Erledigt' }));
  fireEvent.click(screen.getByRole('button', { name: /Nächster|Endstand/ }));
  return treffer![0];
}

beforeEach(() => {
  useSeen.setState({ seen: {}, cursor: 0 });
  localStorage.clear();
  // Ohne Ende, sonst schliesst die Partie vor dem letzten Zug.
  useApp.setState({ gameLength: 'endlos', spicy: {}, taskOnSkip: 'aus' });
  usePlayer.setState({
    profile: { ...defaultProfile(), name: 'Paul' },
    currentDrinkId: 'beer-pils',
    log: [],
  });
});

describe('Karten wiederholen sich nicht', () => {
  it('zeigt in einer Partie jede Karte einmal, bevor eine wiederkommt', () => {
    render(<Harness />);
    const gezogen = Array.from({ length: KARTEN.length }, ziehen);
    expect(new Set(gezogen).size, `Wiederholung in: ${gezogen.join(', ')}`).toBe(KARTEN.length);
  });

  it('geht danach weiter, statt stehenzubleiben', () => {
    // Sackgassen-Probe: ist der Stapel durch, muss trotzdem eine Karte kommen.
    render(<Harness />);
    for (let i = 0; i < KARTEN.length; i++) ziehen();
    expect(ziehen()).toMatch(/Karte \d+/);
  });

  it('legt einen doppelten Kartentext nur einmal in den Stapel', () => {
    // Gleicher Text = gleiche Karte. Zwei davon waeren fuer das Gedaechtnis
    // nicht unterscheidbar und koennten direkt hintereinander kommen.
    const doppelSpiel = createCardGame({
      ...spiel,
      id: 'test-doppelt',
      modes: [{ id: 'a', label: 'Modus A' }],
      actor: 'turn',
      drink: 'none',
      baseSips: 3,
      howTo: ['Test'],
      tags: [],
      minPlayers: 2,
      maxPlayers: 8,
      duration: '10 min',
      cards: DOPPELT,
    });
    const state = doppelSpiel.createState(spieler);
    const imStapel = state.deck.length + (state.drawn ? 1 : 0);
    expect(imStapel).toBe(new Set(DOPPELT.map((c) => c.text)).size);
  });

  it('legt in keinem mitgelieferten Spiel einen Kartentext doppelt', () => {
    // Aus der Quelle erzeugt statt handgepflegt: eine Liste bekannter Spiele
    // waere selbst der blinde Fleck. Spicy an und Haerte 3, sonst faellt ein
    // Doppeleintrag durch den Filter und der Test uebersieht ihn.
    useApp.setState({ spicy: Object.fromEntries(GAMES.map((g) => [g.id, true])) });
    let geprueft = 0;
    for (const def of DEFS) {
      const start = def.createState(spieler) as { deck?: unknown };
      // Nur Stapel der Kartenfabrik. Drei Spiele (most-likely, meme-battle,
      // top-ten) tragen einen eigenen Stapel aus Indizes, keine Karten.
      if (!Array.isArray(start.deck) || !start.deck.length) continue;
      if (!start.deck.every((c) => typeof (c as CardDef).text === 'string')) continue;
      const hart = def.reduce(
        start,
        { type: 'setHeat', heat: 3, by: me.id, at: Date.now() } as GameAction,
        spieler,
      ) as CardGameState;
      const texte = [...hart.deck, ...(hart.drawn ? [hart.drawn] : [])].map((c) => c.text);
      expect(texte.length, `${def.id} hat einen fast leeren Stapel`).toBeGreaterThan(3);
      expect(new Set(texte).size, `${def.id} hat einen doppelten Kartentext`).toBe(texte.length);
      geprueft++;
    }
    // Untergrenze: ohne sie meldete der Test auch dann gruen, wenn kein
    // einziges Spiel einen Stapel hat und die Schleife leer durchlaeuft.
    // Heute nutzen fuenf Spiele die Kartenfabrik (chaos-roulette, kategorien,
    // never-have-i-ever, truth-or-dare, erste-zeile). Sinkt die Zahl, ist
    // entweder ein Spiel umgebaut worden oder dieser Test greift ins Leere.
    expect(geprueft, 'zu wenige Kartenspiele geprüft').toBeGreaterThanOrEqual(5);
  });

  it('ordnet auch den Indexstapel der Spiele mit eigenem Stapel', () => {
    // most-likely, meme-battle und top-ten mischen Indizes statt Karten. Ohne
    // diese Ordnung faengt dort jede neue Partie wieder bei null an.
    const items: { text: string; spicy?: boolean }[] = [
      { text: 'a' },
      { text: 'b' },
      { text: 'c' },
    ];
    markTextsSeen(['a']);
    const stapel = spicyDeck(items, 'test-gedaechtnis', (i) => i.text);
    expect(stapel).toHaveLength(items.length);
    expect(items[stapel[2]].text, 'Gesehenes liegt nicht hinten').toBe('a');
  });

  it('fängt die zweite Partie mit anderen Karten an', () => {
    // Genau der Fall „zweite Runde Ich-hab-noch-nie am selben Abend".
    const { unmount } = render(<Harness />);
    const ersteHaelfte = Array.from({ length: ZUEGE_JE_PARTIE }, ziehen);
    unmount();

    render(<Harness />);
    const zweitePartie = Array.from({ length: ZUEGE_JE_PARTIE }, ziehen);
    const doppelt = zweitePartie.filter((k) => ersteHaelfte.includes(k));
    expect(doppelt, `aus der ersten Partie wiederholt: ${doppelt.join(', ')}`).toEqual([]);
  });
});
