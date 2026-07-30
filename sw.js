const CACHE_NAME = "publictradeintel-performance-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./styles.css",
  "./app.js",
  "./performance-explorer.js",
  "./admin.js",
  "./site.webmanifest",
  "./icon.svg",
  "./favicon.ico",
  "./favicon-16x16.png",
  "./favicon-32x32.png",
  "./apple-touch-icon.png",
  "./android-chrome-192x192.png",
  "./android-chrome-512x512.png",
  "./safari-pinned-tab.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith("/api/")) return;
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))),
  );
});
