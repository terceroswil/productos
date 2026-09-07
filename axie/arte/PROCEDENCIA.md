# De dónde salió cada cosa en `arte/`

Nada de esta carpeta está dibujado a mano. Todo viene de Axie Infinity y se usa
bajo la licencia limitada que dan las reglas del Axie Vibeathon: para el
Vibeathon, sin redistribuirlo suelto y sin uso comercial. `LICENSE.md` y
`Third Party Notices.md` son los términos que mandan y viajan con la copia.

## `quimeras/` — 20 PNG

Los retratos de las Quimeras de PvE de **Axie Infinity: Origins**, tal cual
vienen del Battle Kit, en la revisión que autorizan las reglas:

    github.com/axieinfinity/axie-origins-asset-kit
    commit 069a59b772e54633d04a3d9d12ecde73b3e4be5d
    Assets/OriginsKit/PvE/Avatars/portraits/

No se les tocó un pixel: se copiaron. Son 436 KB entre las veinte.

De las 22 que trae el kit se dejaron fuera `machito` y `shilin`: no son
criaturas sino retratos enmarcados tipo polaroid, arte de historia, y dentro
del juego se verían como una foto pegada en el pasto.

## `axies/` — 3 láminas de sprites

El Axie del jugador, en las tres clases jugables. **Generadas**, no copiadas,
por `herramientas/horno-axie.cjs`:

- el esqueleto y las partes los arma **`@axieinfinity/mixer` 1.4.9** (MIT, del
  equipo de Sky Mavis) a partir de los genes de ejemplo del propio Battle Kit;
- las texturas de las partes bajan de `axiecdn.axieinfinity.com/mixer-stuffs/v6/`,
  que es el CDN oficial;
- el horno las anima con Spine y fotografía **siete animaciones** en una sola
  lámina de 8×6 cuadros: `action/run` (8), `action/idle/normal` (6), las tres
  de ataque `attack/melee/horn-gore`, `mouth-bite` y `tail-smash` (6 cada
  una), `defense/hit-by-normal` (5) y `activity/evolve` (8).

  Las de ataque no son decoración: cada `clip.json` de `vfx/` dice con qué
  animación del Axie va sincronizado, en sus campos `attackAnimation` y
  `hitAnimation` — `beast_gore` pide exactamente `attack/melee/horn-gore`. El
  kit está hecho para que el efecto y el Axie se muevan juntos.
  `activity/evolve` es la que corre en la Ascensión: es literalmente la
  animación de evolución del juego real.

El código del mixer es MIT; **el arte que compone no**: los Axies son de Sky
Mavis, igual que todo lo demás de esta carpeta.

Para rehacerlas: `node herramientas/horno-axie.cjs` y abrir el puerto 4321.

## `sfx/` — 17 sonidos

Los sonidos de batalla de **Axie Infinity: Origins**, del mismo Battle Kit y
del mismo commit:

    web-vfx/public/sfx/

Se bajaron sólo los que el juego usa —los tres ataques (`gore`, `bite`,
`smash`) por cada una de las cuatro clases que aparecen, más curar, escudo,
fury, hoja y subir de nivel— y **se convirtieron**: en el kit son `.wav` y los
130 pesan 27,8 MB. Acá son `.ogg` mono a 96 kbps y los 17 pesan **440 KB**.

La conversión vive en `herramientas/sfx-preparar.cjs` para que se pueda rehacer
desde el commit. Es sólo recodificado: no se cortó, ni se mezcló, ni se cambió
el tono de ninguno.

⚠️ Los bips sintetizados con la Web Audio API siguen ahí como respaldo. Si un
`.ogg` no carga, el juego suena igual — nada de esto está en el camino crítico.

## `iconos/` — 4 PNG

Iconos de estado de Origins, tal cual, sin tocar (24 KB los cuatro):

    Assets/OriginsKit/Textures/StatusIcons/

Se eligieron los cuatro que tienen calce **exacto** con una mecánica que el
juego ya tenía, no los que quedaban lindos:

| icono | dónde se usa |
|---|---|
| `buff_rage.png`   | la barra de Rage del HUD, y la carta del Amuleto de Rage y de la runa Way of Beast |
| `buff_fury.png`   | sobre el Axie mientras dura Fury Form, y la carta del Amuleto de Furia |
| `buff_leaf.png`   | la runa Way of Plant y la carta del Amuleto de Hoja |
| `buff_bubble.png` | sobre la quimera marcada como Vulnerable por el amuleto Burbuja |

De las 131 que trae el kit no se bajó ninguna más: un icono sin una mecánica
detrás es decoración, y decoración de otro juego.
