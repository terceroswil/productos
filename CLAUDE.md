# MOTO-IVIR — Notas del proyecto

Sistema de delivery / mandados / mototaxi por WhatsApp para pueblos del Trópico
de Cochabamba (Ivirgarzama y alrededores). Node + Express + SQLite nativo de Node
(`node:sqlite`, requiere Node ≥ 22.13). Incluye un módulo aparte de ruleta/sorteos
con dinero (`/ruleta`).

## Arranque
- `npm start` → panel en `http://localhost:3000`
- Config en `.env` (copiar de `.env.example`). NO commitear `.env`.
- `WHATSAPP_MODE`: `simulador` | `qr` (whatsapp-web.js) | `meta` (Cloud API)

## Mapa rápido de archivos
- `src/server.js` — servidor y montaje de rutas.
- `src/db.js` — esquema SQLite + migraciones suaves.
- `src/routes/api.js` — API del panel admin (`/api`, auth por token Bearer).
- `src/routes/ruleta.js` — módulo ruleta (usuarios, saldos, sorteos).
- `src/routes/publico.js` — **página del cliente** (`/`). Ver nota abajo.
- `public/app.jsx` — panel admin (React por CDN, un solo archivo).
- `public/ruleta/` — front del jugador; `public/ruleta/admin/` — panel de ruleta.

## ⚠️ Gotchas importantes
- **`publico.js` genera TODO el HTML+CSS+JS de la página del cliente como un
  string concatenado** (700+ líneas). Para editar: buscar por clase/comentario.
  El `<script>` está partido como `'<scr'+'ipt>'` a propósito.
- La página del cliente **no usa HTML semántico** (no hay `<h1>`, `<header>`,
  `<section>`, `<nav>`, `<footer>`). Todo son `<div>` con clases. Mejora pendiente
  para SEO/accesibilidad.
- **weasyprint NO aplica los `@media (max-width:480px)`** al renderizar para
  previsualizar el celular. Para verificar el look móvil hay que forzar las reglas
  (inyectar un `<style>` con `!important`) o probar en un navegador real.
- El SQLite de Node emite `ExperimentalWarning` — es normal.

## Seguridad (commit c3e6b20)
- **Ruleta admin protegida**: todas las rutas `/api/ruleta/admin/*`, el giro
  oficial `/spin` y el `/reset` exigen token de admin (`requireAdmin`). Antes
  estaban ABIERTAS (cualquiera podía cambiar saldos / aprobar recargas).
- **PIN hasheados** con scrypt (`s2$salt$hash`), con migración transparente en el
  login. El login ya no devuelve el PIN.
- **Sin credenciales fijas**: el admin de ruleta sale de `RULETA_ADMIN_IDENTIFIER`
  / `RULETA_ADMIN_PIN` en `.env`. `api.js` aborta si falta `ADMIN_PASSWORD`.
- Rate-limit en el login de ruleta.
- **Restablecer PIN de jugador**: los PIN están hasheados (scrypt), NO se pueden
  recuperar. Si un jugador olvida el suyo, el admin usa el botón **🔑 Clave** en
  el panel (`POST /admin/users/:id/reset-pin`, `requireAdmin`): genera un PIN
  temporal de 4 dígitos, lo guarda hasheado y lo muestra UNA sola vez para
  dictarlo. No se guardan claves en texto a propósito (hay dinero de por medio).
  Auditado como `reset_pin`. El PIN del admin NO se resetea aquí: va por `.env`.
- Pendiente del usuario: cambiar `RULETA_ADMIN_PIN` por uno propio.

## Página del cliente (commit 0c6a7fe)
- **Bugs arreglados**: se definió `aplicarFiltrosCombinados()` (faltaba → error JS);
  el selector de ciudad ahora **filtra de verdad** (se agregó `m.pueblo_id` a la
  query y `data-pueblo` a cada tarjeta); se quitó ~45 líneas de código muerto.
- **Portada simplificada**: se quitaron el banner de TikTok, el reproductor de
  música, los sellos de confianza y la sección "Nuestros Servicios" (4 tarjetas).
  El paso 1 "¿Qué necesitas?" (Mandado/Carrera/Bici) SÍ se mantiene.
- **Contacto sin enlace directo**: tarjeta compacta con el número GRANDE como
  texto real + botón/número "toca para copiar". Motivo: el WhatsApp personal se
  bloqueaba por volumen de mensajes. Plan: pasar el número a **WhatsApp Business**
  y recién ahí reactivar enlace directo.
  - El número está en la variable JS `NUM_CONSULTAS` y en el texto grande de la
    tarjeta. Al cambiar de número hay que actualizar **ambos**.
- **Espaciado**: ritmo vertical ~3–4px entre bloques de la portada. Se quitó el
  `margin-top:-10px` de `.lista` (complicaba el cálculo del gap).

- **El hash de la clave usa "." como separador, NO "$".** Un hash con `# MOTO-IVIR — Notas del proyecto

Sistema de delivery / mandados / mototaxi por WhatsApp para pueblos del Trópico
de Cochabamba (Ivirgarzama y alrededores). Node + Express + SQLite nativo de Node
(`node:sqlite`, requiere Node ≥ 22.13). Incluye un módulo aparte de ruleta/sorteos
con dinero (`/ruleta`).

## Arranque
- `npm start` → panel en `http://localhost:3000`
- Config en `.env` (copiar de `.env.example`). NO commitear `.env`.
- `WHATSAPP_MODE`: `simulador` | `qr` (whatsapp-web.js) | `meta` (Cloud API)

## Mapa rápido de archivos
- `src/server.js` — servidor y montaje de rutas.
- `src/db.js` — esquema SQLite + migraciones suaves.
- `src/routes/api.js` — API del panel admin (`/api`, auth por token Bearer).
- `src/routes/ruleta.js` — módulo ruleta (usuarios, saldos, sorteos).
- `src/routes/publico.js` — **página del cliente** (`/`). Ver nota abajo.
- `public/app.jsx` — panel admin (React por CDN, un solo archivo).
- `public/ruleta/` — front del jugador; `public/ruleta/admin/` — panel de ruleta.

## ⚠️ Gotchas importantes
- **`publico.js` genera TODO el HTML+CSS+JS de la página del cliente como un
  string concatenado** (700+ líneas). Para editar: buscar por clase/comentario.
  El `<script>` está partido como `'<scr'+'ipt>'` a propósito.
- La página del cliente **no usa HTML semántico** (no hay `<h1>`, `<header>`,
  `<section>`, `<nav>`, `<footer>`). Todo son `<div>` con clases. Mejora pendiente
  para SEO/accesibilidad.
- **weasyprint NO aplica los `@media (max-width:480px)`** al renderizar para
  previsualizar el celular. Para verificar el look móvil hay que forzar las reglas
  (inyectar un `<style>` con `!important`) o probar en un navegador real.
- El SQLite de Node emite `ExperimentalWarning` — es normal.

## Seguridad (commit c3e6b20)
- **Ruleta admin protegida**: todas las rutas `/api/ruleta/admin/*`, el giro
  oficial `/spin` y el `/reset` exigen token de admin (`requireAdmin`). Antes
  estaban ABIERTAS (cualquiera podía cambiar saldos / aprobar recargas).
- **PIN hasheados** con scrypt (`s2$salt$hash`), con migración transparente en el
  login. El login ya no devuelve el PIN.
- **Sin credenciales fijas**: el admin de ruleta sale de `RULETA_ADMIN_IDENTIFIER`
  / `RULETA_ADMIN_PIN` en `.env`. `api.js` aborta si falta `ADMIN_PASSWORD`.
- Rate-limit en el login de ruleta.
- **Restablecer PIN de jugador**: los PIN están hasheados (scrypt), NO se pueden
  recuperar. Si un jugador olvida el suyo, el admin usa el botón **🔑 Clave** en
  el panel (`POST /admin/users/:id/reset-pin`, `requireAdmin`): genera un PIN
  temporal de 4 dígitos, lo guarda hasheado y lo muestra UNA sola vez para
  dictarlo. No se guardan claves en texto a propósito (hay dinero de por medio).
  Auditado como `reset_pin`. El PIN del admin NO se resetea aquí: va por `.env`.
- Pendiente del usuario: cambiar `RULETA_ADMIN_PIN` por uno propio.

## Página del cliente (commit 0c6a7fe)
- **Bugs arreglados**: se definió `aplicarFiltrosCombinados()` (faltaba → error JS);
  el selector de ciudad ahora **filtra de verdad** (se agregó `m.pueblo_id` a la
  query y `data-pueblo` a cada tarjeta); se quitó ~45 líneas de código muerto.
- **Portada simplificada**: se quitaron el banner de TikTok, el reproductor de
  música, los sellos de confianza y la sección "Nuestros Servicios" (4 tarjetas).
  El paso 1 "¿Qué necesitas?" (Mandado/Carrera/Bici) SÍ se mantiene.
- **Contacto sin enlace directo**: tarjeta compacta con el número GRANDE como
  texto real + botón/número "toca para copiar". Motivo: el WhatsApp personal se
  bloqueaba por volumen de mensajes. Plan: pasar el número a **WhatsApp Business**
  y recién ahí reactivar enlace directo.
  - El número está en la variable JS `NUM_CONSULTAS` y en el texto grande de la
    tarjeta. Al cambiar de número hay que actualizar **ambos**.
- **Espaciado**: ritmo vertical ~3–4px entre bloques de la portada. Se quitó el
  `margin-top:-10px` de `.lista` (complicaba el cálculo del gap).

 se rompe al
  pasar por variables de entorno: el shell y los paneles de hosting lo expanden como
  si fuera una variable. Ya nos pasó en las pruebas. `verificarClave()` acepta ambos
  por compatibilidad.
- `/api/evento` (analítica) es la ÚNICA ruta `/api/` sin auth: la manda la tienda
  pública. Todo lo demás pasa por `tienePermiso()`.
- En modo login, las rutas de `SOLO_LOCAL` devuelven **302 a /entrar.html**, no 403:
  así el comerciante llega solo a la pantalla de entrada.
- `.env` y `.env.ejemplo` están en `PROHIBIDOS` de `publicar.cjs`.
- ⚠️ **Los estáticos van por LISTA BLANCA** (`esPublico()`), no lista negra. Con lista
  negra el `.env` quedó descargable en las pruebas — con `SESION_SECRETO` adentro,
  o sea que se podía fabricar una sesión válida sin la clave. Un archivo nuevo debe
  nacer privado; si hay que publicarlo, se agrega a `PUBLICO_EXACTO`.
- Con `DATOS_DIR`, el catálogo y las fotos viven ahí (`cfg.CATALOGO`, `cfg.FOTOS`) y se
  copian del proyecto la primera vez. Así actualizar el código no borra lo que cargó
  el comerciante. Los estáticos de `/productos.json` y `/img/` se sirven desde ahí.
- `deploy/` tiene el systemd, el env de ejemplo, el bloque de Caddy y la guía para
  montarlo en **motoivir.com/caseritos** (subcarpeta del VPS de MOTO-IVIR, procesos
  separados a propósito: MOTO-IVIR maneja saldos con dinero).
- **Vive en una subcarpeta**: Caddy usa `handle_path /caseritos/*` (quita el prefijo,
  así el servidor recibe rutas normales) + `redir /caseritos /caseritos/` (sin la barra
  final las rutas relativas apuntan al dominio raíz). `handle_path` va ANTES que `handle`.
- **Todas las rutas del front son RELATIVAS** (`api/guardar`, `entrar.html`, `href="./"`).
  Nunca poner `/api/...`: rompe cuando la tienda cuelga de una subcarpeta.
- `BASE_PATH=/caseritos` solo se usa para las REDIRECCIONES que emite el servidor
  (302 a la pantalla de entrada). Sin eso el comerciante termina fuera de la tienda.
- El `volver=` del login va SIN barra inicial y se usa como ruta relativa.
- `herramientas/dominio.cjs` deja la dirección puesta en los 4 lugares de una.
- **Dos formas de publicar**: `herramientas/copiar-a-motoivir.cjs` deja el paquete
  estático en `MOTO-IVIR/public/caseritos/` (rápido, la tienda anda, el panel NO);
  o el despliegue propio de `deploy/DESPLIEGUE.md` (systemd + Caddy, con panel).
- La línea `app.use('/caseritos', express.static(...))` en `MOTO-IVIR/src/server.js`
  va **antes** de `app.use('/', publico)`: si no, la página del cliente se come la
  petición y devuelve 404.

## Pendientes / siguientes pasos
- Paso 2: **HTML semántico** en la página del cliente (h1, header, section, footer)
  sin cambiar el diseño → mejor SEO/accesibilidad.
- Limpiar código muerto que quedó sin uso: CSS de `.sec-servicios-vir` /
  `.card-vir-*` y la función JS `explorarServicio` en `publico.js`.
- Rendimiento: `loading="lazy"` en imágenes, cachear la página.
- Cambiar `RULETA_ADMIN_PIN` y actualizar `NUM_CONSULTAS` cuando esté el número
  de WhatsApp Business.
- `git push` (aún no se ha subido a GitHub).

## Cómo verificar cambios en la página del cliente (local, sin tocar datos reales)
```
DATA_DIR=/tmp/test PORT=3999 WHATSAPP_MODE=simulador ADMIN_PASSWORD=x \
RULETA_ADMIN_PIN=1 node src/server.js
# luego: curl http://localhost:3999/  y revisar el HTML/JS
node -c src/routes/publico.js   # chequeo de sintaxis
```

---

# LOS CASERITOS — tienda web (`productos/`)

Tienda de venta de artículos generales (hogar, tecnología, belleza, herramientas)
para Ivirgarzama y el trópico de Cochabamba. HTML + CSS + JS puro, sin frameworks.
Se llamaba TropiMarket hasta el 23/08/2026. "Casero/casera" = el trato de confianza
del mercado boliviano.

## Arranque
- `node serve.js` → tienda en `http://localhost:3001`, panel en `/admin.html`
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
- `herramientas/logo.cjs` — **única fuente del logo**: genera `logo.svg`, `icono.svg`,
  `icono-mascara.svg`, el data URI del favicon, Y lo inyecta en `tienda-publicada.html`,
  `admin.html` (encabezado + favicon) y en el bloque `<!--SIMBOLO-->` de
  `herramientas/og.html`. No editar esos SVG ni esos bloques a mano.
- `herramientas/og.html` — genera `img/og.jpg` (1200×630) dibujando un SVG en un canvas
  y mandándolo a `POST /api/guardar-imagen` (lista blanca: solo puede escribir og.jpg/png).
- `herramientas/publicar.cjs` — arma `publicar/` con SOLO lo que va a internet
  (tienda-publicada.html → index.html, ajusta `sw.js`, reemplaza el dominio en todos
  lados). Aborta si detecta `admin.html`/`serve.js`/`data` colados. Netlify Drop.

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
- Las variantes arrancan en la opción con `delta:0`, que es la que corresponde al
  nombre y al precio base del producto.
- Al publicar hay que cambiar el dominio en **4 lugares** (ver `LEEME.md`), porque
  WhatsApp no lee rutas relativas en `og:image`.
- **El logo se genera, no se edita**: si tocás un SVG a mano, el próximo
  `node herramientas/logo.cjs` lo pisa. Editá el script.
- **El data URI del favicon necesita los espacios como %20**, si no algunos navegadores
  cortan la URL y no se ve el ícono.
- `.brand .leaf` necesita `flex:0 0 auto`: sin eso el flex del header le come ancho
  al cuadrito y el logo sale deformado.
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

## Dominio: subcarpeta vs. propio
- Hoy la dirección configurada es `https://motoivir.com/caseritos`. Está puesta
  en los 4 lugares y coinciden.
- **Con dominio propio se simplifica**: desaparecen `handle_path`, el `redir` de
  la barra final y `BASE_PATH`. El bloque de Caddy queda en 4 líneas
  (`deploy/Caddyfile-dominio-propio.txt`).
- ⚠️ Al mudarse hay que **vaciar `BASE_PATH`** en `/etc/caseritos.env`. Si queda
  con `/caseritos`, la pantalla de entrada del panel redirige a
  `caseritos.com/caseritos/entrar.html` → 404.
- El DNS (2 registros A: `@` y `www` → IP del VPS) va **antes** de recargar Caddy:
  sin eso no consigue el certificado y el sitio queda sin HTTPS.
- `MOTO-IVIR/public/caseritos/` es solo el paquete estático que deja
  `copiar-a-motoivir.cjs` — copia idéntica de `publicar/`, nada exclusivo. Con
  dominio propio deja de hacer falta.

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
- **Los `confirm()` se cancelan solos** en modo automático: hay que sustituirlos antes
  de probar `limpiarFotos()`, `borrar()` o `vaciarCarrito()`.
- **`pkill` no mata procesos en Windows.** Quedó un servidor vivo en el 4199 media
  sesión. Va `Get-NetTCPConnection -LocalPort N | Stop-Process`.
- Los eventos de analítica de las pruebas se van a `data/eventos.jsonl` y ensucian la
  pestaña "Qué buscan". Conviene filtrarlos por fecha al terminar.

## Pendientes
- **Dominio propio: ya está comprado — `loscaseritos.com`, en Cloudflare** (24/08/2026).
  Falta ejecutar la mudanza: `deploy/MUDANZA-LOSCASERITOS.md` (guía concreta) y
  `deploy/Caddyfile-loscaseritos.txt` (el bloque). Va en el mismo VPS que
  motoivir.com, como sitio aparte y **proceso aparte** (no como subcarpeta):
  motoivir.com → :3000, loscaseritos.com → :3001.
  - ⚠️ **Los registros A van en "DNS only" (nube gris), no naranja.** Con el proxy
    de Cloudflare activo, Caddy ve la IP del borde de Cloudflare y `ipDe()` toma el
    ÚLTIMO valor de `X-Forwarded-For`: **todos los visitantes comparten el mismo
    cupo del freno de intentos**. Seis logins fallidos de cualquiera dejan al
    comerciante 10 min afuera de su panel. Para prender la nube naranja hay que
    enseñarle antes a `ipDe()` a leer `CF-Connecting-IP`, y poner el modo SSL en
    Full (strict). En ese orden.
  - No correr `dominio.cjs` hasta que el DNS resuelva: si se publica antes, las
    vistas previas de WhatsApp apuntan a un dominio muerto y salen sin foto.
- Migrar el número a WhatsApp Business y recién ahí encender el enlace directo.
- Iconos PWA en PNG (192/512); hoy son SVG.
- Cargar el campo `marca` de los productos (está vacío a propósito).
- Fotos a WebP.
- Registrar el nombre en Facebook / TikTok / Instagram para que coincida con la web.
- **Paso 3 pendiente**: subir a un VPS (~5 USD/mes) con `MODO=produccion` y `DATOS_DIR`
  apuntando a disco persistente. Los planes gratis de Render/Railway BORRAN el disco
  en cada reinicio: se pierden catálogo y fotos.
- **Paso 4 pendiente**: multi-tienda (varios comerciantes en el mismo servidor, cada
  uno con su usuario y su carpeta de datos). Recién cuando haya un segundo cliente.
