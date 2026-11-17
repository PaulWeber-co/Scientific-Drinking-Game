import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { UpdateBanner } from './app/UpdateBanner';
import { initNative } from './lib/native';
import { initSound } from './lib/sound';
import { initViewportFill } from './lib/viewportFill';
import { isAndroidApp } from './lib/platform';
import './styles/global.css';
import './styles/game.css';

// Vor dem ersten Bild: sonst springt die Tab-Leiste beim Start sichtbar.
initViewportFill();
// Android bekommt seine eigene Navigationsleiste (Material 3), mit anderer Höhe.
if (isAndroidApp()) document.documentElement.dataset.platform = 'android';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
  </StrictMode>,
);

// Nach dem Rendern: im Browser kehrt das sofort zurueck, in der nativen
// Huelle laedt es die Plugins nach. Kein `await` - der Start haengt nicht
// daran, und ein Fehler darf die App nicht aufhalten.
void initNative();

// Klaenge wachen an der ersten Geste auf und nach jeder Rueckkehr aus dem
// Hintergrund. Ohne den zweiten Fall ist die App nach dem ersten Anruf stumm.
initSound();
