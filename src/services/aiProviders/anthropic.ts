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

export class AnthropicProvider extends BaseAIProvider {
  override readonly type: ProviderType = 'anthropic';

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    super(config, fetchImpl);
  }

  private buildHeaders(): Record<string, string> {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'messages-2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    };
  }

  private splitMessages(messages: readonly ChatMessage[]) {
    const systemParts = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .filter(Boolean);
    const nonSystem = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.role === 'tool' ? `[Tool Result ${m.toolName ?? ''}]: ${m.content}` : m.content,
      }));
    return {
      system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
      messages: nonSystem,
    };
  }

  override async chat(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResult> {
    const model = options?.model || this.defaultModel || 'claude-sonnet-4-6';
    const { system, messages: chatMessages } = this.splitMessages(messages);
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: this.buildHeaders(),
        signal,
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? AI.defaultMaxTokens,
          temperature: options?.temperature ?? AI.defaultTemperature,
          ...(system ? { system } : {}),
          messages: chatMessages,
          ...(options?.tools && options.tools.length > 0
            ? {
                tools: options.tools.map((tool) => ({
                  name: tool.name,
                  description: tool.description,
                  input_schema: tool.parameters,
                })),
              }
            : {}),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        type?: string;
        error?: { message?: string };
        model?: string;
        content?: Array<{
          type: string;
          text?: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
        }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      if (!response.ok || data.type === 'error') {
        throw new Error(data.error?.message || `Anthropic API error (${response.status})`);
      }

      const blocks = data.content ?? [];
      const textContent = blocks
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text)
        .join('');
      const toolCalls: ToolCall[] = blocks
        .filter((b) => b.type === 'tool_use' && b.name)
        .map((b, idx) => ({
          id: b.id ?? `anthropic_call_${idx}`,
          name: b.name!,
          arguments: b.input ?? {},
        }));

      const promptTokens = data.usage?.input_tokens ?? 0;
      const completionTokens = data.usage?.output_tokens ?? 0;

      return {
        content: textContent,
        model: data.model ?? model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };
    } finally {
      cleanup();
    }
  }

  override async *chatStream(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, void> {
    const model = options?.model || this.defaultModel || 'claude-sonnet-4-6';
    const { system, messages: chatMessages } = this.splitMessages(messages);
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: this.buildHeaders(),
        signal,
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? AI.defaultMaxTokens,
          temperature: options?.temperature ?? AI.defaultTemperature,
          stream: true,
          ...(system ? { system } : {}),
          messages: chatMessages,
        }),
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || `Anthropic stream error (${response.status})`);
      }

      for await (const payload of this.readSseData(response)) {
        try {
          const parsed = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (
            parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta' &&
            parsed.delta.text
          ) {
            yield parsed.delta.text;
          }
        } catch {
          /* ignore malformed event */
        }
      }
    } finally {
      cleanup();
    }
  }

  override async listModels(): Promise<string[]> {
    return [...PROVIDER_PRESETS.anthropic.fallbackModels];
  }
}
