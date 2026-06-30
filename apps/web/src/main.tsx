import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { store } from './store';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
      <Toaster position="top-right" />
    </Provider>
  </React.StrictMode>,
);

// Tear down the boot splash from index.html. Same pattern as the
// customer PWA — hold for one pulse beat then fade.
(() => {
  const splash = document.getElementById('vezeor-splash');
  if (!splash) return;
  const fade = () => {
    splash.classList.add('vezeor-splash-fade');
    setTimeout(() => splash.remove(), 360);
  };
  setTimeout(fade, 700);
})();
