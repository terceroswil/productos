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
  /* extra: datos sueltos que viajan con el error hasta la pantalla (para que
     pueda armar una pregunta en vez de mostrar solo un cartel) */
  constructor(mensaje, codigo = 400, extra = null){ super(mensaje); this.codigo = codigo; this.extra = extra; }
}
function falla(mensaje, codigo, extra){ throw new ErrorUso(mensaje, codigo, extra); }

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

/* La fecha de Bolivia como "2026-10-12" (para nombrar el respaldo del día). */
function fechaLocal(ms = Date.now()){
  return new Date(ms + ZONA_MINUTOS * 60000).toISOString().slice(0, 10);
}

function enBs(centavos){
  return 'Bs ' + (centavos / 100).toFixed(2).replace('.', ',');
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

/* Cualquiera puede cambiarse SU clave, sabiendo la actual. Antes solo el
   dueño podía cambiarlas: una vendedora que sospechaba que le habían visto
   la clave tenía que pedírselo a él. Corta sus otras sesiones abiertas. */
function cambiarMiClave(db, actor, d){
  if (!seg.verificarClave(String(d.actual ?? ''), actor.clave_hash)) falla('La clave actual no es esa', 403);
  const nueva = validarClave(d.nueva);
  if (nueva === String(d.actual)) falla('La clave nueva tiene que ser distinta de la actual');
  db.prepare('UPDATE usuarios SET clave_hash = ?, version_sesion = version_sesion + 1 WHERE id = ?')
    .run(seg.hashClave(nueva), actor.id);
  return actor.id;
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
      activo: p.activo, variantes: variantesDe(p)
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

/* Las opciones de un producto (tamaño, color) o null si no tiene. */
function variantesDe(p){
  if (!p.variantes) return null;
  try {
    const v = JSON.parse(p.variantes);
    return v && Array.isArray(v.opciones) && v.opciones.length ? v : null;
  } catch (e) { return null; }
}

function guardarProducto(db, actor, d){
  soloDueno(actor);
  const previo = d.id ? db.prepare('SELECT * FROM productos WHERE id = ?').get(entero(d.id, 1, 1e9, 'El producto')) : null;
  if (d.id && !previo) falla('Ese producto no existe', 404);

  /* ⚠️ Un producto que está en la tienda web tiene UN solo lugar donde se le
     cambia el nombre y el precio: el panel de la web (ver sincronizarCatalogo).
     Acá se ignora lo que mande el pedido para esos cuatro datos. Si se
     pudieran tocar en los dos lados, al rato habría dos precios distintos
     para lo mismo y no se sabría cuál vale. */
  let nombre, categoria, precio, precioAntes;
  if (previo && previo.catalogo_id != null){
    ({ nombre, categoria, precio } = previo);
    precioAntes = previo.precio_antes;
  } else {
    nombre = texto(d.nombre, 120, 'el nombre', true);
    categoria = texto(d.categoria, 60, 'la categoría');
    precio = dinero(d.precio, 'el precio');
    precioAntes = dinero(d.precio_antes, 'el precio antes', true);
    if (precioAntes === 0) precioAntes = null;   // en el catálogo, 0 quiere decir "sin oferta"
    if (precioAntes !== null && precioAntes <= precio){
      falla('El "precio antes" tiene que ser mayor que el precio: es el precio tachado de la oferta');
    }
  }
  const codigo = texto(d.codigo, 40, 'el código') || null;
  if (codigo && !/^[A-Za-z0-9._-]+$/.test(codigo)) falla('El código solo puede tener letras, números, punto o guion');
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
    const r = db.prepare(`UPDATE productos SET codigo = ?, nombre = ?, categoria = ?, precio = ?,
                                 precio_antes = ?, costo = ?, stock_minimo = ?, activo = ?
                          WHERE id = ?`)
      .run(codigo, nombre, categoria, precio, precioAntes, costo, minimo, activo, previo.id);
    if (!r.changes) falla('Ese producto no existe', 404);
    return previo.id;
  } catch (e) { throw traducirError(e); }
}

/* ─────────────────────────── la tienda web ───────────────────────────

   ⚠️ QUIÉN MANDA EN QUÉ (lo decidió el dueño el 12/10/2026). Cada dato
   tiene un solo dueño; así nunca hay dos versiones de lo mismo.

   - Qué productos hay, cómo se llaman y cuánto cuestan → el PANEL DE LA WEB
     (productos.json). Este sistema lo copia y no deja cambiarlo.
   - Cuánto stock hay → ESTE sistema. La web muestra el de una tienda
     (stockParaLaWeb); el número escrito a mano en el panel deja de valer
     para lo que ya se contó acá.
   - Código de barras, costo y aviso de stock mínimo → este sistema. La web
     no los conoce.

   Lo que existe solo acá (catalogo_id vacío) no sale en la web y se
   administra entero desde acá. */

/* Pone los productos al día con el catálogo de la web. No hace falta
   llamarla a mano: el servidor la corre solo cada vez que el archivo cambia.

   - Producto nuevo en la web → se crea acá.
   - Le cambiaron nombre, categoría, precio u oferta → se copia.
   - Está en la web y acá había uno con EL MISMO NOMBRE cargado a mano → se
     vinculan en vez de duplicarlo (conserva su código, costo y movimientos).
   - Lo borraron de la web → acá queda, desvinculado: puede haber mercadería
     en el estante. No se borra ni se da de baja solo.

   Nunca toca código de barras, costo, stock mínimo ni movimientos. El
   "stock" del catálogo NO se importa: es un número suelto que no dice en
   qué tienda está. El stock real sale del conteo. */
function sincronizarCatalogo(db, rutaCatalogo){
  let datos;
  try { datos = JSON.parse(fs.readFileSync(rutaCatalogo, 'utf8')); }
  catch (e) { falla('No se pudo leer el catálogo de la tienda web'); }
  if (!datos || !Array.isArray(datos.productos)) falla('El catálogo de la tienda web no tiene la lista de productos');

  return enTransaccion(db, () => {
    const porCatalogo = db.prepare('SELECT * FROM productos WHERE catalogo_id = ?');
    const porNombre = db.prepare(`SELECT id FROM productos WHERE catalogo_id IS NULL AND nombre = ? COLLATE NOCASE
                                  ORDER BY activo DESC, id LIMIT 1`);
    const alta = db.prepare(`INSERT INTO productos(nombre, categoria, precio, precio_antes, catalogo_id, variantes, creado)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const cambio = db.prepare(`UPDATE productos SET nombre = ?, categoria = ?, precio = ?, precio_antes = ?, catalogo_id = ?,
                                      variantes = ?
                               WHERE id = ?`);
    /* ⚠️ Al vincular por nombre, el producto vuelve a venderse (activo = 1).
       El que se toma puede estar dado de baja —se pide primero uno activo,
       pero si no hay se usa ese—, y quedaba así: el producto salía en la
       tienda web y en el mostrador no existía, ni para venderlo ni para
       recibirlo, porque la lista no muestra los dados de baja. */
    const vincular = db.prepare(`UPDATE productos SET nombre = ?, categoria = ?, precio = ?, precio_antes = ?, catalogo_id = ?,
                                        variantes = ?, activo = 1
                                 WHERE id = ?`);
    const r = { nuevos: 0, actualizados: 0, vinculados: 0, desvinculados: 0, dadosDeBaja: 0, iguales: 0, salteados: 0 };

    /* Todos los ids que figuran en la web, aunque el producto venga mal
       cargado: uno con el precio roto se saltea, pero NO se desvincula. */
    const enLaWeb = new Set();
    for (const p of datos.productos){
      if (!p || !Number.isInteger(p.id) || p.id < 1){ r.salteados++; continue; }
      enLaWeb.add(p.id);
      const nombre = String(p.name || '').trim().slice(0, 120);
      const pesos = Number(p.price);
      if (!nombre || !Number.isFinite(pesos) || pesos < 0 || pesos > 10000000){ r.salteados++; continue; }
      const categoria = String(p.cat || '').trim().slice(0, 60);
      const precio = Math.round(pesos * 100);
      const antes = Number(p.precioAntes) > pesos ? Math.round(Number(p.precioAntes) * 100) : null;

      /* Las opciones de la web, con la diferencia de precio pasada a centavos.
         ⚠️ Sin esto el mostrador cobraba el precio base para todas: la sartén
         de 32 cm (Bs 185 en la web) salía a Bs 145. */
      let variantes = null;
      if (p.variantes && Array.isArray(p.variantes.opciones)){
        const opciones = p.variantes.opciones
          .filter(o => o && String(o.label || '').trim())
          .map(o => ({ label: String(o.label).trim().slice(0, 60), delta: Math.round((Number(o.delta) || 0) * 100) }));
        if (opciones.length) variantes = JSON.stringify({ nombre: String(p.variantes.nombre || 'Opción').trim().slice(0, 40), opciones });
      }

      const actual = porCatalogo.get(p.id);
      if (!actual){
        const mismoNombre = porNombre.get(nombre);
        if (mismoNombre){
          vincular.run(nombre, categoria, precio, antes, p.id, variantes, mismoNombre.id);
          r.vinculados++;
        } else {
          alta.run(nombre, categoria, precio, antes, p.id, variantes, Date.now());
          r.nuevos++;
        }
      } else if (actual.nombre !== nombre || actual.categoria !== categoria ||
                 actual.precio !== precio || actual.precio_antes !== antes || actual.variantes !== variantes){
        cambio.run(nombre, categoria, precio, antes, p.id, variantes, actual.id);
        r.actualizados++;
      } else {
        r.iguales++;
      }
    }

    /* Lo que se borró en el panel de la web.
       - Si en alguna tienda queda mercadería (o un negativo sin aclarar), el
         producto se suelta pero SIGUE vendiéndose: lo que está en el estante
         no desaparece porque se lo haya sacado de internet.
       - Si no queda nada en ninguna tienda, se da de baja. Antes quedaba
         activo: el dueño borró del panel los productos de muestra y en el
         mostrador seguían saliendo todos para vender.
       Darlo de baja no borra nada: el historial queda, y vuelve con
       "Mostrar los dados de baja" o cargándolo otra vez en la web. */
    const soltar = db.prepare('UPDATE productos SET catalogo_id = NULL WHERE id = ?');
    const baja = db.prepare('UPDATE productos SET catalogo_id = NULL, activo = 0 WHERE id = ?');
    const queda = db.prepare(`SELECT 1 FROM (SELECT SUM(cantidad) AS s FROM movimientos WHERE producto_id = ? GROUP BY tienda_id)
                              WHERE s <> 0 LIMIT 1`);
    for (const v of db.prepare('SELECT id, catalogo_id FROM productos WHERE catalogo_id IS NOT NULL').all()){
      if (enLaWeb.has(v.catalogo_id)) continue;
      r.desvinculados++;
      if (queda.get(v.id)) soltar.run(v.id);
      else { baja.run(v.id); r.dadosDeBaja++; }
    }
    return r;
  });
}

/* El stock que la web tiene que mostrar: el de UNA tienda, la que despacha
   los pedidos online. Devuelve { id del catálogo: unidades }.
   ⚠️ Solo trae los productos que tuvieron algún movimiento en esa tienda.
   Uno que nunca se contó ahí NO figura, y la web sigue mostrando el número
   del panel. Si figurara con 0, el día que se prende la sincronización toda
   la tienda online pasaría a "agotado" hasta terminar de contar.
   Un stock negativo (se vendió más de lo que el sistema creía) sale como 0. */
function stockParaLaWeb(db, tiendaId){
  const filas = db.prepare(`SELECT p.catalogo_id AS id, SUM(m.cantidad) AS s
                            FROM movimientos m JOIN productos p ON p.id = m.producto_id
                            WHERE m.tienda_id = ? AND p.catalogo_id IS NOT NULL
                            GROUP BY p.catalogo_id`).all(tiendaId);
  const stock = {};
  for (const f of filas) stock[f.id] = Math.max(0, f.s);
  return stock;
}

/* ─────────────────────────── movimientos ─────────────────────────── */

/* Junta la lista que manda la pantalla: si el mismo producto viene dos
   veces, se suman. Devuelve [{ p, cantidad }] con el producto de la base. */
/* conVariantes: es una VENTA, donde importa qué opción se lleva porque
   cambia el precio. En una entrada o un conteo no importa: el stock es del
   producto entero. Devuelve también "precio": lo que vale ESE renglón. */
function normalizarItems(db, items, conVariantes = false){
  if (!Array.isArray(items) || !items.length) falla('No hay productos en la lista');
  if (items.length > 300) falla('Son demasiados productos de una sola vez');
  const juntos = new Map();
  for (const it of items){
    const id = entero(it && it.producto_id, 1, 1e9, 'El producto');
    const c = entero(it && it.cantidad, 1, 100000, 'La cantidad');
    const variante = conVariantes ? texto(it && it.variante, 60, 'la opción') : '';
    const k = id + '|' + variante;
    const j = juntos.get(k) || { id, variante, cantidad: 0 };
    j.cantidad += c;
    juntos.set(k, j);
  }
  const buscar = db.prepare('SELECT * FROM productos WHERE id = ?');
  return [...juntos.values()].map(({ id, variante, cantidad }) => {
    const p = buscar.get(id);
    if (!p) falla('Hay un producto que no existe (id ' + id + ')', 404);
    let precio = p.precio;
    if (conVariantes){
      const v = variantesDe(p);
      if (v){
        /* el precio de la opción también sale de la BASE, no del pedido */
        const opcion = v.opciones.find(o => o.label === variante);
        if (!opcion) falla('"' + p.nombre + '" viene en varias opciones (' + v.nombre + '): hay que elegir cuál se lleva', 409);
        precio = Math.max(0, p.precio + opcion.delta);
      } else if (variante){
        falla('"' + p.nombre + '" ya no tiene opciones en la web: actualice la lista y cobre de nuevo', 409);
      }
    }
    return { p, cantidad, variante: variante || null, precio };
  });
}

/* ⚠️ El precio sale de la BASE, nunca del pedido. La pantalla manda solo
   qué producto y cuántos. Si mandara el precio, cualquiera podría cobrar
   lo que quisiera con armar el pedido a mano. */
function registrarVenta(db, actor, d){
  const pago = d.pago === 'efectivo' || d.pago === 'qr' ? d.pago : falla('Falta elegir cómo pagó: efectivo o QR');
  const clave = d.clave == null || d.clave === '' ? null : String(d.clave);
  if (clave && !/^[A-Za-z0-9-]{8,64}$/.test(clave)) falla('La clave del cobro no es válida');
  return enTransaccion(db, () => {
    const tiendaId = tiendaDe(db, actor, d.tienda_id);

    /* ⚠️ El mismo cobro puede llegar DOS veces: se corta internet justo
       después de registrar, a la pantalla le llega un error y la vendedora
       toca Cobrar de nuevo. Sin esto quedaban dos ventas, el stock bajaba
       el doble y la caja no cerraba. Con la clave, la segunda vez se
       devuelve la venta que ya estaba. */
    if (clave){
      const ya = db.prepare('SELECT * FROM ventas WHERE clave = ?').get(clave);
      if (ya){
        if (ya.usuario_id !== actor.id) falla('Ese cobro ya lo registró otro usuario', 409);
        /* los avisos de stock se arman de nuevo: la primera respuesta, que
           los traía, es justo la que se perdió en el camino */
        const vendidos = db.prepare(`SELECT p.id, p.nombre FROM venta_items vi JOIN productos p ON p.id = vi.producto_id
                                     WHERE vi.venta_id = ?`).all(ya.id);
        return { id: ya.id, total: ya.total, pago: ya.pago, tienda_id: ya.tienda_id, fecha: ya.fecha,
                 avisos: vendidos.map(p => avisoDeStock(db, ya.tienda_id, p)).filter(Boolean), repetida: true };
      }
    }

    const items = normalizarItems(db, d.items, true);
    for (const { p } of items){
      if (!p.activo) falla('"' + p.nombre + '" está dado de baja y no se puede vender', 409);
    }
    const ahora = Date.now();
    const total = items.reduce((s, { precio, cantidad }) => s + precio * cantidad, 0);

    /* El precio sigue saliendo de la base. Pero si la pantalla le mostró al
       cliente OTRO total (el dueño cambió un precio mientras la lista estaba
       armada), no se cobra en silencio un monto distinto al que se dijo en
       voz alta: se frena y la pantalla vuelve a traer los precios. */
    if (d.total_esperado != null && Number(d.total_esperado) !== total){
      falla('Cambió algún precio mientras se armaba la venta. El total ahora es ' + enBs(total) +
            ': revise la lista y cobre de nuevo.', 409);
    }

    /* ⚠️ Vender lo que el sistema dice que NO hay: se puede, pero no por
       descuido (lo eligió el dueño el 13/10/2026, entre dejarlo pasar con un
       aviso, pedir confirmación, o bloquear).
       No se bloquea porque si la vendedora lo tiene en la mano, el que está
       mal es el sistema (un conteo sin hacer, una entrada sin anotar), y
       negarse a cobrar solo empuja a vender por afuera, que es peor.
       Pero tiene que decirlo a propósito: el primer pedido vuelve con 409 y
       la lista de lo que falta; la pantalla muestra un botón aparte y
       reenvía con confirmar_sin_stock. Queda anotado en el movimiento y el
       dueño lo ve en sus alertas (stock negativo). */
    const pedido = new Map();   // producto → cuántos en total, sumando todas sus opciones
    for (const { p, cantidad } of items){
      const j = pedido.get(p.id) || { p, cantidad: 0 };
      j.cantidad += cantidad;
      pedido.set(p.id, j);
    }
    const sinStock = [];
    for (const { p, cantidad } of pedido.values()){
      const hay = stockDe(db, tiendaId, p.id);
      if (hay < cantidad) sinStock.push({ producto_id: p.id, nombre: p.nombre, hay, pide: cantidad });
    }
    if (sinStock.length && d.confirmar_sin_stock !== true){
      falla('El sistema dice que no hay suficiente de: ' + sinStock.map(s => s.nombre).join(', ') +
            '. Si lo tiene en la mano, confirme la venta.', 409, { sinStock });
    }
    const faltaban = new Set(sinStock.map(s => s.producto_id));

    const v = db.prepare('INSERT INTO ventas(tienda_id, usuario_id, fecha, total, pago, clave) VALUES (?, ?, ?, ?, ?, ?)')
                .run(tiendaId, actor.id, ahora, total, pago, clave);
    const ventaId = Number(v.lastInsertRowid);

    const altaItem = db.prepare(`INSERT INTO venta_items(venta_id, producto_id, cantidad, precio_unit, costo_unit, variante)
                                 VALUES (?, ?, ?, ?, ?, ?)`);
    const altaMov = db.prepare(`INSERT INTO movimientos(fecha, tienda_id, producto_id, cantidad, tipo, usuario_id, venta_id, nota)
                                VALUES (?, ?, ?, ?, 'venta', ?, ?, ?)`);
    for (const { p, cantidad, variante, precio } of items){
      altaItem.run(ventaId, p.id, cantidad, precio, p.costo, variante);
      const notas = [variante, faltaban.has(p.id) ? 'Vendido sin stock en el sistema: confirmó que lo tenía' : null].filter(Boolean);
      altaMov.run(ahora, tiendaId, p.id, -cantidad, actor.id, ventaId, notas.join(' · ') || null);
    }
    const avisos = [...pedido.values()].map(({ p }) => avisoDeStock(db, tiendaId, p)).filter(Boolean);
    return { id: ventaId, total, pago, tienda_id: tiendaId, fecha: ahora, avisos };
  });
}

function avisoDeStock(db, tiendaId, p){
  const queda = stockDe(db, tiendaId, p.id);
  return queda < 0
    ? '"' + p.nombre + '": el sistema queda en ' + queda + '. Avise al dueño para revisar ese producto.'
    : null;
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
      SELECT vi.venta_id, vi.producto_id, p.nombre, vi.variante, vi.cantidad, vi.precio_unit
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
      /* Una tienda que NUNCA tuvo ese producto no tiene "stock bajo": no lo
         vende. Sin este corte, un producto que solo está en Chimoré avisaba
         "tiene 0" en las otras dos todos los días, y entre tantos avisos
         falsos los de verdad dejaban de leerse. Si lo tuvo y se acabó, el
         movimiento existe y el aviso sale. */
      if (porTienda[t.id] === undefined) continue;
      const s = porTienda[t.id];
      if (s < 0) negativos.push({ producto: p.nombre, tienda: t.nombre, stock: s });
      else if (p.stock_minimo > 0 && s <= p.stock_minimo){
        bajos.push({ producto: p.nombre, tienda: t.nombre, stock: s, minimo: p.stock_minimo });
      }
    }
  }

  /* Cajas: los cierres de hoy que no cuadraron, y lo que quedó cobrado en
     días anteriores sin que nadie cerrara (plata que no se sabe si está). */
  const cierres = db.prepare(`
    SELECT c.hasta, t.nombre AS tienda, u.nombre AS usuario, c.efectivo, c.contado, c.diferencia, c.nota
    FROM cierres c JOIN tiendas t ON t.id = c.tienda_id JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.hasta >= ? AND c.diferencia <> 0 ORDER BY c.hasta DESC`).all(desde);
  const sinCerrar = cajasPendientes(db).filter(p => p.primera < desde);

  /* Mercadería que se anotó como recibida hoy, por quién y cuánta. No es un
     problema en sí, pero una entrada inventada sirve para tapar un faltante
     y antes solo quedaba perdida en el historial: que el dueño la vea. */
  const entradas = db.prepare(`
    SELECT t.nombre AS tienda, u.nombre AS usuario, COUNT(DISTINCT m.producto_id) AS productos,
           SUM(m.cantidad) AS unidades, MAX(m.fecha) AS fecha
    FROM movimientos m JOIN tiendas t ON t.id = m.tienda_id JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.tipo = 'entrada' AND m.fecha >= ?
    GROUP BY m.tienda_id, m.usuario_id ORDER BY fecha DESC`).all(desde);

  /* Todo gasto y todo retiro del día, con quién lo anotó: ver registrarGasto() */
  const gastos = listarGastos(db, { desde: desde - 1 });

  return { desde, porTienda, masVendidos, alertas: { anulaciones, ajustes, negativos, bajos, cierres, sinCerrar, entradas, gastos } };
}

/* ─────────────────────────── cierre de caja ───────────────────────────

   Cada persona cierra LO SUYO: lo que cobró ella, en una tienda, desde su
   cierre anterior. Con turnos (mañana, tarde, fin de semana) cada una tiene
   su propia cuenta de usuario y su propio cierre.

   No hay "abrir caja": el período arranca solo en el cierre anterior. Así
   una vendedora que se olvida de cerrar no pierde nada, lo arrastra al
   cierre siguiente, y el dueño lo ve como caja sin cerrar. */

function cajaSinCerrar(db, tiendaId, usuarioId, hasta = Date.now()){
  const ultimo = db.prepare('SELECT MAX(hasta) AS h FROM cierres WHERE tienda_id = ? AND usuario_id = ?')
                   .get(tiendaId, usuarioId).h || 0;
  const f = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN anulada = 0 THEN 1 ELSE 0 END), 0)                        AS ventas,
           COALESCE(SUM(CASE WHEN anulada = 0 AND pago = 'efectivo' THEN total ELSE 0 END), 0) AS efectivo,
           COALESCE(SUM(CASE WHEN anulada = 0 AND pago = 'qr' THEN total ELSE 0 END), 0)     AS qr,
           COALESCE(SUM(anulada), 0)                                                       AS anuladas,
           MIN(fecha)                                                                      AS primera
    FROM ventas WHERE tienda_id = ? AND usuario_id = ? AND fecha > ? AND fecha <= ?`)
    .get(tiendaId, usuarioId, ultimo, hasta);

  /* ⚠️ Plata que salió de la caja por ventas que YA estaban cerradas.
     Caso real: cobra Bs 300, cierra la caja (coincide) y después anula esa
     venta y devuelve la plata. Esa venta ya no entra en ningún período, así
     que los Bs 300 que salieron no figuraban en ningún lado.
     Se cuenta para quien ANULÓ (es quien sacó la plata), en este período, y
     solo si la venta ya había entrado como válida en un cierre de quien la
     hizo. Una venta anulada antes de cerrarse no necesita esto: simplemente
     no suma. */
  const dev = db.prepare(`
    SELECT COALESCE(SUM(v.total), 0) AS monto, COUNT(*) AS cuantas
    FROM ventas v
    WHERE v.tienda_id = ? AND v.anulada = 1 AND v.anulada_por = ? AND v.pago = 'efectivo'
      AND v.anulada_fecha > ? AND v.anulada_fecha <= ?
      AND EXISTS (SELECT 1 FROM cierres c
                  WHERE c.tienda_id = v.tienda_id AND c.usuario_id = v.usuario_id
                    AND v.fecha > c.desde AND v.fecha <= c.hasta AND v.anulada_fecha > c.hasta)`)
    .get(tiendaId, usuarioId, ultimo, hasta);
  const gastos = db.prepare(`SELECT COALESCE(SUM(monto), 0) AS g FROM gastos
                             WHERE tienda_id = ? AND usuario_id = ? AND fecha > ? AND fecha <= ?`)
                   .get(tiendaId, usuarioId, ultimo, hasta).g;
  return Object.assign({ tienda_id: tiendaId, desde: ultimo, devoluciones: dev.monto, devueltas: dev.cuantas, gastos }, f);
}

/* ─────────────────────────── gastos y retiros ───────────────────────────
   Plata que sale de la caja: un gasto (flete, hielo, bolsas) o un retiro
   (el dueño se lleva efectivo). Lo anota quien tiene la caja en ese
   momento, y se descuenta de lo que tiene que haber al cerrar.
   ⚠️ Una vendedora podría anotar un "retiro" que no existió para tapar un
   faltante. Por eso todo gasto y retiro le aparece al dueño en Hoy, con el
   motivo y quién lo anotó: él sabe si se llevó esa plata o no. */
function registrarGasto(db, actor, d){
  const tipo = d.tipo === 'retiro' ? 'retiro' : 'gasto';
  const monto = dinero(d.monto, 'el monto');
  if (monto <= 0) falla('El monto tiene que ser mayor que cero');
  const motivo = texto(d.motivo, 200, 'el motivo', true);
  if (motivo.length < 3) falla('Escriba en qué se gastó o quién retiró la plata');
  const tiendaId = tiendaDe(db, actor, d.tienda_id);
  const r = db.prepare('INSERT INTO gastos(fecha, tienda_id, usuario_id, tipo, monto, motivo) VALUES (?, ?, ?, ?, ?, ?)')
              .run(Date.now(), tiendaId, actor.id, tipo, monto, motivo);
  return { id: Number(r.lastInsertRowid), tipo, monto };
}

function listarGastos(db, f = {}){
  const cond = [], args = [];
  if (f.tienda)  { cond.push('g.tienda_id = ?');  args.push(f.tienda); }
  if (f.usuario) { cond.push('g.usuario_id = ?'); args.push(f.usuario); }
  if (f.desde != null) { cond.push('g.fecha > ?');  args.push(f.desde); }
  if (f.hasta != null) { cond.push('g.fecha <= ?'); args.push(f.hasta); }
  return db.prepare(`
    SELECT g.id, g.fecha, t.nombre AS tienda, u.nombre AS usuario, g.tipo, g.monto, g.motivo
    FROM gastos g JOIN tiendas t ON t.id = g.tienda_id JOIN usuarios u ON u.id = g.usuario_id
    ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
    ORDER BY g.fecha DESC LIMIT 300`).all(...args);
}

/* ─────────────────────────── traspasos entre tiendas ───────────────────────────
   Mandar mercadería de una tienda a otra: baja en la que manda y sube en la
   que recibe, en un solo paso y con el mismo movimiento ('transferencia').
   Antes había que corregir el stock a mano en las dos, y las dos
   correcciones saltaban como alerta de ajuste.
   Solo el dueño. No se puede mandar más de lo que el sistema dice que hay
   en la tienda de origen: si de verdad hay más, primero se corrige ese
   stock con un conteo (acá no hay una vendedora con el producto en la mano
   y un cliente esperando, como en una venta). */
function transferir(db, actor, d){
  soloDueno(actor);
  const nota = texto(d.nota, 200, 'la nota');
  return enTransaccion(db, () => {
    const origen = tiendaValida(db, d.origen);
    const destino = tiendaValida(db, d.destino);
    if (origen === destino) falla('La tienda que manda y la que recibe son la misma');
    const nombre = id => db.prepare('SELECT nombre FROM tiendas WHERE id = ?').get(id).nombre;
    const items = normalizarItems(db, d.items);
    for (const { p, cantidad } of items){
      const hay = stockDe(db, origen, p.id);
      if (hay < cantidad){
        falla('En ' + nombre(origen) + ' el sistema tiene ' + hay + ' de "' + p.nombre + '": no se pueden pasar ' + cantidad +
              '. Si hay más, primero corrija ese stock con un conteo.', 409);
      }
    }
    const ahora = Date.now();
    const mov = db.prepare(`INSERT INTO movimientos(fecha, tienda_id, producto_id, cantidad, tipo, usuario_id, nota)
                            VALUES (?, ?, ?, ?, 'transferencia', ?, ?)`);
    const con = (texto0) => nota ? texto0 + ' · ' + nota : texto0;
    for (const { p, cantidad } of items){
      mov.run(ahora, origen, p.id, -cantidad, actor.id, con('Enviado a ' + nombre(destino)));
      mov.run(ahora, destino, p.id, cantidad, actor.id, con('Recibido de ' + nombre(origen)));
    }
    return { productos: items.length, unidades: items.reduce((s, i) => s + i.cantidad, 0),
             origen: nombre(origen), destino: nombre(destino) };
  });
}

/* Todas las cajas con ventas sin cerrar, de todos: lo mira el dueño. */
function cajasPendientes(db){
  return db.prepare(`
    SELECT v.tienda_id, t.nombre AS tienda, v.usuario_id, u.nombre AS usuario,
           SUM(CASE WHEN v.anulada = 0 THEN 1 ELSE 0 END)                           AS ventas,
           SUM(CASE WHEN v.anulada = 0 AND v.pago = 'efectivo' THEN v.total ELSE 0 END) AS efectivo,
           MIN(v.fecha) AS primera
    FROM ventas v JOIN tiendas t ON t.id = v.tienda_id JOIN usuarios u ON u.id = v.usuario_id
    WHERE v.fecha > COALESCE((SELECT MAX(c.hasta) FROM cierres c
                              WHERE c.tienda_id = v.tienda_id AND c.usuario_id = v.usuario_id), 0)
    GROUP BY v.tienda_id, v.usuario_id
    HAVING ventas > 0
    ORDER BY primera`).all();
}

/* Lo que ve cada uno al abrir la pestaña Caja.
   ⚠️ A la vendedora NO se le manda cuánto efectivo tendría que haber: solo
   cuántas ventas hizo. Tiene que contar la plata y escribir lo que hay. Si
   viera el número, lo copiaría y el cierre no serviría para saber si falta. */
function estadoDeCaja(db, actor, tiendaPedida){
  const tiendaId = tiendaDe(db, actor, tiendaPedida);
  const p = cajaSinCerrar(db, tiendaId, actor.id);
  const r = { mia: { tienda_id: tiendaId, desde: p.desde, primera: p.primera, ventas: p.ventas, anuladas: p.anuladas, qr: p.qr,
                     devoluciones: p.devoluciones, devueltas: p.devueltas, gastos: p.gastos,
                     listaGastos: listarGastos(db, { tienda: tiendaId, usuario: actor.id, desde: p.desde }) } };
  if (actor.rol === 'dueno'){
    r.mia.efectivo = p.efectivo;
    r.pendientes = cajasPendientes(db);
  }
  return r;
}

function cerrarCaja(db, actor, d){
  const contado = dinero(d.contado, 'cuánta plata hay');
  const nota = texto(d.nota, 200, 'la nota');
  return enTransaccion(db, () => {
    /* El dueño puede cerrar la caja de OTRA persona: una vendedora a la que
       cambiaron de tienda o dieron de baja sin cerrar ya no puede hacerlo
       ella, y esa caja quedaba abierta para siempre. Queda anotado que la
       cerró él. Una vendedora solo cierra la suya. */
    let deQuien = actor.id, cerradoPor = null, tiendaId;
    if (d.usuario_id != null && Number(d.usuario_id) !== actor.id){
      soloDueno(actor);
      deQuien = entero(d.usuario_id, 1, 1e9, 'El usuario');
      if (!db.prepare('SELECT 1 AS si FROM usuarios WHERE id = ?').get(deQuien)) falla('Ese usuario no existe', 404);
      cerradoPor = actor.id;
      tiendaId = tiendaValida(db, d.tienda_id);
    } else {
      tiendaId = tiendaDe(db, actor, d.tienda_id);
    }
    const hasta = Date.now();
    const p = cajaSinCerrar(db, tiendaId, deQuien, hasta);
    if (!p.ventas && !p.anuladas && !p.devoluciones && !p.gastos) falla('No hay ventas para cerrar: no cobró nada desde su último cierre', 409);

    /* Lo que tiene que haber: lo cobrado en efectivo menos lo devuelto. Si
       devolvió más de lo que cobró, la diferencia salió del cambio: no se le
       puede pedir que cuente plata negativa, así que se espera 0. */
    const esperado = Math.max(0, p.efectivo - p.devoluciones - p.gastos);
    const diferencia = contado - esperado;
    /* No cuadra: primero se le pide que cuente de nuevo (la mayoría de las
       veces es un error al contar). Para cerrar igual hace falta escribir
       qué pasó, y eso queda a la vista del dueño. */
    if (diferencia !== 0 && nota.length < 3){
      falla('No coincide con lo cobrado: ' + (diferencia < 0 ? 'faltan ' : 'sobran ') + enBs(Math.abs(diferencia)) +
            '. Cuente de nuevo. Si está bien contado, escriba en la nota qué pasó y cierre.', 409);
    }
    const r = db.prepare(`INSERT INTO cierres(tienda_id, usuario_id, desde, hasta, ventas, anuladas, efectivo, qr, contado,
                                              diferencia, nota, devoluciones, cerrado_por, gastos)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(tiendaId, deQuien, p.desde, hasta, p.ventas, p.anuladas, p.efectivo, p.qr, contado, diferencia, nota || null,
           p.devoluciones, cerradoPor, p.gastos);
    return { id: Number(r.lastInsertRowid), ventas: p.ventas, efectivo: p.efectivo, devoluciones: p.devoluciones, gastos: p.gastos,
             esperado, qr: p.qr, contado, diferencia };
  });
}

/* La vendedora ve sus propios cierres; el dueño, los de todos. */
function listarCierres(db, actor, f = {}){
  const cond = [], args = [];
  if (actor.rol === 'vendedor'){
    cond.push('c.usuario_id = ?'); args.push(actor.id);
  } else {
    if (f.tienda) { cond.push('c.tienda_id = ?'); args.push(entero(f.tienda, 1, 1e9, 'La tienda')); }
    if (f.desde)  { cond.push('c.hasta >= ?');    args.push(entero(f.desde, 0, 1e14, 'Desde')); }
    if (f.hasta)  { cond.push('c.hasta < ?');     args.push(entero(f.hasta, 0, 1e14, 'Hasta')); }
  }
  const limite = actor.rol === 'vendedor' ? 20 : 300;
  return db.prepare(`
    SELECT c.id, c.tienda_id, t.nombre AS tienda, c.usuario_id, u.nombre AS usuario, c.desde, c.hasta,
           c.ventas, c.anuladas, c.efectivo, c.qr, c.contado, c.diferencia, c.nota, c.devoluciones, c.gastos,
           quien.nombre AS cerrado_por
    FROM cierres c JOIN tiendas t ON t.id = c.tienda_id JOIN usuarios u ON u.id = c.usuario_id
    LEFT JOIN usuarios quien ON quien.id = c.cerrado_por
    ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
    ORDER BY c.hasta DESC LIMIT ?`).all(...args, limite);
}

/* ─────────────────────────── reportes ─────────────────────────── */

/* Ventas de un período (una semana, un mes, lo que se elija), cortadas de
   las cuatro formas que mira un dueño: por día, por tienda, por persona y
   por producto. Las ventas anuladas no suman en ningún lado. */
function reporte(db, actor, f = {}){
  soloDueno(actor);
  const desde = entero(f.desde, 0, 1e14, 'Desde');
  const hasta = entero(f.hasta, 0, 1e14, 'Hasta');
  if (hasta <= desde) falla('El período está al revés: la fecha "hasta" es anterior a la "desde"');
  if (hasta - desde > 400 * DIA) falla('El período es demasiado largo: como máximo un año por vez');
  const cond = ['v.fecha >= ?', 'v.fecha < ?'], args = [desde, hasta];
  if (f.tienda){ cond.push('v.tienda_id = ?'); args.push(entero(f.tienda, 1, 1e9, 'La tienda')); }
  const donde = cond.join(' AND ');

  const SUMAS = `SUM(CASE WHEN v.anulada = 0 THEN 1 ELSE 0 END)                                AS ventas,
                 SUM(CASE WHEN v.anulada = 0 THEN v.total ELSE 0 END)                          AS total,
                 SUM(CASE WHEN v.anulada = 0 AND v.pago = 'efectivo' THEN v.total ELSE 0 END)  AS efectivo,
                 SUM(CASE WHEN v.anulada = 0 AND v.pago = 'qr' THEN v.total ELSE 0 END)        AS qr,
                 SUM(v.anulada)                                                                AS anuladas`;
  const ceros = o => { for (const k of Object.keys(o)) if (o[k] === null) o[k] = 0; return o; };

  const totales = ceros(db.prepare(`SELECT ${SUMAS} FROM ventas v WHERE ${donde}`).get(...args));
  const g = db.prepare(`
    SELECT SUM(CASE WHEN vi.costo_unit IS NOT NULL THEN (vi.precio_unit - vi.costo_unit) * vi.cantidad ELSE 0 END) AS ganancia,
           SUM(CASE WHEN vi.costo_unit IS NULL THEN vi.cantidad ELSE 0 END) AS sin_costo
    FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id WHERE ${donde} AND v.anulada = 0`).get(...args);
  totales.ganancia = g.ganancia || 0;
  totales.sin_costo = g.sin_costo || 0;

  /* El día se corta a la medianoche de Bolivia, no a la de UTC: si no, las
     ventas de las 8 de la noche caerían en el día siguiente. */
  const corrimiento = ZONA_MINUTOS * 60000;
  const porDia = db.prepare(`
    SELECT CAST((v.fecha + ?) / ${DIA} AS INTEGER) AS dia, ${SUMAS}
    FROM ventas v WHERE ${donde} GROUP BY dia ORDER BY dia`).all(corrimiento, ...args)
    .map(d => ceros(Object.assign(d, { fecha: d.dia * DIA - corrimiento })));

  const porTienda = db.prepare(`
    SELECT t.nombre AS tienda, ${SUMAS}
    FROM ventas v JOIN tiendas t ON t.id = v.tienda_id WHERE ${donde}
    GROUP BY v.tienda_id ORDER BY total DESC`).all(...args).map(ceros);

  const porVendedor = db.prepare(`
    SELECT u.nombre AS vendedor, t.nombre AS tienda, ${SUMAS}
    FROM ventas v JOIN usuarios u ON u.id = v.usuario_id JOIN tiendas t ON t.id = v.tienda_id WHERE ${donde}
    GROUP BY v.usuario_id, v.tienda_id ORDER BY total DESC`).all(...args).map(ceros);

  const porProducto = db.prepare(`
    SELECT p.nombre AS producto, p.categoria, SUM(vi.cantidad) AS unidades, SUM(vi.cantidad * vi.precio_unit) AS monto,
           SUM(CASE WHEN vi.costo_unit IS NOT NULL THEN (vi.precio_unit - vi.costo_unit) * vi.cantidad ELSE 0 END) AS ganancia
    FROM ventas v JOIN venta_items vi ON vi.venta_id = v.id JOIN productos p ON p.id = vi.producto_id
    WHERE ${donde} AND v.anulada = 0
    GROUP BY vi.producto_id ORDER BY monto DESC LIMIT 200`).all(...args);

  /* Las cajas del mismo período: cuántas se cerraron y cuánta plata faltó o sobró */
  const condCaja = ['c.hasta >= ?', 'c.hasta < ?'], argsCaja = [desde, hasta];
  if (f.tienda){ condCaja.push('c.tienda_id = ?'); argsCaja.push(Number(f.tienda)); }
  const cajas = ceros(db.prepare(`
    SELECT COUNT(*) AS cierres,
           SUM(CASE WHEN c.diferencia <> 0 THEN 1 ELSE 0 END) AS con_diferencia,
           SUM(CASE WHEN c.diferencia < 0 THEN -c.diferencia ELSE 0 END) AS faltante,
           SUM(CASE WHEN c.diferencia > 0 THEN c.diferencia ELSE 0 END)  AS sobrante
    FROM cierres c WHERE ${condCaja.join(' AND ')}`).get(...argsCaja));

  const condGasto = ['fecha >= ?', 'fecha < ?'], argsGasto = [desde, hasta];
  if (f.tienda){ condGasto.push('tienda_id = ?'); argsGasto.push(Number(f.tienda)); }
  const salidas = db.prepare(`SELECT COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) AS gastos,
                               COALESCE(SUM(CASE WHEN tipo = 'retiro' THEN monto ELSE 0 END), 0) AS retiros
                        FROM gastos WHERE ${condGasto.join(' AND ')}`).get(...argsGasto);
  cajas.gastos = salidas.gastos;
  cajas.retiros = salidas.retiros;

  return { desde, hasta, totales, porDia, porTienda, porVendedor, porProducto, cajas };
}

module.exports = {
  ErrorUso, inicioDelDia, fechaLocal, MINUTOS_PARA_ANULAR,
  listarTiendas,
  contarUsuarios, configurarDueno, verificarLogin, idDeSesion, usuarioDeSesion,
  cerrarSesiones, datosPublicos, listarUsuarios, guardarUsuario,
  listarProductos, guardarProducto, sincronizarCatalogo, stockParaLaWeb,
  registrarVenta, anularVenta, listarVentas, registrarEntrada, establecerStock,
  listarMovimientos, resumenHoy,
  estadoDeCaja, cerrarCaja, listarCierres, reporte, cambiarMiClave,
  registrarGasto, transferir
};
