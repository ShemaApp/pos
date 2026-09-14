// Reportes.js — Lee la bitácora de movimientos de todos los módulos.
// Filtra por módulo/tipo/fecha, agrupa por día/semana/mes/año o rango
// personalizado, y permite exportar/importar los movimientos en CSV.
const { useState, useEffect, useMemo } = React;

function inicioSemana(d) {
  const date = new Date(d);
  const dia = date.getDay(); // 0=domingo
  const diff = dia === 0 ? -6 : 1 - dia; // lunes como inicio de semana
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function claveGrupo(fechaISO, agrupacion) {
  const d = new Date(fechaISO);
  if (agrupacion === 'dia') return d.toISOString().slice(0, 10);
  if (agrupacion === 'semana') return 'Semana del ' + inicioSemana(d).toISOString().slice(0, 10);
  if (agrupacion === 'mes') return d.toLocaleDateString('es', { year: 'numeric', month: 'long' });
  if (agrupacion === 'año') return String(d.getFullYear());
  return 'Rango seleccionado';
}

function inicioDe(rango) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (rango === 'hoy') return hoy;
  if (rango === '7dias') { const d = new Date(hoy); d.setDate(d.getDate() - 6); return d; }
  if (rango === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  if (rango === 'año') return new Date(hoy.getFullYear(), 0, 1);
  return null; // 'todo'
}

function ReportesModule({ permisos }) {
  const p = permisos || window.AppPermisos.permisosCompletos().reportes;
  const [movimientos, setMovimientos] = useState([]);
  const [filtroModulo, setFiltroModulo] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [rangoPreset, setRangoPreset] = useState('mes');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [agrupacion, setAgrupacion] = useState('dia');
  const [grupoAbierto, setGrupoAbierto] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const cargar = () => window.AppDB.movimientos.getAll().then(setMovimientos);

  useEffect(() => { cargar(); }, []);

  const flash = (msg) => { setMensaje(msg); setTimeout(() => setMensaje(''), 3000); };

  // Rango de fechas efectivo: si hay desde/hasta manual, ese manda (modo "seleccionable");
  // si no, se deriva del preset rápido.
  const rangoEfectivo = useMemo(() => {
    if (desde || hasta) {
      return {
        desde: desde ? new Date(desde + 'T00:00:00') : null,
        hasta: hasta ? new Date(hasta + 'T23:59:59') : null,
      };
    }
    const inicio = inicioDe(rangoPreset);
    return { desde: inicio, hasta: null };
  }, [desde, hasta, rangoPreset]);

  const tiposDisponibles = useMemo(() => {
    if (filtroModulo === 'todos') {
      return Object.assign({}, ...Object.values(window.AppMovimientos.TIPOS));
    }
    return window.AppMovimientos.TIPOS[filtroModulo] || {};
  }, [filtroModulo]);

  const filtrados = useMemo(() => {
    return movimientos
      .filter((m) => filtroModulo === 'todos' || m.modulo === filtroModulo)
      .filter((m) => filtroTipo === 'todos' || m.tipo === filtroTipo)
      .filter((m) => {
        const f = new Date(m.fecha);
        if (rangoEfectivo.desde && f < rangoEfectivo.desde) return false;
        if (rangoEfectivo.hasta && f > rangoEfectivo.hasta) return false;
        return true;
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  }, [movimientos, filtroModulo, filtroTipo, rangoEfectivo]);

  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const m of filtrados) {
      const clave = claveGrupo(m.fecha, agrupacion);
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave).push(m);
    }
    return Array.from(mapa.entries()).map(([clave, items]) => ({
      clave,
      items,
      total: items.reduce((acc, it) => acc + (typeof it.monto === 'number' ? it.monto : 0), 0),
      tieneMontos: items.some((it) => typeof it.monto === 'number'),
    }));
  }, [filtrados, agrupacion]);

  const exportar = () => {
    const columns = [
      { key: 'fecha', label: 'fecha' },
      { key: 'modulo', label: 'modulo' },
      { key: 'tipo', label: 'tipo' },
      { key: 'entidadId', label: 'entidadId' },
      { key: 'entidadNombre', label: 'entidadNombre' },
      { key: 'monto', label: 'monto' },
      { key: 'detalle', label: 'detalle' },
    ];
    window.AppUtils.downloadFile('movimientos.csv', window.AppUtils.toCSV(filtrados, columns));
  };

  const importar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = window.AppUtils.parseCSV(text);
    let creados = 0, errores = 0;
    for (const row of rows) {
      if (!row.fecha || !row.modulo || !row.tipo) { errores++; continue; }
      await window.AppDB.movimientos.add({
        fecha: row.fecha,
        modulo: row.modulo,
        tipo: row.tipo,
        entidadId: row.entidadId ? Number(row.entidadId) || row.entidadId : undefined,
        entidadNombre: row.entidadNombre || undefined,
        monto: row.monto ? Number(row.monto) : undefined,
        detalle: row.detalle || undefined,
      });
      creados++;
    }
    e.target.value = '';
    await window.AppMovimientos.registrar('reportes', 'importacion', { detalle: `${creados} movimientos importados, ${errores} con error` });
    cargar();
    flash(`Importación: ${creados} movimientos agregados, ${errores} con error.`);
  };

  const limpiarFechas = () => { setDesde(''); setHasta(''); };

  return (
    <div className="module-reportes">
      {mensaje && <div className="toast">{mensaje}</div>}

      <div className="card">
        <div className="filtros-grid">
          <label className="field">
            Módulo
            <select value={filtroModulo} onChange={(e) => { setFiltroModulo(e.target.value); setFiltroTipo('todos'); }}>
              <option value="todos">Todos</option>
              {Object.entries(window.AppMovimientos.MODULOS).filter(([k]) => k !== 'reportes').map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          <label className="field">
            Tipo
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="todos">Todos</option>
              {Object.entries(tiposDisponibles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>

          <label className="field">
            Agrupar por
            <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value)}>
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="año">Año</option>
              <option value="personalizado">Rango seleccionado (sin subdividir)</option>
            </select>
          </label>
        </div>

        <div className="filtros-fecha">
          <div className="chip-group">
            {[
              ['hoy', 'Hoy'], ['7dias', '7 días'], ['mes', 'Este mes'], ['año', 'Este año'], ['todo', 'Todo'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={rangoPreset === k && !desde && !hasta ? 'chip chip-active' : 'chip'}
                onClick={() => { setRangoPreset(k); limpiarFechas(); }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rango-personalizado">
            <label className="field field-inline">
              Desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="field field-inline">
              Hasta
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            {(desde || hasta) && <button className="btn-link" onClick={limpiarFechas}>Quitar rango</button>}
          </div>
        </div>

        <div className="form-actions form-actions-left">
          {p.exportar && <button className="btn-secondary" onClick={exportar}>Exportar CSV</button>}
          {p.importar && (
            <label className="btn-secondary file-label">
              Importar CSV
              <input type="file" accept=".csv" onChange={importar} style={{ display: 'none' }} />
            </label>
          )}
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Periodo</th>
            <th>Movimientos</th>
            <th>Monto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {grupos.length === 0 ? (
            <tr><td colSpan={4} className="empty-state">No hay movimientos con estos filtros.</td></tr>
          ) : (
            grupos.map((g) => (
              <React.Fragment key={g.clave}>
                <tr className="clickable" onClick={() => setGrupoAbierto(grupoAbierto === g.clave ? null : g.clave)}>
                  <td>{g.clave}</td>
                  <td>{g.items.length}</td>
                  <td>{g.tieneMontos ? '$' + window.AppUtils.formatMoney(g.total) : '—'}</td>
                  <td className="actions-cell">{grupoAbierto === g.clave ? 'Ocultar' : 'Ver'}</td>
                </tr>
                {grupoAbierto === g.clave && (
                  <tr>
                    <td colSpan={4}>
                      <table className="data-table nested-table">
                        <tbody>
                          {g.items.map((m) => (
                            <tr key={m.id}>
                              <td className="mono">{new Date(m.fecha).toLocaleString('es')}</td>
                              <td>{window.AppMovimientos.MODULOS[m.modulo] || m.modulo}</td>
                              <td>{(window.AppMovimientos.TIPOS[m.modulo] || {})[m.tipo] || m.tipo}</td>
                              <td>{m.entidadNombre || '—'}</td>
                              <td>{typeof m.monto === 'number' ? '$' + window.AppUtils.formatMoney(m.monto) : ''}</td>
                              <td className="detail-sub">{m.detalle || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

window.ReportesModule = ReportesModule;
