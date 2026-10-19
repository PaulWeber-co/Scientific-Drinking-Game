import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { usePlayer } from '../../store/player';
import { DrinkPicker } from './DrinkPicker';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

function openForm() {
  const close = vi.fn();
  render(<DrinkPicker open onClose={close} />);
  fireEvent.click(screen.getByRole('button', { name: '+ Getränk selbst anlegen' }));
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Hausdrink' } });
  return close;
}

beforeEach(() => {
  usePlayer.setState({ customDrinks: [], currentDrinkId: 'beer-pils' });
});

describe('Eigenes Getränk', () => {
  it.each(['', '0', '-20', '1001'])('speichert kein ungültiges Volumen %s', (value) => {
    const close = openForm();
    fireEvent.change(screen.getByLabelText('Volumen (ml)'), { target: { value } });
    const add = screen.getByRole('button', { name: 'Hinzufügen und auswählen' });

    expect(add).toBeDisabled();
    fireEvent.click(add);
    expect(usePlayer.getState().customDrinks).toHaveLength(0);
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByText(/Bitte ein Volumen zwischen/)).toBeInTheDocument();
  });

  it.each(['', '0', '-2', '61'])('speichert keinen ungültigen Alkoholgehalt %s', (value) => {
    openForm();
    fireEvent.change(screen.getByLabelText('Vol.-%'), { target: { value } });

    expect(screen.getByRole('button', { name: 'Hinzufügen und auswählen' })).toBeDisabled();
    expect(screen.getByText(/Bitte einen Alkoholgehalt/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('speichert gültige Werte genau wie in der Vorschau und wählt das Getränk aus', () => {
    const close = openForm();
    fireEvent.change(screen.getByLabelText('Volumen (ml)'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Vol.-%'), { target: { value: '37.5' } });
    expect(screen.getByText('Ergibt 11,8 g reinen Alkohol pro Glas.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen und auswählen' }));

    const [drink] = usePlayer.getState().customDrinks;
    expect(drink).toMatchObject({ name: 'Hausdrink', defaultVolumeMl: 40, abvPercent: 37.5, sipSizeMl: 40 });
    expect(usePlayer.getState().currentDrinkId).toBe(drink.id);
    expect(close).toHaveBeenCalledOnce();
  });
});
