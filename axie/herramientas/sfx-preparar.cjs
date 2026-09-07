#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   BAJAR Y PREPARAR LOS SONIDOS DE BATALLA DE ORIGINS
   ──────────────────────────────────────────────────────────────────────────
   El juego sonaba a bips sintetizados con la Web Audio API. El Battle Kit trae
   los 130 sonidos de batalla de Axie Infinity: Origins, y —esto es lo bueno—
   con los nombres calzados uno a uno con los efectos que el juego ya
   reproduce: el clip `beast_gore` tiene su `beast_gore_attack.wav`.

       github.com/axieinfinity/axie-origins-asset-kit
       commit 069a59b772e54633d04a3d9d12ecde73b3e4be5d
       web-vfx/public/sfx/

   ⚠️ Vienen en `.wav` y NO se pueden usar así: los 16 que hacen falta pesan
   3,4 MB sin comprimir. En Vorbis mono a 96 kbps bajan a menos de 700 KB, que
   es lo que uno se puede permitir en un juego que también se juega con datos
   móviles. Mono a propósito: son golpes cortos, el estéreo no aporta nada y
   duplica el peso.

   ⚠️ NO existe sonido de Fury Form ni de Rage en el kit. Fury usa
   `power_awaken`, que es el efecto de "poder que despierta" y es lo más
   parecido que hay. Está anotado acá para que nadie lo busque de nuevo.

   Necesita `ffmpeg` en el PATH. Correrlo dos veces no rehace lo que ya está.

   Uso:  node herramientas/sfx-preparar.cjs
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const COMMIT = '069a59b772e54633d04a3d9d12ecde73b3e4be5d';
const BASE = 'https://raw.githubusercontent.com/axieinfinity/axie-origins-asset-kit/' +
             COMMIT + '/web-vfx/public/sfx/';
const SALIDA = path.join(__dirname, '..', 'arte', 'sfx');

/* Qué se baja y para qué. La clave es el nombre con el que lo pide el juego. */
const SONIDOS = {
  // los doce golpes: <clase>_<ataque>, igual que el id del clip de VFX
  'beast_gore':    'beast_gore_attack.wav',
  'beast_bite':    'beast_bite_attack.wav',
  'beast_smash':   'beast_smash_attack.wav',
  'plant_gore':    'plant_gore_attack.wav',
  'plant_bite':    'plant_bite_attack.wav',
  'plant_smash':   'plant_smash_attack.wav',
  'aquatic_gore':  'aquatic_gore_attack.wav',
  'aquatic_bite':  'aquatic_bite_attack.wav',
  'aquatic_smash': 'aquatic_smash_attack.wav',
  'bird_gore':     'bird_gore_attack.wav',
  'bird_bite':     'bird_bite_attack.wav',
  'bird_smash':    'bird_smash_attack.wav',
  // los de estado
  'curar':   'heal.wav',          // Espalda, corazones y la runa de hoja
  'escudo':  'shield.wav',        // al equipar una Runa
  'hoja':    'leaf.wav',          // Way of Plant
  'fury':    'power_awaken.wav',  // ⚠️ no hay sonido de Fury en el kit
  'nivel':   'power_gain.wav'     // subir de nivel
};

function hayFfmpeg(){
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

if (!hayFfmpeg()){
  console.error('\n  Falta ffmpeg en el PATH. Sin él no se pueden convertir los .wav.\n');
  process.exit(1);
}

fs.mkdirSync(SALIDA, { recursive: true });

const tmp = path.join(SALIDA, '_tmp.wav');
let bajados = 0, saltados = 0, wav = 0, ogg = 0;

for (const [nombre, archivo] of Object.entries(SONIDOS)){
  const destino = path.join(SALIDA, nombre + '.ogg');
  if (fs.existsSync(destino)){ saltados++; continue; }

  try {
    execFileSync('curl', ['-sfL', '--max-time', '60', BASE + archivo, '-o', tmp]);
    const antes = fs.statSync(tmp).size;

    /* mono, 96 kbps, Vorbis. `-map_metadata -1` saca las etiquetas que trae el
       wav: son bytes que no sirven de nada dentro de un juego. */
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp,
      '-ac', '1', '-c:a', 'libvorbis', '-b:a', '96k', '-map_metadata', '-1', destino]);

    const despues = fs.statSync(destino).size;
    wav += antes; ogg += despues; bajados++;
    console.log('  ' + nombre.padEnd(16) + archivo.padEnd(28) +
      (antes / 1024).toFixed(0).padStart(5) + ' KB -> ' +
      (despues / 1024).toFixed(0).padStart(4) + ' KB');
  } catch (e) {
    console.error('  FALLO ' + nombre + ' (' + archivo + '): ' + (e.message || e));
  }
}

if (fs.existsSync(tmp)) fs.unlinkSync(tmp);

console.log('\n  ' + bajados + ' sonidos preparados' + (saltados ? ', ' + saltados + ' ya estaban' : ''));
if (bajados) console.log('  ' + (wav / 1048576).toFixed(1) + ' MB en wav  ->  ' +
                         (ogg / 1048576).toFixed(2) + ' MB en ogg');
