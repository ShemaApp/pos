// Empresa.js — Selección/registro de empresa (solo aplica con Firebase).
// Antes de elegir un usuario, hay que saber DE QUÉ EMPRESA — se busca por
// correo; si no existe, se ofrece registrarla ahí mismo.
const { useState } = React;

function RegistrarEmpresaScreen({ correoInicial, onEmpresaLista, onVolver }) {
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [correo, setCorreo] = useState(correoInicial || '');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const registrar = async () => {
    if (!nombreEmpresa.trim()) { setError('Escribe el nombre de tu empresa.'); return; }
    if (!correo.trim()) { setError('Escribe el correo de tu empresa.'); return; }
    if (!nombreUsuario.trim()) { setError('Escribe tu nombre de usuario.'); return; }
    if (password.length < 6) { setError('Tu contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirmar) { setError('Las contraseñas no coinciden.'); return; }

    setError('');
    setCargando(true);
    try {
      const correoLimpio = correo.trim().toLowerCase();
      const empresaId = await window.AppDB.empresas.add({
        nombre: nombreEmpresa.trim(),
        correoEmpresa: correoLimpio,
        estado: 'activa',
        creadoEn: new Date().toISOString(),
      });
      await window.AppDB.entrarEnEmpresa(empresaId);

      // Crea la cuenta REAL de Firebase Auth (esto cambia la sesión de
      // anónima a autenticada de verdad) y recién entonces autoriza y
      // siembra — antes de esto no se puede escribir nada más en la empresa.
      await window.AppAuth.crearCuentaFirebase(empresaId, nombreUsuario.trim(), password);
      await window.AppDB.autorizarSesionActual();

      const roles = await window.AppDB.roles.getAll();
      const rolAdmin = roles.find((r) => r.esSistema);
      const usuarioId = await window.AppDB.usuarios.add({
        nombre: nombreUsuario.trim(),
        rolId: rolAdmin.id,
        estado: 'activo',
        tieneCuenta: true,
      });
      const usuario = await window.AppDB.usuarios.get(usuarioId);

      onEmpresaLista({ id: empresaId, nombre: nombreEmpresa.trim(), correoEmpresa: correoLimpio }, usuario);
    } catch (e) {
      setError(e.message || 'No se pudo registrar la empresa. Intenta de nuevo.');
      setCargando(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="card login-card">
        <button type="button" className="btn-link" onClick={onVolver} style={{ marginBottom: 8 }}>&larr; Ya tengo empresa</button>
        <h2>Registra tu empresa</h2>
        <p className="detail-sub">No encontramos ese correo — puedes crear tu empresa aquí. Quedarás como su primer administrador.</p>
        {error && <p className="error-text">{error}</p>}

        <label className="field">
          Nombre de la empresa
          <input type="text" value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Correo de la empresa
          <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="contacto@tuempresa.com" />
        </label>
        <label className="field">
          Tu nombre de usuario
          <input type="text" value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} />
        </label>
        <label className="field">
          Tu contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          Confirmar contraseña
          <input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && registrar()} />
        </label>

        <div className="form-actions form-actions-left">
          <button className="btn-primary" disabled={cargando} onClick={registrar}>{cargando ? 'Creando...' : 'Crear empresa y entrar'}</button>
        </div>
      </div>
    </div>
  );
}

function SeleccionarEmpresaScreen({ onEmpresaLista }) {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const buscar = async () => {
    const limpio = correo.trim().toLowerCase();
    if (!limpio) { setError('Escribe el correo de tu empresa.'); return; }
    setError('');
    setCargando(true);
    const empresa = await window.AppDB.empresas.getByIndex('correoEmpresa', limpio);
    setCargando(false);
    if (!empresa) {
      setNoEncontrada(true);
      return;
    }
    if (empresa.estado === 'suspendida') {
      setError('Esta empresa está suspendida. Contacta a soporte.');
      return;
    }
    await window.AppDB.entrarEnEmpresa(empresa.id);
    onEmpresaLista(empresa);
  };

  if (noEncontrada) {
    return (
      <RegistrarEmpresaScreen
        correoInicial={correo.trim().toLowerCase()}
        onEmpresaLista={onEmpresaLista}
        onVolver={() => setNoEncontrada(false)}
      />
    );
  }

  return (
    <div className="login-screen">
      <div className="card login-card">
        <h2>Bienvenido</h2>
        <p className="detail-sub">Escribe el correo de tu empresa para continuar.</p>
        {error && <p className="error-text">{error}</p>}
        <label className="field">
          Correo de la empresa
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            autoFocus
            placeholder="contacto@tuempresa.com"
          />
        </label>
        <div className="form-actions form-actions-left">
          <button className="btn-primary" disabled={cargando} onClick={buscar}>{cargando ? 'Buscando...' : 'Continuar'}</button>
        </div>
      </div>
    </div>
  );
}

window.SeleccionarEmpresaScreen = SeleccionarEmpresaScreen;
