import { ex } from '../data/catalog';
import type { BodyReport, Workout } from './types';
import { COMPOSITION_LABELS, CIRC_LABELS, POSTURE_LABELS } from './visbody';
import { download } from './util';

type Cell = string | number | null;
type Sheet = { name: string; rows: Cell[][] };

const iso = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function workoutRows(ws: Workout[]): Cell[][] {
  const rows: Cell[][] = [['Fecha', 'Día', 'Ejercicio', 'Serie', 'Peso (kg)', 'Reps', 'Sensación', 'Sustituye a', 'Nota']];
  for (const w of [...ws].sort((a, b) => a.startedAt - b.startedAt)) {
    if (w.status === 'active') continue;
    for (const e of w.entries) {
      e.sets.forEach((s, i) => {
        if (!s.done) return;
        rows.push([
          iso(w.startedAt),
          w.dayName,
          e.name,
          i + 1,
          s.weight,
          s.reps,
          s.feel === 'easy' ? 'Fácil' : s.feel === 'hard' ? 'Duro' : s.feel === 'ok' ? 'Justo' : '',
          e.substituteOf ? ex(e.substituteOf)?.name || '' : '',
          i === 0 ? e.note || '' : '',
        ]);
      });
    }
  }
  return rows;
}

export function bodyRows(rs: BodyReport[]): Cell[][] {
  const keys = Object.keys(COMPOSITION_LABELS);
  const pk = Object.keys(POSTURE_LABELS);
  const ck = Object.keys(CIRC_LABELS);
  const rows: Cell[][] = [[
    'Fecha',
    'Puntuación',
    'Postura',
    ...keys.map((k) => COMPOSITION_LABELS[k]),
    ...pk.map((k) => POSTURE_LABELS[k]),
    ...ck.map((k) => CIRC_LABELS[k] + ' (cm)'),
  ]];
  for (const r of [...rs].sort((a, b) => a.date - b.date)) {
    rows.push([
      r.dateStr || iso(r.date),
      r.score,
      r.postureScore,
      ...keys.map((k) => r.composition[k]?.value ?? null),
      ...pk.map((k) => r.posture[k]?.value ?? null),
      ...ck.map((k) => r.circumferences[k] ?? null),
    ]);
  }
  return rows;
}

function csv(rows: Cell[][], sep: string): string {
  const esc = (v: Cell) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? (sep === ';' ? String(v).replace('.', ',') : String(v)) : v;
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(sep)).join('\r\n');
}

export function exportCsv(name: string, sheets: Sheet[]) {
  for (const s of sheets) download(`${name}-${s.name.toLowerCase()}.csv`, '﻿' + csv(s.rows, ','), 'text/csv;charset=utf-8');
}

// ——— XLSX mínimo (ZIP sin compresión + SpreadsheetML), sin dependencias
const enc = new TextEncoder();
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; data: string }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.data);
    const crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x0800, true);
    h.setUint16(8, 0, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, data.length, true);
    h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function colName(i: number): string {
  let s = '';
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

export function exportXlsx(name: string, sheets: Sheet[]) {
  const files: { name: string; data: string }[] = [];
  files.push({
    name: '[Content_Types].xml',
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
      '</Types>',
  });
  files.push({
    name: '_rels/.rels',
    data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  });
  files.push({
    name: 'xl/workbook.xml',
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map((s, i) => `<sheet name="${xml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
      '</sheets></workbook>',
  });
  files.push({
    name: 'xl/_rels/workbook.xml.rels',
    data:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
      '</Relationships>',
  });
  sheets.forEach((s, si) => {
    const rows = s.rows
      .map(
        (r, ri) =>
          `<row r="${ri + 1}">` +
          r
            .map((v, ci) => {
              const ref = `${colName(ci)}${ri + 1}`;
              if (v === null || v === undefined || v === '') return '';
              if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
              return `<c r="${ref}" t="inlineStr"><is><t>${xml(v)}</t></is></c>`;
            })
            .join('') +
          '</row>',
      )
      .join('');
    files.push({
      name: `xl/worksheets/sheet${si + 1}.xml`,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`,
    });
  });
  download(`${name}.xlsx`, zip(files) as BlobPart, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}

export function exportJson(name: string, data: unknown) {
  download(`${name}.json`, JSON.stringify(data, null, 2), 'application/json');
}
