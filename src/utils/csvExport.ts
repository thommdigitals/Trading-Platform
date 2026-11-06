export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escapes a text cell.
 *  - Neutralises spreadsheet formula injection (CSV injection) by prefixing a single quote.
 *  - Quotes fields containing separators, quotes or line breaks (RFC 4180).
 */
export function escapeCsvText(text: string): string {
  const safe = FORMULA_TRIGGER.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function serialize(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  // numbers are emitted verbatim so negative P&L stays numeric in spreadsheets
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return escapeCsvText(value);
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [
    columns.map((column) => escapeCsvText(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => serialize(column.value(row))).join(',')),
  ];
  return lines.join('\r\n');
}

/** Triggers a client-side download (UTF-8 BOM so Excel detects the encoding). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

