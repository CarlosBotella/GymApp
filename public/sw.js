// Catálogo y pantallas disponibles sin conexión; las imágenes se guardan al verlas.
const VERSION = 'gymapp-free-exercises-v3';
const CACHE_PREFIX = 'gymapp-';
const appUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const response = await fetch(appUrl('asset-manifest.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('No se ha podido leer el manifiesto de la app');
    const manifest = await response.json();
    const assets = Object.values(manifest).flatMap((entry) => [entry.file, ...(entry.css || []), ...(entry.assets || [])]);
    const core = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'pdf.worker.min.mjs', 'licenses/free-exercise-db.txt'];
    await cache.addAll([...new Set([...core, ...assets])].map(appUrl));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const response = await fetch(request);
        if (response.ok) event.waitUntil(cache.put(appUrl('index.html'), response.clone()));
        return response;
      } catch {
        return (await cache.match(appUrl('index.html'))) || Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      // Images are cached on demand; quota failures must not hide a valid image.
      event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
    }
    return response;
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window' });
    const window = windows.find((client) => client.url.startsWith(self.registration.scope) && 'focus' in client);
    return window ? window.focus() : self.clients.openWindow(appUrl('./#/entreno'));
  })());
});
