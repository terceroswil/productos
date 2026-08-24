/* ══════════════════════════════════════════════════════════════════════
   Genera la clave del panel para poner en el servidor.

     node herramientas/clave.cjs "la clave que quieras"

   Imprime las líneas listas para pegar en el archivo .env o en la
   configuración del hosting. La clave NUNCA se guarda tal cual: se guarda
   un resumen del que no se puede volver atrás.
   ══════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const path = require('path');
const seg = require(path.join(__dirname, '..', 'src', 'seguridad'));

const clave = process.argv[2];
const usuario = process.argv[3] || 'admin';

if (!clave) {
  console.log('');
  console.log('  Uso:  node herramientas/clave.cjs "tu clave" [usuario]');
  console.log('');
  console.log('  Ejemplo:');
  console.log('    node herramientas/clave.cjs "Naranja-Verde-42" don-julio');
  console.log('');
  process.exit(1);
}

if (clave.length < 10) {
  console.log('');
  console.log('  ⚠️  Esa clave tiene ' + clave.length + ' caracteres: es corta para algo que va a estar en internet.');
  console.log('     Usá 12 o más. Tres palabras separadas por guiones se recuerdan fácil');
  console.log('     y son difíciles de adivinar. Ejemplo: Mango-Canasta-Rio-7');
  console.log('');
}

const hash = seg.hashClave(clave);
const secreto = crypto.randomBytes(32).toString('hex');

console.log('');
console.log('  ┌─ Pegá esto en el archivo .env (o en las variables del hosting) ─┐');
console.log('');
console.log('  PANEL_USUARIO=' + usuario);
console.log('  PANEL_CLAVE_HASH=' + hash);
console.log('  SESION_SECRETO=' + secreto);
console.log('');
console.log('  └──────────────────────────────────────────────────────────────────┘');
console.log('');
console.log('  · El hash NO se puede revertir: si perdés la clave, generás otra y listo.');
console.log('  · SESION_SECRETO mantiene abiertas las sesiones cuando el servidor reinicia.');
console.log('    Si lo cambiás, todos tienen que volver a entrar.');
console.log('  · El archivo .env NUNCA se sube a internet (publicar.cjs ya lo deja afuera).');
console.log('');

/* comprobación: que lo que se generó valide de verdad */
if (!seg.verificarClave(clave, hash)) {
  console.error('  ⛔ ERROR: el hash generado no valida. No lo uses, avisá.');
  process.exit(1);
}
console.log('  ✔ Verificado: la clave abre con ese hash.');
console.log('');
