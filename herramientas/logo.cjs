/* Genera todas las variantes del logo de Los Caseritos (el león) a partir de
   herramientas/logo-dibujo.cjs, y las deja puestas en las páginas. */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

/* El dibujo vive en logo-dibujo.cjs: lo comparte con logo-franja.cjs, que arma
   la franja a color de la portada. Acá solo se lo viste y se lo reparte. */
const { LEON, CENTRAR } = require('./logo-dibujo.cjs');

const DEGRADADO = `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#17c07f"/><stop offset="1" stop-color="#0a7d54"/>
  </linearGradient></defs>`;

const envolver = (contenido, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${extra}${contenido}\n</svg>\n`;

/* 1. Símbolo suelto en blanco — va DENTRO del cuadrito verde del encabezado,
      que ya trae su degradado por CSS.
      ⚠️ Va con CENTRAR aunque no se achique. La canasta ocupaba y10–93 y entraba
      sola; la melena del león llega a y−1, o sea que la punta de arriba caía
      FUERA del viewBox y el navegador la recortaba, además de quedar el dibujo
      corrido 4 unidades hacia arriba. CENTRAR('1') no escala, solo lo baja. */
const simboloBlanco = envolver(`\n  <g transform="${CENTRAR('1')}">${LEON('#ffffff')}</g>`);

/* 2. Logo completo: cuadrito con degradado + símbolo calado */
const logoCompleto = envolver(
  `\n  <rect width="100" height="100" rx="26" fill="url(#g)"/>` +
  `\n  <g transform="${CENTRAR('.78')}">${LEON('#ffffff')}</g>`,
  DEGRADADO);

/* 3. Ícono PWA: igual al logo completo */
const iconoApp = logoCompleto;

/* 4. Ícono enmascarable: fondo lleno y símbolo más chico (Android le recorta los bordes) */
const iconoMascara = envolver(
  `\n  <rect width="100" height="100" fill="#0a7d54"/>` +
  `\n  <g transform="${CENTRAR('.6')}">${LEON('#ffffff')}</g>`);

fs.mkdirSync(path.join(RAIZ, 'logos'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'logos', 'simbolo-blanco.svg'), simboloBlanco);
fs.writeFileSync(path.join(RAIZ, 'logo.svg'), logoCompleto);
fs.writeFileSync(path.join(RAIZ, 'icono.svg'), iconoApp);
fs.writeFileSync(path.join(RAIZ, 'icono-mascara.svg'), iconoMascara);

/* 5. Favicon como data URI: versión plana, sin degradado (a 16 px no se nota
      y el archivo queda mucho más corto dentro del HTML) y con el león en
      versión `chico` — a ese tamaño el aro fino se borra y la cara se funde
      otra vez con la melena. */
const favicon = envolver(
  `\n  <rect width="100" height="100" rx="22" fill="#0a7d54"/>` +
  `\n  <g transform="${CENTRAR('.8')}">${LEON('#ffffff', 'mFav', true)}</g>`).replace(/\n\s*/g, '');
/* Los espacios TAMBIÉN hay que codificarlos: sin eso, algunos navegadores
   cortan el data URI y el favicon no aparece. */
const dataURI = 'data:image/svg+xml,' + favicon
  .replace(/"/g, "'").replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E')
  .replace(/ /g, '%20');

fs.writeFileSync(path.join(RAIZ, 'logos', 'favicon-datauri.txt'), dataURI);

console.log('✔ logo.svg, icono.svg, icono-mascara.svg, logos/simbolo-blanco.svg');
console.log('✔ favicon data URI: ' + dataURI.length + ' caracteres');

/* ── 6. Dejarlo puesto en las páginas ──
   Sin esto había que copiar el SVG a mano en el HTML cada vez que se tocaba el
   logo, y quedaban desincronizados. Acá se reemplaza el <svg class="marca-svg">
   del encabezado y el <link rel="icon"> de cada página. */

const svgEnLinea = simboloBlanco
  .replace(/\n\s*/g, '')
  .replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">',
           '<svg class="marca-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">');

/* La plantilla de la imagen de compartir usa el mismo símbolo, con el id "simbolo".
   Va entre marcadores para poder reemplazarlo sin tocar el resto del diseño. */
const rutaOG = path.join(RAIZ, 'herramientas', 'og.html');
if (fs.existsSync(rutaOG)) {
  let og = fs.readFileSync(rutaOG, 'utf8');
  const maskNueva = LEON('#ffffff')
    .match(/<mask id="mLeon">[\s\S]*?<\/mask>/)[0]
    .replace('id="mLeon"', 'id="simbolo"');
  const antes = og;
  og = og.replace(/<!--SIMBOLO[\s\S]*?<!--\/SIMBOLO-->/,
    '<!--SIMBOLO: lo reescribe herramientas/logo.cjs, no editar a mano-->\n    ' +
    maskNueva.trim() + '\n    <!--/SIMBOLO-->');
  if (og !== antes) {
    fs.writeFileSync(rutaOG, og, 'utf8');
    console.log('✔ herramientas/og.html actualizado (regenerá img/og.jpg desde ahí)');
  }
}

/* ⚠️ entrar.html estaba fuera de esta lista y tenía el dibujo COPIADO A MANO,
   con otra clase y otra máscara, así que el reemplazo nunca lo alcanzaba: al
   cambiar el logo, la pantalla de entrada se quedó con la canasta. Ahora usa
   <svg class="marca-svg"> como las otras dos y entra por la misma puerta. */
for (const archivo of ['tienda-publicada.html', 'admin.html', 'entrar.html']) {
  const ruta = path.join(RAIZ, archivo);
  if (!fs.existsSync(ruta)) continue;
  let s = fs.readFileSync(ruta, 'utf8');
  const antes = s;

  /* el símbolo del encabezado */
  s = s.replace(/<svg class="marca-svg"[\s\S]*?<\/svg>/, svgEnLinea);
  /* el favicon */
  s = s.replace(/<link rel="icon" href="[^"]*">/, '<link rel="icon" href="' + dataURI + '">');

  if (s !== antes) {
    fs.writeFileSync(ruta, s, 'utf8');
    console.log('✔ ' + archivo + ' actualizado (encabezado + favicon)');
  } else {
    console.log('– ' + archivo + ' sin cambios');
  }
}
