import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { CustomerAlertsProvider } from './context/CustomerAlertsContext';
import { registerServiceWorker } from './serviceWorkerRegistration';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CustomerAuthProvider>
      <CustomerAlertsProvider>
        <App />
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      </CustomerAlertsProvider>
    </CustomerAuthProvider>
  </React.StrictMode>,
);

// Tear down the boot splash from index.html. The minimum 700ms hold
// gives the pulse animation a beat or two before fading; without it
// the splash flashes on fast networks and feels broken rather than
// branded. The CSS transition runs 320ms so we remove the node a
// little after that to keep the DOM clean.
(() => {
  const splash = document.getElementById('vezeor-splash');
  if (!splash) return;
  const start = performance.now();
  const fade = () => {
    splash.classList.add('vezeor-splash-fade');
    setTimeout(() => splash.remove(), 360);
  };
  const elapsed = performance.now() - start;
  if (elapsed >= 700) fade();
  else setTimeout(fade, 700 - elapsed);
})();

// Register the PWA service worker — production-only; dev skips so HMR
// stays clean. See serviceWorkerRegistration.ts.
registerServiceWorker();
