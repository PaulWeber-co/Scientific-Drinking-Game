import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { UpdateBanner } from './app/UpdateBanner';
import './styles/global.css';
import './styles/game.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
  </StrictMode>,
);
