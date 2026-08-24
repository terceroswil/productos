/* ══════════════════════════════════════════════════════════════════════
   Deja la dirección pública puesta en todos los lugares donde hace falta.

     node herramientas/dominio.cjs https://motoivir.com/caseritos

   El dominio vive en CUATRO lados y si no coinciden, el link se comparte
   sin foto ni título por WhatsApp:
     · productos.json  → tienda.urlBase
     · tienda-publicada.html → og:image, og:url, canonical y datos de Google
     · sitemap.xml     (se regenera)
     · robots.txt      (se regenera)
   ══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const nueva = (process.argv[2] || '').replace(/\/+$/, '');

if (!nueva || !/^https?:\/\/[^\s]+$/.test(nueva)) {
  console.log('');
  console.log('  Uso:  node herramientas/dominio.cjs https://tudominio.com');
  console.log('        node herramientas/dominio.cjs https://motoivir.com/caseritos');
  console.log('');
  const actual = JSON.parse(fs.readFileSync(path.join(RAIZ, 'productos.json'), 'utf8')).tienda.urlBase;
  console.log('  Dirección actual: ' + actual);
  console.log('');
  process.exit(1);
}

const rutaCat = path.join(RAIZ, 'productos.json');
const cfg = JSON.parse(fs.readFileSync(rutaCat, 'utf8'));
const vieja = (cfg.tienda.urlBase || '').replace(/\/+$/, '');

if (vieja === nueva) {
  console.log('\n  La dirección ya era ' + nueva + '. Nada que cambiar.\n');
  process.exit(0);
}

/* 1. el catálogo */
cfg.tienda.urlBase = nueva;
fs.writeFileSync(rutaCat, JSON.stringify(cfg, null, 2), 'utf8');
console.log('  ✔ productos.json');

/* 2. el <head> de la tienda */
const rutaHtml = path.join(RAIZ, 'tienda-publicada.html');
let html = fs.readFileSync(rutaHtml, 'utf8');
const antes = html;
if (vieja) html = html.split(vieja).join(nueva);
if (html !== antes) {
  fs.writeFileSync(rutaHtml, html, 'utf8');
  const n = antes.split(vieja).length - 1;
  console.log('  ✔ tienda-publicada.html (' + n + ' lugares: og:image, og:url, canonical, datos de Google)');
} else {
  console.log('  ⚠ tienda-publicada.html: no encontré "' + vieja + '". Revisá el <head> a mano.');
}

/* 3 y 4. sitemap y robots */
execFileSync(process.execPath, [path.join(RAIZ, 'generar-sitemap.js')], { stdio: 'pipe' });
console.log('  ✔ sitemap.xml y robots.txt');

console.log('');
console.log('  Dirección nueva: ' + nueva);
console.log('');
if (/\/[^/]+$/.test(nueva.replace(/^https?:\/\//, '').replace(/^[^/]+/, ''))) {
  console.log('  Como está en una subcarpeta, acordate de:');
  console.log('    · usar el bloque de deploy/Caddyfile-agregar.txt (handle_path)');
  console.log('    · poner BASE_PATH=/' + nueva.split('/').pop() + ' en /etc/caseritos.env');
  console.log('');
}
console.log('  Regenerá la imagen de compartir: herramientas/og.html → "Guardar como img/og.jpg"');
console.log('');
