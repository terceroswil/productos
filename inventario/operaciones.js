/* ══════════════════════════════════════════════════════════════════════
   Inventario — operaciones

   Todo lo que se puede hacer con el inventario, sin nada de HTTP. Así se
   puede probar directo y el servidor queda como una capa fina encima.

   Quién puede qué lo decide ESTE archivo, no la pantalla: la pantalla
   esconde botones por comodidad, pero un vendedor que arme el pedido a
   mano igual tiene que chocar contra estas reglas.
   ══════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const seg = require('../src/seguridad');
const { enTransaccion } = require('./db');

/* Bolivia es UTC-4 todo el año (no cambia la hora). Se fija acá y no se
   toma del sistema porque en un servidor alquilado la hora suele ser UTC, y
   "las ventas de hoy" empezarían a las 8 de la noche. */
const ZONA_MINUTOS = Number(process.env.INV_ZONA_MINUTOS ?? -240);
const DIA = 24 * 60 * 60 * 1000;

/* Un vendedor puede anular su propia venta solo un rato después de hacerla
   (para corregir un error al cobrar). Pasado ese tiempo, solo el dueño. */
const MINUTOS_PARA_ANULAR = 30;

class ErrorUso extends Error {
  constructor(mensaje, codigo = 400){ super(mensaje); this.codigo = codigo; }
}
function falla(mensaje, codigo){ throw new ErrorUso(mensaje, codigo); }

/* Los errores de SQLite salen en inglés técnico; los que puede provocar un
   usuario se traducen a algo que se entienda. */
function traducirError(e){
  const m = String(e && e.message || '');
  if (m.includes('UNIQUE constraint failed: usuarios.usuario')) return new ErrorUso('Ese nombre de usuario ya existe', 409);
  if (m.includes('UNIQUE constraint failed: productos.codigo')) return new ErrorUso('Ese código de barras ya lo tiene otro producto', 409);
  if (m.includes('UNIQUE constraint failed: productos.catalogo_id')) return new ErrorUso('Ese producto de la tienda online ya está vinculado a otro', 409);
  return e;
}

/* ─────────────────────────── validación ─────────────────────────── */

function texto(v, max, nombre, obligatorio = false){
  const s = String(v ?? '').trim();
  if (obligatorio && !s) falla('Falta ' + nombre);
  if (s.length > max) falla('En ' + nombre + ' entran como máximo ' + max + ' caracteres');
  return s;
}

function entero(v, min, max, nombre){
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max){
    falla(nombre + ' tiene que ser un número entero entre ' + min + ' y ' + max);
  }
  return n;
}

/* Recibe bolivianos como los escribe la gente ("10", "10.50", "10,50") y
   devuelve centavos enteros. */
function dinero(v, nombre, opcional = false){
  if (v === null || v === undefined || String(v).trim() === ''){
    if (opcional) return null;
    falla('Falta ' + nombre);
  }
  const n = Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 10000000) falla(nombre + ': el monto no es válido');
  return Math.round(n * 100);
}

function validarClave(clave){
  const c = String(clave ?? '');
  if (c.length < 8) falla('La clave tiene que tener al menos 8 caracteres');
  if (c.length > 200) falla('La clave es demasiado larga');
  return c;
}

function validarNombreUsuario(u){
  const s = texto(u, 30, 'el usuario', true).toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(s)){
    falla('El usuario va de 3 a 30 caracteres: letras sin tilde, números, punto o guion');
  }
  return s;
}

function inicioDelDia(ms = Date.now()){
  const desfase = ZONA_MINUTOS * 60000;
  const local = ms + desfase;
  return local - (((local % DIA) + DIA) % DIA) - desfase;
}

/* ─────────────────────────── tiendas ─────────────────────────── */

function listarTiendas(db){
  return db.prepare('SELECT id, nombre FROM tiendas WHERE activa = 1 ORDER BY id').all();
}

function tiendaValida(db, id){
  const n = entero(id, 1, 1e9, 'La tienda');
  const t = db.prepare('SELECT id FROM tiendas WHERE id = ? AND activa = 1').get(n);
  if (!t) falla('Esa tienda no existe', 404);
  return n;
}

/* El vendedor opera SIEMPRE en su tienda, diga lo que diga el pedido.
   El dueño elige en cuál. */
function tiendaDe(db, actor, pedida){
  if (actor.rol === 'vendedor'){
    if (pedida != null && pedida !== '' && Number(pedida) !== actor.tienda_id){
      falla('Solo se puede operar en la tienda asignada', 403);
    }
    return actor.tienda_id;
  }
  return tiendaValida(db, pedida);
}

function soloDueno(actor){
  if (!actor || actor.rol !== 'dueno') falla('Esto lo puede hacer solo el dueño', 403);
}

/* ─────────────────────────── usuarios y sesiones ─────────────────────────── */

/* Si el usuario no existe igual se calcula un scrypt contra este hash de
   mentira: así la respuesta tarda lo mismo y no delata qué usuarios existen. */
const HASH_DE_RELLENO = seg.hashClave('relleno-' + Date.now());

function contarUsuarios(db){
  return db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
}

/* Primera vez: se crea la cuenta del dueño. Después de eso, nunca más. */
function configurarDueno(db, d){
  try {
    return enTransaccion(db, () => {
      if (contarUsuarios(db) > 0) falla('El sistema ya está configurado', 409);
      const r = db.prepare(`INSERT INTO usuarios(usuario, nombre, clave_hash, rol, creado)
                            VALUES (?, ?, ?, 'dueno', ?)`)
        .run(validarNombreUsuario(d.usuario), texto(d.nombre, 60, 'el nombre', true),
             seg.hashClave(validarClave(d.clave)), Date.now());
      return Number(r.lastInsertRowid);
    });
  } catch (e) { throw traducirError(e); }
}

function verificarLogin(db, usuario, clave){
  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1')
              .get(String(usuario ?? '').trim());
  if (!u){ seg.verificarClave(String(clave ?? ''), HASH_DE_RELLENO); return null; }
  return seg.verificarClave(String(clave ?? ''), u.clave_hash) ? u : null;
}

/* La cookie lleva "id.version". Si la versión ya no coincide (salió, le
   cambiaron la clave, lo dieron de baja), la sesión está muerta. */
function idDeSesion(u){ return u.id + '.' + u.version_sesion; }

function usuarioDeSesion(db, sesion){
  if (!sesion || typeof sesion.u !== 'string') return null;
  const [id, version] = sesion.u.split('.').map(Number);
  if (!Number.isInteger(id) || !Number.isInteger(version)) return null;
  const u = db.prepare(`SELECT u.*, t.nombre AS tienda FROM usuarios u
                        LEFT JOIN tiendas t ON t.id = u.tienda_id
                        WHERE u.id = ? AND u.activo = 1`).get(id);
  if (!u || u.version_sesion !== version) return null;
  return u;
}

function cerrarSesiones(db, usuarioId){
  db.prepare('UPDATE usuarios SET version_sesion = version_sesion + 1 WHERE id = ?').run(usuarioId);
}

function datosPublicos(u){
  return { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol,
           tienda_id: u.tienda_id, tienda: u.tienda || null };
}

function listarUsuarios(db){
  return db.prepare(`SELECT u.id, u.usuario, u.nombre, u.rol, u.tienda_id, t.nombre AS tienda,
                            u.activo, u.creado
                     FROM usuarios u LEFT JOIN tiendas t ON t.id = u.tienda_id
                     ORDER BY u.activo DESC, u.rol, u.nombre COLLATE NOCASE`).all();
}

function guardarUsuario(db, actor, d){
  soloDueno(actor);
  try {
    return enTransaccion(db, () => {
      const rol = d.rol === 'dueno' || d.rol === 'vendedor' ? d.rol : falla('El rol no es válido');
      const tiendaId = rol === 'vendedor' ? tiendaValida(db, d.tienda_id) : null;
      const nombre = texto(d.nombre, 60, 'el nombre', true);

      if (!d.id){
        const r = db.prepare(`INSERT INTO usuarios(usuario, nombre, clave_hash, rol, tienda_id, creado)
                              VALUES (?, ?, ?, ?, ?, ?)`)
          .run(validarNombreUsuario(d.usuario), nombre, seg.hashClave(validarClave(d.clave)),
               rol, tiendaId, Date.now());
        return Number(r.lastInsertRowid);
      }

      const previo = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(entero(d.id, 1, 1e9, 'El usuario'));
      if (!previo) falla('Ese usuario no existe', 404);
      const activo = d.activo === undefined ? previo.activo : (d.activo ? 1 : 0);

      /* Sin un dueño activo nadie podría volver a entrar a administrar. */
      if (previo.rol === 'dueno' && previo.activo === 1 && (rol !== 'dueno' || !activo)){
        const otros = db.prepare(`SELECT COUNT(*) AS n FROM usuarios
                                  WHERE rol = 'dueno' AND activo = 1 AND id <> ?`).get(previo.id).n;
        if (!otros) falla('Tiene que quedar al menos un dueño activo');
      }

      const claveNueva = d.clave ? validarClave(d.clave) : null;
      /* Si cambia algo del acceso, se cortan sus sesiones abiertas: dar de
         baja a un empleado tiene que sacarlo YA, no cuando venza la cookie. */
      const cambiaAcceso = activo !== previo.activo || rol !== previo.rol ||
                           tiendaId !== previo.tienda_id || !!claveNueva;
      db.prepare(`UPDATE usuarios SET nombre = ?, rol = ?, tienda_id = ?, activo = ?, clave_hash = ?,
                         version_sesion = version_sesion + ?
                  WHERE id = ?`)
        .run(nombre, rol, tiendaId, activo, claveNueva ? seg.hashClave(claveNueva) : previo.clave_hash,
             cambiaAcceso ? 1 : 0, previo.id);
      return previo.id;
    });
  } catch (e) { throw traducirError(e); }
}

/* ─────────────────────────── productos ─────────────────────────── */

/* Stock de todos los productos en todas las tiendas, en una sola consulta.
   Devuelve Map(producto_id → { tienda_id: stock }). */
function mapaDeStock(db){
  const mapa = new Map();
  const filas = db.prepare(`SELECT producto_id, tienda_id, SUM(cantidad) AS s
                            FROM movimientos GROUP BY producto_id, tienda_id`).all();
  for (const f of filas){
    if (!mapa.has(f.producto_id)) mapa.set(f.producto_id, {});
    mapa.get(f.producto_id)[f.tienda_id] = f.s;
  }
  return mapa;
}

function stockDe(db, tiendaId, productoId){
  return db.prepare(`SELECT COALESCE(SUM(cantidad), 0) AS s FROM movimientos
                     WHERE tienda_id = ? AND producto_id = ?`).get(tiendaId, productoId).s;
}

/* El vendedor ve el stock de SU tienda y nunca el costo (la ganancia es
   cosa del dueño). El dueño ve todo. */
function listarProductos(db, actor, { inactivos = false } = {}){
  const esDueno = actor.rol === 'dueno';
  const prods = db.prepare(`SELECT * FROM productos ${inactivos && esDueno ? '' : 'WHERE activo = 1'}
                            ORDER BY nombre COLLATE NOCASE`).all();
  const mapa = mapaDeStock(db);
  return prods.map(p => {
    const porTienda = mapa.get(p.id) || {};
    const fila = {
      id: p.id, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria,
      precio: p.precio, precio_antes: p.precio_antes, stock_minimo: p.stock_minimo,
      activo: p.activo
    };
    if (esDueno){
      fila.costo = p.costo;
      fila.catalogo_id = p.catalogo_id;
      fila.stock_tiendas = porTienda;
      fila.stock_total = Object.values(porTienda).reduce((a, b) => a + b, 0);
    } else {
      fila.stock = porTienda[actor.tienda_id] || 0;
    }
    return fila;
  });
}

function guardarProducto(db, actor, d){
  soloDueno(actor);
  const nombre = texto(d.nombre, 120, 'el nombre', true);
  const categoria = texto(d.categoria, 60, 'la categoría');
  const codigo = texto(d.codigo, 40, 'el código') || null;
  if (codigo && !/^[A-Za-z0-9._-]+$/.test(codigo)) falla('El código solo puede tener letras, números, punto o guion');
  const precio = dinero(d.precio, 'el precio');
  let precioAntes = dinero(d.precio_antes, 'el precio antes', true);
  if (precioAntes === 0) precioAntes = null;   // en el catálogo, 0 quiere decir "sin oferta"
  if (precioAntes !== null && precioAntes <= precio){
    falla('El "precio antes" tiene que ser mayor que el precio: es el precio tachado de la oferta');
  }
  const costo = dinero(d.costo, 'el costo', true);
  const minimo = d.stock_minimo === '' || d.stock_minimo == null ? 0 : entero(d.stock_minimo, 0, 100000, 'El stock mínimo');
  const activo = d.activo === undefined ? 1 : (d.activo ? 1 : 0);

  try {
    if (!d.id){
      const r = db.prepare(`INSERT INTO productos(codigo, nombre, categoria, precio, precio_antes, costo,
                                                  stock_minimo, activo, creado)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(codigo, nombre, categoria, precio, precioAntes, costo, minimo, activo, Date.now());
      return Number(r.lastInsertRowid);
    }
    const id = entero(d.id, 1, 1e9, 'El producto');
    const r = db.prepare(`UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, precio = ?,
                                 precio_antes = ?, costo = ?, stock_minimo = ?, activo = ?
                          WHERE id = ?`)
      .run(codigo, nombre, categoria, precio, precioAntes, costo, minimo, activo, id);
    if (!r.changes) falla('Ese producto no existe', 404);
    return id;
  } catch (e) { throw traducirError(e); }
}

/* Trae los productos de la tienda online (productos.json) que todavía no
   están en el inventario. No pisa nada de lo que ya está: si el dueño ya
   les cargó código de barras o costo, eso se respeta.
   El "stock" del catálogo online NO se importa: es un número suelto que no
   dice en qué tienda está. El stock real sale del conteo inicial. */
function importarCatalogo(db, actor, rutaCatalogo){
  soloDueno(actor);
  let datos;
  try { datos = JSON.parse(fs.readFileSync(rutaCatalogo, 'utf8')); }
  catch (e) { falla('No se pudo leer el catálogo de la tienda online'); }
  const lista = Array.isArray(datos.productos) ? datos.productos : [];

  return enTransaccion(db, () => {
    const existe = db.prepare('SELECT id FROM productos WHERE catalogo_id = ?');
    const alta = db.prepare(`INSERT INTO productos(nombre, categoria, precio, precio_antes, catalogo_id, creado)
                             VALUES (?, ?, ?, ?, ?, ?)`);
    let nuevos = 0, yaEstaban = 0, salteados = 0;
    for (const p of lista){
      if (!Number.isInteger(p.id) || !p.name || !(Number(p.price) >= 0)){ salteados++; continue; }
      if (existe.get(p.id)){ yaEstaban++; continue; }
      const precio = Math.round(Number(p.price) * 100);
      const antes = Number(p.precioAntes) > Number(p.price) ? Math.round(Number(p.precioAntes) * 100) : null;
      alta.run(String(p.name).slice(0, 120), String(p.cat || '').slice(0, 60), precio, antes, p.id, Date.now());
      nuevos++;
    }
    return { nuevos, yaEstaban, salteados };
  });
}

/* ─────────────────────────── movimientos ─────────────────────────── */

/* Junta la lista que manda la pantalla: si el mismo producto viene dos
   veces, se suman. Devuelve [{ p, cantidad }] con el producto de la base. */
function normalizarItems(db, items){
  if (!Array.isArray(items) || !items.length) falla('No hay productos en la lista');
  if (items.length > 300) falla('Son demasiados productos de una sola vez');
  const juntos = new Map();
  for (const it of items){
    const id = entero(it && it.producto_id, 1, 1e9, 'El producto');
    const c = entero(it && it.cantidad, 1, 100000, 'La cantidad');
    juntos.set(id, (juntos.get(id) || 0) + c);
  }
  const buscar = db.prepare('SELECT * FROM productos WHERE id = ?');
  return [...juntos].map(([id, cantidad]) => {
    const p = buscar.get(id);
    if (!p) falla('Hay un producto que no existe (id ' + id + ')', 404);
    return { p, cantidad };
  });
}

/* ⚠️ El precio sale de la BASE, nunca del pedido. La pantalla manda solo
   qué producto y cuántos. Si mandara el precio, cualquiera podría cobrar
   lo que quisiera con armar el pedido a mano. */
function registrarVenta(db, actor, d){
  const pago = d.pago === 'efectivo' || d.pago === 'qr' ? d.pago : falla('Falta elegir cómo pagó: efectivo o QR');
  return enTransaccion(db, () => {
    const tiendaId = tiendaDe(db, actor, d.tienda_id);
    const items = normalizarItems(db, d.items);
    for (const { p } of items){
      if (!p.activo) falla('"' + p.nombre + '" está dado de baja y no se puede vender');
    }
    const ahora = Date.now();
    const total = items.reduce((s, { p, cantidad }) => s + p.precio * cantidad, 0);
    const v = db.prepare('INSERT INTO ventas(tienda_id, usuario_id, fecha, total, pago) VALUES (?, ?, ?, ?, ?)')
                .run(tiendaId, actor.id, ahora, total, pago);
    const ventaId = Number(v.lastInsertRowid);

    const altaItem = db.prepare(`INSERT INTO venta_items(venta_id, producto_id, cantidad, precio_unit, costo_unit)
                                 VALUES (?, ?, ?, ?, ?)`);
    const altaMov = db.prepare(`INSERT INTO movimientos(fecha, tienda_id, producto_id, cantidad, tipo, usuario_id, venta_id)
                                VALUES (?, ?, ?, ?, 'venta', ?, ?)`);
    /* Se vende aunque el sistema diga que no hay. Si lo tienen en la mano,
       el error está en el sistema (un conteo mal hecho, una entrada que no
       se anotó), y bloquear la venta solo enseña a no usarlo. Queda el
       aviso y el dueño lo ve en sus alertas. */
    const avisos = [];
    for (const { p, cantidad } of items){
      altaItem.run(ventaId, p.id, cantidad, p.precio, p.costo);
      altaMov.run(ahora, tiendaId, p.id, -cantidad, actor.id, ventaId);
      const queda = stockDe(db, tiendaId, p.id);
      if (queda < 0) avisos.push('"' + p.nombre + '": el sistema queda en ' + queda + '. Avise al dueño para revisar ese producto.');
    }
    return { id: ventaId, total, pago, tienda_id: tiendaId, fecha: ahora, avisos };
  });
}

function anularVenta(db, actor, ventaId, motivo){
  const m = texto(motivo, 200, 'el motivo', true);
  if (m.length < 3) falla('Escriba el motivo de la anulación');
  return enTransaccion(db, () => {
    const v = db.prepare('SELECT * FROM ventas WHERE id = ?').get(entero(ventaId, 1, 1e12, 'La venta'));
    if (!v) falla('Esa venta no existe', 404);
    if (v.anulada) falla('Esa venta ya estaba anulada', 409);
    if (actor.rol === 'vendedor'){
      if (v.usuario_id !== actor.id) falla('Solo se pueden anular las ventas propias', 403);
      if (Date.now() - v.fecha > MINUTOS_PARA_ANULAR * 60000){
        falla('Pasaron más de ' + MINUTOS_PARA_ANULAR + ' minutos: esta venta solo la puede anular el dueño', 403);
      }
    }
    const ahora = Date.now();
    db.prepare('UPDATE ventas SET anulada = 1, anulada_por = ?, anulada_fecha = ?, motivo_anulacion = ? WHERE id = ?')
      .run(actor.id, ahora, m, v.id);
    /* La mercadería vuelve al stock con un movimiento nuevo. La venta y sus
       movimientos originales quedan como estaban: se ve que hubo una venta
       y que después se anuló, quién y por qué. */
    const items = db.prepare('SELECT producto_id, cantidad FROM venta_items WHERE venta_id = ?').all(v.id);
    const altaMov = db.prepare(`INSERT INTO movimientos(fecha, tienda_id, producto_id, cantidad, tipo, usuario_id, venta_id, nota)
                                VALUES (?, ?, ?, ?, 'anulacion', ?, ?, ?)`);
    items.forEach(i => altaMov.run(ahora, v.tienda_id, i.producto_id, i.cantidad, actor.id, v.id, m));
    return { id: v.id };
  });
}

function listarVentas(db, actor, f = {}){
  const cond = [], args = [];
  if (actor.rol === 'vendedor'){
    /* El vendedor ve las ventas de hoy de su tienda, nada más. */
    cond.push('v.tienda_id = ?'); args.push(actor.tienda_id);
    cond.push('v.fecha >= ?'); args.push(inicioDelDia());
  } else {
    if (f.tienda) { cond.push('v.tienda_id = ?'); args.push(entero(f.tienda, 1, 1e9, 'La tienda')); }
    if (f.desde)  { cond.push('v.fecha >= ?');    args.push(entero(f.desde, 0, 1e14, 'Desde')); }
    if (f.hasta)  { cond.push('v.fecha < ?');     args.push(entero(f.hasta, 0, 1e14, 'Hasta')); }
  }
  const limite = f.limite ? entero(f.limite, 1, 1000, 'El límite') : 200;
  const ventas = db.prepare(`
    SELECT v.id, v.tienda_id, t.nombre AS tienda, v.usuario_id, u.nombre AS vendedor, v.fecha, v.total,
           v.pago, v.anulada, v.anulada_fecha, v.motivo_anulacion, a.nombre AS anulada_por
    FROM ventas v
    JOIN tiendas t  ON t.id = v.tienda_id
    JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN usuarios a ON a.id = v.anulada_por
    ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
    ORDER BY v.fecha DESC LIMIT ?`).all(...args, limite);

  if (ventas.length){
    const ids = ventas.map(v => v.id);
    const items = db.prepare(`
      SELECT vi.venta_id, vi.producto_id, p.nombre, vi.cantidad, vi.precio_unit
      FROM venta_items vi JOIN productos p ON p.id = vi.producto_id
      WHERE vi.venta_id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    const porVenta = new Map(ids.map(id => [id, []]));
    items.forEach(i => porVenta.get(i.venta_id).push(i));
    ventas.forEach(v => { v.items = porVenta.get(v.id); });
  }
  return ventas;
}

/* Llegó mercadería. La puede anotar el vendedor: no tiene ningún interés
   en inflarla, porque una entrada de más hace que después le "falten"
   cosas a él en el conteo. */
function registrarEntrada(db, actor, d){
  const nota = texto(d.nota, 200, 'la nota');
  return enTransaccion(db, () => {
    const tiendaId = tiendaDe(db, actor, d.tienda_id);
    const items = normalizarItems(db, d.items);
    const ahora = Date.now();
    const altaMov = db.prepare(`INSERT INTO movimientos(fecha, tienda_id, producto_id, cantidad, tipo, usuario_id, nota)
                                VALUES (?, ?, ?, ?, 'entrada', ?, ?)`);
    items.forEach(({ p, cantidad }) => altaMov.run(ahora, tiendaId, p.id, cantidad, actor.id, nota || null));
    return { productos: items.length, unidades: items.reduce((s, i) => s + i.cantidad, 0) };
  });
}

/* El dueño cuenta y dice "acá hay tantos". Se anota la DIFERENCIA como un
   movimiento, nunca se pisa el número:
   - si el producto nunca tuvo movimientos en esa tienda → 'inicial'
     (es el conteo del día cero, no hace falta motivo)
   - si ya tenía → 'ajuste', con motivo obligatorio, y queda en las alertas */
function establecerStock(db, actor, d){
  soloDueno(actor);
  const nota = texto(d.nota, 200, 'el motivo');
  if (!Array.isArray(d.items) || !d.items.length) falla('No hay productos en la lista');
  if (d.items.length > 2000) falla('Son demasiados productos de una sola vez');

  return enTransaccion(db, () => {
    const tiendaId = tiendaValida(db, d.tienda_id);
    /* acá NO se suman los repetidos: es un conteo, vale el último número */
    const conteo = new Map();
    for (const it of d.items){
      conteo.set(entero(it && it.producto_id, 1, 1e9, 'El producto'),
                 entero(it && it.cantidad, 0, 100000, 'La cantidad'));
    }
    const buscar = db.prepare('SELECT id, nombre FROM productos WHERE id = ?');
    const tuvoMovimientos = db.prepare('SELECT 1 AS si FROM movimientos WHERE tienda_id = ? AND producto_id = ? LIMIT 1');
    const altaMov = db.prepare(`INSERT INTO movimientos(fecha, tienda_id, producto_id, cantidad, tipo, usuario_id, nota)
                                VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const ahora = Date.now();
    const cambios = [];
    for (const [id, cantidad] of conteo){
      const p = buscar.get(id);
      if (!p) falla('Hay un producto que no existe (id ' + id + ')', 404);
      const antes = stockDe(db, tiendaId, id);
      const diferencia = cantidad - antes;
      if (diferencia === 0) continue;
      const tipo = tuvoMovimientos.get(tiendaId, id) ? 'ajuste' : 'inicial';
      if (tipo === 'ajuste' && !nota){
        falla('"' + p.nombre + '" ya tenía movimientos: para corregirlo hay que escribir el motivo');
      }
      altaMov.run(ahora, tiendaId, id, diferencia, tipo, actor.id, nota || null);
      cambios.push({ producto: p.nombre, tipo, antes, ahora: cantidad, diferencia });
    }
    return {
      iniciales: cambios.filter(c => c.tipo === 'inicial').length,
      ajustes: cambios.filter(c => c.tipo === 'ajuste').length,
      cambios
    };
  });
}

function listarMovimientos(db, actor, f = {}){
  soloDueno(actor);
  const cond = [], args = [];
  if (f.tienda)   { cond.push('m.tienda_id = ?');   args.push(entero(f.tienda, 1, 1e9, 'La tienda')); }
  if (f.producto) { cond.push('m.producto_id = ?'); args.push(entero(f.producto, 1, 1e9, 'El producto')); }
  if (f.tipo)     { cond.push('m.tipo = ?');        args.push(texto(f.tipo, 20, 'el tipo')); }
  const limite = f.limite ? entero(f.limite, 1, 2000, 'El límite') : 300;
  return db.prepare(`
    SELECT m.id, m.fecha, m.tienda_id, t.nombre AS tienda, m.producto_id, p.nombre AS producto,
           m.cantidad, m.tipo, u.nombre AS usuario, m.venta_id, m.nota
    FROM movimientos m
    JOIN tiendas t   ON t.id = m.tienda_id
    JOIN productos p ON p.id = m.producto_id
    JOIN usuarios u  ON u.id = m.usuario_id
    ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
    ORDER BY m.id DESC LIMIT ?`).all(...args, limite);
}

/* ─────────────────────────── resumen del dueño ─────────────────────────── */

function resumenHoy(db, actor){
  soloDueno(actor);
  const desde = inicioDelDia();
  const tiendas = listarTiendas(db);

  const filas = db.prepare(`
    SELECT tienda_id,
           SUM(CASE WHEN anulada = 0 THEN 1 ELSE 0 END)                       AS ventas,
           SUM(CASE WHEN anulada = 0 THEN total ELSE 0 END)                   AS total,
           SUM(CASE WHEN anulada = 0 AND pago = 'efectivo' THEN total ELSE 0 END) AS efectivo,
           SUM(CASE WHEN anulada = 0 AND pago = 'qr' THEN total ELSE 0 END)   AS qr,
           SUM(anulada)                                                       AS anuladas
    FROM ventas WHERE fecha >= ? GROUP BY tienda_id`).all(desde);

  /* Ganancia: solo se puede calcular con los productos que tienen costo
     cargado. Se avisa cuántas unidades quedaron afuera para no mostrar una
     ganancia inflada sin decirlo. */
  const ganancia = db.prepare(`
    SELECT v.tienda_id,
           SUM(CASE WHEN vi.costo_unit IS NOT NULL THEN (vi.precio_unit - vi.costo_unit) * vi.cantidad ELSE 0 END) AS ganancia,
           SUM(CASE WHEN vi.costo_unit IS NULL THEN vi.cantidad ELSE 0 END) AS sin_costo
    FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id
    WHERE v.fecha >= ? AND v.anulada = 0 GROUP BY v.tienda_id`).all(desde);

  const porTienda = tiendas.map(t => {
    const f = filas.find(x => x.tienda_id === t.id) || {};
    const g = ganancia.find(x => x.tienda_id === t.id) || {};
    return { tienda_id: t.id, tienda: t.nombre, ventas: f.ventas || 0, total: f.total || 0,
             efectivo: f.efectivo || 0, qr: f.qr || 0, anuladas: f.anuladas || 0,
             ganancia: g.ganancia || 0, sin_costo: g.sin_costo || 0 };
  });

  const masVendidos = db.prepare(`
    SELECT p.nombre, SUM(vi.cantidad) AS unidades, SUM(vi.cantidad * vi.precio_unit) AS monto
    FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id JOIN productos p ON p.id = vi.producto_id
    WHERE v.fecha >= ? AND v.anulada = 0
    GROUP BY vi.producto_id ORDER BY unidades DESC LIMIT 10`).all(desde);

  /* ── alertas: lo que el dueño tiene que mirar aunque no pregunte ── */
  const anulaciones = db.prepare(`
    SELECT v.id, t.nombre AS tienda, u.nombre AS vendedor, a.nombre AS anulada_por,
           v.total, v.fecha, v.anulada_fecha, v.motivo_anulacion
    FROM ventas v JOIN tiendas t ON t.id = v.tienda_id JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN usuarios a ON a.id = v.anulada_por
    WHERE v.anulada = 1 AND v.anulada_fecha >= ? ORDER BY v.anulada_fecha DESC`).all(desde);

  const ajustes = db.prepare(`
    SELECT m.fecha, t.nombre AS tienda, p.nombre AS producto, m.cantidad, u.nombre AS usuario, m.nota
    FROM movimientos m JOIN tiendas t ON t.id = m.tienda_id JOIN productos p ON p.id = m.producto_id
    JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.tipo = 'ajuste' AND m.fecha >= ? ORDER BY m.id DESC`).all(desde);

  const negativos = [], bajos = [];
  const mapa = mapaDeStock(db);
  const productos = db.prepare('SELECT id, nombre, stock_minimo FROM productos WHERE activo = 1').all();
  for (const p of productos){
    const porTienda = mapa.get(p.id) || {};
    for (const t of tiendas){
      const s = porTienda[t.id] || 0;
      if (s < 0) negativos.push({ producto: p.nombre, tienda: t.nombre, stock: s });
      else if (p.stock_minimo > 0 && s <= p.stock_minimo){
        bajos.push({ producto: p.nombre, tienda: t.nombre, stock: s, minimo: p.stock_minimo });
      }
    }
  }

  return { desde, porTienda, masVendidos, alertas: { anulaciones, ajustes, negativos, bajos } };
}

module.exports = {
  ErrorUso, inicioDelDia, MINUTOS_PARA_ANULAR,
  listarTiendas,
  contarUsuarios, configurarDueno, verificarLogin, idDeSesion, usuarioDeSesion,
  cerrarSesiones, datosPublicos, listarUsuarios, guardarUsuario,
  listarProductos, guardarProducto, importarCatalogo,
  registrarVenta, anularVenta, listarVentas, registrarEntrada, establecerStock,
  listarMovimientos, resumenHoy
};
