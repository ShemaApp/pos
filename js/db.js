// db.js — Capa de datos. Dos backends intercambiables detrás de la MISMA
// interfaz (add/put/get/getAll/getByIndex/getAllByIndex/delete):
//   - IndexedDB (Store)         → por defecto, 100% local, sin cuenta.
//   - Firestore (FirestoreStore) → cuando window.FIREBASE_HABILITADO === true.
// Ningún otro módulo de la app conoce cuál backend está activo: todos llaman
// a window.AppDB.<coleccion>.<metodo>(...) igual en ambos casos.
const DB_NAME = 'inventario-app';
const DB_VERSION = 5;

// Esquema único: qué campos son índice de búsqueda y cuáles deben ser únicos.
// Alimenta tanto los createIndex() de IndexedDB como las consultas where() y
// la validación de unicidad de FirestoreStore — así los dos backends nunca
// pueden quedar desalineados entre sí.
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
        // Clave-valor genérico. Se usa para 'modulosActivos' (on/off por módulo).
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
      // No incluir codigoBarras si está vacío: así el índice único no choca
      // entre varios productos sin código (IndexedDB no indexa claves undefined).
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

  // Todas las filas cuyo índice coincide con value (a diferencia de getByIndex,
  // que asume un índice único y regresa solo una).
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
// Requiere que se hayan cargado firebase-app-compat.js y firebase-firestore-compat.js
// (y firebase-auth-compat.js para la auth anónima) antes de este archivo, y que
// window.FIREBASE_CONFIG / window.FIREBASE_HABILITADO estén definidos (ver
// firebase-config.js). IDs: se generan numéricos vía un contador transaccional
// en _contadores/<coleccion>, para que sean intercambiables con los IDs de
// IndexedDB y no rompan los `Number(...)` que usa el resto de la app.

class FirestoreStore {
  constructor(firestoreDb, nombre, indices) {
    this._firestoreDb = firestoreDb;
    this.col = firestoreDb.collection(nombre);
    this.indices = indices || {};
    this.contadorRef = firestoreDb.collection('_contadores').doc(nombre);
  }

  _limpiar(obj) {
    const clean = { ...obj };
    if (!clean.codigoBarras) delete clean.codigoBarras;
    // Firestore no acepta el valor `undefined` en un campo (a diferencia de
    // IndexedDB, que lo tolera igual que "ausente") — hay que quitarlos.
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
    const id = await this._siguienteId();
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

// 'ajustes' usa 'clave' como llave directa (no numérica, no autoincrement),
// igual que su equivalente de IndexedDB (keyPath: 'clave').
class FirestoreAjustesStore {
  constructor(firestoreDb) {
    this.col = firestoreDb.collection('ajustes');
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

// ================================ DB ====================================

class DB {
  async init() {
    if (window.FIREBASE_HABILITADO) {
      await this._initFirestore();
    } else {
      await this._initIndexedDB();
    }
    await this._seedUnidades();
    await this._seedRolesYUsuarios();
    await this._seedAjustes();
    return this;
  }

  async _initIndexedDB() {
    this.db = await openDatabase();
    for (const nombre of Object.keys(SCHEMA)) {
      this[nombre] = new Store(this.db, nombre);
    }
    this.ajustes = new Store(this.db, 'ajustes');
  }

  async _initFirestore() {
    firebase.initializeApp(window.FIREBASE_CONFIG);

    // Auth anónima: sin esto, cualquiera que abra las herramientas de
    // desarrollador y conozca el firebaseConfig público podría leer/escribir
    // la base directo, sin pasar por la app. No sustituye el rol/permiso de
    // cada usuario dentro de la app — solo exige "eres un cliente válido".
    await new Promise((resolve, reject) => {
      let cancelar;
      cancelar = firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          if (cancelar) cancelar();
          resolve(user);
        }
      }, reject);
      firebase.auth().signInAnonymously().catch(reject);
    });

    const firestoreDb = firebase.firestore();
    try {
      await firestoreDb.enablePersistence({ synchronizeTabs: true });
    } catch (e) {
      // No soportado (navegador viejo) o hay otra pestaña sin sincronizar — no es fatal.
      console.warn('Persistencia offline de Firestore no disponible:', e && e.message);
    }

    this._firestoreDb = firestoreDb;
    for (const [nombre, indices] of Object.entries(SCHEMA)) {
      this[nombre] = new FirestoreStore(firestoreDb, nombre, indices);
    }
    this.ajustes = new FirestoreAjustesStore(firestoreDb);
  }

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
