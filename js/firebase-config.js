// firebase-config.js — Configuración de tu proyecto Firebase.
//
// 1. Ve a https://console.firebase.google.com → tu proyecto → ⚙️ Configuración
//    del proyecto → pestaña "General" → sección "Tus apps" → app web (</>).
//    Si no tienes una app web todavía, créala ahí ("Agregar app" → Web).
// 2. Copia el objeto "firebaseConfig" que te muestra y reemplaza los valores
//    de abajo con los tuyos.
// 3. Sigue el resto de la guía "Integración con Firebase" en README.md antes
//    de poner FIREBASE_HABILITADO en true (crear Firestore, activar Auth
//    anónima, publicar las reglas de seguridad de firestore.rules).
//
// Esta configuración NO es un secreto: es seguro que quede pública en tu
// repositorio, incluso en GitHub Pages. Quien realmente protege tus datos son
// las Reglas de Seguridad de Firestore (firestore.rules), no ocultar esto.

window.FIREBASE_CONFIG = {
  apiKey: 'TU_API_KEY_AQUI',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  storageBucket: 'tu-proyecto.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx',
};

// Cambia esto a `true` solo después de completar los 3 pasos de arriba.
// En `false`, la app sigue funcionando 100% local con IndexedDB, como hasta ahora.
window.FIREBASE_HABILITADO = false;
