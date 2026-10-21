import { format, parseISO } from 'date-fns';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const s = String(value);
  try {
    // Date-only strings (from `date` columns) have no timezone — parseISO would
    // pin them to midnight UTC and format() would shift them in non-UTC zones.
    // Format the literal date instead.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return format(new Date(Number(y), Number(m) - 1, Number(d)), 'MMM d, yyyy');
    }
    return format(parseISO(s), 'MMM d, yyyy');
  } catch {
    return s;
  }
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const s = String(value);
  try {
    return format(parseISO(s), 'MMM d, yyyy HH:mm');
  } catch {
    return s;
  }
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return '—';
  const s = String(value);
  try {
    // Time-only strings (from `time` columns) have no timezone — return as-is.
    if (/^\d{2}:\d{2}/.test(s)) return s.slice(0, 5);
    return format(parseISO(s), 'HH:mm');
  } catch {
    return s;
  }
}

/** Local date (YYYY-MM-DD) for the user's timezone — never the UTC date. */
export function todayLocal(): string {
  return localDate(new Date());
}

/** Format a Date as a local YYYY-MM-DD string in the user's timezone. */
export function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date as a local HH:mm string in the user's timezone. */
export function localTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * Convert a `datetime-local` input value (naive local wall-clock, e.g.
 * "2026-10-01T08:00") into a full ISO string with the correct UTC offset,
 * so a timestamptz column stores the intended instant rather than reinterpreting
 * the local time as UTC. Returns null for empty input.
 */
export function localDateTimeToISO(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Convert a stored timestamptz/string back into a value suitable for a
 * `datetime-local` input (naive local "YYYY-MM-DDTHH:mm" in the user's zone).
 */
export function isoToLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = localDate(d);
  const time = localTime(d);
  return `${date}T${time}`;
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
