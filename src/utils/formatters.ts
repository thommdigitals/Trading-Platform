/** Locale aware number / money formatters. Defensive against NaN / null. */

const DASH = '—';

export function formatNumber(value: number | null | undefined, decimals = 2, locale?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatMoney(
  value: number | null | undefined,
  currency: string | undefined,
  precision = 2,
  locale?: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const amount = formatNumber(value, precision, locale);
  return currency ? `${amount} ${currency}` : amount;
}

/** Signed number (+1.50 / -2.00) used for P&L columns. */
export function formatSigned(value: number | null | undefined, decimals = 2, locale?: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  const formatted = formatNumber(Math.abs(value), decimals, locale);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export const formatPrice = (price: number | null | undefined, precision: number): string =>
  price === null || price === undefined || !Number.isFinite(price)
    ? DASH
    : price.toFixed(precision);

export const formatPercent = (value: number | null | undefined, decimals = 2): string =>
  value === null || value === undefined || !Number.isFinite(value) ? DASH : `${value.toFixed(decimals)}%`;

/** Tailwind text colour class for a signed value. */
export const pnlColorClass = (value: number): string =>
  value > 0 ? 'text-profit' : value < 0 ? 'text-loss' : 'text-muted-foreground';

/** Masks a secret leaving only the last 4 characters visible. */
export function maskSecret(secret: string, visible = 4): string {
  if (!secret) return '';
  if (secret.length <= visible) return '•'.repeat(secret.length);
  return `${'•'.repeat(Math.min(12, secret.length - visible))}${secret.slice(-visible)}`;
}

