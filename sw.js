/**
 * ParkLog — Service Worker (sw.js)
 * Immediately clears all caches and unregisters itself.
 * This service worker exists only to bust cached assets from any
 * previously registered service worker.
 */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        return caches.delete(name);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});
