// Expo Router's `web.output: "single"` mode (a classic SPA — the right
// choice here since the whole app is dynamic and behind auth, so there's
// nothing to statically prerender) generates its own minimal index.html and
// does NOT run `app/+html.tsx` — that hook only applies to `output: "static"`
// server-rendering, which we can't use because Supabase's browser storage
// access blows up with "window is not defined" during prerendering.
//
// So instead, this script runs once after `expo export` and patches the
// exported dist/index.html with what the PWA experience needs: the manifest
// link, apple/standalone meta tags, and the service worker registration.
// Run automatically by `npm run build:web` — see package.json.
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found — run `expo export --platform web` first.');
  process.exit(1);
}

let html = fs.readFileSync(indexPath, 'utf8');

const headInjection = `
    <meta name="description" content="Divide la cuenta del restobar con tus amigos: sube la boleta, cada quien marca lo suyo." />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Split Bill" />
    <meta name="mobile-web-app-capable" content="yes" />
  </head>`;

if (!html.includes('manifest.webmanifest')) {
  html = html.replace('</head>', `${headInjection}\n`);
}

// viewport-fit=cover so the app can paint behind the notch / home indicator
// and rely on react-native-safe-area-context to inset content correctly.
html = html.replace(
  /<meta name="viewport" content="[^"]*"\s*\/>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />'
);

const swInjection = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function (err) {
            console.warn('Split Bill: no se pudo registrar el service worker', err);
          });
        });
      }
    </script>
  </body>`;

if (!html.includes("register('/sw.js')")) {
  html = html.replace('</body>', `${swInjection}\n`);
}

fs.writeFileSync(indexPath, html);
console.log('✔ PWA tags injected into dist/index.html');
