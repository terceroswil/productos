/* ══════════════════════════════════════════════════════════════════════
   Inventario — aplicación frontend (app.js)

   Sin frameworks ni dependencias externas.
   Compatible con CSP estricto (sin onclick inline ni eval).
   Adaptado a PC (lector de código USB como teclado) y celular/tablet.
   ══════════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─────────────────────────── Estado global ───────────────────────────
  const estado = {
    yo: null,               // datos del usuario actual
    tiendas: [],           // lista de tiendas [{id, nombre}]
    tiendaActual: null,     // id de la tienda activa en la sesión
    productos: [],          // caché de productos
    carrito: [],            // items para vender [{ p, cantidad }]
    tipoPago: 'efectivo',   // 'efectivo' | 'qr'
    recibirItems: [],       // items para registrar entrada [{ p, cantidad }]
    vistaActiva: '',        // pestaña activa
    conteoModo: false,      // si el formulario de conteo está abierto
    prodEditandoId: null,   // id del producto que se está editando
    usrEditandoId: null,    // id del usuario que se está editando
    minutosParaAnular: 30,  // cuánto tiene el vendedor para anular; lo manda el servidor
    tiendaWeb: null,        // id de la tienda cuyo stock se muestra en la web
    reporte: null,          // el último reporte que se cargó (para bajarlo a Excel)
    traspasoItems: [],      // lo que se está por mandar a otra tienda [{ p, cantidad }]
    claveVenta: null        // identifica ESTE cobro: si llega dos veces, se registra una sola
  };

  // ─────────────────────────── Ayudantes ───────────────────────────
  const $ = id => document.getElementById(id);
  const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function bs(centavos) {
    if (centavos == null || isNaN(centavos)) return 'Bs 0';
    const n = Number(centavos) / 100;
    return 'Bs ' + n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fechaHora(ms) {
    if (!ms) return '';
    const d = new Date(ms);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes} ${hora}:${min}`;
  }

  function mostrarAviso(texto, esError = false) {
    const el = $('aviso');
    el.textContent = texto;
    el.className = 'aviso' + (esError ? ' error' : '');
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* La tienda que eligió el dueño se recuerda en este equipo. Sin esto, cada
     recarga volvía a la primera de la lista y se terminaba vendiendo a
     nombre de otra tienda sin darse cuenta. */
  function leerTiendaGuardada() {
    try { return Number(localStorage.getItem('inv_tienda')) || null; } catch (e) { return null; }
  }
  function guardarTienda(id) {
    try { localStorage.setItem('inv_tienda', String(id)); } catch (e) { /* modo privado: no pasa nada */ }
  }

  /* Pitido corto de error. Quien escanea mira el producto, no la pantalla:
     si el código no existe y nada suena, la mercadería sale sin cobrarse. */
  let audio = null;
  function pitidoDeError() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const vol = audio.createGain();
      osc.type = 'square';
      osc.frequency.value = 220;
      vol.gain.value = 0.15;
      osc.connect(vol).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.25);
    } catch (e) { /* sin sonido en este equipo: queda el aviso en pantalla */ }
  }

  /* opciones.entrada: el pedido es del login o de la comprobación inicial,
     donde un 401 es una respuesta normal y no "se venció la sesión". */
  async function api(ruta, metodo = 'GET', cuerpo = undefined, opciones = {}) {
    const opts = {
      method: metodo,
      headers: {}
    };
    if (cuerpo !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(cuerpo);
    }
    let res;
    try {
      /* ⚠️ Sin la barra de adelante: "api/ventas", no "/api/ventas". El
         inventario cuelga de loscaseritos.com/inventario/, y con barra el
         pedido iría a la raíz del dominio, que es la API de la TIENDA. */
      res = await fetch(ruta.replace(/^\/+/, ''), opts);
    } catch (e) {
      /* sin esto al vendedor le llegaba "Failed to fetch", en inglés */
      const err = new Error('No hay conexión con el sistema. Revise el internet y pruebe de nuevo.');
      err.sinConexion = true;
      throw err;
    }
    let datos = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      datos = await res.json();
    } else {
      datos = await res.text();
    }

    if (!res.ok) {
      if (res.status === 401 && !opciones.entrada) sesionVencida();
      const msg = (datos && datos.error) || (typeof datos === 'string' ? datos : 'Error en el servidor');
      const err = new Error(msg);
      err.estado = res.status;
      err.datos = datos;
      throw err;
    }
    return datos;
  }

  // ─────────────────────────── Navegación y Vistas ───────────────────────────
  const VISTAS_DUENO = [
    { id: 'v-hoy', label: '📊 Hoy' },
    { id: 'v-vender', label: '🛒 Vender' },
    { id: 'v-recibir', label: '📥 Recibir' },
    { id: 'v-ventas', label: '🧾 Ventas' },
    { id: 'v-caja', label: '💰 Caja' },
    { id: 'v-reportes', label: '📈 Reportes' },
    { id: 'v-stock', label: '📦 Stock' },
    { id: 'v-productos', label: '🏷️ Productos' },
    { id: 'v-movimientos', label: '📜 Movimientos' },
    { id: 'v-usuarios', label: '👥 Usuarios' }
  ];

  const VISTAS_VENDEDOR = [
    { id: 'v-vender', label: '🛒 Vender' },
    { id: 'v-recibir', label: '📥 Recibir' },
    { id: 'v-ventas', label: '🧾 Ventas de hoy' },
    { id: 'v-caja', label: '💰 Caja' }
  ];

  function construirPestanas() {
    const nav = $('pestanas');
    nav.innerHTML = '';
    const lista = estado.yo.rol === 'dueno' ? VISTAS_DUENO : VISTAS_VENDEDOR;

    lista.forEach((p, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pestana';
      btn.textContent = p.label;
      btn.dataset.vista = p.id;
      btn.addEventListener('click', () => cambiarVista(p.id));
      nav.appendChild(btn);
    });

    /* Si venía de volver a entrar (se le venció la sesión), sigue en la
       pestaña donde estaba. Si no, la de siempre para su rol. */
    const inicial = estado.yo.rol === 'dueno' ? 'v-hoy' : 'v-vender';
    cambiarVista(lista.some(p => p.id === estado.vistaActiva) ? estado.vistaActiva : inicial);
  }

  function cambiarVista(idVista) {
    estado.vistaActiva = idVista;
    qsa('.pestana', $('pestanas')).forEach(b => {
      b.classList.toggle('activa', b.dataset.vista === idVista);
    });
    qsa('.vista', $('app')).forEach(v => {
      v.hidden = v.id !== idVista;
    });

    // Cargar o refrescar datos de la vista seleccionada
    switch (idVista) {
      case 'v-hoy':
        cargarHoy();
        break;
      case 'v-vender':
        cargarProductos().then(renderVentaLista);
        setTimeout(() => $('vender-buscar').focus(), 100);
        break;
      case 'v-recibir':
        cargarProductos().then(renderRecibirLista);
        setTimeout(() => $('recibir-buscar').focus(), 100);
        break;
      case 'v-ventas':
        cargarVentas();
        break;
      case 'v-stock':
        cargarStock();
        break;
      case 'v-productos':
        cargarProductosAdmin();
        break;
      case 'v-movimientos':
        cargarMovimientos();
        break;
      case 'v-caja':
        cargarCaja();
        break;
      case 'v-reportes':
        cargarReporte();
        break;
      case 'v-usuarios':
        cargarUsuarios();
        break;
    }
  }

  // ─────────────────────────── Carga de datos base ───────────────────────────
  async function cargarProductos() {
    try {
      recibirProductos(await api('/api/productos'));
    } catch (e) {
      mostrarAviso(e.message, true);
    }
  }

  function recibirProductos(lista) {
    estado.productos = lista;
    actualizarDatalistCategorias();
    const cambios = ponerListasAlDia();
    if (cambios.length) {
      estado.claveVenta = null;
      mostrarAviso(cambios.join(' · '), true);
    }
  }

  /* Las listas a medio armar (la venta, la entrada) guardan una copia de
     cada producto. Cada vez que se trae el catálogo se las pone al día: si
     no, la pantalla seguía mostrando el precio viejo aunque el dueño lo
     hubiera cambiado, y al cliente se le decía un total que no era. */
  function ponerListasAlDia() {
    const porId = new Map(estado.productos.map(p => [p.id, p]));
    const cambios = [];
    for (const lista of [estado.carrito, estado.recibirItems]) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const nuevo = porId.get(lista[i].p.id);
        if (!nuevo || !nuevo.activo) {
          cambios.push(`"${lista[i].p.nombre}" ya no se vende y salió de la lista`);
          lista.splice(i, 1);
          continue;
        }
        if (lista === estado.carrito) {
          const variante = lista[i].variante || null;
          const sigue = variante
            ? Boolean(nuevo.variantes && nuevo.variantes.opciones.some(o => o.label === variante))
            : !nuevo.variantes;
          if (!sigue) {
            /* en la web le cambiaron las opciones: hay que elegirlo de nuevo */
            cambios.push(`"${nuevo.nombre}" cambió sus opciones: búsquelo de nuevo`);
            lista.splice(i, 1);
            continue;
          }
          if (precioDe(nuevo, variante) !== precioDe(lista[i].p, variante)) {
            cambios.push(`"${nuevo.nombre}${variante ? ' ' + variante : ''}" ahora cuesta ${bs(precioDe(nuevo, variante))}`);
          }
        }
        lista[i].p = nuevo;
      }
    }
    return cambios;
  }

  /* Lo que el sistema cree que hay en la tienda donde se está operando.
     null = no se sabe: ese producto nunca tuvo movimientos ahí. */
  function stockAca(p) {
    if (estado.yo.rol !== 'dueno') return p.stock == null ? null : p.stock;
    const s = (p.stock_tiendas || {})[estado.tiendaActual];
    return s === undefined ? null : s;
  }

  function filtrarProductos(lista, texto) {
    const q = texto.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(p =>
      (p.nombre && p.nombre.toLowerCase().includes(q)) ||
      (p.codigo && p.codigo.toLowerCase().includes(q)) ||
      (p.categoria && p.categoria.toLowerCase().includes(q))
    );
  }

  function actualizarDatalistCategorias() {
    const dl = $('lista-categorias');
    if (!dl) return;
    const cats = [...new Set(estado.productos.map(p => p.categoria).filter(Boolean))].sort();
    dl.innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">`).join('');
  }

  function escapeHTML(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─────────────────────────── 1. Vista Hoy ───────────────────────────
  async function cargarHoy() {
    $('hoy-hora').textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-BO');
    try {
      const res = await api('/api/resumen');
      const tarjetas = $('hoy-tarjetas');
      tarjetas.innerHTML = '';

      let granTotal = 0;
      let granVentas = 0;
      let granEfectivo = 0;
      let granQr = 0;
      let granGanancia = 0;
      let granSinCosto = 0;

      /* La ganancia solo cuenta lo que tiene costo cargado. El servidor dice
         cuántas unidades quedaron afuera y acá se muestra: una ganancia a
         la que le falta la mitad de las ventas, sin decirlo, engaña. */
      const ganancia = (monto, sinCosto) => !monto && !sinCosto ? '' : `
        <br><span class="pos">Ganancia: ${bs(monto)}</span>
        ${sinCosto ? `<span class="bajo">(sin contar ${sinCosto} u. que no tienen costo cargado)</span>` : ''}`;

      res.porTienda.forEach(t => {
        granTotal += t.total;
        granVentas += t.ventas;
        granEfectivo += t.efectivo;
        granQr += t.qr;
        granGanancia += t.ganancia;
        granSinCosto += t.sin_costo;

        const card = document.createElement('div');
        card.className = 'tarjeta';
        card.innerHTML = `
          <div class="titulo">${escapeHTML(t.tienda)}</div>
          <div class="grande">${bs(t.total)}</div>
          <div class="chico suave">
            ${t.ventas} ventas · Ef: ${bs(t.efectivo)} · QR: ${bs(t.qr)}
            ${t.anuladas ? `<br><span class="etiqueta roja">${t.anuladas} anuladas</span>` : ''}
            ${ganancia(t.ganancia, t.sin_costo)}
          </div>
        `;
        tarjetas.appendChild(card);
      });

      // Tarjeta Total general
      const cardTotal = document.createElement('div');
      cardTotal.className = 'tarjeta total';
      cardTotal.innerHTML = `
        <div class="titulo">TOTAL GENERAL HOY</div>
        <div class="grande pos">${bs(granTotal)}</div>
        <div class="chico suave">${granVentas} ventas en total · Ef: ${bs(granEfectivo)} · QR: ${bs(granQr)}
          ${ganancia(granGanancia, granSinCosto)}
        </div>
      `;
      tarjetas.insertBefore(cardTotal, tarjetas.firstChild);

      // Alertas
      const boxAlertas = $('hoy-alertas');
      boxAlertas.innerHTML = '';
      const { anulaciones, ajustes, negativos, bajos } = res.alertas;
      let hayAlertas = false;

      negativos.forEach(n => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta roja';
        al.innerHTML = `⚠️ <b>Stock negativo:</b> ${escapeHTML(n.producto)} en <b>${escapeHTML(n.tienda)}</b> quedó en <span class="neg">${n.stock}</span>.`;
        boxAlertas.appendChild(al);
      });

      bajos.forEach(b => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta';
        al.innerHTML = `📦 <b>Stock bajo:</b> ${escapeHTML(b.producto)} en <b>${escapeHTML(b.tienda)}</b> tiene <b>${b.stock}</b> (mínimo ${b.minimo}).`;
        boxAlertas.appendChild(al);
      });

      anulaciones.forEach(a => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta roja';
        al.innerHTML = `❌ <b>Venta anulada #${a.id} (${bs(a.total)}):</b> en ${escapeHTML(a.tienda)} por ${escapeHTML(a.anulada_por || a.vendedor)}. Motivo: <i>${escapeHTML(a.motivo_anulacion)}</i>.`;
        boxAlertas.appendChild(al);
      });

      ajustes.forEach(aj => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta';
        al.innerHTML = `✏️ <b>Ajuste de stock:</b> ${aj.cantidad > 0 ? '+' : ''}${aj.cantidad} en ${escapeHTML(aj.producto)} (${escapeHTML(aj.tienda)}) por ${escapeHTML(aj.usuario)}. Motivo: <i>${escapeHTML(aj.nota || 'Sin motivo')}</i>.`;
        boxAlertas.appendChild(al);
      });

      (res.alertas.cierres || []).forEach(c => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta roja';
        al.innerHTML = `💰 <b>Caja que no cuadró:</b> ${escapeHTML(c.usuario)} en <b>${escapeHTML(c.tienda)}</b>. ${c.diferencia < 0 ? 'Faltan' : 'Sobran'} <b>${bs(Math.abs(c.diferencia))}</b>. Nota: <i>${escapeHTML(c.nota || 'sin nota')}</i>.`;
        boxAlertas.appendChild(al);
      });

      (res.alertas.sinCerrar || []).forEach(p => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta';
        al.innerHTML = `💰 <b>Caja sin cerrar desde el ${fechaHora(p.primera)}:</b> ${escapeHTML(p.usuario)} en <b>${escapeHTML(p.tienda)}</b> tiene ${p.ventas} ventas (${bs(p.efectivo)} en efectivo) que nadie cerró.`;
        boxAlertas.appendChild(al);
      });

      (res.alertas.gastos || []).forEach(g => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta' + (g.tipo === 'retiro' ? ' roja' : '');
        al.innerHTML = `💸 <b>${g.tipo === 'retiro' ? 'Retiro de caja' : 'Gasto'} de ${bs(g.monto)}:</b> lo anotó ${escapeHTML(g.usuario)} en <b>${escapeHTML(g.tienda)}</b> (${fechaHora(g.fecha)}). Motivo: <i>${escapeHTML(g.motivo)}</i>.`;
        boxAlertas.appendChild(al);
      });

      (res.alertas.entradas || []).forEach(en => {
        hayAlertas = true;
        const al = document.createElement('div');
        al.className = 'alerta';
        al.innerHTML = `📥 <b>Mercadería recibida:</b> ${escapeHTML(en.usuario)} anotó <b>${en.unidades} unidades</b> de ${en.productos} producto${en.productos === 1 ? '' : 's'} en <b>${escapeHTML(en.tienda)}</b> (${fechaHora(en.fecha)}). El detalle está en Movimientos.`;
        boxAlertas.appendChild(al);
      });

      if (!hayAlertas) {
        boxAlertas.innerHTML = '<div class="suave chico">No hay alertas hoy. Todo normal.</div>';
      }

      // Top más vendidos
      const boxTop = $('hoy-top');
      if (!res.masVendidos.length) {
        boxTop.innerHTML = '<div class="vacio">Aún no hay ventas registradas hoy.</div>';
      } else {
        boxTop.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th class="num">Unidades vendidas</th>
                <th class="num">Total</th>
              </tr>
            </thead>
            <tbody>
              ${res.masVendidos.map(p => `
                <tr>
                  <td><b>${escapeHTML(p.nombre)}</b></td>
                  <td class="num">${p.unidades}</td>
                  <td class="num pos"><b>${bs(p.monto)}</b></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } catch (e) {
      mostrarAviso(e.message, true);
    }
  }

  // ─────────────────────────── 2. Vista Vender ───────────────────────────
  /* Lo que vale un producto según la opción elegida ("32 cm" suma Bs 40).
     Es solo para MOSTRAR: el precio que se cobra lo calcula el servidor. */
  function precioDe(p, variante) {
    if (!variante || !p.variantes) return p.precio;
    const opcion = p.variantes.opciones.find(o => o.label === variante);
    return opcion ? Math.max(0, p.precio + opcion.delta) : p.precio;
  }

  function totalCarrito() {
    return estado.carrito.reduce((s, it) => s + precioDe(it.p, it.variante) * it.cantidad, 0);
  }

  /* ⚠️ Todo lo que cambie la venta pasa por acá, no directo por
     renderVentaLista(). La clave identifica un cobro con ESTOS productos:
     si la lista cambia y la clave no, el servidor creería que es el cobro
     anterior repetido y devolvería una venta que no es esta. */
  function carritoCambio() {
    estado.claveVenta = null;
    esconderSinStock();
    renderVentaLista();
  }

  /* La pregunta "¿lo tiene en la mano?" vale para la lista tal como estaba
     cuando se tocó Cobrar. Si la lista cambia, se esconde y se pregunta de
     nuevo: no se puede confirmar una cosa y terminar vendiendo otra. */
  function esconderSinStock() {
    $('vender-sin-stock').hidden = true;
    $('vender-cobrar').hidden = false;
  }

  function preguntarSinStock(faltan) {
    $('vender-sin-stock-lista').innerHTML = faltan.map(f =>
      `<li><b>${escapeHTML(f.nombre)}</b>: ${f.hay > 0 ? 'quedan ' + f.hay : 'no queda ninguno'} y va a vender ${f.pide}</li>`
    ).join('');
    $('vender-sin-stock').hidden = false;
    $('vender-cobrar').hidden = true;
    pitidoDeError();
  }

  /* 32 letras al azar. No va crypto.randomUUID(): no existe cuando se entra
     por http desde la WiFi (--red), solo en https o en localhost. */
  function nuevaClave() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function agregarAlCarrito(producto, variante = null) {
    /* la misma sartén en 24 cm y en 32 cm son dos renglones: valen distinto */
    const item = estado.carrito.find(it => it.p.id === producto.id && (it.variante || null) === variante);
    if (item) {
      item.cantidad += 1;
    } else {
      estado.carrito.push({ p: producto, variante, cantidad: 1 });
    }
    carritoCambio();
  }

  function renderVentaLista() {
    const contenedor = $('vender-lista');
    if (!estado.carrito.length) {
      contenedor.innerHTML = '<div class="vacio">No hay productos en la venta.<br>Escanee un código de barras o busque arriba.</div>';
      $('vender-total').textContent = 'Bs 0';
      $('vender-cobrar').disabled = true;
      actualizarVuelto();
      return;
    }

    let html = `
      <table class="lista-venta">
        <thead>
          <tr>
            <th>Producto</th>
            <th class="num">Precio</th>
            <th class="centro">Cant.</th>
            <th class="num">Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    estado.carrito.forEach((it, idx) => {
      const precio = precioDe(it.p, it.variante);
      const subtotal = precio * it.cantidad;
      const hay = stockAca(it.p);
      html += `
        <tr>
          <td>
            <b>${escapeHTML(it.p.nombre)}</b>
            ${it.p.codigo ? `<div class="chico suave">${escapeHTML(it.p.codigo)}</div>` : ''}
            ${it.variante ? `<div class="chico pos">${escapeHTML(it.p.variantes ? it.p.variantes.nombre : 'Opción')}: <b>${escapeHTML(it.variante)}</b></div>` : ''}
            <div class="chico suave solo-movil">${bs(precio)} c/u</div>
            ${hay != null && it.cantidad > hay ? `<div class="chico bajo">⚠️ El sistema dice que ${hay > 0 ? 'quedan ' + hay : 'no queda ninguno'}</div>` : ''}
          </td>
          <td class="num">${bs(precio)}</td>
          <td class="centro">
            <div class="cant">
              <button type="button" class="mini btn-restar" data-idx="${idx}">-</button>
              <input type="number" min="1" max="10000" class="input-cant" data-idx="${idx}" value="${it.cantidad}">
              <button type="button" class="mini btn-sumar" data-idx="${idx}">+</button>
            </div>
          </td>
          <td class="num"><b>${bs(subtotal)}</b></td>
          <td class="der">
            <button type="button" class="mini peligro btn-quitar" data-idx="${idx}">✕</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    contenedor.innerHTML = html;

    $('vender-total').textContent = bs(totalCarrito());
    $('vender-cobrar').disabled = false;
    actualizarVuelto();

    // Eventos en tabla de carrito
    qsa('.btn-restar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        if (estado.carrito[i].cantidad > 1) {
          estado.carrito[i].cantidad--;
        } else {
          estado.carrito.splice(i, 1);
        }
        carritoCambio();
      });
    });

    qsa('.btn-sumar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        estado.carrito[i].cantidad++;
        carritoCambio();
      });
    });

    qsa('.input-cant', contenedor).forEach(inp => {
      inp.addEventListener('change', () => {
        const i = Number(inp.dataset.idx);
        const val = parseInt(inp.value, 10);
        if (val > 0) {
          estado.carrito[i].cantidad = val;
        } else {
          estado.carrito.splice(i, 1);
        }
        carritoCambio();
      });
    });

    qsa('.btn-quitar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        estado.carrito.splice(i, 1);
        carritoCambio();
      });
    });
  }

  function actualizarVuelto() {
    const totalCentavos = totalCarrito();
    const recibeStr = $('vender-recibe').value.trim().replace(',', '.');
    const cajaVuelto = $('vender-vuelto');

    if (!recibeStr || isNaN(recibeStr) || estado.tipoPago !== 'efectivo') {
      cajaVuelto.textContent = '';
      return;
    }

    const recibeCentavos = Math.round(Number(recibeStr) * 100);
    const dif = recibeCentavos - totalCentavos;
    if (dif >= 0) {
      cajaVuelto.innerHTML = `<span class="pos">Cambio: ${bs(dif)}</span>`;
    } else {
      cajaVuelto.innerHTML = `<span class="neg">Faltan: ${bs(Math.abs(dif))}</span>`;
    }
  }

  // Buscador predictivo y código de barras en Venta
  /* conOpciones: es el buscador de VENDER. Un producto que en la web viene
     en opciones (tamaño, color) sale como un renglón por opción, cada uno
     con su precio: "Sartén · 32 cm  Bs 185". En Recibir no hace falta: el
     stock es del producto entero. */
  function configurarBuscador(inputId, resultadosId, onElegir, conOpciones = false) {
    const input = $(inputId);
    const box = $(resultadosId);
    let lista = [];          // lo que se está mostrando: [{ p, opcion }]
    let marcado = -1;        // cuál elegiría Enter
    let consulta = '';       // el texto para el que se armó la lista
    let usoFlechas = false;  // eligió a mano con ↑ ↓

    /* Un lector de código de barras "escribe" el número y aprieta Enter.
       Si el texto parece un código, solo vale el que coincide ENTERO: con
       uno parecido se terminaría cobrando otro producto. */
    const pareceCodigo = q => /^\d{6,}$/.test(q);

    /* Un producto se abre en un renglón por opción; sin opciones, en uno. */
    const renglones = p => conOpciones && p.variantes
      ? p.variantes.opciones.map(opcion => ({ p, opcion }))
      : [{ p, opcion: null }];

    function cerrar() {
      box.hidden = true;
      box.innerHTML = '';
      lista = [];
      marcado = -1;
      consulta = '';
    }

    function marcar(i) {
      marcado = i;
      qsa('button.resultado', box).forEach((b, n) => {
        b.classList.toggle('marcado', n === i);
        if (n === i) b.scrollIntoView({ block: 'nearest' });
      });
    }

    function elegir(r) {
      onElegir(r.p, r.opcion ? r.opcion.label : null);
      input.value = '';
      cerrar();
      input.focus();
    }

    /* No está. El texto queda SELECCIONADO: lo próximo que se escanee o se
       escriba lo reemplaza. Antes quedaba suelto en la caja, el código
       siguiente se pegaba atrás y ese tampoco se encontraba. */
    function noEsta() {
      lista = [];
      marcado = -1;
      box.hidden = false;
      box.innerHTML = `<div class="resultado neg">No hay ningún producto con «${escapeHTML(input.value.trim())}»</div>`;
    }

    function mostrar(nuevaLista) {
      lista = nuevaLista.slice(0, 20);
      box.hidden = false;
      box.innerHTML = lista.map((r, i) => {
        const hay = stockAca(r.p);
        const stock = hay == null ? '' : hay > 0 ? `· Quedan ${hay}` : '· <span class="neg">Sin stock en el sistema</span>';
        return `
          <button type="button" class="resultado" data-i="${i}">
            <div>
              <b>${escapeHTML(r.p.nombre)}${r.opcion ? ' · ' + escapeHTML(r.opcion.label) : ''}</b>
              <div class="sub">${escapeHTML(r.p.categoria || 'Sin categoría')} ${r.p.codigo ? '· Cód: ' + escapeHTML(r.p.codigo) : ''} ${stock}</div>
            </div>
            <div class="pos"><b>${bs(precioDe(r.p, r.opcion ? r.opcion.label : null))}</b></div>
          </button>
        `;
      }).join('');
      marcar(0);
    }

    function buscar() {
      const q = input.value.trim().toLowerCase();
      if (!q) return cerrar();
      consulta = q;
      usoFlechas = false;
      const productos = filtrarProductos(estado.productos.filter(p => p.activo), q);
      if (!productos.length) return noEsta();
      mostrar(productos.flatMap(renglones));
    }

    input.addEventListener('input', buscar);

    box.addEventListener('click', e => {
      const btn = e.target.closest('button.resultado');
      if (!btn) return;
      const r = lista[Number(btn.dataset.i)];
      if (r) elegir(r);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!lista.length) return;
        e.preventDefault();
        usoFlechas = true;
        marcar((marcado + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        if (!q) return;

        // el código exacto gana siempre: es lo que manda el lector
        const exacto = estado.productos.find(p => p.activo && p.codigo && p.codigo.toLowerCase() === q);
        if (exacto && !usoFlechas) {
          const opciones = renglones(exacto);
          if (opciones.length === 1) return elegir(opciones[0]);
          /* el código es del producto, no de una opción: se muestran las
             opciones para que elija cuál se lleva (con ↑ ↓ y Enter, o tocando) */
          consulta = q;
          usoFlechas = true;
          return mostrar(opciones);
        }

        if (q !== consulta) buscar();
        if (!lista.length) {
          noEsta();
          pitidoDeError();
          input.select();
        } else if (pareceCodigo(q) && !usoFlechas) {
          /* parece un código y no hay ninguno igual: se muestran los
             parecidos pero no se agrega nada solo */
          pitidoDeError();
          input.select();
        } else {
          elegir(lista[marcado]);
        }
      } else if (e.key === 'Escape') {
        cerrar();
      }
    });

    document.addEventListener('click', evt => {
      if (!input.contains(evt.target) && !box.contains(evt.target)) cerrar();
    });
  }

  // ─────────────────────────── 3. Vista Recibir Mercadería ───────────────────────────
  function agregarARecibir(producto) {
    const item = estado.recibirItems.find(it => it.p.id === producto.id);
    if (item) {
      item.cantidad += 1;
    } else {
      estado.recibirItems.push({ p: producto, cantidad: 1 });
    }
    renderRecibirLista();
  }

  function renderRecibirLista() {
    const contenedor = $('recibir-lista');
    if (!estado.recibirItems.length) {
      contenedor.innerHTML = '<div class="vacio">No hay productos en la lista de entrada.<br>Escanee o busque arriba para agregar.</div>';
      $('recibir-guardar').disabled = true;
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="centro">Cantidad a ingresar</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    estado.recibirItems.forEach((it, idx) => {
      html += `
        <tr>
          <td>
            <b>${escapeHTML(it.p.nombre)}</b>
            ${it.p.codigo ? `<div class="chico suave">${escapeHTML(it.p.codigo)}</div>` : ''}
          </td>
          <td class="centro">
            <div class="cant">
              <button type="button" class="mini btn-rec-restar" data-idx="${idx}">-</button>
              <input type="number" min="1" max="100000" class="input-rec-cant" data-idx="${idx}" value="${it.cantidad}">
              <button type="button" class="mini btn-rec-sumar" data-idx="${idx}">+</button>
            </div>
          </td>
          <td class="der">
            <button type="button" class="mini peligro btn-rec-quitar" data-idx="${idx}">✕</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    contenedor.innerHTML = html;
    $('recibir-guardar').disabled = false;

    qsa('.btn-rec-restar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        if (estado.recibirItems[i].cantidad > 1) {
          estado.recibirItems[i].cantidad--;
        } else {
          estado.recibirItems.splice(i, 1);
        }
        renderRecibirLista();
      });
    });

    qsa('.btn-rec-sumar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        estado.recibirItems[i].cantidad++;
        renderRecibirLista();
      });
    });

    qsa('.input-rec-cant', contenedor).forEach(inp => {
      inp.addEventListener('change', () => {
        const i = Number(inp.dataset.idx);
        const val = parseInt(inp.value, 10);
        if (val > 0) estado.recibirItems[i].cantidad = val;
        else estado.recibirItems.splice(i, 1);
        renderRecibirLista();
      });
    });

    qsa('.btn-rec-quitar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        estado.recibirItems.splice(i, 1);
        renderRecibirLista();
      });
    });
  }

  // ─────────────────────────── 4. Vista Ventas ───────────────────────────
  async function cargarVentas() {
    const listaBox = $('ventas-lista');
    const resumenBox = $('ventas-resumen');
    listaBox.innerHTML = '<div class="vacio">Cargando ventas...</div>';

    /* El dueño arranca viendo HOY (mostrarApp pone la fecha). Si borra la
       fecha ve las últimas ventas de cualquier día, y el título lo dice:
       antes el "TOTAL COBRADO" sumaba las últimas 200 de toda la historia
       sin aclararlo y parecía la caja del día. */
    const params = new URLSearchParams();
    let titulo = 'Ventas de hoy';
    let limite = 200;
    if (estado.yo.rol === 'dueno') {
      const tiendaFiltro = $('ventas-tienda').value;
      if (tiendaFiltro) params.set('tienda', tiendaFiltro);

      const fechaFiltro = $('ventas-dia').value;
      if (fechaFiltro) {
        // Formato YYYY-MM-DD
        const [y, m, d] = fechaFiltro.split('-').map(Number);
        const inicio = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        const fin = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
        params.set('desde', inicio);
        params.set('hasta', fin);
        limite = 1000;
        if (fechaFiltro !== hoyISO()) titulo = `Ventas del ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      } else {
        titulo = 'Últimas ventas';
      }
      params.set('limite', limite);
    }
    $('ventas-titulo').textContent = titulo;

    try {
      const ventas = await api('/api/ventas' + (params.toString() ? '?' + params.toString() : ''));
      if (!ventas.length) {
        listaBox.innerHTML = '<div class="vacio">No hay ventas registradas para este filtro.</div>';
        resumenBox.innerHTML = '';
        return;
      }

      // Resumen
      let totalVentas = 0;
      let efectivo = 0;
      let qr = 0;
      let anuladas = 0;

      ventas.forEach(v => {
        if (!v.anulada) {
          totalVentas += v.total;
          if (v.pago === 'efectivo') efectivo += v.total;
          else if (v.pago === 'qr') qr += v.total;
        } else {
          anuladas++;
        }
      });

      resumenBox.innerHTML = `
        <div class="tarjeta">
          <div class="titulo">TOTAL COBRADO</div>
          <div class="grande pos">${bs(totalVentas)}</div>
          <div class="chico suave">${ventas.length - anuladas} ventas válidas</div>
        </div>
        <div class="tarjeta">
          <div class="titulo">EFECTIVO COBRADO</div>
          <div class="grande">${bs(efectivo)}</div>
          <div class="chico suave">Aparte, por QR: ${bs(qr)}</div>
        </div>
        ${anuladas ? `
          <div class="tarjeta">
            <div class="titulo">ANULACIONES</div>
            <div class="grande neg">${anuladas}</div>
            <div class="chico suave">Ventas canceladas</div>
          </div>
        ` : ''}
      `;

      // Render lista de ventas
      listaBox.innerHTML = ventas.map(v => {
        const puedeAnular = !v.anulada && (
          estado.yo.rol === 'dueno' ||
          (estado.yo.rol === 'vendedor' && v.usuario_id === estado.yo.id &&
           (Date.now() - v.fecha) <= estado.minutosParaAnular * 60000)
        );

        return `
          <div class="venta-item ${v.anulada ? 'anulada' : ''}">
            <div class="cab">
              <b>Venta #${v.id}</b>
              <span class="etiqueta ${v.pago === 'qr' ? 'ambar' : 'verde'}">${v.pago === 'qr' ? '📱 QR' : '💵 Efectivo'}</span>
              <span class="etiqueta">${escapeHTML(v.tienda)}</span>
              <span class="chico suave">Atendió: ${escapeHTML(v.vendedor)} · ${fechaHora(v.fecha)}</span>
              <div class="monto ${v.anulada ? 'tachado' : 'pos'}">${bs(v.total)}</div>
              ${v.anulada ? `
                <span class="etiqueta roja">ANULADA</span>
              ` : (puedeAnular ? `
                <button type="button" class="mini peligro btn-anular" data-id="${v.id}">Anular venta</button>
              ` : '')}
            </div>
            ${v.anulada ? `
              <div class="chico neg nota-anulada">
                Anulada por ${escapeHTML(v.anulada_por || '')}: <i>${escapeHTML(v.motivo_anulacion)}</i> (${fechaHora(v.anulada_fecha)})
              </div>
            ` : ''}
            <div class="detalle">
              ${(v.items || []).map(it => `
                <div>${it.cantidad}x <b>${escapeHTML(it.nombre)}${it.variante ? ' · ' + escapeHTML(it.variante) : ''}</b> (${bs(it.precio_unit)} c/u) = ${bs(it.cantidad * it.precio_unit)}</div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('') + (ventas.length >= limite ? `
        <div class="vacio">Se muestran las ${ventas.length} ventas más recientes: los totales de arriba cuentan solo esas.</div>
      ` : '');

      qsa('.btn-anular', listaBox).forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number(btn.dataset.id);
          const motivo = prompt('Escriba el motivo por el cual anula esta venta:');
          if (motivo === null) return;
          if (!motivo.trim()) {
            mostrarAviso('Debe especificar un motivo para anular', true);
            return;
          }
          try {
            await api('/api/ventas/anular', 'POST', { id, motivo: motivo.trim() });
            mostrarAviso(`Venta #${id} anulada correctamente`);
            cargarVentas();
            cargarProductos(); // actualizar stock en caché
          } catch (e) {
            mostrarAviso(e.message, true);
          }
        });
      });
    } catch (e) {
      listaBox.innerHTML = `<div class="vacio error">${escapeHTML(e.message)}</div>`;
    }
  }

  // ─────────────────────────── 5. Vista Stock (Dueño) ───────────────────────────
  /* Traer y dibujar van separados. Antes cada letra escrita en el buscador
     volvía a pedirle todo el catálogo al servidor, y si las respuestas
     llegaban desordenadas quedaba en pantalla el filtro de hace dos letras. */
  async function cargarStock() {
    /* con el conteo abierto no se redibuja nada: lo que ya se escribió en
       las casillas tiene que seguir ahí al volver de otra pestaña */
    if (!estado.conteoModo) $('stock-tabla').innerHTML = '<div class="vacio">Cargando stock...</div>';
    await cargarProductos();
    if (!estado.conteoModo) renderStock();
  }

  /* undefined = el producto nunca tuvo movimientos en esa tienda. No es lo
     mismo que 0: "nunca lo tuvo" no es un problema, "tenía y se acabó" sí. */
  function tieneProblema(p, s) {
    return s !== undefined && (s < 0 || (p.stock_minimo > 0 && s <= p.stock_minimo));
  }

  function renderStock() {
    const contenedor = $('stock-tabla');
    const soloProblemas = $('stock-problemas').checked;

    let lista = filtrarProductos(estado.productos.filter(p => p.activo), $('stock-buscar').value);

    if (soloProblemas) {
      lista = lista.filter(p => {
        const stocks = p.stock_tiendas || {};
        return estado.tiendas.some(t => tieneProblema(p, stocks[t.id]));
      });
    }

    if (!lista.length) {
      contenedor.innerHTML = '<div class="vacio">No hay productos que coincidan con la búsqueda.</div>';
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            ${estado.tiendas.map(t => `<th class="num">${escapeHTML(t.nombre)}${t.id === estado.tiendaWeb ? ' 🌐' : ''}</th>`).join('')}
            <th class="num">TOTAL</th>
          </tr>
        </thead>
        <tbody>
    `;

    lista.forEach(p => {
      const stocks = p.stock_tiendas || {};
      let totalStock = 0;

      html += `
        <tr>
          <td>
            <b>${escapeHTML(p.nombre)}</b>
            ${p.codigo ? `<div class="chico suave">${escapeHTML(p.codigo)}</div>` : ''}
          </td>
          <td><span class="etiqueta">${escapeHTML(p.categoria || '-')}</span></td>
      `;

      estado.tiendas.forEach(t => {
        const s = stocks[t.id];
        if (s === undefined) {
          html += '<td class="num suave" title="Nunca tuvo este producto">–</td>';
          return;
        }
        totalStock += s;
        const clase = s < 0 ? 'neg' : tieneProblema(p, s) ? 'bajo' : '';
        html += `<td class="num ${clase}"><b>${s}</b></td>`;
      });

      html += `<td class="num pos"><b>${totalStock}</b></td></tr>`;
    });

    html += '</tbody></table>';
    contenedor.innerHTML = html;
  }

  /* Con el conteo abierto se esconde la tabla de arriba (eran dos listas
     largas, una debajo de la otra) y el buscador pasa a filtrar el conteo.
     Así se cuenta con el lector: escanear → Enter → escribir cuántos hay →
     Enter → escanear el siguiente. */
  function abrirConteo() {
    if (!$('traspaso').hidden) cerrarTraspaso();
    estado.conteoModo = true;
    $('conteo').hidden = false;
    $('stock-contar').hidden = true;
    $('stock-tabla').hidden = true;
    $('stock-problemas').closest('label').hidden = true;

    const tiendaId = estado.tiendaActual;
    const tiendaObj = estado.tiendas.find(t => t.id === tiendaId);
    $('conteo-titulo').textContent = `Conteo físico de inventario en ${tiendaObj ? tiendaObj.nombre : ''}`;

    const tabla = $('conteo-tabla');
    let html = `
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="num">Sistema</th>
            <th class="num col-conteo">Conteo Físico Real</th>
          </tr>
        </thead>
        <tbody>
    `;

    estado.productos.filter(p => p.activo).forEach(p => {
      const actual = (p.stock_tiendas || {})[tiendaId];
      const busca = [p.nombre, p.codigo, p.categoria].filter(Boolean).join(' ').toLowerCase();
      html += `
        <tr data-busca="${escapeHTML(busca)}">
          <td>
            <b>${escapeHTML(p.nombre)}</b>
            ${p.codigo ? `<div class="chico suave">${escapeHTML(p.codigo)}</div>` : ''}
          </td>
          <td class="num suave">${actual === undefined ? 'sin contar' : actual}</td>
          <td class="num">
            <input type="number" min="0" max="100000" class="input-conteo" data-id="${p.id}" placeholder="${actual === undefined ? '' : actual}">
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    tabla.innerHTML = html;
    filtrarConteo();
  }

  /* Esconde filas sin volver a dibujar la tabla: lo que ya se escribió en
     las otras filas tiene que seguir ahí. */
  function filtrarConteo() {
    const q = $('stock-buscar').value.trim().toLowerCase();
    qsa('tbody tr', $('conteo-tabla')).forEach(tr => {
      tr.hidden = !!q && !tr.dataset.busca.includes(q);
    });
  }

  function hayConteoEscrito() {
    return qsa('.input-conteo', $('conteo-tabla')).some(inp => inp.value.trim() !== '');
  }

  function cerrarConteo() {
    estado.conteoModo = false;
    $('conteo').hidden = true;
    $('stock-contar').hidden = false;
    $('stock-tabla').hidden = false;
    $('stock-problemas').closest('label').hidden = false;
    $('conteo-tabla').innerHTML = '';
    $('conteo-nota').value = '';
    renderStock();
  }

  async function guardarConteo() {
    const inputs = qsa('.input-conteo', $('conteo-tabla'));
    const items = [];
    inputs.forEach(inp => {
      const val = inp.value.trim();
      if (val !== '') {
        items.push({
          producto_id: Number(inp.dataset.id),
          cantidad: parseInt(val, 10)
        });
      }
    });

    if (!items.length) {
      mostrarAviso('No ingresó ninguna cantidad en el conteo', true);
      return;
    }

    const nota = $('conteo-nota').value.trim();
    try {
      const res = await api('/api/stock', 'POST', {
        tienda_id: estado.tiendaActual,
        items,
        nota
      });
      mostrarAviso(`Conteo guardado: ${res.iniciales} iniciales, ${res.ajustes} ajustes.`);
      cerrarConteo();
      cargarStock();
    } catch (e) {
      mostrarAviso(e.message, true);
    }
  }

  // ─────────────────────────── Traspaso entre tiendas (Dueño) ───────────────────────────
  function abrirTraspaso() {
    if (estado.conteoModo) cerrarConteo();
    estado.traspasoItems = [];
    const opciones = estado.tiendas.map(t => `<option value="${t.id}">${escapeHTML(t.nombre)}</option>`).join('');
    $('tras-origen').innerHTML = opciones;
    $('tras-destino').innerHTML = opciones;
    $('tras-origen').value = String(estado.tiendaActual);
    const otra = estado.tiendas.find(t => t.id !== estado.tiendaActual);
    if (otra) $('tras-destino').value = String(otra.id);
    $('tras-nota').value = '';
    $('tras-error').textContent = '';
    $('traspaso').hidden = false;
    $('stock-traspaso').hidden = true;
    $('stock-contar').hidden = true;
    renderTraspaso();
    $('traspaso').scrollIntoView({ block: 'start' });
    setTimeout(() => $('tras-buscar').focus(), 100);
  }

  function cerrarTraspaso() {
    estado.traspasoItems = [];
    $('traspaso').hidden = true;
    $('stock-traspaso').hidden = false;
    $('stock-contar').hidden = false;
  }

  function agregarATraspaso(producto) {
    const item = estado.traspasoItems.find(it => it.p.id === producto.id);
    if (item) item.cantidad += 1;
    else estado.traspasoItems.push({ p: producto, cantidad: 1 });
    renderTraspaso();
  }

  function renderTraspaso() {
    const contenedor = $('tras-lista');
    const origen = Number($('tras-origen').value);
    const nombreOrigen = (estado.tiendas.find(t => t.id === origen) || {}).nombre || '';
    $('tras-guardar').disabled = !estado.traspasoItems.length;
    if (!estado.traspasoItems.length) {
      contenedor.innerHTML = '<div class="vacio">Busque arriba los productos que va a mandar.</div>';
      return;
    }
    contenedor.innerHTML = `
      <table>
        <thead><tr><th>Producto</th><th class="num">Hay en ${escapeHTML(nombreOrigen)}</th><th class="centro">Cuántos manda</th><th></th></tr></thead>
        <tbody>
          ${estado.traspasoItems.map((it, i) => {
            const hay = (it.p.stock_tiendas || {})[origen] || 0;
            return `
              <tr>
                <td><b>${escapeHTML(it.p.nombre)}</b>${it.p.codigo ? `<div class="chico suave">${escapeHTML(it.p.codigo)}</div>` : ''}</td>
                <td class="num ${it.cantidad > hay ? 'neg' : 'suave'}">${hay}</td>
                <td class="centro"><input type="number" min="1" max="100000" class="input-tras" data-i="${i}" value="${it.cantidad}"></td>
                <td class="der"><button type="button" class="mini peligro btn-tras-quitar" data-i="${i}">✕</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  async function guardarTraspaso() {
    const err = $('tras-error');
    err.textContent = '';
    if (!estado.traspasoItems.length) return;
    const origen = Number($('tras-origen').value), destino = Number($('tras-destino').value);
    if (origen === destino) { err.textContent = 'La tienda que manda y la que recibe son la misma.'; return; }
    $('tras-guardar').disabled = true;
    try {
      const r = await api('/api/transferencias', 'POST', {
        origen, destino,
        nota: $('tras-nota').value.trim(),
        items: estado.traspasoItems.map(it => ({ producto_id: it.p.id, cantidad: it.cantidad }))
      });
      mostrarAviso(`Traspaso hecho: ${r.unidades} unidades de ${r.origen} a ${r.destino}.`);
      cerrarTraspaso();
      cargarStock();
    } catch (e) {
      err.textContent = e.message;
      $('tras-guardar').disabled = false;
    }
  }

  // ─────────────────────────── 6. Vista Productos (Dueño) ───────────────────────────
  async function cargarProductosAdmin() {
    const contenedor = $('prod-tabla');
    contenedor.innerHTML = '<div class="vacio">Cargando catálogo...</div>';

    const inactivos = $('prod-inactivos').checked;
    try {
      recibirProductos(await api('/api/productos?inactivos=' + (inactivos ? '1' : '0')));
      renderProductosAdmin();
    } catch (e) {
      contenedor.innerHTML = `<div class="vacio error">${escapeHTML(e.message)}</div>`;
    }
  }

  function renderProductosAdmin() {
    const contenedor = $('prod-tabla');
    const lista = filtrarProductos(estado.productos, $('prod-buscar').value);

    if (!lista.length) {
      contenedor.innerHTML = '<div class="vacio">No se encontraron productos.</div>';
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Categoría</th>
            <th class="num">Precio</th>
            <th class="num">Antes</th>
            <th class="num">Costo</th>
            <th class="num">Mínimo</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    lista.forEach(p => {
      html += `
        <tr>
          <td><code>${escapeHTML(p.codigo || '-')}</code></td>
          <td><b>${escapeHTML(p.nombre)}</b>${p.catalogo_id != null ? ' <span title="Viene de la tienda web">🌐</span>' : ''}</td>
          <td><span class="etiqueta">${escapeHTML(p.categoria || '-')}</span></td>
          <td class="num pos"><b>${bs(p.precio)}</b></td>
          <td class="num tachado">${p.precio_antes ? bs(p.precio_antes) : '-'}</td>
          <td class="num suave">${p.costo ? bs(p.costo) : '-'}</td>
          <td class="num">${p.stock_minimo || 0}</td>
          <td>
            <span class="etiqueta ${p.activo ? 'verde' : 'roja'}">
              ${p.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="der">
            <button type="button" class="mini btn-editar-prod" data-id="${p.id}">Editar</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    contenedor.innerHTML = html;

    qsa('.btn-editar-prod', contenedor).forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const p = estado.productos.find(x => x.id === id);
        if (p) abrirDialogoProducto(p);
      });
    });
  }

  function abrirDialogoProducto(prod = null) {
    estado.prodEditandoId = prod ? prod.id : null;
    $('prod-titulo').textContent = prod ? 'Editar producto' : 'Nuevo producto';
    $('p-nombre').value = prod ? prod.nombre : '';
    $('p-categoria').value = prod ? (prod.categoria || '') : '';
    $('p-codigo').value = prod ? (prod.codigo || '') : '';
    $('p-precio').value = prod ? (prod.precio / 100).toFixed(2).replace(/\.00$/, '') : '';
    $('p-antes').value = prod && prod.precio_antes ? (prod.precio_antes / 100).toFixed(2).replace(/\.00$/, '') : '';
    $('p-costo').value = prod && prod.costo ? (prod.costo / 100).toFixed(2).replace(/\.00$/, '') : '';
    $('p-minimo').value = prod && prod.stock_minimo ? prod.stock_minimo : '';
    $('p-activo').checked = prod ? Boolean(prod.activo) : true;
    $('p-error').textContent = '';

    /* Lo que viene de la web se cambia en la web. El servidor igual ignora
       estos cuatro datos si llegan cambiados; bloquearlos acá es para que
       nadie escriba un precio creyendo que quedó guardado. */
    const deLaWeb = Boolean(prod && prod.catalogo_id != null);
    $('p-nota-web').hidden = !deLaWeb;
    ['p-nombre', 'p-categoria', 'p-precio', 'p-antes'].forEach(id => { $(id).readOnly = deLaWeb; });

    $('dlg-producto').showModal();
    setTimeout(() => $(deLaWeb ? 'p-codigo' : 'p-nombre').focus(), 100);
  }

  // ─────────────────────────── 7. Vista Movimientos (Dueño) ───────────────────────────
  async function cargarMovimientos() {
    const contenedor = $('mov-tabla');
    contenedor.innerHTML = '<div class="vacio">Cargando movimientos...</div>';

    const params = new URLSearchParams();
    const tienda = $('mov-tienda').value;
    const tipo = $('mov-tipo').value;
    if (tienda) params.set('tienda', tienda);
    if (tipo) params.set('tipo', tipo);

    try {
      const movs = await api('/api/movimientos?' + params.toString());
      if (!movs.length) {
        contenedor.innerHTML = '<div class="vacio">No hay movimientos registrados para este filtro.</div>';
        return;
      }

      let html = `
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tienda</th>
              <th>Producto</th>
              <th class="num">Cantidad</th>
              <th>Tipo</th>
              <th>Usuario</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
      `;

      movs.forEach(m => {
        let tagClase = 'etiqueta';
        if (m.tipo === 'venta') tagClase += ' ambar';
        else if (m.tipo === 'entrada') tagClase += ' verde';
        else if (m.tipo === 'anulacion') tagClase += ' roja';
        else if (m.tipo === 'ajuste') tagClase += ' roja';

        html += `
          <tr>
            <td class="chico suave">${fechaHora(m.fecha)}</td>
            <td><b>${escapeHTML(m.tienda)}</b></td>
            <td>${escapeHTML(m.producto)}</td>
            <td class="num ${m.cantidad > 0 ? 'pos' : 'neg'}"><b>${m.cantidad > 0 ? '+' : ''}${m.cantidad}</b></td>
            <td><span class="${tagClase}">${escapeHTML(m.tipo)}</span></td>
            <td>${escapeHTML(m.usuario)}</td>
            <td class="chico suave">${escapeHTML([m.venta_id ? 'Venta #' + m.venta_id : '', m.nota || ''].filter(Boolean).join(' · '))}</td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      contenedor.innerHTML = html;
    } catch (e) {
      contenedor.innerHTML = `<div class="vacio error">${escapeHTML(e.message)}</div>`;
    }
  }

  // ─────────────────────────── 8. Vista Usuarios (Dueño) ───────────────────────────
  async function cargarUsuarios() {
    const contenedor = $('usr-tabla');
    contenedor.innerHTML = '<div class="vacio">Cargando usuarios...</div>';

    try {
      const usuarios = await api('/api/usuarios');
      let html = `
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Tienda</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
      `;

      usuarios.forEach(u => {
        html += `
          <tr>
            <td><code>${escapeHTML(u.usuario)}</code></td>
            <td><b>${escapeHTML(u.nombre)}</b></td>
            <td><span class="etiqueta ${u.rol === 'dueno' ? 'ambar' : ''}">${u.rol === 'dueno' ? 'Dueño' : 'Vendedor'}</span></td>
            <td>${u.rol === 'dueno' ? '<i>Todas</i>' : escapeHTML(u.tienda || '-')}</td>
            <td><span class="etiqueta ${u.activo ? 'verde' : 'roja'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td class="der">
              <button type="button" class="mini btn-editar-usr" data-id="${u.id}">Editar</button>
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      contenedor.innerHTML = html;

      qsa('.btn-editar-usr', contenedor).forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const u = usuarios.find(x => x.id === id);
          if (u) abrirDialogoUsuario(u);
        });
      });
    } catch (e) {
      contenedor.innerHTML = `<div class="vacio error">${escapeHTML(e.message)}</div>`;
    }
  }

  function abrirDialogoUsuario(usr = null) {
    estado.usrEditandoId = usr ? usr.id : null;
    $('usr-titulo').textContent = usr ? 'Editar usuario' : 'Nuevo usuario';
    $('u-nombre').value = usr ? usr.nombre : '';
    $('u-usuario').value = usr ? usr.usuario : '';
    $('u-usuario').readOnly = Boolean(usr);
    $('u-clave').value = '';
    $('u-clave-label').textContent = usr ? 'Clave nueva (dejar vacía para no cambiarla)' : 'Clave (8 caracteres o más)';
    $('u-rol').value = usr ? usr.rol : 'vendedor';
    $('u-activo').checked = usr ? Boolean(usr.activo) : true;
    $('u-error').textContent = '';

    // Llenar tiendas en desplegable
    const selTienda = $('u-tienda');
    selTienda.innerHTML = estado.tiendas.map(t =>
      `<option value="${t.id}" ${usr && usr.tienda_id === t.id ? 'selected' : ''}>${escapeHTML(t.nombre)}</option>`
    ).join('');

    // Mostrar/ocultar selector de tienda según rol
    $('u-tienda-caja').hidden = $('u-rol').value === 'dueno';

    $('dlg-usuario').showModal();
    setTimeout(() => $('u-nombre').focus(), 100);
  }

  // ─────────────────────────── Caja ───────────────────────────
  function resultadoDeCaja(diferencia) {
    if (diferencia === 0) return '<span class="pos">Coincide</span>';
    return diferencia < 0
      ? `<span class="neg">Faltan ${bs(-diferencia)}</span>`
      : `<span class="bajo">Sobran ${bs(diferencia)}</span>`;
  }

  async function cargarCaja() {
    const cajaMia = $('caja-mia');
    cajaMia.innerHTML = '<div class="vacio">Cargando...</div>';
    $('caja-pendientes').innerHTML = '';
    try {
      const r = await api('/api/caja?tienda=' + estado.tiendaActual);
      const m = r.mia;
      const tienda = (estado.tiendas.find(t => t.id === m.tienda_id) || {}).nombre || '';

      if (!m.ventas && !m.anuladas && !m.devoluciones && !m.gastos) {
        cajaMia.innerHTML = `<div class="vacio">No tiene ventas sin cerrar en ${escapeHTML(tienda)}.<br>Cuando cobre algo, acá va a poder cerrar su caja.</div>`;
      } else {
        /* A la vendedora el servidor no le manda cuánto efectivo tendría que
           haber (m.efectivo no viene): tiene que contar y escribir lo que hay. */
        cajaMia.innerHTML = `
          <div class="caja-form">
            <div class="suave chico">SU CAJA EN ${escapeHTML(tienda.toUpperCase())}</div>
            <p><b>${m.ventas} ventas</b> cobradas por usted desde
              ${m.desde ? 'su último cierre (' + fechaHora(m.desde) + ')' : 'el ' + fechaHora(m.primera)}.</p>
            <ul>
              <li>Cuente solo la plata de las ventas. El cambio que había al empezar no se cuenta.</li>
              <li>Por QR entraron ${bs(m.qr)}: eso no está en la caja.</li>
              ${m.anuladas ? `<li>${m.anuladas} ventas anuladas: no suman.</li>` : ''}
              ${m.devoluciones ? `<li>Devolvió <b>${bs(m.devoluciones)}</b> de ventas que ya estaban cerradas: esa plata salió de la caja y se descuenta.</li>` : ''}
              ${m.gastos ? `<li>Anotó <b>${bs(m.gastos)}</b> en gastos y retiros: esa plata salió de la caja y se descuenta.</li>` : ''}
              ${m.efectivo !== undefined ? `<li>En efectivo tendría que haber <b>${bs(Math.max(0, m.efectivo - (m.devoluciones || 0) - (m.gastos || 0)))}</b>.</li>` : ''}
            </ul>
            <label for="caja-contado">¿Cuánta plata en efectivo hay? (Bs)</label>
            <input id="caja-contado" class="contado" inputmode="decimal" placeholder="Ej.: 350" autocomplete="off">
            <label for="caja-nota">Nota (obligatoria si la plata no coincide)</label>
            <input id="caja-nota" maxlength="200" placeholder="Ej.: di mal un vuelto, pagué un flete de Bs 20">
            <div class="error" id="caja-error"></div>
            <button class="primario" id="caja-cerrar" type="button">Cerrar mi caja</button>
          </div>
        `;
        $('caja-cerrar').addEventListener('click', cerrarCaja);
        $('caja-contado').addEventListener('keydown', e => { if (e.key === 'Enter') cerrarCaja(); });
      }

      /* Gastos y retiros: plata que sale de la caja. Va siempre a la vista,
         haya o no ventas, porque el flete se paga cuando llega el flete. */
      const gastos = m.listaGastos || [];
      $('caja-gastos').innerHTML = `
        <h3>¿Salió plata de la caja?</h3>
        <p class="suave chico">Anótelo acá cuando pasa (un flete, hielo, o si el dueño se lleva efectivo). Se descuenta solo de lo que tiene que haber al cerrar.</p>
        <div class="gasto-form">
          <div>
            <label for="gasto-tipo">Qué fue</label>
            <select id="gasto-tipo">
              <option value="gasto">Un gasto</option>
              <option value="retiro">Retiro del dueño</option>
            </select>
          </div>
          <div>
            <label for="gasto-monto">Cuánto (Bs)</label>
            <input id="gasto-monto" inputmode="decimal" placeholder="Ej.: 20" autocomplete="off">
          </div>
          <div class="ancho-total">
            <label for="gasto-motivo">En qué, o quién se la llevó</label>
            <input id="gasto-motivo" maxlength="200" placeholder="Ej.: flete del mototaxi">
          </div>
          <button type="button" id="gasto-guardar" class="ancho-total">Anotar</button>
        </div>
        <div class="error" id="gasto-error"></div>
        ${gastos.length ? `
          <div class="tabla-caja">
            <table>
              <thead><tr><th>Cuándo</th><th>Qué</th><th>Motivo</th><th class="num">Monto</th></tr></thead>
              <tbody>
                ${gastos.map(g => `
                  <tr>
                    <td class="chico suave">${fechaHora(g.fecha)}</td>
                    <td><span class="etiqueta ${g.tipo === 'retiro' ? 'ambar' : ''}">${g.tipo === 'retiro' ? 'Retiro' : 'Gasto'}</span></td>
                    <td>${escapeHTML(g.motivo)}</td>
                    <td class="num"><b>${bs(g.monto)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}
      `;
      $('gasto-guardar').addEventListener('click', async () => {
        const err = $('gasto-error');
        err.textContent = '';
        $('gasto-guardar').disabled = true;
        try {
          const g = await api('/api/gastos', 'POST', {
            tienda_id: estado.tiendaActual,
            tipo: $('gasto-tipo').value,
            monto: $('gasto-monto').value.trim(),
            motivo: $('gasto-motivo').value.trim()
          });
          mostrarAviso(`${g.tipo === 'retiro' ? 'Retiro' : 'Gasto'} de ${bs(g.monto)} anotado.`);
          cargarCaja();
        } catch (e) {
          if ($('gasto-error')) $('gasto-error').textContent = e.message;
          if ($('gasto-guardar')) $('gasto-guardar').disabled = false;
        }
      });

      // Solo el dueño: quién tiene plata cobrada sin cerrar
      if (r.pendientes && r.pendientes.length) {
        $('caja-pendientes').innerHTML = `
          <h3>Cajas sin cerrar</h3>
          <div class="tabla-caja">
            <table>
              <thead><tr><th>Tienda</th><th>Persona</th><th class="num">Ventas</th><th class="num">Efectivo cobrado</th><th>Desde</th><th></th></tr></thead>
              <tbody>
                ${r.pendientes.map(p => `
                  <tr>
                    <td><b>${escapeHTML(p.tienda)}</b></td>
                    <td>${escapeHTML(p.usuario)}</td>
                    <td class="num">${p.ventas}</td>
                    <td class="num"><b>${bs(p.efectivo)}</b></td>
                    <td class="chico ${p.primera < Date.now() - 86400000 ? 'bajo' : 'suave'}">${fechaHora(p.primera)}</td>
                    <td class="der">${p.usuario_id === estado.yo.id ? '' : `<button type="button" class="mini btn-cerrar-ajena" data-usuario="${p.usuario_id}" data-tienda="${p.tienda_id}" data-nombre="${escapeHTML(p.usuario)}" data-esperado="${p.efectivo}">Cerrarla yo</button>`}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      /* Cerrar la caja de otra persona: para la vendedora que cambió de
         tienda o se dio de baja sin cerrar. La plata la cuenta el dueño. */
      qsa('.btn-cerrar-ajena', $('caja-pendientes')).forEach(btn => {
        btn.addEventListener('click', async () => {
          const nombre = btn.dataset.nombre;
          const contado = prompt(`Cerrar la caja de ${nombre}.\nCobró ${bs(Number(btn.dataset.esperado))} en efectivo.\n\n¿Cuánta plata le entregó? (Bs)`);
          if (contado === null || contado.trim() === '') return;
          const nota = prompt('Nota (obligatoria si la plata no coincide):', 'Cerrada por el dueño') || '';
          try {
            const c = await api('/api/caja/cerrar', 'POST', { usuario_id: Number(btn.dataset.usuario), tienda_id: Number(btn.dataset.tienda), contado: contado.trim(), nota: nota.trim() });
            mostrarAviso(c.diferencia === 0 ? `Caja de ${nombre} cerrada: coincide.` : `Caja de ${nombre} cerrada. ${c.diferencia < 0 ? 'Faltan' : 'Sobran'} ${bs(Math.abs(c.diferencia))}.`, c.diferencia !== 0);
            cargarCaja();
          } catch (e) {
            mostrarAviso(e.message, true);
          }
        });
      });

      const esDueno = estado.yo.rol === 'dueno';
      $('caja-titulo-lista').textContent = esDueno ? 'Cierres de todas las tiendas' : 'Sus cierres anteriores';
      $('caja-lista').innerHTML = !r.cierres.length
        ? '<div class="vacio">Todavía no hay ningún cierre.</div>'
        : `
          <table>
            <thead>
              <tr>
                <th>Cerró</th>
                ${esDueno ? '<th>Tienda</th><th>Persona</th>' : ''}
                <th class="num">Ventas</th>
                <th class="num">Tenía que haber</th>
                <th class="num">Contó</th>
                <th>Resultado</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              ${r.cierres.map(c => `
                <tr>
                  <td class="chico suave">${fechaHora(c.hasta)}</td>
                  ${esDueno ? `<td><b>${escapeHTML(c.tienda)}</b></td><td>${escapeHTML(c.usuario)}</td>` : ''}
                  <td class="num">${c.ventas}</td>
                  <td class="num">${bs(Math.max(0, c.efectivo - (c.devoluciones || 0) - (c.gastos || 0)))}</td>
                  <td class="num"><b>${bs(c.contado)}</b></td>
                  <td>${resultadoDeCaja(c.diferencia)}</td>
                  <td class="chico suave">${escapeHTML([c.devoluciones ? 'Devolvió ' + bs(c.devoluciones) : '', c.gastos ? 'Gastos y retiros ' + bs(c.gastos) : '', c.cerrado_por ? 'La cerró ' + c.cerrado_por : '', c.nota || ''].filter(Boolean).join(' · '))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
    } catch (e) {
      cajaMia.innerHTML = `<div class="vacio error">${escapeHTML(e.message)}</div>`;
    }
  }

  async function cerrarCaja() {
    const err = $('caja-error');
    err.textContent = '';
    const contado = $('caja-contado').value.trim();
    if (contado === '') {
      err.textContent = 'Escriba cuánta plata hay. Si no hay nada en efectivo, ponga 0.';
      return;
    }
    $('caja-cerrar').disabled = true;
    try {
      const r = await api('/api/caja/cerrar', 'POST', {
        tienda_id: estado.tiendaActual,
        contado,
        nota: $('caja-nota').value.trim()
      });
      if (r.diferencia === 0) {
        mostrarAviso('Caja cerrada: la plata coincide.');
      } else {
        mostrarAviso(`Caja cerrada. ${r.diferencia < 0 ? 'Faltan' : 'Sobran'} ${bs(Math.abs(r.diferencia))}: quedó anotado.`, true);
      }
      cargarCaja();
    } catch (e) {
      /* si no coincide, el servidor lo dice acá y el formulario queda como
         estaba para contar de nuevo o escribir la nota */
      if ($('caja-error')) $('caja-error').textContent = e.message;
      if ($('caja-cerrar')) $('caja-cerrar').disabled = false;
    }
  }

  // ─────────────────────────── Reportes (Dueño) ───────────────────────────
  const fechaISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const deISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

  function fechaDia(ms) {
    return new Date(ms).toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  /* Devuelve [desde, hasta): el "hasta" es la medianoche SIGUIENTE al último
     día, así el día de hoy entra completo. */
  function rangoDelReporte() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const y = hoy.getFullYear(), m = hoy.getMonth();
    const dia = n => new Date(y, m, hoy.getDate() + n);
    switch ($('rep-periodo').value) {
      case 'hoy':        return [hoy, dia(1)];
      case 'ayer':       return [dia(-1), hoy];
      case 'semana':     return [dia(-((hoy.getDay() + 6) % 7)), dia(1)];   // desde el lunes
      case 'mes':        return [new Date(y, m, 1), dia(1)];
      case 'mes-pasado': return [new Date(y, m - 1, 1), new Date(y, m, 1)];
      default: {
        const d1 = $('rep-desde').value ? deISO($('rep-desde').value) : hoy;
        const d2 = $('rep-hasta').value ? deISO($('rep-hasta').value) : d1;
        return [d1, new Date(d2.getFullYear(), d2.getMonth(), d2.getDate() + 1)];
      }
    }
  }

  async function cargarReporte() {
    const [desde, hasta] = rangoDelReporte();
    const ultimoDia = new Date(hasta.getTime() - 1);
    $('rep-rango').textContent = fechaISO(desde) === fechaISO(ultimoDia)
      ? 'Del ' + desde.toLocaleDateString('es-BO')
      : 'Del ' + desde.toLocaleDateString('es-BO') + ' al ' + ultimoDia.toLocaleDateString('es-BO');
    $('rep-tarjetas').innerHTML = '<div class="vacio">Calculando...</div>';

    const params = new URLSearchParams({ desde: desde.getTime(), hasta: hasta.getTime() });
    if ($('rep-tienda').value) params.set('tienda', $('rep-tienda').value);
    try {
      const r = await api('/api/reporte?' + params.toString());
      estado.reporte = r;
      const t = r.totales;

      $('rep-tarjetas').innerHTML = `
        <div class="tarjeta total">
          <div class="titulo">TOTAL VENDIDO</div>
          <div class="grande pos">${bs(t.total)}</div>
          <div class="chico suave">${t.ventas} ventas${t.anuladas ? ` · <span class="neg">${t.anuladas} anuladas</span>` : ''}</div>
        </div>
        <div class="tarjeta">
          <div class="titulo">EFECTIVO</div>
          <div class="grande">${bs(t.efectivo)}</div>
          <div class="chico suave">Por QR: ${bs(t.qr)}</div>
        </div>
        <div class="tarjeta">
          <div class="titulo">GANANCIA</div>
          <div class="grande">${bs(t.ganancia)}</div>
          <div class="chico ${t.sin_costo ? 'bajo' : 'suave'}">${t.sin_costo ? `Sin contar ${t.sin_costo} u. que no tienen costo cargado` : 'Precio de venta menos costo'}</div>
        </div>
        <div class="tarjeta">
          <div class="titulo">CAJAS</div>
          <div class="grande ${r.cajas.faltante ? 'neg' : ''}">${r.cajas.faltante ? 'Faltó ' + bs(r.cajas.faltante) : 'Sin faltantes'}</div>
          <div class="chico suave">${r.cajas.cierres} cierres${r.cajas.sobrante ? ' · sobró ' + bs(r.cajas.sobrante) : ''}</div>
        </div>
        <div class="tarjeta">
          <div class="titulo">SALIÓ DE LAS CAJAS</div>
          <div class="grande">${bs((r.cajas.gastos || 0) + (r.cajas.retiros || 0))}</div>
          <div class="chico suave">Gastos: ${bs(r.cajas.gastos || 0)} · Retiros: ${bs(r.cajas.retiros || 0)}</div>
        </div>
      `;

      const tabla = (filas, columnas, vacio) => !filas.length ? `<div class="vacio">${vacio}</div>` : `
        <table>
          <thead><tr>${columnas.map(c => `<th class="${c.num ? 'num' : ''}">${c.titulo}</th>`).join('')}</tr></thead>
          <tbody>${filas.map(f => `<tr>${columnas.map(c => `<td class="${c.num ? 'num' : ''}">${c.ver(f)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      `;
      const plata = [
        { titulo: 'Ventas', num: true, ver: f => f.ventas },
        { titulo: 'Efectivo', num: true, ver: f => bs(f.efectivo) },
        { titulo: 'QR', num: true, ver: f => bs(f.qr) },
        { titulo: 'Total', num: true, ver: f => `<b class="pos">${bs(f.total)}</b>` }
      ];
      const sinVentas = 'No hubo ventas en este período.';

      $('rep-dias').innerHTML = tabla(r.porDia, [{ titulo: 'Día', ver: f => `<b>${escapeHTML(fechaDia(f.fecha))}</b>` }, ...plata], sinVentas);
      $('rep-tiendas').innerHTML = tabla(r.porTienda, [{ titulo: 'Tienda', ver: f => `<b>${escapeHTML(f.tienda)}</b>` }, ...plata], sinVentas);
      $('rep-personas').innerHTML = tabla(r.porVendedor, [
        { titulo: 'Persona', ver: f => `<b>${escapeHTML(f.vendedor)}</b>` },
        { titulo: 'Tienda', ver: f => escapeHTML(f.tienda) },
        ...plata,
        { titulo: 'Anuladas', num: true, ver: f => f.anuladas ? `<span class="neg">${f.anuladas}</span>` : '0' }
      ], sinVentas);
      $('rep-productos').innerHTML = tabla(r.porProducto, [
        { titulo: 'Producto', ver: f => `<b>${escapeHTML(f.producto)}</b>` },
        { titulo: 'Categoría', ver: f => escapeHTML(f.categoria || '-') },
        { titulo: 'Unidades', num: true, ver: f => f.unidades },
        { titulo: 'Vendido', num: true, ver: f => `<b class="pos">${bs(f.monto)}</b>` },
        { titulo: 'Ganancia', num: true, ver: f => bs(f.ganancia) }
      ], sinVentas);
    } catch (e) {
      estado.reporte = null;
      $('rep-tarjetas').innerHTML = `<div class="vacio error">${escapeHTML(e.message)}</div>`;
    }
  }

  /* Baja el reporte que está en pantalla como archivo para Excel.
     Va con punto y coma y coma decimal, que es como Excel en castellano lo
     abre bien con doble clic; y con la marca de UTF-8 adelante, para que
     las tildes no salgan rotas. */
  function bajarReporte() {
    const r = estado.reporte;
    if (!r) return mostrarAviso('Primero espere a que cargue el reporte', true);
    const n = c => (c / 100).toFixed(2).replace('.', ',');
    const celda = v => /[";\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
    const lineas = [];
    const fila = (...celdas) => lineas.push(celdas.map(celda).join(';'));
    const [desde, hasta] = [new Date(r.desde), new Date(r.hasta - 1)];
    const tienda = $('rep-tienda').selectedOptions[0].text;

    fila('Los Caseritos - Reporte de ventas');
    fila('Desde', desde.toLocaleDateString('es-BO'), 'Hasta', hasta.toLocaleDateString('es-BO'), 'Tienda', tienda);
    fila();
    fila('Total vendido', n(r.totales.total)); fila('Ventas', r.totales.ventas); fila('Efectivo', n(r.totales.efectivo));
    fila('QR', n(r.totales.qr)); fila('Ganancia', n(r.totales.ganancia)); fila('Unidades sin costo cargado', r.totales.sin_costo);
    fila('Ventas anuladas', r.totales.anuladas); fila('Cierres de caja', r.cajas.cierres);
    fila('Faltante de caja', n(r.cajas.faltante)); fila('Sobrante de caja', n(r.cajas.sobrante));
    fila('Gastos pagados de la caja', n(r.cajas.gastos || 0)); fila('Retiros del dueño', n(r.cajas.retiros || 0));
    fila();
    fila('DIA POR DIA'); fila('Día', 'Ventas', 'Efectivo', 'QR', 'Total');
    r.porDia.forEach(f => fila(new Date(f.fecha).toLocaleDateString('es-BO'), f.ventas, n(f.efectivo), n(f.qr), n(f.total)));
    fila();
    fila('POR TIENDA'); fila('Tienda', 'Ventas', 'Efectivo', 'QR', 'Total');
    r.porTienda.forEach(f => fila(f.tienda, f.ventas, n(f.efectivo), n(f.qr), n(f.total)));
    fila();
    fila('POR PERSONA'); fila('Persona', 'Tienda', 'Ventas', 'Efectivo', 'QR', 'Total', 'Anuladas');
    r.porVendedor.forEach(f => fila(f.vendedor, f.tienda, f.ventas, n(f.efectivo), n(f.qr), n(f.total), f.anuladas));
    fila();
    fila('POR PRODUCTO'); fila('Producto', 'Categoría', 'Unidades', 'Vendido', 'Ganancia');
    r.porProducto.forEach(f => fila(f.producto, f.categoria || '', f.unidades, n(f.monto), n(f.ganancia)));

    const archivo = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = 'reporte-loscaseritos-' + fechaISO(desde) + '_a_' + fechaISO(hasta) + '.csv';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 2000);
  }

  // ─────────────────────────── Inicialización y Sesión ───────────────────────────
  async function inicializar() {
    try {
      const est = await api('/api/estado');
      if (!est.configurado) {
        $('pantalla-config').hidden = false;
        $('pantalla-entrada').hidden = true;
        $('app').hidden = true;
        return;
      }

      // Probar si hay sesión activa
      try {
        const yoRes = await api('/api/yo', 'GET', undefined, { entrada: true });
        /* Venció la sesión y entró OTRA persona en esta pantalla: lo que
           estaba a medio armar no es suyo. Se empieza de cero. */
        if (estado.yo && estado.yo.id !== yoRes.usuario.id) return location.reload();
        estado.yo = yoRes.usuario;
        estado.tiendas = yoRes.tiendas;
        estado.minutosParaAnular = yoRes.minutosParaAnular || estado.minutosParaAnular;
        estado.tiendaWeb = yoRes.tiendaWeb || null;

        mostrarApp();
      } catch (e) {
        // Sin sesión -> ir a pantalla de entrada
        $('pantalla-config').hidden = true;
        $('pantalla-entrada').hidden = false;
        $('app').hidden = true;
      }
    } catch (e) {
      mostrarAviso('Error conectando con el servidor: ' + e.message, true);
    }
  }

  /* La sesión se venció con la pantalla abierta (al vendedor le dura un
     turno de 12 horas). Antes quedaba la pantalla a la vista pero muerta:
     cada toque daba un cartelito de 4 segundos y había que adivinar que
     tocaba recargar, con lo que se perdía la venta a medio armar.
     Ahora se pide la clave ahí mismo, SIN recargar: al volver a entrar la
     lista de venta, la entrada y el conteo siguen como estaban. */
  function sesionVencida() {
    if (!estado.yo || !$('pantalla-entrada').hidden) return;
    qsa('dialog[open]').forEach(d => d.close());
    $('e-usuario').value = estado.yo.usuario;
    $('e-clave').value = '';
    $('e-error').textContent = 'La sesión terminó. Entre de nuevo para seguir donde estaba.';
    $('app').hidden = true;
    $('pantalla-entrada').hidden = false;
    $('e-clave').focus();
  }

  /* ⚠️ Esto corre cada vez que se entra, y con la reentrada de arriba puede
     ser más de una vez sin recargar la página. Acá NO se enganchan eventos
     (se duplicarían): van una sola vez, abajo, con el resto. */
  function mostrarApp() {
    $('pantalla-config').hidden = true;
    $('pantalla-entrada').hidden = true;
    $('app').hidden = false;

    $('quien-nombre').textContent = estado.yo.nombre;
    $('quien-rol').textContent = estado.yo.rol === 'dueno' ? 'Dueño' : 'Vendedor';

    // Selector de tienda en cabecera
    const selTienda = $('sel-tienda');
    const tiendaFija = $('tienda-fija');

    if (estado.yo.rol === 'dueno') {
      selTienda.hidden = false;
      tiendaFija.hidden = true;
      selTienda.innerHTML = estado.tiendas.map(t =>
        `<option value="${t.id}">${escapeHTML(t.nombre)}</option>`
      ).join('');

      /* la que tenía puesta si está volviendo a entrar; si no, la que
         eligió la última vez en este equipo */
      const preferida = estado.tiendaActual || leerTiendaGuardada();
      if (estado.tiendas.some(t => t.id === preferida)) selTienda.value = String(preferida);
      estado.tiendaActual = Number(selTienda.value);
    } else {
      selTienda.hidden = true;
      tiendaFija.hidden = false;
      tiendaFija.textContent = estado.yo.tienda || 'Tienda';
      estado.tiendaActual = estado.yo.tienda_id;
    }

    // Configurar selectores de filtro por tienda en otras vistas
    $('ventas-tienda').innerHTML = '<option value="">Todas las tiendas</option>' +
      estado.tiendas.map(t => `<option value="${t.id}">${escapeHTML(t.nombre)}</option>`).join('');

    $('mov-tienda').innerHTML = '<option value="">Todas las tiendas</option>' +
      estado.tiendas.map(t => `<option value="${t.id}">${escapeHTML(t.nombre)}</option>`).join('');
    $('rep-tienda').innerHTML = $('mov-tienda').innerHTML;

    if (estado.yo.rol === 'dueno') {
      $('ventas-tienda').hidden = false;
      $('ventas-dia').hidden = false;
      if (!$('ventas-dia').value) $('ventas-dia').value = hoyISO();
    }

    const tiendaWeb = estado.tiendas.find(t => t.id === estado.tiendaWeb);
    $('stock-nota-web').textContent = tiendaWeb
      ? `🌐 La tienda web muestra el stock de ${tiendaWeb.nombre}. Lo que todavía no se contó ahí sigue con el número del panel de la web.`
      : '';

    construirPestanas();
  }

  // Cambio de tienda (solo lo ve el dueño)
  $('sel-tienda').addEventListener('change', () => {
    const sel = $('sel-tienda');
    if (estado.conteoModo && hayConteoEscrito() &&
        !confirm('Hay cantidades escritas en el conteo que todavía no se guardaron.\n¿Cambiar de tienda y perderlas?')) {
      sel.value = String(estado.tiendaActual);
      return;
    }
    estado.tiendaActual = Number(sel.value);
    guardarTienda(estado.tiendaActual);
    estado.claveVenta = null;   // la misma lista en otra tienda es otro cobro
    mostrarAviso('Tienda seleccionada: ' + sel.options[sel.selectedIndex].text);
    if (estado.vistaActiva === 'v-stock' && estado.conteoModo) {
      abrirConteo();
    } else {
      cambiarVista(estado.vistaActiva);
    }
  });

  // ─────────────────────────── Event Listeners de formularios ───────────────────────────

  // 1. Configuración inicial
  $('form-config').addEventListener('submit', async e => {
    e.preventDefault();
    const cError = $('c-error');
    cError.textContent = '';
    const clave = $('c-clave').value;
    const clave2 = $('c-clave2').value;
    if (clave !== clave2) {
      cError.textContent = 'Las contraseñas no coinciden';
      return;
    }

    try {
      await api('/api/configurar', 'POST', {
        nombre: $('c-nombre').value.trim(),
        usuario: $('c-usuario').value.trim(),
        clave
      }, { entrada: true });
      $('c-clave').value = '';
      $('c-clave2').value = '';
      inicializar();
    } catch (err) {
      cError.textContent = err.message;
    }
  });

  // 2. Login
  $('form-entrada').addEventListener('submit', async e => {
    e.preventDefault();
    const eError = $('e-error');
    eError.textContent = '';

    try {
      await api('/api/login', 'POST', {
        usuario: $('e-usuario').value.trim(),
        clave: $('e-clave').value
      }, { entrada: true });
      /* La clave no se queda escrita en la caja: la pantalla de entrada
         vuelve a aparecer cuando vence la sesión, y en un mostrador
         compartido cualquiera habría podido tocar "Entrar". */
      $('e-clave').value = '';
      inicializar();
    } catch (err) {
      eError.textContent = err.message;
    }
  });

  // Mi clave: cada uno se cambia la suya
  $('btn-mi-clave').addEventListener('click', () => {
    ['mc-actual', 'mc-nueva', 'mc-nueva2'].forEach(id => { $(id).value = ''; });
    $('mc-error').textContent = '';
    $('dlg-mi-clave').showModal();
    setTimeout(() => $('mc-actual').focus(), 100);
  });

  $('form-mi-clave').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('mc-error');
    err.textContent = '';
    if ($('mc-nueva').value !== $('mc-nueva2').value) {
      err.textContent = 'Las dos claves nuevas no coinciden';
      return;
    }
    try {
      await api('/api/mi-clave', 'POST', { actual: $('mc-actual').value, nueva: $('mc-nueva').value }, { entrada: true });
      $('dlg-mi-clave').close();
      ['mc-actual', 'mc-nueva', 'mc-nueva2'].forEach(id => { $(id).value = ''; });
      mostrarAviso('Clave cambiada. Desde ahora se entra con la nueva.');
    } catch (ex) {
      err.textContent = ex.message;
    }
  });

  // 3. Salir
  /* ⚠️ El {} no es de adorno. El servidor rechaza con 415 todo POST que no
     venga en JSON, y sin cuerpo no se manda esa cabecera: "Salir" recargaba
     la página y la sesión seguía abierta, en un equipo que usa más de una
     persona. */
  $('btn-salir').addEventListener('click', async () => {
    try {
      await api('/api/salir', 'POST', {}, { entrada: true });
    } catch (e) {
      /* si no se pudo cerrar, NO se recarga: recargar mostraría la pantalla
         de siempre y parecería que salió */
      return mostrarAviso('No se pudo cerrar la sesión: ' + e.message, true);
    }
    location.reload();
  });

  // 4. Venta: tipo de pago
  qsa('.pago', $('v-vender')).forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.pago', $('v-vender')).forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      estado.tipoPago = btn.dataset.pago;
      estado.claveVenta = null;
      $('vender-efectivo').hidden = estado.tipoPago !== 'efectivo';
      actualizarVuelto();
    });
  });

  $('vender-recibe').addEventListener('input', actualizarVuelto);

  $('vender-vaciar').addEventListener('click', () => {
    if (!estado.carrito.length) return;
    if (confirm('¿Vaciar la lista de venta?')) {
      estado.carrito = [];
      $('vender-recibe').value = '';
      carritoCambio();
      $('vender-buscar').focus();
    }
  });

  $('vender-cobrar').addEventListener('click', () => cobrar(false));
  $('vender-igual').addEventListener('click', () => cobrar(true));
  $('vender-no').addEventListener('click', () => { esconderSinStock(); $('vender-buscar').focus(); });

  async function cobrar(confirmaSinStock) {
    if (!estado.carrito.length) return;
    const cobrarBtn = $('vender-cobrar');
    cobrarBtn.disabled = true;
    $('vender-igual').disabled = true;
    /* La clave se inventa al primer intento y se conserva si falla: tocar
       Cobrar otra vez con la misma lista es EL MISMO cobro (ver carritoCambio). */
    if (!estado.claveVenta) estado.claveVenta = nuevaClave();

    try {
      const res = await api('/api/ventas', 'POST', {
        tienda_id: estado.tiendaActual,
        pago: estado.tipoPago,
        clave: estado.claveVenta,
        total_esperado: totalCarrito(),
        confirmar_sin_stock: confirmaSinStock,
        items: estado.carrito.map(it => ({
          producto_id: it.p.id,
          variante: it.variante || undefined,
          cantidad: it.cantidad
        }))
      });

      if (res.repetida) {
        mostrarAviso(`Esa venta ya había quedado registrada (#${res.id}, ${bs(res.total)}). No se cobró dos veces.`);
      } else {
        mostrarAviso(`Cobrado con éxito: ${bs(res.total)} (${res.pago.toUpperCase()})`);
      }
      /* si ya confirmó que lo tenía en la mano, no se le repite en un cartel */
      if (res.avisos && res.avisos.length && !confirmaSinStock) {
        alert('Avisos de inventario:\n' + res.avisos.join('\n'));
      }

      estado.carrito = [];
      $('vender-recibe').value = '';
      carritoCambio();
      cargarProductos(); // actualizar stock en caché
      $('vender-buscar').focus();
    } catch (e) {
      if (e.sinConexion) {
        mostrarAviso('Se cortó la conexión y no se sabe si la venta llegó. Toque Cobrar otra vez: si ya había entrado, no se registra dos veces.', true);
      } else if (e.datos && e.datos.sinStock) {
        /* no es un error: es una pregunta. La venta todavía no se hizo. */
        preguntarSinStock(e.datos.sinStock);
      } else {
        mostrarAviso(e.message, true);
        /* El servidor frenó la venta (cambió un precio, dieron de baja un
           producto). Se traen los datos nuevos para que la lista muestre
           lo que de verdad se va a cobrar. */
        if (e.estado !== 401) {
          await cargarProductos();
          renderVentaLista();
        }
      }
    } finally {
      cobrarBtn.disabled = !estado.carrito.length;
      $('vender-igual').disabled = false;
    }
  }

  // Buscadores
  configurarBuscador('vender-buscar', 'vender-resultados', agregarAlCarrito, true);
  configurarBuscador('recibir-buscar', 'recibir-resultados', agregarARecibir);

  // 5. Guardar Entrada de mercadería
  $('recibir-guardar').addEventListener('click', async () => {
    if (!estado.recibirItems.length) return;
    const btn = $('recibir-guardar');
    btn.disabled = true;

    try {
      const res = await api('/api/entradas', 'POST', {
        tienda_id: estado.tiendaActual,
        nota: $('recibir-nota').value.trim(),
        items: estado.recibirItems.map(it => ({
          producto_id: it.p.id,
          cantidad: it.cantidad
        }))
      });

      mostrarAviso(`Entrada registrada: ${res.unidades} unidades de ${res.productos} productos.`);
      estado.recibirItems = [];
      $('recibir-nota').value = '';
      renderRecibirLista();
      cargarProductos();
    } catch (e) {
      mostrarAviso(e.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  // 6. Vista Hoy: Actualizar
  $('hoy-actualizar').addEventListener('click', cargarHoy);

  // 7. Filtros Ventas
  $('ventas-dia').addEventListener('change', cargarVentas);
  $('ventas-tienda').addEventListener('change', cargarVentas);

  // 8. Stock
  $('stock-buscar').addEventListener('input', () => {
    if (estado.conteoModo) filtrarConteo();
    else renderStock();
  });
  $('stock-problemas').addEventListener('change', renderStock);
  /* Contar con el lector: Enter en el buscador salta a la casilla del primer
     producto que quedó a la vista; Enter en la casilla vuelve al buscador
     con el texto seleccionado, listo para escanear el siguiente. */
  $('stock-buscar').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !estado.conteoModo) return;
    e.preventDefault();
    const casilla = qsa('tbody tr', $('conteo-tabla')).filter(tr => !tr.hidden).map(tr => tr.querySelector('.input-conteo'))[0];
    if (casilla) {
      casilla.focus();
    } else {
      pitidoDeError();
      $('stock-buscar').select();
    }
  });
  $('conteo-tabla').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.classList.contains('input-conteo')) return;
    e.preventDefault();
    $('stock-buscar').focus();
    $('stock-buscar').select();
  });
  $('stock-contar').addEventListener('click', abrirConteo);

  // Traspaso entre tiendas
  $('stock-traspaso').addEventListener('click', abrirTraspaso);
  $('tras-cancelar').addEventListener('click', cerrarTraspaso);
  $('tras-guardar').addEventListener('click', guardarTraspaso);
  $('tras-origen').addEventListener('change', renderTraspaso);
  configurarBuscador('tras-buscar', 'tras-resultados', agregarATraspaso);
  $('tras-lista').addEventListener('change', e => {
    if (!e.target.classList.contains('input-tras')) return;
    const i = Number(e.target.dataset.i);
    const n = parseInt(e.target.value, 10);
    if (n > 0) estado.traspasoItems[i].cantidad = n;
    else estado.traspasoItems.splice(i, 1);
    renderTraspaso();
  });
  $('tras-lista').addEventListener('click', e => {
    const btn = e.target.closest('.btn-tras-quitar');
    if (!btn) return;
    estado.traspasoItems.splice(Number(btn.dataset.i), 1);
    renderTraspaso();
  });
  $('conteo-cancelar').addEventListener('click', cerrarConteo);
  $('conteo-guardar').addEventListener('click', guardarConteo);

  // 9. Productos
  $('prod-buscar').addEventListener('input', renderProductosAdmin);
  $('prod-inactivos').addEventListener('change', cargarProductosAdmin);
  $('prod-nuevo').addEventListener('click', () => abrirDialogoProducto(null));
  $('prod-importar').addEventListener('click', async () => {
    try {
      const r = await api('/api/productos/importar', 'POST', {});
      const partes = [];
      if (r.nuevos) partes.push(`${r.nuevos} nuevos`);
      if (r.actualizados) partes.push(`${r.actualizados} con cambios`);
      if (r.vinculados) partes.push(`${r.vinculados} vinculados con uno que ya estaba`);
      if (r.desvinculados) partes.push(`${r.desvinculados} que ya no están en la web`);
      if (r.salteados) partes.push(`${r.salteados} mal cargados en la web, sin traer`);
      mostrarAviso('Sincronizado con la web: ' + (partes.join(', ') || 'no había nada nuevo') + '.', r.salteados > 0);
      cargarProductosAdmin();
    } catch (e) {
      mostrarAviso(e.message, true);
    }
  });

  $('form-producto').addEventListener('submit', async e => {
    e.preventDefault();
    const pError = $('p-error');
    pError.textContent = '';

    const payload = {
      id: estado.prodEditandoId,
      nombre: $('p-nombre').value.trim(),
      categoria: $('p-categoria').value.trim(),
      codigo: $('p-codigo').value.trim() || null,
      precio: $('p-precio').value.trim(),
      precio_antes: $('p-antes').value.trim() || null,
      costo: $('p-costo').value.trim() || null,
      stock_minimo: $('p-minimo').value.trim() || 0,
      activo: $('p-activo').checked
    };

    try {
      await api('/api/productos', 'POST', payload);
      $('dlg-producto').close();
      mostrarAviso('Producto guardado correctamente');
      cargarProductosAdmin();
    } catch (err) {
      pError.textContent = err.message;
    }
  });

  // Reportes
  $('rep-periodo').addEventListener('change', () => {
    const aMano = $('rep-periodo').value === 'elegir';
    $('rep-desde').hidden = !aMano;
    $('rep-hasta').hidden = !aMano;
    if (aMano && !$('rep-desde').value) {
      $('rep-desde').value = hoyISO();
      $('rep-hasta').value = hoyISO();
    }
    cargarReporte();
  });
  $('rep-desde').addEventListener('change', cargarReporte);
  $('rep-hasta').addEventListener('change', cargarReporte);
  $('rep-tienda').addEventListener('change', cargarReporte);
  $('rep-excel').addEventListener('click', bajarReporte);

  // 10. Movimientos
  $('mov-tienda').addEventListener('change', cargarMovimientos);
  $('mov-tipo').addEventListener('change', cargarMovimientos);

  // 11. Usuarios
  $('usr-nuevo').addEventListener('click', () => abrirDialogoUsuario(null));
  $('u-rol').addEventListener('change', () => {
    $('u-tienda-caja').hidden = $('u-rol').value === 'dueno';
  });

  $('form-usuario').addEventListener('submit', async e => {
    e.preventDefault();
    const uError = $('u-error');
    uError.textContent = '';

    const payload = {
      id: estado.usrEditandoId,
      nombre: $('u-nombre').value.trim(),
      usuario: $('u-usuario').value.trim(),
      clave: $('u-clave').value || undefined,
      rol: $('u-rol').value,
      tienda_id: $('u-rol').value === 'vendedor' ? Number($('u-tienda').value) : null,
      activo: $('u-activo').checked
    };

    try {
      await api('/api/usuarios', 'POST', payload);
      $('dlg-usuario').close();
      mostrarAviso('Usuario guardado correctamente');
      cargarUsuarios();
    } catch (err) {
      uError.textContent = err.message;
    }
  });

  // Botones de cancelar en diálogos
  qsa('[data-cerrar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dlg = btn.closest('dialog');
      if (dlg) dlg.close();
    });
  });

  // Arrancar aplicación
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializar);
  } else {
    inicializar();
  }
})();
