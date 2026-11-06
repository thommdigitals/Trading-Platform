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

export class GeminiProvider extends BaseAIProvider {
  override readonly type: ProviderType = 'google';

  constructor(config: AIProviderConfig, fetchImpl?: typeof fetch) {
    super(config, fetchImpl);
  }

  private convertMessages(messages: readonly ChatMessage[]) {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [
          {
            text:
              m.role === 'tool' ? `[Tool Result ${m.toolName ?? ''}]: ${m.content}` : m.content,
          },
        ],
      }));
  }

  override async chat(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): Promise<ChatResult> {
    const model = options?.model || this.defaultModel || 'gemini-1.5-pro';
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(
        `${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
            contents: this.convertMessages(messages),
            ...(options?.tools && options.tools.length > 0
              ? {
                  tools: [
                    {
                      functionDeclarations: options.tools.map((t) => ({
                        name: t.name,
                        description: t.description,
                        parameters: t.parameters,
                      })),
                    },
                  ],
                }
              : {}),
            generationConfig: {
              temperature: options?.temperature ?? AI.defaultTemperature,
              maxOutputTokens: options?.maxTokens ?? AI.defaultMaxTokens,
            },
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string;
              functionCall?: { name?: string; args?: Record<string, unknown> };
            }>;
          };
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      if (!response.ok || data.error) {
        throw new Error(data.error?.message || `Gemini API error (${response.status})`);
      }

      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const content = parts
        .filter((p) => typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      const toolCalls: ToolCall[] = parts
        .filter((p) => p.functionCall?.name)
        .map((p, idx) => ({
          id: `gemini_call_${idx}`,
          name: p.functionCall!.name!,
          arguments: p.functionCall!.args ?? {},
        }));

      return {
        content,
        model,
        usage: data.usageMetadata
          ? {
              promptTokens: data.usageMetadata.promptTokenCount ?? 0,
              completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: data.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
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
    const model = options?.model || this.defaultModel || 'gemini-1.5-pro';
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const { signal, cleanup } = this.withTimeout(options?.signal);

    try {
      const response = await this.fetchImpl(
        `${this.baseURL}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(this.apiKey)}&alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            ...(systemInstruction
              ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
              : {}),
            contents: this.convertMessages(messages),
            generationConfig: {
              temperature: options?.temperature ?? AI.defaultTemperature,
              maxOutputTokens: options?.maxTokens ?? AI.defaultMaxTokens,
            },
          }),
        },
      );

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message || `Gemini stream error (${response.status})`);
      }

      for await (const payload of this.readSseData(response)) {
        try {
          const parsed = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield text;
        } catch {
          /* ignore malformed event */
        }
      }
    } finally {
      cleanup();
    }
  }

  override async listModels(signal?: AbortSignal): Promise<string[]> {
    const { signal: timedSignal, cleanup } = this.withTimeout(signal);
    try {
      const response = await this.fetchImpl(
        `${this.baseURL}/v1beta/models?key=${encodeURIComponent(this.apiKey)}`,
        { signal: timedSignal },
      );
      if (!response.ok) return [...PROVIDER_PRESETS.google.fallbackModels];
      const data = (await response.json()) as { models?: Array<{ name?: string }> };
      const models = (data.models ?? [])
        .map((m) => m.name ?? '')
        .filter((name) => name.includes('gemini'))
        .map((name) => name.split('/').pop() ?? name);
      return models.length > 0 ? models : [...PROVIDER_PRESETS.google.fallbackModels];
    } catch {
      return [...PROVIDER_PRESETS.google.fallbackModels];
    } finally {
      cleanup();
    }
  }
}
