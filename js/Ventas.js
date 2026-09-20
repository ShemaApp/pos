// Ventas.js — Módulo de ventas. Independiente: una venta puede existir sin
// cliente. Solo si el método de pago es "crédito" se exige cliente (ahí se
// crea automáticamente un Crédito, igual que si viniera del módulo Créditos).
const { useState, useEffect, useMemo } = React;

const CAJERO_KEY = 'inventario-app:cajero';

const METODOS_PAGO = [
  { key: 'efectivo', label: 'Efectivo' }, // primero: es el método prioritario
  { key: 'tarjeta', label: 'Tarjeta' },
  { key: 'transferencia', label: 'Transferencia' },
  { key: 'credito', label: 'Crédito (fiado)' },
];

const ESTADOS_VENTA = {
  completada: { label: 'Completada', className: 'badge-ok' },
  cancelada: { label: 'Cancelada', className: 'badge-danger' },
};

function CobroModal({ total, clienteSeleccionado, clientesActivos, onSeleccionarCliente, onQuitarCliente, onConfirmar, onClose }) {
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [autorizoFiado, setAutorizoFiado] = useState('');
  const [buscarCliente, setBuscarCliente] = useState('');
  const [error, setError] = useState('');

  const coincidencias = useMemo(() => {
    const q = buscarCliente.trim().toLowerCase();
    if (!q) return [];
    return clientesActivos.filter((c) => c.nombre.toLowerCase().includes(q)).slice(0, 5);
  }, [buscarCliente, clientesActivos]);

  const confirmar = async () => {
    if (metodoPago === 'credito' && !clienteSeleccionado) {
      setError('El crédito requiere seleccionar un cliente.');
      return;
    }
    if (metodoPago === 'credito' && !autorizoFiado.trim()) {
      setError('Indica quién autorizó el fiado.');
      return;
    }
    setError('');
    await onConfirmar(metodoPago, metodoPago === 'credito' ? autorizoFiado.trim() : undefined);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Cobrar</h3>
        <p className="resumen-valor" style={{ marginBottom: 12 }}>${window.AppUtils.formatMoney(total)}</p>
        {error && <p className="error-text">{error}</p>}

        <label className="field">Método de pago</label>
        <div className="chip-group">
          {METODOS_PAGO.map((m) => (
            <button
              key={m.key}
              type="button"
              className={metodoPago === m.key ? 'chip chip-active' : 'chip'}
              onClick={() => setMetodoPago(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {metodoPago === 'credito' && (
          <React.Fragment>
            <label className="field" style={{ marginTop: 12 }}>
              Cliente
              {clienteSeleccionado ? (
                <div className="filtro-activo" style={{ marginTop: 5 }}>
                  {clienteSeleccionado.nombre}
                  <button className="btn-link" onClick={onQuitarCliente}>Quitar</button>
                </div>
              ) : (
                <React.Fragment>
                  <input type="text" value={buscarCliente} onChange={(e) => setBuscarCliente(e.target.value)} placeholder="Buscar cliente..." />
                  {coincidencias.length > 0 && (
                    <ul className="activity-list">
                      {coincidencias.map((c) => (
                        <li key={c.id} className="clickable" onClick={() => { onSeleccionarCliente(c); setBuscarCliente(''); }}>
                          <span>{c.nombre}</span>
                          <span>{c.telefono || ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </React.Fragment>
              )}
            </label>
            <label className="field">
              ¿Quién autorizó el fiado?
              <input type="text" value={autorizoFiado} onChange={(e) => setAutorizoFiado(e.target.value)} />
            </label>
          </React.Fragment>
        )}

        {metodoPago !== 'credito' && (
          <label className="field" style={{ marginTop: 12 }}>
            Cliente (opcional)
            {clienteSeleccionado ? (
              <div className="filtro-activo" style={{ marginTop: 5 }}>
                {clienteSeleccionado.nombre}
                <button className="btn-link" onClick={onQuitarCliente}>Quitar</button>
              </div>
            ) : (
              <React.Fragment>
                <input type="text" value={buscarCliente} onChange={(e) => setBuscarCliente(e.target.value)} placeholder="Buscar cliente..." />
                {coincidencias.length > 0 && (
                  <ul className="activity-list">
                    {coincidencias.map((c) => (
                      <li key={c.id} className="clickable" onClick={() => { onSeleccionarCliente(c); setBuscarCliente(''); }}>
                        <span>{c.nombre}</span>
                        <span>{c.telefono || ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </React.Fragment>
            )}
          </label>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={confirmar}>Confirmar cobro</button>
        </div>
      </div>
    </div>
  );
}

function VentaDetalle({ venta, clienteNombre, onVolver, onCancelar, permisos }) {
  return (
    <div className="card form-card">
      <button type="button" className="btn-link" onClick={onVolver}>&larr; Volver a ventas</button>
      <h3>Venta #{venta.id}</h3>
      <p className="detail-sub">
        {new Date(venta.fecha).toLocaleString('es')} · {clienteNombre || 'Público general'}
        {' · '}
        <span className={`badge ${ESTADOS_VENTA[venta.estado].className}`}>{ESTADOS_VENTA[venta.estado].label}</span>
      </p>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
          <tbody>
            {venta.items.map((it, i) => (
              <tr key={i}>
                <td>{it.nombre}</td>
                <td>{it.cantidad}</td>
                <td>${window.AppUtils.formatMoney(it.precioUnitario)}</td>
                <td>${window.AppUtils.formatMoney(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="resumen-grid">
        <div className="resumen-item"><span className="resumen-label">Total</span><span className="resumen-valor">${window.AppUtils.formatMoney(venta.total)}</span></div>
        <div className="resumen-item"><span className="resumen-label">Método</span><span className="resumen-valor">{METODOS_PAGO.find((m) => m.key === venta.metodoPago)?.label}</span></div>
      </div>

      <p className="detail-sub">Creó: {venta.creadoPor || '—'}</p>
      {venta.metodoPago === 'credito' && <p className="detail-sub">Fiado autorizado por: {venta.autorizoFiado || '—'}</p>}

      {venta.estado === 'completada' && permisos.eliminar && (
        <div className="form-actions">
          <button className="btn-link danger" onClick={() => onCancelar(venta)}>Cancelar venta</button>
        </div>
      )}
    </div>
  );
}

function VentasModule({ permisos }) {
  const p = permisos || window.AppPermisos.permisosCompletos().ventas;
  const [productos, setProductos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [vista, setVista] = useState('vender'); // 'vender' | 'historial' | 'detalle'
  const [ventaActual, setVentaActual] = useState(null);

  const [carrito, setCarrito] = useState([]);
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [scannerAbierto, setScannerAbierto] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [cobroAbierto, setCobroAbierto] = useState(false);
  const [cajero, setCajero] = useState(() => localStorage.getItem(CAJERO_KEY) || '');
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    const [p, c, v] = await Promise.all([
      window.AppDB.productos.getAll(),
      window.AppDB.clientes.getAll(),
      window.AppDB.ventas.getAll(),
    ]);
    setProductos(p);
    setClientes(c);
    setVentas(v);
  };

  useEffect(() => { cargar(); }, []);

  const flash = (msg) => { setMensaje(msg); setTimeout(() => setMensaje(''), 3000); };

  const guardarCajero = (v) => { setCajero(v); localStorage.setItem(CAJERO_KEY, v); };

  // Regla: producto archivado o eliminado no debe aparecer/poder venderse.
  const productosVendibles = useMemo(() => productos.filter((p) => p.estado === 'activo'), [productos]);
  const clientesActivos = useMemo(() => clientes.filter((c) => c.estado === 'activo'), [clientes]);
  const clientePorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);

  const coincidenciasProducto = useMemo(() => {
    const q = busquedaProducto.trim().toLowerCase();
    if (!q) return [];
    return productosVendibles
      .filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigoBarras || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [busquedaProducto, productosVendibles]);

  const total = useMemo(() => carrito.reduce((acc, it) => acc + it.precioUnitario * it.cantidad, 0), [carrito]);

  const agregarProducto = (p) => {
    setCarrito((prev) => {
      const existente = prev.find((it) => it.productoId === p.id);
      if (existente) {
        return prev.map((it) => (it.productoId === p.id ? { ...it, cantidad: it.cantidad + 1 } : it));
      }
      return [...prev, { productoId: p.id, nombre: p.nombre, precioUnitario: p.precio || 0, cantidad: 1, existenciaDisponible: p.existencia || 0 }];
    });
    setBusquedaProducto('');
  };

  const cambiarCantidad = (productoId, cantidad) => {
    setCarrito((prev) => prev.map((it) => (it.productoId === productoId ? { ...it, cantidad } : it)));
  };

  const quitarDelCarrito = (productoId) => setCarrito((prev) => prev.filter((it) => it.productoId !== productoId));

  const manejarEscaneo = (codigo) => {
    setScannerAbierto(false);
    const p = productosVendibles.find((p) => p.codigoBarras === codigo);
    if (p) agregarProducto(p);
    else alert('Ningún producto activo tiene ese código.');
  };

  const confirmarVenta = async (metodoPago, autorizoFiado) => {
    if (carrito.length === 0) return;

    // Validar existencia; si algún ítem la supera, se pide confirmación (permite stock negativo, igual que abonos sobre saldo).
    const faltantes = carrito.filter((it) => it.cantidad > it.existenciaDisponible);
    if (faltantes.length > 0) {
      const continuar = confirm(
        `Estos productos no tienen existencia suficiente:\n` +
        faltantes.map((f) => `${f.nombre} (disponible: ${f.existenciaDisponible})`).join('\n') +
        `\n\n¿Continuar de todas formas?`
      );
      if (!continuar) return;
    }

    // Descontar inventario.
    for (const it of carrito) {
      const producto = await window.AppDB.productos.get(it.productoId);
      if (!producto) continue;
      const nuevaExistencia = (producto.existencia || 0) - it.cantidad;
      await window.AppDB.productos.put({ ...producto, existencia: nuevaExistencia });
      await window.AppMovimientos.registrar('inventario', 'existencia_vendida', {
        entidadId: producto.id,
        entidadNombre: producto.nombre,
        detalle: `-${it.cantidad} por venta`,
      });
    }

    const nombreCliente = clienteSeleccionado ? clienteSeleccionado.nombre : undefined;

    const ventaId = await window.AppDB.ventas.add({
      fecha: new Date().toISOString(),
      clienteId: clienteSeleccionado ? clienteSeleccionado.id : undefined,
      items: carrito.map((it) => ({ productoId: it.productoId, nombre: it.nombre, precioUnitario: it.precioUnitario, cantidad: it.cantidad, subtotal: it.precioUnitario * it.cantidad })),
      total,
      metodoPago,
      creadoPor: cajero || undefined,
      autorizoFiado,
      estado: 'completada',
    });

    let creditoId;
    if (metodoPago === 'credito') {
      creditoId = await window.AppDB.creditos.add({
        clienteId: clienteSeleccionado.id,
        ventaId,
        montoOriginal: total,
        abonosTotal: 0,
        estado: 'pendiente',
        fechaCreacion: new Date().toISOString(),
      });
      await window.AppDB.ventas.put({ id: ventaId, fecha: (await window.AppDB.ventas.get(ventaId)).fecha, clienteId: clienteSeleccionado.id, items: carrito.map((it) => ({ productoId: it.productoId, nombre: it.nombre, precioUnitario: it.precioUnitario, cantidad: it.cantidad, subtotal: it.precioUnitario * it.cantidad })), total, metodoPago, creditoId, creadoPor: cajero || undefined, autorizoFiado, estado: 'completada' });
      await window.AppMovimientos.registrar('creditos', 'credito_creado', {
        entidadId: creditoId,
        entidadNombre: nombreCliente,
        monto: total,
        detalle: `Originado de venta #${ventaId}, fiado autorizado por ${autorizoFiado}`,
      });
    }

    await window.AppMovimientos.registrar('ventas', 'venta_creada', {
      entidadId: ventaId,
      entidadNombre: nombreCliente || 'Público general',
      monto: total,
      detalle: metodoPago,
    });

    setCarrito([]);
    setClienteSeleccionado(null);
    setCobroAbierto(false);
    cargar();
    flash(`Venta #${ventaId} registrada — $${window.AppUtils.formatMoney(total)}`);
  };

  const cancelarVenta = async (venta) => {
    if (venta.creditoId) {
      const credito = await window.AppDB.creditos.get(venta.creditoId);
      if (credito && (credito.abonosTotal || 0) > 0) {
        alert('No se puede cancelar: el crédito de esta venta ya tiene abonos registrados.');
        return;
      }
    }
    if (!confirm('¿Cancelar esta venta? Se restituirá el inventario.')) return;

    for (const it of venta.items) {
      const producto = await window.AppDB.productos.get(it.productoId);
      if (!producto) continue;
      await window.AppDB.productos.put({ ...producto, existencia: (producto.existencia || 0) + it.cantidad });
      await window.AppMovimientos.registrar('inventario', 'existencia_restaurada', {
        entidadId: producto.id,
        entidadNombre: producto.nombre,
        detalle: `+${it.cantidad} por cancelación de venta #${venta.id}`,
      });
    }

    if (venta.creditoId) {
      const credito = await window.AppDB.creditos.get(venta.creditoId);
      if (credito) {
        await window.AppDB.creditos.put({ ...credito, estado: 'cancelado' });
        await window.AppMovimientos.registrar('creditos', 'credito_cancelado', { entidadId: credito.id, detalle: `Por cancelación de venta #${venta.id}` });
      }
    }

    await window.AppDB.ventas.put({ ...venta, estado: 'cancelada' });
    await window.AppMovimientos.registrar('ventas', 'venta_cancelada', { entidadId: venta.id, monto: venta.total });

    setVista('historial');
    setVentaActual(null);
    cargar();
    flash('Venta cancelada.');
  };

  if (vista === 'detalle' && ventaActual) {
    const cliente = ventaActual.clienteId ? clientePorId[ventaActual.clienteId] : null;
    return <VentaDetalle venta={ventaActual} clienteNombre={cliente ? cliente.nombre : null} onVolver={() => setVista('historial')} onCancelar={cancelarVenta} permisos={p} />;
  }

  if (vista === 'historial') {
    return (
      <div className="module-ventas">
        {mensaje && <div className="toast">{mensaje}</div>}
        <div className="toolbar">
          <button className="btn-secondary" onClick={() => setVista('vender')}>&larr; Volver a vender</button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Método</th><th>Estado</th></tr></thead>
            <tbody>
              {ventas.length === 0 ? (
                <tr><td colSpan={5} className="empty-state">Sin ventas todavía.</td></tr>
              ) : (
                ventas.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).map((v) => {
                  const cliente = v.clienteId ? clientePorId[v.clienteId] : null;
                  return (
                    <tr key={v.id} className="clickable" onClick={() => { setVentaActual(v); setVista('detalle'); }}>
                      <td>{new Date(v.fecha).toLocaleString('es')}</td>
                      <td>{cliente ? cliente.nombre : 'Público general'}</td>
                      <td>${window.AppUtils.formatMoney(v.total)}</td>
                      <td>{METODOS_PAGO.find((m) => m.key === v.metodoPago)?.label}</td>
                      <td><span className={`badge ${ESTADOS_VENTA[v.estado].className}`}>{ESTADOS_VENTA[v.estado].label}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="module-ventas">
      {mensaje && <div className="toast">{mensaje}</div>}

      <div className="toolbar toolbar-secondary">
        <label className="field-inline">
          Cajero
          <input type="text" value={cajero} onChange={(e) => guardarCajero(e.target.value)} placeholder="Tu nombre" style={{ width: 140 }} />
        </label>
        <button className="btn-link" onClick={() => setVista('historial')}>Ver historial</button>
      </div>

      <div className="card">
        <div className="toolbar">
          <input
            type="text"
            className="search-input"
            placeholder="Buscar producto por nombre o código..."
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => setScannerAbierto(true)}>📷 Escanear</button>
        </div>
        {coincidenciasProducto.length > 0 && (
          <ul className="activity-list">
            {coincidenciasProducto.map((p) => (
              <li key={p.id} className="clickable" onClick={() => agregarProducto(p)}>
                <span>{p.nombre}</span>
                <span>${window.AppUtils.formatMoney(p.precio)} · exist. {p.existencia}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Producto</th><th>Cant.</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            {carrito.length === 0 ? (
              <tr><td colSpan={4} className="empty-state">Agrega productos para iniciar la venta.</td></tr>
            ) : (
              carrito.map((it) => (
                <tr key={it.productoId}>
                  <td>{it.nombre}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={it.cantidad}
                      onChange={(e) => cambiarCantidad(it.productoId, Math.max(1, Number(e.target.value) || 1))}
                      style={{ width: 60 }}
                    />
                  </td>
                  <td>${window.AppUtils.formatMoney(it.precioUnitario * it.cantidad)}</td>
                  <td className="actions-cell"><button className="btn-link danger" onClick={() => quitarDelCarrito(it.productoId)}>Quitar</button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="resumen-grid">
        <div className="resumen-item"><span className="resumen-label">Total</span><span className="resumen-valor">${window.AppUtils.formatMoney(total)}</span></div>
        {clienteSeleccionado && (
          <div className="resumen-item">
            <span className="resumen-label">Cliente</span>
            <span className="resumen-valor" style={{ fontSize: '1rem' }}>{clienteSeleccionado.nombre}</span>
          </div>
        )}
      </div>

      <div className="form-actions">
        {p.crear && <button className="btn-primary" disabled={carrito.length === 0} onClick={() => setCobroAbierto(true)}>Cobrar</button>}
      </div>

      {cobroAbierto && (
        <CobroModal
          total={total}
          clienteSeleccionado={clienteSeleccionado}
          clientesActivos={clientesActivos}
          onSeleccionarCliente={setClienteSeleccionado}
          onQuitarCliente={() => setClienteSeleccionado(null)}
          onConfirmar={confirmarVenta}
          onClose={() => setCobroAbierto(false)}
        />
      )}

      {scannerAbierto && <window.ScannerModal onDetected={manejarEscaneo} onClose={() => setScannerAbierto(false)} />}
    </div>
  );
}

window.VentasModule = VentasModule;
