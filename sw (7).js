// ══ VaqueroApp Service Worker v3 — iOS Safari compatible ══
const CACHE_NAME = 'vaqueroapp-v3';
const APP_SHELL = ['/app', '/app.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = req.url;

  // No interceptar Supabase ni CDNs externos
  if(url.includes('supabase.co') || url.includes('supabase.io') ||
     url.includes('googleapis.com') || url.includes('gstatic.com') ||
     url.includes('cdnjs.cloudflare.com')) return;

  // Navegacion — Network first, cache fallback con respuesta de emergencia
  if(req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if(res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() =>
          caches.match('/app.html').then(c => c || caches.match('/app')).then(c =>
            c || new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#080c07;color:#c6f135"><h2>🐄 VaqueroApp</h2><p style="color:#fff">Sin conexion. Recarga cuando tengas internet.</p></body></html>',
              {headers:{'Content-Type':'text/html'}}
            )
          )
        )
    );
    return;
  }

  // Otros assets — Cache first
  event.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        if(res && res.status === 200)
          caches.open(CACHE_NAME).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => new Response('', {status: 408}));
    })
  );
});
