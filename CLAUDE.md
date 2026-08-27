# LOS CASERITOS — tienda web (`productos/`)

Tienda de venta de artículos generales (hogar, tecnología, belleza, herramientas)
para Ivirgarzama y el trópico de Cochabamba. HTML + CSS + JS puro, sin frameworks.
Se llamaba TropiMarket hasta el 23/08/2026. "Casero/casera" = el trato de confianza
del mercado boliviano.

## Arranque
- **`INICIAR.bat`** (doble clic) es la forma normal de abrirla: deja la ventana
  abierta, así se ve de un vistazo si está prendida. Celeste, para no confundirla
  con la de MOTO-IVIR que es verde. Avisa si el puerto ya estaba ocupado y avisa
  en rojo si el servidor se cayó, en vez de cerrarse sola.
- `node serve.js` → tienda en `http://localhost:3001`, panel en `/admin.html`
- ⚠️ **El 3001 lo comparte con el proyecto `autoventa` (AutoTrópico)**, que lo tiene
  FIJO en el código (`const PORT = process.env.PORT || 3001`). No se pueden tener
  los dos abiertos: el que arranque segundo no levanta. `INICIAR.bat` lo detecta y
  lo dice, pero la ventana que ve el error es la de la tienda, así que si AutoTrópico
  llegó primero hay que cerrarlo a él.
- `node serve.js --red` → además contesta a la WiFi, para probar en el celular.
  Qué pasa con el panel en ese modo depende de si hay clave configurada:
  - **sin `.env`**: `admin.html`, `herramientas/`, `logos/` y `data/` solo contestan a
    127.0.0.1; al resto de la WiFi le devuelven 403 (el panel no tiene contraseña).
  - **con `PANEL_CLAVE_HASH` en `.env`** (que es como está hoy): manda el login, no la IP.
    Cualquiera en la WiFi llega a `entrar.html` y entra si sabe la clave. `tienePermiso()`
    deja de mirar si la petición es local. Es a propósito: así se abre el panel desde el
    celular. El freno son los 6 intentos / 10 min por IP.
- **NO abrir el HTML con doble clic**: el catálogo se carga por `fetch` de
  `productos.json` y `file://` lo bloquea.

## Arquitectura
- `productos.json` — **fuente única de verdad**: productos, categorías, subcategorías,
  envíos por pueblo, cupones, contacto y config de analítica.
- `tienda-publicada.html` — la tienda. Ya NO tiene productos hardcodeados.
- `admin.html` — panel local (sin contraseña, solo 127.0.0.1). Edita el catálogo,
  guarda por `POST /api/guardar` y deja respaldo en `data/respaldos/`.
- `serve.js` — estáticos + API. **Dos modos según haya clave configurada**:
  sin `.env` → 127.0.0.1 y panel abierto; con `PANEL_CLAVE_HASH` → pide login y
  escucha hacia afuera si `MODO=produccion`. `tienePermiso()` decide en un solo lugar.
- `src/config.js` — lee `.env` (lector propio, sin dependencias) y variables del hosting.
- `src/seguridad.js` — scrypt para claves, cookie firmada con HMAC para sesiones,
  y freno de 6 intentos / 10 min por IP. Sin librerías externas.
- `entrar.html` — pantalla de login. `herramientas/clave.cjs` genera el hash.
- `generar-sitemap.js` — regenera `sitemap.xml` y `robots.txt` desde el catálogo.
- `herramientas/logo-dibujo.cjs` — **única fuente del dibujo del logo** (un león,
  desde el 25/08/2026; antes era una casita sobre una canasta). Solo geometría,
  no escribe nada. Lo usan los dos scripts de abajo, así no hay paths duplicados.
  Saca **tres versiones del mismo león**, y cada una tiene su lugar:
  - `LEON()` — silueta blanca calada, para el cuadrito verde. Aguanta 16 px
    porque no tiene nada que perder. Favicon, ícono de la app, panel, login.
  - `LEON_COLOR()` — la plana de tres colores. Hoy no se usa; quedó como respaldo.
  - `LEON_DETALLE()` — la ilustrada: melena en tres capas de tufos irregulares,
    cara con volumen, ojos con iris y brillo, hocico con nariz y almohadillas.
    Va en la imagen de compartir y en el encabezado de la tienda.
- ⚠️ **La variación de los tufos de la melena usa semilla fija**, no `Math.random()`.
  Con azar de verdad el logo saldría distinto en cada corrida del generador y el
  git se llenaría de ruido. Con semilla fija el archivo es siempre igual.
- **Lo que hace que un león dibujado no parezca un sol** (cada punto costó una
  vuelta): la melena no puede ser una estrella regular, tienen que ser tufos de
  largo y ancho desparejos en varias capas de tono; la cabeza tiene que ser
  ANCHA y pisar la melena —si queda un filo del fondo entre las dos, se ve
  recortada y pegada—; las orejas tienen que asomar AFUERA de la silueta de la
  cabeza o no se ven; y las almohadillas de los bigotes van en un tono cercano
  al de la cara, porque en crema se leen como un bigote blanco.
  Lo que NO funcionó: dibujar una sombra de melena sobre la frente. Se veía como
  una vincha. El volumen lo da el degradado radial de la cara y nada más.
- `herramientas/logo.cjs` — lo viste y lo reparte: genera `logo.svg`, `icono.svg`,
  `icono-mascara.svg`, el data URI del favicon, Y lo inyecta en `tienda-publicada.html`,
  `admin.html`, `entrar.html` (encabezado + favicon) y en el bloque `<!--SIMBOLO-->`
  de `herramientas/og.html`. No editar esos SVG ni esos bloques a mano.
- `herramientas/logo-franja.cjs` — la versión a color con el nombre al lado. Saca
  dos cosas distintas y **no son la misma achicada**:
  - el logo del **encabezado** (300×56), que inyecta incrustado en el
    `<svg class="marca-franja">` de `tienda-publicada.html`;
  - la **franja de la portada** (400×100, `logos/franja-{clara,oscura}.svg`),
    que sigue **sin usarse**: es la candidata para reemplazar al `<h1>`.
  Más `logos/logo-tamanos.html`, para verlo a los tamaños de uso real.
- ⚠️ **El logo del encabezado NO es la franja achicada.** En la franja el león es
  tan alto como todo el bloque y el nombre mide 38 de 100; a los ~42 px que hay
  en el encabezado eso daba "LOS CASERITOS" a 16 px y "DEL TRÓPICO" a 6 —peor
  que el texto que reemplazaba—. El que tiene que achicarse es el **león**: en la
  versión del encabezado ocupa todo el alto pero solo el 19% del ancho.
- Como la tienda ya no tiene `<svg class="marca-svg">`, `logo.cjs` dice
  "sin cambios" para `tienda-publicada.html`. No está roto: ahí ya solo le queda
  el favicon, y eso lo sigue reemplazando.
- `herramientas/og.html` — genera `img/og.jpg` (1200×630) dibujando un SVG en un canvas
  y mandándolo a `POST /api/guardar-imagen` (lista blanca: solo puede escribir og.jpg/png).
- `herramientas/publicar.cjs` — arma `publicar/` con SOLO lo que va a internet
  (tienda-publicada.html → index.html, ajusta `sw.js`, reemplaza el dominio en todos
  lados). Aborta si detecta `admin.html`/`serve.js`/`data` colados. Netlify Drop.

## Los tres aspectos (25/08/2026)
La tienda tiene **tres temas**: Claro, Oscuro y **Dorado**. El dorado traduce el
aspecto de `motoivir.com` —azul noche `#0b1020` con acento oro `#eab308`— y está
puesto **para que el comerciante compare y elija**: la idea es que al final quede
uno solo, no los tres para siempre.

- Todo sale de las **18 variables CSS** de `:root`. Un tema es un bloque más.
  `:root[data-theme="oro"]` va DESPUÉS del bloque claro: le tiene que ganar al
  `@media (prefers-color-scheme:dark)`, que cuelga de `:root` pelado.
- ⚠️ **`--green` no quiere decir "verde"**, quiere decir "el color de lo que se
  toca" — botones de comprar, precios, chips activos. Por eso el oro entra por
  esa variable y no hizo falta tocar ninguna regla de los componentes.
- ⚠️ **`--sobre-acento`**: el texto encima del acento estaba escrito a mano
  (`color:#fff`) en 4 reglas — `.btn-primary`, `.chip.active`, `.tag.nuevo` y
  `.add`. Sobre el dorado el blanco no se lee (1,9:1). Ahora sale de variable:
  blanco en claro/oscuro, `#1a1205` en dorado. Medido: **9,67:1**.
- ⚠️ **`color-scheme` en cada bloque de tema, o los `<select>` quedan ilegibles**
  (26/08/2026). La lista que se abre al tocar un desplegable **no la dibuja la
  página, la dibuja el sistema**: hereda el color del TEXTO de la hoja de estilos,
  pero el fondo lo elige el navegador — y si nadie le dice en qué tema está,
  elige blanco. En oscuro y en dorado las opciones salían con el casi blanco de
  `--ink` sobre blanco: **1,12:1**, invisibles salvo la fila resaltada que pinta
  Windows. Ahora los cuatro bloques declaran `color-scheme` (`light` en `:root` y
  en `[data-theme="light"]`; `dark` en el `@media`, en `[data-theme="dark"]` y en
  `[data-theme="oro"]`) y hay una regla `select option{background:var(--surface);
  color:var(--ink)}`, que es lo que respetan Chrome y Firefox en Windows. Medido:
  **15,09** oscuro / **15,14** dorado / **16,77** claro.
  Es el mismo error que `--sobre-acento`: un color que vivía fuera del sistema de
  variables y se rompía al cambiar de tema. **Cualquier control que pinte el
  sistema operativo hay que revisarlo tema por tema** — el CSS no lo alcanza.
  Ojo: `color-scheme` también oscurece las barras de scroll y los controles
  nativos en los temas oscuros. Es lo correcto, pero es un cambio visual de más.
  `admin.html` tenía lo mismo en sus 7 desplegables (es oscuro fijo → `dark`);
  `entrar.html` no tiene ninguno. En la tienda caían tres: Ordenar, y el Pueblo y
  la Forma de pago del paso de envío.
- El botón **abre una lista con los nombres**, no cicla. Con dos temas ciclar
  andaba; con tres, un sol que no dice qué sigue es una lotería, y el cliente
  tiene que poder ir a uno a propósito para compararlos.
- ⚠️ **Escape cierra primero el menú y recién después llama a `cerrarTodo()`**,
  que hace `history.back()`. Sin ese freno, apretar Escape con solo el menú
  abierto sacaba al cliente de la tienda.
- `.tema-lista` va con `position:absolute`, **nunca `fixed`**: el header lleva
  `backdrop-filter` y eso crea bloque contenedor (el mismo problema que la barra
  de guardar del panel).
- `.tema-lista[hidden]{display:none}` es obligatorio: es `display:grid` y el
  grid ignora el atributo `hidden`. Mismo caso que `.fila[hidden]`.
- El `<meta name="theme-color">` se reescribe con cada tema; si no, en el dorado
  la tienda es azul noche y la barra del navegador queda verde.

## ⚠️ Gotchas
- **Regla del WhatsApp**: hoy `contacto.enlaceDirectoWhatsapp` está en **`true`**, y solo
  se puede porque el número ya es WhatsApp Business. Con una cuenta normal va en `false`:
  Meta suspende por volumen de mensajes entrantes desde `wa.me`. Con `false` la web NUNCA
  genera un `wa.me` —el número va como texto para copiar y los pedidos salen por
  Telegram/Messenger—; con `true` el enlace aparece en los tres lados a la vez: el botón
  de enviar el pedido, el contacto del pie y la consulta desde la ficha.
  El número vive en dos campos, `whatsapp` (con el 591) y `whatsappVisible`: al cambiarlo
  hay que tocar **los dos**.
- **Todo lo que entra al HTML pasa por `esc()`**. Sin eso, un nombre con comillas
  (`Televisor 43"`) rompe el atributo y la tarjeta. Ya pasó una vez.
- **`.fila[hidden]{display:none}`**: cualquier elemento con `display:flex` ignora el
  atributo `hidden` salvo que se lo anule explícitamente.
- **El stock es por producto, no por variante**: `enCarrito()` suma todas las líneas
  del mismo id antes de dejar agregar.
- **`cart` es un OBJETO indexado por `"id|variante"`, no un array.** No tiene `length`:
  se cuenta con `Object.keys(cart)`. Meterle una clave que no sea una línea rompe
  `cantidadTotal()`, que hace `cart[k].q` sobre todas las claves y devuelve NaN.
  Al restaurarlo de `localStorage` la cantidad se fuerza a entero (`Math.floor(Number())`)
  y se descarta lo que no sea >0: con un `"3"` de texto los totales se concatenaban
  en vez de sumar, y con `1e999` daban Infinity.
- Las variantes arrancan en la opción con `delta:0`, que es la que corresponde al
  nombre y al precio base del producto.
- Al publicar hay que cambiar el dominio en **4 lugares** (ver `LEEME.md`), porque
  WhatsApp no lee rutas relativas en `og:image`.
- ⚠️ **Regenerar `img/og.jpg` NO cambia lo que ve WhatsApp.** Esa imagen se cachea
  muy lejos: el servidor manda `max-age=604800` (7 días) y adelante está Cloudflare.
  Pasó de verdad (26/08/2026): el disco tenía la imagen nueva y
  `loscaseritos.com/img/og.jpg` seguía devolviendo la vieja, con
  `cf-cache-status: HIT` y 33 horas de antigüedad. Como la URL no cambia, nadie
  se entera de que hay otra versión.
  Lo resuelve **estampar una versión en la URL** (`img/og.jpg?v=mt9l3v16`), que
  `guardarImagen()` ahora hace solo cada vez que se reescribe la imagen —
  `sellarOG()` en `serve.js`. Con otra URL, Cloudflare está obligado a pedirla.
  `dominio.cjs` y `publicar.cjs` sobreviven al `?v=`: solo reemplazan el dominio.
- ⚠️ **Después de estampar la versión, la imagen queda FRÍA en Cloudflare**, y el
  primer pedido tiene que viajar hasta esta PC por el túnel. El robot de WhatsApp
  se cansa de esperar y arma la vista previa **sin imagen** — pasó el 26/08/2026.
  Y como guarda ese resultado por URL, esa dirección queda con la previa rota.
  **Antes de compartir, abrí una vez la URL nueva de la imagen en el navegador**
  para calentar la caché; con eso baja de un MISS lento a un HIT de 0,27 s.
- **Y encima WhatsApp guarda su propia vista previa por página.** Aunque la imagen
  ya esté bien, el link que ya compartiste sigue mostrando la vieja. Para forzarla,
  compartí una vez la dirección con algo pegado atrás (`loscaseritos.com/?v=2`):
  al ser otra URL de página, la vuelve a leer. Ojo — eso **solo** funciona si la
  URL de la imagen también cambió; si no, refresca la página y sigue bajando la
  imagen cacheada. Son dos cachés distintas y hay que romper las dos.
- **El logo se genera, no se edita**: si tocás un SVG a mano, el próximo
  `node herramientas/logo.cjs` lo pisa. Editá `logo-dibujo.cjs`.
- ⚠️ **`entrar.html` estaba fuera del reparto y con el dibujo copiado a mano**
  (otra clase, otra máscara), así que el reemplazo nunca la alcanzaba: al cambiar
  el logo se quedó con la canasta mientras las otras tres ya tenían el león. Ahora
  usa `<svg class="marca-svg">` y está en la lista de `logo.cjs`. **Una página
  nueva con el logo hay que agregarla a esa lista**, si no nace desincronizada.
- ⚠️ **El símbolo suelto va con `CENTRAR('1')` aunque no se achique.** La canasta
  ocupaba y10–93 y entraba sola en el viewBox; la melena del león llega a y−1, o
  sea que la punta de arriba caía afuera y el navegador la recortaba. `CENTRAR`
  no escala ahí: solo lo baja las 4 unidades que le faltan.
- **`img/og.jpg` no se regenera solo.** `logo.cjs` deja el león puesto en
  `herramientas/og.html`, pero el JPG que ve WhatsApp se dibuja abriendo esa
  página en el navegador. Hasta que se haga, la vista previa muestra el logo viejo.
- **El data URI del favicon necesita los espacios como %20**, si no algunos navegadores
  cortan la URL y no se ve el ícono.
- **El encabezado de la tienda ya no es "cuadrito + nombre escrito": es el logo
  entero** (león a color + LOS CASERITOS DEL TRÓPICO), incrustado como SVG. El
  cuadrito verde con el símbolo blanco sigue en `admin.html` y `entrar.html`.
  `.marca-franja` necesita `flex:0 0 auto`: sin eso el flex del header le come
  ancho y el logo sale deformado.
- ⚠️ **Al logo del encabezado se le fija el ANCHO, no el alto.** Con `height` fijo,
  el `max-width:58vw` del celular lo aplastaba en vez de achicarlo entero. Con
  `width` + `height:auto` el SVG saca el alto de su propia proporción.
  El `58vw` es el freno para teléfonos angostos: a 375 px el logo mide 218 y
  sobran 100 para el sol y el carrito, pero a 320 px se pasaba y empujaba el
  carrito fuera de la pantalla. Medido: encabezado 61 px y primer producto en
  387 px, los mismos que antes del cambio.
- **El service worker NO se registra en localhost ni en IPs 192.168/10./172.16-31**
  (`enDesarrollo` en el JS). Sin eso te muestra la versión cacheada de la página y
  parece que los cambios de CSS "no se aplican". Ya pasó una vez.
- **Altura de la portada en celular**: el primer producto tiene que verse sin scrollear.
  En ≤520px se ocultan `.hero .pill`, `.hero p` y `.hero-cta` (todo repetido en otro lado),
  el chat pasa a `.btn-chat` junto a la franja de ofertas, y `.barra-orden` arranca
  plegada detrás del botón ⚙ Filtros. Medido: 689px → 373px.
- `.btn-chat` se muestra recién en ≤520px, no en el bloque de 920px: entre 521 y 920
  los botones del hero siguen visibles y quedarían dos accesos al chat.
- **El botón ATRÁS del celular cierra la ficha/carrito, no la tienda.** `abrirCapa()`
  apila UNA entrada con `pushState`; pasar de ficha a carrito la reemplaza con
  `replaceState` en vez de apilar otra. Todos los cierres (✕, overlay, Escape) pasan
  por `cerrarTodo()` → `history.back()` → `popstate` → `cerrarVisual()`: una sola vía.
  NO usar `replaceState` para esto: no crea entrada y atrás sacaba al cliente del sitio.
- **El stock puede bajar mientras el cliente decide.** `problemasDeStock()` corre en cada
  `updateCart()`, bloquea `btnContinuar` y `irADatos()`/`irAEnvio()`, y ofrece
  `arreglarStock()`. Sin esto llegaban pedidos de cosas ya vendidas.
- **El teléfono se valida por cantidad de dígitos** (7 a 15), no por formato: así entran
  `71234567`, `+591 71234567` y `712-345-67`, pero no texto suelto.
- El renglón del carrito en ≤520px es **grid de 2 filas**; en una sola el nombre del
  producto se partía en tres líneas.
- **Sugerencias al pie de la ficha** (`relacionados()`): puntúa subcategoría 100,
  categoría 50, marca 25, precio parecido hasta 20, oferta +8, nuevo +4. Nunca sugiere
  agotados ni el producto que se está viendo.
- `.m-rel`, `.m-body` y `.modal-in` necesitan **`min-width:0`**: la fila de sugerencias
  (6 tarjetas en línea) estiraba el contenedor flex/grid y el botón "Agregar al carrito"
  se salía del borde del modal. El `overflow-x:auto` solo no alcanza.
- Al abrir una ficha se hace `.modal-in`.scrollTop=0: saltando entre sugerencias, la
  nueva ficha arrancaba a media altura.
- **NO usar `requestAnimationFrame` para throttlear el scroll.** Si la pestaña pasa a
  segundo plano el rAF no corre, la bandera queda trabada en `true` y el botón ↑ no
  vuelve a aparecer nunca. Va throttle por tiempo + `setTimeout` final. Ya pasó una vez.
- El botón ↑ lleva `.sobre-barra` cuando `#cartbar` está visible, si no la tapa.
- `lc_vistos` en localStorage guarda los últimos 12 productos vistos; “Lo que viste
  antes” se oculta si quedan menos de 2 disponibles (con uno solo no aporta nada).
- **Carrusel de categorías** (mismo patrón que MOTO-IVIR): `renderCats()` pinta la lista
  DOS veces y `iniciarGiroChips()` avanza 0.4px por cuadro; al pasar `scrollWidth/2`
  resta esa mitad y el salto es invisible. La copia lleva `aria-hidden` + `tabindex=-1`
  y el CSS la oculta salvo en ≤520px. Se frena con `pointerdown/touchstart/wheel/
  mouseenter` y retoma a los 3s; `debeGirar()` lo apaga si hay categoría elegida o
  búsqueda activa. Respeta `prefers-reduced-motion`.
- Acá el rAF SÍ va, porque el bucle se re-pide siempre al final (no hay bandera que
  se trabe). Lo que no se puede es usar rAF como guard de throttle — ver el botón ↑.
- `renderCats()` preserva `scrollLeft`: sin eso, tocar un chip devolvía la fila al
  inicio y el cliente perdía dónde iba.
- El buscador móvil (`.msearch`) vive DENTRO de `main.wrap`, arriba del catálogo.
- **Subida de fotos desde el panel**: `achicarFoto()` redimensiona en un canvas a
  1000px/0.82 antes de mandar nada, y `POST /api/guardar-imagen` las escribe. El nombre
  sale de `nombreDeArchivo()` (slug del producto + timestamp base36).
- `RE_FOTO` = `/^img\/[a-z0-9][a-z0-9_-]{0,60}\.(jpg|png|webp)$/` — sin puntos ni barras
  en el cuerpo del nombre, así no entran `..` ni subcarpetas. Además se verifica que la
  ruta resuelta caiga dentro de `img/`. Probado con `../`, `img/../../`, `serve.js`,
  subcarpetas y extensiones no permitidas: los cinco rechazados.
- Quitar una foto de un producto con la ✕ NO borra el archivo en el acto: puede estar
  en uso en otro producto. Lo barre el diálogo al cerrarse, o el botón 🧹.

- **El hash de la clave usa "." como separador, NO "$".** Un hash con `$` se rompe
  al pasar por variables de entorno: el shell y los paneles de hosting lo expanden
  como si fuera una variable. Ya nos pasó en las pruebas. `verificarClave()` acepta
  los dos por compatibilidad.
- `/api/evento` (analítica) es la ÚNICA ruta `/api/` sin auth: la manda la tienda
  pública. Todo lo demás pasa por `tienePermiso()`.
- En modo login, las rutas de `SOLO_LOCAL` devuelven **302 a /entrar.html**, no 403:
  así el comerciante llega solo a la pantalla de entrada.
- `.env` y `.env.ejemplo` están en `PROHIBIDOS` de `publicar.cjs`.
- ⚠️ **Los estáticos van por LISTA BLANCA** (`esPublico()`), no lista negra. Con lista
  negra el `.env` quedó descargable en las pruebas — con `SESION_SECRETO` adentro,
  o sea que se podía fabricar una sesión válida sin la clave. Un archivo nuevo debe
  nacer privado; si hay que publicarlo, se agrega a `PUBLICO_EXACTO`.
- ⚠️ **Y hay una SEGUNDA lista, `NUNCA`, que se mira ANTES del permiso** (25/08/2026).
  Son dos preguntas distintas: la lista blanca dice qué ve un desconocido; `NUNCA`
  dice qué no sale jamás. Hacía falta porque el guardián era "si no es público,
  pedí permiso" — y **una vez con permiso se servía cualquier archivo de la
  carpeta, `.env` incluido**. Con `SESION_SECRETO` en la mano se fabrican cookies
  válidas para siempre, y "Salir" no las corta (el corte es por hora de nacimiento
  y una cookie fabricada se pone la que quiera): un robo de sesión pasajero se
  volvía permanente. Cubre `.env*`, `data/`, `src/`, `.git/`, `node_modules/`,
  `*.cjs`, `serve.js`, `generar-sitemap.js` y `package*.json`. Devuelve **404 y no
  403**, que confirma que el archivo existe.
  Ojo con los `.js` sueltos: `sw.js` es público, así que van nombrados uno por uno
  y no por extensión.
- Con `DATOS_DIR`, el catálogo y las fotos viven ahí (`cfg.CATALOGO`, `cfg.FOTOS`) y se
  copian del proyecto la primera vez. Así actualizar el código no borra lo que cargó
  el comerciante. Los estáticos de `/productos.json` y `/img/` se sirven desde ahí.
- **Todas las rutas del front son RELATIVAS** (`api/guardar`, `entrar.html`, `href="./"`).
  Nunca poner `/api/...`: rompe si algún día la tienda cuelga de una subcarpeta.
- `BASE_PATH` solo se usa para las REDIRECCIONES que emite el servidor (302 a la
  pantalla de entrada). Hoy va VACÍO: la tienda vive en la raíz de su dominio.
- El `volver=` del login va SIN barra inicial y se usa como ruta relativa.
- `herramientas/dominio.cjs` deja la dirección puesta en los 4 lugares de una. Ojo:
  además hay que cambiar el Nombre de host de la ruta en el túnel de Cloudflare.
## Panel: las dos trampas del guardado (23/08/2026)
- **Las fotos se escriben apenas se eligen**, antes de que el producto exista, para
  poder mostrar la miniatura al instante. El precio: si se cancela, el archivo queda
  tirado. Ahora `fotosDeEstaPasada` anota lo subido en cada apertura del diálogo y el
  evento `close` del `<dialog>` barre lo que sobró:
  **Cancelar** → sobran todas; **Aceptar** → sobran las que se sacaron con la ✕.
- **Botón 🧹 Fotos sueltas** (`limpiarFotos()`) para las que quedaron de antes.
  `GET /api/fotos-sin-usar`, `POST /api/limpiar-fotos`, `POST /api/borrar-foto`.
- ⚠️ **El barrido general se niega si `sucio === true`.** `fotosEnUso()` lee el catálogo
  GUARDADO; un producto que todavía está solo en memoria no aparece ahí y sus fotos se
  verían como huérfanas. Sin ese freno, limpiar borraría la foto recién subida.
- `borrarFoto()` usa la misma `RE_FOTO` que para escribir, **y además** se niega si un
  producto guardado usa esa foto (`img/og.jpg` incluida, va en `IMAGENES_PERMITIDAS`).
  Copia a `data/respaldos/borrada-<fecha>-<nombre>` antes de borrar. Probado con
  `../serve.js`, `img/../../serve.js`, subcarpetas, `.txt` y `img/../.env`: rechazados.
- **Hay DOS guardados y confundían.** La foto es inmediata; el producto vive en memoria
  hasta tocar 💾 Guardar cambios. El comerciante que cerraba la pestaña perdía el
  trabajo. Ahora cada `marcarSucio()` anota un **borrador en `localStorage`**
  (`lc_borrador`, con 700 ms de espera) y al volver el panel ofrece **Recuperar**.
  `marcarLimpio()` lo borra.
- ⚠️ El borrador hay que **leerlo antes** de `marcarLimpio()`, que lo borra, y guardarlo
  en `borradorPendiente`: para cuando el admin toca "Recuperar", el de `localStorage`
  ya no está. Por eso `cargar()` hace `leerBorrador()` primero.
- `guardarBorrador()` llama a `recogerTienda()`: sin eso, lo que se edita en la pestaña
  "Tienda y envíos" no entra en `CFG` hasta el guardado y el borrador lo perdía.
- El pie del diálogo lo dice en palabras. El "arriba"/"abajo" del final cambia con el
  ancho (`si-ancho`/`si-angosto`): en la computadora el botón vive en la cabecera, en
  el celular baja como barra fija al pie.

## Panel en el celular (23/08/2026)
Todo vive en un solo `@media(max-width:560px)`; la computadora no cambia.

|  | antes | ahora |
|---|---|---|
| cabecera | 275 px | 108 px |
| barra de herramientas | 198 px | 44 px |
| hasta el primer producto | 589 px | 184 px |
| alto de cada producto | 101 px | 73 px |
| productos visibles | 3 | 8 |

- **La tabla deja de ser tabla**: cada producto es una grilla de dos renglones. El
  nombre ocupa el primer renglón entero (columnas 2 a 4) y el `#id · variante` va al
  lado, no debajo; abajo van Bs, Stock y los botones. Antes el nombre compartía fila
  con los botones, le quedaban 158 px y casi todos se partían en dos líneas.
- El corte va en **560 px y no en 520**: la tabla tiene `min-width:520px` y el `.wrap`
  se lleva 32 px, así que entre 521 y 560 sobraban 16 px de scroll lateral.
- ⚠️ `#tabla td` lleva `:not(.oculta-movil)` sí o sí: pesa más que el `.oculta-movil`
  del bloque de 720 px y sin eso reaparecen las columnas que hay que esconder.
- ⚠️ **`backdrop-filter` en el `<header>` rompe cualquier `position:fixed` que cuelgue
  de él.** Crea un bloque contenedor y el elemento se ancla al header, no a la ventana:
  la barra de guardar quedaba flotando a 107 px del techo. En celular va
  `backdrop-filter:none` + fondo opaco (sin desenfoque, el 8% de transparencia deja
  ver los productos pasando por atrás).
- ⚠️ **La clase `ancho` ya estaba tomada** por `.campo.ancho` (los campos que ocupan
  las dos columnas del formulario). Usar `.ancho{display:none}` para textos
  responsivos escondía Nombre, Descripción, Palabras, Fotos y Variantes en el celular.
  Por eso el par se llama **`si-ancho` / `si-angosto`**.
- **Guardar solo existe cuando hay algo que guardar**: `marcarSucio()`/`marcarLimpio()`
  ponen y sacan `body.hay-cambios`, y el CSS cuelga de ahí la barra fija al pie. Antes
  medía 322 px de ancho y el 95% del tiempo estaba apagado.
- **El chip de estado se oculta en celular**: de sus tres textos dos son "no pasa nada"
  y el tercero ya lo dice la barra al aparecer. Eran 116 px repetidos.
- **"+ Nuevo producto" es botón flotante** abajo a la derecha; sube a `bottom:74px`
  cuando aparece la barra de guardar para no taparse.
- El `.pista` (el párrafo "Precio y stock se editan directo en la tabla…") se oculta en
  celular: se lee una vez en la vida y ocupa 35 px para siempre.
- El ancho del filtro de categorías salió del `style=` inline a CSS: un estilo inline
  le gana a cualquier regla sin `!important`, y con `min-width:150px` fijo al buscador
  le quedaban 106 px ("Buscar proc…"). Ahora se reparten 2:1 a favor del buscador.


## Control de versiones (desde el 23/08/2026)
- El proyecto **ya es un repo git**. Antes no lo era: un cambio que saliera mal no
  tenía vuelta atrás. El commit `083efb0` es el punto de partida, con todo tal
  como estaba ese día.
- Fuera del repo por `.gitignore`: `.env` (tiene `SESION_SECRETO`), `publicar/`
  (se regenera), `data/respaldos/` y `data/eventos.jsonl` (datos del comerciante).
- `tienda-publicada.html.bak` se borró (1.3 MB, decía "Tropical Store"). Quedó
  guardado en el primer commit: `git show 083efb0:tienda-publicada.html.bak`.

## Cómo está publicada (24/08/2026)
Detalle completo en **`deploy/COMO-ESTA-PUBLICADA.md`**. El resumen:

- **`https://loscaseritos.com`**, con el panel en `/panel`. Dominio propio, en la
  raíz: nada de subcarpetas, `handle_path` ni `BASE_PATH`.
- **No hay servidor alquilado.** Corre en esta computadora (`apolcalipsis`) y sale
  por un **túnel de Cloudflare** (`cloudflared`, servicio de Windows). El túnel se
  llama `moto-ivir` y publica los dos sitios: `motoivir.com` → :3000 y
  `loscaseritos.com` → :3001. Un túnel admite varias rutas.
- Por eso acá **no hay** registros A, ni Caddy, ni certificados, ni systemd.
  Cloudflare pone el HTTPS.
- Se prende con **`INICIAR.bat`** y vive mientras esa ventana esté abierta.
- ⚠️ **Con el túnel, todas las visitas llegan desde `127.0.0.1`**, porque
  `cloudflared` corre en la misma máquina. La IP real viene en `CF-Connecting-IP`
  y `ipDe()` la lee; necesita `TRAS_PROXY=1`, que ya está en el `.env`. Sin eso el
  freno de 6 intentos es un cupo único para todos y seis fallos de cualquier bot
  dejan al comerciante 10 min afuera. NO combinar `TRAS_PROXY=1` con `--red`.
- `motoivir.com/caseritos` ya no sirve la tienda: `MOTO-IVIR/src/server.js` la
  reenvía con un **301** a `loscaseritos.com` conservando la consulta, porque hay
  links viejos dando vueltas por WhatsApp. Los dos proyectos quedaron
  **desacoplados**: la tienda no vive más dentro de MOTO-IVIR.
- Para mudarla a un VPS algún día: `deploy/DESPLIEGUE.md`.

## Repaso a fondo del 24/08/2026 (98 pruebas)
Se probó API, seguridad, panel y tienda de punta a punta. Lo que apareció:

- ⚠️ **"Salir" no cerraba nada.** Solo borraba la cookie del navegador; el token
  seguía siendo válido, así que quien lo tuviera copiado entraba igual. Ahora
  `crearSesion()` le pone la hora de nacimiento (`n`) y `revocarSesiones()` anota
  la hora del último Salir en `data/sesiones-cortadas`: toda sesión anterior a esa
  hora queda muerta. Va a un archivo para que el corte sobreviva a los reinicios.
  Hay un solo comerciante por tienda, así que un corte global alcanza.
- ⚠️ **`{"productos":[]}` borraba la tienda entera.** El archivo no es solo la lista
  de productos: adentro están categorías, pueblos de envío, cupones y los datos del
  negocio. `guardarCatalogo()` ahora exige `tienda`, `contacto`, `categorias` y
  `envios`, y que haya al menos una categoría y un pueblo. **Pasó de verdad durante
  las pruebas** — se recuperó del commit.
- **Freno de mano al guardar**: si un guardado deja menos de la mitad de los productos
  que había (y había 5 o más), el servidor responde **409** con `confirmable:true` en
  vez de obedecer. El panel lo convierte en una pregunta y reintenta con
  `?confirmar=1`. Perder 20 productos de golpe casi siempre es un accidente.
- ⚠️ **El freno de intentos se esquivaba con `X-Forwarded-For`.** Se tomaba el primer
  valor de la cadena, que lo escribe el cliente: mandando una IP distinta en cada
  intento se probaban claves para siempre (12 de 12 pasaron). Y no alcanzaba con estar
  detrás de Caddy, porque Caddy **agrega** la IP real al final de la lista que ya venía.
  Ahora la cabecera solo se mira si `cfg.TRAS_PROXY`, y se toma el **último** valor.
  `TRAS_PROXY` sale de `MODO=produccion`; se fuerza con `TRAS_PROXY=1` o se apaga con `0`.
- **Un cuerpo pasado de tamaño cortaba la conexión** sin contestar: `leerCuerpo()` hacía
  `req.destroy()` y el catch ya no tenía dónde escribir. Ahora devuelve **413** con
  mensaje y recién corta cuando la respuesta salió (`res.on('finish')`).
- **Las fotos descartadas no siempre se barrían.** El evento `close` del `<dialog>` es
  asincrónico: abriendo otro producto rápido, `editar()` vaciaba la lista pendiente
  antes de que corriera. Ahora `cerrarPasadaDeFotos()` no mira si se aceptó o canceló
  —borra lo que no quedó puesto en ningún producto de `CFG`— y se llama desde tres
  lados: al aceptar (sincrónico), en el `close`, y al abrir el siguiente producto.
- **`<img src="">` en la ficha**: con src vacío el navegador pide la **página entera**
  como si fuera una imagen. Una descarga de más en cada visita, y con datos móviles
  eso se paga. Se quitó el atributo; lo pone `pintarGaleria()`.
- **`imgFalla()` apilaba emojis**: al pasar de una foto a otra insertaba un div nuevo
  cada vez. Ahora es idempotente (`.sin-foto`) y `pintarGaleria()` limpia el anterior.
- El botón flotante tapaba la barra de guardar: el override iba con
  `body.hay-cambios #btnNuevo` (sin `.flotante`).

### Al probar en el navegador, cuidado con esto
- **`getComputedStyle` se atrasa un ciclo** dentro de la misma ejecución: después de
  tocar una clase, la primera lectura devuelve el valor viejo. Medir en llamadas
  separadas, o se diagnostican bugs que no existen (perdí un buen rato con eso).
- Y peor: **si la ventana no está pintando** (pestaña de fondo, vista previa
  cerrada), el navegador ni siquiera recalcula los estilos de los hijos. Las
  variables de `:root` sí responden, pero `.card` y compañía devuelven los
  valores del tema anterior. Parecía que el tema dorado no se aplicaba y estaba
  perfecto. **Para medir estilos hay que recargar la página con el tema ya
  puesto**, no cambiarlo en caliente.
- **Los `confirm()` se cancelan solos** en modo automático: hay que sustituirlos antes
  de probar `limpiarFotos()`, `borrar()` o `vaciarCarrito()`.
- **`pkill` no mata procesos en Windows.** Quedó un servidor vivo en el 4199 media
  sesión. Va `Get-NetTCPConnection -LocalPort N | Stop-Process`.
- Los eventos de analítica de las pruebas se van a `data/eventos.jsonl` y ensucian la
  pestaña "Qué buscan". Conviene filtrarlos por fecha al terminar.

## Pendientes
- **Los 26 productos del catálogo son de muestra.** El comerciante los va a borrar y
  cargar los suyos, así que no hay que preocuparse por los textos de relleno, el
  campo `marca` vacío ni el cupón `TROPI10` (resto del nombre viejo).
- Iconos PWA en PNG (192/512); hoy son SVG.
- Fotos a WebP.
- Registrar el nombre en Facebook / TikTok / Instagram para que coincida con la web.
- **Que la tienda no dependa de esta computadora**: hoy vive mientras el
  `INICIAR.bat` esté abierto y la PC prendida. Un VPS (~5 USD/mes) lo resuelve —
  `deploy/DESPLIEGUE.md`. No es urgente, pero es el techo del montaje actual.
- **Paso 4 pendiente**: multi-tienda (varios comerciantes en el mismo servidor, cada
  uno con su usuario y su carpeta de datos). Recién cuando haya un segundo cliente.
