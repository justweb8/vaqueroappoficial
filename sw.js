// ══ VaqueroApp Service Worker — PWA ══
const CACHE_NAME = 'vaqueroapp-v2';
const ASSETS = [
  '/app',
  '/app.html',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;600&family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

// ── Instalar y cachear assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Cache parcial:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activar y limpiar caches viejos ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Estrategia: Network First, Cache Fallback ──
self.addEventListener('fetch', event => {
  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // No interceptar requests de Supabase (siempre necesitan red)
  const url = event.request.url;
  if (url.includes('supabase.co') || url.includes('supabase.io')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, guardar en caché
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin red — usar caché
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback para navegación
          if (event.request.mode === 'navigate') {
            return caches.match('/app.html') || caches.match('/app');
          }
        });
      })
  );
});

// ── Notificaciones push (para futuras alertas) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'VaqueroApp', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'vaqueroapp-alert'
  });
});
