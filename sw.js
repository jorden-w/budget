/* Budget — service worker.
 *
 * The app shell is one HTML file plus three CDN scripts. Without caching those,
 * the PWA meta tags promise an installable offline app and then fail the moment
 * you lose signal. Cache-first for the CDN (versioned URLs, safe to pin),
 * network-first for the app shell so an edit shows up on the next load.
 *
 * Bump CACHE_VERSION whenever index.html changes in a way you want pushed out
 * immediately rather than on the next successful network fetch.
 */
const CACHE_VERSION = "budget-v3.0.0";
const SHELL = ["./", "./index.html", "./manifest.json"];
const CDN = [
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.24.7/babel.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await cache.addAll(SHELL).catch(() => {});
      // CDN entries are opaque cross-origin responses; failures must not abort
      // the install, or a flaky CDN leaves the app with no service worker.
      await Promise.all(CDN.map((u) => cache.add(u).catch(() => {})));
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isShell = url.origin === self.location.origin;

  if (isShell) {
    // Network-first: always prefer a fresh index.html, fall back to cache offline.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // Cache-first for the pinned CDN assets and fonts.
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      });
    })
  );
});
