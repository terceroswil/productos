/* Los Caseritos — service worker
   Hace que la tienda cargue rápido y siga funcionando con señal mala,
   cosa común en el trópico. */

const VERSION = 'loscaseritos-v1';
const BASE = ['./', './tienda-publicada.html', './productos.json', './manifest.webmanifest'];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(BASE).catch(() => {}))   // si falla un archivo, no rompemos la instalación
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;   // la analítica nunca se cachea

  const esImagen = /\.(jpg|jpeg|png|webp|avif|svg|ico)$/i.test(url.pathname);

  if (esImagen) {
    /* Fotos: primero el caché (son las que más pesan y no cambian) */
    ev.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copia = res.clone();
        caches.open(VERSION).then(c => c.put(req, copia));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  /* Página y catálogo: primero la red, para que los precios estén al día.
     Si no hay señal, servimos la última versión guardada. */
  ev.respondWith(
    fetch(req).then(res => {
      const copia = res.clone();
      caches.open(VERSION).then(c => c.put(req, copia));
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./tienda-publicada.html')))
  );
});
