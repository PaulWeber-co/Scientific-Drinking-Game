import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { UpdateBanner } from './app/UpdateBanner';
import { initSound } from './lib/sound';
import { initViewportFill } from './lib/viewportFill';
import { framedByOtherSite } from './security/frameGuard';
import './styles/global.css';
import './styles/game.css';

// Vor dem ersten Bild: sonst springt die Tab-Leiste beim Start sichtbar.
initViewportFill();

const root = createRoot(document.getElementById('root')!);
if (framedByOtherSite()) {
  // Clickjacking: in einem fremden Rahmen keine bedienbare App, nur der Weg
  // hinaus (frame-ancestors ist auf GitHub Pages nicht setzbar).
  root.render(
    <p style={{ padding: 24 }}>
      <a href={window.location.href} target="_blank" rel="noopener noreferrer">
        Pegel in einem eigenen Fenster öffnen
      </a>
    </p>,
  );
} else {
  root.render(
    <StrictMode>
      <App />
      <UpdateBanner />
    </StrictMode>,
  );
}

// Klaenge wachen an der ersten Geste auf und nach jeder Rueckkehr aus dem
// Hintergrund. Ohne den zweiten Fall ist die App nach dem ersten Anruf stumm.
initSound();
