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

const VERSION_ESQUEMA = 1;

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
  creado        INTEGER NOT NULL
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
  motivo_anulacion TEXT
);

CREATE TABLE IF NOT EXISTS venta_items(
  id           INTEGER PRIMARY KEY,
  venta_id     INTEGER NOT NULL REFERENCES ventas(id),
  producto_id  INTEGER NOT NULL REFERENCES productos(id),
  cantidad     INTEGER NOT NULL CHECK (cantidad > 0),
  -- el precio y el costo se copian al momento de vender: si mañana cambia
  -- el precio, la venta de hoy tiene que seguir diciendo lo que se cobró
  precio_unit  INTEGER NOT NULL,
  costo_unit   INTEGER
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

  const { user_version } = db.prepare('PRAGMA user_version').get();
  if (user_version === 0) db.exec('PRAGMA user_version = ' + VERSION_ESQUEMA);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM tiendas').get();
  if (n === 0){
    const alta = db.prepare('INSERT INTO tiendas(nombre) VALUES (?)');
    TIENDAS_INICIALES.forEach(t => alta.run(t));
  }
  return db;
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

module.exports = { abrir, enTransaccion, TIENDAS_INICIALES };
