/* Los Caseritos — service worker
   Hace que la tienda cargue rápido y siga funcionando con señal mala,
   cosa común en el trópico. */

const VERSION = 'loscaseritos-v2';
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

  /* ⚠️ El juego del Vibeathon queda AFUERA, y no es un detalle.
     Este sw.js lo registra la TIENDA, que vive en la raíz del dominio, así que
     su alcance es `/` y sin esta línea intercepta también `/axie/` — otra
     aplicación, con sus propios assets y su propia versión en la URL.
     Con las láminas del Axie pasando por el caché-primero de acá abajo, una
     sola respuesta mala (el túnel caído, el 3001 tomado por AutoTrópico) queda
     guardada y no vence nunca: el juego dibuja las criaturas de respaldo desde
     ese momento y parece que se rompió el juego. Pasó de verdad el 07/09/2026.
     De paso corta la otra: un `/axie/index.html` que no llegara caía en el
     `catch` de abajo y devolvía la TIENDA en lugar del juego. */
  if (url.pathname.startsWith('/axie/')) return;

  const esImagen = /\.(jpg|jpeg|png|webp|avif|svg|ico)$/i.test(url.pathname);

  if (esImagen) {
    /* Fotos: primero el caché (son las que más pesan y no cambian) */
    ev.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        /* ⚠️ Solo si salió bien. `cache.put` guarda un 404 o un 502 igual que
           un 200, y como acá se sirve el caché ANTES de preguntar, un error
           guardado se vuelve permanente. */
        if (res.ok){
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put(req, copia));
        }
        return res;
      }).catch(() => hit))
    );
    return;
  }

  /* Página y catálogo: primero la red, para que los precios estén al día.
     Si no hay señal, servimos la última versión guardada. */
  ev.respondWith(
    fetch(req).then(res => {
      if (res.ok){
        const copia = res.clone();
        caches.open(VERSION).then(c => c.put(req, copia));
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./tienda-publicada.html')))
  );
});
