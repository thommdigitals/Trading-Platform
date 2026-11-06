import type { ZodType } from 'zod';
import { HTTP } from '@/config/constants';
import { isWellFormedToken } from '@/utils/jwtUtils';
import {
  ApiError,
  ContractError,
  InvalidTokenError,
  NetworkError,
  RequestAbortedError,
  TimeoutError,
} from './errors';
import { ApiErrorBodySchema } from '@/types/api';
import type { SlidingWindowRateLimiter } from './rateLimiter';
import { decideRetry, withRetry } from './retry';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

export interface RateLimitInfo {
  endpoint: number | null;
  global: number | null;
}

export interface HttpClientOptions {
  baseUrl: string;
  /** Called per request so the token never has to be captured in a closure. */
  getAuthToken?: () => string | null;
  timeoutMs?: number;
  rateLimiter?: SlidingWindowRateLimiter;
  fetchImpl?: typeof fetch;
  onUnauthorized?: () => void;
  onRateLimitInfo?: (info: RateLimitInfo) => void;
  onRetry?: (info: { retryNumber: number; delayMs: number; error: unknown }) => void;
}

export interface RequestOptions<T> {
  method?: HttpMethod;
  path: string;
  query?: QueryParams;
  body?: unknown;
  /** Zod schema used to validate (and transform) the JSON response. */
  schema?: ZodType<T>;
  /** Idempotency key; the SAME key is reused across automatic retries. */
  idempotencyKey?: string;
  /** Local rate-limit bucket this request counts against. */
  rateLimitBucket?: string;
  signal?: AbortSignal;
}

export function buildQueryString(query?: QueryParams): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      params.append(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

/** Parses the `Retry-After` header (delta-seconds or HTTP-date) into milliseconds. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

const toIntOrNull = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * fetch based HTTP client: timeouts, abort support, rate-limit awareness, schema validation,
 * normalised errors and safe automatic retries.
 */
export class HttpClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpClientOptions) {
    this.timeoutMs = options.timeoutMs ?? HTTP.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  async request<T = void>(request: RequestOptions<T>): Promise<T> {
    const method = request.method ?? 'GET';
    const context = { method, hasIdempotencyKey: Boolean(request.idempotencyKey) };

    return withRetry(
      async () => {
        if (request.rateLimitBucket) {
          await this.options.rateLimiter?.acquire(request.rateLimitBucket, request.signal);
        }
        return this.attempt<T>(request, method);
      },
      {
        signal: request.signal,
        decide: (error, retryNumber) => decideRetry(error, retryNumber, context),
        onRetry: ({ error, retryNumber, delayMs }) =>
          this.options.onRetry?.({ error, retryNumber, delayMs }),
      },
    );
  }

  private async attempt<T>(request: RequestOptions<T>, method: HttpMethod): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });

    const token = this.options.getAuthToken?.();
    if (token) {
      if (!isWellFormedToken(token)) throw new InvalidTokenError('Format token tidak valid');
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (request.body !== undefined) headers.set('Content-Type', 'application/json');
    if (request.idempotencyKey) headers.set('Idempotency-Key', request.idempotencyKey);

    const { signal, cleanup, didTimeout } = this.createSignal(request.signal);
    const url = `${this.options.baseUrl}${request.path}${buildQueryString(request.query)}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch (error) {
      cleanup();
      if (didTimeout()) throw new TimeoutError(`Request timeout setelah ${this.timeoutMs}ms`);
      if (request.signal?.aborted) throw new RequestAbortedError('Request dibatalkan');
      throw new NetworkError('Gagal terhubung ke server', { cause: error });
    }

    try {
      this.trackRateLimit(response);
      const payload = await this.readBody(response);

      if (!response.ok) throw this.toApiError(response, payload);
      if (!request.schema) return undefined as T;

      const parsed = request.schema.safeParse(payload);
      if (!parsed.success) {
        throw new ContractError(
          'Respons server tidak sesuai format yang diharapkan',
          parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
        );
      }
      return parsed.data;
    } catch (error) {
      if (didTimeout()) throw new TimeoutError(`Request timeout setelah ${this.timeoutMs}ms`);
      if (error instanceof ApiError && error.status === 401) this.options.onUnauthorized?.();
      throw error;
    } finally {
      cleanup();
    }
  }

  private createSignal(external?: AbortSignal) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const onExternalAbort = () => controller.abort();

    if (external?.aborted) controller.abort();
    else external?.addEventListener('abort', onExternalAbort, { once: true });

    return {
      signal: controller.signal,
      didTimeout: () => timedOut,
      cleanup: () => {
        clearTimeout(timer);
        external?.removeEventListener('abort', onExternalAbort);
      },
    };
  }

  private trackRateLimit(response: Response): void {
    if (!this.options.onRateLimitInfo) return;
    const endpoint = toIntOrNull(response.headers.get('x-ratelimit-remaining-endpoint'));
    const global = toIntOrNull(response.headers.get('x-ratelimit-remaining-global'));
    if (endpoint !== null || global !== null) this.options.onRateLimitInfo({ endpoint, global });
  }

  private async readBody(response: Response): Promise<unknown> {
    if (response.status === 204) return undefined;
    const text = await response.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  }

  private toApiError(response: Response, payload: unknown): ApiError {
    const body = ApiErrorBodySchema.safeParse(payload);
    const data = body.success ? body.data : {};
    return new ApiError({
      status: response.status,
      type: data.type,
      title: data.title,
      detail: data.detail,
      path: data.path,
      additionalInfo: data.additionalInfo,
      retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
    });
  }
}

