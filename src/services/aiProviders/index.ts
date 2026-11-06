import { AI } from '@/config/constants';
import type {
  AIProvider,
  AIProviderConfig,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ConnectionTestResult,
  ToolCall,
} from '@/types/ai';
import { Mutex, sleep } from '@/utils/async';
import { AnthropicProvider } from './anthropic';
import { CustomProvider } from './custom';
import { GeminiProvider } from './gemini';
import { GroqProvider } from './groq';
import { MistralProvider } from './mistral';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';

export {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  MistralProvider,
  GroqProvider,
  OllamaProvider,
  CustomProvider,
};

export function createProvider(config: AIProviderConfig, fetchImpl?: typeof fetch): AIProvider {
  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(config, fetchImpl);
    case 'anthropic':
      return new AnthropicProvider(config, fetchImpl);
    case 'google':
      return new GeminiProvider(config, fetchImpl);
    case 'mistral':
      return new MistralProvider(config, fetchImpl);
    case 'groq':
      return new GroqProvider(config, fetchImpl);
    case 'ollama':
      return new OllamaProvider(config, fetchImpl);
    case 'custom':
      return new CustomProvider(config, fetchImpl);
  }
}

/**
 * Built-in local heuristic AI responder used ONLY when the user runs in Demo Sandbox mode without
 * an external API key configured. Produces structured JSON for analysis/automation prompts and
 * natural Indonesian trading responses (including tool calls) for chat prompts.
 */
export class DemoSandboxAIProvider implements AIProvider {
  readonly id = 'demo-ai';
  readonly name = 'FortunoAI Demo Engine';
  readonly type = 'custom' as const;
  readonly defaultModel = 'fortuno-demo-v1';

  async chat(messages: readonly ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const lower = lastUser.toLowerCase();

    // 1. Structured Market Analysis JSON prompt detection
    if (lower.includes('"trend"') && lower.includes('"supportlevels"')) {
      const symbolMatch = /symbol:\s*([A-Z0-9._-]+)/i.exec(lastUser);
      const closeMatch = /Last Close:\s*([0-9.]+)/i.exec(lastUser);
      const rsiMatch = /RSI\(14\):\s*([0-9.]+)/i.exec(lastUser);
      const price = closeMatch ? Number(closeMatch[1]) : 1.0864;
      const rsi = rsiMatch ? Number(rsiMatch[1]) : 54;
      const step = price > 100 ? price * 0.004 : 0.0035;
      const bullish = rsi <= 65;

      const json = JSON.stringify({
        trend: bullish ? 'UPTREND' : 'DOWNTREND',
        signal: bullish ? 'BUY' : 'SELL',
        strength: 4,
        confidence: 'HIGH',
        supportLevels: [Number((price - step).toFixed(5)), Number((price - step * 2).toFixed(5))],
        resistanceLevels: [
          Number((price + step).toFixed(5)),
          Number((price + step * 2).toFixed(5)),
        ],
        entryPrice: price,
        tpPrice: Number((bullish ? price + step * 1.6 : price - step * 1.6).toFixed(5)),
        slPrice: Number((bullish ? price - step : price + step).toFixed(5)),
        reasoning: `Struktur harga ${symbolMatch?.[1] ?? 'instrumen'} berada pada momentum ${bullish ? 'bullish di atas MA(20)' : 'koreksi mendekati resistance'} dengan RSI(14) di ${rsi.toFixed(1)}. Rasio risk/reward 1:1.6 mendukung skenario ${bullish ? 'BUY' : 'SELL'} dengan disiplin stop loss.`,
      });
      return { content: json, model: this.defaultModel };
    }

    // 2. Structured Strategy Parser JSON prompt detection
    if (lower.includes('"entryconditions"') && lower.includes('"exitconditions"')) {
      const json = JSON.stringify({
        name: 'Adaptive Momentum & RSI Strategy',
        summary:
          'Strategi mengikuti momentum tren utama dengan filter RSI dan konfirmasi level support/resistance.',
        entryConditions: [
          'Harga berada di atas SMA(20) dengan RSI(14) < 65 untuk sinyal BUY',
          'Harga berada di bawah SMA(20) dengan RSI(14) > 35 untuk sinyal SELL',
        ],
        exitConditions: [
          'Tutup posisi ketika harga menyentuh target Take Profit atau Stop Loss',
          'Tutup posisi jika RSI memasuki area jenuh ekstrem (>75 atau <25)',
        ],
        suggestedTpPips: 45,
        suggestedSlPips: 25,
      });
      return { content: json, model: this.defaultModel };
    }

    // 3. Structured Automation Evaluation JSON prompt detection
    if (lower.includes('"open_buy"') && lower.includes('"open_sell"')) {
      const json = JSON.stringify({
        action: 'HOLD',
        positionId: null,
        tpPrice: null,
        slPrice: null,
        confidence: 'MEDIUM',
        reasoning:
          'Kondisi pasar saat ini masih berada di area konsolidasi; menunggu konfirmasi candle berikutnya sesuai aturan risk guard.',
      });
      return { content: json, model: this.defaultModel };
    }

    // 4. Natural language trading command -> emit tool call if tools are provided
    const openMatch =
      /\b(buka|open)\s+(buy|sell)\s+([a-z0-9._-]+)(?:\s+([0-9.]+))?/i.exec(lastUser) ||
      /\b(buy|sell)\s+([a-z0-9._-]+)\s+([0-9.]+)\s*lot/i.exec(lastUser);
    if (openMatch && options?.tools?.some((t) => t.name === 'open_position')) {
      const isFirstForm =
        openMatch[1]?.toLowerCase() === 'buka' || openMatch[1]?.toLowerCase() === 'open';
      const side = (isFirstForm ? openMatch[2] : openMatch[1])!.toUpperCase();
      const symbol = (isFirstForm ? openMatch[3] : openMatch[2])!.toUpperCase();
      const volume = Number((isFirstForm ? openMatch[4] : openMatch[3]) ?? '0.01') || 0.01;
      const toolCalls: ToolCall[] = [
        {
          id: `demo_tool_${Date.now()}`,
          name: 'open_position',
          arguments: { symbol, side, volume, comment: 'AI Chat Order' },
        },
      ];
      return {
        content: `Saya telah menyiapkan order **${side} ${symbol}** sebesar **${volume} lot**. Silakan tinjau dan klik **Konfirmasi** pada kartu di bawah untuk mengeksekusi order.`,
        model: this.defaultModel,
        toolCalls,
      };
    }

    const reply = [
      'Berikut ringkasan analisis berdasarkan konteks akun trading Anda saat ini:',
      '',
      '- **Kondisi Akun & Margin:** Margin level berada pada zona aman. Pertahankan eksposur risiko maksimal **1–2% per posisi**.',
      '- **Rekomendasi Eksekusi:** Selalu pasang *Stop Loss* dan *Take Profit* dengan rasio *Risk:Reward* minimal **1:1.5**.',
      '- **Perintah Cepat:** Anda dapat mengetik perintah seperti `"Buka BUY EURUSD 0.05"` untuk menyiapkan eksekusi order dengan konfirmasi keamanan.',
    ].join('\n');

    return { content: reply, model: this.defaultModel };
  }

  async *chatStream(
    messages: readonly ChatMessage[],
    options?: ChatOptions,
  ): AsyncGenerator<string, void, void> {
    const result = await this.chat(messages, options);
    const words = result.content.split(/(?=\s)/);
    for (const word of words) {
      yield word;
    }
  }

  async listModels(): Promise<string[]> {
    return [this.defaultModel];
  }

  async testConnection(): Promise<ConnectionTestResult> {
    return { success: true, latency: 12 };
  }
}

/**
 * Multi-provider router with:
 *  - Hot-swap provider lookup
 *  - Request pacing queue (`AI.queueMinGapMs`) to protect against provider rate limits
 *  - Automatic fallback to secondary configured providers (or DemoSandboxAIProvider in demo mode)
 */
export class AIProviderRouter {
  private readonly providers = new Map<string, AIProvider>();
  private readonly configs = new Map<string, AIProviderConfig>();
  private readonly queueMutex = new Mutex();
  private lastCallTimestamp = 0;

  constructor(private readonly fetchImpl?: typeof fetch) {}

  syncConfigs(configs: readonly AIProviderConfig[]): void {
    this.providers.clear();
    this.configs.clear();
    for (const cfg of configs) {
      this.configs.set(cfg.id, cfg);
      this.providers.set(cfg.id, createProvider(cfg, this.fetchImpl));
    }
  }

  loadProvider(config: AIProviderConfig): AIProvider {
    const instance = createProvider(config, this.fetchImpl);
    this.configs.set(config.id, config);
    this.providers.set(config.id, instance);
    return instance;
  }

  getProvider(id: string): AIProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Provider ${id} tidak ditemukan`);
    return provider;
  }

  hasUsableCredentials(id: string): boolean {
    const cfg = this.configs.get(id);
    if (!cfg) return false;
    return cfg.type === 'ollama' || Boolean(cfg.apiKey.trim());
  }

  /** Paces consecutive AI requests so batch operations never trip provider rate limits. */
  async enqueue<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return this.queueMutex.runExclusive(async () => {
      const elapsed = Date.now() - this.lastCallTimestamp;
      if (this.lastCallTimestamp > 0 && elapsed < AI.queueMinGapMs) {
        await sleep(AI.queueMinGapMs - elapsed, signal);
      }
      try {
        return await task();
      } finally {
        this.lastCallTimestamp = Date.now();
      }
    });
  }

  async chat(
    providerId: string,
    messages: readonly ChatMessage[],
    options?: ChatOptions & { allowDemoFallback?: boolean },
  ): Promise<ChatResult> {
    return this.enqueue(async () => {
      const primary = this.providers.get(providerId);
      if (primary && this.hasUsableCredentials(providerId)) {
        try {
          return await primary.chat(messages, options);
        } catch (primaryError) {
          // Try any other configured provider that has valid credentials (circuit-breaker fallback)
          for (const [id, candidate] of this.providers) {
            if (id === providerId || !this.hasUsableCredentials(id)) continue;
            try {
              return await candidate.chat(messages, options);
            } catch {
              /* continue to next fallback */
            }
          }
          throw primaryError;
        }
      }

      if (options?.allowDemoFallback) {
        return new DemoSandboxAIProvider().chat(messages, options);
      }
      throw new Error(
        'API key untuk AI provider belum dikonfigurasi. Buka Settings → AI Providers untuk mengisi API key.',
      );
    }, options?.signal);
  }
}

export const aiRouter = new AIProviderRouter();
