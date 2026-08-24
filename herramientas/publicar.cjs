/* ══════════════════════════════════════════════════════════════════════
   Arma la carpeta "publicar/" con SOLO los archivos que van a internet.

   Uso:
     node herramientas/publicar.cjs
     node herramientas/publicar.cjs https://loscaseritos.netlify.app

   Si le pasás la dirección, deja el dominio puesto en todos lados (que son
   varios) para que la vista previa al compartir por WhatsApp funcione.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const RAIZ    = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'publicar');

/* Lo único que sale a internet. Todo lo demás se queda en tu computadora. */
const ARCHIVOS = [
  ['tienda-publicada.html', 'index.html'],   // los hostings buscan index.html
  ['productos.json',        'productos.json'],
  ['sw.js',                 'sw.js'],
  ['manifest.webmanifest',  'manifest.webmanifest'],
  ['logo.svg',              'logo.svg'],
  ['icono.svg',             'icono.svg'],
  ['icono-mascara.svg',     'icono-mascara.svg'],
  ['robots.txt',            'robots.txt'],
  ['sitemap.xml',           'sitemap.xml'],
];

/* NUNCA se copian: el panel no tiene contraseña y las herramientas escriben archivos */
const PROHIBIDOS = ['admin.html', 'entrar.html', 'serve.js', 'src',
                    'herramientas', 'logos', 'data', '.bak', '.env', '.env.ejemplo'];

const nuevaURL = (process.argv[2] || '').replace(/\/$/, '');
if (nuevaURL && !/^https?:\/\/[^\s/]+$/.test(nuevaURL)) {
  console.error('\n✕ La dirección debe ser algo como  https://loscaseritos.netlify.app\n');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'productos.json'), 'utf8'));
const urlVieja = (cfg.tienda.urlBase || '').replace(/\/$/, '');

/* ── 1. dejar el dominio nuevo en el catálogo y regenerar sitemap/robots ── */
if (nuevaURL && nuevaURL !== urlVieja) {
  cfg.tienda.urlBase = nuevaURL;
  fs.writeFileSync(path.join(RAIZ, 'productos.json'), JSON.stringify(cfg, null, 2), 'utf8');
  console.log('  ✔ productos.json → urlBase = ' + nuevaURL);
  require('child_process').execFileSync(process.execPath,
    [path.join(RAIZ, 'generar-sitemap.js')], { stdio: 'pipe' });
  console.log('  ✔ sitemap.xml y robots.txt regenerados');
}

/* ── 2. copiar ── */
/* En Windows, si la carpeta está abierta en el Explorador o algún programa la está
   usando, el borrado falla con EPERM/EBUSY. Mejor decirlo claro que escupir un error. */
try {
  fs.rmSync(DESTINO, { recursive: true, force: true });
} catch (e) {
  console.error('\n  ✕ No se pudo vaciar la carpeta "publicar".');
  console.error('    Cerrá la ventana del Explorador que la tenga abierta (y cualquier');
  console.error('    archivo de ahí adentro) y volvé a intentar.\n');
  process.exit(1);
}
fs.mkdirSync(DESTINO, { recursive: true });

let copiados = 0;
for (const [origen, destino] of ARCHIVOS) {
  const rutaOrigen = path.join(RAIZ, origen);
  if (!fs.existsSync(rutaOrigen)) { console.log('  ⚠ falta ' + origen); continue; }

  let contenido = fs.readFileSync(rutaOrigen, 'utf8');

  /* el service worker apunta al html por su nombre viejo */
  if (destino === 'sw.js') contenido = contenido.split('./tienda-publicada.html').join('./index.html');

  /* el dominio está en el <head> del html (og:image, canonical, JSON-LD) */
  if (nuevaURL && urlVieja) contenido = contenido.split(urlVieja).join(nuevaURL);

  fs.writeFileSync(path.join(DESTINO, destino), contenido, 'utf8');
  copiados++;
}

/* las fotos */
const imgOrigen = path.join(RAIZ, 'img');
const imgDestino = path.join(DESTINO, 'img');
fs.mkdirSync(imgDestino, { recursive: true });
let fotos = 0, pesoFotos = 0;
for (const f of fs.readdirSync(imgOrigen)) {
  const st = fs.statSync(path.join(imgOrigen, f));
  if (!st.isFile()) continue;
  fs.copyFileSync(path.join(imgOrigen, f), path.join(imgDestino, f));
  fotos++; pesoFotos += st.size;
}

/* ── 3. control: que no se haya colado nada privado ── */
const colados = [];
(function revisar(dir, rel = '') {
  for (const f of fs.readdirSync(dir)) {
    const completo = path.join(dir, f);
    if (PROHIBIDOS.some(p => f === p || f.endsWith(p))) colados.push(path.join(rel, f));
    if (fs.statSync(completo).isDirectory()) revisar(completo, path.join(rel, f));
  }
})(DESTINO);

const peso = fs.readdirSync(DESTINO).reduce((s, f) => {
  const st = fs.statSync(path.join(DESTINO, f));
  return s + (st.isFile() ? st.size : 0);
}, 0) + pesoFotos;

console.log('');
console.log('  📦 Carpeta lista:  ' + DESTINO);
console.log('     ' + copiados + ' archivos + ' + fotos + ' fotos  ·  ' + Math.round(peso / 1024) + ' KB en total');
console.log('     Dirección configurada: ' + (cfg.tienda.urlBase || '(sin definir)'));
console.log('');
if (colados.length) {
  console.log('  ⛔ SE COLÓ ALGO PRIVADO, NO SUBAS ESTO: ' + colados.join(', '));
  process.exit(1);
}
console.log('  ✔ Sin el panel, sin herramientas, sin respaldos. Se puede subir.');
console.log('');
console.log('  Cómo publicarla en 1 minuto:');
console.log('    1. Entrá a  https://app.netlify.com/drop');
console.log('    2. Arrastrá la carpeta "publicar" a la página');
console.log('    3. Te da una dirección tipo  https://algo-random.netlify.app');
console.log('    4. Volvé a correr esto con esa dirección para que la vista previa');
console.log('       de WhatsApp funcione, y arrastrá la carpeta de nuevo:');
console.log('         node herramientas/publicar.cjs https://TU-DIRECCION.netlify.app');
console.log('');
