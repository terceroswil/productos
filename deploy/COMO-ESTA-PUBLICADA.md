# 🧺 Cómo está publicada Los Caseritos

Esto describe el montaje **real**, el que está funcionando. Si algún día algo
se rompe, empezá por acá.

---

## El mapa

```
                                         ┌─ motoivir.com     → localhost:3000
Internet → Cloudflare → cloudflared ─────┤     (MOTO-IVIR, ventana verde)
                        en apolcalipsis  │
                                         └─ loscaseritos.com → localhost:3001
                                               (la tienda, ventana celeste)
```

**No hay servidor alquilado.** La tienda corre en la computadora `apolcalipsis`
y sale a internet por un **túnel de Cloudflare**. El túnel se llama `moto-ivir`
y lo abrió MOTO-IVIR, pero sirve para los dos: un túnel puede publicar varios
dominios, cada uno apuntando a un puerto distinto.

Por eso acá **no hay** registros A, ni Caddy, ni certificados que renovar, ni
`scp`, ni systemd. Nada de eso hace falta.

| Pieza | Qué hace | Dónde vive |
|---|---|---|
| **Cloudflare** | Registrador, DNS y la puerta de entrada. Pone el HTTPS. | la nube |
| **cloudflared** | Servicio de Windows. Sale hacia Cloudflare y recibe las visitas. | apolcalipsis |
| **serve.js** | La tienda y el panel. Escucha en `127.0.0.1:3001`. | apolcalipsis |

`cloudflared` corre como **servicio de Windows**, así que arranca solo con la
máquina. `serve.js` no: ese lo abrís vos con `INICIAR.bat`.

---

## Prenderla y apagarla

**Prender**: doble clic en `INICIAR.bat`, en la carpeta del proyecto. Se abre
una ventana celeste que hay que dejar abierta.

**Apagar**: cerrás esa ventana. `loscaseritos.com` deja de funcionar al toque.

> Si querés que arranque sola al prender la PC: `Win + R` → `shell:startup` →
> arrastrar ahí un acceso directo del `INICIAR.bat`.

✅ **El choque con AutoTrópico ya no existe** (07/09/2026). `autoventa` se mudó
al **3002**, así que los dos pueden estar abiertos a la vez. El 3001 es solo de
la tienda; MOTO-IVIR va en el 3000. `INICIAR.bat` igual avisa si el puerto
estuviera ocupado, que ahora solo puede pasar por una copia de la propia tienda.

---

## Las direcciones

| | |
|---|---|
| Tienda | https://loscaseritos.com |
| Panel | https://loscaseritos.com/panel |
| Tienda, en esta PC | http://localhost:3001 |

El usuario del panel sale de `PANEL_USUARIO` en el `.env`. La clave está
hasheada y **no se puede recuperar**; si se pierde, se genera una nueva:

```bash
node herramientas/clave.cjs "la clave nueva" caserito
```

y se pega el hash en `PANEL_CLAVE_HASH`.

---

## Lo que el túnel obliga a tener en cuenta

**Todas las visitas llegan desde `127.0.0.1`.** `cloudflared` corre en esta
misma máquina y se conecta al servidor por localhost, así que
`req.socket.remoteAddress` es siempre la misma para todo el mundo.

Eso rompía el freno de 6 intentos del login: pasaba a ser un cupo único
repartido entre todos los visitantes, y seis fallos de cualquier bot dejaban
al comerciante 10 minutos afuera de su propio panel.

Por eso `ipDe()` en `serve.js` lee **`CF-Connecting-IP`**, que la escribe
Cloudflare y la pisa si el visitante intenta mandarla. Necesita `TRAS_PROXY=1`
en el `.env`, que ya está puesto.

⚠️ **No combinar `TRAS_PROXY=1` con `--red`.** Con `--red` el servidor escucha
en toda la WiFi, y ahí cualquiera del vecindario puede inventarse la cabecera y
esquivar el freno. `config.js` avisa al arrancar si detecta esa combinación.

---

## Si algo se rompe

**`loscaseritos.com` da error 502**
La ventana celeste está cerrada, o `serve.js` se cayó. Doble clic en
`INICIAR.bat`.

**`loscaseritos.com` muestra otra cosa**
La ruta del túnel apunta al puerto equivocado. En Cloudflare: buscá `Tunnels`
con `Ctrl+K` → `moto-ivir` → **Rutas** → la de `loscaseritos.com` tiene que
decir `http://localhost:3001`.

**El panel dice "Demasiados intentos" y no fuiste vos**
Esperá 10 minutos. Si se repite seguido, revisá que `TRAS_PROXY=1` siga en el
`.env`: sin eso vuelve el cupo compartido.

**Los links viejos de `motoivir.com/caseritos`**
Siguen funcionando: MOTO-IVIR los reenvía con un 301 a `loscaseritos.com`,
conservando la consulta (`/caseritos/?p=8` → `loscaseritos.com/?p=8`).

---

## Cambiar de dirección

Si algún día cambia el dominio, la dirección vive en **cuatro lugares** que
tienen que coincidir, o WhatsApp comparte el link sin foto ni título:

```bash
node herramientas/dominio.cjs https://eldominionuevo.com
```

Eso los deja los cuatro puestos de una: `tienda.urlBase` del catálogo, el
`<head>` de `tienda-publicada.html` (og:image, og:url, canonical y los datos de
Google), el `sitemap.xml` y el `robots.txt`.

Después hay que cambiar el **Nombre de host** de la ruta en el túnel.

---

## ¿Y la carpeta `publicar/`?

`herramientas/publicar.cjs` arma un paquete con **solo** lo que va a internet
—sin panel, sin `serve.js`, sin `data/`— para subir a un hosting de archivos
estáticos tipo Netlify.

**Con el túnel no hace falta**: `serve.js` sirve la tienda directamente, y
además con el panel, que el paquete estático no puede tener. Sigue siendo útil
solo para una copia de respaldo o para mostrarle la tienda a alguien sin
depender de que esta PC esté prendida.

---

## Si algún día pasás a un servidor alquilado

El túnel tiene una limitación clara: **la tienda vive mientras esta computadora
esté prendida y con la ventana abierta**. Para un negocio que ya factura, eso
se vuelve incómodo.

En ese caso está [DESPLIEGUE.md](DESPLIEGUE.md), con los archivos de apoyo:
`caseritos.service` (systemd), `caseritos.env.ejemplo` y
`Caddyfile-loscaseritos.txt`. No es urgente ni obligatorio: lo de hoy funciona.
