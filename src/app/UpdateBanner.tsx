import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Hinweis, wenn der Service Worker eine neue Version bereithält. Bewusst
 * ein Banner mit Knopf statt stillem Neuladen: eine laufende Runde darf
 * nicht mitten im Spiel verschwinden (web.dev, PWA-Update-Leitfaden).
 */
export function UpdateBanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (e) => console.error('Service Worker nicht registriert', e),
  });

  // Beim allerersten Start kommt „offline bereit" mitten im Onboarding –
  // dort hat der Satz keinen Bezug und wird still verworfen.
  useEffect(() => {
    if (offlineReady && location.hash.startsWith('#/onboarding')) setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh) {
    return (
      <div className="updatebar" role="status">
        <span className="grow t-headline">Neue Version verfügbar.</span>
        <button className="btn btn--sm btn--brand" onClick={() => updateServiceWorker(true)}>
          Neu laden
        </button>
        <button className="btn btn--sm btn--plain" onClick={() => setNeedRefresh(false)}>
          Später
        </button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="updatebar" role="status">
        <span className="grow t-headline">Funktioniert jetzt auch ohne Netz.</span>
        <button className="btn btn--sm btn--plain" onClick={() => setOfflineReady(false)}>
          OK
        </button>
      </div>
    );
  }
  return null;
}
