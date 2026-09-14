// VoiceInput.js — Botón de dictado por voz reutilizable (Web Speech API).
// modo="digitos": extrae solo los dígitos de lo reconocido (para códigos de
// barras). modo="texto": entrega el texto reconocido tal cual (para nombres,
// notas, etc.). Si el navegador no soporta reconocimiento de voz, el botón
// simplemente no se muestra — no rompe nada, es una ayuda opcional.
const { useState, useRef } = React;

const PALABRA_A_DIGITO = {
  cero: '0', uno: '1', una: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5',
  seis: '6', siete: '7', ocho: '8', nueve: '9',
};

// Algunos motores de voz ya devuelven los números como dígitos en el texto
// ("7501234"); otros los devuelven como palabras ("siete cinco cero uno...").
// Se intenta lo directo primero y, si no hay dígitos, se traduce palabra por
// palabra como respaldo.
function extraerDigitos(texto) {
  const directos = (texto.match(/\d/g) || []).join('');
  if (directos) return directos;
  return texto
    .toLowerCase()
    .split(/[^a-záéíóúñ]+/i)
    .map((palabra) => PALABRA_A_DIGITO[palabra] || '')
    .join('');
}

function BotonVoz({ onTexto, modo, disabled }) {
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState('');
  const reconocimientoRef = useRef(null);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!Recognition) return null;

  const detener = () => {
    if (reconocimientoRef.current) reconocimientoRef.current.stop();
    setEscuchando(false);
  };

  const iniciar = () => {
    setError('');
    const r = new Recognition();
    r.lang = 'es-MX';
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const texto = e.results[0][0].transcript || '';
      const final = modo === 'digitos' ? extraerDigitos(texto) : texto.trim();
      if (final) {
        onTexto(final);
      } else {
        setError('No se entendió, intenta de nuevo.');
      }
    };
    r.onerror = () => {
      setError('No se pudo escuchar (revisa el permiso de micrófono).');
      setEscuchando(false);
    };
    r.onend = () => setEscuchando(false);

    reconocimientoRef.current = r;
    r.start();
    setEscuchando(true);
  };

  return (
    <span className="voz-wrapper">
      <button
        type="button"
        className={escuchando ? 'btn-mic btn-mic-activo' : 'btn-mic'}
        disabled={disabled}
        onClick={escuchando ? detener : iniciar}
        title={modo === 'digitos' ? 'Dictar números por voz' : 'Dictar por voz'}
      >
        {escuchando ? '🎙️' : '🎤'}
      </button>
      {error && <span className="voz-error">{error}</span>}
    </span>
  );
}

window.BotonVoz = BotonVoz;
