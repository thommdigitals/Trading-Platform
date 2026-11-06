import { AI } from '@/config/constants';
import { PROVIDER_PRESETS, type ProviderType } from '@/config/aiProviders';
import type {
  AIProviderConfig,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ConnectionTestResult,
} from '@/types/ai';
import { BaseAIProvider } from './base';

export class OllamaProvider extends BaseAIProvider {
  override readonly type: ProviderType = 'ollama';

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    super(
      {
        ...config,
        baseURL: config.baseURL || PROVIDER_PRESETS.ollama.baseURL,
        defaultModel: config.defaultModel || PROVIDER_PRESETS.ollama.defaultModel,
      },
      fetchImpl,
    );
  }

  private normalizedBase(): string {
    return this.baseURL.replace(/\/v1$/, '');
  }

  override async chat(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResult> {
    const model = options?.model || this.defaultModel || 'llama3';
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(`${this.normalizedBase()}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
          temperature: options?.temperature ?? AI.defaultTemperature,
          max_tokens: options?.maxTokens ?? AI.defaultMaxTokens,
          stream: false,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      if (!response.ok) {
        throw new Error(data.error?.message || `Ollama error (${response.status})`);
      }

      return {
        content: data.choices?.[0]?.message?.content ?? '',
        model: data.model ?? model,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      };
    } finally {
      cleanup();
    }
  }

  override async *chatStream(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, void> {
    const model = options?.model || this.defaultModel || 'llama3';
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(`${this.normalizedBase()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama stream error (${response.status})`);
      }

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
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line) as { message?: { content?: string } };
              if (parsed.message?.content) yield parsed.message.content;
            } catch {
              /* ignore partial NDJSON line */
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      cleanup();
    }
  }

  override async listModels(signal?: AbortSignal): Promise<string[]> {
    const { signal: timedSignal, cleanup } = this.withTimeout(signal);
    try {
      const response = await this.fetchImpl(`${this.normalizedBase()}/api/tags`, {
        signal: timedSignal,
      });
      if (!response.ok) return [...PROVIDER_PRESETS.ollama.fallbackModels];
      const data = (await response.json()) as { models?: Array<{ name?: string }> };
      const models = (data.models ?? []).map((m) => m.name ?? '').filter(Boolean);
      return models.length > 0 ? models : [...PROVIDER_PRESETS.ollama.fallbackModels];
    } catch {
      return [...PROVIDER_PRESETS.ollama.fallbackModels];
    } finally {
      cleanup();
    }
  }

  override async testConnection(signal?: AbortSignal): Promise<ConnectionTestResult> {
    const started = Date.now();
    const { signal: timedSignal, cleanup } = this.withTimeout(signal, 8_000);
    try {
      const response = await this.fetchImpl(`${this.normalizedBase()}/api/tags`, {
        signal: timedSignal,
      });
      if (!response.ok) throw new Error('Ollama tidak merespons');
      return { success: true, latency: Math.max(1, Date.now() - started) };
    } catch (error) {
      return {
        success: false,
        latency: Math.max(1, Date.now() - started),
        error: error instanceof Error ? error.message : 'Ollama tidak merespons',
      };
    } finally {
      cleanup();
    }
  }
}

