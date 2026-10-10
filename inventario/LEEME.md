# 📦 Sistema de Inventario y Ventas — Los Caseritos

Sistema multi-tienda (**Ivirgarzama**, **Chimoré**, **Entre Ríos**) desarrollado en JavaScript nativo sobre **Node.js 24 + SQLite (`node:sqlite`)**. Diseñado específicamente para evitar pérdidas de mercadería, desacoples de caja y descontrol de precios cuando el dueño no está presente.

---

## 🚀 Cómo arrancar

1. **Doble clic en `INICIAR-INVENTARIO.bat`** (o ejecuta en consola):
   ```bash
   node inventario/servidor.js
   ```
2. Abre en el navegador: [http://localhost:3003/](http://localhost:3003/)
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

---

## 📁 Archivos del módulo

- [`inventario/db.js`](file:///d:/CLAUDE-IA/proyectos/productos-inventario/inventario/db.js): Conexión SQLite nativa (`node:sqlite`), modo WAL, índices y triggers de inmutabilidad.
- [`inventario/operaciones.js`](file:///d:/CLAUDE-IA/proyectos/productos-inventario/inventario/operaciones.js): Lógica de negocio (ventas, entradas, ajustes, catálogo, login, sesiones, reportes).
- [`inventario/servidor.js`](file:///d:/CLAUDE-IA/proyectos/productos-inventario/inventario/servidor.js): Servidor HTTP en puerto `3003`, cabeceras CSP, limitador de intentos y sesiones protegidas.
- [`inventario/prueba.js`](file:///d:/CLAUDE-IA/proyectos/productos-inventario/inventario/prueba.js): Suite de pruebas automatizadas con base temporal (34 comprobaciones de punta a punta).
- [`inventario/publico/index.html`](file:///d:/CLAUDE-IA/proyectos/productos-inventario/inventario/publico/index.html): Interfaz adaptable para computadora, tablet o celular.
- [`inventario/publico/estilos.css`](file:///d:/CLAUDE-IA/proyectos/productos-inventario/inventario/publico/estilos.css): Estilos oscuros acordes al diseño de Los Caseritos.
- [`inventario/publico/app.js`](file:///d:/CLAUDE-IA/proyectos/productos-inventario/inventario/publico/app.js): Lógica de la interfaz (búsqueda instantánea, lector de código de barras, cobro, cambio, etc.).
