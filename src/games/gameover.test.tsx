import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GameOver } from './shared/GameOver';
import { PartyCtx, type PartyValue } from '../features/party/PartyContext';
import type { GamePlayer } from './types';

const spieler = (id: string, name: string): GamePlayer => ({ id, name, color: 'blue', online: true });
const a = spieler('p0', 'Anna');
const b = spieler('p1', 'Ben');

// GameOver zieht ueber DrinkCall den Party-Kontext, auch ohne finalCall.
const ctx = {
  me: a,
  players: [a, b],
  logSipsFor: () => {},
} as unknown as PartyValue;

const zeige = (props: Parameters<typeof GameOver>[0]) =>
  render(
    <PartyCtx.Provider value={ctx}>
      <GameOver {...props} />
    </PartyCtx.Provider>,
  );

describe('Abschlussbildschirm', () => {
  // Werte bewusst jenseits der Platzziffern 1 und 2, sonst prueft der Test
  // sich selbst aus.
  const liste = [
    { player: a, value: 7, unit: 'Niederlage' },
    { player: b, value: 4, unit: 'Niederlage' },
  ];

  it('zeigt Platzziffern, wenn oben der beste Wert steht', () => {
    zeige({ headline: 'Vorbei', ranking: liste, onAgain: () => {}, onQuit: () => {} });
    const raenge = [...document.querySelectorAll('.result-row__rank')].map((e) => e.textContent);
    expect(raenge).toEqual(['1', '2']);
  });

  it('laesst die Platzziffer weg, wenn oben der schlechteste Wert steht', () => {
    // Sonst liest sich „1" im Kreis als Sieg, obwohl dort der Verlierer steht.
    zeige({
      headline: 'Vorbei',
      ranking: liste,
      rankHighIsBad: true,
      rankingTitle: 'Wer am häufigsten danebenlag',
      onAgain: () => {},
      onQuit: () => {},
    });
    expect(document.querySelectorAll('.result-row__rank').length).toBe(0);
    expect(screen.getByText('Wer am häufigsten danebenlag')).toBeTruthy();
    expect(screen.getByText('Anna')).toBeTruthy();
  });

  it('bildet den Plural nicht mit angehaengtem n, wenn eine Form angegeben ist', () => {
    zeige({
      headline: 'Vorbei',
      ranking: [{ player: a, value: 3, unit: 'Verlust', unitPlural: 'Verluste' }],
      onAgain: () => {},
      onQuit: () => {},
    });
    expect(screen.getByText('Verluste')).toBeTruthy();
    expect(screen.queryByText('Verlustn')).toBeNull();
  });

  it('zeigt ohne Liste nur den Abschluss', () => {
    zeige({ headline: 'Zwei Runden durch.', onAgain: () => {}, onQuit: () => {} });
    expect(screen.getByText('Zwei Runden durch.')).toBeTruthy();
    expect(screen.getByText('Noch eine Runde')).toBeTruthy();
    expect(screen.getByText('Zurück zur Lobby')).toBeTruthy();
  });
});
