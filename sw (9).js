// VaqueroApp Service Worker v5 - iOS Safari compatible
const CACHE_NAME = 'vaqueroapp-v5';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
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

  // No interceptar APIs externas
  if(url.includes('supabase.co') || url.includes('supabase.io') ||
     url.includes('googleapis.com') || url.includes('gstatic.com') ||
     url.includes('cdnjs.cloudflare.com') || url.includes('fonts.')) return;

  // Solo interceptar navegacion al app
  if(req.mode === 'navigate') {
    event.respondWith(
      // Intentar red primero
      fetch(req)
        .then(res => {
          if(res && res.status === 200) {
            // Guardar en cache con AMBAS claves
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(req, clone);
              // Guardar también con URL alternativa
              cache.put(new Request(self.location.origin + '/app.html'), res.clone());
              cache.put(new Request(self.location.origin + '/app'), res.clone());
            });
          }
          return res;
        })
        .catch(() => {
          // Sin red — buscar en cache con múltiples variantes
          const urlObj = new URL(req.url);
          const origin = urlObj.origin;
          return caches.open(CACHE_NAME).then(cache =>
            cache.match(req)
              .then(r => r || cache.match(origin + '/app.html'))
              .then(r => r || cache.match(origin + '/app'))
              .then(r => r || cache.match('/app.html'))
              .then(r => r || cache.match('/app'))
              .then(r => {
                if(r) return r;
                // Fallback minimo
                return new Response(
                  '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#080c07;color:#c6f135;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:20px;gap:16px}h2{font-size:28px;font-weight:800}p{color:rgba(255,255,255,.7);font-size:15px;line-height:1.6}button{background:#c6f135;color:#080c07;border:none;padding:14px 28px;border-radius:50px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}</style></head><body><h2>VaqueroApp</h2><p>Sin conexion a internet.<br>Conectate y recarga para continuar.</p><button onclick="location.reload()">Recargar</button></body></html>',
                  {status: 200, headers: {'Content-Type': 'text/html; charset=utf-8'}}
                );
              })
          );
        })
    );
  }
});
