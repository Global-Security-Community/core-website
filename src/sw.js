// Service worker disabled during development
// To re-enable, uncomment the registration and ensure CACHE_NAME is updated
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Clear all caches on activation
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});
