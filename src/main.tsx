import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { UpdateBanner } from './app/UpdateBanner';
import { initSound } from './lib/sound';
import { initViewportFill } from './lib/viewportFill';
import './styles/global.css';
import './styles/game.css';

// Vor dem ersten Bild: sonst springt die Tab-Leiste beim Start sichtbar.
initViewportFill();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
  </StrictMode>,
);

// Klaenge wachen an der ersten Geste auf und nach jeder Rueckkehr aus dem
// Hintergrund. Ohne den zweiten Fall ist die App nach dem ersten Anruf stumm.
initSound();
