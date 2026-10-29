import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AvatarPicker } from './AvatarPicker';

vi.mock('../../lib/haptics', () => ({ haptic: vi.fn() }));

const FOTO = 'data:image/jpeg;base64,AAAA';
const picker = (photo: string | undefined, shared: boolean) => {
  const onPhoto = vi.fn();
  const onShared = vi.fn();
  render(
    <AvatarPicker
      name="Anna"
      color="blue"
      photo={photo}
      shared={shared}
      onColor={vi.fn()}
      onPhoto={onPhoto}
      onShared={onShared}
    />,
  );
  return { onPhoto, onShared };
};

describe('Profilbild für Mitspieler', () => {
  it('bietet den Schalter erst mit Bild an', () => {
    picker(undefined, false);
    expect(screen.queryByRole('switch', { name: 'Für Mitspieler sichtbar' })).toBeNull();
  });

  it('steht ohne Zustimmung auf aus', () => {
    picker(FOTO, false);
    expect(screen.getByRole('switch', { name: 'Für Mitspieler sichtbar' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('nimmt beim Entfernen des Bildes auch die Freigabe zurück', () => {
    const { onPhoto, onShared } = picker(FOTO, true);
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(onPhoto).toHaveBeenCalledWith(undefined);
    expect(onShared).toHaveBeenCalledWith(false);
  });
});
