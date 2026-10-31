import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Previne gestos de pinça de zoom (gesturestart) indesejados no iOS Safari
if (typeof document !== 'undefined') {
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
