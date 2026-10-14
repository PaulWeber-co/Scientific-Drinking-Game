import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { render } from '../../test/render';
import { neverHaveIEver } from './index';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import { usePlayer, defaultProfile } from '../../store/player';
import type { GameActionInput, GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

/**
 * Online-Selbstauskunft (User-Entscheid 2026-10-14): alle sehen die
 * Antworten, die nächste Karte kommt erst, wenn alle geantwortet haben, und
 * weiterschalten kann nur der Host.
 */

type State = ReturnType<typeof neverHaveIEver.createState>;

const host: GamePlayer = { id: 'h', name: 'Toby', color: 'blue', online: true, isHost: true };
const jane: GamePlayer = { id: 'j', name: 'Jane', color: 'pink', online: true, isHost: false };
const eva: GamePlayer = { id: 'e', name: 'Eva', color: 'green', online: true, isHost: false };
const roster = [host, jane, eva];

const act = (s: State, type: string, by: string, extra: Record<string, unknown> = {}) =>
  neverHaveIEver.reduce(s, { type, by, at: 0, ...extra }, roster);

function mount(state: State, who: GamePlayer, players = roster) {
  const sent: GameActionInput[] = [];
  const party = { mode: 'online', players, me: who } as unknown as PartyValue;
  const Game = neverHaveIEver.Component;
  render(
    <PartyCtx.Provider value={party}>
      <Game
        state={state}
        players={players}
        me={who}
        isHost={who.isHost === true}
        online
        dispatch={(a) => sent.push(a)}
        quit={() => {}}
      />
    </PartyCtx.Provider>,
  );
  return sent;
}

beforeEach(() => {
  usePlayer.setState({ profile: { ...defaultProfile(), name: 'Toby' }, currentDrinkId: 'beer-pils', log: [] });
});

describe('Ich hab noch nie online', () => {
  it('sammelt die Antworten je Gerät', () => {
    let s = neverHaveIEver.createState(roster);
    s = act(s, 'declare', 'j', { answer: 'yes' });
    s = act(s, 'declare', 'e', { answer: 'no' });
    expect(s.declared).toEqual({ j: 'yes', e: 'no' });
  });

  it('nur der Host schaltet weiter', () => {
    const s = act(neverHaveIEver.createState(roster), 'declare', 'j', { answer: 'yes' });
    expect(act(s, 'next', 'j')).toBe(s);
    const weiter = act(s, 'next', 'h');
    expect(weiter.drawn).not.toEqual(s.drawn);
    expect(weiter.declared).toEqual({});
  });

  it('leert die Antworten, wenn die Härte eine neue Karte bringt', () => {
    const s = act(neverHaveIEver.createState(roster), 'declare', 'j', { answer: 'yes' });
    const neu = act(s, 'setHeat', 'h', { heat: 2 });
    expect(neu.drawn).not.toBeNull();
    expect(neu.declared).toEqual({});
  });

  it('zeigt, auf wen noch gewartet wird, und gibt dem Gast keinen Weiter-Knopf', () => {
    const s = act(neverHaveIEver.createState(roster), 'declare', 'j', { answer: 'no' });
    mount(s, jane);
    expect(screen.getByText('Warten auf')).toBeTruthy();
    expect(screen.getByText('Toby, Eva')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Nächste Karte|weiter/ })).toBeNull();
  });

  it('der Host kann vorziehen, solange noch jemand fehlt', () => {
    const sent = mount(neverHaveIEver.createState(roster), host);
    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr warten – weiter' }));
    expect(sent).toEqual([{ type: 'next' }]);
  });

  it('wenn alle geantwortet haben, sehen alle, wer es getan hat', () => {
    let s = neverHaveIEver.createState(roster);
    s = act(s, 'declare', 'h', { answer: 'no' });
    s = act(s, 'declare', 'j', { answer: 'yes' });
    s = act(s, 'declare', 'e', { answer: 'yes' });
    mount(s, eva);
    const antworten = screen.getByLabelText('Antworten');
    expect(antworten.textContent).toBe('Hab ichJJaneEEvaNie gemachtTToby');
    expect(screen.getByText('Toby schaltet weiter.')).toBeTruthy();
  });

  it('wer offline ist, hält die Karte nicht auf', () => {
    const weg = { ...eva, online: false };
    let s = neverHaveIEver.createState(roster);
    s = act(s, 'declare', 'h', { answer: 'no' });
    s = act(s, 'declare', 'j', { answer: 'no' });
    mount(s, host, [host, jane, weg]);
    expect(screen.getByRole('button', { name: 'Nächste Karte' })).toBeTruthy();
  });
});
