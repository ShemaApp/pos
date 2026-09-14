// utils.js — utilidades compartidas: CSV, formato de moneda, ids.

function toCSV(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        let v = row[c.key];
        if (v === undefined || v === null) v = '';
        v = String(v).replace(/"/g, '""');
        if (/[",\n]/.test(v)) v = `"${v}"`;
        return v;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

function downloadFile(filename, content, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  // Parser simple de CSV con soporte de comillas.
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => r.length > 1 || r[0] !== '').map((r) => {
    const obj = {};
    header.forEach((h, idx) => (obj[h.trim()] = (r[idx] || '').trim()));
    return obj;
  });
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

window.AppUtils = { toCSV, downloadFile, parseCSV, formatMoney };
