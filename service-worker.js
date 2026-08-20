/**
 * Service Worker for PWA offline cache
 * Strategy: Network First for JS/HTML (always fresh) + Cache First for static assets
 */
const CACHE_NAME = 'exionth-expense-v9';
const STATIC_ASSETS = [
  './',
  './index.html',
  './submit.html',
  './status.html',
  './approve.html',
  './inbox.html',
  './profile.html',
  './pre-approve.html',
  './pre-approves.html',
  './manager-inbox.html',
  './senior-inbox.html',
  './my-team.html',
  './all-requests.html',
  './reset-password.html',
  './summary.html',
  './finalize-claim.html',
  './export-review.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/api.js',
  './js/app.js',
  './js/icons.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sarabun:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go to network for API calls
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ✨ Network First for JS + HTML — ensures users always get latest code
  const isJsOrHtml = /\.(js|html|css)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isJsOrHtml) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache First for everything else (CSS, fonts, icons)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
