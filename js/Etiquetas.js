// Etiquetas.js — Impresión de etiquetas de código de barras (JsBarcode + CSS
// de impresión). Tamaño de etiqueta, columnas por hoja, cantidad por
// producto, y qué texto mostrar (motor de configuración de impresión).
const { useState, useMemo, useEffect } = React;

const TAMANOS_ETIQUETA = {
  pequena: { label: 'Pequeña (40×20mm)', ancho: 40, alto: 20 },
  mediana: { label: 'Mediana (50×30mm)', ancho: 50, alto: 30 },
  grande: { label: 'Grande (60×40mm)', ancho: 60, alto: 40 },
};

function EtiquetasModal({ productos, onClose }) {
  const [cantidades, setCantidades] = useState(() => Object.fromEntries(productos.map((p) => [p.id, 1])));
  const [tamano, setTamano] = useState('mediana');
  const [columnas, setColumnas] = useState(3);
  const [mostrarNombre, setMostrarNombre] = useState(true);
  const [mostrarPrecio, setMostrarPrecio] = useState(true);
  const [mostrarTexto, setMostrarTexto] = useState(true);

  const conCodigo = productos.filter((p) => p.codigoBarras);
  const sinCodigo = productos.filter((p) => !p.codigoBarras);

  const etiquetas = useMemo(() => {
    const lista = [];
    conCodigo.forEach((p) => {
      const n = Math.max(0, Math.min(200, Number(cantidades[p.id]) || 0));
      for (let i = 0; i < n; i++) lista.push(p);
    });
    return lista;
    // eslint-disable-next-line
  }, [productos, cantidades]);

  useEffect(() => {
    etiquetas.forEach((p, i) => {
      const el = document.getElementById('etiqueta-svg-' + i);
      if (!el || typeof JsBarcode === 'undefined') return;
      try {
        JsBarcode(el, p.codigoBarras, {
          format: p.codigoBarras.length === 13 ? 'EAN13' : 'CODE128',
          displayValue: mostrarTexto,
          width: 1.6,
          height: 42,
          margin: 4,
          fontSize: 11,
        });
      } catch (e) {
        // Código con un formato que JsBarcode no reconoce como EAN13 — se
        // intenta igual como CODE128 (acepta cualquier texto/número).
        try {
          JsBarcode(el, p.codigoBarras, { format: 'CODE128', displayValue: mostrarTexto, width: 1.6, height: 42, margin: 4, fontSize: 11 });
        } catch (e2) {
          // código no imprimible como barras (caracteres no soportados) — se deja el SVG vacío
        }
      }
    });
  }, [etiquetas, mostrarTexto]);

  const tam = TAMANOS_ETIQUETA[tamano];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>Imprimir etiquetas</h3>
        {sinCodigo.length > 0 && (
          <p className="error-text">
            {sinCodigo.length} producto(s) sin código de barras no se pueden imprimir: {sinCodigo.map((p) => p.nombre).join(', ')}. Agrégales un código primero (ver "Generar").
          </p>
        )}
        {conCodigo.length === 0 && <p className="empty-state">Ningún producto seleccionado tiene código de barras.</p>}

        {conCodigo.length > 0 && (
          <React.Fragment>
            <div className="filtros-grid">
              <label className="field">
                Tamaño de etiqueta
                <select value={tamano} onChange={(e) => setTamano(e.target.value)}>
                  {Object.entries(TAMANOS_ETIQUETA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="field">
                Columnas por hoja
                <input type="number" min="1" max="8" value={columnas} onChange={(e) => setColumnas(Math.max(1, Number(e.target.value) || 1))} />
              </label>
            </div>

            <div className="chip-group">
              <label className="checkbox-field"><input type="checkbox" checked={mostrarNombre} onChange={(e) => setMostrarNombre(e.target.checked)} /> Nombre</label>
              <label className="checkbox-field"><input type="checkbox" checked={mostrarPrecio} onChange={(e) => setMostrarPrecio(e.target.checked)} /> Precio</label>
              <label className="checkbox-field"><input type="checkbox" checked={mostrarTexto} onChange={(e) => setMostrarTexto(e.target.checked)} /> Número debajo de las barras</label>
            </div>

            <h4 className="section-title">Cantidad por producto</h4>
            <div className="table-scroll">
              <table className="data-table">
                <tbody>
                  {conCodigo.map((p) => (
                    <tr key={p.id}>
                      <td>{p.nombre} <span className="mono">({p.codigoBarras})</span></td>
                      <td style={{ width: 90 }}>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={cantidades[p.id] ?? 1}
                          onChange={(e) => setCantidades({ ...cantidades, [p.id]: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </React.Fragment>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
          <button className="btn-primary" disabled={etiquetas.length === 0} onClick={() => window.print()}>
            Imprimir ({etiquetas.length})
          </button>
        </div>

        <p className="detail-sub">Vista previa (lo que se imprime son solo las etiquetas, no esta ventana):</p>
        <div
          id="area-impresion"
          className="etiquetas-grid"
          style={{ '--etq-cols': columnas, '--etq-w': tam.ancho + 'mm', '--etq-h': tam.alto + 'mm' }}
        >
          {etiquetas.map((p, i) => (
            <div className="etiqueta" key={i}>
              {mostrarNombre && <div className="etiqueta-nombre">{p.nombre}</div>}
              <svg id={'etiqueta-svg-' + i}></svg>
              {mostrarPrecio && <div className="etiqueta-precio">${window.AppUtils.formatMoney(p.precio)}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.EtiquetasModal = EtiquetasModal;
