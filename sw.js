// AI Games service worker
// Strategy:
//  - App shell (index.html, manifest, icons, games.json): cache-first, refreshed in the background.
//  - Game pages: cache-first once played, so a played game keeps working offline.
//  - Everything else (e.g. Google Fonts used by some games): cached opportunistically as it's fetched.
//
// Bump CACHE_VERSION whenever you change any cached file so clients pick up the update.
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'aigames-' + CACHE_VERSION;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './games.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache the shell first.
    await Promise.all(SHELL_FILES.map((url) =>
      cache.add(url).catch(() => {})
    ));
    // Then discover and cache every game's page so the library works offline once installed.
    try {
      const res = await fetch('./games.json', { cache: 'no-cache' });
      const games = await res.json();
      await Promise.all(games.map((g) =>
        cache.add(`./games/${g.slug}/index.html`).catch(() => {})
      ));
    } catch (e) {
      // games.json not reachable during install (offline first run) -- fine,
      // games will still get cached the first time they're opened, via the fetch handler below.
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith('aigames-') && n !== CACHE_NAME)
        .map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isNavigation = req.mode === 'navigate';
  // games.json drives the homepage's game list -- always try the network first so a
  // newly added game folder shows up on the next load instead of an old cached list.
  const isGameList = new URL(req.url).pathname.endsWith('/games.json');

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    if (isNavigation || isGameList) {
      // Network-first, so updates are picked up when online,
      // falling back to cache (and finally the shell) when offline.
      try {
        const fresh = await fetch(req);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await cache.match(req);
        return cached || (isNavigation ? cache.match('./index.html') : undefined);
      }
    }

    // Cache-first for everything else (assets, fonts, game pages).
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // Opaque (cross-origin, no-cors) or OK responses are both safe to cache here.
      if (fresh && (fresh.ok || fresh.type === 'opaque')) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
