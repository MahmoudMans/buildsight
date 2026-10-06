export type CsvDelimiter = "," | ";";

export type CsvValue = string | number | boolean | null | undefined;

export type CsvRow = Record<string, CsvValue>;

export interface ZipEntry {
  name: string;
  text: string;
}

const FORMULA_START = /^[=+\-@\t\r]/;
const NUMBER_LIKE = /^[+-]?(\d+([.,]\d+)?|[.,]\d+)$/;
const TECHNICAL_KEY = /^(id|version|createdAt|updatedAt)$|Ids?$/;

export function isTechnicalColumn(key: string): boolean {
  return TECHNICAL_KEY.test(key);
}

function formatCell(value: CsvValue, delimiter: CsvDelimiter): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text: string;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return "";
    }

    text = String(value);

    if (delimiter === ";") {
      text = text.replace(".", ",");
    }
  } else {
    text = String(value);

    if (typeof value === "string" && FORMULA_START.test(text) && !NUMBER_LIKE.test(text)) {
      text = `'${text}`;
    }
  }

  if (/["\r\n]/.test(text) || text.includes(delimiter)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function flattenRecord(record: object): CsvRow {
  const row: CsvRow = {};

  for (const [key, raw] of Object.entries(record)) {
    if (raw === null || raw === undefined) {
      row[key] = null;
    } else if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      row[key] = raw;
    } else if (Array.isArray(raw)) {
      row[key] = raw
        .map((item) => (typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)))
        .join(" | ");
    } else {
      row[key] = JSON.stringify(raw);
    }
  }

  return row;
}

export function columnsOf(rows: ReadonlyArray<CsvRow>, includeTechnical: boolean): string[] {
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (includeTechnical || !isTechnicalColumn(key)) {
        seen.add(key);
      }
    }
  }

  return [...seen];
}

export function toCsv(
  rows: ReadonlyArray<CsvRow>,
  columns: ReadonlyArray<string>,
  delimiter: CsvDelimiter,
): string {
  const lines = [columns.map((column) => formatCell(column, delimiter)).join(delimiter)];

  for (const row of rows) {
    lines.push(columns.map((column) => formatCell(row[column], delimiter)).join(delimiter));
  }

  return `${lines.join("\r\n")}\r\n`;
}

export function recordsToCsv(
  records: ReadonlyArray<object>,
  delimiter: CsvDelimiter,
  includeTechnical: boolean,
): string {
  const rows = records.map(flattenRecord);

  return toCsv(rows, columnsOf(rows, includeTechnical), delimiter);
}

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table.push(c >>> 0);
  }

  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(1980, date.getFullYear());

  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function buildZip(entries: ReadonlyArray<ZipEntry>, now = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(now);
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.text);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));

    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, stamp.time, true);
    local.setUint16(12, stamp.day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);

    chunks.push(new Uint8Array(local.buffer), name, data);

    const header = new DataView(new ArrayBuffer(46));

    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, stamp.time, true);
    header.setUint16(14, stamp.day, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, data.length, true);
    header.setUint32(24, data.length, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true);

    central.push(new Uint8Array(header.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));

  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;

  for (const part of all) {
    out.set(part, cursor);
    cursor += part.length;
  }

  return out;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, csv: string): void {
  saveBlob(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), filename);
}

export function downloadZip(filename: string, entries: ReadonlyArray<ZipEntry>): void {
  const bytes = buildZip(entries.map((entry) => ({ name: entry.name, text: `﻿${entry.text}` })));

  saveBlob(new Blob([bytes as BlobPart], { type: "application/zip" }), filename);
}

const DELIMITER_KEY = "buildsight.csvDelimiter";

export function preferredDelimiter(): CsvDelimiter {
  try {
    const stored = window.localStorage.getItem(DELIMITER_KEY);

    if (stored === "," || stored === ";") {
      return stored;
    }
  } catch {
    // storage can be blocked; fall back to the locale
  }

  return (1.1).toLocaleString().includes(",") ? ";" : ",";
}

export function rememberDelimiter(delimiter: CsvDelimiter): void {
  try {
    window.localStorage.setItem(DELIMITER_KEY, delimiter);
  } catch {
    // storage can be blocked; the choice then lasts for this page only
  }
}

export function safeFileName(text: string): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "export";
}

export function todayStamp(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
}
