import { AI } from '@/config/constants';
import { PROVIDER_PRESETS, type ProviderType } from '@/config/aiProviders';
import type {
  AIProviderConfig,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ToolCall,
} from '@/types/ai';
import { BaseAIProvider } from './base';

interface OpenAIToolCallWire {
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function formatOpenAIMessages(messages: readonly ChatMessage[]) {
  return messages.map((msg) => {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: msg.toolCallId ?? msg.id,
        content: msg.content,
      };
    }
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          },
        })),
      };
    }
    return {
      role: msg.role,
      content: msg.content,
    };
  });
}

export class OpenAIProvider extends BaseAIProvider {
  override readonly type: ProviderType = 'openai';

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    super(config, fetchImpl);
  }

  protected buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  override async chat(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResult> {
    const model = options?.model || this.defaultModel || 'gpt-4o';
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        signal,
        body: JSON.stringify({
          model,
          messages: formatOpenAIMessages(messages),
          temperature: options?.temperature ?? AI.defaultTemperature,
          max_tokens: options?.maxTokens ?? AI.defaultMaxTokens,
          ...(options?.tools && options.tools.length > 0
            ? {
                tools: options.tools.map((tool) => ({
                  type: 'function',
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  },
                })),
              }
            : {}),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        model?: string;
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: OpenAIToolCallWire[];
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      if (!response.ok) {
        throw new Error(data.error?.message || `${this.name} error (${response.status})`);
      }

      const choice = data.choices?.[0]?.message;
      const toolCalls: ToolCall[] | undefined = choice?.tool_calls?.map((tc, index) => ({
        id: tc.id ?? `call_${index}`,
        name: tc.function?.name ?? 'unknown',
        arguments: safeParseArgs(tc.function?.arguments),
      }));

      return {
        content: choice?.content ?? '',
        model: data.model ?? model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : undefined,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      };
    } finally {
      cleanup();
    }
  }

  override async *chatStream(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, void> {
    const model = options?.model || this.defaultModel || 'gpt-4o';
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(),
        signal,
        body: JSON.stringify({
          model,
          messages: formatOpenAIMessages(messages),
          stream: true,
          temperature: options?.temperature ?? AI.defaultTemperature,
          max_tokens: options?.maxTokens ?? AI.defaultMaxTokens,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || `${this.name} stream error (${response.status})`);
      }

      for await (const payload of this.readSseData(response)) {
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string | null } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* ignore malformed SSE chunk */
        }
      }
    } finally {
      cleanup();
    }
  }

  override async listModels(signal?: AbortSignal): Promise<string[]> {
    const { signal: timedSignal, cleanup } = this.withTimeout(signal);
    const fallbacks = [...PROVIDER_PRESETS[this.type].fallbackModels];
    try {
      const response = await this.fetchImpl(`${this.baseURL}/models`, {
        headers: this.buildHeaders(),
        signal: timedSignal,
      });
      if (!response.ok) {
        if (fallbacks.length > 0) return fallbacks;
        const errBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
          message?: string;
        };
        throw new Error(
          errBody.error?.message ||
            errBody.message ||
            `Gagal memuat daftar model dari ${this.baseURL} (HTTP ${response.status})`,
        );
      }

      const raw = (await response.json()) as {
        data?: Array<{ id?: string; name?: string } | string>;
        models?: Array<{ id?: string; name?: string } | string>;
      };
      const items = Array.isArray(raw.data)
        ? raw.data
        : Array.isArray(raw.models)
          ? raw.models
          : Array.isArray(raw)
            ? (raw as Array<{ id?: string; name?: string } | string>)
            : [];

      const models = items
        .map((entry) =>
          typeof entry === 'string' ? entry.trim() : (entry.id ?? entry.name ?? '').trim(),
        )
        .filter((id) => Boolean(id) && (this.type !== 'openai' || id.startsWith('gpt-')))
        .sort();

      return models.length > 0 ? [...new Set(models)] : fallbacks;
    } catch (err) {
      if (fallbacks.length > 0) return fallbacks;
      throw err instanceof Error ? err : new Error('Gagal memuat daftar model dari provider');
    } finally {
      cleanup();
    }
  }
}

