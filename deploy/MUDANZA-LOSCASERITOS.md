# 🧺 Mudanza a loscaseritos.com

Guía concreta para este caso: el dominio está comprado en **Cloudflare** y la
tienda va a correr en el **mismo VPS que motoivir.com**, como sitio aparte.

Es la versión aterrizada del "camino C" de [DESPLIEGUE.md](DESPLIEGUE.md), con
lo que aquella no cubre: las dos trampas de Cloudflare.

---

## Quién hace qué

Conviene tenerlo claro antes de tocar nada, porque el nombre confunde:

| Pieza | Qué hace |
|---|---|
| **Cloudflare** | Registrador y DNS. Dice "loscaseritos.com está en tal IP". **No corre nada.** |
| **El VPS** | La máquina donde vive el código. Ya la tenés, ahí corre motoivir.com. |
| **Caddy** | En el VPS. Recibe las visitas, saca el certificado HTTPS y reparte por dominio. |
| **systemd** | En el VPS. Mantiene los dos procesos prendidos y los levanta si se caen. |

Después de esto quedan **dos procesos separados en la misma máquina**:

```
                    ┌─ motoivir.com     → localhost:3000  (MOTO-IVIR)
Cloudflare → Caddy ─┤
                    └─ loscaseritos.com → localhost:3001  (Los Caseritos)
```

Separados a propósito: MOTO-IVIR maneja saldos con dinero. Si la tienda se
cae, la ruleta sigue andando, y actualizar el catálogo no reinicia nada de
MOTO-IVIR.

---

## Paso 1 — El DNS en Cloudflare

En el panel de Cloudflare, `loscaseritos.com` → **DNS** → **Records**. Dos
registros:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| A | `@` | IP-DEL-VPS | **DNS only** (nube gris) |
| A | `www` | IP-DEL-VPS | **DNS only** (nube gris) |

### ⚠️ La nube tiene que estar GRIS, no naranja

Cloudflare pone la nube naranja (proxy) por defecto. Apagala. Hay dos motivos,
y el segundo es el importante:

**1. El certificado.** Con el proxy activo Cloudflare termina el TLS él mismo.
Si el modo SSL de la cuenta quedó en "Flexible" mientras Caddy redirige a
HTTPS, se arma un bucle infinito de redirecciones y el sitio no carga.

**2. El freno de intentos del panel se vuelve global.** Con el proxy activo,
Caddy ve la IP de Cloudflare, no la del visitante. `ipDe()` en `serve.js` toma
el **último** valor de `X-Forwarded-For`, que en esa cadena es el borde de
Cloudflare. Resultado: **todos los visitantes comparten el mismo cupo**. Seis
logins fallidos de cualquiera —o de un bot— y el comerciante queda 10 minutos
afuera de su propio panel. Es una negación de servicio de un renglón.

Con la nube gris, Caddy ve la IP real y el freno vuelve a ser por visitante.

> Si más adelante querés el proxy de Cloudflare (vale la pena por el caché y
> la protección DDoS), primero hay que enseñarle a `ipDe()` a leer la cabecera
> `CF-Connecting-IP`, y recién ahí prender la nube naranja con el modo SSL en
> **Full (strict)**. Son unas pocas líneas; está anotado al final.

---

## Paso 2 — Esperar a que resuelva

```bash
dig +short loscaseritos.com
```

Si devuelve la IP del VPS, seguí. Si no devuelve nada, esperá: tarda de unos
minutos a unas horas. **No sigas sin esto**: Caddy necesita que el dominio ya
apunte a la máquina para conseguir el certificado.

Desde Windows, si no tenés `dig`:

```bash
nslookup loscaseritos.com
```

---

## Paso 3 — Dejar la dirección puesta en el proyecto

En tu computadora:

```bash
node herramientas/dominio.cjs https://loscaseritos.com
```

Deja la dirección en los cuatro lugares de una: `productos.json`
(`tienda.urlBase`), el `og:image` / `og:url` / `canonical` / datos de Google de
`tienda-publicada.html`, y regenera `sitemap.xml` y `robots.txt`.

> **Recién acá**, no antes. Si lo corrés mientras el DNS todavía no resuelve y
> publicás, las vistas previas de WhatsApp apuntan a un dominio muerto y los
> links salen sin foto ni título.

Después regenerá la imagen de compartir abriendo `herramientas/og.html` con el
servidor local corriendo, y armá el paquete:

```bash
node herramientas/publicar.cjs
```

---

## Paso 4 — Subir el código al VPS

```bash
scp -r . root@IP-DEL-VPS:/opt/caseritos
```

Si es la primera vez, antes hay que crear el usuario, la carpeta de datos y el
servicio: está en los **pasos 3 a 5** de [DESPLIEGUE.md](DESPLIEGUE.md).

---

## Paso 5 — Sacar BASE_PATH

```bash
nano /etc/caseritos.env
```

La línea `BASE_PATH` tiene que quedar **vacía** o borrada:

```
BASE_PATH=
```

> Si queda con `/caseritos`, la pantalla de entrada del panel redirige a
> `loscaseritos.com/caseritos/entrar.html` y da 404. Es el error más fácil de
> cometer en esta mudanza.

```bash
systemctl restart caseritos
```

---

## Paso 6 — El bloque en Caddy

El bloque está entero en [Caddyfile-loscaseritos.txt](Caddyfile-loscaseritos.txt).
Se **agrega** al `/etc/caddy/Caddyfile`; el de `motoivir.com` se queda:

```
loscaseritos.com, www.loscaseritos.com {
	encode gzip

	reverse_proxy localhost:3001
}
```

Y en el bloque de `motoivir.com` cambiás la gimnasia de la subcarpeta por una
redirección, para no perder lo que Google ya indexó ni los links que mandaste
por WhatsApp:

```
handle_path /caseritos/* {
	redir * https://loscaseritos.com{uri} permanent
}
```

`handle_path` quita el prefijo antes del `redir`, así
`motoivir.com/caseritos/?p=8` aterriza en `loscaseritos.com/?p=8` y no en
`loscaseritos.com/caseritos/?p=8`.

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

---

## Paso 7 — Probar

- **https://loscaseritos.com** → la tienda, con candado
- **https://www.loscaseritos.com** → lo mismo
- **https://loscaseritos.com/panel** → pide usuario y clave
- **https://motoivir.com** → intacto
- **https://motoivir.com/caseritos/?p=8** → redirige a `loscaseritos.com/?p=8`
- Compartir `https://loscaseritos.com` por WhatsApp → tiene que salir con
  logo, título y descripción

Si el candado no aparece, casi siempre es el DNS que todavía no propagó:

```bash
journalctl -u caddy -n 40 --no-pager
```

---

## Comandos del día a día

```bash
systemctl status caseritos motoivir
```

```bash
journalctl -u caseritos -f
```

---

## Más adelante: encender el proxy de Cloudflare

Cuando quieras el caché y la protección DDoS, el orden es:

1. En `serve.js`, que `ipDe()` lea `CF-Connecting-IP` cuando `cfg.TRAS_PROXY`
   esté activo. Esa cabecera la pone Cloudflare y no se puede falsificar desde
   afuera, a diferencia de `X-Forwarded-For`.
2. En Cloudflare: modo SSL/TLS en **Full (strict)**.
3. Recién ahí, la nube naranja.

En ese orden. Al revés, el panel del comerciante queda expuesto a que
cualquiera lo bloquee 10 minutos con seis intentos fallidos.
