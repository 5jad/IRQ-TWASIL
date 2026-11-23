// IRQ تواصل Service Worker (Full Offline Resilience & Precaching - F1)
const BUILD_VERSION = '__BUILD_HASH__';
const IS_DEV_MODE = BUILD_VERSION.includes('BUILD_HASH');
const STATIC_CACHE = `tw-static-${BUILD_VERSION}`;
const RUNTIME_CACHE = `tw-runtime-${BUILD_VERSION}`;
const RUNTIME_META_CACHE = `tw-runtime-meta-${BUILD_VERSION}`;

const MAX_RUNTIME_ENTRIES = 60;
const MAX_RUNTIME_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Replaced automatically at build time by vite.config.ts with all hashed JS/CSS/font/seed/icon assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const metaCache = await caches.open(RUNTIME_META_CACHE);
  const keys = await cache.keys();
  const now = Date.now();

  for (const req of keys) {
    const metaRes = await metaCache.match(req.url);
    if (metaRes) {
      const ts = Number(await metaRes.text());
      if (Number.isFinite(ts) && now - ts > MAX_RUNTIME_AGE_MS) {
        await cache.delete(req);
        await metaCache.delete(req.url);
      }
    }
  }

  const remaining = await cache.keys();
  while (remaining.length > MAX_RUNTIME_ENTRIES) {
    const oldest = remaining.shift();
    if (oldest) {
      await cache.delete(oldest);
      await metaCache.delete(oldest.url);
    }
  }
}

async function putRuntimeEntry(request, response) {
  const cache = await caches.open(RUNTIME_CACHE);
  const metaCache = await caches.open(RUNTIME_META_CACHE);
  await cache.put(request, response);
  await metaCache.put(request.url, new Response(String(Date.now())));
  await trimRuntimeCache();
}

// Install: precache shell + build assets (in dev mode, skipWaiting immediately to replace stale dev SW)
self.addEventListener('install', (event) => {
  if (IS_DEV_MODE) {
    event.waitUntil(self.skipWaiting());
    return;
  }

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        // Activate immediately only on initial install (when no previous SW controls the page)
        if (!self.registration.active) {
          return self.skipWaiting();
        }
        return undefined;
      })
  );
});

// Activate: clean older caches (in dev mode, purge all caches so Vite serves fresh modules)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                IS_DEV_MODE ||
                (key !== STATIC_CACHE &&
                  key !== RUNTIME_CACHE &&
                  key !== RUNTIME_META_CACHE)
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Listen for SKIP_WAITING message from client update toast (never reload silently while typing)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch handler: Navigation fallback & bounded runtime asset caching
self.addEventListener('fetch', (event) => {
  if (IS_DEV_MODE) return;
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // 1. Navigation requests (SPA fallback to cached /index.html)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html', { ignoreSearch: true }))
    );
    return;
  }

  // 2. Same-origin static & app assets (match both full Request and pathname for dynamic ES module imports)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request, { ignoreVary: true }).then((cached) => {
        if (cached) return cached;

        return caches.match(url.pathname, { ignoreVary: true }).then((pathCached) => {
          if (pathCached) return pathCached;

          return fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                const clone = response.clone();
                event.waitUntil(putRuntimeEntry(event.request, clone));
              }
              return response;
            })
            .catch(() => pathCached || cached);
        });
      })
    );
    return;
  }

  // 3. Cross-origin CORS-safe images only (reject uncapped opaque responses) with bounded FIFO + TTL
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && response.status === 200 && response.type === 'cors') {
              const clone = response.clone();
              event.waitUntil(putRuntimeEntry(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }
});
