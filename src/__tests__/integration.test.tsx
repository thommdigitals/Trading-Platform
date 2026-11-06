// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatMessage } from '@/components/ai/ChatMessage';
import { SignalCard } from '@/components/ai/SignalCard';
import { TradeConfirmCard } from '@/components/ai/TradeConfirmCard';
import { HistorySummaryCard } from '@/components/history/HistorySummaryCard';
import { IntervalSelector } from '@/components/market/IntervalSelector';
import { QuoteCard } from '@/components/market/QuoteCard';
import { aiRouter } from '@/services/aiProviders';
import { AutomationEngine, parseStrategyWithAI } from '@/services/automationEngine';
import { resetDemoState } from '@/services/fortuno/demoBackend';
import { fortunoApi } from '@/services/fortunoApi';
import { analyzeSymbolWithAI } from '@/services/marketAnalysis';
import { describeToolCall, executeTradingTool } from '@/services/tradingTools';
import { useAIStore } from '@/store/aiStore';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';
import type { AnalysisResult } from '@/types/ai';

describe('FortunoAI End-to-End Integration & Component Suite', () => {
  beforeEach(() => {
    resetDemoState();
    useConfigStore.getState().setDemoMode(true);
    useTradingStore.getState().reset();
    useAIStore.getState().clearMessages();
    useAIStore.getState().clearAutomationLog();
  });

  it('completes full authentication, account summary, symbols, quotes & candles flow in Demo Sandbox', async () => {
    const details = await fortunoApi.getPlatformDetails();
    expect(details.brokerName).toContain('Fortuno');

    const account = await fortunoApi.getAccount();
    expect(account.login).toBeTruthy();
    expect(account.accessRight).toBe('FULL');

    const summary = await fortunoApi.getAccountSummary();
    expect(summary.balance).toBeGreaterThan(0);
    expect(summary.equity).toBeGreaterThan(0);

    const symbols = await fortunoApi.getSymbols(undefined, { force: true });
    expect(symbols.length).toBeGreaterThanOrEqual(7);

    const quotes = await fortunoApi.getQuotes(['EURUSD', 'XAUUSD']);
    expect(quotes.length).toBe(2);

    const now = Date.now();
    const candles = await fortunoApi.getCandles('EURUSD', 'H1', {
      from: now - 24 * 3_600_000,
      to: now,
    });
    expect(candles.length).toBeGreaterThan(0);

    const hours = await fortunoApi.getTradingHours('EURUSD');
    expect(hours.symbol).toBe('EURUSD');
  });

  it('completes full position lifecycle: open -> update TP/SL -> partial close -> full close -> history', async () => {
    const initialPositions = await fortunoApi.getPositions();
    const initialCount = initialPositions.length;

    const opened = await fortunoApi.openPosition({
      symbol: 'EURUSD',
      side: 'BUY',
      volume: 0.1,
      tpPrice: 1.12,
      slPrice: 1.05,
      comment: 'Integration test trade',
    });
    expect(opened.positionId).toBeTruthy();

    const afterOpen = await fortunoApi.getPositions();
    expect(afterOpen.length).toBe(initialCount + 1);

    await fortunoApi.updatePosition(opened.positionId, {
      tpPrice: 1.125,
      slPrice: 1.055,
    });

    const updatedPos = (await fortunoApi.getPositions()).find((p) => p.id === opened.positionId);
    expect(updatedPos?.tpPrice).toBe(1.125);
    expect(updatedPos?.slPrice).toBe(1.055);

    // Partial close 0.04 lots
    await fortunoApi.closePosition(opened.positionId, 0.04);
    const afterPartial = (await fortunoApi.getPositions()).find((p) => p.id === opened.positionId);
    expect(afterPartial?.volume).toBeCloseTo(0.06, 4);

    // Close remaining 0.06 lots
    await fortunoApi.closePosition(opened.positionId, 0.06);
    const afterClose = (await fortunoApi.getPositions()).find((p) => p.id === opened.positionId);
    expect(afterClose).toBeUndefined();

    // Verify in closed positions history
    const closed = await fortunoApi.getClosedPositionsAll({
      from: Date.now() - 7 * 86_400_000,
      to: Date.now() + 60_000,
    });
    expect(closed.length).toBeGreaterThan(0);

    const ledgers = await fortunoApi.getLedgersAll({
      from: Date.now() - 30 * 86_400_000,
      to: Date.now() + 60_000,
    });
    expect(ledgers.length).toBeGreaterThan(0);
  });

  it('completes full pending order lifecycle: create -> update -> cancel', async () => {
    const created = await fortunoApi.createPendingOrder({
      symbol: 'EURUSD',
      side: 'BUY',
      type: 'LIMIT',
      volume: 0.05,
      activationPrice: 1.07,
      tpPrice: 1.09,
      slPrice: 1.06,
      comment: 'Pending test',
    });
    expect(created.orderId).toBeTruthy();

    await fortunoApi.updatePendingOrder(created.orderId, {
      activationPrice: 1.072,
      volume: 0.08,
    });

    const orders = await fortunoApi.getPendingOrders();
    const found = orders.find((o) => o.id === created.orderId);
    expect(found?.activationPrice).toBe(1.072);
    expect(found?.volume).toBe(0.08);

    await fortunoApi.cancelPendingOrder(created.orderId);
    const afterCancel = await fortunoApi.getPendingOrders();
    expect(afterCancel.find((o) => o.id === created.orderId)).toBeUndefined();
  });

  it('executes AI trading tools, market analysis, and strategy automation end-to-end', async () => {
    const cfg = useConfigStore.getState();
    aiRouter.syncConfigs(cfg.aiProviders);
    const providerId = cfg.activeProviderId ?? cfg.aiProviders[0]?.id ?? 'openai';

    // 1. AI Tool execution
    const toolOut = await executeTradingTool(
      'open_position',
      { symbol: 'GBPUSD', side: 'BUY', volume: 0.02 },
      fortunoApi,
    );
    expect(toolOut).toContain('GBPUSD');

    // 2. AI Market Analysis
    const analysis = await analyzeSymbolWithAI({
      symbol: 'EURUSD',
      interval: 'H1',
      providerId,
      router: aiRouter,
      apiClient: fortunoApi,
      allowDemoFallback: true,
    });
    expect(analysis.symbol).toBe('EURUSD');
    expect(['BUY', 'SELL', 'HOLD', 'WAIT']).toContain(analysis.signal);

    // 3. AI Strategy Parsing + Automation Engine cycle
    const parsed = await parseStrategyWithAI({
      description: 'Buka BUY EURUSD saat RSI < 30 dan tutup saat profit 20 pips',
      providerId,
      router: aiRouter,
      allowDemoFallback: true,
    });
    expect(parsed.entryConditions.length).toBeGreaterThan(0);

    const logs: string[] = [];
    const engine = new AutomationEngine(
      fortunoApi,
      aiRouter,
      {
        onStatusChange: (status) => useAIStore.getState().setAutomationStatus(status),
        onLog: (entry) => logs.push(entry.message),
        onStatsUpdate: (stats) => useAIStore.getState().updateAutomationStats(stats),
        getProviderId: () => providerId,
        isDemoMode: () => true,
      },
      60_000,
    );

    engine.start({
      id: 'strat-1',
      rawDescription: 'RSI strategy',
      createdAt: Date.now(),
      ...parsed,
      symbol: 'EURUSD',
      interval: 'M15',
      volume: 0.01,
      maxOpenPositions: 3,
      maxDailyLoss: 200,
      maxDrawdownPercent: 15,
      activeHoursStart: '00:00',
      activeHoursEnd: '23:59',
    });
    await engine.evaluateOnce();
    engine.stop();
    expect(logs.length).toBeGreaterThan(0);
  });

  it('renders QuoteCard, IntervalSelector, HistorySummaryCard, ChatMessage, TradeConfirmCard & SignalCard accurately', () => {
    const onSelect = vi.fn();
    render(
      <QuoteCard
        symbol="EURUSD"
        quote={{ symbol: 'EURUSD', bid: 1.0845, ask: 1.08465, timestamp: Date.now() }}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Select EURUSD/i }));
    expect(onSelect).toHaveBeenCalledWith('EURUSD');

    const onIntervalChange = vi.fn();
    render(<IntervalSelector value="H1" onChange={onIntervalChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'M15' }));
    expect(onIntervalChange).toHaveBeenCalledWith('M15');

    render(
      <HistorySummaryCard
        closedPositions={[
          {
            id: '101',
            symbol: 'EURUSD',
            alias: 'EUR/USD',
            side: 'BUY',
            volume: 0.1,
            openPrice: 1.08,
            currentPrice: 1.085,
            closePrice: 1.085,
            openTime: Date.now() - 3600_000,
            closeTime: Date.now(),
            tpPrice: null,
            slPrice: null,
            swap: 0,
            commission: -0.5,
            profit: 50,
            comment: '',
          },
        ]}
        ledgerEntries={[
          {
            id: 'L1',
            type: 'DEPOSIT',
            amount: 1000,
            balanceAfter: 11000,
            time: Date.now(),
            comment: 'Initial deposit',
          },
        ]}
      />,
    );
    expect(screen.getByText('100.0%')).toBeInTheDocument();

    const approval = describeToolCall({
      id: 'call-1',
      name: 'open_position',
      arguments: { symbol: 'EURUSD', side: 'BUY', volume: 0.05 },
    });
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <TradeConfirmCard
        approval={approval}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Konfirmasi/i }));
    expect(onConfirm).toHaveBeenCalledWith(approval);

    render(
      <ChatMessage
        message={{
          id: 'm1',
          role: 'assistant',
          content: '**Analisa EURUSD:** Tren bullish.',
          createdAt: Date.now(),
        }}
      />,
    );
    expect(screen.getByText(/Analisa EURUSD/i)).toBeInTheDocument();

    const sampleSignal: AnalysisResult = {
      symbol: 'XAUUSD',
      interval: 'H1',
      analyzedAt: Date.now(),
      trend: 'UPTREND',
      signal: 'BUY',
      strength: 4,
      confidence: 'HIGH',
      supportLevels: [2320.5],
      resistanceLevels: [2365.0],
      entryPrice: 2340.0,
      tpPrice: 2360.0,
      slPrice: 2325.0,
      reasoning: 'Gold momentum remains bullish above SMA 20.',
    };
    const onTradeSignal = vi.fn();
    render(<SignalCard result={sampleSignal} precision={2} onTradeSignal={onTradeSignal} />);
    fireEvent.click(screen.getByRole('button', { name: /Trade This Signal/i }));
    expect(onTradeSignal).toHaveBeenCalledWith(sampleSignal);
  });
});
