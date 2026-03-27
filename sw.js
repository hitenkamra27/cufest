/* ─── CU FEST Service Worker v1.0 ─────────────────────────── */
const CACHE_NAME    = 'cu-fest-v1';
const OFFLINE_URL   = './index.html';

const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

/* ─── INSTALL: cache static shell ───────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('https://cdn') && !url.startsWith('https://fonts')));
    }).then(() => self.skipWaiting())
  );
});

/* ─── ACTIVATE: clean old caches ───────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ─── FETCH: network-first for API, cache-first for assets ─── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and browser extension requests
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Network-first for Supabase, Google Sheets, Cloudinary (live data)
  const isLiveData = url.hostname.includes('supabase.co') ||
                     url.hostname.includes('opensheet.elk.sh') ||
                     url.hostname.includes('cloudinary.com') ||
                     url.hostname.includes('googleapis.com');

  if (isLiveData) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets (fonts, scripts, images)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Fallback to app shell for navigation requests
        if (request.mode === 'navigate') return caches.match(OFFLINE_URL);
      });
    })
  );
});

/* ─── PUSH NOTIFICATIONS (future-ready) ────────────────────── */
self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'CU FEST', body: 'Live update!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-72.png',
      vibrate: [200, 100, 200],
      tag: 'cu-fest-notification',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('./index.html');
    })
  );
});
