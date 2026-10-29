import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { render } from '../../test/render';
import { GameFrame } from './GameFrame';
import { GAMES } from '../registry';
import { useLocation } from 'react-router-dom';
import { PartyCtx, type PartyValue } from '../../features/party/PartyContext';
import type { GamePlayer } from '../types';
import { usePlayer } from '../../store/player';
import { findDrink } from '../../engine/drinks';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

const me: GamePlayer = { id: 'p0', name: 'Mira', color: 'blue', online: true };
const drinkName = () => findDrink(usePlayer.getState().currentDrinkId, []).name;

function Location() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

function mount(otherBuild: boolean, gameId?: string) {
  const party = { mode: 'online', players: [me], me, otherBuild, gameId } as unknown as PartyValue;
  render(
    <PartyCtx.Provider value={party}>
      <GameFrame title="Test" accent="var(--blue)" onQuit={() => {}}>
        <p>Inhalt</p>
      </GameFrame>
      <Location />
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

describe('Spielkopf-Menü', () => {
  it('zeigt die vier Wege in Reihenfolge und öffnet die Regeln des Spiels', () => {
    const game = GAMES[0];
    mount(false, game.id);
    expect(screen.queryByRole('button', { name: 'Einwegkamera' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Anderes Getränk/ })).toBeNull();
    expect(document.querySelector('.game')).not.toHaveClass('korn');
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Anderes Getränk eintragen',
      'Einwegkamera',
      'Regeln',
      `Einstellungen${drinkName()}`,
    ]);
    fireEvent.click(items[2]);
    const rules = screen.getByRole('dialog', { name: 'Regeln' });
    expect(
      within(rules)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(game.howTo);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it.each([undefined, 'unknown'])('lässt Regeln ohne bekanntes Spiel weg (%s)', (id) => {
    mount(false, id);
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    expect(screen.queryByRole('menuitem', { name: 'Regeln' })).toBeNull();
  });

  it('schließt bei Tipp daneben und Escape', () => {
    mount(false);
    const more = screen.getByRole('button', { name: 'Mehr' });
    fireEvent.click(more);
    fireEvent.pointerDown(screen.getByText('Inhalt'));
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(more);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(more).toHaveFocus();
  });

  it('öffnet das volle Eintragen', () => {
    mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Anderes Getränk eintragen' }));
    expect(screen.getByRole('dialog', { name: 'Getränk eintragen' })).toBeInTheDocument();
  });

  it('navigiert zur Einwegkamera', () => {
    mount(false);
    fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Einwegkamera' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/kamera');
  });
});

it('öffnet die Einstellungen mit den verfügbaren Optionen', () => {
  const party = { mode: 'online', players: [me], me } as unknown as PartyValue;
  render(
    <PartyCtx.Provider value={party}>
      <GameFrame
        title="Spiel"
        accent="var(--blue)"
        onQuit={() => {}}
        heat={{ value: 2, onChange: () => {} }}
        spicy={{ gameId: GAMES[0].id, onChange: () => {} }}
      >
        Inhalt
      </GameFrame>
    </PartyCtx.Provider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mehr' }));
  const settings = screen.getByRole('menuitem', { name: /Einstellungen/ });
  expect(settings).toHaveTextContent(`Härte · Spicy · ${drinkName()}`);
  fireEvent.click(settings);
  expect(screen.getByRole('dialog', { name: 'Deine Einstellungen' })).toBeInTheDocument();
});

describe('Beenden-Knopf online', () => {
  function mountAs(isHost: boolean) {
    const party = { mode: 'online', players: [me], me, isHost } as unknown as PartyValue;
    render(
      <PartyCtx.Provider value={party}>
        <GameFrame title="Test" accent="var(--blue)" onQuit={() => {}}>
          <p>Inhalt</p>
        </GameFrame>
      </PartyCtx.Provider>,
    );
  }

  it('lässt Gäste nur selbst verlassen', () => {
    mountAs(false);
    fireEvent.click(screen.getByRole('button', { name: 'Spiel verlassen' }));
    expect(screen.getByRole('button', { name: 'Verlassen' })).toBeInTheDocument();
    expect(screen.getByText(/Die anderen spielen weiter/)).toBeInTheDocument();
  });

  it('lässt den Host die Runde für alle beenden', () => {
    mountAs(true);
    fireEvent.click(screen.getByRole('button', { name: 'Spiel beenden' }));
    expect(screen.getByRole('button', { name: 'Beenden' })).toBeInTheDocument();
    expect(screen.getByText(/für die ganze Runde/)).toBeInTheDocument();
  });
});
