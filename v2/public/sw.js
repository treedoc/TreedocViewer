// Service Worker for TreeDoc Viewer PWA
const CACHE_NAME = 'treedoc-v1';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

// Fetch event - network first strategy
self.addEventListener('fetch', (event) => {
  // For now, just pass through to network
  // This enables PWA installation without complex caching
  event.respondWith(fetch(event.request));
});
