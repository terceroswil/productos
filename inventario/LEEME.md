# 📦 Sistema de Inventario y Ventas — Los Caseritos

Sistema multi-tienda (**Ivirgarzama**, **Chimoré**, **Entre Ríos**) desarrollado en JavaScript nativo sobre **Node.js 24 + SQLite (`node:sqlite`)**. Diseñado específicamente para evitar pérdidas de mercadería, desacoples de caja y descontrol de precios cuando el dueño no está presente.

---

## 🚀 Cómo arrancar

1. **Doble clic en `INICIAR.bat`**, el mismo de la tienda. Desde el 12/10/2026 el inventario va **dentro** de la tienda: un solo programa (`serve.js`), un solo puerto (3001). Cerrar la ventana apaga los dos.
2. Se abre en **https://loscaseritos.com/inventario** desde cualquier lado (las tres tiendas, el celular del dueño), o en `http://localhost:3001/inventario` en esta PC.
   - Suelto (`node inventario/servidor.js`, puerto 3003) solo se usa para las pruebas. No correrlo a la vez que la tienda contra la misma base.
3. **Primera vez:** Te pedirá crear la cuenta del **Dueño** (nombre, usuario y contraseña de al menos 8 caracteres).
4. **Para probar en celulares o tablets de la misma red WiFi:**
   ```bash
   node inventario/servidor.js --red
   ```

---

## 🔒 Mecanismos contra pérdidas

1. **El stock nunca se escribe, se calcula:**
   - La base de datos no tiene una columna `stock` editable.
   - El stock de cada producto por sucursal es la suma en tiempo real de sus entradas (+), ventas (-), anulaciones (+), ajustes y conteo inicial.
   - Triggers en SQLite impiden editar o borrar ventas y movimientos en el historial.
2. **Precios fijos obligatorios:**
   - Al registrar la venta, el precio unitario sale **siempre de la base de datos**, nunca de lo que envíe el cliente o vendedor.
   - Si un producto está en oferta, cobra el precio de oferta y muestra el precio tachado.
3. **Firmado por usuario y sucursal:**
   - Cada empleado tiene su cuenta asignada a su tienda.
   - La vendedora solo puede operar en su tienda. No puede ver costos de compra, ganancias ni reportes globales.
4. **Control estricto de anulaciones:**
   - Una venta no se puede borrar.
   - El vendedor solo puede anular su propia venta durante los primeros 30 minutos y con motivo justificado.
   - El dueño puede anular en cualquier momento y ve todas las anulaciones destacadas en su pantalla de alertas.
5. **Conteo físico (Inventario inicial y auditoría):**
   - El conteo del primer día inicializa el stock de la tienda (`tipo: inicial`).
   - Todo conteo posterior que no coincida genera un movimiento de `ajuste` con motivo obligatorio y alerta al dueño.
   - Con el conteo abierto, el buscador filtra la lista. Con lector: escanear → Enter → escribir cuántos hay → Enter → escanear el siguiente.
6. **Un cobro es una venta, aunque llegue dos veces:**
   - La pantalla manda una `clave` por cobro. Si se corta internet y se toca Cobrar de nuevo, el servidor devuelve la venta que ya estaba (`repetida: true`) en vez de crear otra.
   - La pantalla manda también el total que mostró (`total_esperado`). Si el dueño cambió un precio con la lista ya armada, el servidor frena con 409 y la pantalla trae los precios nuevos: nunca se cobra un monto distinto al que se le dijo al cliente.
7. **Copia de seguridad automática:**
   - Una por día en `data/inventario/respaldos/inventario-AAAA-MM-DD.db`; la de hoy se actualiza cada hora. Se guardan las últimas 30.
   - Para recuperar: cerrar el inventario, copiar el respaldo sobre `data/inventario/inventario.db` y borrar `inventario.db-wal` e `inventario.db-shm`.
   - ⚠️ Están en el mismo disco: salvan de un archivo dañado o un borrado por error, **no** de que se rompa la computadora. Cada tanto conviene copiar esa carpeta a un USB o a la nube.

---

## ⚠️ Vender lo que el sistema dice que no hay (13/10/2026)

Se puede, pero no por descuido. El dueño eligió esto entre tres opciones (dejarlo pasar con un aviso, pedir confirmación, o bloquear).

- Al tocar **Cobrar**, si falta stock de algo, la venta NO se hace: aparece un recuadro con lo que falta y un botón aparte, **"Lo tengo en la mano, vender igual"**.
- Lo exige el servidor, no solo la pantalla: sin "confirmar_sin_stock: true" contesta 409.
- Queda anotado en el movimiento ("Vendido sin stock en el sistema: confirmó que lo tenía") y el stock negativo le salta al dueño en **Hoy**.
- No se bloquea del todo a propósito: si la vendedora tiene el producto en la mano, el que está mal es el sistema, y negarse a cobrar empuja a vender por afuera. Tiene sentido pasar a bloqueo recién cuando las tres tiendas tengan el stock bien contado.

---

## 🆕 Lo que se agregó el 13/10/2026

- **Opciones de precio (variantes).** Si en la web un producto viene en opciones (la sartén en 24, 28 y 32 cm), en **Vender** sale un renglón por opción, cada uno con su precio. El precio de la opción lo calcula el servidor desde la base. Igual que en la web, **el stock es del producto entero**, no de cada tamaño.
- **Gastos y retiros de caja.** En **Caja** se anota la plata que sale (un flete, o el dueño que se lleva efectivo). Se descuenta sola de lo que tiene que haber al cerrar, y cada uno le aparece al dueño en **Hoy** con el motivo y quién lo anotó.
- **Devoluciones.** Anular una venta que ya estaba en un cierre resta de la caja siguiente de quien la anuló. Antes esa plata no figuraba en ningún lado.
- **El dueño puede cerrar la caja de otra persona** ("Cerrarla yo", en Cajas sin cerrar): para la vendedora que cambió de tienda o se dio de baja sin cerrar. Queda anotado que la cerró él.
- **Traspasos entre tiendas** (**Stock → 🚚 Pasar a otra tienda**, solo el dueño): baja en una y sube en la otra en un paso. No deja mandar más de lo que el sistema dice que hay en la tienda de origen.
- **Mercadería recibida**: lo que anota cada persona en **Recibir** le aparece al dueño en las alertas de **Hoy**.
- **Recibir de otra tienda** (solo el dueño): en **Recibir** hay un menú "¿De dónde viene la mercadería?". Con "De un proveedor" es una entrada común. Eligiendo otra tienda es un traspaso visto desde quien recibe: muestra cuánto hay allá, suma acá y descuenta de allá. Después de registrar, el menú vuelve solo a "proveedor": si quedara en una tienda, la próxima compra a un proveedor se descontaría de esa tienda por error.
- **Cada uno cambia su clave** con el botón 🔑, sabiendo la actual.

---

## 💰 Cierre de caja y reportes (12/10/2026)

- **Cada persona cierra lo suyo.** El cierre es por usuario y por tienda: cuenta lo que cobró ELLA desde su cierre anterior. Con turnos (mañana, tarde, fin de semana) alcanza con que cada persona tenga su propio usuario; varias pueden ser de la misma tienda.
- **No hay "abrir caja".** El período arranca solo en el cierre anterior. Si alguien se olvida de cerrar, lo arrastra al cierre siguiente y al dueño le aparece como caja sin cerrar.
- **A la vendedora no se le muestra cuánto efectivo tendría que haber**, solo cuántas ventas hizo: tiene que contar y escribir lo que hay. Si no coincide, se le pide contar de nuevo; para cerrar igual tiene que escribir una nota, y eso le salta al dueño en **Hoy**.
- **Se cuenta solo la plata de las ventas**, sin el cambio que había al empezar. Lo cobrado por QR se muestra aparte: no está en la caja.
- Un cierre no se edita ni se borra (triggers en la base), igual que las ventas.
- **Reportes** (solo el dueño): hoy, ayer, esta semana, este mes, el mes pasado o las fechas que se elijan; por día, por tienda, por persona y por producto, más cuánto faltó o sobró en las cajas. **Bajar a Excel** saca un archivo .csv con punto y coma y coma decimal, que es como lo abre bien Excel en castellano.
- Lo que tiene que haber en la caja = efectivo cobrado − devoluciones − gastos y retiros anotados.
---

## 🌐 Cómo se sincroniza con la tienda web

Cada dato tiene **un solo dueño** (decidido el 12/10/2026):

| Dato | Dónde se carga | Cómo llega al otro lado |
|---|---|---|
| Qué productos hay, nombre, categoría, precio y oferta | **Panel de la web** | El inventario lee `productos.json` y se pone al día solo cada vez que el archivo cambia. Acá esos datos quedan bloqueados (🌐). |
| Stock | **Inventario** | Con cada venta, anulación, entrada o conteo se reescribe `stock-inventario.json` al lado del catálogo. La tienda lo aplica al servir `productos.json`. |
| Código de barras, costo, aviso de stock mínimo | Inventario | No van a la web. |

- **La web muestra el stock de UNA tienda** (`INV_TIENDA_WEB` en el `.env`, hoy Ivirgarzama): la que despacha los pedidos online. Así no promete mercadería que está en otro pueblo.
- **Lo que todavía no se contó en esa tienda no se toca**: la web sigue con el número escrito en el panel. Recién cuando el producto tiene un movimiento en el inventario, manda el inventario. Si no fuera así, al prender la sincronización toda la tienda pasaría a "agotado".
- **Un producto creado acá** con "+ Nuevo producto" no sale en la web. Para que salga, se lo crea en el panel de la web **con el mismo nombre**: el inventario los vincula en vez de duplicarlo, y conserva código, costo y movimientos.
- **Un producto borrado de la web**: si en alguna tienda queda mercadería (o un negativo sin aclarar), acá sigue vendiéndose, desvinculado y editable. Si no queda nada, se da de baja solo. No se borra: vuelve con "Mostrar los dados de baja" o cargándolo de nuevo en la web.
- **Uno dado de baja que se vuelve a cargar en la web con el mismo nombre** se vincula y vuelve a venderse. Antes quedaba vinculado pero inactivo: salía en la web y en el mostrador no existía.
- **El inventario se entera en el momento** en que el panel guarda (la tienda llama a `alDia()`), no recién cuando alguien abre esta pantalla.
- **Los pedidos de la web no descuentan stock solos**: llegan por WhatsApp. El stock baja cuando se cobran en "Vender".
- El catálogo que se lee es el `productos.json` de esta misma carpeta, el que edita la tienda. Al arrancar, la consola dice de dónde está leyendo (`Web →`). `INV_CATALOGO` solo hace falta en las pruebas, o si algún día el inventario vuelve a vivir en otra carpeta: ahí tiene que apuntar al de la TIENDA, no a una copia.
- ⚠️ **Variantes** (talla, tamaño): la web las tiene con diferencia de precio; el inventario tiene un solo producto con el precio base. En el mostrador una variante más cara se cobra al precio base. Pendiente.
- Para **volver al stock a mano**: borrar `stock-inventario.json` de la carpeta de la tienda (con el inventario apagado, o lo vuelve a escribir).

---

## ⚠️ Cosas que ya fallaron una vez (12/10/2026)

- **Nada de `style="..."` en lo que arma `app.js`.** La política de seguridad (`style-src 'self'`) lo bloquea sin avisar: el HTML queda igual pero el estilo no se aplica. Todo va por clases en `estilos.css` (`.centro`, `.der`, `.col-conteo`).
- **Todo `POST` lleva cuerpo JSON, aunque sea `{}`.** El servidor contesta 415 a un POST sin `Content-Type: application/json`. "Salir" lo mandaba vacío: recargaba la página y la sesión seguía abierta.
- **`undefined` no es `0` en `stock_tiendas`.** `undefined` = esa tienda nunca tuvo el producto (se muestra `–`, no cuenta como problema). `0` = lo tuvo y se acabó. Tratarlos igual daba 11 alertas falsas de "stock bajo" por cada 3 de verdad.
- **Lo que cambie la lista de venta pasa por `carritoCambio()`**, que tira la `clave`. Con la misma clave y otra lista, el servidor devolvería la venta anterior.
- **`mostrarApp()` puede correr más de una vez** sin recargar (cuando vence la sesión se vuelve a entrar ahí mismo, y la venta a medio armar sigue). No enganchar eventos adentro: se duplican.
- **El lector que no encuentra un código** deja el texto seleccionado y suena un pitido. Antes el código siguiente se pegaba atrás del que no existía.
- **En el celular, el error de un formulario va ARRIBA, pegado al título.** Abajo lo tapaba el teclado: al crear un usuario con la clave corta o el nombre con tilde, parecía que "Guardar" no hacía nada (13/10/2026). Y el nombre de usuario se limpia solo mientras se escribe ("María Choque" → "maria.choque"), porque el teclado del teléfono mete mayúsculas, tildes y espacios.
- **Los archivos de `publico/` se sirven del disco en cada pedido**: un cambio ahí sale en vivo al recargar la página. Lo de `operaciones.js`, `db.js` y `servidor.js` recién corre al reiniciar el inventario.

---

## 📁 Archivos del módulo

- [`inventario/db.js`](db.js): Conexión SQLite nativa (`node:sqlite`), modo WAL, índices y triggers de inmutabilidad.
- [`inventario/operaciones.js`](operaciones.js): Lógica de negocio (ventas, entradas, ajustes, catálogo, login, sesiones, reportes).
- [`inventario/servidor.js`](servidor.js): Servidor HTTP en puerto `3003`, cabeceras CSP, limitador de intentos y sesiones protegidas.
- [`inventario/prueba.js`](prueba.js): Suite de pruebas automatizadas con base y "tienda web" temporales (55 comprobaciones de punta a punta). Correr `node inventario/prueba.js` después de cualquier cambio.
- [`inventario/publico/index.html`](publico/index.html): Interfaz adaptable para computadora, tablet o celular.
- [`inventario/publico/estilos.css`](publico/estilos.css): Estilos oscuros acordes al diseño de Los Caseritos.
- [`inventario/publico/app.js`](publico/app.js): Lógica de la interfaz (búsqueda instantánea, lector de código de barras, cobro, cambio, etc.).
