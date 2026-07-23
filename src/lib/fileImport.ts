import * as XLSX from 'xlsx';
import type { TemplateColumn } from '../types/forms';

export interface ParsedRow {
  data: Record<string, unknown>;
  warnings: string[];
}

export interface ParseResult {
  rows: ParsedRow[];
  unmatchedHeaders: string[];
  missingHeaders: string[];
}

/**
 * Parse a CSV or XLSX file into rows keyed by the category's column keys.
 * The file must have a header row whose labels match the column labels
 * (case-insensitive). Unknown columns are reported but ignored; missing
 * required columns are reported so the user can fix the file.
 */
export async function parseImportFile(
  file: File,
  columns: TemplateColumn[]
): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  // Map lowercase labels → column keys for header matching
  const labelToKey = new Map<string, TemplateColumn>();
  for (const col of columns) {
    labelToKey.set(col.label.toLowerCase().trim(), col);
  }

  // Determine which headers from the file match, and which are unmatched
  const fileHeaders = raw.length > 0 ? Object.keys(raw[0]) : [];
  const matchedKeys = new Set<string>();
  const unmatchedHeaders: string[] = [];

  for (const header of fileHeaders) {
    const col = labelToKey.get(header.toLowerCase().trim());
    if (col) {
      matchedKeys.add(col.key);
    } else {
      unmatchedHeaders.push(header);
    }
  }

  const missingHeaders = columns
    .filter((c) => !matchedKeys.has(c.key))
    .map((c) => c.label);

  const rows: ParsedRow[] = raw.map((rawRow, idx) => {
    const data: Record<string, unknown> = {};
    const warnings: string[] = [];

    for (const col of columns) {
      // Find the file header that maps to this column
      const fileVal = findValueForColumn(rawRow, col);
      if (fileVal === '' || fileVal === null || fileVal === undefined) {
        data[col.key] = col.type === 'checkbox' ? false : '';
      } else {
        const converted = convertValue(fileVal, col, idx, warnings);
        data[col.key] = converted;
      }
    }

    return { data, warnings };
  });

  return { rows, unmatchedHeaders, missingHeaders };
}

function findValueForColumn(
  rawRow: Record<string, unknown>,
  col: TemplateColumn
): unknown {
  // Match by label (case-insensitive)
  for (const [header, value] of Object.entries(rawRow)) {
    if (header.toLowerCase().trim() === col.label.toLowerCase().trim()) {
      return value;
    }
  }
  // Also try matching by key directly
  return rawRow[col.key];
}

function convertValue(
  value: unknown,
  col: TemplateColumn,
  rowIdx: number,
  warnings: string[]
): unknown {
  switch (col.type) {
    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) {
        warnings.push(`Row ${rowIdx + 1}: "${col.label}" is not a number — set to 0`);
        return 0;
      }
      return num;
    }
    case 'checkbox': {
      const s = String(value).toLowerCase().trim();
      return s === 'true' || s === 'yes' || s === '1' || s === 'y' || s === 'x';
    }
    case 'select': {
      const s = String(value).trim();
      if (col.options && !col.options.includes(s)) {
        warnings.push(`Row ${rowIdx + 1}: "${col.label}" value "${s}" is not in the allowed options`);
      }
      return s;
    }
    default:
      return String(value).trim();
  }
}

/** Generate a CSV template string for a category's columns. */
export function generateCsvTemplate(columns: TemplateColumn[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const sample = columns
    .map((c) => {
      if (c.type === 'checkbox') return 'no';
      if (c.type === 'number') return '1';
      if (c.type === 'select') return c.options?.[0] ?? '';
      return `sample ${c.label}`;
    })
    .map(escapeCsv)
    .join(',');
  return `${header}\n${sample}\n`;
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Trigger a browser download for a text blob. */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
