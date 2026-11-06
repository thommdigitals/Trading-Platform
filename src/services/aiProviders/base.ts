import { HTTP } from '@/config/constants';
import { PROVIDER_PRESETS, type ProviderType } from '@/config/aiProviders';
import type {
  AIProvider,
  AIProviderConfig,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ConnectionTestResult,
} from '@/types/ai';

/**
 * Default browser fetch wrapper for AI providers.
 * Routes external HTTP(S) provider requests through the same-origin `/api/ai-proxy` route
 * when running in the browser so custom provider domains never hit browser CORS or CSP blocks.
 */
async function defaultAiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isBrowserRuntime =
    typeof window !== 'undefined' &&
    typeof process !== 'undefined' &&
    !process.env.VITEST;

  if (isBrowserRuntime && /^https?:\/\//i.test(rawUrl)) {
    const proxyHeaders = new Headers(init?.headers);
    proxyHeaders.set('x-ai-target-url', rawUrl);
    proxyHeaders.set('x-ai-target-method', (init?.method ?? 'GET').toUpperCase());

    return fetch('/api/ai-proxy', {
      method: (init?.method ?? 'GET').toUpperCase() === 'GET' ? 'GET' : 'POST',
      headers: proxyHeaders,
      body: init?.body,
      signal: init?.signal,
      cache: 'no-store',
    });
  }

  return fetch(input, init);
}

/**
 * Shared plumbing for every AI provider implementation:
 *  - URL normalisation (strips trailing slashes)
 *  - Per-request timeout merged with caller AbortSignal
 *  - Resilient Server-Sent Events (SSE) line reader that handles chunk boundaries cleanly
 *  - Standardised `testConnection()` with latency measurement
 */
export abstract class BaseAIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  abstract readonly type: ProviderType;
  readonly baseURL: string;
  readonly apiKey: string;
  readonly defaultModel: string;
  protected readonly fetchImpl: typeof fetch;

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    this.id = config.id;
    this.name = config.displayName;
    this.baseURL = (config.baseURL || PROVIDER_PRESETS[config.type].baseURL).replace(/\/+$/, '');
    this.apiKey = config.apiKey.trim();
    this.defaultModel = config.defaultModel || PROVIDER_PRESETS[config.type].defaultModel;
    this.fetchImpl = fetchImpl ?? defaultAiFetch;
  }

  abstract chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  abstract chatStream(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, void>;
  abstract listModels(signal?: AbortSignal): Promise<string[]>;

  async testConnection(signal?: AbortSignal): Promise<ConnectionTestResult> {
    const started = Date.now();
    try {
      let modelToTest = this.defaultModel;
      if (!modelToTest) {
        const discovered = await this.listModels(signal).catch(() => []);
        if (discovered.length > 0 && discovered[0]) {
          modelToTest = discovered[0];
        }
      }
      await this.chat(
        [{ id: 'ping', role: 'user', content: 'Ping. Reply with OK.', createdAt: started }],
        {
          ...(modelToTest ? { model: modelToTest } : {}),
          maxTokens: 8,
          temperature: 0,
          signal,
        },
      );
      return { success: true, latency: Math.max(1, Date.now() - started) };
    } catch (error) {
      return {
        success: false,
        latency: Math.max(1, Date.now() - started),
        error: error instanceof Error ? error.message : 'Koneksi ke AI provider gagal',
      };
    }
  }

  protected withTimeout(external?: AbortSignal, timeoutMs: number = HTTP.aiTimeoutMs): {
    signal: AbortSignal;
    cleanup: () => void;
  } {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    if (external?.aborted) controller.abort();
    else external?.addEventListener('abort', onAbort, { once: true });
    return {
      signal: controller.signal,
      cleanup: () => {
        clearTimeout(timer);
        external?.removeEventListener('abort', onAbort);
      },
    };
  }

  /** Streams `data:` lines from an SSE response, buffering partial lines across TCP chunks. */
  protected async *readSseData(response: Response): AsyncGenerator<string, void, void> {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') return;
          if (payload) yield payload;
        }
      }
      const tail = buffer.trim();
      if (tail.startsWith('data:')) {
        const payload = tail.slice(5).trim();
        if (payload && payload !== '[DONE]') yield payload;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

