# Entrega — Axie Vibeathon 2026

Todo lo que va en el formulario, ya escrito y listo para pegar.

Actualizado el 7 de septiembre de 2026, con el formulario real a la vista y la
Zona Corrupta ya en el juego.

---

## Las fechas, que son tres y se confunden

| | cuándo | estado |
|---|---|---|
| Cierre de **registro** | 7 de septiembre, 13:00 UTC | ✅ ya hecho, el 3 de septiembre |
| **Apertura** de envíos | **8 de septiembre, 13:00 UTC** | ⏳ es lo único que falta para poder enviar |
| **Cierre** de envíos | **21 de septiembre, 13:00 UTC** | el plazo de verdad |

⚠️ **El 8 es cuando se ABRE, no cuando cierra.** El panel lo dice: el único
*"item left"* es *"Submissions are not open"*, y se resuelve solo. No falta
ningún dato del autor para poder enviar.

Eso deja **15 días de trabajo**, no dos. Y como el propio panel avisa que
*"Your Project stays editable. If you make changes later, submit again to
create a new version"*, la jugada es:

1. **El 8, apenas abre, enviar.** Que exista un envío válido desde el primer
   día. Un envío guardado no cuenta: hoy el panel dice *"No submissions yet"*.
2. **Seguir trabajando hasta el 21** y volver a enviar. Cada envío crea un
   recibo nuevo y conserva los anteriores.

---

## ⚠️ Lo que hay que arreglar antes de enviar

### 1. La descripción guardada es del 3 de septiembre y dice dos cosas falsas

La versión guardada quedó congelada **antes** de los jefes, del final de
corrida, del sonido oficial, de los iconos, de las animaciones del Axie y de
toda la capa de presentación. Además afirma esto:

> ⭐ **Ascension System:** Maximize your body parts to trigger full Axie
> Ascension, unleashing ultimate celestial attacks!

Las dos mitades están mal, y se comprueba en el código:

- La Ascensión **no se dispara maximizando las partes**. Va cada 10 niveles del
  Axie (10, 20, 30, 40, 50, 60), como en Axie de verdad.
- **No hay "ultimate celestial attacks".** Lo que hace la Ascensión es subir el
  TECHO de las partes permanentes: `techoDePartes = min(5, 1 + ascensiones)`.

Un jurado que juegue diez minutos busca el ataque celestial y no lo encuentra.
Es la clase de cosa que cuesta más cara que la funcionalidad que promete.

### 2. `Inputs: Keyboard Mouse Touch` — el mouse no se usa para jugar

Verificado: **cero** `mousemove` y **cero** `mousedown` en todo el juego. El
mouse sirve para tocar botones de menú y nada más. Va `Keyboard, Touch`.

### 3. El enlace jugable depende de que esta computadora esté prendida

`https://loscaseritos.com/axie` sale de esta PC por un túnel de Cloudflare y
vive mientras la ventana de `INICIAR.bat` esté abierta (ver
`deploy/COMO-ESTA-PUBLICADA.md`). Comprobado el 6 de septiembre: contesta 200
en 0,59 s, sirve la versión de hoy, y los `.ogg` salen como `audio/ogg`.

El propio formulario avisa: *"Saving confirms the link format, not that the
game is playable. Review checks whether judges can open it."* O sea que el
chequeo automático lo va a abrir de verdad.

Y no son dos semanas: el juzgamiento arranca DESPUÉS del cierre del 21 y la
página del Vibeathon dice **"Judging: Date pending"**. O sea que la PC tiene que
quedarse prendida un tiempo que todavía nadie sabe, sin abrir AutoTrópico —que
pelea por el puerto 3001— y sin un corte de luz.

**Decisión tomada el 7 de septiembre: se sostiene el túnel.** Queda anotado el
riesgo y qué hacer si se decide cambiar.

⚠️ **Si algún día se mueve, que NO sea a Netlify.** Verificado en su propia
página de precios: el plan gratis da **300 créditos con límite duro**, el ancho
de banda cuesta **20 créditos por GB** y cada publicación **15**. Son unos
10,5 GB al mes ≈ 2.100 sesiones, y **no hay excedente que se pueda pagar**: al
agotarlos el sitio se detiene hasta el mes siguiente. Para un juego que puede
aparecer en la galería pública del Vibeathon, ese es exactamente el modo de
falla que hay que evitar.

**Cloudflare Pages** es el que corresponde, y ya hay cuenta —el túnel y
`loscaseritos.com` pasan por ahí—. Su documentación dice: *"On both free and
paid plans, requests to static assets are free and unlimited"*, y este juego es
estático puro, sin Functions. Tope de 1.000 archivos y 25 MiB por archivo; el
juego tiene 85 y el más grande pesa 1,56 MB. Se sube arrastrando la carpeta
desde *Workers & Pages → Create application → Drag and drop*, y para actualizar
es *Create a new deployment* conservando la misma URL.

⚠️ **Y no se arrastra `axie/` entera**: todo lo que se sube queda descargable.
Van `index.html` + `arte/` + `vfx/` (85 archivos, 8,9 MB, con los LICENSE.md
adentro). Quedan afuera `MEJORAS.md` y `ENTREGA.md` —este archivo— que listan
todas las debilidades del juego, más `herramientas/` y `thumbnail.jpg`.

---

## Los campos, con su texto

### Descripción — reemplazar la guardada por esta

```
Axie Survivors: Core Evolution is a survivors-style roguelite that runs in a
browser with no build step and no dependencies — one HTML file plus a folder of
official Axie assets.

You adopt one Axie and name it. Each run you hold off waves of corrupted
Chimeras across Lunacia for ten minutes, with a named boss every two, and
harvest AXP. When you die the run resets — your Axie does not.

That is the whole idea. The AXP levels the same Axie run after run, and every
10 levels it can Ascend, which raises the ceiling of its permanent body-part
cards. The Axie Core doc asks third-party builders to feed the player's Axie
instead of building isolated experiences, and AXP is what a game at this tier
can legitimately feed. This game does not mint or promise tokens.

Reaching ten minutes is not the end but a door: extract with your bonus, or push
into the Corrupted Zone, where the threat level climbs a step every minute —
tougher Chimeras arriving faster, a boss every sixty seconds — and each step
adds 25% to that bonus. Die in there and you lose the bonus entirely. That is
the bet the endgame is built on.

Everything Axie on screen is the real thing, not an impression of it:

- Your Axie is generated by the official @axieinfinity/mixer from real genes and
  baked to a spritesheet with seven of its animations — run, idle, the three
  melee attacks, taking a hit, and activity/evolve, which is what plays on an
  Ascension.
- The Chimeras, the combat VFX, the battle SFX and the status icons all come
  from the Axie Origins Battle Kit, at the revision the rules authorise.
- Body-part cards for the Horn, Tail, Mouth, Back, Ears and Eyes, plus the class
  triangle, Runes, Charms, Potential Points, Rage and Fury Form — Origins
  systems adapted to the survivors format, not invented ones.
- Every Chimera wears its class as its colour, and the colour is a read on
  behaviour, not just a damage multiplier: Birds weave, Beasts telegraph and
  charge, Plants wall you in, Aquatics keep their distance and spit.

Delete the asset folders and the game still boots and plays, falling back to
hand-drawn creatures and synthesised audio. That was verified by deleting them,
not assumed.

Built with AI: Antigravity for the first playable prototype, then Claude Code
(Claude Opus 5) for the Axie Core persistence layer, the balance, the
official-asset integration and the presentation layer. The game is piloted from
the browser console frame by frame, so the design is measured rather than
guessed at. No AI-generated art or audio.
```

**Si el campo no acepta tanto**, cortar desde *"Every Chimera wears its class"*
y desde *"Delete the asset folders"*. Los dos primeros párrafos y la lista de
assets son los que cargan el 35 % de Encaje con Axie Core y no se tocan.

### Playable game link
```
https://loscaseritos.com/axie
```
⚠️ Ver el punto 3 de arriba antes de dejarlo así.

### How to play

| campo | valor |
|---|---|
| Devices | `Desktop, Mobile, Tablet` |
| Browsers | `Chromium, Firefox, Safari` |
| **Inputs** | `Keyboard, Touch` ← **sacar Mouse**, no se usa para jugar |
| Access | `None` |

### Player notes
```
Move with WASD / Arrow keys, or drag the joystick at the bottom left on a
phone. Pause with P, Esc, or the button in the HUD. Your Axie's cards fire on
their own cooldowns, so the only thing you steer is where it stands. Collect
AXP gems to level up; on each level-up you pick one of three — evolve a
body-part card, equip a Rune, or attach a Charm to a specific card. Survive ten
minutes to reach the extraction door, then choose: leave with your bonus, or
push into the Corrupted Zone for more. Your Axie keeps its AXP after you die.
```

### Herramientas de IA, si lo pide aparte
```
- Antigravity — the first playable prototype: render loop, wave spawning, the
  six body-part attacks, the mobile joystick, the synthesised audio.
- Claude Code (Claude Opus 5) — the Axie Core persistence layer, Runes, Charms,
  Potential Points, the class triangle, Rage and Fury Form, the balance work,
  the Origins VFX / SFX / status icons / Axie animations, and the presentation
  layer.

No AI-generated art or audio.
```

### Licencia y atribución, si lo pide aparte
```
The game — code, gameplay systems, the writing — is MIT.

arte/ and vfx/ are not. Those are Sky Mavis / Axie Infinity assets from the
Axie Origins Battle Kit at commit 069a59b772e54633d04a3d9d12ecde73b3e4be5d,
used under the limited licence the Vibeathon rules grant. LICENSE.md and Third
Party Notices.md sit in both folders and stay with any copy.
arte/PROCEDENCIA.md records which file came from which path of the kit and what
was done to it. No Spine runtime is shipped: all Spine work happens in
herramientas/, which is run by hand and is not part of the game.
```

### ⬜ Solo vos

| campo | nota |
|---|---|
| Wallet de Ronin, si la pide | **No me la pases.** Va directo en el formulario y en ningún otro lado. |
| Project thumbnail | Hoy es `axie/thumbnail.jpg`, 988 KB. Está del 3 de septiembre: no muestra nada de lo de ahora. Vale la pena recapturarlo. |
| Video / demo, si lo pide | |

---

## Lo que se puede afirmar, porque está medido

| | |
|---|---|
| Corridas completas de 10 minutos, una por clase | 3, **sin un solo error y sin fugas** |
| Dibujo por cuadro, 1280×720, arena llena (55 quimeras, que es el techo) | **0,70 ms** de un presupuesto de 2, en un cuadro de 16,7 |
| Peor caso (las 55 quimeras destellando a la vez) | 1,67 ms |
| Corrida completa con `arte/` y `vfx/` **borradas** | 180 s, 159 muertes, cero errores |
| Variedad del final (el criterio del §6) | **1082, 1069, 1360, 1823** muertes en cuatro corridas |
| Dibujo con 71 quimeras, el techo de la Zona Corrupta | **0,72 ms** de un presupuesto de 2 |
| Peso del juego entero | 9,0 MB, 92 archivos |
| Dependencias / pasos de compilación | **cero** |
| Familias del Battle Kit usadas | VFX web, retratos de Quimeras, SFX de batalla, iconos de estado |

El arco de la progresión está medido también, pero **el 5 de septiembre**: la
pasada de presentación no tocó el balance, así que sigue valiendo. Sobre cuatro
vidas simuladas de seis corridas, se muere a los ~255 s la primera, se gana la
tercera, y el Axie llega al nivel 60 entre la sexta y la octava.

---

## Qué NO prometer

- **Son 3 clases jugables, no 6** (Bestia, Planta, Aqua). El triángulo de
  Origins es de nueve clases; acá funciona porque los enemigos cubren los tres
  grupos, pero no es el completo.
- ~~La corrida termina a los 10:00 y no sigue.~~ **Arreglado el 7 de
  septiembre.** A los 10:00 hay una puerta: extraer, o entrar en la Zona
  Corrupta, donde sube un nivel de amenaza por minuto y el bono con él — pero
  si te matan ahí perdés el bono. Medido: cuatro corridas dieron 1082, 1069,
  1360 y 1823 muertes, contra el 1082-1083 fijo de antes.
- **El AXP vive en `localStorage`, no en la cadena.** `cargarAxie()` y
  `guardarAxie()` son las dos únicas funciones que lo tocan; apuntarlas a la API
  de Sky Mavis y a una wallet de Ronin es un cambio contenido, no una
  reescritura. Decirlo así es más fuerte que insinuar que ya está conectado.
- **La curva de AXP está comprimida a propósito.** El Axie #5147 necesita 71.720
  AXP para pasar de nivel 35 a 36; acá la subida entera a 60 son ~217.000 y la
  primera Ascensión cae en la primera corrida. Un jurado tiene tres partidas, no
  tres meses. La escala es de demostración; la estructura de abajo es la real.

---

## Con 15 días, qué haría después de enviar el 8

En orden, y todo está detallado en `MEJORAS.md`:

1. ~~§6, el final plano.~~ ✅ hecho el 7 de septiembre.
2. **§5, las 6 clases y el triángulo completo.** Lo que más suma al 35 %, y lo
   que más se puede desmadrar: si aprieta el tiempo, mejor tres bien que seis a
   medias.
3. **§8, los marcos de carta de Origins.** Los assets ya están ubicados y
   verificados en el kit: `PvE/UI/Chapter/riddle_card_<clase>.png` es el marco
   por clase con ventana de arte, y `PvE/Cards/Tools/` son las ilustraciones
   reales de las cartas. Es contenido, no lógica: el riesgo es bajo.
4. Recapturar el thumbnail y grabar el video.
