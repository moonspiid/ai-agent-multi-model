// Service worker: keeps the app shell available offline and makes the page installable.
// It only ever touches files from this site; provider API calls go straight to the network.

var CACHE = 'ai-agent-shell-v1';
var SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (key) {
          return key === CACHE ? null : caches.delete(key);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never cache or intercept provider calls

  // Pages: fresh copy when online, saved shell when offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put('./index.html', copy); });
          return response;
        })
        .catch(function () {
          return caches.match('./index.html').then(function (saved) {
            return saved || caches.match('./');
          });
        })
    );
    return;
  }

  // Other same-origin files: saved copy first, otherwise fetch and keep it
  event.respondWith(
    caches.match(request).then(function (saved) {
      if (saved) return saved;
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
