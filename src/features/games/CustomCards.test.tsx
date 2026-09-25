import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CustomCards } from './CustomCards';
import { meta } from '../../games/truth-or-dare/meta';
import { useCustomCards } from '../../store/cards';

beforeEach(() => {
  useCustomCards.setState({ byGame: {} });
});

const karten = () => useCustomCards.getState().byGame[meta.id] ?? [];

function anlegen(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Text der Karte …'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /Karte hinzufügen/ }));
}

describe('Eigene Karten', () => {
  it('speichert die Kategorie, die die Auswahl als gewählt zeigt', () => {
    // Ohne Antippen zeigt die Auswahl „Wahrheit" an. Vorher ging die Karte
    // trotzdem ohne Kategorie in den Stapel – und kam bei Pflicht mit.
    render(<CustomCards game={meta} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    expect(screen.getByRole('button', { name: 'Wahrheit' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    anlegen('Was war dein peinlichster Moment?');
    expect(karten()).toHaveLength(1);
    expect(karten()[0].mode).toBe('wahrheit');
  });

  it('übernimmt eine umgestellte Kategorie', () => {
    render(<CustomCards game={meta} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pflicht' }));
    anlegen('Mach zehn Liegestütze.');
    expect(karten()[0].mode).toBe('pflicht');
  });

  it('vergibt auch bei schnellem Anlegen verschiedene Kennungen', () => {
    // Vorher Zeitstempel in Millisekunden: zwei Karten in derselben
    // Millisekunde teilten sich die Kennung, Löschen nahm beide mit.
    const { add } = useCustomCards.getState();
    add(meta.id, { text: 'A' });
    add(meta.id, { text: 'B' });
    const [a, b] = karten();
    expect(a.id).not.toBe(b.id);
    useCustomCards.getState().remove(meta.id, a.id);
    expect(karten().map((c) => c.text)).toEqual(['B']);
  });
});
