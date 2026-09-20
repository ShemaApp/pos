// App.js — Sesión completa: (si Firebase) elegir/crear empresa -> elegir
// usuario -> verificar o crear contraseña -> permisos por rol -> navegación.
// En modo Firebase, la contraseña la verifica Firebase Auth de verdad
// (ver js/auth.js); en modo IndexedDB local sigue el hash propio de
// siempre. Ambos casos comparten la misma interfaz de arriba hacia abajo.
const { useState, useEffect } = React;

const USUARIO_KEY = 'inventario-app:usuarioId';
const EMPRESA_KEY = 'inventario-app:empresaId';

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

function AccesoUsuario({ usuario, empresaActual, onAutenticado, onVolver }) {
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const multiEmpresa = window.AppDB.multiEmpresa;
  const tieneCredencial = multiEmpresa ? !!usuario.tieneCuenta : !!usuario.passwordHash;

  const entrar = async () => {
    setError('');
    if (!password) { setError('Ingresa tu contraseña.'); return; }
    setCargando(true);
    if (multiEmpresa) {
      const uid = await window.AppAuth.entrarConFirebase(empresaActual.id, usuario.nombre, password);
      if (!uid) { setCargando(false); setError('Contraseña incorrecta.'); return; }
      await window.AppDB.autorizarSesionActual();
      setCargando(false);
      onAutenticado(usuario);
    } else {
      const ok = await window.AppAuth.verificarPassword(password, usuario);
      setCargando(false);
      if (!ok) { setError('Contraseña incorrecta.'); return; }
      onAutenticado(usuario);
    }
  };

  const crearPassword = async () => {
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return; }
    setCargando(true);
    try {
      if (multiEmpresa) {
        await window.AppAuth.crearCuentaFirebase(empresaActual.id, usuario.nombre, password);
        await window.AppDB.autorizarSesionActual();
        const actualizado = { ...usuario, tieneCuenta: true };
        await window.AppDB.usuarios.put(actualizado);
        setCargando(false);
        onAutenticado(actualizado);
      } else {
        const credenciales = await window.AppAuth.crearCredenciales(password);
        const actualizado = { ...usuario, ...credenciales };
        await window.AppDB.usuarios.put(actualizado);
        await window.AppMovimientos.registrar('configuracion', 'password_creada', { entidadId: usuario.id, entidadNombre: usuario.nombre });
        setCargando(false);
        onAutenticado(actualizado);
      }
    } catch (e) {
      setError(e.message || 'No se pudo crear tu cuenta.');
      setCargando(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="card login-card">
        <button type="button" className="btn-link" onClick={onVolver} style={{ marginBottom: 8 }}>&larr; Elegir otro usuario</button>
        <h2>{usuario.nombre}</h2>
        {error && <p className="error-text">{error}</p>}

        {tieneCredencial ? (
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

function CambiarPasswordModal({ usuario, empresaActual, onCerrado }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const guardar = async () => {
    setError('');
    if (nueva.length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (nueva !== confirmar) { setError('Las contraseñas nuevas no coinciden.'); return; }
    setCargando(true);
    try {
      if (window.AppDB.multiEmpresa) {
        await window.AppAuth.cambiarPasswordFirebase(empresaActual.id, usuario.nombre, actual, nueva);
      } else {
        const ok = await window.AppAuth.verificarPassword(actual, usuario);
        if (!ok) throw new Error('Tu contraseña actual no es correcta.');
        const credenciales = await window.AppAuth.crearCredenciales(nueva);
        await window.AppDB.usuarios.put({ ...usuario, ...credenciales });
      }
      await window.AppMovimientos.registrar('configuracion', 'password_cambiada', { entidadId: usuario.id, entidadNombre: usuario.nombre });
      setCargando(false);
      onCerrado(true);
    } catch (e) {
      setError(e.message || 'No se pudo cambiar la contraseña.');
      setCargando(false);
    }
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
  const [empresaActual, setEmpresaActual] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [modulosActivos, setModulosActivos] = useState({});
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [cambiarPasswordAbierto, setCambiarPasswordAbierto] = useState(false);
  const [mensaje, setMensaje] = useState('');

  // Solo lee la lista de usuarios (nombre/rol) — es lo único legible antes
  // de autenticarse de verdad, para poder mostrar la pantalla "¿quién eres?".
  const cargarUsuarios = async () => {
    const u = await window.AppDB.usuarios.getAll();
    setUsuarios(u);
    return u;
  };

  // Roles y ajustes SÍ requieren estar ya autorizados (ver firestore.rules) —
  // solo se cargan después de un login real.
  const cargarPermisosYAjustes = async () => {
    const [r, ajustes] = await Promise.all([
      window.AppDB.roles.getAll(),
      window.AppDB.ajustes.get('modulosActivos'),
    ]);
    setRoles(r);
    setModulosActivos(ajustes ? ajustes.valor : {});
  };

  useEffect(() => {
    (async () => {
      await window.AppDB.init();

      if (window.AppDB.multiEmpresa) {
        const empresaIdGuardada = localStorage.getItem(EMPRESA_KEY);
        if (empresaIdGuardada) {
          const empresa = await window.AppDB.empresas.get(empresaIdGuardada);
          if (empresa && empresa.estado !== 'suspendida') {
            await window.AppDB.entrarEnEmpresa(empresa.id);
            setEmpresaActual(empresa);
            const u = await cargarUsuarios();

            // Si Firebase ya restauró sola una sesión REAL (no anónima) de
            // una visita anterior, no hay que volver a pedir contraseña.
            const real = firebase.auth().currentUser && !firebase.auth().currentUser.isAnonymous;
            if (real) {
              const guardadoId = Number(localStorage.getItem(USUARIO_KEY));
              const encontrado = u.find((x) => x.id === guardadoId && x.estado === 'activo');
              if (encontrado) {
                await cargarPermisosYAjustes();
                setUsuarioActual(encontrado);
              }
            }
          } else {
            localStorage.removeItem(EMPRESA_KEY);
          }
        }
      } else {
        await cargarUsuarios();
        await cargarPermisosYAjustes();
        const guardadoId = Number(localStorage.getItem(USUARIO_KEY));
        const usuariosLocales = await window.AppDB.usuarios.getAll();
        const encontrado = usuariosLocales.find((x) => x.id === guardadoId && x.estado === 'activo');
        setUsuarioActual(encontrado || null);
      }

      setListo(true);
    })();
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

  const entrar = async (usuarioAutenticado) => {
    localStorage.setItem(USUARIO_KEY, String(usuarioAutenticado.id));
    if (window.AppDB.multiEmpresa) {
      await window.AppDB.autorizarSesionActual(); // idempotente; ya se hizo antes, pero no está de más
    }
    await cargarPermisosYAjustes();
    setUsuarioActual(usuarioAutenticado);
    setUsuarioSeleccionado(null);
  };

  const salir = async () => {
    localStorage.removeItem(USUARIO_KEY);
    setUsuarioActual(null);
    setUsuarioSeleccionado(null);
    if (window.AppDB.multiEmpresa) {
      await window.AppDB.volverAAnonimo();
    }
  };

  const salirDeEmpresa = async () => {
    localStorage.removeItem(USUARIO_KEY);
    localStorage.removeItem(EMPRESA_KEY);
    setUsuarioActual(null);
    setUsuarioSeleccionado(null);
    setEmpresaActual(null);
    if (window.AppDB.multiEmpresa) {
      await window.AppDB.volverAAnonimo();
    }
  };

  const onEmpresaLista = async (empresa, usuarioAutoLogin) => {
    localStorage.setItem(EMPRESA_KEY, String(empresa.id));
    setEmpresaActual(empresa);
    await cargarUsuarios();
    if (usuarioAutoLogin) {
      await entrar(usuarioAutoLogin);
    }
  };

  if (window.AppDB.multiEmpresa && !empresaActual) {
    return React.createElement(window.SeleccionarEmpresaScreen, { onEmpresaLista });
  }

  if (!usuarioActual) {
    if (usuarioSeleccionado) {
      return React.createElement(AccesoUsuario, {
        usuario: usuarioSeleccionado,
        empresaActual,
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
    modulo = React.createElement(window.ConfiguracionModule, { permisos: permisos.configuracion, onCambio: cargarPermisosYAjustes });
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
        React.createElement(
          'div',
          null,
          React.createElement('h1', null, 'Inventario'),
          window.AppDB.multiEmpresa && empresaActual &&
            React.createElement('span', { style: { fontSize: '0.78rem', color: '#C9DBD9' } }, empresaActual.nombre)
        ),
        React.createElement(
          'div',
          { className: 'header-usuario' },
          React.createElement('span', null, usuarioActual.nombre),
          React.createElement('button', { className: 'btn-link header-salir', onClick: () => setCambiarPasswordAbierto(true) }, 'Cambiar contraseña'),
          React.createElement('button', { className: 'btn-link header-salir', onClick: salir }, 'Cambiar usuario'),
          window.AppDB.multiEmpresa &&
            React.createElement('button', { className: 'btn-link header-salir', onClick: salirDeEmpresa }, 'Cambiar empresa')
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
        empresaActual,
        onCerrado: (exito) => {
          setCambiarPasswordAbierto(false);
          if (exito) flash('Contraseña actualizada.');
        },
      })
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
