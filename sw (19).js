// VaqueroApp Service Worker v7 - Offline completo
const CACHE_NAME = 'vaqueroapp-v11';
const ASSETS = [
  '/',
  '/app.html',
  '/app',
  '/index.html',
  '/manifest.json'
];

// INSTALAR: pre-cachear archivos esenciales
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ACTIVAR: limpiar cachés viejos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FETCH: Cache-first para app, Network-first para APIs
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = req.url;

  // No interceptar APIs externas (Supabase, fonts, CDN)
  if (url.includes('supabase.co') || url.includes('supabase.io') ||
      url.includes('googleapis.com') || url.includes('gstatic.com') ||
      url.includes('cdnjs.cloudflare.com') || url.includes('fonts.') ||
      url.includes('api.anthropic.com')) return;

  // Navegación principal → Network-first, fallback a cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(req, clone);
              cache.put(new Request(self.location.origin + '/app.html'), res.clone());
              cache.put(new Request(self.location.origin + '/app'), res.clone());
              cache.put(new Request(self.location.origin + '/'), res.clone());
            });
          }
          return res;
        })
        .catch(() => {
          // Sin red: servir desde caché
          const origin = new URL(req.url).origin;
          return caches.open(CACHE_NAME).then(cache =>
            cache.match(req)
              .then(r => r || cache.match(origin + '/app.html'))
              .then(r => r || cache.match(origin + '/app'))
              .then(r => r || cache.match(origin + '/'))
              .then(r => r || cache.match('/app.html'))
              .then(r => {
                if (r) return r;
                return new Response(
                  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#080c07;color:#c6f135;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px;gap:16px}h2{font-size:28px;font-weight:800}p{color:rgba(255,255,255,.7);font-size:15px;line-height:1.6}button{background:#c6f135;color:#080c07;border:none;padding:14px 28px;border-radius:50px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}</style></head><body><h2>🐄 VaqueroApp</h2><p>Sin conexión.<br>La app se cargará cuando tengas internet.<br>Tus datos están guardados localmente.</p><button onclick="location.reload()">Reintentar</button></body></html>',
                  { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
              })
          );
        })
    );
    return;
  }

  // Otros assets (imágenes, CSS, JS) → Cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
        }
        return res;
      }).catch(() => new Response('', { status: 408 }));
    })
  );
});

// SYNC: cuando recupera internet, sincronizar datos pendientes
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Notificar a los clientes que hay conexión para sincronizar
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
}

// Mensaje desde la app para forzar actualización
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
