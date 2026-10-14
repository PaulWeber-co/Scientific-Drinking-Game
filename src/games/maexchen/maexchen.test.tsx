import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import { maexchen } from './index';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { usePlayer, defaultProfile } from '../../store/player';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('../../lib/sound', () => ({ sound: vi.fn() }));

/**
 * Würfelbecher (User-Entscheid 2026-10-14): angesagt wird laut, die App ist
 * nur der Becher. Nach dem Aufdecken urteilt ein Tipp, wer trinkt.
 */

type State = ReturnType<typeof maexchen.createState>;

const me: GamePlayer = { id: 'p0', name: 'Mira', color: 'blue', online: true };
const ben: GamePlayer = { id: 'p1', name: 'Ben', color: 'pink', online: true };
const roster = [me, ben];

function base(patch: Partial<State> = {}): State {
  return { ...maexchen.createState(roster), order: ['p0', 'p1'], turnIndex: 0, ...patch };
}

function mount(patch: Partial<State>, online = false, who = me, isHost = true) {
  const state = base({ phase: 'look', ...patch });
  const party = { mode: online ? 'online' : 'local', players: roster, me: who } as unknown as PartyValue;
  const Game = maexchen.Component;
  return render(
    <PartyCtx.Provider value={party}>
      <Game state={state} players={roster} me={who} isHost={isHost} online={online} dispatch={() => {}} quit={() => {}} />
    </PartyCtx.Provider>,
  );
}

const act = (s: State, type: string, extra: Record<string, unknown> = {}) =>
  maexchen.reduce(s, { type, by: 'p0', ...extra }, roster);

beforeEach(() => {
  usePlayer.setState({ profile: { ...defaultProfile(), name: me.name }, currentDrinkId: 'beer-pils', log: [] });
});

describe('Mäxchen: Würfelbecher', () => {
  it('würfeln, ansehen, weitergeben, glauben – der Nächste würfelt', () => {
    let s = act(base(), 'roll');
    expect(s.phase).toBe('look');
    expect(s.dice).not.toBeNull();
    s = act(s, 'pass');
    expect(s.phase).toBe('decide');
    s = act(s, 'believe');
    expect(s.phase).toBe('roll');
    expect(s.turnIndex).toBe(1);
    expect(s.dice).toBeNull();
  });

  it('nach dem Aufdecken entscheidet „Gelogen“ gegen den Ansager, „Stimmt“ gegen den Zweifler', () => {
    const offen = act(base({ phase: 'decide', dice: [4, 3] }), 'doubt');
    expect(offen.phase).toBe('reveal');
    expect(offen.reveal).toEqual({ dice: [4, 3], loserId: null, believedMaexchen: false });

    const gelogen = act(offen, 'judge', { lied: true });
    expect(gelogen.reveal?.loserId).toBe('p0');
    expect(gelogen.losses).toEqual({ p0: 1 });

    const stimmt = act(offen, 'judge', { lied: false });
    expect(stimmt.reveal?.loserId).toBe('p1');
  });

  it('urteilt je Aufdecken nur einmal', () => {
    const offen = act(base({ phase: 'decide', dice: [4, 3] }), 'doubt');
    const einmal = act(offen, 'judge', { lied: true });
    expect(act(einmal, 'judge', { lied: false })).toBe(einmal);
  });

  it('wer ein Mäxchen glaubt, verliert die Runde', () => {
    const s = act(base({ phase: 'decide', dice: [6, 6] }), 'believeMaexchen');
    expect(s.phase).toBe('reveal');
    expect(s.reveal).toEqual({ dice: null, loserId: 'p1', believedMaexchen: true });
    expect(s.losses).toEqual({ p1: 1 });
  });

  it('neue Runde erst nach dem Urteil, der Verlierer fängt an', () => {
    const offen = act(base({ phase: 'decide', dice: [4, 3] }), 'doubt');
    expect(act(offen, 'nextRound')).toBe(offen);
    const weiter = act(act(offen, 'judge', { lied: false }), 'nextRound');
    expect(weiter.phase).toBe('roll');
    expect(weiter.round).toBe(2);
    expect(weiter.turnIndex).toBe(1);
  });

  it('zeigt dem Würfelnden zwei Würfel und den Namen des Wurfs', () => {
    mount({ dice: [2, 1] });
    expect(screen.getAllByLabelText(/^Würfel \d$/)).toHaveLength(2);
    expect(screen.getByText('Mäxchen', { selector: '.t-title2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Angesagt – weitergeben' })).toBeEnabled();
  });

  it('verrät online den Wurf nicht an die anderen', () => {
    mount({ dice: [2, 1] }, true, ben, false);
    expect(screen.queryAllByLabelText(/^Würfel \d$/)).toHaveLength(0);
    expect(screen.queryByText('Mäxchen', { selector: '.t-title2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Angesagt – weitergeben' })).toBeDisabled();
  });

  it('nach dem Aufdecken urteilt online nur, wer entschieden hat, oder der Host', () => {
    const reveal = { dice: [4, 3] as [number, number], loserId: null, believedMaexchen: false };
    mount({ phase: 'reveal', reveal }, true, me, false);
    expect(screen.getByRole('button', { name: /Gelogen – Mira trinkt/ })).toBeDisabled();
  });

  it('Urteil-Knöpfe nennen, wer trinkt', () => {
    const reveal = { dice: [4, 3] as [number, number], loserId: null, believedMaexchen: false };
    mount({ phase: 'reveal', reveal });
    expect(within(screen.getByRole('button', { name: /Gelogen/ })).getByText(/Mira trinkt/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Stimmt – Ben trinkt/ })).toBeEnabled();
  });
});
