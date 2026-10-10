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
    usrEditandoId: null     // id del usuario que se está editando
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

  async function api(ruta, metodo = 'GET', cuerpo = undefined) {
    const opts = {
      method: metodo,
      headers: {}
    };
    if (cuerpo !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(cuerpo);
    }
    const res = await fetch(ruta, opts);
    let datos = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      datos = await res.json();
    } else {
      datos = await res.text();
    }

    if (!res.ok) {
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
    { id: 'v-stock', label: '📦 Stock' },
    { id: 'v-productos', label: '🏷️ Productos' },
    { id: 'v-movimientos', label: '📜 Movimientos' },
    { id: 'v-usuarios', label: '👥 Usuarios' }
  ];

  const VISTAS_VENDEDOR = [
    { id: 'v-vender', label: '🛒 Vender' },
    { id: 'v-recibir', label: '📥 Recibir' },
    { id: 'v-ventas', label: '🧾 Ventas de hoy' }
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

    // Pestaña inicial por defecto
    const inicial = estado.yo.rol === 'dueno' ? 'v-hoy' : 'v-vender';
    cambiarVista(inicial);
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
      case 'v-usuarios':
        cargarUsuarios();
        break;
    }
  }

  // ─────────────────────────── Carga de datos base ───────────────────────────
  async function cargarProductos() {
    try {
      estado.productos = await api('/api/productos');
      actualizarDatalistCategorias();
    } catch (e) {
      mostrarAviso(e.message, true);
    }
  }

  function actualizarDatalistCategorias() {
    const dl = $('lista-categorias');
    if (!dl) return;
    const cats = [...new Set(estado.productos.map(p => p.categoria).filter(Boolean))].sort();
    dl.innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">`).join('');
  }

  function escaparAttr(s) {
    return String(s || '').replace(/"/g, '&quot;');
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

      res.porTienda.forEach(t => {
        granTotal += t.total;
        granVentas += t.ventas;
        granEfectivo += t.efectivo;
        granQr += t.qr;

        const card = document.createElement('div');
        card.className = 'tarjeta';
        card.innerHTML = `
          <div class="titulo">${escapeHTML(t.tienda)}</div>
          <div class="grande">${bs(t.total)}</div>
          <div class="chico suave">
            ${t.ventas} ventas · Ef: ${bs(t.efectivo)} · QR: ${bs(t.qr)}
            ${t.anuladas ? `<br><span class="etiqueta roja">${t.anuladas} anuladas</span>` : ''}
            ${t.ganancia ? `<br><span class="pos">Ganancia: ${bs(t.ganancia)}</span>` : ''}
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
        <div class="chico suave">${granVentas} ventas en total · Ef: ${bs(granEfectivo)} · QR: ${bs(granQr)}</div>
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
  function agregarAlCarrito(producto) {
    const item = estado.carrito.find(it => it.p.id === producto.id);
    if (item) {
      item.cantidad += 1;
    } else {
      estado.carrito.push({ p: producto, cantidad: 1 });
    }
    renderVentaLista();
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

    let sumaCentavos = 0;
    let html = `
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th class="num">Precio</th>
            <th style="text-align:center">Cant.</th>
            <th class="num">Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `;

    estado.carrito.forEach((it, idx) => {
      const subtotal = it.p.precio * it.cantidad;
      sumaCentavos += subtotal;
      html += `
        <tr>
          <td>
            <b>${escapeHTML(it.p.nombre)}</b>
            ${it.p.codigo ? `<div class="chico suave">${escapeHTML(it.p.codigo)}</div>` : ''}
          </td>
          <td class="num">${bs(it.p.precio)}</td>
          <td style="text-align:center">
            <div class="cant">
              <button type="button" class="mini btn-restar" data-idx="${idx}">-</button>
              <input type="number" min="1" max="10000" class="input-cant" data-idx="${idx}" value="${it.cantidad}">
              <button type="button" class="mini btn-sumar" data-idx="${idx}">+</button>
            </div>
          </td>
          <td class="num"><b>${bs(subtotal)}</b></td>
          <td style="text-align:right">
            <button type="button" class="mini peligro btn-quitar" data-idx="${idx}">✕</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    contenedor.innerHTML = html;

    $('vender-total').textContent = bs(sumaCentavos);
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
        renderVentaLista();
      });
    });

    qsa('.btn-sumar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        estado.carrito[i].cantidad++;
        renderVentaLista();
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
        renderVentaLista();
      });
    });

    qsa('.btn-quitar', contenedor).forEach(b => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.idx);
        estado.carrito.splice(i, 1);
        renderVentaLista();
      });
    });
  }

  function actualizarVuelto() {
    const totalCentavos = estado.carrito.reduce((s, it) => s + it.p.precio * it.cantidad, 0);
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
  function configurarBuscador(inputId, resultadosId, onElegir) {
    const input = $(inputId);
    const box = $(resultadosId);

    function buscar(termino) {
      const q = termino.trim().toLowerCase();
      if (!q) {
        box.hidden = true;
        box.innerHTML = '';
        return [];
      }
      const match = estado.productos.filter(p => {
        if (!p.activo) return false;
        if (p.codigo && p.codigo.toLowerCase() === q) return true;
        if (p.codigo && p.codigo.toLowerCase().includes(q)) return true;
        if (p.nombre && p.nombre.toLowerCase().includes(q)) return true;
        if (p.categoria && p.categoria.toLowerCase().includes(q)) return true;
        return false;
      }).slice(0, 15);

      if (!match.length) {
        box.hidden = false;
        box.innerHTML = '<div class="resultado suave">No se encontraron productos coincidentes</div>';
        return [];
      }

      box.hidden = false;
      box.innerHTML = match.map((p, i) => `
        <button type="button" class="resultado" data-id="${p.id}">
          <div>
            <b>${escapeHTML(p.nombre)}</b>
            <div class="sub">${escapeHTML(p.categoria || 'Sin cat')} ${p.codigo ? '· Cód: ' + escapeHTML(p.codigo) : ''}</div>
          </div>
          <div class="pos"><b>${bs(p.precio)}</b></div>
        </button>
      `).join('');

      qsa('.resultado', box).forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const prod = estado.productos.find(x => x.id === id);
          if (prod) {
            onElegir(prod);
            input.value = '';
            box.hidden = true;
            input.focus();
          }
        });
      });
      return match;
    }

    input.addEventListener('input', () => {
      buscar(input.value);
    });

    // Soporte para lector de código de barras (Enter)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        if (!q) return;

        // Búsqueda por código exacto primero
        let prod = estado.productos.find(p => p.activo && p.codigo && p.codigo.toLowerCase() === q);
        if (!prod) {
          const res = estado.productos.filter(p => p.activo && (
            (p.codigo && p.codigo.toLowerCase().includes(q)) ||
            (p.nombre && p.nombre.toLowerCase().includes(q))
          ));
          if (res.length === 1) {
            prod = res[0];
          }
        }

        if (prod) {
          onElegir(prod);
          input.value = '';
          box.hidden = true;
          input.focus();
        } else {
          buscar(input.value);
        }
      } else if (e.key === 'Escape') {
        box.hidden = true;
      }
    });

    document.addEventListener('click', evt => {
      if (!input.contains(evt.target) && !box.contains(evt.target)) {
        box.hidden = true;
      }
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
            <th style="text-align:center">Cantidad a ingresar</th>
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
          <td style="text-align:center">
            <div class="cant">
              <button type="button" class="mini btn-rec-restar" data-idx="${idx}">-</button>
              <input type="number" min="1" max="100000" class="input-rec-cant" data-idx="${idx}" value="${it.cantidad}">
              <button type="button" class="mini btn-rec-sumar" data-idx="${idx}">+</button>
            </div>
          </td>
          <td style="text-align:right">
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

    const params = new URLSearchParams();
    if (estado.yo.rol === 'dueno') {
      const tiendaFiltro = $('ventas-tienda').value;
      if (tiendaFiltro) params.set('tienda', tiendaFiltro);

      const fechaFiltro = $('ventas-dia').value;
      if (fechaFiltro) {
        // Formato YYYY-MM-DD
        const [y, m, d] = fechaFiltro.split('-').map(Number);
        const inicio = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
        const fin = inicio + 86400000;
        params.set('desde', inicio);
        params.set('hasta', fin);
      }
    }

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
          <div class="titulo">POR MEDIO DE PAGO</div>
          <div class="grande">${bs(efectivo)}</div>
          <div class="chico suave">Efectivo: ${bs(efectivo)} · QR: ${bs(qr)}</div>
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
          (estado.yo.rol === 'vendedor' && v.usuario_id === estado.yo.id && (Date.now() - v.fecha) <= 30 * 60000)
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
              <div class="chico neg" style="margin-top:6px">
                Anulada por ${escapeHTML(v.anulada_por || '')}: <i>${escapeHTML(v.motivo_anulacion)}</i> (${fechaHora(v.anulada_fecha)})
              </div>
            ` : ''}
            <div class="detalle">
              ${(v.items || []).map(it => `
                <div>${it.cantidad}x <b>${escapeHTML(it.nombre)}</b> (${bs(it.precio_unit)} c/u) = ${bs(it.cantidad * it.precio_unit)}</div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

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
  async function cargarStock() {
    const contenedor = $('stock-tabla');
    contenedor.innerHTML = '<div class="vacio">Cargando stock...</div>';

    await cargarProductos();
    const filtro = $('stock-buscar').value.trim().toLowerCase();
    const soloProblemas = $('stock-problemas').checked;

    let lista = estado.productos.filter(p => p.activo);
    if (filtro) {
      lista = lista.filter(p =>
        (p.nombre && p.nombre.toLowerCase().includes(filtro)) ||
        (p.codigo && p.codigo.toLowerCase().includes(filtro)) ||
        (p.categoria && p.categoria.toLowerCase().includes(filtro))
      );
    }

    if (soloProblemas) {
      lista = lista.filter(p => {
        const stocks = p.stock_tiendas || {};
        return estado.tiendas.some(t => {
          const s = stocks[t.id] || 0;
          return s < 0 || (p.stock_minimo > 0 && s <= p.stock_minimo);
        });
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
            ${estado.tiendas.map(t => `<th class="num">${escapeHTML(t.nombre)}</th>`).join('')}
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
        const s = stocks[t.id] || 0;
        totalStock += s;
        let clase = '';
        if (s < 0) clase = 'neg';
        else if (p.stock_minimo > 0 && s <= p.stock_minimo) clase = 'bajo';

        html += `<td class="num ${clase}"><b>${s}</b></td>`;
      });

      html += `<td class="num pos"><b>${totalStock}</b></td></tr>`;
    });

    html += '</tbody></table>';
    contenedor.innerHTML = html;
  }

  function abrirConteo() {
    estado.conteoModo = true;
    $('conteo').hidden = false;
    $('stock-contar').hidden = true;

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
            <th class="num" style="width:140px">Conteo Físico Real</th>
          </tr>
        </thead>
        <tbody>
    `;

    estado.productos.filter(p => p.activo).forEach(p => {
      const actual = (p.stock_tiendas && p.stock_tiendas[tiendaId]) || 0;
      html += `
        <tr>
          <td>
            <b>${escapeHTML(p.nombre)}</b>
            ${p.codigo ? `<div class="chico suave">${escapeHTML(p.codigo)}</div>` : ''}
          </td>
          <td class="num suave">${actual}</td>
          <td class="num">
            <input type="number" min="0" max="100000" class="input-conteo" data-id="${p.id}" placeholder="${actual}">
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    tabla.innerHTML = html;
  }

  function cerrarConteo() {
    estado.conteoModo = false;
    $('conteo').hidden = true;
    $('stock-contar').hidden = false;
    $('conteo-nota').value = '';
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

  // ─────────────────────────── 6. Vista Productos (Dueño) ───────────────────────────
  async function cargarProductosAdmin() {
    const contenedor = $('prod-tabla');
    contenedor.innerHTML = '<div class="vacio">Cargando catálogo...</div>';

    const inactivos = $('prod-inactivos').checked;
    try {
      estado.productos = await api('/api/productos?inactivos=' + (inactivos ? '1' : '0'));
      actualizarDatalistCategorias();

      const filtro = $('prod-buscar').value.trim().toLowerCase();
      let lista = estado.productos;
      if (filtro) {
        lista = lista.filter(p =>
          (p.nombre && p.nombre.toLowerCase().includes(filtro)) ||
          (p.codigo && p.codigo.toLowerCase().includes(filtro)) ||
          (p.categoria && p.categoria.toLowerCase().includes(filtro))
        );
      }

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
            <td><b>${escapeHTML(p.nombre)}</b></td>
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
            <td style="text-align:right">
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
    } catch (e) {
      contenedor.innerHTML = `<div class="vacio error">${escapeHTML(e.message)}</div>`;
    }
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

    $('dlg-producto').showModal();
    setTimeout(() => $('p-nombre').focus(), 100);
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
            <td class="chico suave">${escapeHTML(m.nota || (m.venta_id ? 'Venta #' + m.venta_id : ''))}</td>
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
            <td style="text-align:right">
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
        const yoRes = await api('/api/yo');
        estado.yo = yoRes.usuario;
        estado.tiendas = yoRes.tiendas;

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

      estado.tiendaActual = Number(selTienda.value);
      selTienda.addEventListener('change', () => {
        estado.tiendaActual = Number(selTienda.value);
        mostrarAviso('Tienda seleccionada: ' + selTienda.options[selTienda.selectedIndex].text);
        if (estado.vistaActiva === 'v-stock' && estado.conteoModo) {
          abrirConteo();
        } else {
          cambiarVista(estado.vistaActiva);
        }
      });
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

    if (estado.yo.rol === 'dueno') {
      $('ventas-tienda').hidden = false;
      $('ventas-dia').hidden = false;
    }

    construirPestanas();
  }

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
      });
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
      });
      inicializar();
    } catch (err) {
      eError.textContent = err.message;
    }
  });

  // 3. Salir
  $('btn-salir').addEventListener('click', async () => {
    try {
      await api('/api/salir', 'POST');
    } finally {
      location.reload();
    }
  });

  // 4. Venta: tipo de pago
  qsa('.pago', $('v-vender')).forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.pago', $('v-vender')).forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      estado.tipoPago = btn.dataset.pago;
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
      renderVentaLista();
      $('vender-buscar').focus();
    }
  });

  $('vender-cobrar').addEventListener('click', async () => {
    if (!estado.carrito.length) return;
    const cobrarBtn = $('vender-cobrar');
    cobrarBtn.disabled = true;

    try {
      const res = await api('/api/ventas', 'POST', {
        tienda_id: estado.tiendaActual,
        pago: estado.tipoPago,
        items: estado.carrito.map(it => ({
          producto_id: it.p.id,
          cantidad: it.cantidad
        }))
      });

      mostrarAviso(`Cobrado con éxito: ${bs(res.total)} (${res.pago.toUpperCase()})`);
      if (res.avisos && res.avisos.length) {
        alert('Avisos de inventario:\n' + res.avisos.join('\n'));
      }

      estado.carrito = [];
      $('vender-recibe').value = '';
      renderVentaLista();
      cargarProductos(); // actualizar stock en caché
      $('vender-buscar').focus();
    } catch (e) {
      mostrarAviso(e.message, true);
    } finally {
      cobrarBtn.disabled = false;
    }
  });

  // Buscadores
  configurarBuscador('vender-buscar', 'vender-resultados', agregarAlCarrito);
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
  $('stock-buscar').addEventListener('input', cargarStock);
  $('stock-problemas').addEventListener('change', cargarStock);
  $('stock-contar').addEventListener('click', abrirConteo);
  $('conteo-cancelar').addEventListener('click', cerrarConteo);
  $('conteo-guardar').addEventListener('click', guardarConteo);

  // 9. Productos
  $('prod-buscar').addEventListener('input', cargarProductosAdmin);
  $('prod-inactivos').addEventListener('change', cargarProductosAdmin);
  $('prod-nuevo').addEventListener('click', () => abrirDialogoProducto(null));
  $('prod-importar').addEventListener('click', async () => {
    if (!confirm('¿Importar productos desde la tienda online (productos.json)?')) return;
    try {
      const r = await api('/api/productos/importar', 'POST', {});
      mostrarAviso(`Importación completa: ${r.nuevos} nuevos, ${r.yaEstaban} ya estaban.`);
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
      tienda_id: $('u-rol').value === 'vendedor' ? Number($'u-tienda').value : null,
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
  document.addEventListener('DOMContentLoaded', inicializar);
})();
