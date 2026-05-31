// Static file server for the customer PWA.
// Serves ./dist with SPA fallback. The service worker (sw.js) and the
// PWA manifest are served with no-cache so PWA updates roll out promptly.
const path = require('path');
const express = require('express');

const app = express();
const PORT = parseInt(process.env.PORT || '5174', 10);
const DIST = path.join(__dirname, 'dist');

app.disable('x-powered-by');

app.use(
  express.static(DIST, {
    setHeaders(res, filePath) {
      const base = path.basename(filePath);
      // The SW, its manifest, and the HTML shell must never be cached
      // by upstream proxies — otherwise PWA users get stuck on an old build.
      if (
        base === 'sw.js' ||
        base === 'registerSW.js' ||
        base === 'manifest.webmanifest' ||
        filePath.endsWith('index.html')
      ) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[paynpik-customer] serving ${DIST} on :${PORT}`);
});
