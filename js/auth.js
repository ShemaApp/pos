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

window.AppAuth = { crearCredenciales, verificarPassword };
