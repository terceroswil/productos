/* ══════════════════════════════════════════════════════════════════════
   Los Caseritos — cambiar una clave que se olvidó

     node herramientas/cambiar-clave.cjs        (o doble clic en CAMBIAR-CLAVES.bat)

   Las claves no se guardan: se guarda un resumen del que no se puede
   volver atrás (src/seguridad.js). Por eso una clave olvidada no se
   "recupera": se pone una nueva. Esta herramienta hace eso, para las dos
   puertas que hay:

     1. El PANEL de la web (loscaseritos.com/panel)
        Un solo usuario. Vive en el archivo .env (PANEL_USUARIO y
        PANEL_CLAVE_HASH). Hay que reiniciar INICIAR.bat para que valga.

     2. El INVENTARIO (loscaseritos.com/inventario)
        Varios usuarios, en data/inventario/inventario.db. Vale en el
        momento, sin reiniciar, y cierra las sesiones abiertas de ESE
        usuario. Sirve sobre todo para el dueño: a una vendedora el dueño
        le cambia la clave desde la pestaña Usuarios.

   ⚠️ Solo funciona sentado en esta computadora: no hay forma de
   llamarla desde internet (serve.js no sirve ningún .cjs). Quien puede
   correr esto ya tiene los archivos en la mano.

   La clave se escribe acá, en la ventana, y no queda en ningún lado más
   que su resumen. No pasarla por chat ni anotarla en un archivo.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const seg = require(path.join(__dirname, '..', 'src', 'seguridad'));

const RAIZ = path.join(__dirname, '..');
/* --env y --db existen para poder probar esto contra copias */
const arg = nombre => { const i = process.argv.indexOf(nombre); return i > 0 ? process.argv[i + 1] : null; };
const ENV = path.resolve(arg('--env') || path.join(RAIZ, '.env'));
const BASE = path.resolve(arg('--db') || path.join(RAIZ, 'data', 'inventario', 'inventario.db'));

/* ─────────────────────────── preguntar por teclado ─────────────────────────── */

/* Cuando no hay teclado de verdad (las pruebas mandan las respuestas por
   una tubería) se leen todas las líneas de entrada de una vez. */
const colaDeRespuestas = process.stdin.isTTY ? null : fs.readFileSync(0, 'utf8').split(/\r?\n/);

function preguntar(texto){
  if (colaDeRespuestas){
    process.stdout.write(texto + '\n');
    return Promise.resolve((colaDeRespuestas.shift() || '').trim());
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(ok => rl.question(texto, r => { rl.close(); ok(r.trim()); }));
}

/* Igual que preguntar(), pero en pantalla salen asteriscos: que no la lea
   quien esté parado atrás. */
function preguntarClave(texto){
  /* si la ventana no deja tapar lo que se escribe, se pregunta a la vista:
     peor es no poder cambiar la clave */
  if (colaDeRespuestas || typeof process.stdin.setRawMode !== 'function') return preguntar(texto);
  return new Promise(ok => {
    process.stdout.write(texto);
    let clave = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const alTeclear = ch => {
      for (const c of ch){
        if (c === '\r' || c === '\n'){
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', alTeclear);
          process.stdout.write('\n');
          return ok(clave);
        }
        if (c === '\u0003'){ process.stdout.write('\n'); process.exit(1); }       // Ctrl+C
        if (c === '\u0008' || c === '\u007f'){                                    // borrar
          if (clave.length){ clave = clave.slice(0, -1); process.stdout.write('\b \b'); }
        } else if (c >= ' '){
          clave += c;
          process.stdout.write('*');
        }
      }
    };
    process.stdin.on('data', alTeclear);
  });
}

async function pedirClaveNueva(minimo){
  for (;;){
    const a = await preguntarClave('  Clave nueva (' + minimo + ' caracteres o más): ');
    if (a.length < minimo){ console.log('  ✗ Es muy corta. Probá de nuevo.\n'); if (colaDeRespuestas) return null; continue; }
    const b = await preguntarClave('  Escribila otra vez: ');
    if (a !== b){ console.log('  ✗ No coinciden. Probá de nuevo.\n'); if (colaDeRespuestas) return null; continue; }
    return a;
  }
}

/* ─────────────────────────── 1. el panel de la web ─────────────────────────── */

async function clavePanel(){
  if (!fs.existsSync(ENV)){ console.log('\n  ✗ No existe el archivo .env: el panel no tiene clave configurada.'); return; }
  let lineas = fs.readFileSync(ENV, 'utf8').split('\n');
  const leer = nombre => { const l = lineas.find(x => x.trim().startsWith(nombre + '=')); return l ? l.trim().slice(nombre.length + 1) : ''; };

  console.log('\n  PANEL DE LA WEB  (loscaseritos.com/panel)');
  console.log('  El usuario es:  ' + (leer('PANEL_USUARIO') || 'admin'));
  const usuarioNuevo = await preguntar('  Usuario nuevo (Enter para dejar el mismo): ');
  if (usuarioNuevo && !/^[A-Za-z0-9._-]{3,30}$/.test(usuarioNuevo)){
    console.log('  ✗ El usuario va de 3 a 30 caracteres: letras sin tilde, números, punto o guion.');
    return;
  }
  const clave = await pedirClaveNueva(10);
  if (!clave) return;

  /* Se cambia SOLO lo que hace falta, línea por línea: el resto del archivo
     (el secreto de las sesiones, TRAS_PROXY, lo del inventario) queda igual. */
  const poner = (nombre, valor) => {
    const i = lineas.findIndex(x => x.trim().startsWith(nombre + '='));
    const fin = i >= 0 && lineas[i].endsWith('\r') ? '\r' : '';
    if (i >= 0) lineas[i] = nombre + '=' + valor + fin; else lineas.push(nombre + '=' + valor);
  };
  poner('PANEL_CLAVE_HASH', seg.hashClave(clave));
  if (usuarioNuevo) poner('PANEL_USUARIO', usuarioNuevo);
  /* si había una clave en texto plano, se saca: mandaría la vieja */
  lineas = lineas.filter(x => !x.trim().startsWith('PANEL_CLAVE='));

  /* a un temporal y recién después al nombre de verdad: si algo falla a
     mitad de camino, el .env bueno sigue entero */
  const temporal = ENV + '.tmp';
  fs.writeFileSync(temporal, lineas.join('\n'), 'utf8');
  fs.renameSync(temporal, ENV);

  const guardado = fs.readFileSync(ENV, 'utf8').split('\n').find(x => x.trim().startsWith('PANEL_CLAVE_HASH=')).trim().slice('PANEL_CLAVE_HASH='.length);
  if (!seg.verificarClave(clave, guardado)){ console.log('\n  ✗ Algo salió mal: la clave guardada no coincide. Avisá antes de reiniciar.'); return; }

  console.log('\n  ✔ Clave del panel cambiada.' + (usuarioNuevo ? ' Usuario nuevo: ' + usuarioNuevo : ''));
  console.log('  ⚠️  Para que valga hay que REINICIAR: cerrá la ventana de Los Caseritos');
  console.log('      y abrí INICIAR.bat de nuevo.');
}

/* ─────────────────────────── 2. el inventario ─────────────────────────── */

async function claveInventario(){
  if (!fs.existsSync(BASE)){ console.log('\n  ✗ Todavía no existe la base del inventario (' + BASE + ').'); return; }
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(BASE);
  try {
    /* el inventario puede estar prendido y usando la base: se espera en vez de fallar */
    db.exec('PRAGMA busy_timeout = 5000');
    const usuarios = db.prepare(`SELECT u.id, u.usuario, u.nombre, u.rol, u.activo, t.nombre AS tienda
                                 FROM usuarios u LEFT JOIN tiendas t ON t.id = u.tienda_id
                                 ORDER BY u.rol, u.usuario`).all();
    if (!usuarios.length){ console.log('\n  El inventario todavía no tiene usuarios: se crea el primero al abrirlo en esta PC.'); return; }

    console.log('\n  INVENTARIO  (loscaseritos.com/inventario)');
    console.log('  Estos son los usuarios. Lo que se escribe para entrar es la primera columna:\n');
    usuarios.forEach((u, i) => {
      console.log('    ' + (i + 1) + '. ' + u.usuario.padEnd(20) + (u.rol === 'dueno' ? 'Dueño' : 'Vendedor de ' + u.tienda).padEnd(26) +
                  u.nombre + (u.activo ? '' : '   (dado de baja)'));
    });
    const n = Number(await preguntar('\n  ¿A cuál le cambiamos la clave? (número, o Enter para ninguno): '));
    const u = usuarios[n - 1];
    if (!u){ console.log('  No se cambió nada.'); return; }

    const clave = await pedirClaveNueva(8);
    if (!clave) return;
    /* version_sesion + 1 corta las sesiones abiertas de ESE usuario: si la
       clave se cambia porque alguien más la sabía, que ese alguien quede afuera */
    db.prepare('UPDATE usuarios SET clave_hash = ?, version_sesion = version_sesion + 1 WHERE id = ?')
      .run(seg.hashClave(clave), u.id);
    console.log('\n  ✔ Clave de "' + u.usuario + '" cambiada. Vale desde ya, sin reiniciar.');
    console.log('     Si tenía el inventario abierto en algún lado, va a tener que entrar de nuevo.');
  } finally {
    db.close();
  }
}

/* ─────────────────────────── menú ─────────────────────────── */

(async () => {
  console.log('');
  console.log('  ════════════════════════════════════════════════');
  console.log('    LOS CASERITOS — cambiar una clave');
  console.log('  ════════════════════════════════════════════════');
  console.log('');
  console.log('    1. El panel de la web   (productos, fotos, precios)');
  console.log('    2. El inventario        (dueño y vendedoras)');
  console.log('');
  const cual = await preguntar('  ¿Cuál? (1 o 2, Enter para salir): ');
  if (cual === '1') await clavePanel();
  else if (cual === '2') await claveInventario();
  else console.log('  No se cambió nada.');
  console.log('');
})().catch(e => { console.error('\n  ✗ Falló: ' + e.message + '\n'); process.exitCode = 1; });
