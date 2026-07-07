import { format, parseISO } from 'date-fns';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy');
  } catch {
    return value;
  }
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'MMM d, yyyy HH:mm');
  } catch {
    return value;
  }
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return format(parseISO(value), 'HH:mm');
  } catch {
    return value;
  }
}

export function fmtMoney(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function titleCase(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sum a numeric field across rows, tolerating strings/nulls. */
export function sumBy<T>(rows: T[], pick: (row: T) => number | string | null | undefined): number {
  return rows.reduce((acc, row) => acc + (Number(pick(row)) || 0), 0);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => escape(c.label)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(row[c.key])).join(',')).join('\n');
  return `${head}\n${body}`;
}

export function downloadCsv(rows: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>, filename: string) {
  downloadBlob(new Blob([toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' }), filename);
}
