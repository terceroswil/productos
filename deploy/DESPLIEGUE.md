# 🧺 Si algún día pasás Los Caseritos a un servidor alquilado

> **Esto no es lo que está funcionando hoy.** Hoy la tienda sale por un túnel
> de Cloudflare desde la computadora `apolcalipsis`, y eso está contado en
> [COMO-ESTA-PUBLICADA.md](COMO-ESTA-PUBLICADA.md). Leé eso primero.
>
> Esta guía es para el día que quieras mudarla a un VPS.

## Por qué mudarse (y por qué no)

El túnel tiene una sola limitación, pero es grande: **la tienda vive mientras
esa computadora esté prendida y con la ventana del `INICIAR.bat` abierta**. Un
apagón, un reinicio de Windows o una ventana cerrada sin querer y el negocio
está fuera del aire hasta que alguien lo note.

Un VPS de unos 5 USD al mes arregla eso: prendido siempre, y los procesos se
levantan solos si se caen.

Mientras el volumen sea chico y estés cerca de la máquina, el túnel alcanza. No
hay apuro.

---

## Lo que hay que tener antes de empezar

- Un VPS con Ubuntu y acceso por SSH
- La IP del VPS
- `loscaseritos.com` en Cloudflare (ya lo tenés)

---

## Paso 1 — Preparar el servidor

```bash
apt update && apt install -y nodejs npm caddy
```

Node tiene que ser **22.13 o más nuevo**:

```bash
node --version
```

Un usuario propio para la tienda, que no sea root:

```bash
adduser --system --group --home /opt/caseritos caseritos
mkdir -p /var/lib/caseritos
chown -R caseritos:caseritos /opt/caseritos /var/lib/caseritos
```

> Los datos van en `/var/lib/caseritos`, **fuera** de la carpeta del código. Así
> actualizar el proyecto no borra el catálogo ni las fotos que subió el
> comerciante.

---

## Paso 2 — Subir el código

Desde tu computadora:

```bash
scp -r . root@IP-DEL-VPS:/opt/caseritos
```

Ojo: el `.env` **no** se sube. Se arma aparte en el paso siguiente.

---

## Paso 3 — La configuración

```bash
nano /etc/caseritos.env
```

Copiá el contenido de [caseritos.env.ejemplo](caseritos.env.ejemplo). El hash de
la clave se genera en tu computadora:

```bash
node herramientas/clave.cjs "la clave del comerciante" caserito
```

```bash
chmod 600 /etc/caseritos.env
```

> `BASE_PATH` va **vacío**. Solo sirve si la tienda cuelga de una subcarpeta, y
> con dominio propio no es el caso.

---

## Paso 4 — Encenderlo

```bash
cp /opt/caseritos/deploy/caseritos.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now caseritos
systemctl status caseritos
```

`Restart=always` en el servicio hace que se vuelva a levantar solo si se cae.

---

## Paso 5 — Caddy

El bloque está en [Caddyfile-loscaseritos.txt](Caddyfile-loscaseritos.txt):

```
loscaseritos.com, www.loscaseritos.com {
	encode gzip

	reverse_proxy localhost:3001
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy saca el certificado HTTPS solo, gratis.

---

## Paso 6 — Mover el DNS del túnel al VPS

Este es el paso que cambia por dónde entra la gente, así que va al final,
cuando lo de arriba ya está probado.

En Cloudflare, `loscaseritos.com` → **DNS** → **Registros**. Hoy hay un `CNAME`
que apunta al túnel (`...cfargotunnel.com`). Se borra y se ponen dos registros
`A` con la IP del VPS:

| Tipo | Nombre | Contenido | Proxy |
|---|---|---|---|
| A | `@` | IP-DEL-VPS | **DNS only** (nube gris) |
| A | `www` | IP-DEL-VPS | **DNS only** (nube gris) |

### ⚠️ La nube tiene que estar gris

Con la nube naranja, Caddy ve la IP del borde de Cloudflare en vez de la del
visitante. `ipDe()` toma el **último** valor de `X-Forwarded-For`, que sería
siempre el mismo, y **todos los visitantes vuelven a compartir el cupo** del
freno de intentos: seis fallos de cualquiera y el comerciante queda 10 minutos
afuera del panel.

Con la nube gris, Caddy ve la IP real.

> Para prender la nube naranja (vale la pena por el caché y la protección DDoS)
> hay que dejar que `ipDe()` siga leyendo `CF-Connecting-IP` —ya lo hace— y
> poner el modo SSL/TLS en **Full (strict)**. Con el proxy naranja esa cabecera
> también viene puesta, así que el freno sigue funcionando bien.

Esperá a que resuelva antes de dar por terminada la mudanza:

```bash
dig +short loscaseritos.com
```

---

## Paso 7 — Probar

- **https://loscaseritos.com** → la tienda, con candado
- **https://loscaseritos.com/panel** → pide usuario y clave
- Subir una foto desde el panel y ver que quede en `/var/lib/caseritos/img`

Si el candado no aparece, casi siempre es el DNS que todavía no propagó:

```bash
journalctl -u caddy -n 40 --no-pager
```

---

## Cuando esté andando

Apagá el `INICIAR.bat` de la computadora y borrá la ruta de `loscaseritos.com`
del túnel de Cloudflare, para que no queden dos tiendas sirviendo lo mismo con
catálogos que se van a ir separando.

---

## Comandos del día a día

```bash
systemctl status caseritos
```

```bash
journalctl -u caseritos -f
```

## Actualizar el código sin perder datos

```bash
systemctl stop caseritos
scp -r . root@IP-DEL-VPS:/opt/caseritos
systemctl start caseritos
```

El catálogo y las fotos viven en `/var/lib/caseritos`, así que no se tocan.
