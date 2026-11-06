import {
  ApiError,
  ContractError,
  InvalidTokenError,
  NetworkError,
  RateLimitExceededError,
  RequestAbortedError,
  TimeoutError,
  ValidationError,
} from '@/services/http/errors';

type Resolver = (error: ApiError) => string;

const withDetail = (prefix: string): Resolver => (error) =>
  error.detail ? `${prefix}: ${error.detail}` : prefix;

/** Error matrix (SRS section 9) keyed by the last segment of the API error type URI. */
const MESSAGE_BY_CODE: Record<string, Resolver> = {
  'bad-request': withDetail('Data tidak valid'),
  'trading-validation-failed': withDetail('Order ditolak'),
  'candle-interval-invalid': () => 'Interval chart tidak valid',
  unauthorized: () => 'Token expired atau tidak valid. Silakan login ulang.',
  forbidden: () => 'Akses ditolak. Cek permission token Anda.',
  'symbol-not-found': (error) => {
    const symbol = error.additionalInfo.symbol;
    return typeof symbol === 'string' ? `Symbol tidak ditemukan: ${symbol}` : 'Symbol tidak ditemukan';
  },
  'path-not-found': () => 'Endpoint tidak ditemukan',
  'method-not-allowed': () => 'Metode HTTP tidak diizinkan',
  'not-enough-margin': (error) => {
    const required = error.additionalInfo.requiredMargin;
    return typeof required === 'number'
      ? `Margin tidak cukup untuk membuka posisi ini (dibutuhkan: ${required})`
      : 'Margin tidak cukup untuk membuka posisi ini';
  },
  'session-closed': () => 'Sesi trading untuk instrumen ini sedang tutup',
  'not-allowed-to-trade': (error) => {
    const right = error.additionalInfo.accessRight;
    return typeof right === 'string'
      ? `Trading tidak diizinkan. Akun Anda dalam mode ${right}`
      : 'Trading tidak diizinkan pada akun ini';
  },
  'trading-operation-failed': withDetail('Operasi trading gagal'),
  'idempotency-request-in-progress': () => 'Request sedang diproses, harap tunggu...',
  'idempotency-key-reused': () => 'Duplicate request terdeteksi',
  'too-many-requests': (error) =>
    error.retryAfterMs
      ? `Rate limit tercapai. Coba lagi dalam ${Math.ceil(error.retryAfterMs / 1000)} detik`
      : 'Rate limit tercapai. Menunggu sebentar...',
  internal: () => 'Error server internal Fortuno. Coba lagi.',
  'upstream-unavailable': () => 'Layanan tidak tersedia sementara. Coba lagi dalam beberapa detik.',
};

const MESSAGE_BY_STATUS: Record<number, string> = {
  400: 'Permintaan tidak valid',
  401: 'Token expired atau tidak valid. Silakan login ulang.',
  403: 'Akses ditolak. Cek permission token Anda.',
  404: 'Data tidak ditemukan',
  405: 'Metode HTTP tidak diizinkan',
  409: 'Operasi tidak dapat diproses saat ini',
  422: 'Duplicate request terdeteksi',
  429: 'Rate limit tercapai. Menunggu sebentar...',
  500: 'Error server internal Fortuno. Coba lagi.',
  502: 'Layanan tidak tersedia sementara. Coba lagi dalam beberapa detik.',
  503: 'Layanan tidak tersedia sementara. Coba lagi dalam beberapa detik.',
  504: 'Server tidak merespons tepat waktu. Coba lagi.',
};

export type ErrorAction = 'relogin' | 'retry' | 'none';

/** Converts any thrown value into a safe, user friendly message (never leaks internals). */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const byCode = MESSAGE_BY_CODE[error.code];
    if (byCode) return byCode(error);
    return MESSAGE_BY_STATUS[error.status] ?? `Error ${error.status}: ${error.title || 'Permintaan gagal'}`;
  }
  if (error instanceof ValidationError) {
    return error.issues.length > 0 ? error.issues.join('; ') : error.message;
  }
  if (error instanceof RateLimitExceededError) {
    return `Terlalu banyak request. Coba lagi dalam ${Math.ceil(error.retryAfterMs / 1000)} detik.`;
  }
  if (error instanceof TimeoutError) return 'Server tidak merespons tepat waktu. Coba lagi.';
  if (error instanceof NetworkError) return 'Koneksi gagal. Periksa koneksi internet Anda.';
  if (error instanceof ContractError) return 'Format respons server tidak dikenali.';
  if (error instanceof InvalidTokenError) return error.message;
  if (error instanceof RequestAbortedError) return 'Permintaan dibatalkan.';
  if (error instanceof Error && error.message) return error.message;
  return 'Terjadi kesalahan tak terduga.';
}

export function getErrorAction(error: unknown): ErrorAction {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'relogin';
    if ([429, 500, 502, 503, 504].includes(error.status)) return 'retry';
    if (error.code === 'trading-operation-failed') return 'retry';
  }
  if (error instanceof NetworkError || error instanceof TimeoutError) return 'retry';
  return 'none';
}

