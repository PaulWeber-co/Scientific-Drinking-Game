import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileScreen } from './ProfileScreen';
import { defaultProfile, usePlayer } from '../../store/player';

function renderProfile() {
  return render(
    <MemoryRouter>
      <ProfileScreen />
    </MemoryRouter>,
  );
}

describe('Körpergröße im Profil', () => {
  beforeEach(() => {
    usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul' }, onboarded: true });
  });

  it('zeigt ohne Angabe keinen Wert und rechnet mit dem Standardwert', () => {
    renderProfile();
    expect(screen.queryByText('175')).toBeNull();
    expect(screen.queryByText('cm')).toBeNull();
    expect(screen.getByText(/Standardwert/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Körpergröße angeben (genauer)' })).toBeInTheDocument();
  });

  it('rechnet nach Watson, sobald die Größe angegeben ist – und zeigt genau diesen Wert', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: '+ Körpergröße angeben (genauer)' }));
    expect(usePlayer.getState().profile?.heightCm).toBe(175);
    expect(screen.getByText('175')).toBeInTheDocument();
    expect(screen.getByText(/Watson/)).toBeInTheDocument();
  });

  it('lässt sich wieder entfernen und fällt auf den Standardwert zurück', () => {
    usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul', heightCm: 176 } });
    renderProfile();
    expect(screen.getByText(/Watson/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Körpergröße rechnen' }));
    expect(usePlayer.getState().profile?.heightCm).toBeUndefined();
    expect(screen.queryByText('176')).toBeNull();
    expect(screen.getByText(/Standardwert/)).toBeInTheDocument();
  });
});

describe('Alkoholfrei und Fahren im Profil', () => {
  beforeEach(() => {
    usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul' }, onboarded: true });
  });

  it('fahren schaltet alkoholfrei mit ein', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'Ich fahre heute' }));
    expect(usePlayer.getState().profile).toMatchObject({ designatedDriver: true, alcoholFree: true });
    expect(screen.getByRole('switch', { name: 'Alkoholfrei' })).toHaveAttribute('aria-checked', 'true');
  });

  it('alkoholfrei aus schaltet fahren mit aus – die Schalter zeigen, was gilt', () => {
    usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul', designatedDriver: true, alcoholFree: true } });
    renderProfile();
    fireEvent.click(screen.getByRole('switch', { name: 'Alkoholfrei' }));
    expect(usePlayer.getState().profile).toMatchObject({ designatedDriver: false, alcoholFree: false });
    expect(screen.getByRole('switch', { name: 'Ich fahre heute' })).toHaveAttribute('aria-checked', 'false');
  });

  it('lässt nach dem alkoholfreien Einstieg die Angaben und Spielweise im Profil ergänzen', () => {
    usePlayer.setState({
      profile: { ...defaultProfile(), name: 'Lea', alcoholFree: true },
      currentDrinkId: 'soft',
    });
    renderProfile();
    expect(screen.getByText(/Für alkoholfreies Mitspielen brauchst du keine Körperdaten/)).toBeInTheDocument();
    expect(screen.getByText('Gewicht')).toBeInTheDocument();
    expect(screen.getByText('Magen')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Zielpegel' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Alkoholfrei' }));
    expect(usePlayer.getState().profile?.alcoholFree).toBe(false);
    // Die Entscheidung für ein alkoholisches Getränk bleibt ausdrücklich.
    expect(usePlayer.getState().currentDrinkId).toBe('soft');
    expect(screen.queryByText(/Für alkoholfreies Mitspielen brauchst du keine Körperdaten/)).not.toBeInTheDocument();
  });
});

it('beschriftet den Spitznamen und speichert Änderungen', () => {
  usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul' } });
  renderProfile();
  const input = screen.getByLabelText('Spitzname');
  expect(input).toHaveValue('Paul');
  fireEvent.change(input, { target: { value: 'Lea' } });
  expect(usePlayer.getState().profile?.name).toBe('Lea');
});
