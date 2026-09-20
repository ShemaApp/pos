// db.js — Capa de datos. Dos backends intercambiables detrás de la MISMA
// interfaz (add/put/get/getAll/getByIndex/getAllByIndex/delete):
//   - IndexedDB (Store)         → por defecto, 100% local, sin cuenta, UNA sola
//     "empresa" implícita (no hay concepto de multiempresa: cada dispositivo
//     ya está aislado de por sí).
//   - Firestore (FirestoreStore) → cuando window.FIREBASE_HABILITADO === true.
//     Multiempresa real: cada empresa vive en su propia subcolección
//     (empresas/{empresaId}/productos, .../clientes, etc.), aislada de las
//     demás. El registro de empresas (nombre + correoEmpresa) vive en la
//     colección raíz `empresas`.
// Ningún módulo de la app conoce cuál backend está activo ni si hay
// multiempresa: todos llaman a window.AppDB.<coleccion>.<metodo>(...) igual
// en todos los casos — la selección de empresa ocurre antes del login, en
// App.js/Empresa.js, y solo entonces se "conectan" los stores de datos.
const DB_NAME = 'inventario-app';
const DB_VERSION = 5;

// Esquema único de los datos DE UNA EMPRESA: qué campos son índice de
// búsqueda y cuáles deben ser únicos DENTRO de esa empresa (no globalmente
// — dos empresas distintas sí pueden repetir, por ejemplo, un mismo
// codigoBarras entre sí, cada una en su propio espacio).
const SCHEMA = {
  productos: { codigoBarras: { unique: true }, nombre: {}, estado: {}, categoriaId: {} },
  unidadesMedida: { nombre: { unique: true } },
  categorias: { nombre: { unique: true } },
  clientes: { nombre: {}, estado: {} },
  creditos: { clienteId: {}, estado: {} },
  abonos: { creditoId: {}, clienteId: {} },
  movimientos: { modulo: {}, tipo: {}, fecha: {} },
  ventas: { fecha: {}, clienteId: {}, estado: {} },
  roles: { nombre: { unique: true } },
  usuarios: { nombre: { unique: true }, rolId: {} },
};

// Esquema del registro de empresas (nivel raíz, no anidado — es lo único
// que NO pertenece a ninguna empresa, porque es el directorio de todas).
const SCHEMA_EMPRESAS = { correoEmpresa: { unique: true } };

const UNIDADES_DEFAULT = [
  { nombre: 'Pieza', abreviatura: 'pza' },
  { nombre: 'Unidad', abreviatura: 'u' },
  { nombre: 'Kilogramo', abreviatura: 'kg' },
  { nombre: 'Gramo', abreviatura: 'g' },
  { nombre: 'Litro', abreviatura: 'L' },
  { nombre: 'Mililitro', abreviatura: 'mL' },
  { nombre: 'Metro', abreviatura: 'm' },
  { nombre: 'Metro cuadrado', abreviatura: 'm²' },
  { nombre: 'Metro cúbico', abreviatura: 'm³' },
  { nombre: 'Caja', abreviatura: 'caja' },
  { nombre: 'Paquete', abreviatura: 'paq' },
];

// ============================== IndexedDB ==============================
// Sin cambios de fondo respecto a la versión anterior: sigue siendo una
// sola base local, sin noción de "empresa". Multiempresa es, por diseño,
// una capacidad exclusiva del backend Firestore (ver más abajo).

function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      for (const [nombre, indices] of Object.entries(SCHEMA)) {
        if (db.objectStoreNames.contains(nombre)) continue;
        const store = db.createObjectStore(nombre, { keyPath: 'id', autoIncrement: true });
        for (const [campo, opts] of Object.entries(indices)) {
          store.createIndex(campo, campo, { unique: !!(opts && opts.unique) });
        }
      }
      if (!db.objectStoreNames.contains('ajustes')) {
        db.createObjectStore('ajustes', { keyPath: 'clave' });
      }
    };

    req.onsuccess = (event) => resolve(event.target.result);
    req.onerror = (event) => reject(event.target.error);
  });
}

class Store {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  _tx(mode) {
    return this.db.transaction(this.name, mode).objectStore(this.name);
  }

  add(obj) {
    return new Promise((resolve, reject) => {
      const clean = { ...obj };
      if (!clean.codigoBarras) delete clean.codigoBarras;
      const req = this._tx('readwrite').add(clean);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  put(obj) {
    return new Promise((resolve, reject) => {
      const clean = { ...obj };
      if (!clean.codigoBarras) delete clean.codigoBarras;
      const req = this._tx('readwrite').put(clean);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  get(id) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  getByIndex(indexName, value) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').index(indexName).get(value);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  getAll() {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  getAllByIndex(indexName, value) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readonly').index(indexName).getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  delete(id) {
    return new Promise((resolve, reject) => {
      const req = this._tx('readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

// ============================== Firestore ==============================
// FirestoreStore ya NO asume una ruta fija: recibe la referencia de
// colección (ya construida, anidada o no) y la de contadores. Así el MISMO
// código sirve para la colección raíz `empresas` (sin anidar) y para las
// colecciones de datos DENTRO de una empresa (anidadas bajo
// empresas/{empresaId}/...) — quien decide la ruta es crearFirestoreStore(),
// no esta clase.

class FirestoreStore {
  constructor(firestoreDb, coleccionRef, contadoresRef, nombre, indices, opciones) {
    this._firestoreDb = firestoreDb;
    this.col = coleccionRef;
    this.contadorRef = contadoresRef.doc(nombre);
    this.indices = indices || {};
    this.idAleatorio = !!(opciones && opciones.idAleatorio);
  }

  _limpiar(obj) {
    const clean = { ...obj };
    if (!clean.codigoBarras) delete clean.codigoBarras;
    Object.keys(clean).forEach((k) => {
      if (clean[k] === undefined) delete clean[k];
    });
    return clean;
  }

  async _verificarUnicidad(datos, idPropio) {
    for (const [campo, opts] of Object.entries(this.indices)) {
      if (!opts || !opts.unique) continue;
      const valor = datos[campo];
      if (valor === undefined || valor === null || valor === '') continue;
      const snap = await this.col.where(campo, '==', valor).limit(5).get();
      const choca = snap.docs.some((d) => d.id !== String(idPropio));
      if (choca) {
        throw new Error(`Ya existe un registro con ${campo} = "${valor}"`);
      }
    }
  }

  async _siguienteId() {
    return this._firestoreDb.runTransaction(async (tx) => {
      const snap = await tx.get(this.contadorRef);
      const actual = snap.exists ? snap.data().valor : 0;
      const siguiente = actual + 1;
      tx.set(this.contadorRef, { valor: siguiente });
      return siguiente;
    });
  }

  async add(obj) {
    const datos = this._limpiar(obj);
    await this._verificarUnicidad(datos, undefined);
    // ID aleatorio (colección `empresas`, para que su ID no sea adivinable
    // por fuerza bruta) o numérico consecutivo (colecciones de datos DENTRO
    // de una empresa, para no romper los Number(...) que usa el resto de la
    // app en selects de cliente/categoría/rol/etc).
    const id = this.idAleatorio ? this.col.doc().id : await this._siguienteId();
    datos.id = id;
    await this.col.doc(String(id)).set(datos);
    return id;
  }

  async put(obj) {
    if (obj.id === undefined || obj.id === null) return this.add(obj);
    const datos = this._limpiar(obj);
    await this._verificarUnicidad(datos, obj.id);
    await this.col.doc(String(obj.id)).set(datos);
    return obj.id;
  }

  async get(id) {
    const snap = await this.col.doc(String(id)).get();
    return snap.exists ? snap.data() : null;
  }

  async getByIndex(campo, valor) {
    const snap = await this.col.where(campo, '==', valor).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
  }

  async getAll() {
    const snap = await this.col.get();
    return snap.docs.map((d) => d.data());
  }

  async getAllByIndex(campo, valor) {
    const snap = await this.col.where(campo, '==', valor).get();
    return snap.docs.map((d) => d.data());
  }

  async delete(id) {
    await this.col.doc(String(id)).delete();
  }
}

class FirestoreAjustesStore {
  constructor(coleccionRef) {
    this.col = coleccionRef;
  }
  async get(clave) {
    const snap = await this.col.doc(clave).get();
    return snap.exists ? snap.data() : null;
  }
  async add(obj) {
    await this.col.doc(obj.clave).set(obj);
    return obj.clave;
  }
  async put(obj) {
    await this.col.doc(obj.clave).set(obj);
    return obj.clave;
  }
  async delete(clave) {
    await this.col.doc(clave).delete();
  }
  async getAll() {
    const snap = await this.col.get();
    return snap.docs.map((d) => d.data());
  }
}

// baseRef puede ser el propio firestoreDb (para colecciones raíz, como
// `empresas`) o la referencia a UN documento de empresa (para anidar sus
// colecciones de datos debajo) — ambos exponen .collection(nombre), así que
// el mismo helper sirve para los dos casos.
function crearFirestoreStore(firestoreDb, baseRef, nombre, indices, opciones) {
  return new FirestoreStore(firestoreDb, baseRef.collection(nombre), baseRef.collection('_contadores'), nombre, indices, opciones);
}

function crearFirestoreAjustesStore(baseRef) {
  return new FirestoreAjustesStore(baseRef.collection('ajustes'));
}

// ================================ DB ====================================

class DB {
  async init() {
    this.multiEmpresa = !!window.FIREBASE_HABILITADO;
    if (this.multiEmpresa) {
      await this._initFirestoreBase();
      // OJO: en modo Firestore, aquí TERMINA init(). Todavía no hay ninguna
      // empresa elegida, así que los stores de datos (productos, clientes...)
      // no existen hasta llamar a entrarEnEmpresa(empresaId) — eso lo hace
      // Empresa.js/App.js después de que la persona elige o registra su
      // empresa, antes de mostrar la pantalla de "elige tu usuario".
    } else {
      await this._initIndexedDB();
      await this._seedUnidades();
      await this._seedRolesYUsuarios();
      await this._seedAjustes();
    }
    return this;
  }

  async _initIndexedDB() {
    this.db = await openDatabase();
    for (const nombre of Object.keys(SCHEMA)) {
      this[nombre] = new Store(this.db, nombre);
    }
    this.ajustes = new Store(this.db, 'ajustes');
  }

  async _initFirestoreBase() {
    firebase.initializeApp(window.FIREBASE_CONFIG);

    const firestoreDb = firebase.firestore();
    try {
      await firestoreDb.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      console.warn('Persistencia offline de Firestore no disponible:', e && e.message);
    }
    this._firestoreDb = firestoreDb;

    // Si ya había una sesión (anónima o real) de una visita anterior en este
    // dispositivo, Firebase la restaura sola — no hay que pisarla con una
    // nueva sesión anónima. Solo si de verdad no hay ninguna (primera vez
    // aquí) se crea una anónima, para poder buscar empresas por correo.
    const usuarioExistente = await new Promise((resolve, reject) => {
      let cancelar;
      cancelar = firebase.auth().onAuthStateChanged((user) => {
        // onAuthStateChanged puede llamar a este callback de forma SÍNCRONA
        // en el mismo instante en que se registra — en ese caso `cancelar`
        // todavía no terminó de asignarse (es el valor que ESTA MISMA
        // llamada va a devolver). Desuscribirse en un microtask asegura que
        // la asignación ya haya terminado para entonces, incluso en ese
        // primer disparo síncrono — si no, el listener se queda pegado para
        // siempre.
        Promise.resolve().then(() => { if (cancelar) cancelar(); });
        resolve(user);
      }, reject);
    });
    if (!usuarioExistente) {
      await this._esperarSesion(() => firebase.auth().signInAnonymously());
    }

    this.empresas = crearFirestoreStore(firestoreDb, firestoreDb, 'empresas', SCHEMA_EMPRESAS, { idAleatorio: true });
    this.empresaActualId = null;
  }

  // Conecta los stores de datos de UNA empresa específica (Firestore). Solo
  // construye las referencias — no siembra ni escribe nada todavía, porque
  // en este punto normalmente aún no hay una sesión autorizada (ver
  // autorizarSesionActual). En modo IndexedDB no hace nada.
  async entrarEnEmpresa(empresaId) {
    if (!this.multiEmpresa) return;
    const empresaRef = this._firestoreDb.collection('empresas').doc(String(empresaId));
    for (const [nombre, indices] of Object.entries(SCHEMA)) {
      this[nombre] = crearFirestoreStore(this._firestoreDb, empresaRef, nombre, indices);
    }
    this.ajustes = crearFirestoreAjustesStore(empresaRef);
    this.empresaActualId = empresaId;
  }

  // Se llama justo después de que la sesión actual de Firebase Auth pasa a
  // ser REAL (createUserWithEmailAndPassword o signInWithEmailAndPassword
  // exitosos, no anónima) — ver js/auth.js. Escribe el documento que
  // firestore.rules exige para conceder acceso al resto de los datos de la
  // empresa, y siembra los valores por defecto la primera vez (idempotente:
  // no hace nada si ya existían). En modo IndexedDB no hace nada.
  async autorizarSesionActual() {
    if (!this.multiEmpresa || !this.empresaActualId) return;
    const uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
    if (!uid) return;
    await this._firestoreDb
      .collection('empresas').doc(String(this.empresaActualId))
      .collection('autorizados').doc(uid)
      .set({ fecha: new Date().toISOString() });

    await this._seedUnidades();
    await this._seedAjustes();
    await this._seedRolAdministrador();
  }

  // Cierra la sesión real actual (si la hay) y vuelve a una sesión anónima —
  // necesario al "Cambiar usuario" o "Cambiar empresa", porque Firebase Auth
  // solo mantiene una identidad activa a la vez: para que la siguiente
  // persona pueda intentar SU contraseña, hay que soltar la cuenta actual
  // primero. En modo IndexedDB no hace nada.
  async volverAAnonimo() {
    if (!this.multiEmpresa) return;
    await firebase.auth().signOut();
    await this._esperarSesion(() => firebase.auth().signInAnonymously());
  }

  // Espera a que onAuthStateChanged confirme una sesión (después de disparar
  // la acción que la inicia) y resuelve con ese usuario. Misma precaución
  // que arriba: el listener se desuscribe en un microtask, no en el mismo
  // tick síncrono, para no quedar pegado si llega a dispararse de entrada.
  _esperarSesion(iniciarSesion) {
    return new Promise((resolve, reject) => {
      let cancelar;
      cancelar = firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          Promise.resolve().then(() => { if (cancelar) cancelar(); });
          resolve(user);
        }
      }, reject);
      iniciarSesion().catch(reject);
    });
  }

  // --- Sembrado de valores por defecto ---

  // Solo el ROL Administrador (modo Firestore multiempresa): el primer
  // usuario de una empresa nueva lo crea explícitamente quien se registra
  // (ver Empresa.js), con su propio nombre y contraseña — nadie queda con
  // una cuenta "admin" genérica y sin dueño.
  async _seedRolAdministrador() {
    const roles = await this.roles.getAll();
    if (roles.some((r) => r.esSistema)) return;
    await this.roles.add({ nombre: 'Administrador', permisos: window.AppPermisos.permisosCompletos(), esSistema: true });
  }

  // Rol Administrador + usuario 'admin' (modo IndexedDB, un solo espacio
  // local — aquí sí tiene sentido un usuario semilla, como antes).
  async _seedRolesYUsuarios() {
    const roles = await this.roles.getAll();
    let admin = roles.find((r) => r.esSistema);
    if (!admin) {
      const id = await this.roles.add({ nombre: 'Administrador', permisos: window.AppPermisos.permisosCompletos(), esSistema: true });
      admin = { id, nombre: 'Administrador' };
    }
    const usuarios = await this.usuarios.getAll();
    if (usuarios.length === 0) {
      await this.usuarios.add({ nombre: 'admin', rolId: admin.id, estado: 'activo' });
    }
  }

  async _seedAjustes() {
    const existente = await this.ajustes.get('modulosActivos');
    if (existente) return;
    const valor = Object.fromEntries(
      window.AppPermisos.MODULOS_APP.filter((m) => m !== 'configuracion').map((m) => [m, true])
    );
    await this.ajustes.add({ clave: 'modulosActivos', valor });
  }

  async _seedUnidades() {
    const existentes = await this.unidadesMedida.getAll();
    if (existentes.length > 0) return;
    for (const u of UNIDADES_DEFAULT) {
      await this.unidadesMedida.add(u);
    }
  }
}

window.AppDB = new DB();
