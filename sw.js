// ══════════════════════════════════════════════════════
// VaqueroApp — Service Worker v1.0
// Cachea el HTML completo para funcionar sin internet
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'vaqueroapp-v1';

// Archivos a cachear (ajusta el nombre de tu HTML si es diferente)
const FILES_TO_CACHE = [
  './',
  './index.html',
  './app.html',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── INSTALACIÓN: cachear archivos al instalar el SW ──
self.addEventListener('install', event => {
  console.log('[SW] Instalando VaqueroApp Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando archivos de la app');
      // addAll falla si algún archivo no se puede cachear,
      // por eso cacheamos de a uno para mayor resiliencia
      return Promise.allSettled(
        FILES_TO_CACHE.map(url => cache.add(url).catch(e => console.warn('[SW] No se pudo cachear:', url, e)))
      );
    }).then(() => {
      console.log('[SW] Instalación completa');
      return self.skipWaiting(); // Activar inmediatamente sin esperar
    })
  );
});

// ── ACTIVACIÓN: limpiar caches viejos ──
self.addEventListener('activate', event => {
  console.log('[SW] Activando VaqueroApp Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activación completa — controlando todas las pestañas');
      return self.clients.claim(); // Tomar control de todas las pestañas abiertas
    })
  );
});

// ── FETCH: estrategia Cache First, luego Network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // No interceptar peticiones a Supabase — esas necesitan ir a la red
  if (url.hostname.includes('supabase.co')) {
    return; // Dejar pasar normalmente
  }

  // Para el resto (HTML, JS de CDN, etc.) → Cache First
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        console.log('[SW] Sirviendo desde caché:', event.request.url);
        return cachedResponse;
      }

      // No está en caché → buscar en red y cachear si es posible
      return fetch(event.request).then(networkResponse => {
        // Solo cachear respuestas válidas y del mismo origen o CDN confiable
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.origin === self.location.origin || url.hostname.includes('cdnjs.cloudflare.com'))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Sin red y sin caché — para el HTML principal devolver algo útil
        console.warn('[SW] Sin red y sin caché para:', event.request.url);
        // Si es una navegación, intentar servir la raíz cacheada
        if (event.request.mode === 'navigate') {
          return caches.match('./') || caches.match('./index.html');
        }
      });
    })
  );
});
