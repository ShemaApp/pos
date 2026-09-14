// App.js — Sesión: elegir usuario -> verificar o crear contraseña -> permisos
// por rol -> navegación entre módulos visibles. Incluye "Cambiar mi contraseña".
const { useState, useEffect } = React;

const USUARIO_KEY = 'inventario-app:usuarioId';

function LoginScreen({ usuarios, onSeleccionar }) {
  const activos = usuarios.filter((u) => u.estado === 'activo').sort((a, b) => a.nombre.localeCompare(b.nombre));
  return (
    <div className="login-screen">
      <div className="card login-card">
        <h2>¿Quién eres?</h2>
        <p className="detail-sub">Selecciona tu usuario para continuar.</p>
        {activos.length === 0 ? (
          <p className="empty-state">No hay usuarios activos. Pide a un administrador que te dé de alta.</p>
        ) : (
          <ul className="login-list">
            {activos.map((u) => (
              <li key={u.id}>
                <button className="btn-secondary login-btn" onClick={() => onSeleccionar(u)}>{u.nombre}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AccesoUsuario({ usuario, onAutenticado, onVolver }) {
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const tienePassword = !!usuario.passwordHash;

  const entrar = async () => {
    setError('');
    if (!password) { setError('Ingresa tu contraseña.'); return; }
    setCargando(true);
    const ok = await window.AppAuth.verificarPassword(password, usuario);
    setCargando(false);
    if (!ok) { setError('Contraseña incorrecta.'); return; }
    onAutenticado(usuario);
  };

  const crearPassword = async () => {
    setError('');
    if (password.length < 4) { setError('La contraseña debe tener al menos 4 caracteres.'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    setCargando(true);
    const credenciales = await window.AppAuth.crearCredenciales(password);
    const actualizado = { ...usuario, ...credenciales };
    await window.AppDB.usuarios.put(actualizado);
    await window.AppMovimientos.registrar('configuracion', 'password_creada', { entidadId: usuario.id, entidadNombre: usuario.nombre });
    setCargando(false);
    onAutenticado(actualizado);
  };

  return (
    <div className="login-screen">
      <div className="card login-card">
        <button type="button" className="btn-link" onClick={onVolver} style={{ marginBottom: 8 }}>&larr; Elegir otro usuario</button>
        <h2>{usuario.nombre}</h2>
        {error && <p className="error-text">{error}</p>}

        {tienePassword ? (
          <React.Fragment>
            <p className="detail-sub">Ingresa tu contraseña.</p>
            <label className="field">
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && entrar()}
                autoFocus
              />
            </label>
            <div className="form-actions form-actions-left">
              <button className="btn-primary" disabled={cargando} onClick={entrar}>Entrar</button>
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <p className="detail-sub">Es tu primera vez. Crea una contraseña para proteger tu cuenta.</p>
            <label className="field">
              Nueva contraseña
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </label>
            <label className="field">
              Confirmar contraseña
              <input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && crearPassword()}
              />
            </label>
            <div className="form-actions form-actions-left">
              <button className="btn-primary" disabled={cargando} onClick={crearPassword}>Crear contraseña y entrar</button>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function CambiarPasswordModal({ usuario, onCerrado }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const guardar = async () => {
    setError('');
    const ok = await window.AppAuth.verificarPassword(actual, usuario);
    if (!ok) { setError('Tu contraseña actual no es correcta.'); return; }
    if (nueva.length < 4) { setError('La nueva contraseña debe tener al menos 4 caracteres.'); return; }
    if (nueva !== confirmar) { setError('Las contraseñas nuevas no coinciden.'); return; }
    setCargando(true);
    const credenciales = await window.AppAuth.crearCredenciales(nueva);
    await window.AppDB.usuarios.put({ ...usuario, ...credenciales });
    await window.AppMovimientos.registrar('configuracion', 'password_cambiada', { entidadId: usuario.id, entidadNombre: usuario.nombre });
    setCargando(false);
    onCerrado(true);
  };

  return (
    <div className="modal-overlay" onClick={() => onCerrado(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Cambiar mi contraseña</h3>
        {error && <p className="error-text">{error}</p>}
        <label className="field">Contraseña actual<input type="password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus /></label>
        <label className="field">Nueva contraseña<input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} /></label>
        <label className="field">Confirmar nueva contraseña<input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} /></label>
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => onCerrado(false)}>Cancelar</button>
          <button className="btn-primary" disabled={cargando} onClick={guardar}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function App() {
  // --- Todos los hooks primero, sin returns condicionales antes de ellos. ---
  const [listo, setListo] = useState(false);
  const [tab, setTab] = useState('ventas');
  const [contextoCreditos, setContextoCreditos] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modulosActivos, setModulosActivos] = useState({});
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [cambiarPasswordAbierto, setCambiarPasswordAbierto] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const cargarSesion = async () => {
    const [u, r, ajustes] = await Promise.all([
      window.AppDB.usuarios.getAll(),
      window.AppDB.roles.getAll(),
      window.AppDB.ajustes.get('modulosActivos'),
    ]);
    setUsuarios(u);
    setRoles(r);
    setModulosActivos(ajustes ? ajustes.valor : {});

    const guardadoId = Number(localStorage.getItem(USUARIO_KEY));
    const encontrado = u.find((x) => x.id === guardadoId && x.estado === 'activo');
    setUsuarioActual(encontrado || null);
  };

  useEffect(() => {
    window.AppDB.init().then(() => cargarSesion()).then(() => setListo(true));
  }, []);

  const rolActual = roles.find((r) => r.id === (usuarioActual && usuarioActual.rolId));
  const permisos = (rolActual && rolActual.permisos) || window.AppPermisos.permisosVacios();
  const puedeVer = (m) => (m === 'configuracion' || modulosActivos[m] !== false) && permisos[m] && permisos[m].consultar;
  const pestanas = usuarioActual ? window.AppPermisos.MODULOS_APP.filter(puedeVer) : [];

  useEffect(() => {
    if (listo && usuarioActual && pestanas.length > 0 && !pestanas.includes(tab)) {
      setTab(pestanas[0]);
    }
  }, [listo, usuarioActual, modulosActivos, roles]); // eslint-disable-line

  // --- A partir de aquí ya se puede retornar condicionalmente. ---
  if (!listo) {
    return React.createElement('div', { className: 'loading-screen' }, 'Cargando...');
  }

  const entrar = (usuarioAutenticado) => {
    localStorage.setItem(USUARIO_KEY, String(usuarioAutenticado.id));
    setUsuarioActual(usuarioAutenticado);
    setUsuarioSeleccionado(null);
    cargarSesion();
  };

  const salir = () => {
    localStorage.removeItem(USUARIO_KEY);
    setUsuarioActual(null);
    setUsuarioSeleccionado(null);
  };

  if (!usuarioActual) {
    if (usuarioSeleccionado) {
      return React.createElement(AccesoUsuario, {
        usuario: usuarioSeleccionado,
        onAutenticado: entrar,
        onVolver: () => setUsuarioSeleccionado(null),
      });
    }
    return React.createElement(LoginScreen, { usuarios, onSeleccionar: setUsuarioSeleccionado });
  }

  const irACreditos = (contexto) => {
    setContextoCreditos(contexto);
    setTab('creditos');
  };

  const flash = (msg) => { setMensaje(msg); setTimeout(() => setMensaje(''), 3000); };

  let modulo = null;
  if (!pestanas.includes(tab)) {
    modulo = React.createElement('p', { className: 'empty-state' }, 'No tienes acceso a ningún módulo. Pide a un administrador que revise tus permisos.');
  } else if (tab === 'ventas') {
    modulo = React.createElement(window.VentasModule, { permisos: permisos.ventas });
  } else if (tab === 'inventario') {
    modulo = React.createElement(window.InventarioModule, { permisos: permisos.inventario });
  } else if (tab === 'clientes') {
    modulo = React.createElement(window.ClientesModule, { permisos: permisos.clientes, onIrACreditos: irACreditos });
  } else if (tab === 'creditos') {
    modulo = React.createElement(window.CreditosModule, {
      permisos: permisos.creditos,
      contexto: contextoCreditos,
      onContextoConsumido: () => setContextoCreditos(null),
    });
  } else if (tab === 'reportes') {
    modulo = React.createElement(window.ReportesModule, { permisos: permisos.reportes });
  } else if (tab === 'configuracion') {
    modulo = React.createElement(window.ConfiguracionModule, { permisos: permisos.configuracion, onCambio: cargarSesion });
  }

  const etiquetaTab = (m) => window.AppPermisos.MODULOS_APP_LABELS[m];

  return React.createElement(
    'div',
    { className: 'app-shell' },
    mensaje && React.createElement('div', { className: 'toast' }, mensaje),
    React.createElement(
      'header',
      { className: 'app-header' },
      React.createElement(
        'div',
        { className: 'app-header-top' },
        React.createElement('h1', null, 'Inventario'),
        React.createElement(
          'div',
          { className: 'header-usuario' },
          React.createElement('span', null, usuarioActual.nombre),
          React.createElement('button', { className: 'btn-link header-salir', onClick: () => setCambiarPasswordAbierto(true) }, 'Cambiar contraseña'),
          React.createElement('button', { className: 'btn-link header-salir', onClick: salir }, 'Cambiar usuario')
        )
      ),
      React.createElement(
        'nav',
        { className: 'tabs' },
        pestanas.map((m) =>
          React.createElement('button', { key: m, className: tab === m ? 'tab active' : 'tab', onClick: () => setTab(m) }, etiquetaTab(m))
        )
      )
    ),
    React.createElement('main', { className: 'app-main' }, modulo),
    cambiarPasswordAbierto &&
      React.createElement(CambiarPasswordModal, {
        usuario: usuarioActual,
        onCerrado: (exito) => {
          setCambiarPasswordAbierto(false);
          if (exito) flash('Contraseña actualizada.');
        },
      })
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
