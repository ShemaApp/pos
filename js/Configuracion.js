// Configuracion.js — Catálogos (unidades, categorías) + administración de
// módulos on/off, roles y usuarios. Todo gateado por el permiso del rol
// actual sobre el módulo 'configuracion'.
const { useState, useEffect, useMemo } = React;

function Catalogo({ store, titulo, campos, permisos }) {
  const [items, setItems] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const cargar = () => store.getAll().then((r) => setItems(r.sort((a, b) => a.nombre.localeCompare(b.nombre))));

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setForm({});
    setEditando({});
    setError('');
  };

  const abrirEditar = (item) => {
    setForm(item);
    setEditando(item);
    setError('');
  };

  const guardar = async () => {
    if (!form.nombre || !form.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    try {
      if (editando && editando.id) {
        await store.put({ ...editando, ...form });
      } else {
        await store.add(form);
      }
      setEditando(null);
      cargar();
    } catch (e) {
      setError('Ya existe un registro con ese nombre.');
    }
  };

  const eliminar = async (item) => {
    if (!confirm(`¿Eliminar "${item.nombre}"? Los productos que ya lo usan conservarán la referencia.`)) return;
    await store.delete(item.id);
    cargar();
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>{titulo}</h3>
        {permisos.crear && <button className="btn-primary btn-sm" onClick={abrirNuevo}>+ Agregar</button>}
      </div>
      <table className="data-table">
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={2} className="empty-state">Sin registros todavía.</td></tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>{item.nombre}{item.abreviatura ? ` (${item.abreviatura})` : ''}</td>
                <td className="actions-cell">
                  {permisos.editar && <button className="btn-link" onClick={() => abrirEditar(item)}>Editar</button>}
                  {permisos.eliminar && <button className="btn-link danger" onClick={() => eliminar(item)}>Eliminar</button>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {editando !== null && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editando.id ? 'Editar' : 'Agregar'} — {titulo}</h3>
            {error && <p className="error-text">{error}</p>}
            {campos.map((campo) => (
              <label key={campo.key} className="field">
                {campo.label}
                <input
                  type="text"
                  value={form[campo.key] || ''}
                  onChange={(e) => setForm({ ...form, [campo.key]: e.target.value })}
                  autoFocus={campo.key === 'nombre'}
                />
              </label>
            ))}
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModulosToggle({ permisos, onCambio }) {
  const [ajustes, setAjustes] = useState(null);

  const cargar = () => window.AppDB.ajustes.get('modulosActivos').then((r) => setAjustes(r ? r.valor : {}));
  useEffect(() => { cargar(); }, []);

  const modulos = window.AppPermisos.MODULOS_APP.filter((m) => m !== 'configuracion');
  const dependientesDe = (m) => modulos.filter((x) => (window.AppPermisos.DEPENDENCIAS[x] || []).includes(m));
  const dependenciasDe = (m) => window.AppPermisos.DEPENDENCIAS[m] || [];

  const cambiar = async (modulo, activo) => {
    const nuevo = { ...ajustes, [modulo]: activo };
    if (!activo) {
      const dependientes = dependientesDe(modulo).filter((d) => nuevo[d] !== false);
      if (dependientes.length > 0) {
        const ok = confirm(
          `Apagar ${window.AppPermisos.MODULOS_APP_LABELS[modulo]} también apaga: ` +
          dependientes.map((d) => window.AppPermisos.MODULOS_APP_LABELS[d]).join(', ') + '. ¿Continuar?'
        );
        if (!ok) return;
        dependientes.forEach((d) => { nuevo[d] = false; });
      }
    } else {
      dependenciasDe(modulo).forEach((dep) => { nuevo[dep] = true; });
    }
    await window.AppDB.ajustes.put({ clave: 'modulosActivos', valor: nuevo });
    await window.AppMovimientos.registrar('configuracion', activo ? 'modulo_activado' : 'modulo_desactivado', {
      entidadNombre: window.AppPermisos.MODULOS_APP_LABELS[modulo],
    });
    setAjustes(nuevo);
    if (onCambio) onCambio();
  };

  if (!ajustes) return null;

  return (
    <div className="card">
      <div className="card-header"><h3>Módulos</h3></div>
      <p className="detail-sub">
        Apaga los módulos que no uses. Los dependientes (Créditos necesita Clientes) se activan o
        desactivan juntos.
      </p>
      <ul className="toggle-list">
        {modulos.map((m) => (
          <li key={m} className="toggle-row">
            <span>
              {window.AppPermisos.MODULOS_APP_LABELS[m]}
              {dependenciasDe(m).length > 0 && (
                <span className="detail-sub"> (requiere {dependenciasDe(m).map((d) => window.AppPermisos.MODULOS_APP_LABELS[d]).join(', ')})</span>
              )}
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={ajustes[m] !== false}
                disabled={!permisos.editar}
                onChange={(e) => cambiar(m, e.target.checked)}
              />
              <span className="switch-track"></span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RolesAdmin({ permisos, onCambio }) {
  const [roles, setRoles] = useState([]);
  const [editando, setEditando] = useState(null);
  const [nombre, setNombre] = useState('');
  const [matriz, setMatriz] = useState({});
  const [error, setError] = useState('');

  const cargar = () => window.AppDB.roles.getAll().then((r) => setRoles(r.sort((a, b) => a.nombre.localeCompare(b.nombre))));
  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setNombre('');
    setMatriz(window.AppPermisos.permisosVacios());
    setEditando({});
    setError('');
  };

  const abrirEditar = (r) => {
    setNombre(r.nombre);
    setMatriz(r.permisos);
    setEditando(r);
    setError('');
  };

  const toggleCelda = (modulo, accion) => {
    setMatriz((prev) => ({ ...prev, [modulo]: { ...prev[modulo], [accion]: !prev[modulo][accion] } }));
  };

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre del rol es obligatorio.'); return; }
    try {
      if (editando.id) {
        await window.AppDB.roles.put({ ...editando, nombre, permisos: matriz });
        await window.AppMovimientos.registrar('configuracion', 'rol_editado', { entidadId: editando.id, entidadNombre: nombre });
      } else {
        const id = await window.AppDB.roles.add({ nombre, permisos: matriz, esSistema: false });
        await window.AppMovimientos.registrar('configuracion', 'rol_creado', { entidadId: id, entidadNombre: nombre });
      }
      setEditando(null);
      cargar();
      if (onCambio) onCambio();
    } catch (e) {
      setError('Ya existe un rol con ese nombre.');
    }
  };

  const eliminar = async (r) => {
    if (!confirm(`¿Eliminar el rol "${r.nombre}"? Los usuarios con este rol quedarán sin acceso hasta que se les asigne otro.`)) return;
    await window.AppDB.roles.delete(r.id);
    await window.AppMovimientos.registrar('configuracion', 'rol_editado', { entidadId: r.id, entidadNombre: r.nombre, detalle: 'eliminado' });
    cargar();
    if (onCambio) onCambio();
  };
  return (
    <div className="card">
      <div className="card-header">
        <h3>Roles</h3>
        {permisos.crear && <button className="btn-primary btn-sm" onClick={abrirNuevo}>+ Nuevo rol</button>}
      </div>
      <table className="data-table">
        <tbody>
          {roles.map((r) => (
            <tr key={r.id}>
              <td>{r.nombre}{r.esSistema && <span className="badge badge-sm badge-ok" style={{ marginLeft: 6 }}>Sistema</span>}</td>
              <td className="actions-cell">
                {permisos.editar && !r.esSistema && <button className="btn-link" onClick={() => abrirEditar(r)}>Editar permisos</button>}
                {permisos.eliminar && !r.esSistema && <button className="btn-link danger" onClick={() => eliminar(r)}>Eliminar</button>}
                {r.esSistema && <span className="detail-sub">Siempre con todos los permisos</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editando !== null && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editando.id ? 'Editar rol' : 'Nuevo rol'}</h3>
            {error && <p className="error-text">{error}</p>}
            <label className="field">Nombre<input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></label>
            <div className="matrix-scroll">
              <table className="data-table perm-matrix">
                <thead>
                  <tr>
                    <th>Módulo</th>
                    {window.AppPermisos.ACCIONES.map((a) => <th key={a}>{window.AppPermisos.ACCIONES_LABELS[a]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {window.AppPermisos.MODULOS_APP.map((m) => (
                    <tr key={m}>
                      <td>{window.AppPermisos.MODULOS_APP_LABELS[m]}</td>
                      {window.AppPermisos.ACCIONES.map((a) => (
                        <td key={a} style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={!!(matriz[m] && matriz[m][a])} onChange={() => toggleCelda(m, a)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsuariosAdmin({ permisos, onCambio }) {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [mostrarArchivados, setMostrarArchivados] = useState(false);

  const cargar = async () => {
    const [u, r] = await Promise.all([window.AppDB.usuarios.getAll(), window.AppDB.roles.getAll()]);
    setUsuarios(u);
    setRoles(r);
  };
  useEffect(() => { cargar(); }, []);

  const rolPorId = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r])), [roles]);
  const visibles = usuarios.filter((u) => mostrarArchivados || u.estado !== 'archivado').sort((a, b) => a.nombre.localeCompare(b.nombre));

  const abrirNuevo = () => {
    const admin = roles.find((r) => r.esSistema);
    setForm({ rolId: admin ? admin.id : (roles[0] && roles[0].id) || '' });
    setEditando({});
    setError('');
  };

  const abrirEditar = (u) => { setForm(u); setEditando(u); setError(''); };

  const guardar = async () => {
    if (!form.nombre || !form.nombre.trim()) { setError('El nombre de usuario es obligatorio.'); return; }
    if (!form.rolId) { setError('Selecciona un rol.'); return; }
    try {
      if (editando.id) {
        await window.AppDB.usuarios.put({ ...editando, ...form });
        await window.AppMovimientos.registrar('configuracion', 'usuario_editado', { entidadId: editando.id, entidadNombre: form.nombre });
      } else {
        const id = await window.AppDB.usuarios.add({ ...form, estado: 'activo' });
        await window.AppMovimientos.registrar('configuracion', 'usuario_creado', { entidadId: id, entidadNombre: form.nombre });
      }
      setEditando(null);
      cargar();
      if (onCambio) onCambio();
    } catch (e) {
      setError('Ya existe un usuario con ese nombre.');
    }
  };

  const archivar = async (u) => {
    await window.AppDB.usuarios.put({ ...u, estado: 'archivado' });
    await window.AppMovimientos.registrar('configuracion', 'usuario_archivado', { entidadId: u.id, entidadNombre: u.nombre });
    cargar();
    if (onCambio) onCambio();
  };

  const restaurar = async (u) => {
    await window.AppDB.usuarios.put({ ...u, estado: 'activo' });
    await window.AppMovimientos.registrar('configuracion', 'usuario_restaurado', { entidadId: u.id, entidadNombre: u.nombre });
    cargar();
    if (onCambio) onCambio();
  };

  const eliminar = async (u) => {
    if (!confirm(`¿Eliminar el usuario "${u.nombre}"?`)) return;
    await window.AppDB.usuarios.delete(u.id);
    await window.AppMovimientos.registrar('configuracion', 'usuario_eliminado', { entidadId: u.id, entidadNombre: u.nombre });
    cargar();
    if (onCambio) onCambio();
  };

  const restablecerPassword = async (u) => {
    if (!confirm(`¿Restablecer la contraseña de "${u.nombre}"? Deberá crear una nueva la próxima vez que entre.`)) return;
    const { passwordSalt, passwordHash, ...resto } = u;
    await window.AppDB.usuarios.put(resto);
    await window.AppMovimientos.registrar('configuracion', 'password_restablecida', { entidadId: u.id, entidadNombre: u.nombre });
    cargar();
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3>Usuarios</h3>
        {permisos.crear && <button className="btn-primary btn-sm" onClick={abrirNuevo}>+ Nuevo usuario</button>}
      </div>
      <label className="checkbox-field" style={{ marginBottom: 8 }}>
        <input type="checkbox" checked={mostrarArchivados} onChange={(e) => setMostrarArchivados(e.target.checked)} />
        Mostrar archivados
      </label>
      <table className="data-table">
        <tbody>
          {visibles.length === 0 ? (
            <tr><td colSpan={4} className="empty-state">Sin usuarios.</td></tr>
          ) : (
            visibles.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}{u.estado === 'archivado' && <span className="badge badge-sm badge-warn" style={{ marginLeft: 6 }}>Archivado</span>}</td>
                <td>{rolPorId[u.rolId] ? rolPorId[u.rolId].nombre : '—'}</td>
                <td>{u.passwordHash ? <span className="badge badge-sm badge-ok">Con contraseña</span> : <span className="badge badge-sm badge-warn">Sin contraseña</span>}</td>
                <td className="actions-cell">
                  {permisos.editar && <button className="btn-link" onClick={() => abrirEditar(u)}>Editar</button>}
                  {permisos.editar && u.passwordHash && <button className="btn-link" onClick={() => restablecerPassword(u)}>Restablecer contraseña</button>}
                  {permisos.archivar && u.estado !== 'archivado' && <button className="btn-link" onClick={() => archivar(u)}>Archivar</button>}
                  {permisos.restaurar && u.estado === 'archivado' && <button className="btn-link" onClick={() => restaurar(u)}>Restaurar</button>}
                  {permisos.eliminar && <button className="btn-link danger" onClick={() => eliminar(u)}>Eliminar</button>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {editando !== null && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editando.id ? 'Editar usuario' : 'Nuevo usuario'}</h3>
            {error && <p className="error-text">{error}</p>}
            <label className="field">
              Nombre de usuario
              <input type="text" value={form.nombre || ''} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoFocus disabled={!!editando.id} />
            </label>
            <label className="field">
              Rol
              <select value={form.rolId || ''} onChange={(e) => setForm({ ...form, rolId: Number(e.target.value) })}>
                <option value="">Selecciona...</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </label>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfiguracionModule({ permisos, onCambio }) {
  const p = permisos || window.AppPermisos.permisosCompletos().configuracion;

  return (
    <div className="module-config">
      <ModulosToggle permisos={p} onCambio={onCambio} />
      <RolesAdmin permisos={p} onCambio={onCambio} />
      <UsuariosAdmin permisos={p} onCambio={onCambio} />
      <Catalogo
        store={window.AppDB.unidadesMedida}
        titulo="Unidades de medida"
        campos={[{ key: 'nombre', label: 'Nombre' }, { key: 'abreviatura', label: 'Abreviatura' }]}
        permisos={p}
      />
      <Catalogo
        store={window.AppDB.categorias}
        titulo="Categorías"
        campos={[{ key: 'nombre', label: 'Nombre' }]}
        permisos={p}
      />
    </div>
  );
}

window.ConfiguracionModule = ConfiguracionModule;
