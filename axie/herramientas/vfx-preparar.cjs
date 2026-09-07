#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   PREPARAR LOS ATLAS DE VFX PARA LA WEB
   ──────────────────────────────────────────────────────────────────────────
   Los clips de `vfx/` vienen del Axie Origins Battle Kit, en la revisión que
   autorizan las reglas del Vibeathon:

       github.com/axieinfinity/axie-origins-asset-kit
       commit 069a59b772e54633d04a3d9d12ecde73b3e4be5d
       carpeta web-vfx/public/vfx/

   Tal como vienen no se pueden usar en un juego web, por dos razones:

   1. EL RECUADRO. Están grabados sobre un fondo que NO es negro puro, sino
      [19,22,27] — así lo declara cada `clip.json` en `source.background`. Se
      dibujan en modo aditivo, o sea sumando luz, y esos 19 puntos se suman
      también: alrededor del efecto aparece el rectángulo del cuadro, más
      claro que el suelo. Sobre el fondo oscuro del visor del kit no se nota;
      sobre la tierra de Lunacia sí. Acá se le RESTA el fondo a cada pixel y
      se recorta en cero, con lo cual el negro pasa a ser negro de verdad y
      deja de sumar nada.

   2. EL PESO EN MEMORIA. Un PNG de 400 KB no ocupa 400 KB cuando el navegador
      lo abre: ocupa ancho × alto × 4 bytes. El atlas de `fury_on_transfrom`
      mide 4848×5940, o sea 110 MB de RAM él solo. Los cinco clips de una
      corrida sumaban 243 MB. En una computadora pasa; en el celular —y este
      juego tiene joystick, se juega en el celular— eso tumba la pestaña.
      Acá se achican a la mitad de lado, que es 1/4 de memoria y de descarga.

   ⚠️ La mitad NO pierde nada visible: el efecto se dibuja sobre una quimera
   de unos 40 px, o sea a escala ~0,45 del cuadro original. A la mitad queda
   dibujándose casi 1:1, que es lo más nítido que puede estar.

   ⚠️ Se achica CUADRO POR CUADRO, no el atlas entero de una. Nueve de los
   quince clips tienen cuadros de lado impar (589×265, 763×371…), y promediar
   de a 2×2 sobre el atlas completo mezclaría el borde derecho de un cuadro
   con el izquierdo del siguiente: el efecto arrastraría un fantasma del
   cuadro vecino.

   El `clip.json` queda anotado con `preparado`, y el que dibuja lo lee para
   compensar la escala. Correrlo dos veces no hace nada: ya está anotado.

   Para rehacerlo desde cero: bajar de nuevo la carpeta del commit de arriba
   y volver a correr esto. No hay ningún paso a mano.

   ⚠️ Si algún día se vuelven a preparar, OJO CON LA CACHÉ. `serve.js` manda los
   PNG con `max-age=604800`, siete días: el navegador se queda con el atlas
   viejo mientras el `clip.json` (que va `no-cache`) ya es el nuevo. Los cuadros
   se leen entonces con las medidas nuevas sobre una imagen vieja y el efecto
   sale vacío o cortado. Pasó durante el desarrollo y tardó un rato en
   entenderse, porque el archivo en disco estaba perfecto. Es el mismo problema
   que el `img/og.jpg` de la tienda: si la URL no cambia, nadie se entera de que
   hay otra versión. La salida es la misma — cambiarle el nombre al archivo o
   colgarle una versión a la URL.

   Uso:  node herramientas/vfx-preparar.cjs
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, '..', 'vfx');
const ESCALA = 0.5;

/* ══ PNG a mano ══
   El proyecto no tiene dependencias y no las va a tener por esto. Los atlas
   son todos RGBA de 8 bits sin entrelazar, que es el caso más simple del
   formato: alcanza con zlib, que ya viene con Node. */

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let TABLA_CRC = null;
function crc32(buf){
  if (!TABLA_CRC){
    TABLA_CRC = new Int32Array(256);
    for (let n = 0; n < 256; n++){
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      TABLA_CRC[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function leerPng(buf){
  if (!buf.subarray(0, 8).equals(FIRMA)) throw new Error('no es un PNG');
  let off = 8, cabecera = null;
  const datos = [];
  while (off < buf.length){
    const largo = buf.readUInt32BE(off);
    const tipo = buf.toString('ascii', off + 4, off + 8);
    const cuerpo = buf.subarray(off + 8, off + 8 + largo);
    if (tipo === 'IHDR'){
      cabecera = {
        w: cuerpo.readUInt32BE(0), h: cuerpo.readUInt32BE(4),
        profundidad: cuerpo[8], tipo: cuerpo[9], entrelazado: cuerpo[12]
      };
    } else if (tipo === 'IDAT') datos.push(cuerpo);
    else if (tipo === 'IEND') break;
    off += 12 + largo;
  }
  if (!cabecera) throw new Error('sin IHDR');
  if (cabecera.profundidad !== 8 || cabecera.tipo !== 6 || cabecera.entrelazado !== 0)
    throw new Error('solo sé leer RGBA de 8 bits sin entrelazar');

  const crudo = zlib.inflateSync(Buffer.concat(datos));
  const w = cabecera.w, h = cabecera.h;
  const paso = w * 4;
  const pix = Buffer.alloc(h * paso);

  /* Deshacer los filtros por fila. Es la parte del formato que no se puede
     saltear: cada fila dice con qué predicción se guardó. */
  for (let y = 0; y < h; y++){
    const filtro = crudo[y * (paso + 1)];
    const ent = crudo.subarray(y * (paso + 1) + 1, y * (paso + 1) + 1 + paso);
    const sal = pix.subarray(y * paso, y * paso + paso);
    const arriba = y > 0 ? pix.subarray((y - 1) * paso, (y - 1) * paso + paso) : null;
    for (let x = 0; x < paso; x++){
      const a = x >= 4 ? sal[x - 4] : 0;
      const b = arriba ? arriba[x] : 0;
      const c = (arriba && x >= 4) ? arriba[x - 4] : 0;
      let v = ent[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4){
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      sal[x] = v & 0xff;
    }
  }
  return { w: w, h: h, pix: pix };
}

function escribirPng(w, h, pix){
  const paso = w * 4;
  const crudo = Buffer.alloc(h * (paso + 1));
  for (let y = 0; y < h; y++){
    crudo[y * (paso + 1)] = 0;                       // sin filtro: comprime bien igual
    pix.copy(crudo, y * (paso + 1) + 1, y * paso, y * paso + paso);
  }
  const trozo = function(tipo, cuerpo){
    const t = Buffer.from(tipo, 'ascii');
    const largo = Buffer.alloc(4); largo.writeUInt32BE(cuerpo.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, cuerpo])));
    return Buffer.concat([largo, t, cuerpo, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    FIRMA,
    trozo('IHDR', ihdr),
    trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0))
  ]);
}

/* ══ el trabajo ══ */

function prepararClip(id){
  const carpeta = path.join(DIR, id);
  const rutaJson = path.join(carpeta, 'clip.json');
  if (!fs.existsSync(rutaJson)) return null;
  const clip = JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
  if (clip.preparado) return { id: id, saltado: true };

  const rutaPng = path.join(carpeta, clip.atlas.file);
  const antes = fs.statSync(rutaPng).size;
  const img = leerPng(fs.readFileSync(rutaPng));
  const w = img.w, h = img.h, pix = img.pix;

  const fondo = clip.source.background || [0, 0, 0];
  const cols = clip.atlas.cols, rows = clip.atlas.rows;
  const fw = clip.atlas.frameW, fh = clip.atlas.frameH;
  const nfw = Math.ceil(fw * ESCALA), nfh = Math.ceil(fh * ESCALA);
  const nw = cols * nfw, nh = rows * nfh;
  const salida = Buffer.alloc(nw * nh * 4);

  /* Cuadro por cuadro: se le resta el fondo a los cuatro pixeles de origen,
     se recortan en cero y recién ahí se promedian. Restar después de
     promediar dejaría un halo, porque el promedio de un borde ya mezclado
     nunca baja del fondo. */
  for (let f = 0; f < clip.frames; f++){
    const col = f % cols, fila = Math.floor(f / cols);
    const ox = col * fw, oy = fila * fh;
    const dx0 = col * nfw, dy0 = fila * nfh;
    for (let y = 0; y < nfh; y++){
      for (let x = 0; x < nfw; x++){
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let sy = 0; sy < 2; sy++){
          for (let sx = 0; sx < 2; sx++){
            const px = x * 2 + sx, py = y * 2 + sy;
            if (px >= fw || py >= fh) continue;      // borde de un cuadro impar
            const i = ((oy + py) * w + (ox + px)) * 4;
            r += Math.max(0, pix[i]     - fondo[0]);
            g += Math.max(0, pix[i + 1] - fondo[1]);
            b += Math.max(0, pix[i + 2] - fondo[2]);
            a += pix[i + 3];
            n++;
          }
        }
        const j = ((dy0 + y) * nw + (dx0 + x)) * 4;
        salida[j]     = Math.round(r / n);
        salida[j + 1] = Math.round(g / n);
        salida[j + 2] = Math.round(b / n);
        salida[j + 3] = Math.round(a / n);
      }
    }
  }

  fs.writeFileSync(rutaPng, escribirPng(nw, nh, salida));
  const despues = fs.statSync(rutaPng).size;

  /* Todo lo que está medido en pixeles del cuadro se achica igual */
  const medio = function(v){ return { x: v.x * ESCALA, y: v.y * ESCALA }; };
  clip.atlas.frameW = nfw;
  clip.atlas.frameH = nfh;
  clip.crop = { x: clip.crop.x * ESCALA, y: clip.crop.y * ESCALA, w: nfw, h: nfh };
  clip.anchor = Object.assign({}, clip.anchor, medio(clip.anchor));
  if (clip.attackerInCrop)  clip.attackerInCrop  = medio(clip.attackerInCrop);
  if (clip.captureAttacker) clip.captureAttacker = medio(clip.captureAttacker);
  if (clip.captureDefender) clip.captureDefender = medio(clip.captureDefender);
  clip.preparado = {
    escala: ESCALA,
    fondoDescontado: fondo,
    origen: 'axieinfinity/axie-origins-asset-kit@069a59b772e54633d04a3d9d12ecde73b3e4be5d'
  };
  fs.writeFileSync(rutaJson, JSON.stringify(clip, null, 2));

  return {
    id: id, w: w, h: h, nw: nw, nh: nh, antes: antes, despues: despues,
    ramAntes: w * h * 4 / 1048576, ramDespues: nw * nh * 4 / 1048576
  };
}

const ids = fs.readdirSync(DIR).filter(function(d){
  return fs.existsSync(path.join(DIR, d, 'clip.json'));
});
let ra = 0, rd = 0, da = 0, dd = 0, hechos = 0, saltados = 0;
for (const id of ids){
  const r = prepararClip(id);
  if (!r) continue;
  if (r.saltado){ saltados++; console.log('   ya estaba  ' + id); continue; }
  hechos++;
  ra += r.ramAntes; rd += r.ramDespues; da += r.antes; dd += r.despues;
  console.log('   ' + id.padEnd(20) +
    (r.w + 'x' + r.h).padStart(11) + ' -> ' + (r.nw + 'x' + r.nh).padEnd(11) +
    '  disco ' + (r.antes / 1048576).toFixed(2) + ' -> ' + (r.despues / 1048576).toFixed(2) + ' MB' +
    '  RAM ' + r.ramAntes.toFixed(0) + ' -> ' + r.ramDespues.toFixed(0) + ' MB');
}
console.log('\n' + hechos + ' clips preparados' + (saltados ? ', ' + saltados + ' ya estaban' : ''));
if (hechos) console.log('   disco  ' + (da / 1048576).toFixed(1) + ' -> ' + (dd / 1048576).toFixed(1) + ' MB' +
  '\n   RAM    ' + ra.toFixed(0) + ' -> ' + rd.toFixed(0) + ' MB si se cargaran todos');
