import { describe, expect, it } from 'vitest';
import { escapeCsvText, toCsv } from './csvExport';
import { formatMoney, formatNumber, formatPercent, formatPrice, formatSigned, maskSecret, pnlColorClass } from './formatters';
import { formatDuration, parseDateInput, startOfDay, toDateInputValue, endOfDay } from './dateTime';
import { getErrorAction, getErrorMessage } from './errorHandler';
import { ApiError, NetworkError, RateLimitExceededError, ValidationError } from '@/services/http/errors';

describe('csv export', () => {
  it('neutralises formula injection in text cells', () => {
    for (const payload of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tcmd']) {
      expect(escapeCsvText(payload).startsWith("'")).toBe(true);
    }
  });

  it('quotes separators, quotes and newlines', () => {
    expect(escapeCsvText('a,b')).toBe('"a,b"');
    expect(escapeCsvText('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvText('l1\nl2')).toBe('"l1\nl2"');
  });

  it('keeps numbers numeric (negatives are not prefixed) and renders nulls empty', () => {
    const csv = toCsv(
      [{ name: '=HYPERLINK("x")', pnl: -5.5, note: null }],
      [
        { header: 'Name', value: (r) => r.name },
        { header: 'P&L', value: (r) => r.pnl },
        { header: 'Note', value: (r) => r.note },
      ],
    );
    expect(csv).toBe('Name,P&L,Note\r\n"\'=HYPERLINK(""x"")",-5.5,');
  });
});

describe('formatters', () => {
  it('handles invalid numbers gracefully', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatMoney(undefined, 'USD')).toBe('—');
    expect(formatSigned(undefined)).toBe('—');
    expect(formatPrice(null, 5)).toBe('—');
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('formats values', () => {
    expect(formatNumber(1234.5, 2, 'en-US')).toBe('1,234.50');
    expect(formatMoney(10, 'USD', 2, 'en-US')).toBe('10.00 USD');
    expect(formatSigned(1.5, 2, 'en-US')).toBe('+1.50');
    expect(formatSigned(-2, 2, 'en-US')).toBe('-2.00');
    expect(formatSigned(0, 2, 'en-US')).toBe('0.00');
    expect(formatPrice(1.1, 5)).toBe('1.10000');
    expect(formatPercent(12.345)).toBe('12.35%');
  });

  it('colours pnl and masks secrets', () => {
    expect(pnlColorClass(1)).toBe('text-profit');
    expect(pnlColorClass(-1)).toBe('text-loss');
    expect(pnlColorClass(0)).toBe('text-muted-foreground');
    expect(maskSecret('sk-abcdef123456')).toBe('•••••••••••3456');
    expect(maskSecret('abc')).toBe('•••');
    expect(maskSecret('')).toBe('');
    expect(maskSecret('sk-abcdef123456')).not.toContain('abcdef');
  });
});

describe('dateTime', () => {
  it('parses and formats date inputs', () => {
    const ts = parseDateInput('2026-03-15');
    expect(toDateInputValue(ts)).toBe('2026-03-15');
    expect(Number.isNaN(parseDateInput('2026-02-31'))).toBe(true);
    expect(Number.isNaN(parseDateInput('garbage'))).toBe(true);
  });

  it('start/end of day are within the same day', () => {
    const ts = parseDateInput('2026-03-15') + 5 * 3_600_000;
    expect(startOfDay(ts)).toBe(parseDateInput('2026-03-15'));
    expect(endOfDay(ts) - startOfDay(ts)).toBe(86_399_999);
  });

  it('formatDuration', () => {
    expect(formatDuration(0)).toBe('0d');
    expect(formatDuration(45_000)).toBe('45d');
    expect(formatDuration(125_000)).toBe('2m 05d');
    expect(formatDuration(3 * 3_600_000 + 5 * 60_000)).toBe('3j 05m');
    expect(formatDuration(2 * 86_400_000 + 3_600_000)).toBe('2h 01j');
  });
});

describe('errorHandler', () => {
  const api = (status: number, code: string, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
    new ApiError({ status, type: `error://trader-api/${code}`, ...extra });

  it('maps the documented error matrix', () => {
    expect(getErrorMessage(api(409, 'not-enough-margin', { additionalInfo: { requiredMargin: 500 } }))).toContain('500');
    expect(getErrorMessage(api(409, 'session-closed'))).toContain('tutup');
    expect(getErrorMessage(api(401, 'unauthorized'))).toContain('login ulang');
    expect(getErrorMessage(api(400, 'trading-validation-failed', { detail: 'volume' }))).toBe('Order ditolak: volume');
    expect(getErrorMessage(api(429, 'too-many-requests', { retryAfterMs: 3500 }))).toContain('4 detik');
    expect(getErrorMessage(api(409, 'not-allowed-to-trade', { additionalInfo: { accessRight: 'CLOSE_ONLY' } }))).toContain('CLOSE_ONLY');
  });

  it('falls back by status for unknown codes and never leaks raw internals', () => {
    expect(getErrorMessage(api(500, 'weird'))).toContain('server internal');
    expect(getErrorMessage(new ApiError({ status: 418, title: 'Teapot' }))).toContain('418');
    expect(getErrorMessage({ secret: 'x' })).toBe('Terjadi kesalahan tak terduga.');
  });

  it('maps non-API errors', () => {
    expect(getErrorMessage(new NetworkError('x'))).toContain('Koneksi');
    expect(getErrorMessage(new RateLimitExceededError(2500))).toContain('3 detik');
    expect(getErrorMessage(new ValidationError('x', ['volume: salah']))).toBe('volume: salah');
  });

  it('suggests an action', () => {
    expect(getErrorAction(api(401, 'unauthorized'))).toBe('relogin');
    expect(getErrorAction(api(503, 'upstream-unavailable'))).toBe('retry');
    expect(getErrorAction(new NetworkError('x'))).toBe('retry');
    expect(getErrorAction(api(409, 'not-enough-margin'))).toBe('none');
  });
});

