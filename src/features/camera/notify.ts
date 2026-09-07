import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from '../../lib/platform';

/**
 * Erinnerung, wenn die Bilder fertig sind.
 *
 * Ohne sie schaut am nächsten Tag kaum jemand nach – der Moment, in dem der
 * Film entwickelt ist, ist der eigentliche zweite Teil des Features.
 *
 * Die Erlaubnis wird erst gefragt, wenn wirklich ein Bild wartet: ein
 * Berechtigungsdialog beim Start der App ohne erkennbaren Grund wird
 * reflexhaft weggetippt.
 */
const NOTICE_ID = 27;

export async function scheduleDevelopNotice(at: number): Promise<void> {
  if (!isNativeApp() || at <= Date.now()) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    const erlaubt =
      display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted';
    if (!erlaubt) return;

    // Immer dieselbe Kennung: ein zweites Bild soll die Nachricht ersetzen,
    // nicht eine weitere planen.
    await LocalNotifications.cancel({ notifications: [{ id: NOTICE_ID }] }).catch(() => {});
    await LocalNotifications.schedule({
      notifications: [
        {
          id: NOTICE_ID,
          title: 'Deine Fotos sind entwickelt',
          body: 'Der Film von gestern Abend ist fertig.',
          schedule: { at: new Date(at) },
        },
      ],
    });
  } catch {
    // Ohne Benachrichtigung funktioniert das Album trotzdem.
  }
}
