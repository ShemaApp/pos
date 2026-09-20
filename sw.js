const CACHE = 'inventario-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/firebase-config.js',
  './js/utils.js',
  './js/permisos.js',
  './js/auth.js',
  './js/barcode.js',
  './js/db.js',
  './js/movimientos.js',
  './js/VoiceInput.js',
  './js/Scanner.js',
  './js/Etiquetas.js',
  './js/Configuracion.js',
  './js/Inventario.js',
  './js/Clientes.js',
  './js/Creditos.js',
  './js/Ventas.js',
  './js/Reportes.js',
  './js/Empresa.js',
  './js/App.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Solo cachear recursos propios; CDNs externos (React, Babel, escáner) pasan directo a la red.
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          caches.open(CACHE).then((cache) => cache.put(event.request, resp.clone()));
          return resp;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
