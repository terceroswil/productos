/* ══════════════════════════════════════════════════════════════════════
   Deja la tienda lista dentro de MOTO-IVIR, para mostrarla rápido.

     node herramientas/copiar-a-motoivir.cjs
     node herramientas/copiar-a-motoivir.cjs "D:/ruta/a/MOTO-IVIR"

   Arma el paquete público y lo copia a  MOTO-IVIR/public/caseritos/.
   Como MOTO-IVIR sirve todo lo que hay en public/, con eso la tienda
   queda en  motoivir.com/caseritos  sin montar un servidor aparte.

   ⚠️ Así funciona la TIENDA, no el PANEL: el panel necesita este servidor
   corriendo. Para cargar productos se usa el panel en tu computadora y
   se vuelve a copiar. Para tener el panel en internet está la guía
   completa en deploy/DESPLIEGUE.md.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ORIGEN = path.join(RAIZ, 'publicar');

/* Dónde está MOTO-IVIR: por argumento, o adivinando al lado */
const destinoMoto = process.argv[2] || path.join(RAIZ, '..', '..', 'MOTO-IVIR');
const MOTO = path.resolve(destinoMoto);
const PUBLIC = path.join(MOTO, 'public');
const DESTINO = path.join(PUBLIC, 'caseritos');

if (!fs.existsSync(PUBLIC)) {
  console.error('');
  console.error('  ✕ No encontré la carpeta public/ de MOTO-IVIR en:');
  console.error('    ' + MOTO);
  console.error('');
  console.error('  Pasale la ruta correcta:');
  console.error('    node herramientas/copiar-a-motoivir.cjs "D:/CLAUDE-IA/proyectos/MOTO-IVIR"');
  console.error('');
  process.exit(1);
}

/* 1. armar el paquete público (solo lo que va a internet) */
console.log('');
console.log('  Armando el paquete…');
execFileSync(process.execPath, [path.join(RAIZ, 'herramientas', 'publicar.cjs')], { stdio: 'pipe' });

/* 2. copiar */
fs.rmSync(DESTINO, { recursive: true, force: true });
function copiar(desde, hasta) {
  fs.mkdirSync(hasta, { recursive: true });
  for (const f of fs.readdirSync(desde)) {
    const a = path.join(desde, f), b = path.join(hasta, f);
    if (fs.statSync(a).isDirectory()) copiar(a, b);
    else fs.copyFileSync(a, b);
  }
}
copiar(ORIGEN, DESTINO);

const contar = d => fs.readdirSync(d).reduce((n, f) =>
  n + (fs.statSync(path.join(d, f)).isDirectory() ? contar(path.join(d, f)) : 1), 0);

console.log('  ✔ ' + contar(DESTINO) + ' archivos copiados a:');
console.log('    ' + DESTINO);
console.log('');

/* 3. ¿ya está la línea en el server de MOTO-IVIR? */
const server = path.join(MOTO, 'src', 'server.js');
let yaEsta = false;
if (fs.existsSync(server)) {
  yaEsta = fs.readFileSync(server, 'utf8').includes("'/caseritos'");
}

if (yaEsta) {
  console.log('  ✔ MOTO-IVIR ya tiene la ruta /caseritos configurada.');
  console.log('');
  console.log('  Solo falta subir la carpeta al servidor y reiniciar:');
  console.log('    scp -r public/caseritos root@IP-DEL-VPS:/opt/moto-ivir/public/');
  console.log('    ssh root@IP-DEL-VPS "systemctl restart moto-ivir"');
} else {
  console.log('  ── FALTA UN PASO ─────────────────────────────────────────────');
  console.log('');
  console.log('  Agregá esta línea en MOTO-IVIR, en src/server.js,');
  console.log('  JUSTO ANTES de la línea que dice  app.use(\'/\', publico);');
  console.log('');
  console.log("    // Tienda Los Caseritos (demo): motoivir.com/caseritos");
  console.log("    app.use('/caseritos', express.static(path.join(PUBLIC_DIR, 'caseritos')));");
  console.log('');
  console.log('  Tiene que ir antes de esa línea, si no las rutas del cliente');
  console.log('  se comen la petición y da 404.');
}
console.log('');
console.log('  Probalo local:  http://localhost:3000/caseritos/');
console.log('');
