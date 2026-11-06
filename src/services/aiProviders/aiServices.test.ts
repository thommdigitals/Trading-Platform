import { describe, expect, it, vi } from 'vitest';
import {
  AIProviderRouter,
  AnthropicProvider,
  CustomProvider,
  DemoSandboxAIProvider,
  GeminiProvider,
  GroqProvider,
  MistralProvider,
  OllamaProvider,
  OpenAIProvider,
  createProvider,
} from './index';
import {
  buildAccountSummary,
  buildPendingOrdersSummary,
  buildPositionsSummary,
  buildQuotesSummary,
  buildSystemPrompt,
  estimateTokenCount,
} from '@/services/tradingContext';
import {
  TRADING_TOOLS,
  describeToolCall,
  executeTradingTool,
  requiresUserConfirmation,
} from '@/services/tradingTools';
import {
  analyzeSymbolWithAI,
  parseAnalysisResponse,
  prepareCandleSummaryForPrompt,
} from '@/services/marketAnalysis';
import {
  checkCircuitBreaker,
  checkDailyLoss,
  checkDrawdown,
  checkMaxPositions,
  checkTradingHours,
  evaluateRiskGuards,
} from '@/services/riskGuard';
import { AutomationEngine, parseStrategyWithAI } from '@/services/automationEngine';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import type { AIProviderConfig, AutomationStrategy } from '@/types/ai';

function sseResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const baseCfg = (type: AIProviderConfig['type']): AIProviderConfig => ({
  id: `id-${type}`,
  displayName: `Provider ${type}`,
  type,
  baseURL: '',
  apiKey: 'sk-test-1234',
  defaultModel: '',
  createdAt: 1,
});

describe('AI Providers (all 7 types)', () => {
  it('OpenAIProvider: chat, toolCalls, chatStream, listModels, testConnection', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4o' }, { id: 'whisper-1' }] }));
      }
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.stream) {
        return sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}',
          'data: {"choices":[{"delta":{"content":"lo"}}]}',
          'data: [DONE]',
        ]);
      }
      return new Response(
        JSON.stringify({
          model: 'gpt-4o',
          choices: [
            {
              message: {
                content: 'Siap eksekusi',
                tool_calls: [
                  {
                    id: 'tc1',
                    function: {
                      name: 'open_position',
                      arguments: '{"symbol":"EURUSD","side":"BUY","volume":0.05}',
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      );
    });

    const provider = new OpenAIProvider(baseCfg('openai'), fetchMock as unknown as typeof fetch);
    const res = await provider.chat(
      [{ id: '1', role: 'user', content: 'Buy EURUSD', createdAt: 1 }],
      { tools: TRADING_TOOLS },
    );
    expect(res.content).toBe('Siap eksekusi');
    expect(res.toolCalls?.[0]?.name).toBe('open_position');
    expect(res.usage?.totalTokens).toBe(15);

    const chunks: string[] = [];
    for await (const tok of provider.chatStream([
      { id: '1', role: 'user', content: 'Hi', createdAt: 1 },
    ])) {
      chunks.push(tok);
    }
    expect(chunks.join('')).toBe('Hello');

    const models = await provider.listModels();
    expect(models).toEqual(['gpt-4o']);

    const ping = await provider.testConnection();
    expect(ping.success).toBe(true);
  });

  it('AnthropicProvider: chat (separates system prompt + tool_use) and chatStream', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      expect(body.system).toBe('SYS');
      if (body.stream) {
        return sseResponse([
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Claude "}}',
          'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"OK"}}',
        ]);
      }
      return new Response(
        JSON.stringify({
          model: 'claude-sonnet-4-6',
          content: [
            { type: 'text', text: 'Analisis selesai' },
            { type: 'tool_use', id: 'tu1', name: 'get_quote', input: { symbols: ['EURUSD'] } },
          ],
          usage: { input_tokens: 12, output_tokens: 8 },
        }),
      );
    });

    const provider = new AnthropicProvider(
      baseCfg('anthropic'),
      fetchMock as unknown as typeof fetch,
    );
    const res = await provider.chat([
      { id: 's', role: 'system', content: 'SYS', createdAt: 1 },
      { id: 'u', role: 'user', content: 'Cek', createdAt: 2 },
    ]);
    expect(res.content).toBe('Analisis selesai');
    expect(res.toolCalls?.[0]?.name).toBe('get_quote');
    expect(res.usage?.totalTokens).toBe(20);

    const chunks: string[] = [];
    for await (const tok of provider.chatStream([
      { id: 's', role: 'system', content: 'SYS', createdAt: 1 },
      { id: 'u', role: 'user', content: 'Hi', createdAt: 2 },
    ])) {
      chunks.push(tok);
    }
    expect(chunks.join('')).toBe('Claude OK');
    expect((await provider.listModels()).length).toBeGreaterThan(0);
  });

  it('GeminiProvider: chat, chatStream, listModels', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/v1beta/models?')) {
        return new Response(
          JSON.stringify({ models: [{ name: 'models/gemini-1.5-pro' }] }),
        );
      }
      if (url.includes('streamGenerateContent')) {
        return sseResponse([
          'data: {"candidates":[{"content":{"parts":[{"text":"Gem"}]}}]}',
          'data: {"candidates":[{"content":{"parts":[{"text":"ini"}]}}]}',
        ]);
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Halo dari Gemini' }] } }],
          usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6, totalTokenCount: 10 },
        }),
      );
    });

    const provider = new GeminiProvider(baseCfg('google'), fetchMock as unknown as typeof fetch);
    const res = await provider.chat([{ id: '1', role: 'user', content: 'Hi', createdAt: 1 }]);
    expect(res.content).toBe('Halo dari Gemini');

    const chunks: string[] = [];
    for await (const tok of provider.chatStream([
      { id: '1', role: 'user', content: 'Hi', createdAt: 1 },
    ])) {
      chunks.push(tok);
    }
    expect(chunks.join('')).toBe('Gemini');
    expect(await provider.listModels()).toEqual(['gemini-1.5-pro']);
  });

  it('MistralProvider, GroqProvider, CustomProvider, OllamaProvider factory & calls', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'llama3' }, { name: 'qwen2.5' }] }));
      }
      if (url.endsWith('/api/chat')) {
        const encoder = new TextEncoder();
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(encoder.encode('{"message":{"content":"Oll"}}\n{"message":{"content":"ama"}}\n'));
              c.close();
            },
          }),
        );
      }
      return new Response(
        JSON.stringify({
          model: 'm',
          choices: [{ message: { content: 'OK' } }],
        }),
      );
    });

    const mistral = createProvider(baseCfg('mistral'), fetchMock as unknown as typeof fetch);
    const groq = createProvider(baseCfg('groq'), fetchMock as unknown as typeof fetch);
    const custom = createProvider(
      { ...baseCfg('custom'), baseURL: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
      fetchMock as unknown as typeof fetch,
    );
    const ollama = createProvider(baseCfg('ollama'), fetchMock as unknown as typeof fetch);

    expect(mistral).toBeInstanceOf(MistralProvider);
    expect(groq).toBeInstanceOf(GroqProvider);
    expect(custom).toBeInstanceOf(CustomProvider);
    expect(ollama).toBeInstanceOf(OllamaProvider);

    expect(await mistral.listModels()).toContain('mistral-large-latest');
    expect(await groq.listModels()).toContain('llama-3.3-70b-versatile');
    expect(await ollama.listModels()).toEqual(['llama3', 'qwen2.5']);
    expect((await ollama.testConnection()).success).toBe(true);

    const streamParts: string[] = [];
    for await (const part of ollama.chatStream([
      { id: '1', role: 'user', content: 'Hi', createdAt: 1 },
    ])) {
      streamParts.push(part);
    }
    expect(streamParts.join('')).toBe('Ollama');
  });

  it('AIProviderRouter falls back to secondary provider on failure', async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response('{"error":{"message":"down"}}', { status: 500 });
      return new Response(
        JSON.stringify({ model: 'backup', choices: [{ message: { content: 'Fallback OK' } }] }),
      );
    });

    const router = new AIProviderRouter(fetchMock as unknown as typeof fetch);
    router.syncConfigs([
      { ...baseCfg('openai'), id: 'p1' },
      { ...baseCfg('groq'), id: 'p2' },
    ]);

    const res = await router.chat('p1', [{ id: '1', role: 'user', content: 'Hi', createdAt: 1 }]);
    expect(res.content).toBe('Fallback OK');
  });
});

describe('TradingContext, TradingTools, MarketAnalysis, RiskGuard & AutomationEngine', () => {
  it('builds system prompt and summaries accurately', () => {
    const prompt = buildSystemPrompt({
      account: {
        login: '319642',
        name: 'Trader',
        currency: 'USD',
        currencyPrecision: 2,
        leverage: 100,
        accessRight: 'FULL',
      },
      accountSummary: {
        balance: 10000,
        equity: 10050,
        margin: 100,
        freeMargin: 9950,
        marginLevel: 10050,
        floatingProfit: 50,
      },
      positions: [
        {
          id: '1',
          symbol: 'EURUSD',
          alias: 'EUR/USD',
          side: 'BUY',
          volume: 0.1,
          openPrice: 1.08,
          currentPrice: 1.085,
          openTime: 1,
          tpPrice: 1.09,
          slPrice: 1.075,
          swap: 0,
          commission: 0,
          profit: 50,
          comment: '',
        },
      ],
      pendingOrders: [],
      quotes: { EURUSD: { symbol: 'EURUSD', bid: 1.085, ask: 1.0852, timestamp: 1 } },
    });

    expect(prompt).toContain('319642');
    expect(prompt).toContain('EURUSD');
    expect(estimateTokenCount(prompt)).toBeGreaterThan(20);
    expect(buildAccountSummary(null, null)).toContain('belum terhubung');
    expect(buildPositionsSummary([])).toContain('Tidak ada posisi');
    expect(buildPendingOrdersSummary([])).toContain('Tidak ada pending');
    expect(buildQuotesSummary([])).toContain('Belum ada quote');
  });

  it('executes trading tools and describes confirmations in demo mode', async () => {
    useConfigStore.getState().setDemoMode(true);
    expect(requiresUserConfirmation('open_position')).toBe(true);
    expect(requiresUserConfirmation('get_quote')).toBe(false);

    const approval = describeToolCall({
      id: 'c1',
      name: 'open_position',
      arguments: { symbol: 'EURUSD', side: 'BUY', volume: 0.02 },
    });
    expect(approval.summary).toContain('BUY EURUSD');

    const msg = await executeTradingTool(
      'open_position',
      { symbol: 'EURUSD', side: 'BUY', volume: 0.02 },
      fortunoApi,
    );
    expect(msg).toContain('Position ID');

    const quoteJson = await executeTradingTool(
      'get_quote',
      { symbols: ['EURUSD'] },
      fortunoApi,
    );
    expect(JSON.parse(quoteJson)[0].symbol).toBe('EURUSD');
  });

  it('analyzes symbol with AI and parses structured output', async () => {
    useConfigStore.getState().setDemoMode(true);
    const router = new AIProviderRouter();
    const res = await analyzeSymbolWithAI({
      symbol: 'EURUSD',
      interval: 'H1',
      providerId: 'missing',
      router,
      apiClient: fortunoApi,
      allowDemoFallback: true,
    });
    expect(res.symbol).toBe('EURUSD');
    expect(['UPTREND', 'DOWNTREND', 'SIDEWAYS']).toContain(res.trend);

    const fallback = parseAnalysisResponse('not json', 'EURUSD', 'H1', [
      { timestamp: 1, open: 1, high: 1.1, low: 0.9, close: 1.05, tickCount: 10 },
    ]);
    expect(fallback.symbol).toBe('EURUSD');
    expect(prepareCandleSummaryForPrompt('EURUSD', 'H1', [])).toContain('Tidak ada data');
  });

  it('evaluates risk guard conditions accurately', () => {
    const now = new Date(2026, 10, 6, 14, 0, 0);
    const strategy: AutomationStrategy = {
      id: 's1',
      name: 'RSI Strategy',
      rawDescription: 'Buy RSI < 30',
      summary: 'Summary',
      entryConditions: ['RSI < 30'],
      exitConditions: ['RSI > 70'],
      suggestedTpPips: 40,
      suggestedSlPips: 20,
      symbol: 'EURUSD',
      interval: 'H1',
      volume: 0.05,
      maxOpenPositions: 2,
      maxDailyLoss: 100,
      maxDrawdownPercent: 10,
      activeHoursStart: '08:00',
      activeHoursEnd: '20:00',
      createdAt: now.getTime(),
    };

    expect(checkDailyLoss(strategy, [], now.getTime())).toBe(true);
    expect(
      checkDailyLoss(
        strategy,
        [
          {
            id: '1',
            symbol: 'EURUSD',
            alias: '',
            side: 'BUY',
            volume: 1,
            openPrice: 1,
            currentPrice: 1,
            closePrice: 1,
            openTime: now.getTime() - 1000,
            closeTime: now.getTime() - 500,
            tpPrice: null,
            slPrice: null,
            swap: 0,
            commission: 0,
            profit: -120,
            comment: '',
          },
        ],
        now.getTime(),
      ),
    ).toBe(false);

    expect(checkDrawdown({ balance: 1000, equity: 950 }, 10)).toBe(true);
    expect(checkDrawdown({ balance: 1000, equity: 880 }, 10)).toBe(false);
    expect(checkMaxPositions([], 2)).toBe(true);
    expect(checkTradingHours(strategy, now)).toBe(true);
    expect(checkCircuitBreaker(2)).toBe(true);
    expect(checkCircuitBreaker(3)).toBe(false);

    const evalOk = evaluateRiskGuards({
      strategy,
      summary: {
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        marginLevel: null,
        floatingProfit: 0,
      },
      openPositions: [],
      closedPositionsToday: [],
      consecutiveErrors: 0,
      now,
    });
    expect(evalOk.canOpenNewPosition).toBe(true);
  });

  it('parses strategy and runs AutomationEngine lifecycle', async () => {
    useConfigStore.getState().setDemoMode(true);
    const router = new AIProviderRouter();
    const parsed = await parseStrategyWithAI({
      description: 'Buka BUY EURUSD saat RSI di bawah 30',
      providerId: 'none',
      router,
      allowDemoFallback: true,
    });
    expect(parsed.entryConditions.length).toBeGreaterThan(0);

    const statuses: string[] = [];
    const logs: string[] = [];
    const engine = new AutomationEngine(
      fortunoApi,
      router,
      {
        onStatusChange: (s) => statuses.push(s),
        onLog: (l) => logs.push(l.message),
        onStatsUpdate: () => undefined,
        getProviderId: () => 'none',
        isDemoMode: () => true,
      },
      60_000,
    );

    engine.start({
      ...parsed,
      id: 'strat-1',
      rawDescription: 'Test',
      symbol: 'EURUSD',
      interval: 'H1',
      volume: 0.01,
      maxOpenPositions: 5,
      maxDailyLoss: 500,
      maxDrawdownPercent: 20,
      activeHoursStart: '00:00',
      activeHoursEnd: '23:59',
      createdAt: Date.now(),
    });
    expect(engine.getStatus()).toBe('running');
    await engine.evaluateOnce();
    engine.pause();
    expect(engine.getStatus()).toBe('paused');
    engine.resume();
    expect(engine.getStatus()).toBe('running');
    engine.stop();
    expect(engine.getStatus()).toBe('stopped');
    expect(logs.length).toBeGreaterThan(0);

    const demo = new DemoSandboxAIProvider();
    expect((await demo.testConnection()).success).toBe(true);
    useConfigStore.getState().setDemoMode(false);
  });
});

