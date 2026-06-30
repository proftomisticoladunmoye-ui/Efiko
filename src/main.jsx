import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './styles.css';

// Register the service worker (Workbox app-shell precache → Offline Mode).
registerSW({ immediate: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
