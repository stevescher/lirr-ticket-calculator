const CACHE = 'lirr-calc-v11';
const ASSETS = ['/', '/index.html', '/app.js', '/lirr-data.js', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-192.png', '/icons/icon-maskable-512.png', '/icons/icon-192.svg', '/icons/icon-512.svg', '/icons/favicon.svg', '/privacy.html', '/terms.html', '/404.html', '/og-image.svg'];

const DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', e => {
  if (DEV) { self.skipWaiting(); return; }
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  if (DEV) { self.clients.claim(); return; }
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (DEV) return; // always fetch fresh in development
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
