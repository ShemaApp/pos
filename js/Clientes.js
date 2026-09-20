// Clientes.js — Módulo de clientes. Puede existir sin crédito ni ventas.
const { useState, useEffect, useMemo } = React;

const ESTADOS_CLIENTE = {
  activo: { label: 'Activo', className: 'badge-ok' },
  archivado: { label: 'Archivado', className: 'badge-warn' },
  eliminado: { label: 'Eliminado', className: 'badge-danger' },
};

function ClienteForm({ cliente, onGuardar, onCancelar }) {
  const [form, setForm] = useState(cliente);
  const [detallesAbiertos, setDetallesAbiertos] = useState(!!(cliente.direccion || cliente.limiteCredito || cliente.email));
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const guardar = async () => {
    if (!form.nombre || !form.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setError('');
    await onGuardar(form);
  };

  return (
    <div className="card form-card">
      <h3>{form.id ? 'Editar cliente' : 'Nuevo cliente'}</h3>
      {error && <p className="error-text">{error}</p>}

      <label className="field">
        Nombre
        <input type="text" value={form.nombre || ''} onChange={set('nombre')} autoFocus />
      </label>

      <label className="field">
        Teléfono
        <input type="text" value={form.telefono || ''} onChange={set('telefono')} />
      </label>

      {!detallesAbiertos && (
        <button type="button" className="btn-link" onClick={() => setDetallesAbiertos(true)}>
          + Más campos (correo, dirección, condiciones comerciales)
        </button>
      )}

      {detallesAbiertos && (
        <React.Fragment>
          <label className="field">
            Correo
            <input type="email" value={form.email || ''} onChange={set('email')} />
          </label>
          <label className="field">
            Dirección
            <input type="text" value={form.direccion || ''} onChange={set('direccion')} />
          </label>
          <label className="field">
            Colonia
            <input type="text" value={form.colonia || ''} onChange={set('colonia')} />
          </label>
          <label className="field">
            Ciudad
            <input type="text" value={form.ciudad || ''} onChange={set('ciudad')} />
          </label>
          <label className="field">
            Lista de precios
            <input type="text" value={form.listaPrecio || ''} onChange={set('listaPrecio')} />
          </label>
          <label className="field">
            Límite de crédito
            <input type="number" step="0.01" value={form.limiteCredito ?? ''} onChange={set('limiteCredito')} />
          </label>
          <label className="field">
            Condiciones de pago
            <input type="text" value={form.condiciones || ''} onChange={set('condiciones')} />
          </label>
          <label className="field">
            Notas internas
            <input type="text" value={form.notasInternas || ''} onChange={set('notasInternas')} />
          </label>
        </React.Fragment>
      )}

      <div className="form-actions">
        <button className="btn-secondary" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primary" onClick={guardar}>Guardar</button>
      </div>
    </div>
  );
}

function ClienteDetalle({ cliente, creditos, onEditar, onArchivar, onRestaurar, onEliminar, onVolver, onVerCreditos, onNuevoCredito, permisos }) {
  const activos = creditos.filter((c) => c.estado !== 'cancelado');
  const saldoTotal = activos.reduce((acc, c) => acc + Math.max(0, c.saldo), 0);
  const actividad = creditos
    .slice()
    .sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion))
    .slice(0, 5);

  return (
    <div className="card form-card">
      <button type="button" className="btn-link" onClick={onVolver}>&larr; Volver a clientes</button>
      <h3>{cliente.nombre}</h3>
      <p className="detail-sub">
        {cliente.telefono || 'Sin teléfono'}
        {' · '}
        <span className={`badge ${ESTADOS_CLIENTE[cliente.estado].className}`}>{ESTADOS_CLIENTE[cliente.estado].label}</span>
      </p>

      <div className="resumen-grid">
        <div className="resumen-item">
          <span className="resumen-label">Créditos</span>
          <span className="resumen-valor">{activos.length}</span>
        </div>
        <div className="resumen-item">
          <span className="resumen-label">Saldo pendiente</span>
          <span className="resumen-valor">${window.AppUtils.formatMoney(saldoTotal)}</span>
        </div>
      </div>

      <div className="form-actions form-actions-left">
        <button className="btn-secondary" onClick={() => onNuevoCredito(cliente)}>+ Nuevo crédito</button>
        <button className="btn-secondary" onClick={() => onVerCreditos(cliente)}>Ver créditos</button>
      </div>

      {actividad.length > 0 && (
        <React.Fragment>
          <h4 className="section-title">Actividad reciente</h4>
          <ul className="activity-list">
            {actividad.map((c) => (
              <li key={c.id}>
                <span>{new Date(c.fechaCreacion).toLocaleDateString('es')}</span>
                <span>Crédito #{c.id}</span>
                <span>${window.AppUtils.formatMoney(c.montoOriginal)}</span>
                <span className={`badge badge-sm ${c.estado === 'liquidado' ? 'badge-ok' : c.estado === 'cancelado' ? 'badge-danger' : 'badge-warn'}`}>{c.estado}</span>
              </li>
            ))}
          </ul>
        </React.Fragment>
      )}

      <div className="form-actions">
        <button className="btn-secondary" onClick={() => onEditar(cliente)}>Editar</button>
        {permisos.archivar && cliente.estado === 'activo' && <button className="btn-secondary" onClick={() => onArchivar(cliente)}>Archivar</button>}
        {permisos.restaurar && cliente.estado === 'archivado' && <button className="btn-secondary" onClick={() => onRestaurar(cliente)}>Restaurar</button>}
        {permisos.eliminar && <button className="btn-link danger" onClick={() => onEliminar(cliente)}>Eliminar</button>}
      </div>
    </div>
  );
}

function ClientesModule({ onIrACreditos, permisos }) {
  const p = permisos || window.AppPermisos.permisosCompletos().clientes;
  const [clientes, setClientes] = useState([]);
  const [creditos, setCreditos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [vista, setVista] = useState('lista'); // 'lista' | 'form' | 'detalle'
  const [clienteActual, setClienteActual] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    const [c, cr] = await Promise.all([window.AppDB.clientes.getAll(), window.AppDB.creditos.getAll()]);
    setClientes(c);
    setCreditos(cr);
  };

  useEffect(() => {
    cargar();
  }, []);

  const flash = (msg) => {
    setMensaje(msg);
    setTimeout(() => setMensaje(''), 2500);
  };

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return clientes
      .filter((c) => c.estado !== 'eliminado')
      .filter((c) => mostrarArchivados || c.estado !== 'archivado')
      .filter((c) => !q || (c.nombre || '').toLowerCase().includes(q) || (c.telefono || '').includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [clientes, busqueda, mostrarArchivados]);

  const abrirNuevo = () => {
    setClienteActual({ estado: 'activo' });
    setVista('form');
  };

  const abrirEditar = (c) => {
    setClienteActual(c);
    setVista('form');
  };

  const abrirDetalle = (c) => {
    setClienteActual(c);
    setVista('detalle');
  };

  const guardarCliente = async (form) => {
    const datos = {
      ...form,
      limiteCredito: form.limiteCredito === '' || form.limiteCredito === undefined ? undefined : Number(form.limiteCredito),
      estado: form.estado || 'activo',
      actualizadoEn: new Date().toISOString(),
    };
    if (!datos.id) datos.creadoEn = new Date().toISOString();

    if (datos.id) {
      await window.AppDB.clientes.put(datos);
      await window.AppMovimientos.registrar('clientes', 'cliente_editado', { entidadId: datos.id, entidadNombre: datos.nombre });
    } else {
      const nuevoId = await window.AppDB.clientes.add(datos);
      await window.AppMovimientos.registrar('clientes', 'cliente_creado', { entidadId: nuevoId, entidadNombre: datos.nombre });
    }
    setVista('lista');
    setClienteActual(null);
    cargar();
    flash('Cliente guardado.');
  };

  const archivar = async (c) => {
    await window.AppDB.clientes.put({ ...c, estado: 'archivado' });
    await window.AppMovimientos.registrar('clientes', 'cliente_archivado', { entidadId: c.id, entidadNombre: c.nombre });
    setVista('lista');
    cargar();
    flash('Cliente archivado.');
  };

  const restaurar = async (c) => {
    await window.AppDB.clientes.put({ ...c, estado: 'activo' });
    await window.AppMovimientos.registrar('clientes', 'cliente_restaurado', { entidadId: c.id, entidadNombre: c.nombre });
    setVista('lista');
    cargar();
    flash('Cliente restaurado.');
  };

  const eliminar = async (c) => {
    if (!confirm(`¿Eliminar "${c.nombre}"? Sus ventas y créditos históricos se conservan.`)) return;
    await window.AppDB.clientes.put({ ...c, estado: 'eliminado' });
    await window.AppMovimientos.registrar('clientes', 'cliente_eliminado', { entidadId: c.id, entidadNombre: c.nombre });
    setVista('lista');
    cargar();
    flash('Cliente eliminado.');
  };

  const exportar = () => {
    const columns = [
      { key: 'nombre', label: 'nombre' },
      { key: 'telefono', label: 'telefono' },
      { key: 'email', label: 'email' },
      { key: 'direccion', label: 'direccion' },
      { key: 'ciudad', label: 'ciudad' },
      { key: 'limiteCredito', label: 'limiteCredito' },
      { key: 'estado', label: 'estado' },
    ];
    window.AppUtils.downloadFile('clientes.csv', window.AppUtils.toCSV(clientes, columns));
  };

  const importar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = window.AppUtils.parseCSV(text);
    let creados = 0, errores = 0;
    for (const row of rows) {
      if (!row.nombre) { errores++; continue; }
      await window.AppDB.clientes.add({
        nombre: row.nombre,
        telefono: row.telefono || undefined,
        email: row.email || undefined,
        direccion: row.direccion || undefined,
        ciudad: row.ciudad || undefined,
        limiteCredito: row.limiteCredito ? Number(row.limiteCredito) : undefined,
        estado: 'activo',
        creadoEn: new Date().toISOString(),
      });
      creados++;
    }
    e.target.value = '';
    cargar();
    await window.AppMovimientos.registrar('clientes', 'importacion', { detalle: `${creados} nuevos, ${errores} con error` });
    flash(`Importación: ${creados} nuevos, ${errores} con error.`);
  };

  if (vista === 'form') {
    return <ClienteForm cliente={clienteActual} onGuardar={guardarCliente} onCancelar={() => { setVista(clienteActual.id ? 'detalle' : 'lista'); }} />;
  }

  if (vista === 'detalle') {
    const creditosCliente = creditos.filter((c) => c.clienteId === clienteActual.id).map(withSaldo);
    return (
      <ClienteDetalle
        cliente={clienteActual}
        creditos={creditosCliente}
        onEditar={abrirEditar}
        onArchivar={archivar}
        onRestaurar={restaurar}
        onEliminar={eliminar}
        onVolver={() => setVista('lista')}
        onVerCreditos={(c) => onIrACreditos({ clienteId: c.id })}
        onNuevoCredito={(c) => onIrACreditos({ clienteId: c.id, crear: true })}
        permisos={p}
      />
    );
  }

  return (
    <div className="module-clientes">
      {mensaje && <div className="toast">{mensaje}</div>}
      <div className="toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por nombre o teléfono..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {p.crear && <button className="btn-primary" onClick={abrirNuevo}>+ Nuevo cliente</button>}
      </div>

      <div className="toolbar toolbar-secondary">
        <label className="checkbox-field">
          <input type="checkbox" checked={mostrarArchivados} onChange={(e) => setMostrarArchivados(e.target.checked)} />
          Mostrar archivados
        </label>
        {p.exportar && <button className="btn-link" onClick={exportar}>Exportar CSV</button>}
        {p.importar && (
          <label className="btn-link file-label">
            Importar CSV
            <input type="file" accept=".csv" onChange={importar} style={{ display: 'none' }} />
          </label>
        )}
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <tbody>
            {visibles.length === 0 ? (
              <tr><td className="empty-state">No hay clientes que coincidan.</td></tr>
            ) : (
              visibles.map((c) => (
                <tr key={c.id}>
                  <td className="clickable" onClick={() => abrirDetalle(c)}>{c.nombre}</td>
                  <td className="mono">{c.telefono || '—'}</td>
                  <td><span className={`badge ${ESTADOS_CLIENTE[c.estado].className}`}>{ESTADOS_CLIENTE[c.estado].label}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Calcula saldo = montoOriginal - suma(abonos). Se usa el campo cacheado
// abonosTotal (actualizado cada vez que se registra un abono) en vez de
// leer todos los abonos aquí, para no golpear IndexedDB en cada render.
function withSaldo(credito) {
  const abonosTotal = credito.abonosTotal || 0;
  return { ...credito, saldo: credito.montoOriginal - abonosTotal, abonosTotal };
}

window.ClientesModule = ClientesModule;
window.ESTADOS_CLIENTE = ESTADOS_CLIENTE;
