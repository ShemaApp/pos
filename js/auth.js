// auth.js — Hash de contraseñas con Web Crypto (SHA-256 + salt por usuario).
// No es un sistema de autenticación de servidor: es una barrera local contra
// acceso casual/no autorizado en el mismo dispositivo, no cifrado de nivel banco.

function bufferAHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function saltAleatorio() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bufferAHex(bytes.buffer);
}

async function hashConSalt(password, saltHex) {
  const datos = new TextEncoder().encode(saltHex + ':' + password);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return bufferAHex(digest);
}

// Genera salt+hash nuevos para una contraseña (alta o cambio de contraseña).
async function crearCredenciales(password) {
  const passwordSalt = saltAleatorio();
  const passwordHash = await hashConSalt(password, passwordSalt);
  return { passwordSalt, passwordHash };
}

// Compara una contraseña ingresada contra el hash guardado del usuario.
async function verificarPassword(password, usuario) {
  if (!usuario || !usuario.passwordHash || !usuario.passwordSalt) return false;
  const hash = await hashConSalt(password, usuario.passwordSalt);
  return hash === usuario.passwordHash;
}

// ============================================================================
// Firebase Auth real (solo modo multiempresa con Firebase). Aquí la
// contraseña la verifica el SERVIDOR de Firebase, no una comparación en el
// navegador — es lo que permite que firestore.rules confíe en
// request.auth.uid como prueba genuina de "esta persona sí sabía la
// contraseña correcta". Ver la sección de seguridad en README.md.
//
// Firebase Auth exige un correo, y nuestros usuarios internos se identifican
// por NOMBRE, no correo — se genera un correo "sintético" único combinando
// el ID de la empresa (aleatorio, no adivinable) + el nombre de usuario, que
// nunca se le muestra a nadie ni se usa para enviar nada.
// ============================================================================

function correoSintetico(empresaId, nombreUsuario) {
  const slug = nombreUsuario.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'usuario';
  return `${empresaId}.${slug}@tenant.inventario-app.local`;
}

// Primera vez del usuario: crea su cuenta REAL en Firebase Auth. Firebase
// exige contraseñas de al menos 6 caracteres (no es un límite nuestro).
// Devuelve el uid real, o lanza un error con mensaje legible si falla
// (por ejemplo, "la contraseña es muy débil").
async function crearCuentaFirebase(empresaId, nombreUsuario, password) {
  const correo = correoSintetico(empresaId, nombreUsuario);
  try {
    const cred = await firebase.auth().createUserWithEmailAndPassword(correo, password);
    return cred.user.uid;
  } catch (e) {
    if (e.code === 'auth/weak-password') throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (e.code === 'auth/email-already-in-use') throw new Error('Ya existe una cuenta con ese nombre de usuario en esta empresa.');
    throw new Error('No se pudo crear tu cuenta: ' + (e.message || e.code));
  }
}

// Login normal: intenta entrar con Firebase Auth. Regresa el uid si la
// contraseña es correcta, o null si no (contraseña incorrecta u otro error
// de autenticación) — nunca lanza, para que la pantalla de login solo tenga
// que mostrar "contraseña incorrecta" sin distinguir el motivo exacto.
async function entrarConFirebase(empresaId, nombreUsuario, password) {
  const correo = correoSintetico(empresaId, nombreUsuario);
  try {
    const cred = await firebase.auth().signInWithEmailAndPassword(correo, password);
    return cred.user.uid;
  } catch (e) {
    return null;
  }
}

// Cambiar tu propia contraseña: Firebase exige haber iniciado sesión
// "recientemente" para esta operación, así que primero se reautentica con
// la contraseña actual (confirma que de verdad eres tú) y luego se cambia.
async function cambiarPasswordFirebase(empresaId, nombreUsuario, passwordActual, passwordNueva) {
  const correo = correoSintetico(empresaId, nombreUsuario);
  const credencial = firebase.auth.EmailAuthProvider.credential(correo, passwordActual);
  try {
    await firebase.auth().currentUser.reauthenticateWithCredential(credencial);
  } catch (e) {
    throw new Error('Tu contraseña actual no es correcta.');
  }
  try {
    await firebase.auth().currentUser.updatePassword(passwordNueva);
  } catch (e) {
    if (e.code === 'auth/weak-password') throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
    throw new Error('No se pudo cambiar la contraseña: ' + (e.message || e.code));
  }
}

window.AppAuth = {
  crearCredenciales,
  verificarPassword,
  crearCuentaFirebase,
  entrarConFirebase,
  cambiarPasswordFirebase,
};
