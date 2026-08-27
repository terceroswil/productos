/* La franja a color del logo (león + nombre) y la hoja para verla a tamaño real.

   El dibujo NO está acá: sale de logo-dibujo.cjs, el mismo que usa logo.cjs
   para los íconos. Si el león se corrige, se corrige en un solo lugar.

   La franja es 400×100 (4:1). A 375 px de ancho eso son 94 px de alto, y va en
   lugar del <h1> de la portada, que hoy se lleva 75: cuesta 19 px. La imagen de
   Facebook, al ser 2:1, costaría 185 y dejaría el primer producto abajo del
   pliegue. */

const fs = require('fs');
const path = require('path');
const { LEON, LEON_COLOR, LEON_DETALLE, CENTRAR } = require('./logo-dibujo.cjs');
const RAIZ = path.join(__dirname, '..');

const svg = (vb, w, h, dentro) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}" height="${h}">${dentro}\n</svg>\n`;

/* El nombre va en <text> con la misma tipografía que los títulos de la tienda
   (--f-display), no en trazos: acá el logo convive con los títulos de la
   página, así que conviene que sea la misma letra y no una parecida.

   ⚠️ Pero la tienda no carga tipografías: usa las del aparato, y "Trebuchet MS"
   no existe en Android, donde cae en Roboto. Con anchos distintos el nombre se
   salía de los 400 de ancho en unos teléfonos y quedaba corto en otros. Lo
   arregla `textLength`: se le fija el ancho exacto y el navegador estira o
   aprieta lo que haga falta. Así ocupa lo mismo en todos lados.               */
const FUENTE = "'Trebuchet MS','Segoe UI',system-ui,sans-serif";
const franja = (tinta, tenue, suf = 'f') => svg('0 0 400 100', 400, 100,
  `\n  <g transform="translate(-4,4) scale(.86)">${LEON_COLOR(suf)}</g>`
  + `\n  <g font-family="${FUENTE}" text-anchor="start">`
  + `\n    <text x="100" y="55" font-size="38" font-weight="800" fill="${tinta}"`
  + `\n      textLength="288" lengthAdjust="spacingAndGlyphs">LOS CASERITOS</text>`
  + `\n    <text x="102" y="79" font-size="15" font-weight="700" fill="${tenue}"`
  + `\n      textLength="284" lengthAdjust="spacing">DEL TRÓPICO</text>`
  + `\n  </g>`);

/* ── El logo del encabezado ─────────────────────────────────────────────────
   NO es la franja de la portada achicada, y esa es la parte importante.
   En la franja el león es tan alto como todo el bloque y el nombre mide 38 de
   100. Puesta en el encabezado, donde el alto disponible son ~42 px, el nombre
   salía a 16 px y "DEL TRÓPICO" a 6 px — contra los 20 y 10 px que medían el
   título y el subtítulo que reemplaza. O sea: se leía PEOR que antes.

   ⚠️ El que tiene que achicarse es el LEÓN, no el texto. Acá ocupa 56 de 56 de
   alto pero solo 56 de 300 de ancho (19%), y el nombre se lleva el resto:
   con el bloque a 42 px, "LOS CASERITOS" sale a 22 px y "DEL TRÓPICO" a 9,4.
   Los dos quedan iguales o mejor que el texto que había.

   Va INCRUSTADO en el HTML, no como <img>, por dos razones: así los colores
   salen de las variables CSS de la tienda y el logo cambia solo entre el modo
   claro y el oscuro (un <img> necesitaría dos archivos y un <picture>), y así
   no hay una descarga más en cada visita.
   El león sí lleva sus colores fijos: es la marca, y el naranja se lee bien
   sobre los dos fondos.                                                       */
const encabezado = () =>
  `<svg class="marca-franja" viewBox="0 0 300 56" role="img"`
  + ` aria-label="Los Caseritos del Trópico">`
  + `\n  <g transform="scale(.56)">${LEON_DETALLE('h')}</g>`
  + `\n  <g font-family="${FUENTE}" text-anchor="start">`
  + `\n    <text x="66" y="32" font-size="30" font-weight="800" fill="currentColor"`
  + `\n      textLength="228" lengthAdjust="spacingAndGlyphs">LOS CASERITOS</text>`
  + `\n    <text x="68" y="49" font-size="12.5" font-weight="700" style="fill:var(--amber)"`
  + `\n      textLength="224" lengthAdjust="spacing">DEL TRÓPICO</text>`
  + `\n  </g>\n</svg>`;

const DEG_VERDE = `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#17c07f"/><stop offset="1" stop-color="#0a7d54"/>
  </linearGradient></defs>`;
const iconoCompleto = svg('0 0 100 100', 100, 100, DEG_VERDE
  + `\n  <rect width="100" height="100" rx="26" fill="url(#g)"/>`
  + `\n  <g transform="${CENTRAR('.78')}">${LEON('#ffffff')}</g>`);
const iconoFavicon = svg('0 0 100 100', 100, 100,
  `\n  <rect width="100" height="100" rx="22" fill="#0a7d54"/>`
  + `\n  <g transform="${CENTRAR('.8')}">${LEON('#ffffff', 'mFav', true)}</g>`);

fs.mkdirSync(path.join(RAIZ, 'logos'), { recursive: true });
const guardar = (n, s) => fs.writeFileSync(path.join(RAIZ, 'logos', n), s);
guardar('franja-clara.svg', franja('#0f2119', '#e8761f'));
guardar('franja-oscura.svg', franja('#eaf5ee', '#ffb056'));

/* ── Hoja de comparación ────────────────────────────────────────────────────
   Mismo criterio que logos/comparar-tamanos.html: verlo al tamaño en que se va
   a usar de verdad, no ampliado. Un logo que solo funciona a 400 px no sirve
   para un encabezado de 36. Va todo en línea, sin <img src>, así el archivo se
   abre con doble clic y se puede mandar suelto por WhatsApp.                  */
const enLinea = (s) => s.replace(/<svg[^>]*>/, m =>
  m.replace(/ width="\d+" height="\d+"/, '')).replace(/\n\s*/g, '');
const conIds = (s, suf) => enLinea(s).replace(/mLeon|mFav|mel|car/g, m => m + suf)
  .replace(/id="g"/g, `id="g${suf}"`).replace(/url\(#g\)/g, `url(#g${suf})`);

const hoja = `<!doctype html><meta charset="utf-8"><title>Logo — Los Caseritos</title>
<style>
  body{margin:0;font:15px/1.5 "Segoe UI",system-ui,sans-serif;background:#f6f9f4;color:#0f2119}
  .oscuro{background:#0a140f;color:#eaf5ee}
  section{padding:26px 24px;border-bottom:1px solid #0002}
  h2{font:700 13px/1 "Segoe UI";letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin:0 0 16px}
  .fila{display:flex;align-items:flex-end;gap:26px;flex-wrap:wrap}
  .caso{text-align:center}
  .caso small{display:block;margin-top:7px;font-size:11px;opacity:.55}
  .cel{width:375px;border:1px solid #0003;border-radius:14px;overflow:hidden;background:inherit}
  .cel .barra{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #0002}
  .cel .barra b{font:800 20px/1 "Trebuchet MS";letter-spacing:-.02em}
  .cel .barra small{display:block;font:600 8px/1.6 "Segoe UI";letter-spacing:.14em;opacity:.6}
  .cel .franja{padding:10px 16px}
  .cuadrito{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;
    background:linear-gradient(135deg,#17c07f,#0a7d54)}
  /* en proporción y no en px fijos: el mismo cuadrito se muestra a 16, 36 y 120 */
  .cuadrito svg{width:67%;height:67%}
</style>
<section>
  <h2>Tamaños reales — el cuadrito del encabezado y los íconos</h2>
  <div class="fila">
    <div class="caso"><span style="display:inline-block;width:16px;height:16px">${conIds(iconoFavicon, 'a')}</span><small>16 · favicon</small></div>
    <div class="caso"><span style="display:inline-block;width:36px;height:36px">${conIds(iconoCompleto, 'b')}</span><small>36 · encabezado</small></div>
    <div class="caso"><span style="display:inline-block;width:64px;height:64px">${conIds(iconoCompleto, 'c')}</span><small>64</small></div>
    <div class="caso"><span style="display:inline-block;width:120px;height:120px">${conIds(iconoCompleto, 'd')}</span><small>120 · pantalla de inicio</small></div>
  </div>
</section>
<section>
  <h2>La franja de la portada, al ancho de un celular (375 px)</h2>
  <div class="fila">
    <div class="cel">
      <div class="barra"><span class="cuadrito">${conIds(LEON('#ffffff').replace(/^/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">') + '</svg>', 'e')}</span>
        <span><b>Los <span style="color:#0ea06a">Caseritos</span></b><small>IVIRGARZAMA · CHAPARE</small></span></div>
      <div class="franja">${conIds(franja('#0f2119', '#e8761f'), 'q')}</div>
    </div>
  </div>
</section>
<section class="oscuro">
  <h2>Lo mismo en modo oscuro</h2>
  <div class="fila">
    <div class="cel">
      <div class="barra"><span class="cuadrito">${conIds(LEON('#ffffff').replace(/^/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">') + '</svg>', 'g')}</span>
        <span><b>Los <span style="color:#2fd08f">Caseritos</span></b><small>IVIRGARZAMA · CHAPARE</small></span></div>
      <div class="franja">${conIds(franja('#eaf5ee', '#ffb056'), 'r')}</div>
    </div>
    <div class="caso"><span style="display:inline-block;width:120px;height:120px">${conIds(iconoCompleto, 'i')}</span><small>120</small></div>
  </div>
</section>
<section>
  <h2>Ampliado, para ver el dibujo</h2>
  <div class="fila">
    <div class="caso"><span style="display:inline-block;width:260px;height:260px">${conIds(iconoCompleto, 'j')}</span><small>ícono</small></div>
    <div class="caso"><span style="display:inline-block;width:420px">${conIds(franja('#0f2119', '#e8761f'), 's')}</span><small>franja</small></div>
  </div>
</section>`;

fs.writeFileSync(path.join(RAIZ, 'logos', 'logo-tamanos.html'), hoja, 'utf8');
console.log('✔ logos/franja-{clara,oscura}.svg');
console.log('✔ logos/logo-tamanos.html  → abrir para ver el logo a tamaño real');

/* ── Dejarlo puesto en el encabezado de la tienda ───────────────────────────
   Mismo criterio que logo.cjs: el dibujo se genera y se inyecta, nunca se
   copia a mano al HTML. Solo la tienda — el panel y la pantalla de entrada se
   quedan con el cuadrito verde, que es lo que corresponde a una herramienta
   interna y ocupa menos.
   ⚠️ Como la tienda ya no tiene <svg class="marca-svg">, logo.cjs va a decir
   "sin cambios" para ese archivo. No está roto: ahí solo le queda el favicon
   por reemplazar, y eso lo sigue haciendo.                                    */
/* El león a color también va a la plantilla de la imagen de compartir, por la
   misma vía que logo.cjs usa para el símbolo blanco: entre marcadores, para
   poder reescribirlo sin tocar el resto del diseño. */
const rutaOG = path.join(RAIZ, 'herramientas', 'og.html');
if (fs.existsSync(rutaOG)) {
  let og = fs.readFileSync(rutaOG, 'utf8');
  const antes = og;
  og = og.replace(/<!--LEONCOLOR[\s\S]*?<!--\/LEONCOLOR-->/,
    '<!--LEONCOLOR: lo reescribe herramientas/logo-franja.cjs, no editar a mano-->' +
    LEON_DETALLE('og') + '\n    <!--/LEONCOLOR-->');
  if (og !== antes) {
    fs.writeFileSync(rutaOG, og, 'utf8');
    console.log('✔ herramientas/og.html: león a color actualizado');
  }
}

const rutaTienda = path.join(RAIZ, 'tienda-publicada.html');
if (fs.existsSync(rutaTienda)) {
  let s = fs.readFileSync(rutaTienda, 'utf8');
  const antes = s;
  /* Hay que mirar si el marcador ESTÁ, aparte de si el archivo cambió: si solo
     se compara el antes con el después, correrlo dos veces seguidas (que no
     cambia nada, porque ya está puesto) da el mismo resultado que no encontrar
     el marcador, y el mensaje avisa de un problema que no existe. */
  const hayMarcador = /<svg class="marca-franja"[\s\S]*?<\/svg>/.test(s);
  s = s.replace(/<svg class="marca-franja"[\s\S]*?<\/svg>/, encabezado());
  if (!hayMarcador) {
    console.log('✖ tienda-publicada.html: falta <svg class="marca-franja"> en el .brand');
  } else if (s !== antes) {
    fs.writeFileSync(rutaTienda, s, 'utf8');
    console.log('✔ tienda-publicada.html: logo del encabezado actualizado');
  } else {
    console.log('– tienda-publicada.html: el logo ya estaba al día');
  }
}
