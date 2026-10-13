/* ══════════════════════════════════════════════════════════════════════
   Prueba completa del inventario

     node inventario/prueba.js

   Levanta el servidor en el puerto 3999 con una base TEMPORAL (no toca la
   de verdad), recorre lo que hace cada rol y verifica que las reglas se
   cumplan aunque se arme el pedido a mano. Al terminar borra todo.

   Correrla después de cualquier cambio en operaciones.js o servidor.js.
   ══════════════════════════════════════════════════════════════════════ */

const assert = require('assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const PUERTO = 3999;
const BASE = 'http://127.0.0.1:' + PUERTO;
const DATOS = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-prueba-'));

/* ⚠️ La "tienda web" de la prueba también es de mentira. Sin INV_CATALOGO
   el servidor tomaría el del .env, que apunta a la tienda de verdad, y le
   dejaría el stock de la prueba al lado del catálogo real. */
const WEB = path.join(DATOS, 'web');
const CATALOGO = path.join(WEB, 'productos.json');
const STOCK_WEB = path.join(WEB, 'stock-inventario.json');
const catalogoInicial = [
  { id: 1, name: 'Sartén antiadherente 28cm', cat: 'Cocina', price: 145, precioAntes: 190, stock: 12,
    variantes: { nombre: 'Tamaño', opciones: [{ label: '24 cm', delta: -25 }, { label: '28 cm', delta: 0 }, { label: '32 cm', delta: 40 }] } },
  { id: 2, name: 'Juego de ollas 7 piezas', cat: 'Cocina', price: 520, precioAntes: 0, stock: 6 },
  { id: 3, name: 'Zimba', cat: 'Hogar', price: 10, stock: 100 },
  { id: 4, name: 'Cocacola', cat: 'Bebidas', price: 10.5, stock: 100 }
];
function escribirCatalogo(productos){
  fs.mkdirSync(WEB, { recursive: true });
  fs.writeFileSync(CATALOGO, JSON.stringify({ tienda: {}, productos }, null, 2), 'utf8');
}
const stockEnLaWeb = () => JSON.parse(fs.readFileSync(STOCK_WEB, 'utf8'));

let pasos = 0;
function ok(nombre){ pasos++; console.log('  ✔ ' + nombre); }

/* Un "navegador" mínimo: guarda su cookie como lo haría uno de verdad. */
function cliente(){
  let cookie = '';
  async function pedir(metodo, ruta, cuerpo, extra = {}){
    const r = await fetch(BASE + ruta, {
      method: metodo,
      headers: Object.assign(
        cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {},
        cookie ? { Cookie: cookie } : {}, extra),
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined
    });
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const tipo = r.headers.get('content-type') || '';
    const datos = tipo.includes('json') ? await r.json() : await r.text();
    return { estado: r.status, datos, cabeceras: r.headers };
  }
  return {
    get: (ruta, extra) => pedir('GET', ruta, undefined, extra),
    post: (ruta, cuerpo, extra) => pedir('POST', ruta, cuerpo, extra),
    cookie: () => cookie,
    ponerCookie: c => { cookie = c; }
  };
}

async function esperarServidor(){
  for (let i = 0; i < 50; i++){
    try { await fetch(BASE + '/api/estado'); return; } catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('El servidor no arrancó');
}

async function main(){
  escribirCatalogo(catalogoInicial);
  const proceso = spawn(process.execPath, [path.join(__dirname, 'servidor.js')], {
    env: Object.assign({}, process.env, { INV_PUERTO: String(PUERTO), INV_DATOS: DATOS, TRAS_PROXY: '0',
                                         INV_CATALOGO: CATALOGO, INV_TIENDA_WEB: 'ivirgarzama',
                                         /* la prueba es del sistema con el freno puesto, diga lo que diga el .env */
                                         INV_FRENO_INTENTOS: '1' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let salida = '';
  proceso.stdout.on('data', c => { salida += c; });
  proceso.stderr.on('data', c => { salida += c; });

  try {
    await esperarServidor();
    const dueno = cliente(), ana = cliente(), extrano = cliente();

    /* ── primera vez ── */
    let r = await extrano.get('/api/estado');
    assert.equal(r.datos.configurado, false);
    ok('arranca sin configurar');

    const copias = fs.readdirSync(path.join(DATOS, 'respaldos'));
    assert.equal(copias.length, 1);
    assert.match(copias[0], /^inventario-\d{4}-\d{2}-\d{2}\.db$/);
    const respaldo = new DatabaseSync(path.join(DATOS, 'respaldos', copias[0]), { readOnly: true });
    assert.equal(respaldo.prepare('SELECT COUNT(*) AS n FROM tiendas').get().n, 3);
    respaldo.close();
    ok('al arrancar deja una copia de seguridad, y la copia se puede abrir');

    r = await extrano.post('/api/configurar', { nombre: 'Don Julio', usuario: 'julio', clave: 'x' }, { 'CF-Connecting-IP': '8.8.8.8' });
    assert.equal(r.estado, 403);
    ok('nadie de internet (vía túnel) puede crear la cuenta del dueño');

    r = await dueno.post('/api/configurar', { nombre: 'Don Julio', usuario: 'julio', clave: 'corta' });
    assert.equal(r.estado, 400);
    r = await dueno.post('/api/configurar', { nombre: 'Don Julio', usuario: 'julio', clave: 'Mango-Canasta-7' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.ok(dueno.cookie());
    ok('crea la cuenta del dueño (y rechaza una clave corta)');

    r = await extrano.post('/api/configurar', { nombre: 'Otro', usuario: 'otro', clave: 'Mango-Canasta-7' });
    assert.equal(r.estado, 409);
    ok('la configuración inicial no se puede repetir');

    r = await dueno.get('/api/yo');
    assert.equal(r.datos.usuario.rol, 'dueno');
    assert.deepEqual(r.datos.tiendas.map(t => t.nombre), ['Ivirgarzama', 'Chimoré', 'Entre Ríos']);
    const [IVI, CHI, ENT] = r.datos.tiendas.map(t => t.id);
    assert.equal(r.datos.tiendaWeb, IVI);
    ok('las tres tiendas están cargadas');

    /* ── la tienda web manda en productos y precios ── */
    r = await dueno.get('/api/productos');
    assert.deepEqual(r.datos.map(p => p.catalogo_id).sort(), [1, 2, 3, 4]);
    const delaWeb = id => r.datos.find(p => p.catalogo_id === id);
    assert.equal(delaWeb(1).precio, 14500);
    assert.equal(delaWeb(1).precio_antes, 19000);
    assert.equal(delaWeb(2).precio_antes, null, 'en la web, 0 quiere decir "sin oferta"');
    assert.equal(delaWeb(4).precio, 1050);
    ok('al arrancar ya tiene los 4 productos de la web, sin tocar ningún botón');

    r = await dueno.post('/api/productos/importar', {});
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.nuevos, 0);
    assert.equal(r.datos.iguales, 4);
    ok('sincronizar otra vez no duplica nada');

    r = await dueno.get('/api/productos');
    const ZIMBA = delaWeb(3).id, SARTEN = delaWeb(1).id, OLLAS = delaWeb(2).id;
    r = await dueno.post('/api/productos', { id: ZIMBA, nombre: 'Otro nombre', precio: 1, codigo: '7790003000033', costo: '6', stock_minimo: 2 });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    r = await dueno.get('/api/productos');
    assert.equal(delaWeb(3).nombre, 'Zimba');
    assert.equal(delaWeb(3).precio, 1000, 'el precio de un producto de la web no se cambia desde acá');
    assert.equal(delaWeb(3).codigo, '7790003000033');
    assert.equal(delaWeb(3).costo, 600);
    ok('a un producto de la web se le carga código y costo, pero el nombre y el precio no se tocan');

    /* cargado a mano acá ANTES de que exista en la web */
    r = await dueno.post('/api/productos', { nombre: 'Platos hondos', precio: 50, codigo: '7790005000055' });
    const PLATOS = r.datos.id;
    escribirCatalogo([
      catalogoInicial[0],                                              // la sartén sigue igual
      { id: 3, name: 'Zimba', cat: 'Hogar', price: 12, stock: 100 },   // subió de 10 a 12
      catalogoInicial[3],
      { id: 5, name: 'platos HONDOS', cat: 'Cocina', price: 55, stock: 3 },   // el mismo, con otras mayúsculas
      { id: 6, name: 'Mal cargado', cat: 'Cocina', price: 'gratis' }
    ]);                                                                // y las ollas (id 2) se borraron
    r = await dueno.get('/api/productos');
    assert.equal(delaWeb(3).precio, 1200);
    assert.equal(delaWeb(3).codigo, '7790003000033', 'sincronizar no pisa lo que se cargó acá');
    assert.equal(delaWeb(5).id, PLATOS, 'se vincula con el que ya estaba en vez de duplicarlo');
    assert.equal(delaWeb(5).precio, 5500);
    assert.equal(delaWeb(5).codigo, '7790005000055');
    assert.equal(r.datos.filter(p => /platos hondos/i.test(p.nombre)).length, 1);
    const ollas = r.datos.find(p => p.id === OLLAS);
    assert.equal(ollas.catalogo_id, null);
    assert.equal(ollas.activo, 1, 'lo que se borra de la web acá queda: puede haber mercadería');
    assert.equal(delaWeb(6), undefined);
    ok('un cambio en el panel de la web llega solo: precio nuevo, producto vinculado por nombre, borrado desvinculado');

    /* ── el inventario manda en el stock ── */
    assert.deepEqual(stockEnLaWeb().stock, {}, 'nada se contó todavía: la web sigue con sus números');
    assert.equal(stockEnLaWeb().tienda, 'Ivirgarzama');
    await dueno.post('/api/stock', { tienda_id: IVI, items: [{ producto_id: ZIMBA, cantidad: 7 }] });
    await dueno.post('/api/stock', { tienda_id: ENT, items: [{ producto_id: SARTEN, cantidad: 4 }] });
    assert.deepEqual(stockEnLaWeb().stock, { 3: 7 }, 'solo lo de Ivirgarzama; la sartén está en Entre Ríos');
    r = await dueno.post('/api/ventas', { tienda_id: IVI, pago: 'efectivo', items: [{ producto_id: ZIMBA, cantidad: 2 }] });
    assert.deepEqual(stockEnLaWeb().stock, { 3: 5 });
    await dueno.post('/api/ventas/anular', { id: r.datos.id, motivo: 'prueba de la web' });
    assert.deepEqual(stockEnLaWeb().stock, { 3: 7 });
    await dueno.post('/api/ventas', { tienda_id: IVI, pago: 'qr', confirmar_sin_stock: true, items: [{ producto_id: ZIMBA, cantidad: 9 }] });
    assert.deepEqual(stockEnLaWeb().stock, { 3: 0 }, 'el sistema quedó en -2: a la web le llega 0, no un número negativo');
    await dueno.post('/api/entradas', { tienda_id: IVI, items: [{ producto_id: ZIMBA, cantidad: 12 }] });
    assert.deepEqual(stockEnLaWeb().stock, { 3: 10 });
    ok('cada venta, anulación y entrada de Ivirgarzama le llega a la web en el momento');

    r = await dueno.post('/api/productos', { nombre: 'Foco LED 9W', categoria: 'Hogar', codigo: '7790001000011',
                                             precio: '5,50', precio_antes: '8', costo: '3', stock_minimo: 4 });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    const FOCO = r.datos.id;
    r = await dueno.post('/api/productos', { nombre: 'Pilas AA x4', codigo: '7790001000028', precio: 12 });
    const PILAS = r.datos.id;
    r = await dueno.post('/api/productos', { nombre: 'Copia', codigo: '7790001000011', precio: 1 });
    assert.equal(r.estado, 409);
    r = await dueno.post('/api/productos', { nombre: 'Mal', precio: 10, precio_antes: 9 });
    assert.equal(r.estado, 400);
    ok('crea productos, no repite códigos de barras y valida la oferta');

    r = await dueno.get('/api/productos');
    const foco = r.datos.find(p => p.id === FOCO);
    assert.equal(foco.precio, 550);
    assert.equal(foco.costo, 300);
    ok('los precios se guardan en centavos (5,50 → 550)');

    /* ── vendedora ── */
    r = await dueno.post('/api/usuarios', { nombre: 'Ana', usuario: 'ana', clave: 'Chimore-2026', rol: 'vendedor', tienda_id: CHI });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    const ANA = r.datos.id;
    r = await dueno.post('/api/usuarios', { nombre: 'Ana 2', usuario: 'ANA', clave: 'Chimore-2026', rol: 'vendedor', tienda_id: CHI });
    assert.equal(r.estado, 409);
    ok('alta de vendedora en Chimoré (y el usuario no se repite)');

    /* ── conteo inicial ── */
    r = await dueno.post('/api/stock', { tienda_id: CHI, items: [{ producto_id: FOCO, cantidad: 10 }, { producto_id: PILAS, cantidad: 3 }] });
    assert.equal(r.datos.iniciales, 2);
    r = await dueno.post('/api/stock', { tienda_id: CHI, items: [{ producto_id: PILAS, cantidad: 5 }] });
    assert.equal(r.estado, 400, 'un ajuste sin motivo tiene que fallar');
    r = await dueno.post('/api/stock', { tienda_id: CHI, items: [{ producto_id: PILAS, cantidad: 5 }], nota: 'Recuento' });
    assert.equal(r.datos.ajustes, 1);
    assert.equal(r.datos.cambios[0].diferencia, 2);
    ok('conteo inicial sin motivo; corrección posterior solo con motivo');

    /* ── entrar ── */
    r = await ana.post('/api/login', { usuario: 'ana', clave: 'equivocada' });
    assert.equal(r.estado, 401);
    assert.equal(r.datos.quedan, 5);
    r = await ana.post('/api/login', { usuario: 'ANA', clave: 'Chimore-2026' });
    assert.equal(r.estado, 200);
    assert.match(r.cabeceras.get('set-cookie'), /Max-Age=43200/);
    ok('la vendedora entra (la sesión le dura 12 horas, un turno)');

    r = await ana.get('/api/productos');
    const focoAna = r.datos.find(p => p.id === FOCO);
    assert.equal(focoAna.stock, 10);
    assert.equal(focoAna.costo, undefined);
    assert.equal(focoAna.stock_tiendas, undefined);
    ok('la vendedora ve el stock de SU tienda y no ve el costo');

    /* ── permisos ── */
    for (const [metodo, ruta, cuerpo] of [
      ['get', '/api/usuarios'], ['get', '/api/resumen'], ['get', '/api/movimientos'],
      ['post', '/api/stock', { tienda_id: CHI, items: [{ producto_id: FOCO, cantidad: 99 }], nota: 'x' }],
      ['post', '/api/productos', { nombre: 'Trucho', precio: 1 }],
      ['post', '/api/productos/importar', {}],
      ['post', '/api/usuarios', { nombre: 'Yo', usuario: 'yo', clave: '12345678', rol: 'dueno' }]
    ]){
      r = await ana[metodo](ruta, cuerpo);
      assert.equal(r.estado, 403, metodo + ' ' + ruta + ' tendría que dar 403 y dio ' + r.estado);
    }
    ok('la vendedora no puede ver resúmenes, ni corregir stock, ni tocar precios ni usuarios');

    /* ── vender ── */
    r = await ana.post('/api/ventas', { tienda_id: IVI, pago: 'efectivo', items: [{ producto_id: FOCO, cantidad: 1 }] });
    assert.equal(r.estado, 403);
    ok('la vendedora no puede vender a nombre de otra tienda');

    r = await ana.post('/api/ventas', { pago: 'efectivo', total: 1, items: [{ producto_id: FOCO, cantidad: 2, precio: 1 }] });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.total, 1100, 'el precio tiene que salir de la base, no del pedido');
    assert.equal(r.datos.tienda_id, CHI);
    const VENTA1 = r.datos.id;
    ok('vende 2 focos a Bs 11 aunque el pedido diga "precio: 1"');

    /* hay 5 pilas y quiere vender 7 */
    r = await ana.post('/api/ventas', { pago: 'qr', items: [{ producto_id: PILAS, cantidad: 7 }, { producto_id: FOCO, cantidad: 1 }] });
    assert.equal(r.estado, 409);
    assert.deepEqual(r.datos.sinStock, [{ producto_id: PILAS, nombre: 'Pilas AA x4', hay: 5, pide: 7 }]);
    r = await ana.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === PILAS).stock, 5, 'la venta frenada no movió nada');
    r = await ana.post('/api/ventas', { pago: 'qr', confirmar_sin_stock: 'si', items: [{ producto_id: PILAS, cantidad: 7 }] });
    assert.equal(r.estado, 409, 'la confirmación tiene que ser un true de verdad');
    r = await ana.post('/api/ventas', { pago: 'qr', confirmar_sin_stock: true, items: [{ producto_id: PILAS, cantidad: 7 }] });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.avisos.length, 1);
    ok('sin stock no vende por descuido: pide confirmar, y confirmando vende y avisa (pilas quedan en -2)');

    r = await ana.post('/api/ventas', { pago: 'tarjeta', items: [{ producto_id: FOCO, cantidad: 1 }] });
    assert.equal(r.estado, 400);
    r = await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: FOCO, cantidad: 0 }] });
    assert.equal(r.estado, 400);
    r = await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: FOCO, cantidad: 1.5 }] });
    assert.equal(r.estado, 400);
    ok('rechaza formas de pago inventadas y cantidades raras');

    /* ── anular ── */
    r = await ana.post('/api/ventas/anular', { id: VENTA1, motivo: '' });
    assert.equal(r.estado, 400);
    r = await ana.post('/api/ventas/anular', { id: VENTA1, motivo: 'Se equivocó de producto' });
    assert.equal(r.estado, 200);
    r = await ana.post('/api/ventas/anular', { id: VENTA1, motivo: 'otra vez' });
    assert.equal(r.estado, 409);
    ok('anula su venta con motivo, y no se puede anular dos veces');

    r = await ana.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === FOCO).stock, 10);
    ok('al anular, los focos vuelven al stock (10)');

    /* ── entrada ── */
    r = await ana.post('/api/entradas', { nota: 'Proveedor Cochabamba', items: [{ producto_id: PILAS, cantidad: 12 }] });
    assert.equal(r.datos.unidades, 12);
    r = await ana.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === PILAS).stock, 10);
    ok('registra la mercadería que llegó (pilas: -2 + 12 = 10)');

    r = await ana.get('/api/ventas');
    assert.equal(r.datos.length, 2);
    assert.ok(r.datos.every(v => Array.isArray(v.items)));
    ok('la vendedora ve las ventas de hoy de su tienda');

    /* ── lo que ve el dueño ── */
    r = await dueno.get('/api/resumen');
    const chimore = r.datos.porTienda.find(t => t.tienda_id === CHI);
    assert.equal(chimore.ventas, 1);
    assert.equal(chimore.total, 8400);         // 7 pilas × Bs 12
    assert.equal(chimore.qr, 8400);
    assert.equal(chimore.anuladas, 1);
    assert.equal(chimore.sin_costo, 7);        // las pilas no tienen costo cargado
    assert.equal(r.datos.alertas.anulaciones.length, 2);   // la de Ana y la de la prueba de la web, más arriba
    assert.equal(r.datos.alertas.anulaciones[0].motivo_anulacion, 'Se equivocó de producto');
    assert.equal(r.datos.alertas.ajustes.length, 1);
    /* el foco avisa a las 4 unidades: en Chimoré hay 10, y en las otras dos
       tiendas nunca estuvo */
    assert.equal(r.datos.alertas.bajos.length, 0);
    ok('el resumen del dueño cuadra: Bs 84 por QR, 1 anulación con su motivo, 1 ajuste');

    r = await dueno.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === FOCO).stock_tiendas[CHI], 10);
    r = await dueno.get('/api/movimientos?tienda=' + CHI);
    assert.deepEqual(r.datos.map(m => m.tipo).sort(),
      ['ajuste', 'anulacion', 'entrada', 'inicial', 'inicial', 'venta', 'venta'].sort());
    ok('el historial tiene cada movimiento, con quién lo hizo');

    /* ── stock bajo: solo donde el producto estuvo ── */
    r = await dueno.post('/api/productos', { nombre: 'Cable USB', precio: 20, stock_minimo: 5 });
    const CABLE = r.datos.id;
    await dueno.post('/api/stock', { tienda_id: CHI, items: [{ producto_id: CABLE, cantidad: 3 }] });
    r = await dueno.get('/api/resumen');
    assert.deepEqual(r.datos.alertas.bajos.map(b => b.tienda + ':' + b.stock), ['Chimoré:3']);
    ok('avisa "stock bajo" en la tienda que lo tiene, no en las que nunca lo tuvieron');

    /* ── el total que se le dijo al cliente ── */
    r = await ana.post('/api/ventas', { pago: 'efectivo', total_esperado: 1000, items: [{ producto_id: CABLE, cantidad: 1 }] });
    assert.equal(r.estado, 409);
    r = await ana.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === CABLE).stock, 3, 'una venta frenada no mueve el stock');
    ok('si la pantalla mostró otro total (cambió un precio), frena en vez de cobrar distinto');

    /* ── el mismo cobro, dos veces ── */
    const cobro = { pago: 'efectivo', clave: 'cobro-de-prueba-0001', total_esperado: 2000,
                    items: [{ producto_id: CABLE, cantidad: 1 }] };
    r = await ana.post('/api/ventas', cobro);
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    const VENTA_CABLE = r.datos.id;
    r = await ana.post('/api/ventas', cobro);
    assert.equal(r.estado, 200);
    assert.equal(r.datos.id, VENTA_CABLE);
    assert.equal(r.datos.repetida, true);
    r = await ana.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === CABLE).stock, 2, 'se tiene que descontar una sola vez');
    r = await dueno.post('/api/ventas', Object.assign({ tienda_id: CHI }, cobro));
    assert.equal(r.estado, 409);
    r = await ana.post('/api/ventas', Object.assign({}, cobro, { clave: 'x' }));
    assert.equal(r.estado, 400);
    ok('el mismo cobro mandado dos veces (se cortó internet) queda como UNA venta');

    /* ── cierre de caja: cada una cierra lo suyo ── */
    r = await ana.get('/api/caja');
    assert.equal(r.datos.mia.ventas, 2);                 // las pilas por QR y el cable en efectivo
    assert.equal(r.datos.mia.qr, 8400);
    assert.equal(r.datos.mia.efectivo, undefined, 'a la vendedora no se le dice cuánta plata tiene que haber');
    assert.equal(r.datos.pendientes, undefined);
    ok('la vendedora ve cuántas ventas tiene sin cerrar, pero no cuánto efectivo debería haber');

    r = await ana.post('/api/caja/cerrar', { contado: '15' });
    assert.equal(r.estado, 409);
    assert.match(r.datos.error, /faltan Bs 5,00/);
    r = await ana.post('/api/caja/cerrar', { contado: '20' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.diferencia, 0);
    r = await ana.post('/api/caja/cerrar', { contado: '0' });
    assert.equal(r.estado, 409, 'sin ventas nuevas no hay nada que cerrar');
    ok('si la plata no coincide pide contar de nuevo; si coincide, cierra; y no se cierra dos veces lo mismo');

    await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: CABLE, cantidad: 1 }] });
    r = await ana.post('/api/caja/cerrar', { contado: '18', nota: 'Di mal un vuelto' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.efectivo, 2000, 'el segundo cierre cuenta solo lo cobrado después del primero');
    assert.equal(r.datos.diferencia, -200);
    r = await ana.get('/api/caja');
    assert.equal(r.datos.cierres.length, 2);
    assert.equal(r.datos.mia.ventas, 0);
    r = await dueno.get('/api/resumen');
    assert.equal(r.datos.alertas.cierres.length, 1);
    assert.equal(r.datos.alertas.cierres[0].diferencia, -200);
    assert.equal(r.datos.alertas.cierres[0].nota, 'Di mal un vuelto');
    ok('con nota se puede cerrar aunque falte plata, y al dueño le salta la alerta con el motivo');

    r = await dueno.get('/api/caja?tienda=' + IVI);
    assert.equal(r.datos.mia.efectivo, 0);               // lo del dueño en Ivirgarzama fue por QR
    assert.deepEqual(r.datos.pendientes.map(p => p.usuario + '/' + p.tienda), ['Don Julio/Ivirgarzama']);
    assert.equal(r.datos.cierres.length, 2);
    ok('el dueño ve los cierres de todos y quién tiene ventas sin cerrar');

    /* ── reportes ── */
    const hoy = (await dueno.get('/api/yo')).datos.inicioDelDia;
    r = await ana.get('/api/reporte?desde=' + hoy + '&hasta=' + (hoy + 86400000));
    assert.equal(r.estado, 403);
    r = await dueno.get('/api/reporte?desde=' + hoy + '&hasta=' + (hoy + 86400000));
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.totales.ventas, 4);             // 1 del dueño + 3 de Ana
    assert.equal(r.datos.totales.total, 10800 + 8400 + 2000 + 2000);
    assert.equal(r.datos.totales.efectivo, 4000);
    assert.equal(r.datos.totales.anuladas, 2);
    assert.equal(r.datos.porDia.length, 1);
    assert.equal(r.datos.porDia[0].fecha, hoy);
    assert.equal(r.datos.porDia[0].total, r.datos.totales.total);
    assert.deepEqual(r.datos.porVendedor.map(v => v.vendedor + ':' + v.total), ['Ana:12400', 'Don Julio:10800']);
    assert.deepEqual(r.datos.porTienda.map(v => v.tienda + ':' + v.ventas), ['Chimoré:3', 'Ivirgarzama:1']);
    assert.equal(r.datos.porProducto.find(p => p.producto === 'Cable USB').unidades, 2);
    assert.deepEqual(r.datos.cajas, { cierres: 2, con_diferencia: 1, faltante: 200, sobrante: 0, gastos: 0, retiros: 0 });
    r = await dueno.get('/api/reporte?desde=' + hoy + '&hasta=' + (hoy + 86400000) + '&tienda=' + IVI);
    assert.equal(r.datos.totales.total, 10800);
    r = await dueno.get('/api/reporte?desde=' + (hoy - 86400000) + '&hasta=' + hoy);
    assert.equal(r.datos.totales.ventas, 0);
    assert.equal(r.datos.porDia.length, 0);
    ok('el reporte del período cuadra por día, por tienda, por persona y por producto');

    /* ── variantes: la sartén de 32 cm vale Bs 40 más ── */
    r = await ana.get('/api/productos');
    assert.deepEqual(r.datos.find(p => p.id === SARTEN).variantes.opciones.map(o => o.label + ':' + o.delta), ['24 cm:-2500', '28 cm:0', '32 cm:4000']);
    await dueno.post('/api/stock', { tienda_id: CHI, items: [{ producto_id: SARTEN, cantidad: 6 }] });
    r = await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: SARTEN, cantidad: 1 }] });
    assert.equal(r.estado, 409, 'sin decir el tamaño no se puede cobrar');
    r = await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: SARTEN, cantidad: 1, variante: '40 cm' }] });
    assert.equal(r.estado, 409);
    r = await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: FOCO, cantidad: 1, variante: 'rojo' }] });
    assert.equal(r.estado, 409, 'un producto sin opciones no acepta una inventada');
    r = await ana.post('/api/ventas', { pago: 'qr', items: [{ producto_id: SARTEN, cantidad: 1, variante: '32 cm' },
                                                            { producto_id: SARTEN, cantidad: 2, variante: '24 cm' }] });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.total, 18500 + 2 * 12000);
    r = await ana.get('/api/ventas');
    assert.deepEqual(r.datos[0].items.map(i => i.variante + ' x' + i.cantidad + ' a ' + i.precio_unit).sort(), ['24 cm x2 a 12000', '32 cm x1 a 18500']);
    r = await ana.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === SARTEN).stock, 3, 'el stock es del producto entero: 6 - 3');
    r = await ana.post('/api/ventas', { pago: 'qr', items: [{ producto_id: SARTEN, cantidad: 2, variante: '32 cm' }, { producto_id: SARTEN, cantidad: 2, variante: '24 cm' }] });
    assert.equal(r.estado, 409);
    assert.equal(r.datos.sinStock[0].pide, 4, 'para el stock se suman las opciones del mismo producto');
    ok('cada opción se cobra a su precio (32 cm a Bs 185) y el stock sigue siendo del producto');

    /* ── la plata que sale por anular una venta que ya estaba cerrada ── */
    r = await ana.get('/api/ventas');
    const cableCerrado = r.datos.find(v => !v.anulada && v.pago === 'efectivo' && v.items.some(i => i.producto_id === CABLE));
    r = await ana.post('/api/ventas/anular', { id: cableCerrado.id, motivo: 'Lo devolvió' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    r = await ana.get('/api/caja');
    assert.equal(r.datos.mia.devoluciones, 2000);
    await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: FOCO, cantidad: 4 }] });   // 4 × 5,50 = 22
    r = await ana.post('/api/caja/cerrar', { contado: '22' });
    assert.equal(r.estado, 409, 'cobró 22 pero devolvió 20: en la caja tiene que haber 2');
    r = await ana.post('/api/caja/cerrar', { contado: '2' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.devoluciones, 2000);
    assert.equal(r.datos.diferencia, 0);
    ok('anular una venta ya cerrada resta de la caja siguiente: ya no desaparece');

    /* ── el dueño cierra la caja de otra persona ── */
    await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: FOCO, cantidad: 2 }] });
    r = await ana.post('/api/caja/cerrar', { usuario_id: 1, tienda_id: IVI, contado: '0' });
    assert.equal(r.estado, 403, 'una vendedora no cierra la caja de otro');
    r = await dueno.post('/api/caja/cerrar', { usuario_id: ANA, tienda_id: CHI, contado: '11' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    r = await ana.get('/api/caja');
    assert.equal(r.datos.mia.ventas, 0);
    assert.equal(r.datos.cierres[0].cerrado_por, 'Don Julio');
    ok('el dueño puede cerrar la caja de una vendedora, y queda anotado que fue él');

    r = await dueno.get('/api/resumen');
    assert.ok(r.datos.alertas.entradas.some(e => e.usuario === 'Ana' && e.tienda === 'Chimoré' && e.unidades === 12));
    ok('la mercadería que anotó una vendedora le aparece al dueño en las alertas');

    /* ── gastos y retiros: plata que sale de la caja ── */
    await ana.post('/api/ventas', { pago: 'efectivo', items: [{ producto_id: FOCO, cantidad: 2 }] });   // Bs 11
    r = await ana.post('/api/gastos', { tipo: 'gasto', monto: '0', motivo: 'nada' });
    assert.equal(r.estado, 400);
    r = await ana.post('/api/gastos', { tipo: 'gasto', monto: '4', motivo: '' });
    assert.equal(r.estado, 400, 'sin motivo no se anota');
    r = await ana.post('/api/gastos', { tipo: 'gasto', monto: '4', motivo: 'Flete del mototaxi' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    r = await ana.post('/api/gastos', { tipo: 'retiro', monto: '5', motivo: 'Se llevó Don Julio' });
    assert.equal(r.estado, 200);
    r = await ana.get('/api/caja');
    assert.equal(r.datos.mia.gastos, 900);
    assert.equal(r.datos.mia.listaGastos.length, 2);
    r = await ana.post('/api/caja/cerrar', { contado: '11' });
    assert.equal(r.estado, 409, 'cobró 11 pero salieron 9: tiene que haber 2');
    r = await ana.post('/api/caja/cerrar', { contado: '2' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    assert.equal(r.datos.gastos, 900);
    assert.equal(r.datos.diferencia, 0);
    r = await dueno.get('/api/resumen');
    assert.deepEqual(r.datos.alertas.gastos.map(g => g.tipo + ':' + g.monto + ':' + g.usuario).sort(), ['gasto:400:Ana', 'retiro:500:Ana']);
    r = await dueno.get('/api/reporte?desde=' + hoy + '&hasta=' + (hoy + 86400000));
    assert.equal(r.datos.cajas.gastos, 400);
    assert.equal(r.datos.cajas.retiros, 500);
    ok('un gasto o un retiro se descuenta de la caja, y el dueño ve cada uno con su motivo');

    /* ── pasar mercadería de una tienda a otra ── */
    r = await dueno.get('/api/productos');
    const focoAntes = r.datos.find(p => p.id === FOCO).stock_tiendas;
    r = await ana.post('/api/transferencias', { origen: CHI, destino: IVI, items: [{ producto_id: FOCO, cantidad: 1 }] });
    assert.equal(r.estado, 403, 'los traspasos son cosa del dueño');
    r = await dueno.post('/api/transferencias', { origen: CHI, destino: CHI, items: [{ producto_id: FOCO, cantidad: 1 }] });
    assert.equal(r.estado, 400);
    r = await dueno.post('/api/transferencias', { origen: CHI, destino: ENT, items: [{ producto_id: FOCO, cantidad: 999 }] });
    assert.equal(r.estado, 409, 'no se manda más de lo que hay');
    r = await dueno.post('/api/transferencias', { origen: CHI, destino: ENT, nota: 'Pedido de la semana', items: [{ producto_id: FOCO, cantidad: 2 }] });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    r = await dueno.get('/api/productos');
    const focoDespues = r.datos.find(p => p.id === FOCO).stock_tiendas;
    assert.equal(focoDespues[CHI], focoAntes[CHI] - 2);
    assert.equal(focoDespues[ENT], (focoAntes[ENT] || 0) + 2);
    r = await dueno.get('/api/movimientos?tipo=transferencia');
    assert.deepEqual(r.datos.map(m => m.tienda + ':' + m.cantidad).sort(), ['Chimoré:-2', 'Entre Ríos:2']);
    assert.match(r.datos[0].nota, /Pedido de la semana/);
    r = await dueno.get('/api/resumen');
    assert.equal(r.datos.alertas.ajustes.length, 1, 'un traspaso no es un ajuste: no agrega alertas');
    ok('un traspaso baja en una tienda y sube en la otra, sin pasar por "ajuste"');

    /* ── cada uno cambia su clave ── */
    r = await ana.post('/api/mi-clave', { actual: 'no-es-esta', nueva: 'Otra-Clave-2026' });
    assert.equal(r.estado, 403);
    r = await ana.post('/api/mi-clave', { actual: 'Chimore-2026', nueva: 'corta' });
    assert.equal(r.estado, 400);
    r = await ana.post('/api/mi-clave', { actual: 'Chimore-2026', nueva: 'Otra-Clave-2026' });
    assert.equal(r.estado, 200, JSON.stringify(r.datos));
    r = await ana.get('/api/yo');
    assert.equal(r.estado, 200, 'sigue adentro después de cambiarla');
    const otra = cliente();
    r = await otra.post('/api/login', { usuario: 'ana', clave: 'Chimore-2026' });
    assert.equal(r.estado, 401, 'la clave vieja ya no entra');
    r = await ana.post('/api/mi-clave', { actual: 'Otra-Clave-2026', nueva: 'Chimore-2026' });
    assert.equal(r.estado, 200);
    ok('la vendedora se cambia su propia clave sabiendo la actual');

    /* ── la base no deja borrar el rastro ── */
    const base = new DatabaseSync(path.join(DATOS, 'inventario.db'));
    assert.throws(() => base.exec('UPDATE movimientos SET cantidad = 100'), /no se modifican/);
    assert.throws(() => base.exec('DELETE FROM movimientos'), /no se borran/);
    assert.throws(() => base.exec('DELETE FROM ventas'), /no se borran/);
    assert.throws(() => base.exec('UPDATE ventas SET total = 1'), /solo se puede registrar su anulación/);
    assert.throws(() => base.exec('UPDATE venta_items SET precio_unit = 1'), /no se modifica/);
    assert.throws(() => base.exec('UPDATE cierres SET diferencia = 0'), /no se modifica/);
    assert.throws(() => base.exec('DELETE FROM cierres'), /no se borra/);
    base.close();
    ok('la propia base rechaza editar o borrar ventas y movimientos');

    /* ── una base de la versión anterior (ventas sin la columna "clave") ── */
    const carpetaVieja = path.join(DATOS, 'version-1');
    fs.mkdirSync(carpetaVieja);
    const vieja = new DatabaseSync(path.join(carpetaVieja, 'inventario.db'));
    vieja.exec(`CREATE TABLE ventas(id INTEGER PRIMARY KEY, tienda_id INTEGER NOT NULL, usuario_id INTEGER NOT NULL,
                  fecha INTEGER NOT NULL, total INTEGER NOT NULL, pago TEXT NOT NULL,
                  anulada INTEGER NOT NULL DEFAULT 0, anulada_por INTEGER, anulada_fecha INTEGER, motivo_anulacion TEXT);
                INSERT INTO ventas(tienda_id, usuario_id, fecha, total, pago) VALUES (1, 1, 1, 500, 'efectivo');
                PRAGMA user_version = 1;`);
    vieja.close();
    const alDia = require('./db').abrir(carpetaVieja);
    assert.ok(alDia.prepare('PRAGMA table_info(ventas)').all().some(c => c.name === 'clave'));
    assert.equal(alDia.prepare('PRAGMA user_version').get().user_version, 5);
    assert.equal(alDia.prepare('SELECT total FROM ventas').get().total, 500);
    alDia.close();
    ok('una base de la versión anterior se pone al día sola, sin perder las ventas');

    /* ── sesiones ── */
    const cookieVieja = ana.cookie();
    r = await ana.post('/api/salir', {});
    const copia = cliente(); copia.ponerCookie(cookieVieja);
    r = await copia.get('/api/yo');
    assert.equal(r.estado, 401);
    r = await dueno.get('/api/yo');
    assert.equal(r.estado, 200);
    ok('al salir, la cookie copiada deja de servir, y el dueño sigue adentro');

    await ana.post('/api/login', { usuario: 'ana', clave: 'Chimore-2026' });
    r = await dueno.post('/api/usuarios', { id: ANA, nombre: 'Ana', rol: 'vendedor', tienda_id: CHI, activo: false });
    assert.equal(r.estado, 200);
    r = await ana.get('/api/yo');
    assert.equal(r.estado, 401);
    r = await ana.post('/api/login', { usuario: 'ana', clave: 'Chimore-2026' });
    assert.equal(r.estado, 401);
    ok('dar de baja a una vendedora la saca en el momento');

    r = await dueno.post('/api/usuarios', { id: 1, nombre: 'Don Julio', rol: 'dueno', activo: false });
    assert.equal(r.estado, 400);
    ok('no se puede dejar el sistema sin dueño');

    r = await dueno.post('/api/usuarios', { id: 1, nombre: 'Don Julio', rol: 'dueno', clave: 'Nueva-Clave-99' });
    assert.equal(r.estado, 200);
    r = await dueno.get('/api/yo');
    assert.equal(r.estado, 200, 'al cambiarse la clave, el dueño sigue adentro');
    ok('el dueño se cambia la clave sin quedar afuera');

    /* ── defensas del servidor ── */
    r = await fetch(BASE + '/api/ventas', { method: 'POST', headers: { Cookie: dueno.cookie(), 'Content-Type': 'text/plain' },
                                            body: JSON.stringify({ pago: 'efectivo', tienda_id: CHI, items: [{ producto_id: FOCO, cantidad: 1 }] }) });
    assert.equal(r.status, 415);
    ok('rechaza pedidos que no son JSON (una web ajena no puede disparar ventas)');

    for (const ruta of ['/inventario.db', '/../data/inventario/inventario.db', '/servidor.js', '/secreto-sesiones', '/%2e%2e/.env']){
      r = await fetch(BASE + ruta);
      assert.equal(r.status, 404, ruta + ' tendría que dar 404 y dio ' + r.status);
    }
    ok('no se puede descargar la base, el código ni el secreto');

    r = await fetch(BASE + '/');
    assert.match(r.headers.get('content-security-policy') || '', /script-src 'self'/);
    ok('la pantalla sale con las cabeceras de seguridad');

    const rApp = await fetch(BASE + '/app.js');
    assert.equal(rApp.status, 200);
    assert.match(rApp.headers.get('content-type') || '', /javascript/);
    const textoApp = await rApp.text();
    assert.ok(textoApp.includes('inicializar'));
    ok('app.js se sirve correctamente');

    const rCss = await fetch(BASE + '/estilos.css');
    assert.equal(rCss.status, 200);
    assert.match(rCss.headers.get('content-type') || '', /text\/css/);
    ok('estilos.css se sirve correctamente');

    for (let i = 0; i < 6; i++) r = await extrano.post('/api/login', { usuario: 'julio', clave: 'mal' + i });
    assert.equal(r.estado, 429);
    ok('después de 6 intentos fallidos, bloquea');

    console.log('\n  Todo bien: ' + pasos + ' comprobaciones.\n');
  } catch (e) {
    console.error('\n  ✗ FALLÓ: ' + e.message + '\n');
    if (salida.trim()) console.error('  ── lo que dijo el servidor ──\n' + salida);
    process.exitCode = 1;
  } finally {
    proceso.kill();
    await new Promise(r => setTimeout(r, 300));
    try { fs.rmSync(DATOS, { recursive: true, force: true }); } catch (e) {}
  }
}

main();
