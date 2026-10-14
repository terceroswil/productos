/* ══════════════════════════════════════════════════════════════════════
   Los Caseritos — servidor del INVENTARIO

   Se usa de dos formas:

   1. DENTRO DE LA TIENDA (lo normal desde el 12/10/2026). serve.js hace
      require() de este archivo y le pasa todo lo que llega a /inventario/.
      Un solo programa, un solo puerto (3001), y sale por el mismo túnel:
          https://loscaseritos.com/inventario
      Lo pidió el dueño: las otras tiendas tienen que poder entrar desde
      su pueblo, y antes esto contestaba solo en esta computadora.

   2. SUELTO, en su propio puerto. Lo usan las pruebas (prueba.js):
          node inventario/servidor.js          → http://localhost:3003

   ⚠️ No correr las dos formas a la vez contra la misma base.

   ⚠️ Como ahora comparte programa con la tienda, NADA de acá puede
   quedar sin atajar: un error suelto tiraría también loscaseritos.com.
   manejar() atrapa todo lo suyo, y serve.js lo envuelve otra vez.

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
const { abrir, respaldar } = require('./db');
const op = require('./operaciones');

const PUERTO = Number(process.env.INV_PUERTO) || 3003;
const HOST = cfg.HOST;   // 127.0.0.1, o 0.0.0.0 con --red / MODO=produccion
/* Los datos del comerciante viven con el resto de sus datos (data/, o
   DATOS_DIR en un servidor), nunca mezclados con el código. */
const DATOS = process.env.INV_DATOS ? path.resolve(process.env.INV_DATOS) : path.join(cfg.DATOS, 'inventario');
const PUBLICO = path.join(__dirname, 'publico');
const COOKIE = 'inv_sesion';

/* El freno de 6 intentos de clave / 10 minutos por IP (src/seguridad.js).
   Se puede apagar con INV_FRENO_INTENTOS=0 en el .env. Estuvo apagado un
   día (12 al 13/10/2026) a pedido del dueño, que se había olvidado la clave
   y quedó bloqueado; se volvió a prender al revisar la seguridad.
   ⚠️ Apagado, desde internet se pueden probar claves sin límite contra
   loscaseritos.com/inventario. Sin la línea en el .env está PRENDIDO, que
   es lo normal. Quien se olvida la clave no necesita apagarlo: usa
   CAMBIAR-CLAVES.bat, y reiniciar borra el bloqueo. */
const FRENO_DE_INTENTOS = process.env.INV_FRENO_INTENTOS !== '0';

/* El vendedor entra cada día (12 h = un turno): así cada venta queda a
   nombre de quien de verdad estaba en el mostrador. El dueño entra desde
   su celular y no tiene por qué escribir la clave a cada rato. */
const HORAS_SESION = { vendedor: 12, dueno: 30 * 24 };

const db = abrir(DATOS);

/* Copia de seguridad: una al arrancar y otra cada hora (ver respaldar() en
   db.js). Si falla se avisa en la consola y el sistema sigue vendiendo: un
   disco lleno no puede dejar a las tiendas sin poder cobrar. */
function hacerRespaldo(){
  try {
    return respaldar(db, DATOS, op.fechaLocal());
  } catch (e) {
    console.error('  ✗ no se pudo hacer la copia de seguridad:', e.message);
    return null;
  }
}
const RESPALDO = hacerRespaldo();
setInterval(hacerRespaldo, 60 * 60 * 1000).unref();

/* ─────────────────────────── la tienda web ───────────────────────────
   Quién manda en qué está explicado en operaciones.js (sincronizarCatalogo).
   Acá va la plomería: de dónde se lee el catálogo y dónde se deja el stock.

   El catálogo es el mismo productos.json que edita la tienda: los dos viven
   en esta carpeta desde el 12/10/2026 y comparten el .env y data/.
   ⚠️ Antes el inventario estaba en una carpeta aparte, con una COPIA vieja
   de productos.json al lado: se sincronizaba contra esa copia y los
   productos nuevos de la web no llegaban nunca. Si algún día se vuelven a
   separar, INV_CATALOGO tiene que apuntar al de la tienda.
   INV_CATALOGO lo usan además las pruebas, para no tocar el catálogo real. */
const CATALOGO = process.env.INV_CATALOGO ? path.resolve(process.env.INV_CATALOGO) : cfg.CATALOGO;

/* El stock se le pasa a la tienda en un archivo al lado de su catálogo, y
   ella lo aplica al servir productos.json (catalogoConStock, en serve.js).
   No se escribe DENTRO de productos.json a propósito: el panel de la web
   guarda ese archivo entero desde lo que tiene en memoria, y pisaría el
   stock con el de hace un rato. Además así la tienda sigue andando igual
   aunque el inventario esté apagado: usa el último archivo que quedó. */
const STOCK_WEB = path.join(path.dirname(CATALOGO), 'stock-inventario.json');

/* La tienda cuyo stock se muestra en la web: la que despacha los pedidos
   online. INV_TIENDA_WEB lleva el nombre; sin eso, la primera. */
const sinTildes = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const TIENDA_WEB = (() => {
  const tiendas = op.listarTiendas(db);
  const pedida = process.env.INV_TIENDA_WEB;
  if (!pedida) return tiendas[0];
  const t = tiendas.find(x => sinTildes(x.nombre) === sinTildes(pedida));
  if (!t) console.error('  ✗ INV_TIENDA_WEB dice "' + pedida + '" y esa tienda no existe. Se usa ' + tiendas[0].nombre + '.');
  return t || tiendas[0];
})();

let ultimoStockWeb = null;
function publicarStockWeb(){
  try {
    const stock = op.stockParaLaWeb(db, TIENDA_WEB.id);
    const huella = JSON.stringify(stock);
    if (huella === ultimoStockWeb) return;
    /* a un temporal y recién después al nombre de verdad: la tienda nunca
       lee el archivo a medio escribir */
    const temporal = STOCK_WEB + '.tmp';
    fs.writeFileSync(temporal, JSON.stringify({ tienda: TIENDA_WEB.nombre, actualizado: Date.now(), stock }, null, 2), 'utf8');
    fs.renameSync(temporal, STOCK_WEB);
    ultimoStockWeb = huella;
  } catch (e) {
    console.error('  ✗ no se pudo pasarle el stock a la tienda web:', e.message);
  }
}

/* Se fija si el catálogo de la web cambió (fecha y tamaño del archivo) y,
   si cambió, trae los productos y precios nuevos. Es barato: se llama antes
   de listar productos y antes de cobrar, así un precio cambiado en el panel
   de la web vale acá desde el pedido siguiente, sin botón.
   Si el archivo está a medio guardar o roto, se deja todo como estaba y se
   prueba de nuevo en el pedido siguiente. */
let firmaCatalogo = '';
function ponerAlDiaConLaWeb(forzar = false){
  let firma;
  try {
    const st = fs.statSync(CATALOGO);
    firma = st.mtimeMs + ':' + st.size;
  } catch (e) {
    if (forzar) throw new op.ErrorUso('No se encuentra el catálogo de la tienda web');
    return null;
  }
  if (!forzar && firma === firmaCatalogo) return null;
  try {
    const r = op.sincronizarCatalogo(db, CATALOGO);
    firmaCatalogo = firma;
    if (r.nuevos || r.actualizados || r.vinculados || r.desvinculados){
      console.log('  🌐 catálogo de la web: ' + r.nuevos + ' nuevos, ' + r.actualizados + ' actualizados, ' +
                  r.vinculados + ' vinculados, ' + r.desvinculados + ' ya no están' +
                  (r.dadosDeBaja ? ' (' + r.dadosDeBaja + ' sin mercadería, dados de baja)' : ''));
    }
    publicarStockWeb();
    return r;
  } catch (e) {
    if (forzar) throw e;
    console.error('  ✗ no se pudo leer el catálogo de la web:', e.message);
    return null;
  }
}
ponerAlDiaConLaWeb();
publicarStockWeb();

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
    const espera = FRENO_DE_INTENTOS ? seg.estaBloqueado(ip) : 0;
    if (espera) return json(res, 429, { error: 'Demasiados intentos. Pruebe de nuevo en ' + Math.ceil(espera / 60) + ' minutos.' });
    const u = op.verificarLogin(db, d.usuario, d.clave);
    if (!u){
      console.log('  ✗ intento fallido en el inventario desde ' + ip);
      /* mismo mensaje si falla el usuario o la clave: no se confirma cuál existe */
      if (!FRENO_DE_INTENTOS) return json(res, 401, { error: 'Usuario o clave incorrectos' });
      seg.anotarFallo(ip);
      const bloqueo = seg.estaBloqueado(ip);
      if (bloqueo) return json(res, 429, { error: 'Demasiados intentos. Pruebe de nuevo en ' + Math.ceil(bloqueo / 60) + ' minutos.' });
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
                            minutosParaAnular: op.MINUTOS_PARA_ANULAR, inicioDelDia: op.inicioDelDia(),
                            tiendaWeb: TIENDA_WEB.id });
  }

  if (GET && ruta === '/api/productos'){
    ponerAlDiaConLaWeb();
    return json(res, 200, op.listarProductos(db, yo, { inactivos: q.inactivos === '1' }));
  }
  if (POST && ruta === '/api/productos'){
    return json(res, 200, { ok: true, id: op.guardarProducto(db, yo, d) });
  }
  if (POST && ruta === '/api/productos/importar'){
    if (yo.rol !== 'dueno') return json(res, 403, { error: 'Esto lo puede hacer solo el dueño' });
    return json(res, 200, ponerAlDiaConLaWeb(true));
  }

  /* Todo lo que mueve mercadería termina en publicarStockWeb(): la web se
     entera de la venta del mostrador en el momento. */
  if (POST && ruta === '/api/ventas'){
    /* antes de cobrar: si el precio cambió recién en la web, que valga ya */
    ponerAlDiaConLaWeb();
    const r = op.registrarVenta(db, yo, d);
    publicarStockWeb();
    return json(res, 200, r);
  }
  if (GET && ruta === '/api/ventas'){
    return json(res, 200, op.listarVentas(db, yo, q));
  }
  if (POST && ruta === '/api/ventas/anular'){
    const r = op.anularVenta(db, yo, d.id, d.motivo);
    publicarStockWeb();
    console.log('  · venta #' + r.id + ' anulada por ' + yo.usuario);
    return json(res, 200, r);
  }

  if (POST && ruta === '/api/entradas'){
    const r = op.registrarEntrada(db, yo, d);
    publicarStockWeb();
    return json(res, 200, r);
  }
  if (POST && ruta === '/api/stock'){
    const r = op.establecerStock(db, yo, d);
    publicarStockWeb();
    return json(res, 200, r);
  }

  if (GET && ruta === '/api/movimientos'){
    return json(res, 200, op.listarMovimientos(db, yo, q));
  }
  if (GET && ruta === '/api/resumen'){
    return json(res, 200, op.resumenHoy(db, yo));
  }

  if (POST && ruta === '/api/mi-clave'){
    const id = op.cambiarMiClave(db, yo, d);
    /* se le cortaron todas las sesiones, la de esta pantalla incluida: se le da una nueva */
    const renovado = op.usuarioDeSesion(db, { u: id + '.' + db.prepare('SELECT version_sesion v FROM usuarios WHERE id = ?').get(id).v });
    if (renovado) ponerSesion(req, res, renovado);
    console.log('  · ' + yo.usuario + ' cambió su clave');
    return json(res, 200, { ok: true });
  }

  if (POST && ruta === '/api/gastos'){
    const r = op.registrarGasto(db, yo, d);
    console.log('  · ' + yo.usuario + ' anotó un ' + r.tipo + ' de ' + (r.monto / 100));
    return json(res, 200, r);
  }
  if (POST && ruta === '/api/transferencias'){
    const r = op.transferir(db, yo, d);
    publicarStockWeb();
    console.log('  · traspaso de ' + r.unidades + ' unidades: ' + r.origen + ' → ' + r.destino);
    return json(res, 200, r);
  }

  if (GET && ruta === '/api/caja'){
    return json(res, 200, Object.assign(op.estadoDeCaja(db, yo, q.tienda), { cierres: op.listarCierres(db, yo) }));
  }
  if (POST && ruta === '/api/caja/cerrar'){
    const r = op.cerrarCaja(db, yo, d);
    console.log('  · caja cerrada por ' + yo.usuario + (r.diferencia ? '  ⚠️ diferencia de ' + (r.diferencia / 100) : ''));
    return json(res, 200, r);
  }
  if (GET && ruta === '/api/reporte'){
    return json(res, 200, op.reporte(db, yo, q));
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

/* Atiende un pedido. `ruta` es la dirección SIN el prefijo donde está
   montado: llega "/", "/app.js" o "/api/ventas", tanto suelto como cuando
   la tienda lo cuelga de /inventario/. Por eso la pantalla pide todo con
   rutas relativas ("api/ventas"), nunca con barra adelante. */
async function manejar(req, res, ruta, url){
  for (const [k, v] of Object.entries(CABECERAS_SEGURIDAD)) res.setHeader(k, v);

  if (ruta.startsWith('/api/')){
    try {
      return await api(req, res, ruta, url);
    } catch (e) {
      if (e.sobra) res.on('finish', () => req.destroy());
      if (e instanceof op.ErrorUso || e.codigo) return json(res, e.codigo || 400, Object.assign({ error: e.message }, e.extra));
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
}

/* Lo que se muestra al arrancar, sea suelto o dentro de la tienda. */
function presentar(direccion){
  console.log('  📦 Inventario →  ' + direccion);
  console.log('     Datos  →  ' + DATOS);
  if (RESPALDO) console.log('     Copia  →  ' + path.dirname(RESPALDO) + '  (una por día, se actualiza cada hora)');
  console.log('     Web    →  ' + CATALOGO + (fs.existsSync(CATALOGO) ? '' : '   ✗ NO EXISTE'));
  console.log('               la web muestra el stock de ' + TIENDA_WEB.nombre);
  if (!FRENO_DE_INTENTOS){
    console.log('');
    console.log('  ⚠️  Inventario SIN freno de intentos de clave (INV_FRENO_INTENTOS=0).');
    console.log('     Para volver a prenderlo: borrar esa línea del .env y reiniciar.');
  }
  if (op.contarUsuarios(db) === 0){
    console.log('');
    console.log('  ⭐ Primera vez: abrí el inventario EN ESTA COMPUTADORA (por localhost)');
    console.log('     para crear la cuenta del dueño.');
  }
}

/* Cerrar prolijo: la base queda consistente aunque se cierre la ventana. */
for (const senal of ['SIGINT', 'SIGTERM']){
  process.on(senal, () => { try { db.close(); } catch (e) {} process.exit(0); });
}

/* alDia: la tienda lo llama apenas guarda el catálogo, así el inventario
   se entera en el momento y no recién cuando alguien abre su pantalla. */
module.exports = { manejar, presentar, alDia: () => ponerAlDiaConLaWeb() };

/* ─────────────────────────── suelto, en su propio puerto ─────────────────────────── */
if (require.main !== module) return;

const servidor = http.createServer((req, res) => {
  let url, ruta;
  try {
    url = new URL(req.url, 'http://localhost');
    ruta = decodeURIComponent(url.pathname);
  } catch (e) {
    res.writeHead(400); return res.end('Dirección inválida');
  }
  manejar(req, res, ruta, url).catch(e => {
    console.error('  ✗ error sin atajar en el inventario:', e);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

servidor.listen(PUERTO, HOST, () => {
  console.log('');
  presentar('http://localhost:' + PUERTO + '/');
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
