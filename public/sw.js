/*
 * CafeFlow service worker.
 *
 * Deliberately conservative: the dashboards are fully dynamic (force-dynamic
 * server components over live POS data), so pages and API responses are NEVER
 * cached — the worker only makes the app installable and caches hashed static
 * assets, which are immutable. Everything else passes straight to the network.
 */

const VERSION = "cafeflow-static-v1";
const STATIC_CACHE = `${VERSION}-assets`;

// Immutable build output + app icons — safe to serve cache-first.
const STATIC_PREFIXES = ["/_next/static/", "/icons/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

  if (isStatic) {
    // Stale-while-revalidate for immutable hashed assets.
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      })()
    );
    return;
  }

  // API routes, pages and everything else: network only. A failed navigation
  // falls back to the last cached shell of that URL, if we happen to have one.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (await cache.match(request)) ?? Response.error();
        }
      })()
    );
  }
});
