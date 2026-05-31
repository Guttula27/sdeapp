// Static file server for the admin SPA.
// Serves ./dist with SPA fallback (any unknown route → index.html)
// so React Router deep links work on hard reload.
const path = require('path');
const express = require('express');

const app = express();
const PORT = parseInt(process.env.PORT || '5173', 10);
const DIST = path.join(__dirname, 'dist');

app.disable('x-powered-by');

app.use(
  express.static(DIST, {
    // index.html should always be revalidated; hashed assets are immutable.
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
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
  console.log(`[paynpik-web] serving ${DIST} on :${PORT}`);
});
