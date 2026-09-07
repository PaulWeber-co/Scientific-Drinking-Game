import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PassDevice } from './PassDevice';
import type { GamePlayer } from '../types';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

const anna: GamePlayer = { id: 'p1', name: 'Anna', color: 'pink', online: true };

/**
 * Der Uebergabe-Bildschirm ist das Schutzschild zwischen zwei Geheimnissen.
 * Er haengt an mehreren Spielen, hatte aber keinen eigenen Vertragstest -
 * geprueft wurde er nur indirekt, in unterschiedlicher Schaerfe.
 */
describe('Übergabe des Handys', () => {
  it('nennt die Person beim Namen, im Knopf und darüber', () => {
    // Der Knopf traegt den Namen: er ist Bestaetigung und Ansage zugleich.
    // Stuende dort nur „Weiter", koennte die falsche Person schauen.
    render(<PassDevice player={anna} step={2} total={4} onConfirm={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ich bin Anna' })).toBeTruthy();
    expect(screen.getByText('Anna')).toBeTruthy();
  });

  it('sagt, der wievielte von wie vielen es ist', () => {
    // Ohne das weiss niemand, wie lange das Weiterreichen noch dauert.
    render(<PassDevice player={anna} step={2} total={4} onConfirm={() => {}} />);
    expect(screen.getByText('2 von 4')).toBeTruthy();
  });

  it('warnt die anderen ausdrücklich', () => {
    render(<PassDevice player={anna} step={1} total={3} onConfirm={() => {}} />);
    expect(screen.getByText(/nicht mitlesen/i)).toBeTruthy();
  });

  it('meldet genau einmal, wenn bestätigt wird', () => {
    const weiter = vi.fn();
    render(<PassDevice player={anna} step={1} total={3} onConfirm={weiter} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ich bin Anna' }));
    expect(weiter).toHaveBeenCalledTimes(1);
  });

  it('zeigt kein Geheimnis — nur den Namen', () => {
    // Gegenprobe zur Rolle des Bauteils: haette es Inhalt, waere es kein
    // Schutzschild mehr, sondern selbst ein Leck.
    const { container } = render(
      <PassDevice player={anna} step={1} total={3} onConfirm={() => {}} />,
    );
    expect(container.textContent).not.toMatch(/wort|zahl|karte/i);
  });
});
