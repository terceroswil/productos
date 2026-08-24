/* ══════════════════════════════════════════════════════════════════════
   Los Caseritos — servidor

   Funciona en dos modos, según haya o no una clave configurada:

   • SIN clave (tu computadora)
     Escucha solo en 127.0.0.1. El panel se abre sin pedir nada, pero
     tampoco sale de la máquina. Con --red contesta a la WiFi, y ahí el
     panel queda bloqueado para el resto de la red.

   • CON clave (servidor de internet)
     Definís PANEL_USUARIO y PANEL_CLAVE_HASH y el panel pide usuario y
     contraseña. Recién ahí se puede publicar en internet.
       node herramientas/clave.cjs "la clave que quieras"

   La tienda para el cliente es pública siempre. Lo que se protege es el
   panel y todo lo que escribe archivos.
   ══════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const cfg = require('./src/config');
const seg = require('./src/seguridad');

const RAIZ   = cfg.RAIZ;
const PUERTO = cfg.PUERTO;
const HOST   = cfg.HOST;
const MODO_RED = cfg.MODO_RED;

/* ⚠️ LISTA BLANCA, no lista negra.
   Público es SOLO lo que la tienda del cliente necesita; todo lo demás pide
   permiso. Con lista negra había que acordarse de bloquear cada archivo nuevo,
   y así quedó expuesto el .env —con el secreto de sesión adentro— en las
   pruebas. Con lista blanca, un archivo nuevo nace privado. */
const PUBLICO_EXACTO = new Set([
  '/tienda-publicada.html', '/index.html',
  '/entrar.html',                 // hay que poder llegar a la pantalla de entrada
  '/productos.json',
  '/sw.js', '/manifest.webmanifest',
  '/logo.svg', '/icono.svg', '/icono-mascara.svg',
  '/robots.txt', '/sitemap.xml', '/favicon.ico'
]);

function esPublico(rel){
  if (PUBLICO_EXACTO.has(rel)) return true;
  /* las fotos de los productos, y nada más que imágenes */
  if (/^\/img\/[^/]+\.(jpg|jpeg|png|webp|avif|svg)$/i.test(rel)) return true;
  return false;
}

function ipsDeLaWifi(){
  const salida = [];
  const redes = os.networkInterfaces();
  for (const nombre in redes)
    for (const r of redes[nombre])
      if (r.family === 'IPv4' && !r.internal) salida.push(r.address);
  return salida;
}
const DATOS  = cfg.DATOS;
const EVENTOS = path.join(DATOS, 'eventos.jsonl');
const CATALOGO = cfg.CATALOGO;   // en servidor vive en DATOS_DIR
const FOTOS    = cfg.FOTOS;      // idem: las fotos que sube el comerciante

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.jpg':  'image/jpeg',  '.jpeg': 'image/jpeg',
  '.png':  'image/png',   '.webp': 'image/webp',
  '.avif': 'image/avif',  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon','.txt':  'text/plain; charset=utf-8',
  '.xml':  'application/xml; charset=utf-8'
};

/* Las imágenes casi nunca cambian -> caché larga.
   El HTML y el catálogo sí cambian -> siempre revalidar. */
function cache(ext){
  if (['.jpg','.jpeg','.png','.webp','.avif','.svg','.ico'].includes(ext)) return 'public, max-age=604800';
  if (ext === '.json' || ext === '.html') return 'no-cache';
  return 'public, max-age=3600';
}

const esLocal = req => ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

/* Detrás de un hosting la IP real viene en una cabecera; sin eso, el freno a
   los intentos de clave castigaría a todos por igual. */
function ipDe(req){
  const reenviada = req.headers['x-forwarded-for'];
  if (reenviada) return String(reenviada).split(',')[0].trim();
  return req.socket.remoteAddress || 'desconocida';
}

/* ¿Quién puede entrar al panel y escribir archivos?
   - con login configurado: quien tenga una sesión válida
   - sin login: solo esta computadora */
function tienePermiso(req){
  if (!cfg.CON_LOGIN) return esLocal(req);
  const cookies = seg.leerCookies(req.headers.cookie);
  return !!seg.leerSesion(cookies.lc_sesion, cfg.SECRETO);
}

function claveCorrecta(clave){
  if (cfg.CLAVE_HASH) return seg.verificarClave(clave, cfg.CLAVE_HASH);
  /* respaldo para configuraciones rápidas con la clave en texto */
  if (cfg.CLAVE_TEXTO) {
    const a = Buffer.from(String(clave));
    const b = Buffer.from(cfg.CLAVE_TEXTO);
    return a.length === b.length && require('crypto').timingSafeEqual(a, b);
  }
  return false;
}

function json(res, codigo, obj){
  const cuerpo = JSON.stringify(obj);
  res.writeHead(codigo, { 'Content-Type': TIPOS['.json'], 'Content-Length': Buffer.byteLength(cuerpo) });
  res.end(cuerpo);
}

function leerCuerpo(req, limite = 2 * 1024 * 1024){
  return new Promise((ok, mal) => {
    let n = 0; const trozos = [];
    req.on('data', c => {
      n += c.length;
      if (n > limite) { mal(new Error('Cuerpo demasiado grande')); req.destroy(); return; }
      trozos.push(c);
    });
    req.on('end', () => ok(Buffer.concat(trozos).toString('utf8')));
    req.on('error', mal);
  });
}

/* ─────────────────── analítica: qué se busca y qué se mira ─────────────────── */

function registrarEvento(ev){
  fs.mkdirSync(DATOS, { recursive: true });
  /* Solo guardamos lo necesario. Nada de datos personales del cliente. */
  const limpio = {
    ts: Date.now(),
    tipo: String(ev.tipo || '').slice(0, 24),
    id: ev.id != null ? Number(ev.id) : null,
    name: ev.name ? String(ev.name).slice(0, 80) : null,
    q: ev.q ? String(ev.q).slice(0, 60) : null,
    total: ev.total != null ? Number(ev.total) : null,
    items: ev.items != null ? Number(ev.items) : null
  };
  fs.appendFileSync(EVENTOS, JSON.stringify(limpio) + '\n');
}

function resumenEventos(){
  if (!fs.existsSync(EVENTOS)) return { total: 0, vistas: [], busquedas: [], sinResultado: [], pedidos: [] };
  const filas = fs.readFileSync(EVENTOS, 'utf8').trim().split('\n')
    .map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);

  const contar = (lista, clave) => {
    const m = new Map();
    lista.forEach(e => { const k = e[clave]; if (k) m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([k, n]) => ({ valor: k, veces: n })).sort((a, b) => b.veces - a.veces).slice(0, 20);
  };

  const pedidos = filas.filter(e => e.tipo === 'pedido');
  return {
    total: filas.length,
    desde: filas.length ? filas[0].ts : null,
    vistas:       contar(filas.filter(e => e.tipo === 'ver'), 'name'),
    agregados:    contar(filas.filter(e => e.tipo === 'agregar'), 'name'),
    busquedas:    contar(filas.filter(e => e.tipo === 'busqueda'), 'q'),
    sinResultado: contar(filas.filter(e => e.tipo === 'busqueda_vacia'), 'q'),
    pedidos: {
      cantidad: pedidos.length,
      montoTotal: pedidos.reduce((s, e) => s + (e.total || 0), 0),
      promedio: pedidos.length ? Math.round(pedidos.reduce((s, e) => s + (e.total || 0), 0) / pedidos.length) : 0
    }
  };
}

/* ─────────────────── guardar el catálogo desde admin.html ─────────────────── */

function guardarCatalogo(texto){
  const datos = JSON.parse(texto);                 // si el JSON está mal, revienta acá y no se escribe nada
  if (!Array.isArray(datos.productos)) throw new Error('Falta el arreglo "productos"');

  const ids = datos.productos.map(p => p.id);
  if (new Set(ids).size !== ids.length) throw new Error('Hay IDs de producto repetidos');

  /* Copia de seguridad antes de pisar el archivo bueno */
  if (fs.existsSync(CATALOGO)){
    fs.mkdirSync(path.join(DATOS, 'respaldos'), { recursive: true });
    const sello = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(CATALOGO, path.join(DATOS, 'respaldos', 'productos-' + sello + '.json'));
  }
  fs.writeFileSync(CATALOGO, JSON.stringify(datos, null, 2), 'utf8');
  return datos.productos.length;
}

/* ─────────── guardar una imagen generada en el navegador (herramientas/og.html) ─────────── */

const IMAGENES_PERMITIDAS = ['img/og.jpg', 'img/og.png'];
/* Fotos de producto: solo dentro de img/, nombre simple, sin subcarpetas ni "..".
   El punto y la barra están excluidos del cuerpo del nombre a propósito. */
const RE_FOTO = /^img\/[a-z0-9][a-z0-9_-]{0,60}\.(jpg|png|webp)$/;

function guardarImagen({ archivo, dataURL }){
  /* Este endpoint solo escribe la imagen de compartir o una foto de producto,
     nunca un archivo arbitrario. */
  if (!IMAGENES_PERMITIDAS.includes(archivo) && !RE_FOTO.test(archivo)){
    throw new Error('Nombre de archivo no permitido: ' + archivo);
  }

  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(dataURL || '');
  if (!m) throw new Error('La imagen no llegó en el formato esperado');

  /* archivo llega como "img/loquesea.jpg"; el destino real depende de si los
     datos viven dentro del proyecto o en una carpeta aparte del servidor */
  const destino = path.resolve(FOTOS, path.basename(archivo));
  /* cinturón y tirantes: aunque la regex ya lo impide, nunca escribir fuera */
  if (!destino.startsWith(path.resolve(FOTOS) + path.sep)){
    throw new Error('Ruta fuera de la carpeta de fotos');
  }
  if (fs.existsSync(destino)){
    fs.mkdirSync(path.join(DATOS, 'respaldos'), { recursive: true });
    const sello = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(destino, path.join(DATOS, 'respaldos', sello + '-' + path.basename(archivo)));
  }
  const buf = Buffer.from(m[2], 'base64');
  fs.writeFileSync(destino, buf);
  return { ok: true, archivo, bytes: buf.length };
}

/* ─────────────────────────────── servidor ─────────────────────────────── */

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ruta = decodeURIComponent(url.pathname);

  /* ---- API ---- */
  if (ruta.startsWith('/api/')){
    try {
      /* La analítica la manda la tienda pública: no puede exigir sesión. */
      if (ruta === '/api/evento' && req.method === 'POST'){
        registrarEvento(JSON.parse(await leerCuerpo(req, 8 * 1024)));
        return json(res, 204, {});
      }

      /* ── entrar y salir del panel ── */
      if (ruta === '/api/login' && req.method === 'POST'){
        if (!cfg.CON_LOGIN) return json(res, 400, { error: 'Este servidor no usa clave' });
        const ip = ipDe(req);
        const espera = seg.estaBloqueado(ip);
        if (espera) return json(res, 429, { error: 'Demasiados intentos. Probá en ' + Math.ceil(espera/60) + ' minutos.' });

        const { usuario, clave } = JSON.parse(await leerCuerpo(req, 4 * 1024));
        const usuarioOk = String(usuario||'').trim().toLowerCase() === cfg.USUARIO.toLowerCase();
        if (!usuarioOk || !claveCorrecta(clave)){
          seg.anotarFallo(ip);
          console.log('  ✗ intento fallido desde ' + ip);
          /* si este fallo fue el que colmó el vaso, se avisa el bloqueo y no
             un "te quedan N", que quedaría mintiendo */
          const bloqueo = seg.estaBloqueado(ip);
          if (bloqueo){
            return json(res, 429, { error: 'Demasiados intentos. Probá en ' + Math.ceil(bloqueo/60) + ' minutos.' });
          }
          /* mismo mensaje si falla el usuario o la clave: no confirmamos cuál existe */
          return json(res, 401, { error: 'Usuario o clave incorrectos', quedan: seg.intentosRestantes(ip) });
        }
        seg.limpiarIntentos(ip);
        const sesion = seg.crearSesion(cfg.USUARIO, cfg.SECRETO);
        const seguro = cfg.EN_SERVIDOR ? '; Secure' : '';
        res.setHeader('Set-Cookie',
          'lc_sesion=' + sesion + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (30*24*60*60) + seguro);
        console.log('  ✔ entró al panel desde ' + ip);
        return json(res, 200, { ok: true });
      }

      if (ruta === '/api/salir' && req.method === 'POST'){
        res.setHeader('Set-Cookie', 'lc_sesion=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        return json(res, 200, { ok: true });
      }

      if (ruta === '/api/quien-soy' && req.method === 'GET'){
        return json(res, 200, { conLogin: cfg.CON_LOGIN, dentro: tienePermiso(req), usuario: cfg.USUARIO });
      }

      /* ── de acá para abajo hay que tener permiso ── */
      if (!tienePermiso(req)){
        return json(res, 401, { error: cfg.CON_LOGIN ? 'Necesitás entrar con tu clave' : 'Solo desde esta computadora' });
      }
      if (ruta === '/api/eventos' && req.method === 'GET'){
        return json(res, 200, resumenEventos());
      }
      if (ruta === '/api/guardar' && req.method === 'POST'){
        const n = guardarCatalogo(await leerCuerpo(req));
        console.log('  ✔ catálogo guardado (' + n + ' productos)');
        return json(res, 200, { ok: true, productos: n });
      }
      if (ruta === '/api/guardar-imagen' && req.method === 'POST'){
        const r = guardarImagen(JSON.parse(await leerCuerpo(req, 12 * 1024 * 1024)));
        console.log('  ✔ imagen guardada: ' + r.archivo + ' (' + Math.round(r.bytes / 1024) + ' KB)');
        return json(res, 200, r);
      }
      return json(res, 404, { error: 'Ruta no encontrada' });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  /* ---- archivos estáticos ---- */
  let rel = ruta === '/' ? '/tienda-publicada.html' : ruta;

  /* Atajos: "tutienda.com/panel" se dicta por teléfono sin explicar el .html.
     La barra final también, que es lo que la gente escribe por costumbre. */
  const ATAJOS = {
    '/panel': '/admin.html',  '/panel/': '/admin.html',
    '/admin': '/admin.html',  '/admin/': '/admin.html',
    '/entrar': '/entrar.html','/entrar/': '/entrar.html'
  };
  if (ATAJOS[rel]) rel = ATAJOS[rel];

  /* Todo lo que no esté en la lista blanca exige permiso */
  if (!esPublico(rel) && !tienePermiso(req)){
    if (cfg.CON_LOGIN){
      /* Con clave configurada, se manda a la pantalla de entrada.
         "volver" va SIN barra inicial: entrar.html lo usa como ruta relativa,
         así funciona igual en la raíz del dominio o en una subcarpeta. */
      res.writeHead(302, {
        Location: cfg.BASE + '/entrar.html?volver=' + encodeURIComponent(rel.replace(/^\//, ''))
      });
      return res.end();
    }
    res.writeHead(403, { 'Content-Type': TIPOS['.html'] });
    return res.end('<h1>403</h1><p>Esta parte solo se abre desde la computadora del negocio.</p>' +
                   '<p><a href="/">Ir a la tienda</a></p>');
  }

  /* Con los datos en una carpeta aparte (servidor), el catálogo y las fotos se
     sirven desde ahí: así actualizar el código no pisa lo que cargó el comerciante. */
  let archivo, raizPermitida = RAIZ;
  if (cfg.DATOS_APARTE && rel === '/productos.json'){
    archivo = CATALOGO; raizPermitida = path.dirname(CATALOGO);
  } else if (cfg.DATOS_APARTE && rel.startsWith('/img/')){
    archivo = path.resolve(FOTOS, '.' + rel.slice(4));
    raizPermitida = path.resolve(FOTOS);
  } else {
    archivo = path.resolve(RAIZ, '.' + rel);
  }

  /* path.resolve ya normaliza los "..", así que esto corta cualquier intento
     de salir de la carpeta permitida. */
  if (archivo !== raizPermitida && !archivo.startsWith(raizPermitida + path.sep)){
    res.writeHead(403); return res.end('403');
  }
  let st;
  try { st = fs.statSync(archivo); } catch (e) { st = null; }
  if (!st || st.isDirectory()){
    res.writeHead(404, { 'Content-Type': TIPOS['.html'] });
    return res.end('<h1>404</h1><p>No existe <code>' + rel.replace(/[<>&]/g, '') + '</code></p><p><a href="/">Volver a la tienda</a></p>');
  }

  const ext = path.extname(archivo).toLowerCase();
  res.writeHead(200, {
    'Content-Type': TIPOS[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': cache(ext),
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(archivo).pipe(res);
});

servidor.listen(PUERTO, HOST, () => {
  console.log('');
  console.log('  🧺 Los Caseritos');
  console.log('');

  if (cfg.EN_SERVIDOR){
    console.log('  Modo servidor · escuchando en el puerto ' + PUERTO);
    console.log('  Panel protegido con usuario y clave (usuario: ' + cfg.USUARIO + ')');
  } else {
    console.log('  Tienda  →  http://localhost:' + PUERTO + '/');
    console.log('  Panel   →  http://localhost:' + PUERTO + '/admin.html');
    console.log('  Clave del panel: ' + (cfg.CON_LOGIN
      ? 'SÍ (usuario: ' + cfg.USUARIO + ')'
      : 'no hace falta, solo se abre desde esta computadora'));

    if (MODO_RED){
      const ips = ipsDeLaWifi();
      console.log('');
      console.log('  📱 DESDE EL CELULAR (misma WiFi), escribí en el navegador:');
      if (ips.length) ips.forEach(ip => console.log('        http://' + ip + ':' + PUERTO));
      else console.log('        (no se encontró ninguna red WiFi conectada)');
      console.log('');
      console.log('  ' + (cfg.CON_LOGIN
        ? 'El panel pide clave también desde la WiFi.'
        : 'El panel sigue bloqueado para el resto de la red.'));
    } else {
      console.log('');
      console.log('  Para abrirlo en el celular:  node serve.js --red');
    }
  }

  if (cfg.avisos.length){
    console.log('');
    cfg.avisos.forEach(a => console.log('  ' + a));
  }
  console.log('');
});
