/* ══════════════════════════════════════════════════════════════════════
   Configuración del servidor.

   Sale de las variables de entorno o de un archivo .env al lado del proyecto.
   NUNCA va dentro del código: así el mismo archivo sirve en tu computadora y
   en el servidor, y las claves no terminan publicadas por accidente.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.join(__dirname, '..');

/* Lector de .env mínimo: LINEA=valor, ignora comentarios y comillas */
function cargarEnv(){
  const archivo = path.join(RAIZ, '.env');
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, 'utf8').split('\n')) {
    const l = linea.trim();
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i < 1) continue;
    const nombre = l.slice(0, i).trim();
    let valor = l.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))) valor = valor.slice(1, -1);
    if (process.env[nombre] === undefined) process.env[nombre] = valor;
  }
}
cargarEnv();

const env = process.env;
const banderas = process.argv.slice(2);

/* ¿Hay panel con clave? Basta con que esté configurada la contraseña. */
const CLAVE_HASH = env.PANEL_CLAVE_HASH || '';
const CLAVE_TEXTO = env.PANEL_CLAVE || '';
const CON_LOGIN = !!(CLAVE_HASH || CLAVE_TEXTO);

/* En un servidor de internet hay que escuchar hacia afuera. En tu computadora,
   solo hacia adentro salvo que pidas --red para probar en el celular. */
const EN_SERVIDOR = env.MODO === 'produccion' || !!env.RENDER || !!env.RAILWAY_ENVIRONMENT || !!env.FLY_APP_NAME;
const MODO_RED = banderas.includes('--red') || env.RED === '1';

/* Si la tienda vive en una subcarpeta del dominio (motoivir.com/caseritos),
   el proxy quita ese prefijo antes de pasarnos la petición, así que acá las
   rutas llegan normales. Pero las REDIRECCIONES que mandamos al navegador sí
   tienen que llevarlo, o el visitante termina fuera de la tienda. */
const BASE = (env.BASE_PATH || '').replace(/\/+$/, '');

/* ¿Hay un proxy adelante (Caddy, nginx)? De eso depende si se le cree a la
   cabecera X-Forwarded-For para saber quién se está conectando.
   La cabecera la puede escribir cualquiera, así que en tu computadora NO se
   mira: si se mirara, el freno de intentos del login se esquivaría mandando
   una IP inventada distinta en cada prueba.
   En el VPS va detrás de Caddy, así que ahí sí. Se puede forzar con
   TRAS_PROXY=1 o apagar con TRAS_PROXY=0. */
const TRAS_PROXY = env.TRAS_PROXY !== undefined && env.TRAS_PROXY !== ''
  ? env.TRAS_PROXY === '1'
  : EN_SERVIDOR;

const config = {
  RAIZ,
  BASE,
  PUERTO: Number(env.PORT) || 3001,
  HOST: (EN_SERVIDOR || MODO_RED) ? '0.0.0.0' : '127.0.0.1',
  EN_SERVIDOR,
  MODO_RED,
  TRAS_PROXY,

  CON_LOGIN,
  USUARIO: env.PANEL_USUARIO || 'admin',
  CLAVE_HASH,
  CLAVE_TEXTO,

  /* Si no se define un secreto, se inventa uno al arrancar: las sesiones
     valen mientras el servidor no reinicie. En el servidor conviene fijarlo. */
  SECRETO: env.SESION_SECRETO || crypto.randomBytes(32).toString('hex'),
  SECRETO_FIJADO: !!env.SESION_SECRETO,

  /* Donde se guardan catálogo, fotos y respaldos.
     En tu computadora: dentro del proyecto, como siempre.
     En un servidor: se apunta a una carpeta aparte (ej. /var/lib/caseritos) para
     que actualizar el código NO borre los productos ni las fotos del comerciante. */
  DATOS: env.DATOS_DIR ? path.resolve(env.DATOS_DIR) : path.join(RAIZ, 'data'),
  DATOS_APARTE: !!env.DATOS_DIR,
};

/* Con DATOS_DIR, el catálogo y las fotos viven ahí. La primera vez se copian
   desde el proyecto, así el servidor arranca con algo que mostrar. */
config.CATALOGO = config.DATOS_APARTE
  ? path.join(config.DATOS, 'productos.json')
  : path.join(RAIZ, 'productos.json');

config.FOTOS = config.DATOS_APARTE
  ? path.join(config.DATOS, 'img')
  : path.join(RAIZ, 'img');

if (config.DATOS_APARTE) {
  fs.mkdirSync(config.FOTOS, { recursive: true });
  if (!fs.existsSync(config.CATALOGO) && fs.existsSync(path.join(RAIZ, 'productos.json'))) {
    fs.copyFileSync(path.join(RAIZ, 'productos.json'), config.CATALOGO);
    console.log('  · catálogo inicial copiado a ' + config.CATALOGO);
  }
  const imgProyecto = path.join(RAIZ, 'img');
  if (fs.existsSync(imgProyecto) && fs.readdirSync(config.FOTOS).length === 0) {
    for (const f of fs.readdirSync(imgProyecto)) {
      const origen = path.join(imgProyecto, f);
      if (fs.statSync(origen).isFile()) fs.copyFileSync(origen, path.join(config.FOTOS, f));
    }
    console.log('  · fotos iniciales copiadas a ' + config.FOTOS);
  }
}

/* ── avisos al arrancar ── */
config.avisos = [];
if (config.EN_SERVIDOR && !config.CON_LOGIN) {
  config.avisos.push('⛔ PELIGRO: servidor público SIN clave de panel. Definí PANEL_CLAVE_HASH.');
}
if (config.EN_SERVIDOR && !config.SECRETO_FIJADO) {
  config.avisos.push('⚠️  Sin SESION_SECRETO: cada reinicio cierra las sesiones abiertas.');
}
if (config.CLAVE_TEXTO && !config.CLAVE_HASH) {
  config.avisos.push('⚠️  PANEL_CLAVE está en texto plano. Mejor: node herramientas/clave.cjs "tu clave"');
}
/* TRAS_PROXY hace que se le crea a las cabeceras CF-Connecting-IP y
   X-Forwarded-For para saber quién se conecta. Eso es seguro mientras el
   único que le hable al servidor sea el proxy (cloudflared, por localhost).
   Con --red el servidor escucha en toda la WiFi: ahí cualquiera puede
   inventarse la cabecera y esquivar el freno de intentos del login. */
if (config.TRAS_PROXY && config.MODO_RED) {
  config.avisos.push('⚠️  TRAS_PROXY + --red: el freno de intentos del login se esquiva mandando una cabecera falsa. Apagá uno de los dos.');
}

module.exports = config;
