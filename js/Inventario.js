// Inventario.js — Módulo principal: productos.
const { useState, useEffect, useMemo } = React;

const ESTADOS = {
  activo: { label: 'Activo', className: 'badge-ok' },
  archivado: { label: 'Archivado', className: 'badge-warn' },
  eliminado: { label: 'Eliminado', className: 'badge-danger' },
};

function ProductoForm({ producto, unidades, categorias, onGuardar, onCancelar, onCambiarCodigo }) {
  const [form, setForm] = useState(producto);
  const [error, setError] = useState('');
  const [scannerAbierto, setScannerAbierto] = useState(false);
  const [generando, setGenerando] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const generarCodigo = async () => {
    setGenerando(true);
    setError('');
    try {
      const codigo = await window.AppBarcode.generarUnico();
      setForm((f) => ({ ...f, codigoBarras: codigo }));
    } catch (e) {
      setError(e.message || 'No se pudo generar el código.');
    }
    setGenerando(false);
  };

  const guardar = async () => {
    if (!form.nombre || !form.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setError('');
    try {
      await onGuardar(form);
    } catch (e) {
      setError(e.message || 'No se pudo guardar el producto.');
    }
  };

  return React.createElement(
    'div',
    { className: 'card form-card' },
    React.createElement('h3', null, form.id ? 'Editar producto' : 'Agregar producto'),
    error && React.createElement('p', { className: 'error-text' }, error),

    React.createElement(
      'label',
      { className: 'field' },
      'Código de barras',
      React.createElement(
        'div',
        { className: 'field-with-button' },
        React.createElement('input', {
          type: 'text',
          value: form.codigoBarras || '',
          onChange: set('codigoBarras'),
          placeholder: 'Opcional',
          disabled: !!form.id,
        }),
        !form.id && React.createElement(window.BotonVoz, { modo: 'digitos', onTexto: (t) => setForm({ ...form, codigoBarras: t }) }),
        !form.id &&
          React.createElement('button', { type: 'button', className: 'btn-secondary btn-sm', onClick: () => setScannerAbierto(true) }, '📷 Escanear'),
        !form.id &&
          React.createElement(
            'button',
            { type: 'button', className: 'btn-secondary btn-sm', disabled: generando, onClick: generarCodigo },
            generando ? 'Generando...' : '🎲 Generar'
          )
      ),
      form.codigoBarras && !window.AppBarcode.esEAN13Valido(form.codigoBarras) &&
        React.createElement('span', { className: 'detail-sub' }, 'No parece un EAN-13 válido — puede ser otro estándar, se guardará igual.'),
      form.id && React.createElement('button', { type: 'button', className: 'btn-link', onClick: onCambiarCodigo }, 'Cambiar código')
    ),

    React.createElement(
      'label',
      { className: 'field' },
      'Nombre',
      React.createElement(
        'div',
        { className: 'field-with-button' },
        React.createElement('input', { type: 'text', value: form.nombre || '', onChange: set('nombre'), autoFocus: true }),
        React.createElement(window.BotonVoz, { modo: 'texto', onTexto: (t) => setForm({ ...form, nombre: t }) })
      )
    ),

    React.createElement(
      'label',
      { className: 'field' },
      'Unidad',
      React.createElement(
        'select',
        { value: form.unidadMedidaId || '', onChange: (e) => setForm({ ...form, unidadMedidaId: Number(e.target.value) || '' }) },
        React.createElement('option', { value: '' }, 'Selecciona...'),
        unidades.map((u) => React.createElement('option', { key: u.id, value: u.id }, u.nombre))
      )
    ),

    React.createElement(
      'label',
      { className: 'field' },
      'Categoría',
      React.createElement(
        'select',
        { value: form.categoriaId || '', onChange: (e) => setForm({ ...form, categoriaId: Number(e.target.value) || '' }) },
        React.createElement('option', { value: '' }, 'Sin categoría'),
        categorias.map((c) => React.createElement('option', { key: c.id, value: c.id }, c.nombre))
      )
    ),

    React.createElement(
      'label',
      { className: 'field' },
      'Precio',
      React.createElement('input', { type: 'number', step: '0.01', value: form.precio ?? '', onChange: set('precio') })
    ),

    React.createElement(
      'label',
      { className: 'field' },
      'Costo',
      React.createElement('input', { type: 'number', step: '0.01', value: form.costo ?? '', onChange: set('costo') })
    ),

    React.createElement(
      'label',
      { className: 'field' },
      'Existencia' + (form.id ? '' : ' inicial'),
      React.createElement('input', { type: 'number', step: '1', value: form.existencia ?? '', onChange: set('existencia') })
    ),

    React.createElement(
      'div',
      { className: 'form-actions' },
      React.createElement('button', { className: 'btn-secondary', onClick: onCancelar }, 'Cancelar'),
      React.createElement('button', { className: 'btn-primary', onClick: guardar }, 'Guardar')
    ),

    scannerAbierto &&
      React.createElement(window.ScannerModal, {
        onDetected: (code) => {
          setScannerAbierto(false);
          setForm({ ...form, codigoBarras: code });
        },
        onClose: () => setScannerAbierto(false),
      })
  );
}

function InventarioModule({ permisos }) {
  const permisosEfectivos = permisos || window.AppPermisos.permisosCompletos().inventario;
  const [productos, setProductos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [vista, setVista] = useState('lista'); // 'lista' | 'form'
  const [productoActual, setProductoActual] = useState(null);
  const [scannerListaAbierto, setScannerListaAbierto] = useState(false);
  const [etiquetasFor, setEtiquetasFor] = useState(null); // array de productos, o null si cerrado
  const [mensaje, setMensaje] = useState('');

  const cargar = async () => {
    const [p, u, c] = await Promise.all([
      window.AppDB.productos.getAll(),
      window.AppDB.unidadesMedida.getAll(),
      window.AppDB.categorias.getAll(),
    ]);
    setProductos(p);
    setUnidades(u);
    setCategorias(c);
  };

  useEffect(() => {
    cargar();
  }, []);

  const unidadPorId = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u])), [unidades]);
  const categoriaPorId = useMemo(() => Object.fromEntries(categorias.map((c) => [c.id, c])), [categorias]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos
      .filter((p) => p.estado !== 'eliminado')
      .filter((p) => mostrarArchivados || p.estado !== 'archivado')
      .filter((p) => {
        if (!q) return true;
        return (
          (p.nombre || '').toLowerCase().includes(q) ||
          (p.codigoBarras || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [productos, busqueda, mostrarArchivados]);

  const flash = (msg) => {
    setMensaje(msg);
    setTimeout(() => setMensaje(''), 2500);
  };

  // --- Alta / edición ---
  const abrirNuevo = () => {
    setProductoActual({ estado: 'activo' });
    setVista('form');
  };

  const abrirEditar = (p) => {
    setProductoActual(p);
    setVista('form');
  };

  const manejarCodigoEscaneadoEnLista = async (codigo) => {
    setScannerListaAbierto(false);
    const existente = await window.AppDB.productos.getByIndex('codigoBarras', codigo);
    if (existente) {
      abrirEditar(existente);
    } else {
      setProductoActual({ estado: 'activo', codigoBarras: codigo });
      setVista('form');
    }
  };

  const guardarProducto = async (form) => {
    const datos = {
      ...form,
      precio: Number(form.precio) || 0,
      costo: Number(form.costo) || 0,
      existencia: Number(form.existencia) || 0,
      estado: form.estado || 'activo',
      actualizadoEn: new Date().toISOString(),
    };
    if (!datos.id) datos.creadoEn = new Date().toISOString();

    if (datos.codigoBarras) {
      const existente = await window.AppDB.productos.getByIndex('codigoBarras', datos.codigoBarras);
      if (existente && existente.id !== datos.id) {
        throw new Error('Ese código de barras ya está registrado en otro producto.');
      }
    }

    if (datos.id) {
      await window.AppDB.productos.put(datos);
      await window.AppMovimientos.registrar('inventario', 'producto_editado', { entidadId: datos.id, entidadNombre: datos.nombre });
    } else {
      const nuevoId = await window.AppDB.productos.add(datos);
      await window.AppMovimientos.registrar('inventario', 'producto_creado', { entidadId: nuevoId, entidadNombre: datos.nombre });
    }
    setVista('lista');
    setProductoActual(null);
    cargar();
    flash('Producto guardado.');
  };

  // --- Acciones secundarias ---
  const cambiarCodigo = async (p) => {
    const nuevo = prompt('Nuevo código de barras (vacío para quitarlo):', p.codigoBarras || '');
    if (nuevo === null) return;
    if (nuevo) {
      const existente = await window.AppDB.productos.getByIndex('codigoBarras', nuevo);
      if (existente && existente.id !== p.id) {
        alert('Ese código ya pertenece a otro producto.');
        return;
      }
    }
    const actualizado = { ...p, codigoBarras: nuevo || undefined };
    if (!nuevo) delete actualizado.codigoBarras;
    await window.AppDB.productos.put(actualizado);
    await window.AppMovimientos.registrar('inventario', 'codigo_cambiado', {
      entidadId: p.id,
      entidadNombre: p.nombre,
      detalle: `${p.codigoBarras || '(sin código)'} → ${nuevo || '(sin código)'}`,
    });
    cargar();
    flash('Código actualizado.');
  };

  const archivar = async (p) => {
    await window.AppDB.productos.put({ ...p, estado: 'archivado' });
    await window.AppMovimientos.registrar('inventario', 'producto_archivado', { entidadId: p.id, entidadNombre: p.nombre });
    cargar();
    flash('Producto archivado.');
  };

  const restaurar = async (p) => {
    await window.AppDB.productos.put({ ...p, estado: 'activo' });
    await window.AppMovimientos.registrar('inventario', 'producto_restaurado', { entidadId: p.id, entidadNombre: p.nombre });
    cargar();
    flash('Producto restaurado.');
  };

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"? Ya no podrá venderse ni aparecerá en el inventario.`)) return;
    await window.AppDB.productos.put({ ...p, estado: 'eliminado' });
    await window.AppMovimientos.registrar('inventario', 'producto_eliminado', { entidadId: p.id, entidadNombre: p.nombre });
    cargar();
    flash('Producto eliminado.');
  };

  // --- Importar / Exportar ---
  const exportar = () => {
    const columns = [
      { key: 'codigoBarras', label: 'codigoBarras' },
      { key: 'nombre', label: 'nombre' },
      { key: 'categoria', label: 'categoria' },
      { key: 'unidad', label: 'unidad' },
      { key: 'precio', label: 'precio' },
      { key: 'costo', label: 'costo' },
      { key: 'existencia', label: 'existencia' },
      { key: 'estado', label: 'estado' },
    ];
    const rows = productos.map((p) => ({
      ...p,
      categoria: categoriaPorId[p.categoriaId]?.nombre || '',
      unidad: unidadPorId[p.unidadMedidaId]?.nombre || '',
    }));
    window.AppUtils.downloadFile('productos.csv', window.AppUtils.toCSV(rows, columns));
  };

  const importar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = window.AppUtils.parseCSV(text);
    let creados = 0;
    let actualizados = 0;
    let errores = 0;

    for (const row of rows) {
      try {
        if (!row.nombre) {
          errores++;
          continue;
        }
        let unidad = unidades.find((u) => u.nombre.toLowerCase() === (row.unidad || '').toLowerCase());
        let categoria = categorias.find((c) => c.nombre.toLowerCase() === (row.categoria || '').toLowerCase());

        const datos = {
          nombre: row.nombre,
          codigoBarras: row.codigoBarras || undefined,
          unidadMedidaId: unidad ? unidad.id : undefined,
          categoriaId: categoria ? categoria.id : undefined,
          precio: Number(row.precio) || 0,
          costo: Number(row.costo) || 0,
          existencia: Number(row.existencia) || 0,
          estado: row.estado && ESTADOS[row.estado] ? row.estado : 'activo',
          actualizadoEn: new Date().toISOString(),
        };

        const existente = datos.codigoBarras
          ? await window.AppDB.productos.getByIndex('codigoBarras', datos.codigoBarras)
          : null;

        if (existente) {
          await window.AppDB.productos.put({ ...existente, ...datos });
          actualizados++;
        } else {
          datos.creadoEn = new Date().toISOString();
          await window.AppDB.productos.add(datos);
          creados++;
        }
      } catch (err) {
        errores++;
      }
    }
    e.target.value = '';
    cargar();
    await window.AppMovimientos.registrar('inventario', 'importacion', { detalle: `${creados} nuevos, ${actualizados} actualizados, ${errores} con error` });
    flash(`Importación: ${creados} nuevos, ${actualizados} actualizados, ${errores} con error.`);
  };

  if (vista === 'form') {
    return React.createElement(ProductoForm, {
      producto: productoActual,
      unidades,
      categorias,
      onGuardar: guardarProducto,
      onCancelar: () => {
        setVista('lista');
        setProductoActual(null);
      },
      onCambiarCodigo: () => cambiarCodigo(productoActual),
    });
  }

  return React.createElement(
    'div',
    { className: 'module-inventario' },
    mensaje && React.createElement('div', { className: 'toast' }, mensaje),

    React.createElement(
      'div',
      { className: 'toolbar' },
      React.createElement('input', {
        type: 'text',
        className: 'search-input',
        placeholder: 'Buscar por nombre o código...',
        value: busqueda,
        onChange: (e) => setBusqueda(e.target.value),
      }),
      React.createElement('button', { className: 'btn-secondary', onClick: () => setScannerListaAbierto(true) }, '📷 Escanear'),
      permisosEfectivos.crear && React.createElement('button', { className: 'btn-primary', onClick: abrirNuevo }, '+ Agregar producto')
    ),

    React.createElement(
      'div',
      { className: 'toolbar toolbar-secondary' },
      React.createElement(
        'label',
        { className: 'checkbox-field' },
        React.createElement('input', {
          type: 'checkbox',
          checked: mostrarArchivados,
          onChange: (e) => setMostrarArchivados(e.target.checked),
        }),
        'Mostrar archivados'
      ),
      permisosEfectivos.exportar && React.createElement('button', { className: 'btn-link', onClick: exportar }, 'Exportar CSV'),
      permisosEfectivos.importar && React.createElement(
        'label',
        { className: 'btn-link file-label' },
        'Importar CSV',
        React.createElement('input', { type: 'file', accept: '.csv', onChange: importar, style: { display: 'none' } })
      ),
      permisosEfectivos.exportar &&
        React.createElement(
          'button',
          { className: 'btn-link', onClick: () => setEtiquetasFor(visibles.filter((p) => p.estado === 'activo')) },
          '🏷️ Imprimir etiquetas (visibles)'
        )
    ),

    React.createElement(
      'table',
      { className: 'data-table' },
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          null,
          React.createElement('th', null, 'Producto'),
          React.createElement('th', null, 'Código'),
          React.createElement('th', null, 'Unidad'),
          React.createElement('th', null, 'Precio'),
          React.createElement('th', null, 'Existencia'),
          React.createElement('th', null, 'Estado'),
          React.createElement('th', null)
        )
      ),
      React.createElement(
        'tbody',
        null,
        visibles.length === 0
          ? React.createElement('tr', null, React.createElement('td', { colSpan: 7, className: 'empty-state' }, 'No hay productos que coincidan.'))
          : visibles.map((p) =>
              React.createElement(
                'tr',
                { key: p.id },
                React.createElement('td', { className: 'clickable', onClick: () => abrirEditar(p) }, p.nombre),
                React.createElement('td', { className: 'mono' }, p.codigoBarras || '—'),
                React.createElement('td', null, unidadPorId[p.unidadMedidaId]?.abreviatura || '—'),
                React.createElement('td', null, '$', window.AppUtils.formatMoney(p.precio)),
                React.createElement('td', null, p.existencia),
                React.createElement('td', null, React.createElement('span', { className: `badge ${ESTADOS[p.estado].className}` }, ESTADOS[p.estado].label)),
                React.createElement(
                  'td',
                  { className: 'actions-cell' },
                  permisosEfectivos.editar && React.createElement('button', { className: 'btn-link', onClick: () => abrirEditar(p) }, 'Editar'),
                  permisosEfectivos.exportar && p.codigoBarras &&
                    React.createElement('button', { className: 'btn-link', onClick: () => setEtiquetasFor([p]) }, 'Imprimir'),
                  permisosEfectivos.archivar && p.estado === 'activo' &&
                    React.createElement('button', { className: 'btn-link', onClick: () => archivar(p) }, 'Archivar'),
                  permisosEfectivos.restaurar && p.estado === 'archivado' &&
                    React.createElement('button', { className: 'btn-link', onClick: () => restaurar(p) }, 'Restaurar'),
                  permisosEfectivos.eliminar && React.createElement('button', { className: 'btn-link danger', onClick: () => eliminar(p) }, 'Eliminar')
                )
              )
            )
      )
    ),

    scannerListaAbierto &&
      React.createElement(window.ScannerModal, {
        onDetected: manejarCodigoEscaneadoEnLista,
        onClose: () => setScannerListaAbierto(false),
      }),

    etiquetasFor &&
      React.createElement(window.EtiquetasModal, {
        productos: etiquetasFor,
        onClose: () => setEtiquetasFor(null),
      })
  );
}

window.InventarioModule = InventarioModule;
