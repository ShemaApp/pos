// movimientos.js — Bitácora unificada. Cada módulo llama a registrar() en
// sus acciones relevantes; Reportes lee de aquí para filtrar/agrupar/exportar.

const MODULOS_MOV = {
  inventario: 'Inventario',
  clientes: 'Clientes',
  creditos: 'Créditos',
  ventas: 'Ventas',
  configuracion: 'Configuración',
  reportes: 'Reportes',
};

const TIPOS_MOV = {
  inventario: {
    producto_creado: 'Producto creado',
    producto_editado: 'Producto editado',
    producto_archivado: 'Producto archivado',
    producto_restaurado: 'Producto restaurado',
    producto_eliminado: 'Producto eliminado',
    codigo_cambiado: 'Código cambiado',
    existencia_vendida: 'Salida por venta',
    existencia_restaurada: 'Reingreso por cancelación',
    importacion: 'Importación',
  },
  clientes: {
    cliente_creado: 'Cliente creado',
    cliente_editado: 'Cliente editado',
    cliente_archivado: 'Cliente archivado',
    cliente_restaurado: 'Cliente restaurado',
    cliente_eliminado: 'Cliente eliminado',
    importacion: 'Importación',
  },
  creditos: {
    credito_creado: 'Crédito creado',
    abono_registrado: 'Abono registrado',
    credito_liquidado: 'Crédito liquidado',
    credito_cancelado: 'Crédito cancelado',
  },
  ventas: {
    venta_creada: 'Venta creada',
    venta_cancelada: 'Venta cancelada',
  },
  configuracion: {
    modulo_activado: 'Módulo activado',
    modulo_desactivado: 'Módulo desactivado',
    rol_creado: 'Rol creado',
    rol_editado: 'Rol editado',
    usuario_creado: 'Usuario creado',
    usuario_editado: 'Usuario editado',
    usuario_archivado: 'Usuario archivado',
    usuario_restaurado: 'Usuario restaurado',
    usuario_eliminado: 'Usuario eliminado',
    password_creada: 'Contraseña creada',
    password_cambiada: 'Contraseña cambiada',
    password_restablecida: 'Contraseña restablecida por administrador',
  },
  reportes: {
    importacion: 'Importación de movimientos',
  },
};

async function registrarMovimiento(modulo, tipo, opts) {
  opts = opts || {};
  return window.AppDB.movimientos.add({
    modulo,
    tipo,
    entidadId: opts.entidadId,
    entidadNombre: opts.entidadNombre,
    monto: typeof opts.monto === 'number' ? opts.monto : undefined,
    detalle: opts.detalle,
    fecha: opts.fecha || new Date().toISOString(),
  });
}

window.AppMovimientos = { registrar: registrarMovimiento, MODULOS: MODULOS_MOV, TIPOS: TIPOS_MOV };
