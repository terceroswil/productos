/* ══════════════════════════════════════════════════════════════════════
   Los Caseritos — servidor del INVENTARIO

     node inventario/servidor.js          → http://localhost:3003
     node inventario/servidor.js --red    → además desde la WiFi

   Va aparte de la tienda (serve.js, puerto 3001) a propósito: si algo
   falla acá, la tienda online sigue vendiendo, y al revés.

   Reusa lo que ya está probado del proyecto:
   - src/config.js     → lee el .env, --red, MODO=produccion, TRAS_PROXY
   - src/seguridad.js  → scrypt para las claves, cookie firmada, freno de
                          6 intentos / 10 min por IP
   Lo que cambia: acá hay VARIOS usuarios (el dueño y un vendedor por
   tienda), cada uno con su clave, su rol y su sesión.
   ══════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cfg = require('../src/config');
const seg = require('../src/seguridad');
const { abrir } = require('./db');
const op = require('./operaciones');

const PUERTO = Number(process.env.INV_PUERTO) || 3003;
const HOST = cfg.HOST;   // 127.0.0.1, o 0.0.0.0 con --red / MODO=produccion
/* Los datos del comerciante viven con el resto de sus datos (data/, o
   DATOS_DIR en un servidor), nunca mezclados con el código. */
const DATOS = process.env.INV_DATOS ? path.resolve(process.env.INV_DATOS) : path.join(cfg.DATOS, 'inventario');
const PUBLICO = path.join(__dirname, 'publico');
const COOKIE = 'inv_sesion';

/* El vendedor entra cada día (12 h = un turno): así cada venta queda a
   nombre de quien de verdad estaba en el mostrador. El dueño entra desde
   su celular y no tiene por qué escribir la clave a cada rato. */
const HORAS_SESION = { vendedor: 12, dueno: 30 * 24 };

const db = abrir(DATOS);

/* El secreto que firma las cookies. Si no viene en el .env se inventa uno
   y se GUARDA: si se inventara en cada arranque, cada reinicio sacaría a
   todos los vendedores en medio de la jornada. */
function secretoDeSesiones(){
  if (process.env.INV_SECRETO && process.env.INV_SECRETO.length >= 32) return process.env.INV_SECRETO;
  const archivo = path.join(DATOS, 'secreto-sesiones');
  try {
    const s = fs.readFileSync(archivo, 'utf8').trim();
    if (s.length >= 32) return s;
  } catch (e) { /* no existe todavía */ }
  const s = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(archivo, s, { encoding: 'utf8', mode: 0o600 });
  return s;
}
const SECRETO = secretoDeSesiones();

/* ─────────────────────────── utilidades HTTP ─────────────────────────── */

/* Local de verdad: la conexión viene de esta máquina Y no la trae un proxy.
   ⚠️ Detrás del túnel de Cloudflare TODAS las visitas llegan desde
   127.0.0.1 (ver la explicación larga en serve.js, en ipDe). Sin mirar las
   cabeceras, cualquiera en internet pasaría por "local" y podría crear la
   cuenta del dueño antes que el dueño. */
function esLocal(req){
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const viaProxy = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.headers['cf-ray'];
  return local && !viaProxy;
}

/* La misma lógica que ipDe() de serve.js: con TRAS_PROXY se cree en
   CF-Connecting-IP (la pisa Cloudflare) o en el ÚLTIMO X-Forwarded-For. */
function ipDe(req){
  if (cfg.TRAS_PROXY){
    const cloudflare = req.headers['cf-connecting-ip'];
    if (cloudflare) return String(cloudflare).trim();
    const reenviada = req.headers['x-forwarded-for'];
    if (reenviada){
      const partes = String(reenviada).split(',');
      return partes[partes.length - 1].trim();
    }
  }
  return req.socket.remoteAddress || 'desconocida';
}

function json(res, codigo, obj){
  const cuerpo = JSON.stringify(obj);
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
    'Cache-Control': 'no-store'
  });
  res.end(cuerpo);
}

function leerCuerpo(req, limite = 256 * 1024){
  return new Promise((ok, mal) => {
    let n = 0, cortado = false;
    const trozos = [];
    req.on('data', c => {
      if (cortado) return;
      n += c.length;
      if (n > limite){
        /* igual que en serve.js: se contesta un 413 legible y recién después
           se corta la conexión */
        cortado = true;
        const e = new Error('El pedido es demasiado grande');
        e.codigo = 413; e.sobra = true;
        return mal(e);
      }
      trozos.push(c);
    });
    req.on('end', () => { if (!cortado) ok(Buffer.concat(trozos).toString('utf8')); });
    req.on('error', mal);
  });
}

function ponerSesion(req, res, u){
  const horas = HORAS_SESION[u.rol] || 12;
  const valor = seg.crearSesion(op.idDeSesion(u), SECRETO, horas / 24);
  /* Secure cuando llega por HTTPS: en un servidor, o detrás de Cloudflare,
     que avisa con X-Forwarded-Proto. */
  const seguro = cfg.EN_SERVIDOR || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', COOKIE + '=' + valor + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
                              (horas * 3600) + seguro);
}

function quitarSesion(res){
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
}

function usuarioActual(req){
  const cookies = seg.leerCookies(req.headers.cookie);
  return op.usuarioDeSesion(db, seg.leerSesion(cookies[COOKIE], SECRETO));
}

/* ─────────────────────────── API ─────────────────────────── */

async function api(req, res, ruta, url){
  const GET = req.method === 'GET', POST = req.method === 'POST';
  if (!GET && !POST) return json(res, 405, { error: 'Método no permitido' });

  /* Un formulario de otra página no puede mandar application/json: exigirlo
     cierra la puerta a que una web ajena dispare ventas o altas de usuarios
     usando la sesión abierta del navegador. Se suma a SameSite=Strict. */
  let d = {};
  if (POST){
    if (!String(req.headers['content-type'] || '').startsWith('application/json')){
      return json(res, 415, { error: 'El pedido tiene que ir en JSON' });
    }
    const texto = await leerCuerpo(req);
    d = texto ? JSON.parse(texto) : {};
    if (!d || typeof d !== 'object' || Array.isArray(d)) return json(res, 400, { error: 'El pedido llegó mal' });
  }
  const q = Object.fromEntries(url.searchParams);

  /* ── sin sesión ── */
  if (GET && ruta === '/api/estado'){
    return json(res, 200, { configurado: op.contarUsuarios(db) > 0, esLocal: esLocal(req) });
  }

  if (POST && ruta === '/api/configurar'){
    if (!esLocal(req)) return json(res, 403, { error: 'La primera configuración se hace desde la computadora donde corre el sistema' });
    op.configurarDueno(db, d);
    const u = op.verificarLogin(db, d.usuario, d.clave);
    ponerSesion(req, res, u);
    console.log('  ✔ cuenta del dueño creada: ' + u.usuario);
    return json(res, 200, { ok: true });
  }

  if (POST && ruta === '/api/login'){
    const ip = ipDe(req);
    const espera = seg.estaBloqueado(ip);
    if (espera) return json(res, 429, { error: 'Demasiados intentos. Pruebe de nuevo en ' + Math.ceil(espera / 60) + ' minutos.' });
    const u = op.verificarLogin(db, d.usuario, d.clave);
    if (!u){
      seg.anotarFallo(ip);
      console.log('  ✗ intento fallido en el inventario desde ' + ip);
      const bloqueo = seg.estaBloqueado(ip);
      if (bloqueo) return json(res, 429, { error: 'Demasiados intentos. Pruebe de nuevo en ' + Math.ceil(bloqueo / 60) + ' minutos.' });
      /* mismo mensaje si falla el usuario o la clave: no se confirma cuál existe */
      return json(res, 401, { error: 'Usuario o clave incorrectos', quedan: seg.intentosRestantes(ip) });
    }
    seg.limpiarIntentos(ip);
    ponerSesion(req, res, u);
    console.log('  ✔ entró ' + u.usuario + ' (' + u.rol + ') desde ' + ip);
    return json(res, 200, { ok: true });
  }

  if (POST && ruta === '/api/salir'){
    /* Corta las sesiones de ESTE usuario en todos lados (no solo en este
       navegador) y a nadie más: que un vendedor salga no saca al dueño. */
    const u = usuarioActual(req);
    if (u) op.cerrarSesiones(db, u.id);
    quitarSesion(res);
    return json(res, 200, { ok: true });
  }

  /* ── de acá para abajo hay que haber entrado ── */
  const yo = usuarioActual(req);
  if (!yo) return json(res, 401, { error: 'La sesión terminó. Hay que entrar de nuevo.' });

  if (GET && ruta === '/api/yo'){
    return json(res, 200, { usuario: op.datosPublicos(yo), tiendas: op.listarTiendas(db),
                            minutosParaAnular: op.MINUTOS_PARA_ANULAR, inicioDelDia: op.inicioDelDia() });
  }

  if (GET && ruta === '/api/productos'){
    return json(res, 200, op.listarProductos(db, yo, { inactivos: q.inactivos === '1' }));
  }
  if (POST && ruta === '/api/productos'){
    return json(res, 200, { ok: true, id: op.guardarProducto(db, yo, d) });
  }
  if (POST && ruta === '/api/productos/importar'){
    return json(res, 200, op.importarCatalogo(db, yo, cfg.CATALOGO));
  }

  if (POST && ruta === '/api/ventas'){
    const r = op.registrarVenta(db, yo, d);
    return json(res, 200, r);
  }
  if (GET && ruta === '/api/ventas'){
    return json(res, 200, op.listarVentas(db, yo, q));
  }
  if (POST && ruta === '/api/ventas/anular'){
    const r = op.anularVenta(db, yo, d.id, d.motivo);
    console.log('  · venta #' + r.id + ' anulada por ' + yo.usuario);
    return json(res, 200, r);
  }

  if (POST && ruta === '/api/entradas'){
    return json(res, 200, op.registrarEntrada(db, yo, d));
  }
  if (POST && ruta === '/api/stock'){
    return json(res, 200, op.establecerStock(db, yo, d));
  }

  if (GET && ruta === '/api/movimientos'){
    return json(res, 200, op.listarMovimientos(db, yo, q));
  }
  if (GET && ruta === '/api/resumen'){
    return json(res, 200, op.resumenHoy(db, yo));
  }

  if (GET && ruta === '/api/usuarios'){
    if (yo.rol !== 'dueno') return json(res, 403, { error: 'Esto lo puede hacer solo el dueño' });
    return json(res, 200, op.listarUsuarios(db));
  }
  if (POST && ruta === '/api/usuarios'){
    const id = op.guardarUsuario(db, yo, d);
    /* Si el dueño se cambió su propia clave, su sesión se cortó junto con
       las demás: se le da una nueva para no sacarlo de la pantalla. */
    if (id === yo.id){
      const renovado = op.usuarioDeSesion(db, { u: id + '.' + db.prepare('SELECT version_sesion v FROM usuarios WHERE id = ?').get(id).v });
      if (renovado) ponerSesion(req, res, renovado);
    }
    return json(res, 200, { ok: true, id });
  }

  return json(res, 404, { error: 'Ruta no encontrada' });
}

/* ─────────────────────────── archivos de la pantalla ─────────────────────────── */

/* Lista cerrada: se sirven estos tres archivos y nada más. Ni la base de
   datos ni el código del servidor pueden salir por acá, porque no hay
   forma de pedir un archivo que no esté en esta lista. */
const ARCHIVOS = {
  '/':            ['index.html',  'text/html; charset=utf-8'],
  '/index.html':  ['index.html',  'text/html; charset=utf-8'],
  '/app.js':      ['app.js',      'text/javascript; charset=utf-8'],
  '/estilos.css': ['estilos.css', 'text/css; charset=utf-8']
};

const CABECERAS_SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  /* Sin scripts de terceros ni código incrustado: si algún día se colara
     HTML en un nombre de producto, no podría ejecutar nada. */
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; " +
                             "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Robots-Tag': 'noindex, nofollow'
};

const servidor = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(CABECERAS_SEGURIDAD)) res.setHeader(k, v);
  let url, ruta;
  try {
    url = new URL(req.url, 'http://localhost');
    ruta = decodeURIComponent(url.pathname);
  } catch (e) {
    res.writeHead(400); return res.end('Dirección inválida');
  }

  if (ruta.startsWith('/api/')){
    try {
      return await api(req, res, ruta, url);
    } catch (e) {
      if (e.sobra) res.on('finish', () => req.destroy());
      if (e instanceof op.ErrorUso || e.codigo) return json(res, e.codigo || 400, { error: e.message });
      if (e instanceof SyntaxError) return json(res, 400, { error: 'El pedido llegó mal' });
      /* Un error inesperado se anota completo en la consola y al usuario
         le llega algo genérico: el detalle técnico no le sirve a él y sí a
         quien quiera atacar el sistema. */
      console.error('  ✗ error en ' + req.method + ' ' + ruta + ':', e);
      return json(res, 500, { error: 'Algo falló en el servidor. Intente de nuevo.' });
    }
  }

  const archivo = ARCHIVOS[ruta];
  if (!archivo || req.method !== 'GET'){
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('No existe');
  }
  fs.readFile(path.join(PUBLICO, archivo[0]), (err, contenido) => {
    if (err){ res.writeHead(500); return res.end('No se pudo leer ' + archivo[0]); }
    res.writeHead(200, { 'Content-Type': archivo[1], 'Cache-Control': 'no-cache' });
    res.end(contenido);
  });
});

servidor.listen(PUERTO, HOST, () => {
  console.log('');
  console.log('  📦 Los Caseritos — Inventario');
  console.log('');
  console.log('  Abrir  →  http://localhost:' + PUERTO + '/');
  console.log('  Datos  →  ' + DATOS);
  if (op.contarUsuarios(db) === 0){
    console.log('');
    console.log('  ⭐ Primera vez: abrí la dirección de arriba EN ESTA COMPUTADORA');
    console.log('     para crear la cuenta del dueño.');
  }
  if (cfg.MODO_RED){
    const os = require('os');
    console.log('');
    console.log('  📱 Desde otro equipo de la misma WiFi:');
    for (const redes of Object.values(os.networkInterfaces())){
      for (const r of redes){
        if (r.family === 'IPv4' && !r.internal) console.log('        http://' + r.address + ':' + PUERTO);
      }
    }
  }
  if (cfg.TRAS_PROXY && cfg.MODO_RED){
    console.log('');
    console.log('  ⚠️  TRAS_PROXY + --red: el freno de intentos se esquiva con una cabecera falsa. Apague uno de los dos.');
  }
  console.log('');
});

servidor.on('error', e => {
  if (e.code === 'EADDRINUSE'){
    console.error('\n  ✗ El puerto ' + PUERTO + ' ya está ocupado. ¿Ya hay un inventario abierto en otra ventana?\n');
    process.exit(1);
  }
  throw e;
});

/* Cerrar prolijo: la base queda consistente aunque se cierre la ventana. */
for (const senal of ['SIGINT', 'SIGTERM']){
  process.on(senal, () => { try { db.close(); } catch (e) {} process.exit(0); });
}
