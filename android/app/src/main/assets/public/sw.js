// IRQ تواصل Service Worker (Full Offline Resilience & Precaching - F1)
const BUILD_VERSION = '386a304775';
const IS_DEV_MODE = BUILD_VERSION.includes('BUILD_HASH');
const STATIC_CACHE = `tw-static-${BUILD_VERSION}`;
const RUNTIME_CACHE = `tw-runtime-${BUILD_VERSION}`;
const RUNTIME_META_CACHE = `tw-runtime-meta-${BUILD_VERSION}`;

const MAX_RUNTIME_ENTRIES = 60;
const MAX_RUNTIME_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Replaced automatically at build time by vite.config.ts with all hashed JS/CSS/font/seed/icon assets
const PRECACHE_ASSETS = [
  "/",
  "/assets/AdminView-BSyX-rdo.js",
  "/assets/AuthView-Cl6qA4yt.js",
  "/assets/CanvasEditorView-Cq_7vUcF.js",
  "/assets/ChatBubble-D4zqYoxZ.js",
  "/assets/CommunitiesView-CSoHsedt.js",
  "/assets/ComponentGallery-DJrKUpWq.js",
  "/assets/CreateCommunityModal-BSumCVTf.js",
  "/assets/CreateView-fcUjhthQ.js",
  "/assets/ExploreView-BBkvBp8T.js",
  "/assets/HeritageMotifs-DAAKFW4r.js",
  "/assets/ImageCropModal-CN7qsavG.js",
  "/assets/InstantsViewerModal-BL5Dq25D.js",
  "/assets/LiveStreamViewerModal-B-DXvk0X.js",
  "/assets/MarketView-CD08uW3z.js",
  "/assets/MessagesView-C28Fr7kk.js",
  "/assets/NotesModals-Bfa_zYQP.js",
  "/assets/NotificationsView-DGoNftRb.js",
  "/assets/ProductCard-xnDDIy1p.js",
  "/assets/ProductDetailModal-Cz-7KxNz.js",
  "/assets/ProfileView-VC-Yx78F.js",
  "/assets/ReelsView-CiDuNyw7.js",
  "/assets/SavedView-D_ipPgJW.js",
  "/assets/SettingsView-DqU7l4qf.js",
  "/assets/StoryViewerModal-DZkwqkPF.js",
  "/assets/WalletView-CjQ1CL-f.js",
  "/assets/cairo-arabic-400-normal-CAYwymWN.woff",
  "/assets/cairo-arabic-400-normal-DN15VWMM.woff2",
  "/assets/cairo-arabic-600-normal-B3EOalmC.woff",
  "/assets/cairo-arabic-600-normal-rkrvveqO.woff2",
  "/assets/cairo-arabic-700-normal-CyOqhaeK.woff",
  "/assets/cairo-arabic-700-normal-D3nDedWX.woff2",
  "/assets/cairo-latin-400-normal-Dh7otpdh.woff2",
  "/assets/cairo-latin-400-normal-b1R3q6Pf.woff",
  "/assets/cairo-latin-600-normal-buYOP1M3.woff",
  "/assets/cairo-latin-600-normal-mGS0uvCM.woff2",
  "/assets/cairo-latin-700-normal-6fcUy4Rc.woff",
  "/assets/cairo-latin-700-normal-C3GYtKbV.woff2",
  "/assets/cairo-latin-ext-400-normal-C_BIE9Qe.woff",
  "/assets/cairo-latin-ext-400-normal-xCL67Y2R.woff2",
  "/assets/cairo-latin-ext-600-normal-DAfLYaOC.woff",
  "/assets/cairo-latin-ext-600-normal-DuRnqffh.woff2",
  "/assets/cairo-latin-ext-700-normal-Cscux539.woff2",
  "/assets/cairo-latin-ext-700-normal-htXca11Z.woff",
  "/assets/canvasStyles-CLhymB-k.js",
  "/assets/createUtils-BKM8cHh5.js",
  "/assets/index-BhFxsEho.css",
  "/assets/index-W1fFMvWe.js",
  "/assets/reem-kufi-arabic-600-normal-BlglqIsH.woff",
  "/assets/reem-kufi-arabic-600-normal-DfPr_Olo.woff2",
  "/assets/reem-kufi-arabic-700-normal-2X0LRV6P.woff",
  "/assets/reem-kufi-arabic-700-normal-D4RhYlR1.woff2",
  "/assets/reem-kufi-latin-600-normal-COcR8l3q.woff",
  "/assets/reem-kufi-latin-600-normal-D3q9CKj_.woff2",
  "/assets/reem-kufi-latin-700-normal-CFkdsF2J.woff",
  "/assets/reem-kufi-latin-700-normal-D4MLSEVm.woff2",
  "/assets/reem-kufi-latin-ext-600-normal-BGpF9z2Y.woff",
  "/assets/reem-kufi-latin-ext-600-normal-CPTgRtnQ.woff2",
  "/assets/reem-kufi-latin-ext-700-normal-BVODnn_J.woff",
  "/assets/reem-kufi-latin-ext-700-normal-CbxOURXW.woff2",
  "/assets/reem-kufi-vietnamese-600-normal-B860skIo.woff2",
  "/assets/reem-kufi-vietnamese-600-normal-DrgVodXJ.woff",
  "/assets/reem-kufi-vietnamese-700-normal-C_zHpWh6.woff",
  "/assets/reem-kufi-vietnamese-700-normal-CwRvvSSB.woff2",
  "/assets/rolldown-runtime-XKyaHtl9.js",
  "/assets/runtimeUrl-Bd3MaCUa.js",
  "/assets/vendor-C2WNZplG.js",
  "/assets/vendor-CuVhG4oF.css",
  "/assets/vendor-react-CJs5mp61.js",
  "/assets/vendor-zod-BJUoA0ZF.js",
  "/icon.svg",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512-maskable.png",
  "/icons/icon-512.png",
  "/index.html",
  "/manifest.json",
  "/seed/audio/bayat.mp3",
  "/seed/audio/hijaz.mp3",
  "/seed/audio/nahawand.mp3",
  "/seed/audio/rast.mp3",
  "/seed/audio/saba.mp3",
  "/seed/audio/sikah.mp3",
  "/seed/avatar-1.svg",
  "/seed/avatar-2.svg",
  "/seed/avatar-3.svg",
  "/seed/avatar-4.svg",
  "/seed/avatar-me.svg",
  "/seed/comm-1.svg",
  "/seed/comm-2.svg",
  "/seed/comm-3.svg",
  "/seed/cover-dijlah.svg",
  "/seed/cover-me.svg",
  "/seed/cover-merchant.svg",
  "/seed/cover-night.svg",
  "/seed/cover-palm.svg",
  "/seed/cover-poet.svg",
  "/seed/post-1.svg",
  "/seed/post-2.svg",
  "/seed/post-3.svg",
  "/seed/prod-1.svg",
  "/seed/prod-2.svg",
  "/seed/prod-3.svg",
  "/seed/prod-4.svg",
  "/sw-register.js",
  "/theme-init.js"
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
