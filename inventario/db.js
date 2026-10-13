/* ══════════════════════════════════════════════════════════════════════
   Inventario — base de datos

   SQLite, el que trae Node de fábrica (node:sqlite, Node 22.13 o más).
   Sin dependencias, igual que el resto del proyecto.

   ⚠️ LA REGLA DE ORO: el stock NO se guarda, se CALCULA.
   No existe una columna "stock" en ningún lado. El stock de un producto en
   una tienda es la suma de sus movimientos: entradas en positivo, ventas en
   negativo. Si alguien pudiera escribir "hay 10", no habría forma de saber
   si faltan cosas — y para eso existe este sistema.

   Por la misma razón los movimientos no se editan ni se borran: lo impiden
   los triggers de abajo, en la propia base. Un error se corrige con otro
   movimiento (un ajuste o una anulación), y los dos quedan a la vista.
   ══════════════════════════════════════════════════════════════════════ */

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const VERSION_ESQUEMA = 5;

/* Las tres tiendas del cliente. Se cargan solas la primera vez. */
const TIENDAS_INICIALES = ['Ivirgarzama', 'Chimoré', 'Entre Ríos'];

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS tiendas(
  id      INTEGER PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE,
  activa  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS usuarios(
  id             INTEGER PRIMARY KEY,
  usuario        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre         TEXT NOT NULL,
  clave_hash     TEXT NOT NULL,
  rol            TEXT NOT NULL CHECK (rol IN ('dueno','vendedor')),
  tienda_id      INTEGER REFERENCES tiendas(id),
  activo         INTEGER NOT NULL DEFAULT 1,
  -- Va dentro de la cookie. Subirlo corta las sesiones abiertas de ESE
  -- usuario y de nadie más (al salir, al cambiarle la clave, al darlo de baja).
  version_sesion INTEGER NOT NULL DEFAULT 1,
  creado         INTEGER NOT NULL,
  -- un vendedor siempre pertenece a una tienda
  CHECK (rol = 'dueno' OR tienda_id IS NOT NULL)
);

-- Los importes van en CENTAVOS (enteros). Con decimales, 0.1 + 0.2 no da 0.3
-- y la caja terminaría descuadrando por errores de redondeo.
CREATE TABLE IF NOT EXISTS productos(
  id            INTEGER PRIMARY KEY,
  codigo        TEXT UNIQUE,              -- código de barras; puede faltar
  nombre        TEXT NOT NULL,
  categoria     TEXT NOT NULL DEFAULT '',
  precio        INTEGER NOT NULL CHECK (precio >= 0),  -- lo que se cobra hoy
  precio_antes  INTEGER,                  -- precio tachado si está en oferta
  costo         INTEGER,                  -- lo que le costó al dueño (opcional)
  stock_minimo  INTEGER NOT NULL DEFAULT 0,
  activo        INTEGER NOT NULL DEFAULT 1,
  catalogo_id   INTEGER UNIQUE,           -- id en productos.json (tienda online)
  creado        INTEGER NOT NULL,
  -- Las opciones que tiene en la web (tamaño, color...) con su diferencia de
  -- precio, como JSON: {"nombre":"Tamaño","opciones":[{"label":"32 cm","delta":4000}]}
  -- (delta en centavos). Igual que en la web, el STOCK es del producto entero,
  -- no de cada opción: lo que cambia por opción es el precio.
  variantes     TEXT
);

CREATE TABLE IF NOT EXISTS ventas(
  id               INTEGER PRIMARY KEY,
  tienda_id        INTEGER NOT NULL REFERENCES tiendas(id),
  usuario_id       INTEGER NOT NULL REFERENCES usuarios(id),
  fecha            INTEGER NOT NULL,
  total            INTEGER NOT NULL,
  pago             TEXT NOT NULL CHECK (pago IN ('efectivo','qr')),
  anulada          INTEGER NOT NULL DEFAULT 0,
  anulada_por      INTEGER REFERENCES usuarios(id),
  anulada_fecha    INTEGER,
  motivo_anulacion TEXT,
  -- La pantalla manda una clave distinta por cada cobro. Si el mismo cobro
  -- llega dos veces (se cortó internet y se tocó Cobrar de nuevo), la
  -- segunda vez no crea otra venta. El índice único está en migrar().
  clave            TEXT
);

CREATE TABLE IF NOT EXISTS venta_items(
  id           INTEGER PRIMARY KEY,
  venta_id     INTEGER NOT NULL REFERENCES ventas(id),
  producto_id  INTEGER NOT NULL REFERENCES productos(id),
  cantidad     INTEGER NOT NULL CHECK (cantidad > 0),
  -- el precio y el costo se copian al momento de vender: si mañana cambia
  -- el precio, la venta de hoy tiene que seguir diciendo lo que se cobró
  precio_unit  INTEGER NOT NULL,
  costo_unit   INTEGER,
  variante     TEXT                       -- qué opción se vendió ("32 cm"), si el producto tiene
);

CREATE TABLE IF NOT EXISTS movimientos(
  id           INTEGER PRIMARY KEY,
  fecha        INTEGER NOT NULL,
  tienda_id    INTEGER NOT NULL REFERENCES tiendas(id),
  producto_id  INTEGER NOT NULL REFERENCES productos(id),
  cantidad     INTEGER NOT NULL CHECK (cantidad <> 0),   -- + entra, - sale
  tipo         TEXT NOT NULL CHECK (tipo IN
                 ('inicial','entrada','venta','anulacion','ajuste','transferencia')),
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id),
  venta_id     INTEGER REFERENCES ventas(id),
  nota         TEXT
);

-- Cierre de caja: al terminar su turno, cada persona cuenta la plata de lo
-- que cobró ELLA y lo anota. Va por persona y no por tienda porque en una
-- misma tienda hay turnos (mañana, tarde, fin de semana): así la diferencia
-- de una no se mezcla con la de la otra.
-- Se guardan los números del momento (cuánto se esperaba, cuánto contó):
-- si después el dueño anula una venta vieja, el cierre sigue diciendo lo
-- que pasó ese día.
CREATE TABLE IF NOT EXISTS cierres(
  id          INTEGER PRIMARY KEY,
  tienda_id   INTEGER NOT NULL REFERENCES tiendas(id),
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  desde       INTEGER NOT NULL,          -- su cierre anterior en esa tienda (0 = el primero)
  hasta       INTEGER NOT NULL,          -- cuándo cerró
  ventas      INTEGER NOT NULL,          -- ventas válidas del período
  anuladas    INTEGER NOT NULL,
  efectivo    INTEGER NOT NULL,          -- lo que tenía que haber en efectivo
  qr          INTEGER NOT NULL,          -- lo cobrado por QR (no está en la caja)
  contado     INTEGER NOT NULL CHECK (contado >= 0),   -- lo que dijo que hay
  diferencia  INTEGER NOT NULL,          -- contado - (efectivo - devoluciones): negativo = falta
  nota        TEXT,
  -- Plata que devolvió por ventas que YA estaban en un cierre anterior y se
  -- anularon después. Sale de la caja, así que se resta de lo esperado.
  devoluciones INTEGER NOT NULL DEFAULT 0,
  -- Si la cerró el dueño en nombre de otra persona (la cambiaron de tienda o
  -- la dieron de baja sin cerrar), quién fue. Vacío = la cerró ella.
  cerrado_por INTEGER REFERENCES usuarios(id),
  gastos      INTEGER NOT NULL DEFAULT 0   -- gastos y retiros anotados en el período
);
CREATE INDEX IF NOT EXISTS cierres_quien ON cierres(tienda_id, usuario_id, hasta);

CREATE TRIGGER IF NOT EXISTS cierres_no_se_editan BEFORE UPDATE ON cierres
BEGIN SELECT RAISE(ABORT, 'Un cierre de caja no se modifica'); END;

CREATE TRIGGER IF NOT EXISTS cierres_no_se_borran BEFORE DELETE ON cierres
BEGIN SELECT RAISE(ABORT, 'Un cierre de caja no se borra'); END;

-- Plata que SALE de la caja sin ser una devolución: un flete, una bolsa de
-- hielo, o el dueño que pasa y se lleva efectivo (retiro). Sin esto la caja
-- nunca cuadraba y todo terminaba en la nota del cierre.
-- Como todo lo demás: no se edita ni se borra. Un error se corrige en la
-- nota del cierre.
CREATE TABLE IF NOT EXISTS gastos(
  id          INTEGER PRIMARY KEY,
  fecha       INTEGER NOT NULL,
  tienda_id   INTEGER NOT NULL REFERENCES tiendas(id),
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  tipo        TEXT NOT NULL CHECK (tipo IN ('gasto','retiro')),
  monto       INTEGER NOT NULL CHECK (monto > 0),
  motivo      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gastos_quien ON gastos(tienda_id, usuario_id, fecha);

CREATE TRIGGER IF NOT EXISTS gastos_no_se_editan BEFORE UPDATE ON gastos
BEGIN SELECT RAISE(ABORT, 'Un gasto anotado no se modifica'); END;

CREATE TRIGGER IF NOT EXISTS gastos_no_se_borran BEFORE DELETE ON gastos
BEGIN SELECT RAISE(ABORT, 'Un gasto anotado no se borra'); END;

CREATE INDEX IF NOT EXISTS mov_tienda_producto ON movimientos(tienda_id, producto_id);
CREATE INDEX IF NOT EXISTS mov_fecha           ON movimientos(fecha);
CREATE INDEX IF NOT EXISTS ventas_tienda_fecha ON ventas(tienda_id, fecha);
CREATE INDEX IF NOT EXISTS items_venta         ON venta_items(venta_id);

-- ── Lo que no se puede tocar, ni por error del programa ──
CREATE TRIGGER IF NOT EXISTS movimientos_no_se_editan BEFORE UPDATE ON movimientos
BEGIN SELECT RAISE(ABORT, 'Los movimientos no se modifican: se corrigen con otro movimiento'); END;

CREATE TRIGGER IF NOT EXISTS movimientos_no_se_borran BEFORE DELETE ON movimientos
BEGIN SELECT RAISE(ABORT, 'Los movimientos no se borran'); END;

CREATE TRIGGER IF NOT EXISTS items_no_se_editan BEFORE UPDATE ON venta_items
BEGIN SELECT RAISE(ABORT, 'Una venta registrada no se modifica'); END;

CREATE TRIGGER IF NOT EXISTS items_no_se_borran BEFORE DELETE ON venta_items
BEGIN SELECT RAISE(ABORT, 'Una venta registrada no se modifica'); END;

CREATE TRIGGER IF NOT EXISTS ventas_no_se_borran BEFORE DELETE ON ventas
BEGIN SELECT RAISE(ABORT, 'Las ventas no se borran: se anulan'); END;

-- De una venta solo se puede cambiar una cosa: pasarla a anulada, una vez.
CREATE TRIGGER IF NOT EXISTS ventas_solo_se_anulan BEFORE UPDATE ON ventas
WHEN OLD.anulada = 1
  OR NEW.total <> OLD.total OR NEW.pago <> OLD.pago OR NEW.fecha <> OLD.fecha
  OR NEW.tienda_id <> OLD.tienda_id OR NEW.usuario_id <> OLD.usuario_id
BEGIN SELECT RAISE(ABORT, 'De una venta solo se puede registrar su anulación, una vez'); END;
`;

function abrir(carpeta){
  fs.mkdirSync(carpeta, { recursive: true });
  const db = new DatabaseSync(path.join(carpeta, 'inventario.db'));
  /* WAL: las lecturas no esperan a las escrituras. busy_timeout: si dos
     tiendas guardan en el mismo instante, la segunda espera en vez de fallar. */
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  db.exec(ESQUEMA);
  migrar(db);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM tiendas').get();
  if (n === 0){
    const alta = db.prepare('INSERT INTO tiendas(nombre) VALUES (?)');
    TIENDAS_INICIALES.forEach(t => alta.run(t));
  }
  return db;
}

/* Lo que cambió desde la versión 1. CREATE TABLE IF NOT EXISTS no toca una
   tabla que ya existe, así que una base vieja necesita que le agreguen las
   columnas nuevas a mano. Se mira la tabla y no el número de versión: así
   da igual por dónde venga la base, queda bien.
   v2: ventas.clave (ver el comentario en la tabla).
   v3: la tabla cierres. Es una tabla nueva, la crea ESQUEMA sola. */
function migrar(db){
  const columnas = db.prepare('PRAGMA table_info(ventas)').all().map(c => c.name);
  if (!columnas.includes('clave')) db.exec('ALTER TABLE ventas ADD COLUMN clave TEXT');
  /* v4: variantes de precio y dos datos más en los cierres */
  const tiene = (tabla, col) => db.prepare('PRAGMA table_info(' + tabla + ')').all().some(c => c.name === col);
  if (!tiene('productos', 'variantes'))   db.exec('ALTER TABLE productos ADD COLUMN variantes TEXT');
  if (!tiene('venta_items', 'variante'))  db.exec('ALTER TABLE venta_items ADD COLUMN variante TEXT');
  if (!tiene('cierres', 'devoluciones'))  db.exec('ALTER TABLE cierres ADD COLUMN devoluciones INTEGER NOT NULL DEFAULT 0');
  if (!tiene('cierres', 'cerrado_por'))   db.exec('ALTER TABLE cierres ADD COLUMN cerrado_por INTEGER REFERENCES usuarios(id)');
  /* v5: gastos y retiros de caja (la tabla gastos la crea ESQUEMA) */
  if (!tiene('cierres', 'gastos'))        db.exec('ALTER TABLE cierres ADD COLUMN gastos INTEGER NOT NULL DEFAULT 0');
  /* Va acá y no en ESQUEMA: en una base vieja la columna recién existe ahora. */
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS ventas_clave ON ventas(clave) WHERE clave IS NOT NULL');
  const { user_version } = db.prepare('PRAGMA user_version').get();
  if (user_version < VERSION_ESQUEMA) db.exec('PRAGMA user_version = ' + VERSION_ESQUEMA);
}

/* ⚠️ Esta base ES el negocio: ventas, stock y quién hizo qué. Si el archivo
   se daña, no hay de dónde reconstruirlo.
   Se guarda una copia por día en respaldos/, y la de HOY se pisa cada vez
   que se llama (el servidor lo hace cada hora): lo peor que puede pasar es
   perder la última hora. VACUUM INTO saca una copia entera y consistente
   aunque haya ventas entrando en ese momento; copiar el archivo a mano con
   el servidor prendido NO lo garantiza (falta lo que está en el -wal).
   Ojo: la copia queda en el mismo disco. Salva de un archivo roto o de un
   borrado por error, no de que se muera la computadora. */
function respaldar(db, carpeta, hoy, conservar = 30){
  const dir = path.join(carpeta, 'respaldos');
  fs.mkdirSync(dir, { recursive: true });
  const destino = path.join(dir, 'inventario-' + hoy + '.db');
  const temporal = destino + '.tmp';
  /* VACUUM INTO se niega si el archivo ya existe: va a uno temporal y
     recién cuando salió entero reemplaza al anterior. */
  fs.rmSync(temporal, { force: true });
  db.prepare('VACUUM INTO ?').run(temporal);
  fs.renameSync(temporal, destino);

  const copias = fs.readdirSync(dir).filter(f => /^inventario-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const vieja of copias.slice(0, Math.max(0, copias.length - conservar))){
    fs.rmSync(path.join(dir, vieja), { force: true });
  }
  return destino;
}

/* node:sqlite no trae un ayudante de transacciones, así que va a mano.
   IMMEDIATE toma el candado de escritura al empezar: así dos ventas
   simultáneas del mismo producto no leen el mismo stock a la vez. */
function enTransaccion(db, fn){
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { abrir, enTransaccion, respaldar, TIENDAS_INICIALES };
