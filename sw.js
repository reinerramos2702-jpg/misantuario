// Service Worker de Mi Santuario.
// Nota: este archivo nunca existió en el repo (ni en producción — /sw.js daba 404), así que
// el `navigator.serviceWorker.register('./sw.js')` que ya llamaba index.html fallaba en
// silencio desde siempre. Se crea aquí como parte del Bloque 6 porque Web Push lo requiere,
// y de paso corrige esa promesa rota de "PWA instalable".

const CACHE_NAME = 'santuario-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  // NO self.skipWaiting() aquí a propósito: index.html ya tiene su propio flujo de
  // "nueva versión disponible · toca para actualizar" que espera a que el usuario confirme
  // (le hace postMessage('SKIP_WAITING') al SW instalado) antes de activar la nueva versión.
  // Si activáramos de una vez, ese toast quedaría huérfano.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first para todo lo mismo-origen: la app siempre intenta traer la versión más nueva
// primero. El cache es solo un fallback offline, nunca la fuente preferida — así se evita el
// clásico bug de PWA que sigue mostrando una versión vieja aunque haya una nueva desplegada.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // nunca cachear la API

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});

// Web Push real — se dispara aunque la app esté cerrada, porque lo entrega el sistema
// operativo/navegador vía el push service, no la pestaña de la app.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { title: 'Santuario', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Santuario';
  const options = {
    body: data.body || '',
    icon: data.icon || './assets/santuario-icon.svg',
    badge: data.icon || './assets/santuario-icon.svg',
    tag: data.tag || 'santuario',
    vibrate: [80, 40, 80],
    data: { url: data.url || './' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
