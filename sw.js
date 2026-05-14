// encryptalotta service worker — offline-precache for the shell.
//
// What this does (and explicitly does not):
//   - Precaches the static shell on install: index.html + locale variants +
//     the four vendored libraries + icons + manifest + privacy.html.
//   - Serves precached responses with a cache-first strategy. Same-origin GETs
//     hit the cache; everything else passes through.
//   - Never reaches outside the origin. The site's `connect-src 'none'`
//     document policy is unchanged; the SW only fetches its own origin's
//     shell URLs during install and (lazily) on first-seen GETs.
//   - No background sync. No push. No analytics. No update prompts — the
//     `CACHE` version below is bumped manually at release time.
//
// CSP note: _headers serves this file with a path-scoped CSP that allows
// `connect-src 'self'` so install-time fetch() works. The document CSP
// (`connect-src 'none'`) is unchanged and continues to apply to index.html.

const CACHE = 'encryptalotta-shell-v1';

const SHELL = [
    '/',
    '/index.html',
    '/fr/',
    '/fr/index.html',
    '/de/',
    '/de/index.html',
    '/zh/',
    '/zh/index.html',
    '/hi/',
    '/hi/index.html',
    '/privacy.html',
    '/openpgp.min.js',
    '/qrcode.js',
    '/secrets.min.js',
    '/js-yaml.min.js',
    '/favicon.ico',
    '/favicon-16x16.png',
    '/favicon-32x32.png',
    '/apple-touch-icon.png',
    '/site.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((cache) =>
            // addAll is atomic — if any URL fails, the whole install fails and
            // the SW is not activated, leaving the previous version in charge.
            cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))
        ).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.open(CACHE).then((cache) =>
            cache.match(req, { ignoreSearch: true }).then((hit) => {
                if (hit) return hit;
                return fetch(req).then((resp) => {
                    if (resp && resp.ok && resp.type === 'basic') {
                        cache.put(req, resp.clone()).catch(() => {});
                    }
                    return resp;
                }).catch(() => hit);
            })
        )
    );
});
