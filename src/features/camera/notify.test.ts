import { beforeEach, expect, it, vi } from 'vitest';

const plugin = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  cancel: vi.fn(() => Promise.resolve()),
  schedule: vi.fn(() => Promise.resolve({ notifications: [] })),
}));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));
vi.mock('../../lib/platform', () => ({ isNativeApp: () => true }));

const { scheduleDevelopNotice } = await import('./notify');

beforeEach(() => {
  vi.clearAllMocks();
  plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
});

it('plant den Foto-Hinweis ungenau – sonst öffnet Android die Wecker-Einstellungen', async () => {
  await scheduleDevelopNotice(Date.now() + 60_000);
  expect(plugin.schedule).toHaveBeenCalledOnce();
  const [{ notifications }] = plugin.schedule.mock.calls[0] as unknown as [
    { notifications: { isExactNotification?: boolean }[] },
  ];
  expect(notifications[0].isExactNotification).toBe(false);
});

it('plant nichts ohne Erlaubnis', async () => {
  plugin.checkPermissions.mockResolvedValue({ display: 'prompt' });
  plugin.requestPermissions.mockResolvedValue({ display: 'denied' });
  await scheduleDevelopNotice(Date.now() + 60_000);
  expect(plugin.schedule).not.toHaveBeenCalled();
});
