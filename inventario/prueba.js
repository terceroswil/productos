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
  const proceso = spawn(process.execPath, [path.join(__dirname, 'servidor.js')], {
    env: Object.assign({}, process.env, { INV_PUERTO: String(PUERTO), INV_DATOS: DATOS, TRAS_PROXY: '0' }),
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
    const [IVI, CHI] = r.datos.tiendas.map(t => t.id);
    ok('las tres tiendas están cargadas');

    /* ── productos ── */
    r = await dueno.post('/api/productos/importar', {});
    assert.equal(r.estado, 200);
    assert.ok(r.datos.nuevos >= 1, 'importó del catálogo');
    const importados = r.datos.nuevos;
    r = await dueno.post('/api/productos/importar', {});
    assert.equal(r.datos.nuevos, 0);
    assert.equal(r.datos.yaEstaban, importados);
    ok('importa ' + importados + ' productos de la tienda online, sin duplicar');

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

    r = await ana.post('/api/ventas', { pago: 'qr', items: [{ producto_id: PILAS, cantidad: 7 }] });
    assert.equal(r.estado, 200);
    assert.equal(r.datos.avisos.length, 1);
    ok('vende aunque el sistema no tenga stock, pero avisa (pilas quedan en -2)');

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
    assert.equal(r.datos.alertas.anulaciones.length, 1);
    assert.equal(r.datos.alertas.anulaciones[0].motivo_anulacion, 'Se equivocó de producto');
    assert.equal(r.datos.alertas.ajustes.length, 1);
    ok('el resumen del dueño cuadra: Bs 84 por QR, 1 anulación con su motivo, 1 ajuste');

    r = await dueno.get('/api/productos');
    assert.equal(r.datos.find(p => p.id === FOCO).stock_tiendas[CHI], 10);
    r = await dueno.get('/api/movimientos?tienda=' + CHI);
    assert.deepEqual(r.datos.map(m => m.tipo).sort(),
      ['ajuste', 'anulacion', 'entrada', 'inicial', 'inicial', 'venta', 'venta'].sort());
    ok('el historial tiene cada movimiento, con quién lo hizo');

    /* ── la base no deja borrar el rastro ── */
    const base = new DatabaseSync(path.join(DATOS, 'inventario.db'));
    assert.throws(() => base.exec('UPDATE movimientos SET cantidad = 100'), /no se modifican/);
    assert.throws(() => base.exec('DELETE FROM movimientos'), /no se borran/);
    assert.throws(() => base.exec('DELETE FROM ventas'), /no se borran/);
    assert.throws(() => base.exec('UPDATE ventas SET total = 1'), /solo se puede registrar su anulación/);
    assert.throws(() => base.exec('UPDATE venta_items SET precio_unit = 1'), /no se modifica/);
    base.close();
    ok('la propia base rechaza editar o borrar ventas y movimientos');

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
