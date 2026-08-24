# 🧺 Poner Los Caseritos en el VPS que ya tenés

Aprovecha el mismo servidor donde corre MOTO-IVIR. **MOTO-IVIR no se toca**: la
tienda va al lado, como vecino, con su propio proceso y su propia carpeta.

Al terminar vas a tener:

```
motoivir.com              →  MOTO-IVIR, igual que ahora
motoivir.com/caseritos    →  la tienda + el panel del comerciante
```

**No hace falta tocar el DNS**: es el mismo dominio que ya tenés andando.

## Hay dos caminos. Elegí según lo que necesites hoy

| | **A · Rápido** | **B · Completo** |
|---|---|---|
| Qué es | Copiar la tienda dentro de MOTO-IVIR | Servidor propio al lado |
| La tienda anda | ✅ | ✅ |
| **El panel en internet** | ❌ | ✅ |
| Cargar productos | En tu PC, y volver a copiar | Desde el celular, al instante |
| Trabajo | 2 comandos | 7 pasos |
| Para qué sirve | **Mostrarle la tienda a un cliente** | Entregársela ya vendida |

Si todavía estás mostrando la tienda para vender, el **A** alcanza y sobra.
Cuando el cliente diga que sí, hacés el **B**.

---

# A · El camino rápido

MOTO-IVIR ya sirve todo lo que hay en su carpeta `public/`, así que basta con
dejar la tienda ahí adentro.

## A1 — Copiar

```bash
node herramientas/copiar-a-motoivir.cjs
```

Arma el paquete público (sin panel, sin `.env`, sin herramientas) y lo copia a
`MOTO-IVIR/public/caseritos/`.

## A2 — Una línea en MOTO-IVIR

En `MOTO-IVIR/src/server.js`, **antes** de `app.use('/', publico);`:

```js
app.use('/caseritos', express.static(path.join(PUBLIC_DIR, 'caseritos')));
```

> Tiene que ir antes de esa línea: si no, la página del cliente se come la
> petición y devuelve 404.

Esto ya está puesto. Probalo local: **http://localhost:3000/caseritos/**

## A3 — Subir

```bash
scp -r public/caseritos root@IP-DEL-VPS:/opt/moto-ivir/public/
scp src/server.js root@IP-DEL-VPS:/opt/moto-ivir/src/
ssh root@IP-DEL-VPS "systemctl restart moto-ivir"
```

Listo: **motoivir.com/caseritos**

## Lo que NO funciona en el camino A

**El panel.** `motoivir.com/caseritos/panel` va a dar 404, porque el panel
necesita el servidor de la tienda corriendo, y acá solo se copiaron archivos.

Para cargar productos mientras tanto:

1. `node serve.js` en tu computadora
2. Cargás en `localhost:4100/panel`
3. `node herramientas/copiar-a-motoivir.cjs`
4. Subís la carpeta otra vez

Sirve perfecto para mostrar. Para que el comerciante cargue solo, hacé el B.

---

# B · El camino completo

## Por qué al lado y no adentro

- **MOTO-IVIR maneja plata** (saldos de la ruleta). Si comparten proceso y la
  tienda falla, se cae todo junto. Separados, uno no se entera del otro.
- **Todas las rutas del front son relativas**, así que la tienda funciona igual
  colgada de una subcarpeta. Caddy le quita el prefijo con `handle_path` y el
  servidor recibe las rutas normales.
- **Cuando el cliente lo compre, movés una carpeta** y cambiás el dominio. Si
  estuvieran mezcladas, habría que separar `node_modules`, `.env` y `data`.
- Los Caseritos **no tiene dependencias**: solo Node. No hay `npm install`.

---

## Paso 1 — Dejar la dirección puesta

Antes de subir nada, decile al proyecto dónde va a vivir:

```bash
node herramientas/dominio.cjs https://motoivir.com/caseritos
```

Eso lo deja en los cuatro lugares donde hace falta (catálogo, `og:image`,
`canonical`, datos de Google, sitemap y robots). Si no coinciden, el link se
comparte por WhatsApp **sin foto ni título**.

Después regenerá la imagen de compartir: levantá el servidor local, abrí
`herramientas/og.html` y tocá "Guardar como img/og.jpg".

> El DNS no se toca: ya apunta a tu VPS.

## Paso 2 — Subir los archivos

Desde tu computadora, parado en la carpeta del proyecto:

```bash
scp -r . root@IP-DEL-VPS:/opt/caseritos
```

> Ojo: no subas la carpeta `publicar/` ni `node_modules` si existen. Tampoco tu
> `.env` local — en el servidor va otro, en `/etc/caseritos.env`.

## Paso 3 — Preparar el servidor

Conectate y creá el usuario y las carpetas:

```bash
ssh root@IP-DEL-VPS
```

```bash
adduser --system --group --no-create-home caseritos
mkdir -p /var/lib/caseritos
chown -R caseritos:caseritos /var/lib/caseritos /opt/caseritos
```

## Paso 4 — La clave del comerciante

En tu computadora, generá sus credenciales:

```bash
node herramientas/clave.cjs "Mango-Canasta-Rio-7" don-julio
```

En el servidor, creá el archivo de configuración:

```bash
nano /etc/caseritos.env
```

Pegá lo que te imprimió el comando, más esto:

```
MODO=produccion
PORT=4100
DATOS_DIR=/var/lib/caseritos
BASE_PATH=/caseritos
```

> `BASE_PATH` es lo que hace que, cuando el panel te mande a la pantalla de
> entrada, no te saque de la tienda. Sin eso, el comerciante termina en
> `motoivir.com/entrar.html`, que no existe.

Y cerralo a que solo root lo lea:

```bash
chmod 600 /etc/caseritos.env
```

> `PORT=4100` no choca con MOTO-IVIR, que usa el 3000.

## Paso 5 — Encenderlo

```bash
cp /opt/caseritos/deploy/caseritos.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now caseritos
systemctl status caseritos --no-pager
```

Tiene que decir `active (running)`. Si no:

```bash
journalctl -u caseritos -n 40 --no-pager
```

## Paso 6 — La subcarpeta en Caddy

```bash
nano /etc/caddy/Caddyfile
```

**Reemplazá** tu bloque de `motoivir.com` por este (está también en
`deploy/Caddyfile-agregar.txt`):

```
motoivir.com, www.motoivir.com {
	encode gzip

	redir /caseritos /caseritos/

	handle_path /caseritos/* {
		reverse_proxy localhost:4100
	}

	handle {
		reverse_proxy localhost:3000
	}
}
```

Tres cosas que importan:

- **`handle_path` quita el prefijo** antes de pasar la petición. El servidor de la
  tienda recibe `/productos.json`, no `/caseritos/productos.json`. Por eso no hay
  que tocar su código.
- **El `redir`** manda `/caseritos` a `/caseritos/`. Sin la barra final, las rutas
  relativas apuntarían al dominio raíz y no cargaría nada.
- **El orden importa**: `handle_path` (más específico) va antes que `handle`.

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

## Paso 7 — Probar

Abrí en el navegador:

- **https://motoivir.com/caseritos** → la tienda
- **https://motoivir.com/caseritos/panel** → pide usuario y clave

Y comprobá que MOTO-IVIR sigue intacto: **https://motoivir.com**

---

## Cuando el cliente lo compre

Es una mudanza, no un rearmado:

1. En el VPS: `tar -czf caseritos.tgz /opt/caseritos /var/lib/caseritos /etc/caseritos.env`
2. Lo llevás al servidor nuevo (o dejás el mismo y solo cambiás el dominio).
3. `node herramientas/dominio.cjs https://eldominiodelcliente.com` — deja la
   dirección puesta en los cuatro lugares de una.
4. Sacá `BASE_PATH` de `/etc/caseritos.env` (en un dominio propio ya no cuelga
   de ninguna subcarpeta).
5. Bloque propio en el Caddyfile con el dominio del cliente, y sacás el
   `handle_path /caseritos/*` del bloque de motoivir.com.

Mientras tanto, en el subdominio tuyo, **no le cuesta nada a nadie**.

---

## Comandos del día a día

```bash
systemctl restart caseritos          # reiniciar
journalctl -u caseritos -f           # ver qué pasa, en vivo
systemctl status caseritos           # ¿está andando?
```

**Respaldo de lo que cargó el comerciante** (productos y fotos):

```bash
tar -czf ~/respaldo-caseritos-$(date +%F).tgz /var/lib/caseritos
```

Vale la pena hacerlo antes de cada actualización de código.

## Actualizar el código sin perder datos

Los productos y las fotos viven en `/var/lib/caseritos`, **fuera** de la carpeta
del código. Por eso actualizar es seguro:

```bash
scp -r . root@IP-DEL-VPS:/opt/caseritos
ssh root@IP-DEL-VPS "systemctl restart caseritos"
```
