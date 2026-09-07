/**
 * Hält den Bildschirm an, solange ein Spiel läuft.
 *
 * Ein Trinkspiel liegt zwischen zwei Zügen auf dem Tisch. Ohne diese Sperre
 * dimmt das Handy nach dem Systemtakt und sperrt sich – wer wieder dran ist,
 * entsperrt erst einmal.
 *
 * Die Sperre gibt das System von sich aus frei, sobald die Seite in den
 * Hintergrund geht (Anruf, App-Wechsel). Deshalb wird sie beim Zurückkommen
 * neu angefordert; ohne das wäre sie nach dem ersten Wechsel für den Rest des
 * Abends weg.
 *
 * Web-API statt Capacitor-Plugin: sie trägt in Safari ab iOS 16.4 und damit
 * auch im nativen Container, funktioniert aber genauso im Browser. Wo es sie
 * nicht gibt, passiert nichts – kein Fehler, nur der Systemtakt.
 */
export function keepScreenAwake(): () => void {
  const api = navigator.wakeLock as Navigator['wakeLock'] | undefined;
  if (!api) return () => {};

  let sentinel: WakeLockSentinel | null = null;
  let wanted = true;
  let pending = false;

  const acquire = async () => {
    if (!wanted || pending || document.visibilityState !== 'visible') return;
    // `released` statt nur `sentinel !== null`: gibt das System die Sperre von
    // sich aus frei, kann das `release`-Ereignis nach dem Sichtbarkeitswechsel
    // eintreffen. Dann stünde hier noch der alte, längst ungültige Sentinel
    // und die Sperre käme diesen Zyklus nicht zurück.
    if (sentinel && !sentinel.released) return;
    pending = true;
    try {
      const next = await api.request('screen');
      // Zwischen `await` und hier kann das Spiel schon beendet sein.
      if (!wanted) {
        void next.release().catch(() => {});
        return;
      }
      sentinel = next;
      next.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {
      /* Akku-Sparmodus oder fehlende Freigabe – dann eben nicht. */
    } finally {
      pending = false;
    }
  };

  const onVisibility = () => void acquire();
  document.addEventListener('visibilitychange', onVisibility);
  void acquire();

  return () => {
    wanted = false;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release().catch(() => {});
    sentinel = null;
  };
}
