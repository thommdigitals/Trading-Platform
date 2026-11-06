import { AUTOMATION } from '@/config/constants';
import { CANDLE_INTERVAL_MS } from '@/config/market';
import type { AIProviderRouter } from '@/services/aiProviders';
import type { FortunoClient } from '@/services/fortuno/client';
import { extractJsonObject, prepareCandleSummaryForPrompt } from '@/services/marketAnalysis';
import { evaluateRiskGuards, triggerRiskNotification } from '@/services/riskGuard';
import {
  AutomationDecisionSchema,
  ParsedStrategySchema,
  type AutomationDecision,
  type AutomationLogEntry,
  type AutomationStatus,
  type AutomationStrategy,
  type ChatMessage,
  type ParsedStrategy,
} from '@/types/ai';
import { Mutex } from '@/utils/async';
import { startOfDay } from '@/utils/dateTime';

export async function parseStrategyWithAI(params: {
  description: string;
  providerId: string;
  router: AIProviderRouter;
  allowDemoFallback?: boolean;
  signal?: AbortSignal;
}): Promise<ParsedStrategy> {
  const trimmed = params.description.trim();
  if (!trimmed) {
    throw new Error('Deskripsi strategi tidak boleh kosong');
  }

  const messages: ChatMessage[] = [
    {
      id: 'sys',
      role: 'system',
      createdAt: Date.now(),
      content:
        'Kamu adalah arsitek sistem trading kuantitatif. Ubah deskripsi strategi bahasa natural menjadi konfigurasi JSON terstruktur. Balas HANYA dengan JSON.',
    },
    {
      id: 'usr',
      role: 'user',
      createdAt: Date.now(),
      content: `Konversikan strategi berikut ke format JSON:
{
  "name": "nama strategi singkat",
  "summary": "ringkasan cara kerja strategi",
  "entryConditions": ["kondisi entry 1", "kondisi entry 2"],
  "exitConditions": ["kondisi exit 1"],
  "suggestedTpPips": number | null,
  "suggestedSlPips": number | null
}

Deskripsi pengguna:
${trimmed}`,
    },
  ];

  const response = await params.router.chat(params.providerId, messages, {
    temperature: 0.2,
    allowDemoFallback: params.allowDemoFallback,
    signal: params.signal,
  });

  try {
    return ParsedStrategySchema.parse(extractJsonObject(response.content));
  } catch {
    return {
      name: 'Custom AI Strategy',
      summary: trimmed.slice(0, 240),
      entryConditions: [trimmed.slice(0, 180)],
      exitConditions: ['Eksekusi TP/SL sesuai parameter manajemen risiko'],
      suggestedTpPips: 40,
      suggestedSlPips: 25,
    };
  }
}

export interface AutomationEngineCallbacks {
  onStatusChange: (status: AutomationStatus) => void;
  onLog: (entry: Omit<AutomationLogEntry, 'id' | 'time'>) => void;
  onStatsUpdate: (stats: {
    totalTrades?: number;
    profitLoss?: number;
    activePositions?: number;
  }) => void;
  getProviderId: () => string | null;
  isDemoMode?: () => boolean;
}

export class AutomationEngine {
  private strategy: AutomationStrategy | null = null;
  private status: AutomationStatus = 'idle';
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly evalMutex = new Mutex();
  private consecutiveErrors = 0;
  private totalTradesExecuted = 0;

  constructor(
    private readonly apiClient: FortunoClient,
    private readonly router: AIProviderRouter,
    private readonly callbacks: AutomationEngineCallbacks,
    private readonly intervalOverrideMs?: number,
  ) {}

  getStatus(): AutomationStatus {
    return this.status;
  }

  getActiveStrategy(): AutomationStrategy | null {
    return this.strategy;
  }

  start(strategy: AutomationStrategy): void {
    this.stop();
    this.strategy = strategy;
    this.consecutiveErrors = 0;
    this.totalTradesExecuted = 0;
    this.setStatus('running');
    this.callbacks.onLog({
      level: 'info',
      message: `Strategi "${strategy.name}" diaktifkan untuk ${strategy.symbol} (${strategy.interval}).`,
    });

    const intervalMs =
      this.intervalOverrideMs ??
      Math.max(
        AUTOMATION.minEvaluationIntervalMs,
        Math.min(CANDLE_INTERVAL_MS[strategy.interval], 60_000),
      );

    void this.evaluateOnce();
    this.timer = setInterval(() => {
      if (this.status === 'running') {
        void this.evaluateOnce();
      }
    }, intervalMs);
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.setStatus('paused');
    this.callbacks.onLog({
      level: 'info',
      message: 'Evaluasi strategi dijeda (posisi terbuka tetap berjalan).',
    });
  }

  resume(): void {
    if (this.status !== 'paused' || !this.strategy) return;
    this.setStatus('running');
    this.callbacks.onLog({
      level: 'info',
      message: 'Evaluasi strategi dilanjutkan.',
    });
    void this.evaluateOnce();
  }

  stop(reason?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.status !== 'idle' && this.status !== 'stopped') {
      this.setStatus('stopped');
      this.callbacks.onLog({
        level: reason ? 'warn' : 'info',
        message: reason ? `Strategi dihentikan otomatis: ${reason}` : 'Strategi dihentikan.',
      });
    }
  }

  async evaluateOnce(): Promise<AutomationDecision | null> {
    if (this.status !== 'running' || !this.strategy || this.evalMutex.isLocked) {
      return null;
    }

    return this.evalMutex.runExclusive(async () => {
      const strategy = this.strategy;
      if (!strategy || this.status !== 'running') return null;

      try {
        const now = Date.now();
        const [summary, openPositions, closedToday] = await Promise.all([
          this.apiClient.getAccountSummary(),
          this.apiClient.getPositions([strategy.symbol]),
          this.apiClient.getClosedPositions({
            from: startOfDay(now),
            to: now,
          }),
        ]);

        const strategyPnl =
          openPositions.reduce((s, p) => s + p.profit, 0) +
          closedToday
            .filter((p) => p.symbol === strategy.symbol)
            .reduce((s, p) => s + p.profit, 0);

        this.callbacks.onStatsUpdate({
          activePositions: openPositions.length,
          profitLoss: Number(strategyPnl.toFixed(2)),
          totalTrades: this.totalTradesExecuted,
        });

        const risk = evaluateRiskGuards({
          strategy,
          summary,
          openPositions,
          closedPositionsToday: closedToday,
          consecutiveErrors: this.consecutiveErrors,
        });

        if (risk.shouldAutoStop) {
          const reason = risk.reason ?? 'Batas risiko terlampaui';
          triggerRiskNotification('FortunoAI Risk Guard', reason);
          this.stop(reason);
          return null;
        }

        if (!risk.canOpenNewPosition) {
          this.callbacks.onLog({
            level: 'info',
            message: `Evaluasi dilewati: ${risk.reason}`,
          });
          return null;
        }

        const candles = await this.apiClient.getCandles(strategy.symbol, strategy.interval, {
          limit: AUTOMATION.candlesPerEvaluation,
        });
        const marketSummary = prepareCandleSummaryForPrompt(
          strategy.symbol,
          strategy.interval,
          candles,
        );

        const providerId = this.callbacks.getProviderId() ?? 'default-openai';
        const response = await this.router.chat(
          providerId,
          [
            {
              id: 'sys',
              role: 'system',
              createdAt: now,
              content:
                'Kamu adalah mesin eksekusi strategi otomatis. Evaluasi aturan strategi terhadap data pasar dan balas HANYA dalam format JSON.',
            },
            {
              id: 'usr',
              role: 'user',
              createdAt: now,
              content: `Strategi: ${strategy.name}
Kondisi Entry: ${strategy.entryConditions.join('; ')}
Kondisi Exit: ${strategy.exitConditions.join('; ')}
Posisi Terbuka Saat Ini: ${openPositions.length}/${strategy.maxOpenPositions}

Data Pasar:
${marketSummary}

Balas JSON dengan struktur:
{
  "action": "OPEN_BUY" | "OPEN_SELL" | "CLOSE_POSITION" | "HOLD",
  "positionId": string | null,
  "tpPrice": number | null,
  "slPrice": number | null,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "alasan singkat"
}`,
            },
          ],
          {
            temperature: 0.1,
            allowDemoFallback: this.callbacks.isDemoMode?.() ?? false,
          },
        );

        const decision = AutomationDecisionSchema.parse(extractJsonObject(response.content));
        this.consecutiveErrors = 0;

        if (decision.action === 'OPEN_BUY' || decision.action === 'OPEN_SELL') {
          const side = decision.action === 'OPEN_BUY' ? 'BUY' : 'SELL';
          const created = await this.apiClient.openPosition({
            symbol: strategy.symbol,
            side,
            volume: strategy.volume,
            tpPrice: decision.tpPrice,
            slPrice: decision.slPrice,
            comment: `Auto: ${strategy.name}`.slice(0, 120),
          });
          this.totalTradesExecuted += 1;
          this.callbacks.onStatsUpdate({
            totalTrades: this.totalTradesExecuted,
            activePositions: openPositions.length + 1,
          });
          this.callbacks.onLog({
            level: 'action',
            message: `Buka ${side} ${strategy.symbol} ${strategy.volume} lot (ID #${created.positionId}) — ${decision.reasoning}`,
          });
        } else if (decision.action === 'CLOSE_POSITION' && decision.positionId) {
          const target = openPositions.find((p) => p.id === decision.positionId);
          if (target) {
            await this.apiClient.closePosition(target.id, target.volume);
            this.callbacks.onLog({
              level: 'action',
              message: `Tutup posisi #${target.id} (${target.symbol}) — ${decision.reasoning}`,
            });
          }
        } else {
          this.callbacks.onLog({
            level: 'info',
            message: `Evaluasi ${strategy.symbol} (${strategy.interval}): HOLD — ${decision.reasoning || 'Tidak ada sinyal entry'}`,
          });
        }

        return decision;
      } catch (error) {
        this.consecutiveErrors += 1;
        const message = error instanceof Error ? error.message : 'Error evaluasi strategi';
        this.callbacks.onLog({
          level: 'error',
          message: `Error evaluasi (${this.consecutiveErrors}/${AUTOMATION.circuitBreakerMaxErrors}): ${message}`,
        });

        if (this.consecutiveErrors >= AUTOMATION.circuitBreakerMaxErrors) {
          const reason = `Circuit breaker aktif setelah ${this.consecutiveErrors} error berturut-turut`;
          triggerRiskNotification('FortunoAI Risk Guard', reason);
          this.setStatus('error');
          if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
          }
          this.callbacks.onLog({ level: 'warn', message: reason });
        }
        return null;
      }
    });
  }

  private setStatus(status: AutomationStatus): void {
    this.status = status;
    this.callbacks.onStatusChange(status);
  }
}
