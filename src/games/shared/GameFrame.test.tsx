import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../test/render';
import { GameFrame } from './GameFrame';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

const me: GamePlayer = { id: 'p0', name: 'Mira', color: 'blue', online: true };

function mount(otherBuild: boolean) {
  const party = { mode: 'online', players: [me], me, otherBuild } as unknown as PartyValue;
  render(
    <PartyCtx.Provider value={party}>
      <GameFrame title="Test" accent="var(--blue)" onQuit={() => {}}>
        <p>Inhalt</p>
      </GameFrame>
    </PartyCtx.Provider>,
  );
}

describe('GameFrame: verschiedene App-Stände', () => {
  it('weist darauf hin, wenn der Host anderen Spielcode hat', () => {
    mount(true);
    expect(screen.getByRole('status').textContent).toMatch(/verschiedenen App-Versionen/);
  });

  it('schweigt bei gleichem Stand', () => {
    mount(false);
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Fingerabdruck der Spiellogik', () => {
  it('ist im Build gesetzt', () => {
    expect(__GAME_BUILD__).toMatch(/^[0-9a-f]{12}$/);
  });
});
