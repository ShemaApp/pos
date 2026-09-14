// permisos.js — Catálogo de acciones y dependencias entre módulos.
// Se consolidan los verbos del negocio (crear/agregar, editar/actualizar,
// borrar/eliminar...) en un set canónico reutilizable en todos los módulos.

const ACCIONES = ['consultar', 'crear', 'editar', 'archivar', 'restaurar', 'eliminar', 'importar', 'exportar'];

const ACCIONES_LABELS = {
  consultar: 'Consultar',
  crear: 'Crear / agregar',
  editar: 'Editar / actualizar',
  archivar: 'Archivar',
  restaurar: 'Restaurar',
  eliminar: 'Eliminar / borrar',
  importar: 'Importar',
  exportar: 'Exportar',
};

// Módulos que aparecen como pestañas. 'configuracion' siempre está disponible
// (no se puede apagar), pero también tiene su propio set de permisos por rol.
const MODULOS_APP = ['ventas', 'inventario', 'clientes', 'creditos', 'reportes', 'configuracion'];

const MODULOS_APP_LABELS = {
  ventas: 'Ventas',
  inventario: 'Inventario',
  clientes: 'Clientes',
  creditos: 'Créditos',
  reportes: 'Reportes',
  configuracion: 'Configuración',
};

// Créditos depende de Clientes: no puede existir un crédito sin cliente,
// así que apagar Clientes apaga Créditos, y encender Créditos enciende Clientes.
const DEPENDENCIAS = { creditos: ['clientes'] };

function permisoModuloCompleto() {
  return Object.fromEntries(ACCIONES.map((a) => [a, true]));
}

function permisoModuloVacio() {
  return Object.fromEntries(ACCIONES.map((a) => [a, false]));
}

function permisosCompletos() {
  return Object.fromEntries(MODULOS_APP.map((m) => [m, permisoModuloCompleto()]));
}

function permisosVacios() {
  return Object.fromEntries(MODULOS_APP.map((m) => [m, permisoModuloVacio()]));
}

window.AppPermisos = {
  ACCIONES,
  ACCIONES_LABELS,
  MODULOS_APP,
  MODULOS_APP_LABELS,
  DEPENDENCIAS,
  permisosCompletos,
  permisosVacios,
};
