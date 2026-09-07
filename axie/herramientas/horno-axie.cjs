#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   EL HORNO: cocina los Axies del mixer oficial a láminas de sprites
   ──────────────────────────────────────────────────────────────────────────
   El Axie del jugador tiene que SER un Axie, no un dibujo parecido. El camino
   oficial para eso es `@axieinfinity/mixer` (MIT, del equipo de Sky Mavis),
   que arma el esqueleto de un Axie a partir de sus genes y lo anima con Spine.

   Pero ese camino no se puede meter dentro del juego, por tres razones:

   1. El juego no tiene compilador ni dependencias, y el mixer arrastra
      PixiJS, pixi-spine y buffer.
   2. Las texturas de las partes salen de `axiecdn.axieinfinity.com`. Meterlas
      en el camino crítico es atar el arranque del juego a un servidor ajeno.
   3. ⚠️ Y la más importante: las reglas del Vibeathon avisan que el kit trae
      datos de Spine pero NO la licencia del runtime, y que embarcar código de
      runtime de Spine pide una licencia aparte de Esoteric Software. Un
      runtime de Spine dentro del juego entregado es justo lo que no conviene.

   La salida es cocinar afuera. Este horno abre una página en el navegador que
   sí carga el mixer y Spine, arma el Axie, lo hace correr, fotografía los
   cuadros y los manda acá para que se guarden como una lámina PNG. En el
   juego entra la lámina y nada más: sin dependencias, sin CDN, sin runtime de
   Spine, y a la velocidad de un `drawImage`.

   ⚠️ Corre en el puerto 4321, aparte del 3001 de la tienda, para no tener que
   tocar `serve.js`. La lista blanca de `/api/guardar-imagen` de la tienda solo
   deja escribir og.jpg/png, y ampliarla para un asset de un juego sería
   agrandar la superficie de escritura del servidor de verdad por comodidad.
   Este proceso vive dos minutos y se apaga.

   Uso:
     node herramientas/horno-axie.cjs
     …abrir http://127.0.0.1:4321/ y esperar a que diga LISTO
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const SALIDA = path.join(RAIZ, 'arte', 'axies');
const PUERTO = 4321;

fs.mkdirSync(SALIDA, { recursive: true });

/* Solo acepta nombres de clase conocidos: es un servidor de escritura, aunque
   viva dos minutos y solo escuche en 127.0.0.1. */
const PERMITIDOS = new Set(['beast', 'plant', 'aqua', 'bird', 'bug', 'reptile']);

const servidor = http.createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    const html = fs.readFileSync(path.join(__dirname, 'horno-axie.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (req.method === 'POST' && req.url === '/guardar') {
    let cuerpo = '';
    let corto = false;
    req.on('data', c => {
      cuerpo += c;
      if (cuerpo.length > 20 * 1024 * 1024) { corto = true; req.destroy(); }
    });
    req.on('end', () => {
      if (corto) return;
      try {
        const d = JSON.parse(cuerpo);
        if (!PERMITIDOS.has(d.clase)) throw new Error('clase no permitida: ' + d.clase);
        const b64 = String(d.png || '').replace(/^data:image\/png;base64,/, '');
        if (!b64) throw new Error('sin imagen');
        const archivo = path.join(SALIDA, d.clase + '.png');
        const bytes = Buffer.from(b64, 'base64');
        fs.writeFileSync(archivo, bytes);

        /* ⚠️ La VERSIÓN de la lámina, y no es un adorno. El `.json` se sirve con
           `no-cache` pero el PNG lleva siete días de caché: al recocinar, el
           juego lee las coordenadas nuevas sobre la imagen VIEJA y el Axie
           desaparece en los cuadros que antes no existían. Pasó de verdad y
           costó un rato entenderlo, porque el archivo en disco estaba perfecto.
           Con la versión pegada a la URL, otra imagen es otra dirección y la
           caché no tiene nada que decir. Es lo mismo que hay que hacer con
           `img/og.jpg` en la tienda. */
        d.meta.version = require('crypto').createHash('sha1')
          .update(bytes).digest('hex').slice(0, 8);
        fs.writeFileSync(path.join(SALIDA, d.clase + '.json'), JSON.stringify(d.meta, null, 2));
        const kb = (fs.statSync(archivo).size / 1024).toFixed(0);
        console.log('  guardado  ' + d.clase.padEnd(8) + kb.padStart(5) + ' KB   ' +
                    d.meta.cols + 'x' + d.meta.filas + ' cuadros de ' +
                    d.meta.ancho + 'x' + d.meta.alto);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, kb: Number(kb) }));
      } catch (e) {
        console.error('  ERROR: ' + e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end('no');
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('\n  El horno está encendido.');
  console.log('  Abrí  http://127.0.0.1:' + PUERTO + '/  y esperá a que diga LISTO.');
  console.log('  Las láminas van a ' + path.relative(RAIZ, SALIDA) + '\\\n');
});
