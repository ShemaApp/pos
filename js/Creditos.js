// Creditos.js — Módulo de créditos. Siempre requiere un cliente.
const { useState, useEffect, useMemo } = React;

const ESTADOS_CREDITO = {
  pendiente: { label: 'Pendiente', className: 'badge-warn' },
  parcial: { label: 'Parcial', className: 'badge-warn' },
  liquidado: { label: 'Liquidado', className: 'badge-ok' },
  cancelado: { label: 'Cancelado', className: 'badge-danger' },
  vencido: { label: 'Vencido', className: 'badge-danger' },
};

function calcularEstado(montoOriginal, abonosTotal) {
  const saldo = montoOriginal - abonosTotal;
  if (saldo <= 0) return 'liquidado';
  if (abonosTotal > 0) return 'parcial';
  return 'pendiente';
}

function NuevoCreditoForm({ clientes, clienteFijo, onGuardar, onCancelar }) {
  const [clienteId, setClienteId] = useState(clienteFijo ? clienteFijo.id : '');
  const [montoOriginal, setMontoOriginal] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [condiciones, setCondiciones] = useState('');
  const [error, setError] = useState('');

  const clientesActivos = clientes.filter((c) => c.estado === 'activo').sort((a, b) => a.nombre.localeCompare(b.nombre));

  const guardar = async () => {
    if (!clienteId) { setError('Selecciona un cliente. Un crédito siempre requiere cliente.'); return; }
    const monto = Number(montoOriginal);
    if (!monto || monto <= 0) { setError('El monto original debe ser mayor a cero.'); return; }
    setError('');
    await onGuardar({
      clienteId: Number(clienteId),
      montoOriginal: monto,
      abonosTotal: 0,
      estado: 'pendiente',
      fechaCreacion: new Date().toISOString(),
      fechaVencimiento: fechaVencimiento || undefined,
      condiciones: condiciones || undefined,
    });
  };

  return (
    <div className="card form-card">
      <h3>Nuevo crédito</h3>
      {error && <p className="error-text">{error}</p>}

      <label className="field">
        Cliente
        {clienteFijo ? (
          <input type="text" value={clienteFijo.nombre} disabled />
        ) : (
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecciona...</option>
            {clientesActivos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
      </label>

      <label className="field">
        Monto original
        <input type="number" step="0.01" value={montoOriginal} onChange={(e) => setMontoOriginal(e.target.value)} autoFocus />
      </label>

      <label className="field">
        Fecha de vencimiento
        <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
      </label>

      <label className="field">
        Condiciones
        <input type="text" value={condiciones} onChange={(e) => setCondiciones(e.target.value)} placeholder="Opcional" />
      </label>

      <div className="form-actions">
        <button className="btn-secondary" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primary" onClick={guardar}>Crear crédito</button>
      </div>
    </div>
  );
}

function AbonoModal({ credito, onRegistrar, onClose }) {
  const saldo = credito.montoOriginal - (credito.abonosTotal || 0);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Efectivo');
  const [error, setError] = useState('');

  const registrar = async () => {
    const n = Number(monto);
    if (!n || n <= 0) { setError('Ingresa un monto válido.'); return; }
    if (n > saldo) {
      const continuar = confirm(
        `El abono ($${window.AppUtils.formatMoney(n)}) supera el saldo pendiente ($${window.AppUtils.formatMoney(saldo)}).\n` +
        `¿Registrarlo de todas formas y dejar saldo a favor?`
      );
      if (!continuar) return;
    }
    setError('');
    await onRegistrar(n, metodo);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Registrar abono</h3>
        {error && <p className="error-text">{error}</p>}
        <p className="detail-sub">Saldo actual: <strong>${window.AppUtils.formatMoney(saldo)}</strong></p>
        <label className="field">
          Monto
          <input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Método
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            <option>Efectivo</option>
            <option>Tarjeta</option>
            <option>Transferencia</option>
          </select>
        </label>
        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={registrar}>Registrar</button>
        </div>
      </div>
    </div>
  );
}

function CreditoDetalle({ credito, clienteNombre, onVolver, onCancelar, onAbonoRegistrado, permisos }) {
  const [movimientos, setMovimientos] = useState([]);
  const [abonoAbierto, setAbonoAbierto] = useState(false);
  const saldo = credito.montoOriginal - (credito.abonosTotal || 0);

  const cargarMovimientos = async () => {
    const abonos = await window.AppDB.abonos.getAllByIndex('creditoId', credito.id);
    const inicial = { tipo: 'Crédito', monto: credito.montoOriginal, fecha: credito.fechaCreacion };
    const lista = [inicial, ...abonos.map((a) => ({ tipo: 'Abono', monto: -a.monto, fecha: a.fecha, metodo: a.metodoPago }))];
    setMovimientos(lista.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)));
  };

  useEffect(() => { cargarMovimientos(); }, [credito.abonosTotal]);

  const registrarAbono = async (monto, metodo) => {
    await window.AppDB.abonos.add({ creditoId: credito.id, clienteId: credito.clienteId, monto, metodoPago: metodo, fecha: new Date().toISOString() });
    const nuevoTotal = (credito.abonosTotal || 0) + monto;
    const nuevoEstado = calcularEstado(credito.montoOriginal, nuevoTotal);
    const actualizado = { ...credito, abonosTotal: nuevoTotal, estado: nuevoEstado };
    await window.AppDB.creditos.put(actualizado);
    await window.AppMovimientos.registrar('creditos', 'abono_registrado', {
      entidadId: credito.id,
      entidadNombre: clienteNombre,
      monto,
      detalle: metodo,
    });
    if (nuevoEstado === 'liquidado' && credito.estado !== 'liquidado') {
      await window.AppMovimientos.registrar('creditos', 'credito_liquidado', { entidadId: credito.id, entidadNombre: clienteNombre });
    }
    setAbonoAbierto(false);
    onAbonoRegistrado(actualizado);
  };

  return (
    <div className="card form-card">
      <button type="button" className="btn-link" onClick={onVolver}>&larr; Volver a créditos</button>
      <h3>Crédito #{credito.id} — {clienteNombre}</h3>
      <span className={`badge ${ESTADOS_CREDITO[credito.estado].className}`}>{ESTADOS_CREDITO[credito.estado].label}</span>
      {credito.ventaId && <p className="detail-sub">Originado de venta #{credito.ventaId}</p>}

      <div className="resumen-grid">
        <div className="resumen-item"><span className="resumen-label">Monto original</span><span className="resumen-valor">${window.AppUtils.formatMoney(credito.montoOriginal)}</span></div>
        <div className="resumen-item"><span className="resumen-label">Abonado</span><span className="resumen-valor">${window.AppUtils.formatMoney(credito.abonosTotal || 0)}</span></div>
        <div className="resumen-item"><span className="resumen-label">Saldo</span><span className="resumen-valor">${window.AppUtils.formatMoney(saldo)}</span></div>
      </div>

      <h4 className="section-title">Movimientos</h4>
      <div className="table-scroll">
        <table className="data-table">
          <tbody>
            {movimientos.map((m, i) => (
              <tr key={i}>
                <td>{new Date(m.fecha).toLocaleDateString('es')}</td>
                <td>{m.tipo}{m.metodo ? ` (${m.metodo})` : ''}</td>
                <td className="mono">{m.monto >= 0 ? '+' : ''}{window.AppUtils.formatMoney(m.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-actions">
        {credito.estado !== 'liquidado' && credito.estado !== 'cancelado' && (
          <React.Fragment>
            {permisos.crear && <button className="btn-primary" onClick={() => setAbonoAbierto(true)}>Registrar abono</button>}
            {permisos.eliminar && <button className="btn-link danger" onClick={() => onCancelar(credito)}>Cancelar crédito</button>}
          </React.Fragment>
        )}
      </div>

      {abonoAbierto && <AbonoModal credito={credito} onRegistrar={registrarAbono} onClose={() => setAbonoAbierto(false)} />}
    </div>
  );
}

function CreditosModule({ contexto, onContextoConsumido, permisos }) {
  const p = permisos || window.AppPermisos.permisosCompletos().creditos;
  const [creditos, setCreditos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroClienteId, setFiltroClienteId] = useState(contexto && contexto.clienteId ? contexto.clienteId : null);
  const [vista, setVista] = useState(contexto && contexto.crear ? 'form' : 'lista');
  const [creditoActual, setCreditoActual] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    const [cr, cl] = await Promise.all([window.AppDB.creditos.getAll(), window.AppDB.clientes.getAll()]);
    setCreditos(cr);
    setClientes(cl);
  };

  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    if (contexto) {
      setFiltroClienteId(contexto.clienteId || null);
      setVista(contexto.crear ? 'form' : 'lista');
      onContextoConsumido();
    }
  }, [contexto]);

  const flash = (msg) => { setMensaje(msg); setTimeout(() => setMensaje(''), 2500); };

  const clientePorId = useMemo(() => Object.fromEntries(clientes.map((c) => [c.id, c])), [clientes]);

  const visibles = useMemo(() => {
    return creditos
      .filter((c) => !filtroClienteId || c.clienteId === filtroClienteId)
      .filter((c) => filtroEstado === 'todos' || c.estado === filtroEstado)
      .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
  }, [creditos, filtroEstado, filtroClienteId]);

  const clienteFiltroActivo = filtroClienteId ? clientePorId[filtroClienteId] : null;

  const crearCredito = async (datos) => {
    const nuevoId = await window.AppDB.creditos.add(datos);
    const cliente = clientePorId[datos.clienteId];
    await window.AppMovimientos.registrar('creditos', 'credito_creado', {
      entidadId: nuevoId,
      entidadNombre: cliente ? cliente.nombre : undefined,
      monto: datos.montoOriginal,
    });
    setVista('lista');
    cargar();
    flash('Crédito creado.');
  };

  const cancelarCredito = async (c) => {
    if (!confirm('¿Cancelar este crédito? Ya no se podrán registrar abonos.')) return;
    await window.AppDB.creditos.put({ ...c, estado: 'cancelado' });
    const cliente = clientePorId[c.clienteId];
    await window.AppMovimientos.registrar('creditos', 'credito_cancelado', {
      entidadId: c.id,
      entidadNombre: cliente ? cliente.nombre : undefined,
    });
    setVista('lista');
    cargar();
    flash('Crédito cancelado.');
  };

  if (vista === 'form') {
    return (
      <NuevoCreditoForm
        clientes={clientes}
        clienteFijo={clienteFiltroActivo}
        onGuardar={crearCredito}
        onCancelar={() => setVista('lista')}
      />
    );
  }

  if (vista === 'detalle' && creditoActual) {
    const cliente = clientePorId[creditoActual.clienteId];
    return (
      <CreditoDetalle
        credito={creditoActual}
        clienteNombre={cliente ? cliente.nombre : 'Cliente no encontrado'}
        onVolver={() => { setVista('lista'); setCreditoActual(null); }}
        onCancelar={cancelarCredito}
        onAbonoRegistrado={(actualizado) => { setCreditoActual(actualizado); cargar(); }}
        permisos={p}
      />
    );
  }

  return (
    <div className="module-creditos">
      {mensaje && <div className="toast">{mensaje}</div>}

      {clienteFiltroActivo && (
        <div className="filtro-activo">
          Créditos de <strong>{clienteFiltroActivo.nombre}</strong>
          <button className="btn-link" onClick={() => setFiltroClienteId(null)}>Ver todos</button>
        </div>
      )}

      <div className="toolbar">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          {Object.keys(ESTADOS_CREDITO).map((k) => <option key={k} value={k}>{ESTADOS_CREDITO[k].label}</option>)}
        </select>
        {p.crear && <button className="btn-primary" onClick={() => setVista('form')}>+ Nuevo crédito</button>}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Monto</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr><td colSpan={5} className="empty-state">No hay créditos que coincidan.</td></tr>
            ) : (
              visibles.map((c) => {
                const saldo = c.montoOriginal - (c.abonosTotal || 0);
                const cliente = clientePorId[c.clienteId];
                return (
                  <tr key={c.id}>
                    <td className="clickable" onClick={() => { setCreditoActual(c); setVista('detalle'); }}>{cliente ? cliente.nombre : '—'}</td>
                    <td>${window.AppUtils.formatMoney(c.montoOriginal)}</td>
                    <td>${window.AppUtils.formatMoney(saldo)}</td>
                    <td><span className={`badge ${ESTADOS_CREDITO[c.estado].className}`}>{ESTADOS_CREDITO[c.estado].label}</span></td>
                    <td className="actions-cell">
                      <button className="btn-link" onClick={() => { setCreditoActual(c); setVista('detalle'); }}>Ver</button>
                    </td>
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

window.CreditosModule = CreditosModule;
