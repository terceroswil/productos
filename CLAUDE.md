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
- `node serve.js` → tienda en `http://localhost:4100`, panel en `/admin.html`
- `node serve.js --red` → además contesta a la WiFi, para probar en el celular. En ese
  modo `admin.html`, `herramientas/`, `logos/` y `data/` devuelven 403 a todo lo que no
  sea 127.0.0.1 (el panel no tiene contraseña).
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
- **Regla del WhatsApp**: `contacto.enlaceDirectoWhatsapp` está en `false` a propósito.
  Con `false` la web NUNCA genera un `wa.me`; el número va como texto para copiar y los
  pedidos salen por Telegram/Messenger. Poner en `true` SOLO con WhatsApp Business.
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
- Quitar una foto de un producto NO borra el archivo de `img/`: puede estar en uso en
  otro producto o el admin puede arrepentirse.


## Pendientes
- Migrar el número a WhatsApp Business y recién ahí encender el enlace directo.
- Iconos PWA en PNG (192/512); hoy son SVG.
- Cargar el campo `marca` de los productos (está vacío a propósito).
- Fotos a WebP.
- Borrar `tienda-publicada.html.bak` (versión vieja, 1.2 MB, aún con el nombre TropiMarket).
- Registrar el nombre en Facebook / TikTok / Instagram para que coincida con la web.
- **Paso 3 pendiente**: subir a un VPS (~5 USD/mes) con `MODO=produccion` y `DATOS_DIR`
  apuntando a disco persistente. Los planes gratis de Render/Railway BORRAN el disco
  en cada reinicio: se pierden catálogo y fotos.
- **Paso 4 pendiente**: multi-tienda (varios comerciantes en el mismo servidor, cada
  uno con su usuario y su carpeta de datos). Recién cuando haya un segundo cliente.
