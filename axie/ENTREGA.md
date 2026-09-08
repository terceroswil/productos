# Entrega — Axie Vibeathon 2026

Todo lo que va en el formulario, ya escrito y listo para pegar.

Actualizado el **8 de septiembre de 2026**, contra las **reglas oficiales
v1.0.2** (`vibeathon.axieinfinity.ai/rules/1.0.2`, vigentes desde hoy), con el
formulario real a la vista y la Zona Corrupta ya en el juego.

---

## Lo que cambió con las reglas v1.0.2

Cinco cosas mueven trabajo. Las tres primeras son obligaciones nuevas; las dos
últimas son datos que estaban en blanco y ya no.

| | qué dice | qué cambia acá |
|---|---|---|
| **`jaatster` invitado** | *"Confirm that the GitHub account jaatster has been invited to the repository or already has access"* | Un botón, y sin él un repo privado es un repo que nadie abre. |
| **SHA de revisión** | *"the full exact review commit SHA"* + confirmar *"that the commit produced all linked review builds"* | ⚠️ **Mata la opción "privado y atrasado".** Hay que sincronizar el espejo antes de enviar. |
| **Discord verificado** | *"required when finalizing a new submission revision"* | Cada vez que se finaliza una revisión, no una sola vez. |
| **Problemas conocidos** | *"Known issues list"* entre los elementos obligatorios | No estaba escrito. Ahora sí, más abajo. |
| **Video de demo** | *"made demo video optional"*, textual en el registro de cambios | ✅ Deja de ser bloqueante. Era el pendiente más caro. |

Y dos fechas que estaban como "pending": la **revisión de Ronda 1 es del 22 al
28 de septiembre**, y si pasa, la **QA final es del 1 al 3 de noviembre**. Eso
fija el plazo del túnel, que hasta hoy era un tiempo que "nadie sabía".

Lo que **no** cambió y ya estaba bien: el commit autorizado del Battle Kit sigue
siendo `069a59b772e54633d04a3d9d12ecde73b3e4be5d`; los pesos del jurado siguen
siendo 35/25/20/10/10; no se embarca runtime de Spine (las reglas lo piden
expresamente y el juego ya lo cumple); no hace falta wallet para jugar (*"Basic
play may not require a wallet or Event Platform account"*), y la entrada es
individual, que es lo que es.

Los premios, que no estaban anotados: 9.000 bAXS el ganador, 3.500 el segundo,
2.000 el tercero, 800 para cada uno de los otros cinco finalistas, y **500 para
hasta tres "Promising Prototype" que no lleguen a finalistas**. Avanzan *"up to
eight quality-gated entries"*, y *"no community vote, like count, or popularity
score affects advancement"*: no hay nada que hacer en redes.

---

## Las fechas, que son tres y se confunden

| | cuándo | estado |
|---|---|---|
| Cierre de **registro** | 7 de septiembre, 13:00 UTC | ✅ ya hecho, el 3 de septiembre |
| **Apertura** de envíos | **8 de septiembre, 13:00 UTC** | ⏳ es lo único que falta para poder enviar |
| **Cierre** de envíos | **21 de septiembre, 13:00 UTC** | el plazo de verdad |
| **Revisión** de Ronda 1 | 22 al 28 de septiembre | ya no es "date pending" |
| Anuncio de **finalistas** | 29 de septiembre | |
| **Ronda 2** | 4 de octubre al 31 de octubre, 13:00 UTC | solo si pasa |
| **QA final** | 1 al 3 de noviembre | el enlace tiene que seguir vivo |
| Demostraciones y **resultados** | 5 de noviembre | |

Todo esto sale de las **reglas oficiales v1.0.2**
(`vibeathon.axieinfinity.ai/rules/1.0.2`, vigentes desde el 8 de septiembre de
2026), no del anuncio. Lo que valga como hora oficial es *"the Event Platform's
server time and a successful finalization receipt"*: guardar no es enviar.

⚠️ **Las tres últimas fechas cambian la decisión del túnel.** Cuando se resolvió
sostenerlo, el juzgamiento figuraba como *"Date pending"*. Ahora se sabe: la PC
tiene que servir el juego hasta el **21 de septiembre** seguro, y hasta el **31
de octubre** si pasa a la Ronda 2. Casi dos meses sin cortes. Eso empuja fuerte
a mover el juego a Cloudflare Pages, que ya está evaluado y elegido más abajo.
Confirmar contra el panel antes de actuar: esto sale del anuncio, no del panel.

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

Y no son dos semanas. Esto ya **no** es "date pending": las reglas v1.0.2 fijan
la revisión de Ronda 1 del **22 al 28 de septiembre**. O sea que el plazo real
del túnel es hasta el **28 de septiembre**, y hasta el **3 de noviembre** si
pasa a la Ronda 2 (la QA final es del 1 al 3). Sin un corte de luz.

Y las reglas lo ponen encima del participante en dos frases: *"The Organizer
does not host, iframe, proxy, preload, or execute participant games"* y el
participante es responsable de *"keeping required links available through
review"*. Peor: el Organizador *"may quarantine an external link or entry while
reviewing a credible safety or rights issue"*. Un enlace caído durante esos
siete días no es un descuento de puntos, es una entrada que no se puede
evaluar.
(Lo de "no abrir AutoTrópico" ya no corre: se mudó al 3002 el 07/09/2026 y no
pelea más por el puerto.)

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

### Título
```
Axie Survivors: Core Evolution
```

### Pitch de una línea
```
A survivors-style roguelite where one Axie holds off ten minutes of corrupted
Chimeras and keeps every point of AXP it earns — the run resets, your Axie does
not.
```

### Descripción corta
```
Adopt one Axie and hold off waves of corrupted Chimeras across Lunacia for ten
minutes, with a named boss every two. Die and the run resets — your Axie does
not: it keeps its AXP, levels, and Ascends every 10 levels to raise the ceiling
of its permanent body-part cards. Your Axie, the Chimeras, the combat VFX and
the battle SFX are official Axie assets, not lookalikes. Runs in a browser, no
install, no wallet needed to play.
```

### Product vision — ⚠️ **nuevo en v1.0.2** (máx. 2.000)
Obligatorio: *"Both answers are required when you submit."* No estaba escrito.
```
Axie Survivors: Core Evolution should become the place where an Axie you
already own gets stronger by being played.

Today the loop is complete but local. You adopt one of three Axies baked with
the official @axieinfinity/mixer, and the AXP it earns is written to
localStorage. The structure underneath is the real one — AXP that never resets,
Ascension every 10 levels raising the ceiling of the permanent body-part cards,
the Origins class triangle. Only the scale is a demo scale, compressed so a
judge reaches an Ascension inside the first run.

What it should become:

- Your Axie, not a preset. The mixer already runs in this project and takes
  genes as its input. Pointing it at the genes of an Axie held in a connected
  Ronin wallet changes the input, not the pipeline.
- AXP that leaves the browser. cargarAxie() and guardarAxie() are the only two
  functions that touch progress, so aiming them at a Sky Mavis account is a
  contained change rather than a rewrite. The game does not mint or promise
  tokens, and should not start.
- The full roster. Three classes are playable today against Chimeras that cover
  all four PvE groups; the nine classes of Origins are the target.
- An endgame worth arguing about. The Corrupted Zone already turns the
  ten-minute mark into a bet instead of an ending, and that is the part to grow.

The measure of success is simple: a player should be able to say that the Axie
in their collection is worth more of their time because this game exists.
```

### How is Axie Core integrated in the game? — ⚠️ **nuevo en v1.0.2** (máx. 3.000)
El otro obligatorio. Dice de frente lo que NO está integrado: ocultarlo es
lo que las reglas llaman `fabricated provenance`.
```
The Axie Core documentation asks third-party builders to feed the player's Axie
instead of building isolated experiences. AXP is what a game at this tier can
legitimately feed, so AXP is the spine of the design rather than a score.

Persistence. You adopt one Axie and name it. Each run you hold off waves of
corrupted Chimeras across Lunacia for ten minutes, with a named boss every two,
and harvest AXP. When you die the run resets and the Axie does not: it keeps
every point. That is the only progression in the game.

Ascension. Every 10 Axie levels (10, 20, 30, 40, 50, 60) the Axie Ascends, as
it does in Axie. Ascension is not an attack — it raises the ceiling of the
permanent body-part cards: techoDePartes = min(5, 1 + ascensions).

Origins systems, adapted rather than invented: body-part cards for the Horn,
Tail, Mouth, Back, Ears and Eyes; the class triangle; Runes; Charms; Potential
Points; Rage and Fury Form.

Official assets, not lookalikes:

- The Axie is generated by the official @axieinfinity/mixer from real genes and
  baked to a spritesheet carrying seven of its animations — run, idle, the
  three melee attacks, taking a hit, and activity/evolve, which is what plays
  on an Ascension.
- The Chimeras, the combat VFX, the battle SFX and the status icons come from
  the Axie Origins Battle Kit at the revision the rules authorise, with
  LICENSE.md and Third Party Notices kept alongside them.
- Every Chimera wears its class as its colour, and the colour is a read on
  behaviour, not only a damage multiplier: Birds weave, Beasts telegraph and
  charge, Plants wall you in, Aquatics keep their distance and spit.

What is not integrated, stated plainly: progress lives in the browser's
localStorage, not on-chain and not on a Sky Mavis account; the genes fed to the
mixer are presets, so you cannot bring your own Axie in yet; and the AXP curve
is compressed so a judge reaches an Ascension in the first run. The structure
is the real one, the scale is a demo scale. The game does not mint or promise
tokens.
```

### Browser run or install instructions — ⚠️ **nuevo en v1.0.2** (máx. 2.000)
Dice cómo se empieza a jugar y qué acceso hace falta (ninguno). Incluye el
aviso del audio, que si no parece un juego mudo.
```
No install and no account. Open the link in a browser and the game loads — one
HTML file plus its asset folder, no build step, no plugin, no wallet, and
nothing to sign in to.

Use the complete address with the trailing slash:
https://loscaseritos.com/axie/

On first load you adopt one of three Axies and name it. That Axie is yours from
then on. Its AXP is stored in the browser, so stay in the same browser to keep
it.

Controls. Move with WASD or the Arrow keys, or drag the joystick at the bottom
left on a phone or tablet. There is no mouse control and none is needed: your
Axie's cards fire on their own cooldowns, so the only thing you steer is where
it stands. Pause with P, Esc, or the button in the HUD.

Collect the glowing AXP gems the Chimeras drop. On each level-up you pick one of
three cards — evolve a body part, equip a Rune, or attach a Charm to a specific
card. Survive ten minutes to reach the extraction door, then choose: leave with
your bonus, or push into the Corrupted Zone for more and risk losing it.

Sound starts only after your first click or key press, because browsers keep
audio suspended until the player interacts. If the game seems silent, press a
key.

Tested on Chromium, Firefox and Safari, on desktop and on phones.
```

### Enlace al repositorio (puede quedar PRIVADO)
```
https://github.com/terceroswil/axie-survivors
```
⚠️ **El espejo está atrasado.** Se mantiene con `git subtree split` desde
`axie/`, y no se sincroniza desde antes de que entraran los 79 archivos de
assets y los arreglos del 7 de septiembre. Antes de pegar este enlace hay que
decidir dos cosas:

⚠️ **Las reglas v1.0.2 mataron la opción cómoda.** "Privado y atrasado" ya no
se puede: el envío obliga a declarar *"the full exact review commit SHA"* **y**
a confirmar *"that the commit produced all linked review builds"*. Un SHA de un
árbol que no es el que sirve `loscaseritos.com/axie/` es una declaración falsa
sobre la propia entrada, y eso cae en `fabricated provenance`, que las reglas
listan entre la conducta prohibida. **Hay que sincronizar el espejo antes de
enviar.** No es opcional.

⚠️ **Y hay que invitar a `jaatster`.** Textual: *"Confirm that the GitHub
account jaatster has been invited to the repository or already has access"*.
Privado sigue permitido —el repo y su acceso *"visible only to participant and
administrators"*—, pero privado **sin esa invitación** es un repo que el jurado
no puede abrir. Es un botón: *Settings → Collaborators → Add people →
`jaatster`*.

Lo que queda por decidir es solo una cosa: **si se sincroniza, los assets del
Battle Kit quedan publicados ahí.** Van con sus `LICENSE.md` —las reglas exigen
*"Keep its LICENSE.md and Third Party Notices with any permitted copy"*, y están
en `arte/` y en `vfx/`—, y es lo que hace cualquier participante. Si eso incomoda,
la salida es dejar el repo **privado** y con `jaatster` invitado: el asset queda
fuera de la vista pública y el jurado igual entra.

### Video de demostración — ✅ **es OPCIONAL**
Resuelto por las reglas v1.0.2, que lo dicen en su propio registro de cambios:
*"made demo video optional"*. Antes acá figuraba como material de una entrada
completa, por el anuncio, y por eso estaba en la lista de pendientes.

Sigue conviniendo grabarlo —el 10 % de "Prototype & Documentation Quality" se
cobra ahí y es el único lugar donde se ve la Zona Corrupta sin jugar—, pero
**deja de ser un bloqueante y baja de prioridad**: por debajo de sincronizar el
espejo y de la lista de problemas conocidos, que sí son obligatorios.

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
https://loscaseritos.com/axie/
```
⚠️ **Con la barra final.** Sin ella el navegador toma como base la raíz del
dominio y pide los assets del juego a `/arte/...`, que no es público: contesta
un 302 al login, el `fetch` se traga el HTML de `entrar.html` y el juego se
dibuja con las criaturas de respaldo — sin un solo asset oficial de Axie, que
es justo lo que carga el 35% de Encaje con Axie Core. El servidor ahora
redirige `/axie` a `/axie/` con un 301, así que las dos entran; igual va la
barra en el formulario, para no depender de la redirección.

⚠️ Ver también el punto 3 de arriba.

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

### Problemas conocidos — ⚠️ **obligatorio en v1.0.2**
Las reglas lo piden con nombre propio: *"Known issues list"*. No estaba escrito.
Esto es honesto y no regala nada que un jurado no vea en diez minutos; ocultarlo
sí cuesta, porque `fabricated provenance` es conducta prohibida.

```
- Three playable classes (Beast, Plant, Aquatic), not the nine of Origins. The
  enemy Chimeras cover all four PvE groups, so the class triangle reads
  correctly, but the player roster is a subset.
- The Axie you adopt is one of three Axies pre-baked with the official
  @axieinfinity/mixer. The mixer runs offline, in herramientas/, so you cannot
  bring your own Axie's genes into the game yet. Nothing about the pipeline is
  faked — the spritesheets are real mixer output with seven real animations —
  but the gene input is a preset, not yours.
- Progress (AXP, levels, Ascensions) is stored in the browser's localStorage,
  not on-chain and not on a Sky Mavis account. Clearing site data resets your
  Axie, and it does not follow you to another browser or device. cargarAxie()
  and guardarAxie() are the only two functions that touch it.
- The AXP curve is deliberately compressed so a judge reaches an Ascension
  inside the first run. Real Axie numbers are months of play. The structure is
  the real one; the scale is a demo scale.
- Gameplay inputs are keyboard or touch only. There is no mouse control: on a
  desktop without a keyboard the game cannot be played.
- Audio starts only after the first click or key press, because browsers keep
  the AudioContext suspended until a user gesture.
```

### Declaración de GitHub — ⚠️ **nueva en v1.0.2**
Tres cosas, y las tres son casillas del formulario:

| | |
|---|---|
| **Review commit SHA** | el SHA **completo y exacto** del commit del espejo que se revisa. Se saca con `git -C . rev-parse HEAD` en el espejo **después** de sincronizar, no antes. |
| **Confirmar que ese commit produjo los builds enlazados** | o sea: el árbol de ese SHA tiene que ser el que está sirviendo `loscaseritos.com/axie/`. Si se sigue trabajando después de enviar, hay que **reenviar** con el SHA nuevo. Cada envío es una versión nueva; eso ya estaba previsto. |
| **`jaatster` invitado al repositorio** | *Settings → Collaborators → Add people → `jaatster`*. Sin eso, un repo privado es un repo que el jurado no puede abrir. |

### Discord — ⚠️ **nuevo en v1.0.2**
*"A verified Discord connection is required when finalizing a new submission
revision."* No es una vez: es **cada vez** que se finaliza una revisión. Y
*"You may disconnect later, but must reconnect before finalizing again"*. Como
el plan es enviar el 8 y reenviar antes del 21, la conexión tiene que estar
puesta las dos veces.

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

0. **Lo obligatorio primero, y no es código** (v1.0.2): sincronizar el espejo,
   invitar a `jaatster`, anotar el SHA, pegar la lista de problemas conocidos y
   conectar Discord. Sin eso el envío está incompleto por reglas, no por
   calidad.
1. ~~§6, el final plano.~~ ✅ hecho el 7 de septiembre.
2. **§5, las 6 clases y el triángulo completo.** Lo que más suma al 35 %, y lo
   que más se puede desmadrar: si aprieta el tiempo, mejor tres bien que seis a
   medias.
3. **§8, los marcos de carta de Origins.** Los assets ya están ubicados y
   verificados en el kit: `PvE/UI/Chapter/riddle_card_<clase>.png` es el marco
   por clase con ventana de arte, y `PvE/Cards/Tools/` son las ilustraciones
   reales de las cartas. Es contenido, no lógica: el riesgo es bajo.
4. Recapturar el thumbnail. Y el video, que **ya es opcional** (v1.0.2): sigue
   valiendo puntos de documentación, pero deja de competir con lo de arriba.

---

## ⚠️ Ronda 2 pide el Mixer VIVO, y eso choca con una decisión tomada

Las reglas v1.0.2 dicen qué se espera de un finalista: *"Complete game loop"*,
*"Meaningful Axie Core integration"* y ***"Live approved Mixer integration"***.

Hoy el Mixer se corre **afuera**, a mano, en `herramientas/`, y al juego entra un
PNG. Está decidido así por tres razones que siguen siendo buenas: el mixer
arrastra PixiJS, pixi-spine y buffer y este juego no tiene dependencias; las
texturas de las partes viven en `axiecdn.axieinfinity.com`; y —esto lo dicen las
reglas mismas— *"the kit includes Spine data but not a Spine runtime license;
shipping Spine runtime code requires a separate valid license from Esoteric
Software"*.

O sea que **la salida obvia está cerrada**: meter el mixer en el navegador
embarca un runtime de Spine, y eso pide una licencia de Esoteric que no tenemos.

La salida que no la pide es **hornear del lado del servidor**: un endpoint en la
PC (o en un Worker) que reciba los genes de un Axie, corra el mixer en Node,
devuelva el spritesheet y lo cachee. El cliente sigue recibiendo un PNG y sigue
sin dependencias; el Mixer pasa a estar vivo y atado al Axie del jugador, que es
exactamente lo que pide la Ronda 2. Y encima tacha el segundo problema conocido
de la lista de arriba.

No es trabajo para antes del 21. Es lo primero de la Ronda 2 si pasa, y conviene
que la descripción de Ronda 1 **no** insinúe que ya está vivo — hoy no lo
insinúa, dice "baked", y así tiene que quedar.
