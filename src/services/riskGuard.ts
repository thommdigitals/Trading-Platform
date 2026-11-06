import { AUTOMATION } from '@/config/constants';
import type { AccountSummary, ClosedPosition, Position } from '@/types/api';
import type { StrategyRiskConfig } from '@/types/ai';
import { startOfDay } from '@/utils/dateTime';
import { netPnl } from '@/utils/tradingCalculations';

export interface RiskCheckOutcome {
  ok: boolean;
  reason?: string;
}

/**
 * Checks whether today's realised loss across closed positions stays strictly below `maxDailyLoss`.
 * Returns `true` when safe to continue trading, `false` when the daily loss limit has been hit.
 */
export function checkDailyLoss(
  strategy: Pick<StrategyRiskConfig, 'maxDailyLoss'>,
  closedPositionsToday: readonly ClosedPosition[],
  now: number = Date.now(),
): boolean {
  const dayStart = startOfDay(now);
  const netToday = closedPositionsToday
    .filter((pos) => pos.closeTime >= dayStart)
    .reduce((sum, pos) => sum + netPnl(pos), 0);
  const lossToday = netToday < 0 ? Math.abs(netToday) : 0;
  return lossToday < strategy.maxDailyLoss;
}

/**
 * Checks whether current account drawdown `(balance - equity) / balance * 100` is within limit.
 * Returns `true` when safe, `false` when breached.
 */
export function checkDrawdown(
  summary: Pick<AccountSummary, 'balance' | 'equity'>,
  maxDrawdownPercent: number,
): boolean {
  if (summary.balance <= 0) return false;
  const drawdownPct = Math.max(0, ((summary.balance - summary.equity) / summary.balance) * 100);
  return drawdownPct < maxDrawdownPercent;
}

/**
 * Returns `true` when the number of open positions is strictly below `maxOpenPositions`.
 */
export function checkMaxPositions(positions: readonly Position[], max: number): boolean {
  return positions.length < max;
}

function parseMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Checks whether `now` (local time) falls within `[activeHoursStart, activeHoursEnd]`.
 * Supports overnight ranges (e.g. `22:00` – `04:00`).
 */
export function checkTradingHours(
  strategy: Pick<StrategyRiskConfig, 'activeHoursStart' | 'activeHoursEnd'>,
  now: Date = new Date(),
): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseMinutes(strategy.activeHoursStart);
  const end = parseMinutes(strategy.activeHoursEnd);
  if (start === end) return true;
  if (start < end) return current >= start && current <= end;
  return current >= start || current <= end;
}

/**
 * Returns `true` when consecutive error count is below the circuit-breaker threshold (default 3).
 */
export function checkCircuitBreaker(
  errorCount: number,
  maxErrors: number = AUTOMATION.circuitBreakerMaxErrors,
): boolean {
  return errorCount < maxErrors;
}

export interface FullRiskEvaluationInput {
  strategy: StrategyRiskConfig;
  summary: AccountSummary | null;
  openPositions: readonly Position[];
  closedPositionsToday: readonly ClosedPosition[];
  consecutiveErrors: number;
  now?: Date;
}

/**
 * Evaluates all hard-stop conditions (daily loss, drawdown, circuit breaker) and entry-gate
 * conditions (trading hours, max open positions).
 */
export function evaluateRiskGuards(input: FullRiskEvaluationInput): {
  shouldAutoStop: boolean;
  canOpenNewPosition: boolean;
  reason?: string;
} {
  if (!checkCircuitBreaker(input.consecutiveErrors)) {
    return {
      shouldAutoStop: true,
      canOpenNewPosition: false,
      reason: `Circuit breaker aktif: ${input.consecutiveErrors} error API berturut-turut`,
    };
  }

  if (!checkDailyLoss(input.strategy, input.closedPositionsToday, input.now?.getTime())) {
    return {
      shouldAutoStop: true,
      canOpenNewPosition: false,
      reason: `Batas kerugian harian (${input.strategy.maxDailyLoss} USD) terlampaui`,
    };
  }

  if (
    input.summary &&
    !checkDrawdown(input.summary, input.strategy.maxDrawdownPercent)
  ) {
    return {
      shouldAutoStop: true,
      canOpenNewPosition: false,
      reason: `Batas maksimum drawdown (${input.strategy.maxDrawdownPercent}%) terlampaui`,
    };
  }

  if (!checkTradingHours(input.strategy, input.now)) {
    return {
      shouldAutoStop: false,
      canOpenNewPosition: false,
      reason: `Di luar jam aktif strategi (${input.strategy.activeHoursStart}–${input.strategy.activeHoursEnd})`,
    };
  }

  if (!checkMaxPositions(input.openPositions, input.strategy.maxOpenPositions)) {
    return {
      shouldAutoStop: false,
      canOpenNewPosition: false,
      reason: `Jumlah posisi maksimum (${input.strategy.maxOpenPositions}) telah tercapai`,
    };
  }

  return { shouldAutoStop: false, canOpenNewPosition: true };
}

export function triggerRiskNotification(title: string, body: string): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    /* ignore browser notification permission / environment restrictions */
  }
}

