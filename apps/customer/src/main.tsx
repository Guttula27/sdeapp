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

// Register the PWA service worker — production-only; dev skips so HMR
// stays clean. See serviceWorkerRegistration.ts.
registerServiceWorker();
