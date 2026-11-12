import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    fireEvent.click(screen.getByText('Körperwerte ▸'));
    expect(screen.getByText('Gewicht')).toBeVisible();
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

it('ordnet Spielmodus und App vor den alkoholfrei eingeklappten Körperwerten an', () => {
  usePlayer.setState({ profile: { ...defaultProfile(), alcoholFree: true } });
  renderProfile();
  const body = screen.getByText('Körperwerte ▸').closest('details')!;
  expect(body).not.toHaveAttribute('open');
  const mode = screen.getByRole('switch', { name: 'Alkoholfrei' });
  const vibration = screen.getByRole('switch', { name: 'Vibration' });
  expect(mode.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(vibration.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByText('Körperwerte ▸'));
  expect(body).toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: /Gewicht erhöhen/ }));
  expect(usePlayer.getState().profile?.weightKg).toBe(defaultProfile().weightKg + 1);
  expect(screen.getByRole('button', { name: 'System' })).toBeVisible();
});

describe('Glas mitneigen im Profil', () => {
  beforeEach(() => {
    localStorage.clear();
    usePlayer.setState({ profile: { ...defaultProfile(), name: 'Paul' }, onboarded: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('holt ein früheres Nein zurück und schaltet wieder aus', async () => {
    const permission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('DeviceOrientationEvent', Object.assign(class {}, { requestPermission: permission }));
    localStorage.setItem('pegel.tilt', 'denied');
    renderProfile();
    const toggle = screen.getByRole('switch', { name: 'Glas mitneigen' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(permission).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('pegel.tilt')).toBe('granted');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('pegel.tilt')).toBe('denied');
  });

  it('bleibt aus, wenn das System ablehnt', async () => {
    const permission = vi.fn().mockResolvedValue('denied');
    vi.stubGlobal('DeviceOrientationEvent', Object.assign(class {}, { requestPermission: permission }));
    renderProfile();
    const toggle = screen.getByRole('switch', { name: 'Glas mitneigen' });
    fireEvent.click(toggle);
    await waitFor(() => expect(permission).toHaveBeenCalled());
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('pegel.tilt')).toBe('denied');
  });

  it('fehlt ohne Lagesensor', () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    renderProfile();
    expect(screen.queryByRole('switch', { name: 'Glas mitneigen' })).toBeNull();
  });
});
