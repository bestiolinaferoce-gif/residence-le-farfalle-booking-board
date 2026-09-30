/*
 * Service worker della board.
 *
 * Obiettivo dichiarato: la board resta consultabile in sola lettura anche
 * senza rete — il segnale in struttura può mancare.
 * Le scritture NON vengono messe in coda: fingere che una prenotazione sia
 * salvata mentre non lo è sarebbe peggio di un errore visibile.
 */

const VERSION = "le-farfalle-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest"]).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isReadableApi(url) {
  return url.pathname === "/api/bookings" || url.pathname === "/api/settings";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Il feed iCal e il login devono sempre parlare col server.
  if (url.pathname.startsWith("/api/ical") || url.pathname.startsWith("/api/login")) return;

  if (isReadableApi(url)) {
    // Rete prima, copia in cache: offline si vede l'ultimo stato noto.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ??
              new Response(JSON.stringify({ v: 0, ts: "", data: [], offline: true }), {
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
        return cached ?? network;
      })
    );
  }
});
