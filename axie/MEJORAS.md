# Axie Survivors — plan de mejoras

Instrucciones para el próximo tramo de trabajo, ordenadas por lo que suman
contra lo que cuestan. Escrito el 5 de septiembre de 2026.

⚠️ **Hay TRES fechas y es fácil confundirlas.** Registro cerrado el 7 de
septiembre (ya hecho); los envíos **abren** el **8 de septiembre, 13:00 UTC** y
**cierran** el **21 de septiembre, 13:00 UTC**. El 8 es cuando se PUEDE enviar,
no un plazo: el panel del Vibeathon lo dice con todas las letras.

O sea que este plan, escrito mirando el 21, tenía bien el horizonte: hay dos
semanas. Y como el proyecto queda editable y se puede volver a enviar creando
una versión nueva, la jugada es **enviar el 8 apenas abre** —para que exista un
envío válido desde el primer día— y **seguir con esta lista hasta el 21**.
El detalle del formulario está en `ENTREGA.md`.

Cada punto dice **por qué**, **dónde**, **cómo**, **qué no hacer** y **cómo se
comprueba**. El último apartado es lo que no hay que tocar: son cosas medidas,
no opiniones, y desarmarlas sin querer es el riesgo más grande de este plan.

---

## 0. Contra qué se está optimizando

El jurado puntúa así, y conviene tenerlo a la vista todo el tiempo:

| criterio | peso |
|---|---:|
| Encaje con Axie Core | **35 %** |
| Jugabilidad | 25 % |
| Visión de producto | 20 % |
| Viabilidad | 10 % |
| Calidad del prototipo y la documentación | 10 % |

Todo lo de abajo está ordenado por cuánto mueve ese 35 % y ese 25 %.

---

## 1. El hallazgo grande: el Battle Kit está casi sin usar

El juego usa **2 de las 10 familias** de assets que trae el
[Axie Origins Battle Kit](https://github.com/axieinfinity/axie-origins-asset-kit),
en la revisión que autorizan las reglas:

```
commit 069a59b772e54633d04a3d9d12ecde73b3e4be5d
```

| familia | archivos | peso | estado |
|---|---:|---:|---|
| VFX web (efectos de golpe) | 215 | 145 MB | **usado** (15 clips) |
| Retratos de Quimeras | 22 | 0,4 MB | **usado** (20) |
| **SFX de batalla** | 130 | 27,8 MB | sin usar |
| **Iconos de estado** | 131 | 0,7 MB | sin usar |
| **Cartas PvE** | 166 | 12,4 MB | sin usar |
| **HUD de batalla** | 59 | 2,0 MB | sin usar |
| **Fondos PvE** | 159 | 64,3 MB | sin usar |
| Interfaz PvE | 94 | 19,9 MB | sin usar |
| Intenciones | 17 | 0,1 MB | sin usar |
| Música PvE | 15 | 197 MB (.wav) | sin usar |

Si una sola cosa de este documento se hace, que sea bajar de ahí. Es la
diferencia entre "un juego inspirado en Axie" y "un juego de Axie", que es
literalmente el 35 % del puntaje.

---

## 2. Sonido oficial de Origins  ⭐ máxima prioridad

**Por qué.** Hoy el audio son bips sintetizados con la Web Audio API. Suena a
prototipo, y es lo primero que se nota en un video. El kit trae **130 sonidos de
batalla de Origins** con los nombres calzados uno a uno con los efectos que el
juego ya reproduce:

```
web-vfx/public/sfx/beast_gore_attack.wav
web-vfx/public/sfx/beast_gore_hit.wav
web-vfx/public/sfx/aquatic_projectile_fly.wav
…
```

El juego ya sabe qué clip está tocando (`VFX.golpe(parte, clase, …)` arma el id
`beast_gore`). El sonido sale del mismo id más el sufijo.

**Dónde.** `playSound()` en `index.html`. Hoy tiene los casos `shoot`,
`shockwave`, `hit`, `gem`, `levelup`.

**Cómo.**

1. Bajar **solo** los sonidos de los 15 clips que el juego usa, con los sufijos
   `_attack` y `_hit`. Son ~30 archivos.
2. ⚠️ **Convertirlos.** Son `.wav`: 27,8 MB los 130, y los 30 que hacen falta
   pesan unos 6 MB. En `.ogg` mono a 96 kbps bajan a menos de 1 MB. `ffmpeg` ya
   está instalado en esta máquina:
   ```bash
   ffmpeg -i entrada.wav -ac 1 -c:a libvorbis -b:a 96k salida.ogg
   ```
   Que la conversión quede en una herramienta (`herramientas/sfx-preparar.cjs`),
   igual que `vfx-preparar.cjs`, para que se pueda rehacer desde el commit.
3. Guardarlos en `arte/sfx/`, con su `LICENSE.md` y `Third Party Notices.md`
   al lado — lo exige la licencia del kit.
4. Reproducirlos con un pool de `Audio` reutilizables. **No** crear un `Audio`
   nuevo por golpe: con 4 golpes por segundo el navegador se ahoga.
5. Mantener los bips sintetizados como respaldo si el archivo no cargó.

**Qué no hacer.** No bajar la música (`PvE/Music`, 197 MB en `.wav`). Si se
quiere música, va aparte, convertida, y como mucho un tema.

**Cómo se comprueba.** Una partida de 60 s no debe pasar de ~30 sonidos vivos
simultáneos; el peso agregado al juego no debe superar 1,5 MB; y con el archivo
borrado a mano el juego tiene que seguir sonando (respaldo).

---

## 3. El Axie tiene 46 animaciones y usamos 2  ⭐

**Por qué.** El horno cocina `action/run` y `action/idle/normal`. El esqueleto
del mixer trae **46**, y entre ellas están exactamente las que el juego
necesita:

```
attack/melee/horn-gore      attack/melee/mouth-bite     attack/melee/tail-smash
defense/hit-by-normal       defense/hit-by-normal-crit  activity/evolve
```

Y no es casualidad que calcen: **cada `clip.json` de VFX dice con qué animación
del Axie va sincronizado**, en sus campos `attackAnimation` y `hitAnimation`.
`beast_gore` trae `attack/melee/horn-gore`. El kit está diseñado para que el
efecto y el Axie se muevan juntos, y hoy el Axie está quieto mientras el efecto
estalla.

**Dónde.** `herramientas/horno-axie.html` (constante `TIRAS`) y `drawAxie()`.

**Cómo.**

1. Agregar a `TIRAS` las tres de ataque, la de recibir golpe y `activity/evolve`
   (6 cuadros cada una alcanza).
2. La lámina pasa de 14 a ~44 cuadros: reacomodar la grilla (8 columnas × 6
   filas) y volver a cocinar las tres clases.
3. En el juego, un estado de animación por encima del de correr: cuando una
   carta dispara, el Axie toca su animación de ataque durante su duración y
   después vuelve a correr o a estar quieto.
4. **`activity/evolve` va en la Ascensión.** Hoy la Ascensión es un cartel de
   HTML; con la animación oficial de evolución detrás, es un momento.

**Qué no hacer.** No meter el runtime de Spine en el juego (ver §10). Todo esto
se cocina afuera, como lo que ya está.

**Cómo se comprueba.** Que al pegar con el cuerno el Axie haga la embestida y no
siga corriendo; que la lámina no pase de ~600 KB por clase; y que si la lámina
no carga se siga viendo el Axie dibujado de antes.

---

## 4. Iconos de estado oficiales  ⭐ barato y muy visible

**Por qué.** 131 PNG, **0,7 MB en total**, y hay coincidencias exactas con
mecánicas que el juego YA tiene:

| icono del kit | mecánica que ya existe |
|---|---|
| `buff_rage.png` | el contador de Rage |
| `buff_fury.png` | Fury Form |
| `buff_leaf.png` | la runa Way of Plant |
| `buff_bubble.png` | el amuleto Burbuja (Vulnerable) |

**Dónde.** El HUD (la barra de Rage) y encima de las quimeras marcadas como
Vulnerable.

**Cómo.** Bajar los 4 o 5 que correspondan a `arte/iconos/`, y dibujarlos: el de
Rage junto a su barra, el de Fury sobre el Axie mientras dura, y el de Burbuja
sobre la quimera vulnerable en vez del brillo celeste actual.

**Cómo se comprueba.** Que el estado se lea sin texto.

---

## 5. Las 6 clases jugables y el triángulo real  ⭐⭐ el mayor golpe al 35 %

**Por qué.** Hoy se puede jugar con 3 clases (Bestia, Planta, Aqua) y el
triángulo es una aproximación de cuatro. El de Origins es de nueve:

> **Reptil / Planta / Dusk** → **Aqua / Ave / Dawn** → **Bestia / Bug / Mech** → vuelve al principio

Con 6 clases el triángulo queda completo, con dos clases por grupo, y deja de
ser una versión libre.

**El arte ya está resuelto.** Está verificado que el mixer saca las nueve. La
clase vive en los bits altos del primer byte de los genes: `(byte >> 3) & 0x1F`,
comprobado uno por uno contra la variante que devuelve el mixer:

| clase | primer byte | clase | primer byte |
|---|---|---|---|
| Beast | `0x00` | Reptile | `0x28` |
| Bug | `0x08` | Mech | `0x80` |
| Bird | `0x10` | Dawn | `0x88` |
| Plant | `0x18` | Dusk | `0x90` |
| Aquatic | `0x20` | | |

Agregar `bug`, `bird` y `reptile` a `A_COCINAR` en el horno y listo.

**Lo que cuesta de verdad no es el arte:**

1. **Las 6 cartas de cada clase**, en `PARTES_POR_CLASE`. Hoy solo la Bestia
   tiene partes reales (las del Axie #5147). Planta y Aqua están marcadas
   *"sin verificar"* en el propio código. **Hay que sacarlas de Axies que
   existan** — si son inventadas, un juez que juega Axie lo nota.
2. **Vida, velocidad y carta inicial** de cada una, en `applyAxieClass()`.
   ⚠️ Cada clase tiene que arrancar con al menos una carta que haga daño; ya
   pasó que la Planta no podía matar nada y quedaba en un punto muerto.
3. **Seis colores que se distingan** en el aro del piso sobre tierra oscura.
   Con cuatro ya está justo.
4. **La pantalla de inicio** hoy muestra tres tarjetas; seis piden otra grilla.

**Qué no hacer.** No agregar Mech, Dawn ni Dusk en este tramo: son las clases
secretas de Axie, son las raras, y sus colores son los que peor se separan de
los otros. Quedan para el final si sobra tiempo.

**Ojo con los enemigos.** El kit **no trae Quimeras de Bug, Reptil, Mech, Dawn
ni Dusk** — solo familias de Planta, Bestia y Aqua. Las Quimeras siguen siendo
las mismas 20. El triángulo igual funciona, porque para eso alcanza con que los
enemigos cubran los tres grupos, y los cubren.

**Cómo se comprueba.** Jugar una corrida entera con cada clase nueva sin que
ninguna quede sin poder matar; y que el multiplicador del triángulo dé lo que
dice la tabla de Origins para los nueve cruces posibles entre los tres grupos.

---

## 6. El final de partida es plano

**Por qué.** Medido: de la cuarta corrida en adelante, **todas las partidas
ganadas dan exactamente 1082-1083 quimeras muertas y 28.575 AXP**. El mismo
número, siempre. Una vez que las partes llegan a 5, no hay nada nuevo, y el
juego se termina de verdad ahí.

Esto es lo que más pesa en **Jugabilidad (25 %)** y es lo único de esta lista
que no se arregla bajando un asset.

**Cómo (elegir UNO, no los tres):**

- **Dificultad que sigue subiendo.** Al llegar a 10:00 no termina: sigue con las
  quimeras más duras y un marcador de cuánto aguantaste. La extracción pasa a
  ser una meta intermedia, no el final.
- **Niveles de amenaza.** Ganar desbloquea una corrida más dura, con más AXP.
  Es lo que hace Origins con sus mapas de PvE y encaja con el lore.
- **Objetivos por corrida.** "Matá al jefe Planta sin recibir daño", "extraé con
  una sola carta subida". Da razones distintas para volver a entrar.

**Recomendación.** El primero. Es el más barato, no pide interfaz nueva, y
convierte un juego que se termina en uno que se puntúa.

**Cómo se comprueba.** Dos corridas ganadas seguidas no pueden dar el mismo
número de muertes.

---

## 7. Fondo y HUD de Origins

**Por qué.** El suelo es una cuadrícula pintada a mano en canvas. El kit trae
159 fondos de PvE (64 MB) y 59 piezas de HUD de batalla (2 MB).

**Cómo.** Elegir **uno o dos** fondos, recortarlos a una baldosa que se repita
sin costura, y convertirlos a `.webp`. ⚠️ Un fondo de Origins es claro y cálido;
las quimeras naranjas se pierden sobre él. Ya está anotado en el código por qué
la tierra va oscura: **si se cambia el fondo, hay que volver a mirar el
contraste de las cuatro clases**, no solo que "se vea lindo".

El HUD de batalla es más seguro: marcos de barra de vida, la barra del jefe.

**Cómo se comprueba.** Foto de las 4 clases de quimera sobre el fondo nuevo, y
que se distingan a simple vista. Si no, el fondo no va.

---

## 8. Las cartas del subir de nivel

**Por qué.** El momento de elegir mejora es donde el jugador ve el sistema de
Axie Core, y hoy son tres rectángulos de HTML. El kit trae 166 PNG de cartas de
PvE (12,4 MB) con los marcos reales de Origins.

**Cómo.** Usar el marco de carta de Origins detrás de cada opción, con el color
de la clase de esa carta. No hace falta bajar las 166: con los marcos por clase
alcanza.

**Cómo se comprueba.** Que la pantalla de subir de nivel se parezca a Origins en
una captura, sin texto explicativo.

---

## 9. La capa de presentación  ✅ HECHO (6 de septiembre)

Era "cosas chicas que se notan en un video" y terminó siendo el cambio que más
mueve la primera impresión, porque lo que hacía que el juego se viera básico no
era el arte —el arte es el oficial de Origins— sino que **la escena estaba
plana y los golpes no se sentían**. Todo esto es código, no assets:

| qué | dónde |
|---|---|
| **Sacudón** con trauma al cuadrado, respeta `prefers-reduced-motion` | `CAMARA` |
| **Congelado** (hit-stop) en el crítico al jefe y en su muerte | `CAMARA.congelar()` |
| **Destello blanco** en la quimera golpeada, 90 ms | `drawChimera()` |
| **Viñeta + luz del Axie + rojo del borde**, degradados cacheados | `capaDePantalla()` |
| **Barra de vida del jefe** y **flecha** cuando queda fuera de cuadro | `dibujarJefeEnPantalla()` |
| **Pausa** con P o Esc | `alternarPausa()` |
| **Números de daño**: el crítico más grande, con contorno y en arco | `createFloatingText()` |
| **Anillos** en la entrada y la caída del jefe | `anillos` |
| **Polvo** bajo las patas del Axie al correr | el bloque de movimiento |
| **Suelo con manchones grandes**, pastito y niebla en el borde del mundo | `renderGround()` |
| **Cartas de subir de nivel**: la rareza es el marco y la clase la franja | `triggerUpgradeModal()` |

⚠️ **Lo que costó una vuelta y no hay que volver a romper:**

1. **El rojo del borde son DOS señales, no una.** La primera versión lo subía
   con cada golpe recibido: medido sobre una corrida entera, la pantalla pasaba
   el **40% del tiempo teñida fuerte**, porque en un juego de supervivencia
   estar en contacto es el estado normal. Ahora `dolor` (el golpe, tope 0,45)
   y `apuro` (la vida abajo del 35%, late) van por separado y se dibuja el más
   fuerte de los dos. Vuelto a medir: **3% del tiempo por encima de 0,15**.
2. **El daño por contacto no puede sacudir ni sumar rojo.** Ese bloque corre
   una vez POR QUIMERA y por cuadro: con seis encima se ejecuta seis veces.
   El rojo se calcula una sola vez por cuadro, restando la vida antes y después.
3. **El congelado solo va en el crítico contra un jefe.** Con cuatro golpes por
   segundo, congelar en cada crítico serían 180 ms de freno por segundo y el
   juego se sentiría trabado. Y no toca el balance: durante el congelado
   `update()` no corre, o sea que `gameTime` tampoco avanza.
4. **El sacudón va DENTRO del bloque del mundo**, no sobre la pantalla, o
   tiemblan la viñeta y la barra del jefe. Y el suelo se dibuja 44 px más
   grande de cada lado, o aparece una franja negra en el cuadro del golpe.
5. **Los manchones del suelo van con degradado radial.** Con borde duro a 0,30
   de opacidad se ven círculos, no terreno.
6. **Los degradados de pantalla están cacheados** por `viewWidth/viewHeight`.
   El Axie está siempre en el centro exacto, así que no se mueven nunca.

**Medido después de todo esto** (1280×720, arena llena, 55 quimeras):
**0,92 ms** de dibujo por cuadro sobre un presupuesto de 2 — la capa de
pantalla entera cuesta **0,001 ms**. El peor caso imaginable, las 55 quimeras
destellando a la vez, da 1,67 ms y no llega a pasar nunca. Tres corridas
completas, una por clase, sin un solo error y sin fugas.

---

## 10. Lo que NO hay que hacer  ⚠️ leer antes de empezar

Estas no son preferencias, son cosas medidas o exigidas.

1. **No meter runtime de Spine en el juego entregado.** Las reglas del Vibeathon
   avisan: el kit trae datos de Spine pero **no** la licencia del runtime, y
   embarcar código de runtime pide licencia aparte de Esoteric Software. Todo el
   Spine vive en `herramientas/horno-axie.*`, que se corre a mano y no se
   entrega. El juego recibe PNG.
2. **No agregar dependencias ni un paso de compilación.** El juego es un HTML
   servido tal cual. Es media respuesta a "Viabilidad" y no se negocia.
3. **No clonar el repo del kit.** Pesa 1,6 GB (`Assets/OriginsKit` son 1,4 GB de
   Unity). Bajar archivo por archivo desde `raw.githubusercontent.com`, siempre
   con el commit `069a59b…` en la URL: **la licencia autoriza esa revisión**,
   no `main`, que ya está más adelante.
4. **Mantener `LICENSE.md` y `Third Party Notices.md`** junto a cada carpeta de
   assets. Lo exige la licencia, y hoy están en `vfx/` y en `arte/`.
5. **Rutas siempre relativas** (`arte/…`, `vfx/…`). Nunca `/arte/…`: el juego
   cuelga de `/axie` y una ruta absoluta lo rompe.
6. **Todo asset nuevo carga en diferido y con respaldo.** El patrón ya está en
   `VFX`, `SPRITES` y `AXIE_SPRITE`: si el archivo no llega, se dibuja lo de
   antes y el juego sigue. Nada de arte puede estar en el camino crítico.
7. **Vigilar la memoria, no el peso del archivo.** Un PNG no ocupa lo que pesa:
   ocupa `ancho × alto × 4` una vez abierto. Ya pasó — los atlas de VFX sumaban
   243 MB en una corrida y había que achicarlos a la mitad
   (`herramientas/vfx-preparar.cjs`). Este juego se juega en el celular.
8. **No tocar el balance sin volver a medirlo.** Los números de abajo costaron
   una tarde de mediciones:
   - vida de las quimeras: `22 + gameTime * 0.30` (estaba en 0,8 y el juego era
     **imposible de ganar**: llegaban 2159 de vida por segundo contra un techo de
     1129 de daño);
   - techo de 55 quimeras vivas;
   - rampa de aparición `1.4 - gameTime * 0.0035`;
   - curva de nivel de la corrida `×1,22 + 25`;
   - curva del Axie `40 · n^2.1` (estaba en 1.7 y el Axie llegaba a nivel 60 en
     la segunda partida);
   - corazones: 4 % de caída, curan el 18 % de la vida máxima, **no** los atrae
     el imán de los Ojos.

   El arco que dan esos números, medido sobre cuatro vidas simuladas de seis
   corridas: **muere a los ~255 s la primera, gana la tercera, Axie al 60 entre
   la sexta y la octava.** Si un cambio rompe eso, es un bug, no un ajuste.
9. **El color de clase vive en el aro del piso**, no en el cuerpo. Desde que las
   quimeras tienen arte propio, el aro es la única señal de clase que queda, y
   el aro **blanco** del jugador es lo único que te dice cuál sos vos.
10. **Los archivos van con fin de línea CRLF**, que es como está `index.html`.
    Mezclarlos ensucia el diff entero.

---

## 11. En qué orden

| # | qué | esfuerzo | qué mueve | estado |
|---|---|---|---|---|
| 1 | Sonido oficial (§2) | bajo | Axie Core, y el video | ✅ |
| 2 | Iconos de estado (§4) | muy bajo | Axie Core | ✅ |
| 3 | Animaciones de ataque del Axie (§3) | medio | Axie Core, jugabilidad | ✅ |
| 4 | Capa de presentación (§9) | bajo | **la primera impresión** | ✅ |
| 5 | Final de partida (§6) | medio | **Jugabilidad** | ⬜ |
| 6 | Las 6 clases y el triángulo (§5) | alto | **Axie Core** | ⬜ |
| 7 | Marcos de carta de Origins (§8) | medio | Axie Core | ⬜ parcial: la rareza y la clase ya se ven, falta el marco del kit |
| 8 | Fondo (§7) | medio, con riesgo | estético | ⬜ |

Del 1 al 4 son los que hay que tener sí o sí antes de grabar el video. El 5 es
el que más suma pero es el que más se puede desmadrar; si el tiempo aprieta,
mejor tres clases bien hechas que seis a medias.

---

## 12. Cómo se va a revisar

Cada punto se da por hecho cuando:

1. **Corre sin errores** una partida completa de 10 minutos, medida cuadro a
   cuadro (no a ojo). El juego se puede pilotear desde la consola: `update(1/60)`
   y `render()` en un bucle, con el estado en `gameState`.
2. **Sigue andando sin los assets.** Se borra la carpeta y el juego arranca.
3. **No se pasa del presupuesto**: el dibujo de un cuadro por debajo de 2 ms de
   los 16,7 que hay, y la memoria de texturas de una corrida por debajo de
   ~150 MB.
4. **El arco medido de §10.8 sigue dando lo mismo.**
5. **La procedencia está escrita**: qué se bajó, de qué ruta del kit, en qué
   commit, y qué se le hizo. Va en `arte/PROCEDENCIA.md`.

---

## Estado de hoy, para no repetir trabajo

Ya está hecho y medido:

- **VFX oficiales de Origins** en cada golpe, con el clip de la clase de la
  carta y el ataque de la parte (`vfx/`, 15 clips, 5,9 MB). Arrancan en el
  evento `OnHit`, no en el cuadro 0.
- **Las 20 Quimeras de PvE** con aro de clase en el piso (`arte/quimeras/`).
- **El Axie del jugador desde el mixer oficial**, tres clases
  (`arte/axies/`), con aro blanco.
- **Balance rehecho y medido** (§10.8).
- **Corazones** para que la vida pueda subir.
- **Favicon**, que no había.
- Herramientas: `vfx-preparar.cjs` (resta el fondo y achica los atlas) y
  `horno-axie.cjs` + `.html` (cocina los Axies del mixer).
- Todo el arte se pide al abrir la página, no al empezar la corrida.
- **Sonido oficial de Origins** (§2), 17 `.ogg`, 440 KB, con los bips de
  respaldo si un archivo no llega.
- **Iconos de estado del kit** (§4) en Rage, Fury, Way of Plant y Vulnerable —
  y desde el 6 de septiembre también en las cartas de subir de nivel.
- **Las 7 animaciones del Axie** (§3): correr, quieto, los tres ataques, recibir
  golpe y `activity/evolve` en la Ascensión.
- **La capa de presentación entera** (§9), medida.
- `arte/PROCEDENCIA.md` al día con `sfx/` y `iconos/`, con las rutas del kit
  verificadas contra el árbol del commit autorizado.

**Lo que queda, en orden:** el final de partida (§6) es el único que mueve
Jugabilidad y el único que no se arregla bajando un asset; después las 6 clases
(§5), que es lo que más suma al 35% pero lo que más se puede desmadrar.
Y el README sigue diciendo que el sonido es sintetizado: hay que ponerlo al día
antes de entregar, que son puntos regalados en el 10% de documentación.
