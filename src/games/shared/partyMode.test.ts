import { describe, expect, it } from 'vitest';
import { defaultProfile } from '../../store/player';
import type { GamePlayer } from '../types';
import { hasOnlineGuests } from './partyMode';

const host: GamePlayer = { id: 'host', name: 'Anna', color: 'blue', online: true, isHost: true };
const onlineGuest: GamePlayer = { id: 'guest', name: 'Ben', color: 'pink', online: true, isHost: false };

describe('Spielerliste aus der Lobby', () => {
  it('erkennt ein geteiltes Handy mit lokalem Gast', () => {
    const guest: GamePlayer = {
      id: 'local', name: 'Ben', color: 'pink', online: true,
      local: { profile: defaultProfile(), drinkId: 'beer-pils', log: [] },
    };
    expect(hasOnlineGuests([host, guest])).toBe(false);
  });

  it('erkennt eine Online-Runde auch bei kurz getrenntem Gast', () => {
    expect(hasOnlineGuests([host, { ...onlineGuest, online: false }])).toBe(true);
  });

  it('erkennt eine Online-Runde ohne Host-Eintrag', () => {
    expect(hasOnlineGuests([onlineGuest])).toBe(true);
  });

  it('findet in einer leeren Liste oder beim Host allein keine Online-Gäste', () => {
    expect(hasOnlineGuests([])).toBe(false);
    expect(hasOnlineGuests([host])).toBe(false);
  });
});
