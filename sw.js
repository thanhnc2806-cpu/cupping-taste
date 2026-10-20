// Service Worker cho Cupping App — Đảm bảo đủ điều kiện cài đặt PWA & chạy offline mượt mà
const CACHE_NAME = 'cupping-taste-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './taxonomy.js',
  './i18n.js',
  './state.js',
  './wheel.js',
  './api.js',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './fonts/fira-latin-400.woff2',
  './fonts/fira-latin-ext-400.woff2',
  './fonts/fira-vietnamese-400.woff2',
  './fonts/fira-latin-500.woff2',
  './fonts/fira-latin-ext-500.woff2',
  './fonts/fira-vietnamese-500.woff2',
  './fonts/fira-latin-600.woff2',
  './fonts/fira-latin-ext-600.woff2',
  './fonts/fira-vietnamese-600.woff2',
  './fonts/fira-latin-700.woff2',
  './fonts/fira-latin-ext-700.woff2',
  './fonts/fira-vietnamese-700.woff2',
  './fonts/oswald-latin.woff2',
  './fonts/oswald-latin-ext.woff2',
  './fonts/oswald-vietnamese.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Bỏ qua các request Apps Script bên ngoài hoặc Analytics
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Mạng trước, mất mạng mới dùng cache: bản mới lên Pages là điện thoại chạy ngay, không trộn code cũ với máy chủ mới.
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
      }
      return networkResponse;
    }).catch(() => caches.match(event.request))
  );
});
