import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { initPerfMode } from './perfMode.js';
import './styles.css';

// Reflect the performance mode (Full / Smart / Lite) onto <html> before first paint, and keep
// smart mode in step with the live network.
initPerfMode();

// Register the service worker (Workbox app-shell precache → Offline Mode).
registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
