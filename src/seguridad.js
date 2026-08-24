/* ══════════════════════════════════════════════════════════════════════
   Seguridad del panel: claves, sesiones y freno a los intentos.

   Todo con lo que trae Node de fábrica (crypto). Sin librerías externas:
   menos cosas que actualizar y menos superficie de ataque.
   ══════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

/* ─────────────────────────── claves ─────────────────────────── */

/* scrypt: pensado para ser lento a propósito. Si algún día alguien se roba
   el archivo de configuración, probar claves una por una le cuesta carísimo. */
const SCRYPT = { N: 16384, r: 8, p: 1, largo: 64 };

/* El separador es "." y NO "$": un hash con $ se rompe al pasar por variables
   de entorno, porque el shell y muchos paneles de hosting intentan expandirlo
   como si fuera una variable. Ya nos pasó. */
function hashClave(clave){
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(clave, sal, SCRYPT.largo, SCRYPT).toString('hex');
  return 's1.' + sal + '.' + hash;
}

function verificarClave(clave, guardado){
  try {
    /* acepta el formato viejo con $ por si quedó alguno guardado */
    const [version, sal, hash] = String(guardado || '').split(/[.$]/);
    if (version !== 's1' || !sal || !hash) return false;
    const prueba = crypto.scryptSync(clave, sal, SCRYPT.largo, SCRYPT);
    const esperado = Buffer.from(hash, 'hex');
    /* timingSafeEqual: comparar con === filtraría, por el tiempo que tarda,
       cuántos caracteres del hash acertó quien está probando. */
    if (prueba.length !== esperado.length) return false;
    return crypto.timingSafeEqual(prueba, esperado);
  } catch (e) { return false; }
}

/* ─────────────────────────── sesiones ───────────────────────────
   Cookie firmada, sin guardar nada en el servidor: si reinicia, las sesiones
   siguen valiendo. La firma impide que alguien se fabrique una a mano. */

const DIAS = 24 * 60 * 60 * 1000;

function firmar(texto, secreto){
  return crypto.createHmac('sha256', secreto).update(texto).digest('base64url');
}

function crearSesion(usuario, secreto, dias = 30){
  const datos = Buffer.from(JSON.stringify({
    u: usuario,
    n: Date.now(),                       // cuándo nació, para poder revocarla
    exp: Date.now() + dias * DIAS
  })).toString('base64url');
  return datos + '.' + firmar(datos, secreto);
}

/* ── Revocar al salir ──
   La cookie es autocontenida: el servidor no guarda sesiones. Eso está bien
   (sobrevive a los reinicios) pero tiene un agujero: "Salir" solo borraba la
   cookie DEL NAVEGADOR. El token seguía siendo válido, así que quien lo
   hubiera copiado entraba igual. En un panel que se abre desde el celular en
   la tienda, eso no sirve.

   Solución mínima: se anota la hora del último "Salir". Toda sesión nacida
   antes de esa hora queda muerta. Hay un solo comerciante por tienda, así
   que un corte global alcanza y sobra. Va a un archivo para que el corte
   sobreviva a los reinicios del servidor. */
let cortarAntesDe = 0;
let archivoCorte = null;

function configurarRevocacion(ruta, fs){
  archivoCorte = ruta;
  try { cortarAntesDe = Number(fs.readFileSync(ruta, 'utf8')) || 0; } catch (e) { cortarAntesDe = 0; }
}

function revocarSesiones(fs){
  cortarAntesDe = Date.now();
  if (archivoCorte && fs) {
    try { fs.writeFileSync(archivoCorte, String(cortarAntesDe), 'utf8'); } catch (e) {}
  }
  return cortarAntesDe;
}

function leerSesion(cookie, secreto){
  if (!cookie) return null;
  const corte = cookie.lastIndexOf('.');
  if (corte < 1) return null;
  const datos = cookie.slice(0, corte);
  const firma = cookie.slice(corte + 1);

  const esperada = Buffer.from(firmar(datos, secreto));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return null;
  if (!crypto.timingSafeEqual(esperada, recibida)) return null;

  try {
    const obj = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    if (!obj.exp || obj.exp < Date.now()) return null;   // vencida
    /* nacida antes del último "Salir" → muerta. Las de antes de este cambio
       no traen "n": se las trata como viejas, así que un Salir también
       las corta. */
    if (cortarAntesDe && (obj.n || 0) <= cortarAntesDe) return null;
    return obj;
  } catch (e) { return null; }
}

function leerCookies(cabecera){
  const salida = {};
  String(cabecera || '').split(';').forEach(par => {
    const i = par.indexOf('=');
    if (i < 1) return;
    salida[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  });
  return salida;
}

/* ──────────────────── freno a los intentos ────────────────────
   Sin esto, alguien puede probar miles de claves por minuto. */

const intentos = new Map();
const LIMITE = 6;              // intentos fallidos seguidos
const CASTIGO = 10 * 60 * 1000; // 10 minutos de espera

function estaBloqueado(ip){
  const r = intentos.get(ip);
  if (!r) return 0;
  if (r.hasta && r.hasta > Date.now()) return Math.ceil((r.hasta - Date.now()) / 1000);
  if (r.hasta && r.hasta <= Date.now()) intentos.delete(ip);
  return 0;
}

function anotarFallo(ip){
  const r = intentos.get(ip) || { n: 0, hasta: 0 };
  r.n++;
  if (r.n >= LIMITE) { r.hasta = Date.now() + CASTIGO; r.n = 0; }
  intentos.set(ip, r);
  return r;
}

function limpiarIntentos(ip){ intentos.delete(ip); }

function intentosRestantes(ip){
  const r = intentos.get(ip);
  return Math.max(0, LIMITE - (r ? r.n : 0));
}

/* Se limpia sola cada tanto para que el Map no crezca sin fin */
setInterval(() => {
  const ahora = Date.now();
  for (const [ip, r] of intentos) {
    if (!r.hasta || r.hasta < ahora) intentos.delete(ip);
  }
}, 30 * 60 * 1000).unref();

module.exports = {
  hashClave, verificarClave,
  crearSesion, leerSesion, leerCookies,
  configurarRevocacion, revocarSesiones,
  estaBloqueado, anotarFallo, limpiarIntentos, intentosRestantes,
  LIMITE
};
