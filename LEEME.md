# 🧺 Los Caseritos — tienda web

Tienda de artículos para el hogar, tecnología, belleza y herramientas, con entrega
en Ivirgarzama y todo el trópico de Cochabamba.

---

## Arrancar en tu computadora

```bash
node serve.js
```

- Tienda → http://localhost:3001
- Panel  → http://localhost:3001/admin.html

> ⚠️ **No abras `tienda-publicada.html` con doble clic.** El catálogo ahora vive en
> `productos.json` y el navegador bloquea la lectura de archivos locales por seguridad.
> Siempre levantá el servidor con `node serve.js`.

---

## 📱 Verla en el celular

La tienda es **mobile first**: en el celular se ve distinta y mejor que en la PC, así que
conviene probarla ahí antes de publicar.

```bash
node serve.js --red
```

Al arrancar te muestra la dirección, algo como `http://192.168.1.2:3001`.
**Escribila en el navegador del celular** (tiene que estar en la misma WiFi que la PC).

Qué probar en el celular, que en la PC no se ve igual:

- La **barra verde de abajo** con el total, que aparece al agregar algo
- La ficha del producto, que sube **desde abajo** como una app
- Los **chips de categoría**, que se deslizan con el dedo
- El formulario de pedido completo, hasta “Copiar mi pedido”

**Con `--red`, el panel y las herramientas quedan bloqueados** para el resto de la WiFi
(devuelven 403); solo se abren desde la PC. Sin `--red`, el servidor no sale de tu
computadora y el celular no lo va a encontrar.

### Si el celular no abre la página

1. **Que sea la misma WiFi.** Si el celular está con datos móviles, no funciona.
2. **El firewall de Windows.** La primera vez suele preguntar si permitís Node.js en
   la red — hay que decir que **sí, en redes privadas**. Si le diste que no, se cambia en
   *Firewall de Windows → Permitir una aplicación*.
3. **Escribí `http://`** adelante. Sin eso, el navegador lo toma como una búsqueda.
4. **Que no falte el `:3001`** al final de la dirección.

---

## Cargar un producto nuevo

```bash
node serve.js
```

Abrí **http://localhost:3001/admin.html** y tocá **“+ Nuevo producto”**.

| Campo | Qué poner |
|---|---|
| **Nombre** | Como lo dirías vendiendo. Es lo que se ve en la tarjeta |
| **Categoría / Subcategoría** | Dónde va. La subcategoría es la que agrupa las sugerencias |
| **Precio** | En bolivianos, solo el número |
| **Precio antes** | Solo si está en oferta. La web calcula el % sola. Dejalo en 0 si no |
| **Stock** | Cuántos tenés. En 0 sale “Agotado” y no se puede pedir |
| **¿Es novedad?** | Le pone la etiqueta “Nuevo” y lo lista en ✨ Nuevos |
| **Descripción corta** | Una línea, para la tarjeta |
| **Descripción larga** | El detalle, para cuando abren el producto |
| **Palabras** | 👉 **El campo que más vende.** Ver abajo |
| **Fotos** | Tocá “📷 Elegir fotos”. Se suben y se achican solas |
| **Variantes** | Solo si viene en tamaños o colores. Formato `etiqueta = diferencia de precio` |

Después: **“Aceptar”** → **“Guardar cambios”**. Listo, ya está en la tienda.

> Si la tienda ya está publicada, agregá un paso más: `node herramientas/publicar.cjs`
> y arrastrá la carpeta `publicar` a Netlify de nuevo.

### Las fotos

Elegís las fotos del celular o de la PC (o las arrastrás al recuadro) y el panel las
sube solo. **No hace falta copiarlas a ninguna carpeta ni escribir rutas.**

Se achican solas a 1000 px y se guardan como JPG: una foto de celular pesa 3–5 MB y
dejaría la tienda inusable con datos móviles; así queda en 15–150 KB. La primera foto
es la que se ve en el catálogo — el resto son la galería del producto.

---

## Editar lo que ya está cargado

Todo se hace desde el **panel** (`/admin.html`), sin tocar código:

| Pestaña | Para qué sirve |
|---|---|
| 📦 **Productos** | Alta, baja y edición. Precio y stock se cambian directo en la tabla. |
| 🏪 **Tienda y envíos** | Datos del negocio, contacto, costos de envío por pueblo y cupones. |
| 📊 **Qué buscan** | Lo más mirado, lo más agregado al carrito y **lo que buscaron y no encontraron**. |

Los cambios **no se aplican hasta tocar “Guardar cambios”**. Cada guardado deja una
copia de seguridad en `data/respaldos/`.

### El campo “Palabras”, que es el que más vende
Es el más importante para vender. Ahí va como **habla el cliente**, no como dice la caja:

- Televisor → `tv, tele, television, pantalla`
- Smartphone → `celular, telefono, movil, fono`
- Foco LED → `foco, ampolleta, bombilla, lampara`

El buscador ignora tildes, así que `cafe` encuentra “Cafetera” y `audifonos` encuentra “Audífonos”.

---

## ⚠️ La regla del WhatsApp

En `productos.json` → `contacto.enlaceDirectoWhatsapp`:

- **`false` (como está ahora)** → la web **nunca** genera un enlace `wa.me`. El número
  aparece como texto grande para copiar, y los pedidos salen por Telegram o Messenger.
- **`true`** → aparece el botón “Enviar por WhatsApp” con el pedido ya escrito.

**Dejalo en `false` hasta migrar el número a WhatsApp Business.** Meta suspende
automáticamente los números personales que reciben mucho tráfico desde enlaces `wa.me`.
Se cambia desde el panel, en *Tienda y envíos*.

---

## Entregarle la tienda a un comerciante

Si le armás la tienda a otra persona, ella tiene que poder cargar sus productos
sola, desde el celular, sin terminal ni comandos. Para eso el panel se protege
con usuario y clave.

### 1. Generá su clave

```bash
node herramientas/clave.cjs "Mango-Canasta-Rio-7" don-julio
```

Te imprime tres líneas. Copialas en un archivo llamado `.env` (podés partir de
`.env.ejemplo`) o pegalas en la configuración del hosting.

**La clave nunca se guarda tal cual**, solo un resumen del que no se puede volver
atrás. Si el comerciante la pierde, generás otra y listo — nadie puede recuperarla,
ni vos.

Elegí claves de 12 caracteres o más. Tres palabras con guiones se recuerdan fácil
y son difíciles de adivinar: `Mango-Canasta-Rio-7`.

### 2. El servidor cambia solo de modo

| Situación | Qué pasa |
|---|---|
| **Sin `.env`** (tu computadora) | El panel se abre directo, pero solo desde esa máquina |
| **Con `.env` y clave** | El panel pide usuario y contraseña |

No hay que tocar el código: el mismo `serve.js` sirve para los dos casos.

### 3. Lo que ve el comerciante

```
1. Entra a  tutienda.com/admin.html
2. Lo manda solo a la pantalla de entrada
3. Pone su usuario y su clave
4. "+ Nuevo producto" → foto → guardar
```

La sesión le dura 30 días, así que no tiene que escribir la clave cada vez.
Cuando termina puede tocar **Salir**.

### Lo que está protegido

- Tras **6 intentos fallidos**, esa dirección queda bloqueada 10 minutos. Ni con la
  clave correcta entra hasta que pase el tiempo.
- Si se equivoca de usuario o de clave, el mensaje es el mismo: no se le confirma
  a nadie qué usuario existe.
- La tienda para el cliente **sigue siendo pública siempre**. Lo que se protege es
  el panel y todo lo que escribe archivos.

> ⚠️ El archivo `.env` tiene la clave: **nunca se sube a internet**.
> `publicar.cjs` ya lo deja afuera y aborta si detecta que se coló.

### Cuando lo subas a un servidor

Poné `MODO=produccion` y, si el hosting tiene un disco aparte para datos,
`DATOS_DIR=/ruta/al/disco`. Eso último es importante: en los planes gratis de
Render y Railway **el disco se borra en cada reinicio**, y ahí se te van los
productos y las fotos que cargó el comerciante.

---

## Mostrarla rápido dentro de MOTO-IVIR

Si ya tenés MOTO-IVIR andando en un servidor, la forma más rápida de mostrar la
tienda es dejarla colgada de ahí:

```bash
node herramientas/copiar-a-motoivir.cjs
```

Queda en **motoivir.com/caseritos**. Sirve para mostrársela a un cliente sin
gastar un peso más. El **panel no funciona así** (los productos los cargás en tu
PC y volvés a copiar). Todo explicado en `deploy/DESPLIEGUE.md`.

---

## Publicar la tienda en internet

Sirve tanto para **mostrársela a alguien de otra ciudad** como para dejarla publicada
de verdad. Son dos comandos y arrastrar una carpeta.

### 1. Armá el paquete

```bash
node herramientas/publicar.cjs
```

Crea la carpeta **`publicar/`** con exactamente lo que va a internet: la tienda
(renombrada a `index.html`), el catálogo, las fotos, el logo y el sitemap.

Deja afuera el panel, el servidor, las herramientas y los respaldos, y **se niega a
terminar si detecta que se coló algo privado**. Nunca subas la carpeta del proyecto
entera: `admin.html` no tiene contraseña, y publicado quedaría abierto a cualquiera.

### 2. Subila

1. Entrá a **https://app.netlify.com/drop**
2. Arrastrá la carpeta `publicar` a la página
3. En unos segundos te da una dirección tipo `https://algo-random.netlify.app`

No hace falta crear cuenta ni pagar. Esa dirección ya la podés mandar por WhatsApp
a cualquier parte del mundo.

### 3. Dejá el dominio puesto (importante)

Para que al compartir el link salga la foto y el título en vez de un texto pelado,
volvé a correr el comando **con la dirección que te dio Netlify**, y arrastrá la
carpeta de nuevo:

```bash
node herramientas/publicar.cjs https://TU-DIRECCION.netlify.app
```

Eso deja la dirección correcta en el `og:image`, el `canonical`, los datos para Google
y el sitemap, todo de una. **WhatsApp y Facebook no leen rutas relativas**: si el dominio
no coincide, el link se comparte sin imagen.

### 4. Para actualizar precios más adelante

Editá en el panel local → **Guardar cambios** → volvé a correr `publicar.cjs` →
arrastrá la carpeta otra vez. Netlify reemplaza todo y la dirección no cambia.

> Si más adelante comprás un dominio propio (`loscaseritos.bo`, por ejemplo), se conecta
> desde el panel de Netlify y volvés a correr el comando con ese dominio.

---

## Enlaces que podés mandar por chat

| Enlace | Qué muestra |
|---|---|
| `tudominio.com/?p=7` | Abre **ese producto** directo, con su foto y precio |
| `tudominio.com/?cat=Cocina` | El catálogo ya filtrado por categoría |
| `tudominio.com/?q=licuadora` | El catálogo ya buscando esa palabra |

El botón 🔗 dentro de la ficha de cada producto copia su enlace listo para pegar.
**Mandar el link de un producto puntual vende mucho más que mandar la tienda entera.**

---

## La marca

**Los Caseritos** — de *casero/casera*, el trato de confianza del mercado.

El logo es un **techo de casa sobre una canasta** (porque "casero" lleva "casa" adentro).
Vive en un solo lugar y de ahí sale todo lo demás:

```bash
node herramientas/logo.cjs
```

Eso regenera `logo.svg`, `icono.svg`, `icono-mascara.svg`, **el favicon y el símbolo
del encabezado** de la tienda y del panel, y la plantilla de la imagen de compartir.
Todo sale del mismo lugar, así que no quedan versiones desincronizadas.

En `logos/comparar.html` están las 4 propuestas de logo y en
`logos/comparar-tamanos.html` se ve cómo rinde a 16, 24, 36 y 72 px, que es la prueba
que importa: si a tamaño favicon se convierte en una mancha, no sirve.

### La imagen de compartir

Es la que aparece cuando mandás el link por WhatsApp, Facebook o Telegram (1200×630).
Para regenerarla — por ejemplo si cambiás el nombre o agregás categorías:

1. `node serve.js`
2. Abrí **http://localhost:3001/herramientas/og.html**
3. Botón **“Guardar como img/og.jpg”**

Se arma sola con los datos de `productos.json`. Si el servidor no está corriendo,
el botón **“Descargar a mi PC”** te la baja igual para copiarla a mano a `img/`.

---

## Detalles que ya están resueltos

Cosas que funcionan solas y conviene no romper:

- **El botón atrás del celular** cierra la ficha o el carrito, no la tienda. Es el gesto
  que más usa la gente en el celular.
- **Si algo se agota mientras el cliente arma el pedido**, el carrito lo marca, bloquea
  el envío y ofrece “Ajustar mi pedido”. Así no te llegan pedidos que no podés cumplir.
- **El teléfono se valida**: no entra texto suelto, pero sí `71234567`, `+591 71234567`
  o `712-345-67`.
- **“También te puede servir”** al pie de cada ficha sugiere 6 productos cercanos
  (misma subcategoría primero). Nunca sugiere agotados.
- **“Lo que viste antes”** al final del catálogo, para que quien vuelve retome donde iba.
- **Botón ↑** para volver arriba, que se corre solo para no tapar la barra del carrito.

---

## Mapa de archivos

| Archivo | Qué es |
|---|---|
| `tienda-publicada.html` | La tienda (HTML + CSS + JS en un solo archivo) |
| `productos.json` | **El catálogo**: productos, categorías, envíos, cupones y contacto |
| `admin.html` | Panel de administración (solo local) |
| `serve.js` | Servidor local + API del panel. Escucha solo en 127.0.0.1 |
| `generar-sitemap.js` | Regenera `sitemap.xml` y `robots.txt` desde el catálogo |
| `sw.js` | Hace que la tienda cargue rápido y ande con señal mala |
| `data/eventos.jsonl` | Registro de búsquedas y vistas (alimenta “Qué buscan”) |
| `data/respaldos/` | Copia del catálogo antes de cada guardado |
| `logo.svg` | El logo (cuadrito verde + casita y canasta) |
| `icono.svg` · `icono-mascara.svg` | Íconos de la app instalable |
| `herramientas/og.html` | Genera la imagen de compartir |
| `herramientas/publicar.cjs` | Arma la carpeta `publicar/` para subir a internet |
| `herramientas/clave.cjs` | Genera la clave del panel |
| `entrar.html` | Pantalla de entrada al panel |
| `src/seguridad.js` | Claves, sesiones y freno a los intentos |
| `src/config.js` | Lee la configuración del `.env` o del hosting |
| `.env` | **Tiene la clave. Nunca se sube.** Partí de `.env.ejemplo` |
| `publicar/` | Se genera sola. Es lo único que va al hosting |
| `herramientas/logo.cjs` | **Genera todo el logo** y lo deja puesto en las páginas |
| `logos/` | Las 4 propuestas de logo y las páginas para compararlas |
| `img/` | Fotos. Se llaman `p{id}.jpg`, pero el nombre ahora es libre |
| `img/og.jpg` | Imagen de compartir. **No la edites a mano**: se regenera |

---

## Pendientes conocidos

- `tienda-publicada.html.bak` es la versión vieja del archivo. Se puede borrar.
- Los iconos de la app instalable son SVG. Para que se vean mejor en Android conviene
  exportarlos a PNG de 192×192 y 512×512 y actualizarlos en `manifest.webmanifest`.
- Falta registrar el nombre en redes: Facebook, TikTok e Instagram como `loscaseritos`
  o similar, para que coincida con la web.
- El campo `marca` de los productos está vacío a propósito: cargalo con las marcas
  reales que vendés y el buscador las va a encontrar solo.
- Las fotos son JPG. Convertirlas a WebP bajaría el peso a la mitad.
