import { HashRouter } from 'react-router-dom';
import { Router } from './Router';
import { PartyProvider } from '../features/party/PartyContext';
import { ErrorBoundary } from './ErrorBoundary';
import { NightTracker } from '../features/bac/NightTracker';
import { ResumeOnlineRound } from '../features/party/ResumeOnlineRound';
import { useAndroidBackButton } from './androidBack';

function AndroidBackButton() {
  useAndroidBackButton();
  return null;
}

/**
 * HashRouter statt BrowserRouter: GitHub Pages liefert nur statische Dateien
 * aus und kann keine Deep-Links auf index.html umschreiben. Mit Hash-Routing
 * funktionieren geteilte Links und Reloads überall gleich.
 */
export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <PartyProvider>
          <NightTracker />
          <AndroidBackButton />
          <ResumeOnlineRound />
          <Router />
        </PartyProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
