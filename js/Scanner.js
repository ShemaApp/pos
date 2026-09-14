// Scanner.js — Modal de escaneo de código de barras. Cámara automática por
// defecto, con "Cancelar" y "Escribir manualmente" (con dictado por voz)
// siempre disponibles — se usa igual desde Inventario, Ventas, etc.
const { useEffect, useRef, useState } = React;

function ScannerModal({ onDetected, onClose }) {
  const containerId = useRef('scanner-' + Math.random().toString(36).slice(2));
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [modoManual, setModoManual] = useState(false);
  const [valorManual, setValorManual] = useState('');

  useEffect(() => {
    if (modoManual) return; // no iniciar la cámara si el usuario ya eligió escribir a mano
    let cancelled = false;

    if (typeof Html5Qrcode === 'undefined') {
      setError('No se pudo cargar el lector de cámara. Revisa tu conexión.');
      return;
    }

    const scanner = new Html5Qrcode(containerId.current);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 160 } },
        (decodedText) => {
          if (cancelled) return;
          cancelled = true;
          scanner
            .stop()
            .catch(() => {})
            .finally(() => onDetected(decodedText));
        },
        () => {
          // errores de frame individuales: se ignoran, son constantes durante el enfoque
        }
      )
      .catch((err) => {
        setError('No se pudo acceder a la cámara: ' + (err && err.message ? err.message : err));
      });

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [modoManual]);

  const usarManual = () => {
    const limpio = valorManual.trim();
    if (!limpio) return;
    onDetected(limpio);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal scanner-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Escanear código</h3>

        {!modoManual ? (
          error ? <p className="error-text">{error}</p> : <div id={containerId.current} className="scanner-view"></div>
        ) : (
          <label className="field">
            Código
            <div className="field-with-button">
              <input
                type="text"
                inputMode="numeric"
                value={valorManual}
                onChange={(e) => setValorManual(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && usarManual()}
                placeholder="Escribe o dicta el código"
                autoFocus
              />
              <window.BotonVoz modo="digitos" onTexto={setValorManual} />
            </div>
          </label>
        )}

        <div className="form-actions">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          {modoManual ? (
            <React.Fragment>
              <button className="btn-link" onClick={() => { setModoManual(false); setError(null); }}>Volver a la cámara</button>
              <button className="btn-primary" disabled={!valorManual.trim()} onClick={usarManual}>Usar este código</button>
            </React.Fragment>
          ) : (
            <button className="btn-link" onClick={() => setModoManual(true)}>Escribir manualmente</button>
          )}
        </div>
      </div>
    </div>
  );
}

window.ScannerModal = ScannerModal;
