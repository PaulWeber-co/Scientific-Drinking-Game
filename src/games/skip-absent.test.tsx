import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PartyCtx, type PartyValue } from '../features/party/PartyContext';
import { useApp } from '../store/app';
import { busfahrer } from './busfahrer';
import { kingsCup } from './kings-cup';
import { lueckenfueller } from './lueckenfueller';
import { maexchen } from './maexchen';
import { mostLikely } from './most-likely';
import { topTen } from './top-ten';
import { truthOrDare } from './truth-or-dare';
import { undercover } from './undercover';
import { werBinIch } from './wer-bin-ich';
import { zweiWahrheiten } from './zwei-wahrheiten';
import type { GameActionInput, GameDefinition, GamePlayer } from './types';

const host: GamePlayer = { id: 'host', name: 'Anna', color: 'blue', online: true, isHost: true };
const ben: GamePlayer = { id: 'ben', name: 'Ben', color: 'pink', online: true, isHost: false };
const guest: GamePlayer = { id: 'guest', name: 'Cara', color: 'indigo', online: true, isHost: false };
const fourth: GamePlayer = { id: 'fourth', name: 'Dani', color: 'pink', online: true, isHost: false };
const roster = [host, ben, guest, fourth];
const order = roster.map((p) => p.id);
const submitted = { host: 'Eins', guest: 'Zwei', fourth: 'Drei' };
const skip = { type: 'skipAbsent' };
const skipBen = { ...skip, who: ben.id };

const absences = [
  { reason: 'entfernt', players: roster.filter((p) => p.id !== ben.id) },
  { reason: 'offline', players: roster.map((p) => p.id === ben.id ? { ...p, online: false } : p) },
];

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.4);
  useApp.setState({ gameLength: 'endlos', blanks: {} });
});

afterEach(() => vi.restoreAllMocks());

function renderGame<S>(game: GameDefinition<S>, state: S, players: GamePlayer[], me: GamePlayer, dispatch = vi.fn()) {
  const Screen = game.Component;
  return (
    <MemoryRouter>
      <PartyCtx.Provider value={{ me, players, mode: 'online', connection: 'online', isHost: me.isHost } as PartyValue}>
        <Screen state={state} players={players} me={me} isHost={Boolean(me.isHost)} online dispatch={dispatch} quit={vi.fn()} />
      </PartyCtx.Provider>
    </MemoryRouter>
  );
}

function checkSkip<S>(
  game: GameDefinition<S>,
  phase: string,
  setup: () => S,
  verify: (state: S, before: S, players: GamePlayer[]) => void,
  continueWithout = false,
  waitingFor?: string,
) {
  describe(`${game.name} · ${phase}`, () => {
    it.each(absences)('schaltet weiter, wenn Ben $reason ist', ({ players }) => {
      const state = setup();
      const next = game.reduce(state, { ...skipBen, by: host.id }, players);
      expect(next).not.toBe(state);
      verify(next, state, players);
    });

    it('verwirft die Aktion von Gästen, bei Rückkehr und für eine alte Rolle', () => {
      const state = setup();
      const players = absences[0].players;
      expect(game.reduce(state, { ...skipBen, by: guest.id }, players)).toBe(state);
      expect(game.reduce(state, { ...skipBen, by: host.id }, roster)).toBe(state);
      expect(game.reduce(state, { ...skip, by: host.id, who: fourth.id }, players)).toBe(state);
      expect(game.reduce(state, { ...skipBen, by: host.id }, players.map((p) => ({ ...p, isHost: undefined })))).toBe(state);
    });

    it.each(absences)('zeigt nur dem Host den Knopf, wenn Ben $reason ist', ({ players }) => {
      const state = setup();
      const dispatch = vi.fn<(action: GameActionInput) => void>();
      const view = (me: GamePlayer, members: GamePlayer[]) => renderGame(game, state, members, me, dispatch);
      const label = continueWithout ? 'Ohne Ben weiter' : 'Ben überspringen';
      const { rerender } = render(view(host, players));
      const control = screen.getByRole('button', { name: label });
      expect(control).toHaveClass('btn', 'btn--gray', 'btn--block');
      fireEvent.click(control);
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining(skipBen));
      const next = game.reduce(state, { ...dispatch.mock.calls[0][0], by: host.id }, players);
      verify(next, state, players);

      rerender(view(guest, players));
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
      expect(screen.getByText(continueWithout
        ? 'Ben ist nicht da – Anna kann ohne Ben weiter.'
        : 'Ben ist nicht da – Anna kann überspringen.')).toBeVisible();

      rerender(view(host, roster));
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    });

    if (waitingFor) {
      it.each(absences)('nennt Ben in der Warteliste, wenn er $reason ist', ({ players }) => {
        const view = (members: GamePlayer[]) => renderGame(game, setup(), members, host);
        const { rerender } = render(view(players));
        const list = screen.getByText('Ben (nicht da)').closest('.waiting')!;
        expect(list).toHaveTextContent(waitingFor);
        expect(list).not.toHaveTextContent('niemand mehr');
        rerender(view(roster));
        expect(screen.queryByText('Ben (nicht da)')).not.toBeInTheDocument();
      });
    }
  });
}

checkSkip(truthOrDare, 'Moduswahl', () => ({ ...truthOrDare.createState(roster), order, turnIndex: 1 }),
  (next, _, players) => {
    expect(next).toMatchObject({ phase: 'choose', turnIndex: 2, drawn: null });
    const pick = { type: 'pickMode', mode: 'wahrheit' };
    const card = truthOrDare.reduce(next, { ...pick, by: guest.id }, players);
    expect(card.phase).toBe('card');
    expect(card.drawn).not.toBeNull();
    expect(truthOrDare.reduce(next, { ...pick, by: host.id }, players)).toBe(next);
  });

for (const [phase, drawn] of [
  ['Ziehen', null],
  ['offene Du-Karte', 1],
  ['offene Partnerwahl', 7],
] as const) {
  checkSkip(kingsCup, phase, () => ({
    ...kingsCup.createState(roster), order, turnIndex: 1, drawn, pours: [ben.id],
    partners: { host: ben.id }, kings: 1,
  }), (next, before, players) => {
    expect(next).toMatchObject({ drawn: null, target: null, round: before.round });
    expect(next.order).toEqual(players.map((p) => p.id));
    expect(next.order[next.turnIndex]).toBe(guest.id);
    expect(next.pours).toEqual(before.pours);
    expect(next.partners).toEqual(before.partners);
    expect(next.deck).toBe(before.deck);
    expect(kingsCup.reduce(next, { type: 'draw', slot: 0, by: guest.id }, players).drawn).not.toBeNull();
  });
}

it('Ring of Fire lässt ein gebuchtes Ziel auch nach dem Entfernen auf seiner alten ID', () => {
  const players = absences[0].players;
  const state = { ...kingsCup.createState(roster), order, drawn: 1, target: ben.id, pours: [ben.id] };
  render(renderGame(kingsCup, state, players, host));
  expect(screen.getByRole('button', { name: 'Nächster' })).toBeEnabled();
  expect(kingsCup.reduce(state, { type: 'pickTarget', target: guest.id, by: host.id }, players)).toBe(state);
  expect(kingsCup.reduce(state, { type: 'next', by: host.id }, players)).toMatchObject({
    drawn: null, pours: [ben.id],
  });
});

for (const [phase, turnIndex] of [['roll', 1], ['look', 1], ['decide', 0], ['reveal', 0]] as const) {
  checkSkip(maexchen, phase, () => ({
    ...maexchen.createState(roster), order, phase, turnIndex, dice: [3, 4] as [number, number],
    reveal: phase === 'reveal' ? { dice: [3, 4] as [number, number], loserId: null, believedMaexchen: false } : null,
    losses: { ben: 2 },
  }), (next, before, players) => {
    expect(next).toMatchObject({ phase: 'roll', turnIndex: 2, dice: null, reveal: null });
    expect(next.losses).toEqual(before.losses);
    expect(maexchen.reduce(next, { type: 'roll', by: guest.id }, players).phase).toBe('look');
  });
}

it('Mäxchen startet nach einem gebuchten Verlust ohne die verlorene Person eine neue Runde', () => {
  const players = absences[0].players;
  const state = {
    ...maexchen.createState(roster), order, phase: 'reveal' as const,
    reveal: { dice: null, loserId: ben.id, believedMaexchen: true }, losses: { ben: 1 },
  };
  const dispatch = vi.fn<(action: GameActionInput) => void>();
  render(renderGame(maexchen, state, players, host, dispatch));
  fireEvent.click(screen.getByRole('button', { name: 'Neue Runde' }));
  expect(screen.queryByRole('button', { name: /Gelogen|Stimmt/ })).not.toBeInTheDocument();
  const next = maexchen.reduce(state, { ...dispatch.mock.calls[0][0], by: host.id }, players);
  expect(next).toMatchObject({ phase: 'roll', round: 2, losses: { ben: 1 } });
  expect(next.order[next.turnIndex]).toBe(guest.id);
});

checkSkip(busfahrer, 'Fragerunde', () => ({
  ...busfahrer.createState(roster), order, playerIndex: 1, qIndex: 1, hand: [4], mistakes: { ben: 1 },
}), (next, before, players) => {
  expect(next).toMatchObject({ phase: 'questions', playerIndex: 2, qIndex: 0, hand: [], hands: { ben: [4] } });
  expect(next.mistakes).toEqual(before.mistakes);
  expect(busfahrer.reduce(next, { type: 'answer', answer: 'rot', by: guest.id }, players).hand).toHaveLength(1);
});

checkSkip(busfahrer, 'Busfahrt', () => ({
  ...busfahrer.createState(roster), order, phase: 'bus' as const, driverId: ben.id, busDeck: [5, 6],
  busPos: 1, busRow: [4, null, null, null, null], drives: { ben: 1 },
}), (next, before, players) => {
  expect(next).toMatchObject({ driverId: guest.id, busPos: 1, drives: { ben: 1 } });
  expect(next.busRow).toEqual(before.busRow);
  expect(busfahrer.reduce(next, { type: 'flip', by: guest.id }, players).busPos).toBe(2);
});

for (const step of ['pick', 'give'] as const) {
  checkSkip(busfahrer, `Pyramide ${step}`, () => ({
    ...busfahrer.createState(roster), order, phase: 'pyramid' as const, pyStep: step, pyUp: 1,
    pyClaimBy: ben.id, pyClaimCard: step === 'give' ? 5 : null, hands: { ben: [5, 5, 6], guest: [7] },
  }), (next, _, players) => {
    expect(next).toMatchObject({ pyStep: step === 'pick' ? 'claim' : 'flip', pyClaimBy: null, pyGiveTo: null });
    expect(next.hands.ben).toEqual(step === 'pick' ? [5, 5, 6] : [5, 6]);
    const action = step === 'pick' ? { type: 'pyClaim', who: guest.id } : { type: 'pyFlip' };
    expect(busfahrer.reduce(next, { ...action, by: guest.id }, players).pyStep).toBe(step === 'pick' ? 'pick' : 'claim');
  });
}

it('Busfahrer nominiert auf der letzten Pyramidenkarte nur einen erreichbaren Fahrer', () => {
  const state = {
    ...busfahrer.createState(roster), order, phase: 'pyramid' as const, pyStep: 'claim' as const, pyUp: 10,
    hands: { ben: [1, 2, 3, 4], guest: [5, 6], fourth: [7] },
  };
  const next = busfahrer.reduce(state, { type: 'pyPass', by: host.id }, absences[1].players);
  expect(next).toMatchObject({ phase: 'bus', driverId: guest.id, drives: { guest: 1, ben: 0 } });
});

it('Busfahrer verbraucht auch beim normalen Ausspielen nur eine doppelt gehaltene Karte', () => {
  const state = {
    ...busfahrer.createState(roster), order, phase: 'pyramid' as const, pyStep: 'gave' as const, pyUp: 1,
    pyClaimBy: ben.id, pyClaimCard: 5, pyGiveTo: host.id, hands: { ben: [5, 5, 6] },
  };
  const next = busfahrer.reduce(state, { type: 'pyDone', by: ben.id }, roster);
  expect(next).toMatchObject({ pyStep: 'flip', hands: { ben: [5, 6] } });
});

checkSkip(undercover, 'Letzte Karte', () => ({
  ...undercover.createState(roster), order, seen: [host.id, guest.id, fourth.id],
}), (next, before) => {
  expect(next.phase).toBe('describe');
  expect(next.seen).toEqual(before.seen);
}, true, 'Warten auf');

checkSkip(undercover, 'Letzter Rateversuch', () => ({
  ...undercover.createState(roster), order, phase: 'guess' as const, undercoverIds: [ben.id],
  lastOut: ben.id, eliminated: [ben.id], guessOptions: ['A', 'B', 'C'],
}), (next) => {
  expect(next).toMatchObject({ phase: 'over', winner: 'gruppe', guessed: null, groupWins: 1, agentWins: 0 });
}, false, 'Warten auf');

checkSkip(undercover, 'Letzte Stimme', () => ({
  ...undercover.createState(roster), order, phase: 'vote' as const, undercoverIds: [guest.id],
  votes: { host: 'guest', guest: 'host', fourth: 'guest' },
}), (next, before) => {
  expect(next).toMatchObject({ phase: 'guess', lastOut: guest.id, votes: before.votes });
}, true, 'Warten auf');

it('Undercover schließt eine leere Abstimmung auch ohne einen gültigen Tipp neutral ab', () => {
  const state = { ...undercover.createState(roster), order, phase: 'vote' as const };
  const viewer = { ...host, id: 'new' };
  const next = undercover.reduce(state, { ...skip, by: viewer.id }, [viewer]);
  expect(next).toMatchObject({ phase: 'over', winner: null, groupWins: 0, agentWins: 0 });
});

it('Undercover lässt nach dem Entfernen eines Stimmziels neu wählen', () => {
  const players = absences[0].players;
  const state = {
    ...undercover.createState(roster), order, phase: 'vote' as const, votes: { guest: ben.id },
  };
  const dispatch = vi.fn<(action: GameActionInput) => void>();
  render(renderGame(undercover, state, players, guest, dispatch));
  fireEvent.click(screen.getByRole('button', { name: host.name }));
  expect(undercover.reduce(state, { ...dispatch.mock.calls[0][0], by: guest.id }, players).votes).toEqual({ guest: host.id });
});

it('Undercover zeigt für einen übersprungenen Rateversuch auch nach der Rückkehr keine Trinkansage', () => {
  const state = {
    ...undercover.createState(roster), order, phase: 'guess' as const,
    undercoverIds: [ben.id], lastOut: ben.id, eliminated: [ben.id],
  };
  const next = undercover.reduce(state, { ...skipBen, by: host.id }, absences[1].players);
  render(renderGame(undercover, next, roster, host));
  expect(screen.getByText(/Der letzte Rateversuch entfällt/)).toBeVisible();
  expect(screen.queryByText('sieht die Menge auf dem eigenen Handy')).not.toBeInTheDocument();
});

it('Undercover setzt den Durchgang mit einer weiteren verdeckten Person fort', () => {
  const state = {
    ...undercover.createState(roster), order, phase: 'guess' as const,
    undercoverIds: [ben.id, fourth.id], lastOut: ben.id, eliminated: [ben.id], guessOptions: ['A', 'B', 'C'],
  };
  expect(undercover.reduce(state, { ...skipBen, by: host.id }, absences[1].players)).toMatchObject({
    phase: 'describe', winner: null, guessed: null, groupWins: 0, agentWins: 0,
  });
});

checkSkip(topTen, 'Letzte Antwort', () => ({
  ...topTen.createState(roster), answers: submitted,
}), (next, before, players) => {
  expect(next).toMatchObject({ phase: 'reading', answers: before.answers, tokens: before.tokens });
  const sorting = topTen.reduce(next, { type: 'startSorting', by: host.id }, players);
  expect(sorting.phase).toBe('revealing');
  expect(topTen.reduce(sorting, { type: 'reveal', by: host.id, id: ben.id }, roster)).toBe(sorting);
}, true, 'Warten auf');

for (const phase of ['reading', 'revealing'] as const) {
  checkSkip(topTen, `Kapitän in ${phase}`, () => ({
    ...topTen.createState(roster), phase, captainIndex: 1, answers: { ...submitted, ben: 'Vier' },
    sortedBy: phase === 'revealing' ? ben.id : null,
  }), (next, before, players) => {
    expect(next).toMatchObject({ phase, captainIndex: 2, tokens: before.tokens, sortedBy: null, perfect: {} });
    const action = phase === 'reading' ? { type: 'startSorting' } : { type: 'reveal', id: host.id };
    expect(topTen.reduce(next, { ...action, by: host.id }, players)).toBe(next);
    expect(topTen.reduce(next, { ...action, by: guest.id }, players)).not.toBe(next);
  });
}

checkSkip(topTen, 'Letzte verdeckte Zahl', () => ({
  ...topTen.createState(roster), phase: 'revealing' as const, revealed: [host.id, guest.id, fourth.id],
  answers: { ...submitted, ben: 'Vier' }, sortedBy: host.id,
}), (next, before) => {
  expect(next).toMatchObject({ phase: 'results', revealed: before.revealed, tokens: before.tokens, sortedBy: host.id });
}, true);

it('Top Ten wertet ohne verfügbaren Kapitän und ohne letzte Zahl neutral', () => {
  const state = {
    ...topTen.createState(roster), phase: 'revealing' as const, captainIndex: 1,
    answers: { ...submitted, ben: 'Vier' }, revealed: [host.id, guest.id, fourth.id], sortedBy: ben.id,
  };
  const players = absences[0].players;
  const results = topTen.reduce(state, { ...skipBen, by: host.id }, players);
  render(renderGame(topTen, results, roster, ben));
  expect(screen.getByText('Die Runde endet ohne Wertung.')).toBeVisible();
  expect(screen.queryByText(/Alle anderen trinken/)).not.toBeInTheDocument();
  expect(topTen.reduce(results, { type: 'next', by: host.id }, roster).perfect).toEqual({});
});

it('Top Ten bewahrt in älteren fertigen Runden den eingetragenen Kapitän', () => {
  const state = {
    ...topTen.createState(roster), phase: 'results' as const, captainIndex: 1,
    sortedBy: undefined, revealed: [ben.id],
  };
  expect(topTen.reduce(state, { type: 'next', by: host.id }, roster).perfect).toEqual({ ben: 1 });
});

for (const phase of ['write', 'commit'] as const) {
  checkSkip(zweiWahrheiten, phase, () => ({
    ...zweiWahrheiten.createState(roster), order, phase, authorIndex: 1,
    statements: phase === 'commit' ? ['A', 'B', 'C'] : [],
  }), (next, before, players) => {
    expect(next).toMatchObject({ phase: 'write', authorIndex: 2, statements: [], lie: null, round: before.round });
    const submit = { type: 'submit', statements: ['D', 'E', 'F'] };
    expect(zweiWahrheiten.reduce(next, { ...submit, by: guest.id }, players).phase).toBe('commit');
  }, false, 'Warten auf');
}

checkSkip(zweiWahrheiten, 'Erzähler beim Aufdecken', () => ({
  ...zweiWahrheiten.createState(roster), order, phase: 'guess' as const, authorIndex: 1,
  statements: ['A', 'B', 'C'], lie: 1, guesses: { host: 1, guest: 2, fourth: 0 },
}), (next, before) => {
  expect(next).toMatchObject({ phase: 'result', lie: before.lie, hits: { host: 1 }, authorIndex: 1 });
}, false, 'Warten auf');

checkSkip(zweiWahrheiten, 'Letzter Tipp', () => ({
  ...zweiWahrheiten.createState(roster), order, phase: 'guess' as const, authorIndex: 0,
  statements: ['A', 'B', 'C'], lie: 1, guesses: { guest: 1, fourth: 2 },
}), (next) => {
  expect(next).toMatchObject({ phase: 'result', lie: 1, hits: { guest: 1 } });
}, true, 'Warten auf');

it('Zwei Wahrheiten zeigt einem beim Aufdecken übersprungenen Erzähler nach Rückkehr keine Trinkansage', () => {
  const state = {
    ...zweiWahrheiten.createState(roster), order, phase: 'guess' as const, authorIndex: 1,
    statements: ['A', 'B', 'C'], lie: 1, guesses: { host: 1, guest: 1, fourth: 1 },
  };
  const results = zweiWahrheiten.reduce(state, { ...skipBen, by: host.id }, absences[0].players);
  render(renderGame(zweiWahrheiten, results, roster, host));
  expect(screen.getByRole('button', { name: 'Nächste Person' })).toBeEnabled();
  expect(screen.queryByText('sieht die Menge auf dem eigenen Handy')).not.toBeInTheDocument();
});

it('Zwei Wahrheiten deckt ganz ohne Mitrater ohne Punkte auf', () => {
  const state = {
    ...zweiWahrheiten.createState([host, ben]), order: [host.id, ben.id],
    phase: 'guess' as const, statements: ['A', 'B', 'C'], lie: 1,
  };
  expect(zweiWahrheiten.reduce(state, { ...skipBen, by: host.id }, [host])).toMatchObject({
    phase: 'result', lie: 1, hits: {},
  });
});

checkSkip(mostLikely, 'Letzte Stimme', () => ({
  ...mostLikely.createState(roster), votes: { host: 'guest', guest: 'host', fourth: 'guest' },
}), (next, before) => {
  expect(next).toMatchObject({ phase: 'result', votes: before.votes, tally: { guest: 2, host: 1 } });
}, true, 'Warten auf');

it('Wer aus der Runde kann ältere Spielstände mit gelöschter letzter Stimme abschließen', () => {
  const players = absences[0].players;
  const state = {
    ...mostLikely.createState(roster), names: undefined,
    votes: { host: 'guest', guest: 'host', fourth: 'guest' },
  };
  const dispatch = vi.fn<(action: GameActionInput) => void>();
  render(renderGame(mostLikely, state, players, host, dispatch));
  expect(screen.getByText('Fehlende Person (nicht da)')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Ohne fehlende Person weiter' }));
  const results = mostLikely.reduce(state, { ...dispatch.mock.calls[0][0], by: host.id }, players);
  expect(results).toMatchObject({ phase: 'result', tally: { guest: 2, host: 1 } });
});

it('Wer aus der Runde übernimmt Stimmen erst beim Auszählen in die Wertung', () => {
  const players = [host, ben, guest];
  const start = { ...mostLikely.createState(players), tally: { guest: 2 } };
  const votes = [
    { type: 'vote', by: host.id, target: guest.id },
    { type: 'vote', by: ben.id, target: guest.id },
    { type: 'vote', by: guest.id, target: host.id },
  ];
  const first = mostLikely.reduce(start, votes[0], players);
  const second = mostLikely.reduce(first, votes[1], players);
  expect(second).toMatchObject({ phase: 'vote', tally: { guest: 2 } });
  expect(mostLikely.reduce(second, votes[2], players)).toMatchObject({
    phase: 'result', tally: { guest: 4, host: 1 },
  });
});

checkSkip(lueckenfueller, 'Letzte Hand', () => lueckenfueller.createState([host, ben]),
  (next, before, players) => {
    expect(next).toMatchObject({ phase: 'submit', judgeId: host.id, round: before.round, black: before.black, scores: before.scores });
    const hand = next.hands[guest.id];
    expect(hand).toHaveLength(10);
    expect(lueckenfueller.reduce(next, { type: 'submit', by: guest.id, cards: hand.slice(0, next.pick) }, players).played[guest.id]).toBeDefined();
  }, true, 'Legen gerade');

checkSkip(lueckenfueller, 'Richter', () => ({
  ...lueckenfueller.createState(roster), judgeId: ben.id, phase: 'reveal' as const,
  played: { fourth: [5] }, order: [fourth.id],
}), (next, before) => {
  expect(next).toMatchObject({ phase: 'reveal', judgeId: guest.id, played: before.played, scores: before.scores });
});

it('Lückenfüller wartet ohne Mitspieler und lässt eine zurückgekehrte Hand wieder abgeben', () => {
  const state = lueckenfueller.createState([host, ben]);
  const { rerender } = render(renderGame(lueckenfueller, state, [host], host));
  expect(screen.getByText('Warten auf Mitspieler.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Ohne Ben weiter' })).not.toBeInTheDocument();
  expect(lueckenfueller.reduce(state, { ...skipBen, by: host.id }, [host])).toBe(state);
  rerender(renderGame(lueckenfueller, state, [host, ben], ben));
  expect(screen.getByRole('button', { name: /Noch .* wählen/ })).toBeInTheDocument();
});

it.each(absences)('Lückenfüller nennt den Richter in der Warteliste, wenn er $reason ist', ({ players }) => {
  const state = { ...lueckenfueller.createState(roster), judgeId: ben.id, played: { host: [5] } };
  render(renderGame(lueckenfueller, state, players, host));
  expect(screen.getByText('Ben (nicht da)').closest('.waiting')).toHaveTextContent('Warten auf');
  expect(screen.getByRole('button', { name: 'Ben überspringen' })).toBeEnabled();
});

checkSkip(werBinIch, 'Kategorie', () => ({
  ...werBinIch.createState(roster), chooser: ben.id, chose: [host.id],
}), (next, before, players) => {
  expect(next).toMatchObject({ phase: 'pick', chooser: guest.id, round: before.round, losses: {} });
  expect(werBinIch.reduce(next, { type: 'pick', by: guest.id, text: 'Brettspiele' }, players).phase).toBe('write');
});

it('Wer bin ich zeigt die Kategorieauswahl erst wieder ab zwei anwesenden Personen', () => {
  const state = werBinIch.createState([host, ben]);
  const { rerender } = render(renderGame(werBinIch, state, [host], host));
  expect(screen.getByText('Warten auf eine zweite Person.')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Würfeln/ })).not.toBeInTheDocument();
  expect(werBinIch.reduce(state, { type: 'pick', by: host.id, text: 'Brettspiele' }, [host])).toBe(state);
  rerender(renderGame(werBinIch, state, [host, ben], host));
  expect(screen.getByRole('button', { name: /Würfeln/ })).toBeEnabled();
});
