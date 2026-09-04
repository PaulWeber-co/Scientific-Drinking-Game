import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const hook = vi.hoisted(() => ({
  needRefresh: false,
  offlineReady: false,
  setNeedRefresh: vi.fn(),
  setOfflineReady: vi.fn(),
  updateServiceWorker: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [hook.needRefresh, hook.setNeedRefresh],
    offlineReady: [hook.offlineReady, hook.setOfflineReady],
    updateServiceWorker: hook.updateServiceWorker,
  }),
}));

import { UpdateBanner } from './UpdateBanner';

describe('Update-Hinweis', () => {
  it('zeigt ohne neue Version nichts', () => {
    const { container } = render(<UpdateBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('bietet bei neuer Version „Neu laden“ an und lädt erst auf Tipp', () => {
    hook.needRefresh = true;
    render(<UpdateBanner />);
    expect(screen.getByText('Neue Version verfügbar.')).toBeInTheDocument();
    expect(hook.updateServiceWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));
    expect(hook.updateServiceWorker).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Später' }));
    expect(hook.setNeedRefresh).toHaveBeenCalledWith(false);
    hook.needRefresh = false;
  });

  it('meldet einmal, dass es offline geht', () => {
    hook.offlineReady = true;
    render(<UpdateBanner />);
    expect(screen.getByText('Funktioniert jetzt auch ohne Netz.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(hook.setOfflineReady).toHaveBeenCalledWith(false);
    hook.offlineReady = false;
  });
});
