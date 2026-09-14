// barcode.js — Generador de códigos EAN-13 internos, únicos dentro de la
// base de datos de productos.
//
// Usa el prefijo GS1 "20" (rango reservado 200-299 para "números de
// circulación restringida dentro de una empresa" — uso interno, nunca
// asignado a productos reales de fabricantes), así un código generado aquí
// nunca puede chocar con el código real de un producto de otra marca.

function calcularDigitoVerificador(doceDigitos) {
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    const peso = i % 2 === 0 ? 1 : 3;
    suma += doceDigitos[i] * peso;
  }
  return (10 - (suma % 10)) % 10;
}

function generarCandidato() {
  const prefijo = '20';
  let resto = '';
  for (let i = 0; i < 10; i++) resto += Math.floor(Math.random() * 10);
  const doce = (prefijo + resto).split('').map(Number);
  const check = calcularDigitoVerificador(doce);
  return doce.join('') + String(check);
}

// Valida formato Y dígito verificador de cualquier EAN-13 (no solo los que
// genera esta app) — útil para avisar si un código escrito/dictado a mano
// parece inválido, sin bloquear el guardado (puede ser un código real de
// otro estándar que la app igual acepta como texto libre).
function esEAN13Valido(codigo) {
  if (!/^\d{13}$/.test(codigo)) return false;
  const doce = codigo.slice(0, 12).split('').map(Number);
  const check = Number(codigo[12]);
  return calcularDigitoVerificador(doce) === check;
}

// Genera un candidato y reintenta si ya existe en productos.codigoBarras.
// Con 10 dígitos aleatorios (10,000 millones de combinaciones) una colisión
// es prácticamente imposible, pero se revisa igual antes de entregarlo.
async function generarUnico(intentosMax = 30) {
  for (let intento = 0; intento < intentosMax; intento++) {
    const candidato = generarCandidato();
    const existente = await window.AppDB.productos.getByIndex('codigoBarras', candidato);
    if (!existente) return candidato;
  }
  throw new Error('No se pudo generar un código único después de varios intentos. Intenta de nuevo.');
}

window.AppBarcode = { generarUnico, esEAN13Valido };
