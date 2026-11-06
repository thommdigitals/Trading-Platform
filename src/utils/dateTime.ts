/** Timestamp helpers. The API speaks Unix epoch milliseconds (UTC). */

const MS_PER_DAY = 86_400_000;

export function formatDateTime(timestamp: number, locale?: string, timeZone?: string): string {
  if (!Number.isFinite(timestamp)) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone,
  }).format(new Date(timestamp));
}

export function formatDate(timestamp: number, locale?: string, timeZone?: string): string {
  if (!Number.isFinite(timestamp)) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(new Date(timestamp));
}

export function formatTime(timestamp: number, locale?: string, timeZone?: string): string {
  if (!Number.isFinite(timestamp)) return '—';
  return new Intl.DateTimeFormat(locale, { timeStyle: 'medium', timeZone }).format(new Date(timestamp));
}

export const daysAgo = (days: number, now: number = Date.now()): number => now - days * MS_PER_DAY;

/** Start of the local day (00:00) containing `timestamp`. */
export function startOfDay(timestamp: number = Date.now()): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Parses an `<input type="date">` value (YYYY-MM-DD) as local midnight. Returns NaN when invalid. */
export function parseDateInput(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getMonth() === Number(month) - 1 ? date.getTime() : Number.NaN;
}

export function toDateInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** End of the local day (23:59:59.999). */
export const endOfDay = (timestamp: number): number => startOfDay(timestamp) + MS_PER_DAY - 1;

/** Human readable countdown such as "2j 05m" or "45d". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0d';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}h ${String(hours).padStart(2, '0')}j`;
  if (hours > 0) return `${hours}j ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}d`;
  return `${seconds}d`;
}

