const CACHE = 'kislovodsk-static-v2';
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const scoped = path => BASE + path || '/';
const SHELL = [scoped('/offline.html'), scoped('/icons/guide-192.png'), scoped('/icons/guide-512.png')];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('kislovodsk-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Pages and RSC payloads always come from the network: do not freeze schedules or feature switches.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cached = await caches.match(scoped('/offline.html'));
      // Static hosting redirects .html to its clean URL; navigation cannot reuse a redirected response.
      return new Response(cached ? await cached.text() : 'Нет подключения к интернету', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }));
    return;
  }
  // Only immutable, content-hashed assets; no photos, API, maps, or visitor data.
  if (!SHELL.includes(url.pathname) && !/\/(?:_next\/static|assets)\/.*[.-][a-zA-Z0-9_-]{8,}\.(js|css|woff2)$/.test(url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > 100) await cache.delete(keys.find(key => !SHELL.includes(new URL(key.url).pathname)));
    }
    return response;
  }));
});
