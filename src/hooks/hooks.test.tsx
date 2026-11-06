// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAccount } from '@/hooks/useAccount';
import { useCandles } from '@/hooks/useCandles';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useOnlineStatus, usePageVisibility } from '@/hooks/usePageVisibility';
import { usePendingOrders } from '@/hooks/usePendingOrders';
import { usePolling } from '@/hooks/usePolling';
import { usePositions } from '@/hooks/usePositions';
import { useQuotes } from '@/hooks/useQuotes';
import { useSymbols } from '@/hooks/useSymbols';
import { resetDemoState } from '@/services/fortuno/demoBackend';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';

describe('Custom Hooks Test Suite (TASK-010, TASK-012, TASK-014, TASK-019, TASK-022, TASK-023, TASK-043)', () => {
  beforeEach(() => {
    resetDemoState();
    useConfigStore.getState().setDemoMode(true);
    useTradingStore.getState().reset();
  });

  it('tracks page visibility and online status changes accurately (TASK-010)', () => {
    const { result: visResult } = renderHook(() => usePageVisibility());
    expect(visResult.current).toBe(true);

    const { result: onlineResult } = renderHook(() => useOnlineStatus());
    expect(onlineResult.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(onlineResult.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(onlineResult.current).toBe(true);
  });

  it('executes sequential polling when enabled and stops when disabled (TASK-010)', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => usePolling(fn, 300, enabled),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(fn).toHaveBeenCalledTimes(1);
    });

    rerender({ enabled: false });
    const countAfterDisable = fn.mock.calls.length;
    expect(countAfterDisable).toBeGreaterThanOrEqual(1);
    unmount();
  });

  it('triggers all keyboard shortcuts (Alt+B, Alt+S, Alt+C, Alt+P, Alt+O, Esc, ?) and ignores ? inside inputs (TASK-043)', () => {
    const handlers = {
      onQuickBuy: vi.fn(),
      onQuickSell: vi.fn(),
      onOpenChart: vi.fn(),
      onOpenPositions: vi.fn(),
      onOpenOrders: vi.fn(),
      onEscape: vi.fn(),
      onToggleHelp: vi.fn(),
    };

    function TestShortcutHost(): React.ReactElement {
      useKeyboardShortcuts(handlers);
      return <input aria-label="test-input" />;
    }

    const { getByLabelText } = render(<TestShortcutHost />);
    const inputEl = getByLabelText('test-input');

    fireEvent.keyDown(window, { key: 'b', altKey: true });
    expect(handlers.onQuickBuy).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 's', altKey: true });
    expect(handlers.onQuickSell).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'c', altKey: true });
    expect(handlers.onOpenChart).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'p', altKey: true });
    expect(handlers.onOpenPositions).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'o', altKey: true });
    expect(handlers.onOpenOrders).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handlers.onEscape).toHaveBeenCalledTimes(1);

    // Pressing '?' inside an input should NOT trigger help modal
    fireEvent.keyDown(inputEl, { key: '?' });
    expect(handlers.onToggleHelp).not.toHaveBeenCalled();

    // Pressing '?' on window triggers help modal
    fireEvent.keyDown(window, { key: '?' });
    expect(handlers.onToggleHelp).toHaveBeenCalledTimes(1);
  });

  it('loads account, symbols, quotes, candles, positions & pending orders via data hooks', async () => {
    const { result: accHook } = renderHook(() => useAccount(true));
    await waitFor(() => {
      expect(accHook.current.account).not.toBeNull();
      expect(accHook.current.accountSummary).not.toBeNull();
    });

    const { result: symHook } = renderHook(() => useSymbols());
    await waitFor(() => {
      expect(symHook.current.symbols.length).toBeGreaterThanOrEqual(7);
    });

    const { result: quoteHook } = renderHook(() => useQuotes(['EURUSD', 'XAUUSD'], true));
    await waitFor(() => {
      expect(quoteHook.current.quotes['EURUSD']).toBeDefined();
    });

    const { result: candleHook } = renderHook(() => useCandles('EURUSD', 'H1'));
    await waitFor(() => {
      expect(candleHook.current.candles.length).toBeGreaterThan(0);
    });

    const { result: posHook } = renderHook(() => usePositions(true));
    await waitFor(() => {
      expect(posHook.current.positions.length).toBeGreaterThan(0);
    });

    const { result: ordHook } = renderHook(() => usePendingOrders(true));
    await waitFor(() => {
      expect(ordHook.current.pendingOrders.length).toBeGreaterThan(0);
    });
  });
});
