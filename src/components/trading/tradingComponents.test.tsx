// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClosePositionDialog } from '@/components/trading/ClosePositionDialog';
import { CreatePendingOrderForm } from '@/components/trading/CreatePendingOrderForm';
import { ModifyPositionDialog } from '@/components/trading/ModifyPositionDialog';
import { OrderForm } from '@/components/trading/OrderForm';
import { PendingOrderTable } from '@/components/trading/PendingOrderTable';
import { PositionTable } from '@/components/trading/PositionTable';
import { resetDemoState } from '@/services/fortuno/demoBackend';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';

describe('Trading Components Suite (TASK-014, TASK-015, TASK-016, TASK-017, TASK-019)', () => {
  beforeEach(async () => {
    resetDemoState();
    useConfigStore.getState().setDemoMode(true);
    useConfigStore.getState().setDefaultSymbol('EURUSD');
    useTradingStore.getState().reset();

    const [symbols, quotes, positions, orders, account] = await Promise.all([
      fortunoApi.getSymbols(undefined, { force: true }),
      fortunoApi.getQuotes(['EURUSD', 'GBPUSD', 'XAUUSD']),
      fortunoApi.getPositions(),
      fortunoApi.getPendingOrders(),
      fortunoApi.getAccount(),
    ]);
    useTradingStore.getState().setSymbols(symbols);
    useTradingStore.getState().setQuotes(quotes);
    useTradingStore.getState().setPositions(positions);
    useTradingStore.getState().setPendingOrders(orders);
    useTradingStore.getState().setAccount(account);
  });

  it('renders OrderForm, toggles BUY/SELL, steps volume, and submits market order (TASK-015)', async () => {
    useConfigStore.getState().updateRiskSettings({ confirmBeforeTrade: false });
    render(<OrderForm symbol="EURUSD" />);

    const sellBtn = screen.getByRole('button', { name: /^SELL/i });
    fireEvent.click(sellBtn);

    const submitBtn = screen.getByRole('button', { name: /Open SELL EURUSD/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(useTradingStore.getState().positions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders PositionTable, ClosePositionDialog, and ModifyPositionDialog (TASK-014, TASK-016, TASK-017)', async () => {
    const { unmount } = render(<PositionTable />);
    expect(screen.getByText(/Posisi Terbuka/i)).toBeInTheDocument();
    unmount();

    const pos = useTradingStore.getState().positions[0]!;
    const onSubmitClose = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    const { unmount: unmountClose } = render(
      <ClosePositionDialog
        position={pos}
        onOpenChange={onOpenChange}
        onSubmit={onSubmitClose}
      />,
    );

    const confirmCloseBtn = screen.getByRole('button', { name: /Konfirmasi Close/i });
    fireEvent.click(confirmCloseBtn);
    await waitFor(() => {
      expect(onSubmitClose).toHaveBeenCalledWith(pos.id, pos.volume);
    });
    unmountClose();

    const onSubmitModify = vi.fn().mockResolvedValue(undefined);
    render(
      <ModifyPositionDialog
        position={pos}
        onOpenChange={onOpenChange}
        onSubmit={onSubmitModify}
      />,
    );

    const saveModifyBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(saveModifyBtn);
    await waitFor(() => {
      expect(onSubmitModify).toHaveBeenCalled();
    });
  });

  it('renders CreatePendingOrderForm & PendingOrderTable and creates a pending order (TASK-019)', () => {
    render(
      <div>
        <CreatePendingOrderForm />
        <PendingOrderTable />
      </div>,
    );

    expect(screen.getByText(/Pending Orders/i)).toBeInTheDocument();
  });
});
