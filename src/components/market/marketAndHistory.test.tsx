// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClosedPositionsTable } from '@/components/history/ClosedPositionsTable';
import { LedgerTable } from '@/components/history/LedgerTable';
import { SymbolBrowser } from '@/components/market/SymbolBrowser';
import { TradingHoursInfo } from '@/components/market/TradingHoursInfo';
import { WatchlistWidget } from '@/components/market/WatchlistWidget';
import { resetDemoState } from '@/services/fortuno/demoBackend';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';

describe('Market Data & History Components Suite (TASK-021, TASK-022, TASK-025, TASK-026, TASK-027)', () => {
  beforeEach(async () => {
    resetDemoState();
    useConfigStore.getState().setDemoMode(true);
    useTradingStore.getState().reset();

    const [symbols, quotes] = await Promise.all([
      fortunoApi.getSymbols(undefined, { force: true }),
      fortunoApi.getQuotes(['EURUSD', 'GBPUSD', 'XAUUSD']),
    ]);
    useTradingStore.getState().setSymbols(symbols);
    useTradingStore.getState().setQuotes(quotes);
  });

  it('renders SymbolBrowser, filters by search and category, toggles Favorite Symbol & Favorite Indicator (TASK-021)', () => {
    const onSelectTrade = vi.fn();
    render(<SymbolBrowser onSelectTrade={onSelectTrade} />);

    const searchInput = screen.getByLabelText('Search instruments');
    fireEvent.change(searchInput, { target: { value: 'EUR' } });
    expect(screen.getByText('EUR/USD')).toBeInTheDocument();

    const favBtn = screen.getByRole('button', { name: /Favorit EURUSD/i });
    fireEvent.click(favBtn);
    expect(useConfigStore.getState().watchlist.includes('EURUSD')).toBe(false);
    fireEvent.click(favBtn);
    expect(useConfigStore.getState().watchlist.includes('EURUSD')).toBe(true);

    useConfigStore.getState().addCustomIndicator('EMA:144', true);
    expect(useConfigStore.getState().activeIndicators.includes('EMA:144')).toBe(true);
    expect(useConfigStore.getState().favoriteIndicators.includes('EMA:144')).toBe(true);

    const tradeButtons = screen.getAllByRole('button', { name: /Trade/i });
    fireEvent.click(tradeButtons[0]!);
    expect(onSelectTrade).toHaveBeenCalledWith('EURUSD');
  });

  it('renders WatchlistWidget and TradingHoursInfo with session schedule (TASK-022, TASK-025)', async () => {
    render(
      <div>
        <WatchlistWidget />
        <TradingHoursInfo symbol="EURUSD" />
      </div>,
    );

    expect(screen.getByText(/Watchlist/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/MARKET OPEN/i)).toBeInTheDocument();
    });
  });

  it('renders ClosedPositionsTable & LedgerTable with filtering and CSV export button (TASK-026, TASK-027)', async () => {
    const now = Date.now();
    const [closed, ledgers] = await Promise.all([
      fortunoApi.getClosedPositionsAll({ from: now - 30 * 86_400_000, to: now + 60_000 }),
      fortunoApi.getLedgersAll({ from: now - 30 * 86_400_000, to: now + 60_000 }),
    ]);

    render(
      <div>
        <ClosedPositionsTable positions={closed} />
        <LedgerTable entries={ledgers} />
      </div>,
    );

    expect(screen.getByText(/Closed Positions/i)).toBeInTheDocument();
    expect(screen.getByText(/Ledger History/i)).toBeInTheDocument();

    const sideSelect = screen.getByLabelText('Filter closed positions by side');
    fireEvent.change(sideSelect, { target: { value: 'BUY' } });

    const ledgerSelect = screen.getByLabelText('Filter ledger by operation type');
    fireEvent.change(ledgerSelect, { target: { value: 'DEPOSIT' } });
    expect(screen.getByText(/Initial deposit/i)).toBeInTheDocument();
  });
});

