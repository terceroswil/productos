/* Genera todas las variantes del logo de Los Caseritos (opción B: casita + canasta) */
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');

/* El símbolo: techo de casa sobre una canasta.

   ⚠️ El techo con rayas debajo se leía como el botón "expulsar" de un reproductor.
   Lo que lo desambigua es el LABIO de la canasta: una barra ancha que sobresale
   del cuerpo. Con eso el ojo lee "cesta" y no "triángulo sobre líneas".
   El techo además lleva alero (más ancho que la canasta) y el cuerpo es un
   trapecio marcado, que se angosta hacia abajo como una canasta de verdad.

   Las ranuras se recortan con una máscara, así el fondo (degradado o color)
   se ve a través y nunca hay que adivinar el color de las líneas. */
const SIMBOLO = (color) => `
  <mask id="mCanasta">
    <rect width="100" height="100" fill="black"/>
    <path d="M50 10 L94 44 A5 5 0 0 1 91 52 H9 A5 5 0 0 1 6 44 Z" fill="white"/>
    <rect x="13" y="58" width="74" height="12" rx="5" fill="white"/>
    <path d="M20 72 H80 L71 91 A4 4 0 0 1 67 93 H33 A4 4 0 0 1 29 91 Z" fill="white"/>
    <g stroke="black" stroke-width="4.5" stroke-linecap="round">
      <path d="M27 81 H73"/>
    </g>
  </mask>
  <rect width="100" height="100" fill="${color}" mask="url(#mCanasta)"/>`;

const DEGRADADO = `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#17c07f"/><stop offset="1" stop-color="#0a7d54"/>
  </linearGradient></defs>`;

const envolver = (contenido, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${extra}${contenido}\n</svg>\n`;

/* 1. Símbolo suelto en blanco — va DENTRO del cuadrito verde del encabezado,
      que ya trae su degradado por CSS. */
const simboloBlanco = envolver(SIMBOLO('#ffffff'));

/* El símbolo ocupa de x6–94 e y10–93 (centro 50, 51.5). Dentro del cuadrito hay
   que encogerlo para que no toque los bordes redondeados. */
const CENTRAR = (escala) => `translate(50,50) scale(${escala}) translate(-50,-51.5)`;

/* 2. Logo completo: cuadrito con degradado + símbolo calado */
const logoCompleto = envolver(
  `\n  <rect width="100" height="100" rx="26" fill="url(#g)"/>` +
  `\n  <g transform="${CENTRAR('.74')}">${SIMBOLO('#ffffff')}</g>`,
  DEGRADADO);

/* 3. Ícono PWA: igual al logo completo */
const iconoApp = logoCompleto;

/* 4. Ícono enmascarable: fondo lleno y símbolo más chico (Android le recorta los bordes) */
const iconoMascara = envolver(
  `\n  <rect width="100" height="100" fill="#0a7d54"/>` +
  `\n  <g transform="${CENTRAR('.58')}">${SIMBOLO('#ffffff')}</g>`);

fs.mkdirSync(path.join(RAIZ, 'logos'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'logos', 'simbolo-blanco.svg'), simboloBlanco);
fs.writeFileSync(path.join(RAIZ, 'logo.svg'), logoCompleto);
fs.writeFileSync(path.join(RAIZ, 'icono.svg'), iconoApp);
fs.writeFileSync(path.join(RAIZ, 'icono-mascara.svg'), iconoMascara);

/* 5. Favicon como data URI: versión plana, sin degradado (a 16 px no se nota
      y el archivo queda mucho más corto dentro del HTML) */
const favicon = envolver(
  `\n  <rect width="100" height="100" rx="22" fill="#0a7d54"/>` +
  `\n  <g transform="${CENTRAR('.76')}">${SIMBOLO('#ffffff')}</g>`).replace(/\n\s*/g, '');
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
  const maskNueva = SIMBOLO('#ffffff')
    .match(/<mask id="mCanasta">[\s\S]*?<\/mask>/)[0]
    .replace('id="mCanasta"', 'id="simbolo"');
  const antes = og;
  og = og.replace(/<!--SIMBOLO[\s\S]*?<!--\/SIMBOLO-->/,
    '<!--SIMBOLO: lo reescribe herramientas/logo.cjs, no editar a mano-->\n    ' +
    maskNueva.trim() + '\n    <!--/SIMBOLO-->');
  if (og !== antes) {
    fs.writeFileSync(rutaOG, og, 'utf8');
    console.log('✔ herramientas/og.html actualizado (regenerá img/og.jpg desde ahí)');
  }
}

for (const archivo of ['tienda-publicada.html', 'admin.html']) {
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
