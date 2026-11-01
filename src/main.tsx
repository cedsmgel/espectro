import React from 'react';
import ReactDOM from 'react-dom/client';
import App, { preloadRoute } from './App';
import { authStorage } from './lib/api';
import './index.css';
import { registerServiceWorker } from './lib/push';
import './lib/install';
import { startVitals } from './lib/vitals';

// Previne gestos de pinça de zoom (gesturestart) indesejados no iOS Safari
if (typeof document !== 'undefined') {
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  });
}

// Service worker: necessário para notificações push e para instalar o app na tela inicial
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    void registerServiceWorker();
  });
}

startVitals();

const rootElement = document.getElementById('root') as HTMLElement;
const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// HTML gerado no servidor (SSG/SSR) só é aproveitado para visitantes: quem está logado vê o app montado do zero,
// senão a primeira renderização (de visitante) divergiria do HTML
if (rootElement.dataset.ssr === '1' && !authStorage.getToken()) {
  (window as unknown as { __SSR_HYDRATE__?: boolean }).__SSR_HYDRATE__ = true;
  preloadRoute(window.location.pathname)
    .catch(() => {})
    .then(() => {
      ReactDOM.hydrateRoot(rootElement, app, {
        onRecoverableError: (error) => console.warn('Hidratação recuperada:', error),
      });
      // Só a primeira renderização usa o tema/estado de visitante
      requestAnimationFrame(() => {
        (window as unknown as { __SSR_HYDRATE__?: boolean }).__SSR_HYDRATE__ = false;
      });
    });
} else {
  ReactDOM.createRoot(rootElement).render(app);
}
