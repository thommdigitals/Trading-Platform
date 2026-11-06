/**
 * Typed error hierarchy shared by the HTTP layer, services and UI.
 */

export class AppError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export interface ApiErrorInit {
  status: number;
  type?: string;
  title?: string;
  detail?: string;
  path?: string;
  additionalInfo?: Record<string, unknown>;
  /** Parsed `Retry-After` in milliseconds, when provided by the server. */
  retryAfterMs?: number;
}

/** Error response returned by the Match-Trader API (or its proxy). */
export class ApiError extends AppError {
  readonly status: number;
  readonly type: string;
  readonly title: string;
  readonly detail: string;
  readonly path: string;
  readonly additionalInfo: Record<string, unknown>;
  readonly retryAfterMs?: number;

  constructor(init: ApiErrorInit) {
    super(init.detail || init.title || `HTTP ${init.status}`);
    this.status = init.status;
    this.type = init.type ?? '';
    this.title = init.title ?? '';
    this.detail = init.detail ?? '';
    this.path = init.path ?? '';
    this.additionalInfo = init.additionalInfo ?? {};
    this.retryAfterMs = init.retryAfterMs;
  }

  /** Last path segment of the error type URI, e.g. `not-enough-margin`. */
  get code(): string {
    const segments = this.type.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? '';
  }
}

export class NetworkError extends AppError {}
export class TimeoutError extends AppError {}
export class RequestAbortedError extends AppError {}

/** Raised when the local rate limiter cannot grant a slot in a reasonable time. */
export class RateLimitExceededError extends AppError {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Rate limit reached, retry in ${Math.ceil(retryAfterMs / 1000)}s`);
    this.retryAfterMs = retryAfterMs;
  }
}

/** Raised when a response does not match the expected contract. */
export class ContractError extends AppError {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.issues = issues;
  }
}

export class ValidationError extends AppError {
  readonly issues: string[];
  constructor(message: string, issues: string[] = []) {
    super(message);
    this.issues = issues;
  }
}

export class InvalidTokenError extends AppError {}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
export const isAbortLike = (error: unknown): boolean =>
  error instanceof RequestAbortedError ||
  (error instanceof DOMException && error.name === 'AbortError');

