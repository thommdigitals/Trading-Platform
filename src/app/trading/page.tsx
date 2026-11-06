'use client';

import * as React from 'react';

import { AppLayout } from '@/components/layout/AppLayout';
import { CandleChart } from '@/components/market/CandleChart';
import { SymbolBrowser } from '@/components/market/SymbolBrowser';
import { TradingHoursInfo } from '@/components/market/TradingHoursInfo';
import { CreatePendingOrderForm } from '@/components/trading/CreatePendingOrderForm';
import { OrderForm } from '@/components/trading/OrderForm';
import { PendingOrderTable } from '@/components/trading/PendingOrderTable';
import { PositionTable } from '@/components/trading/PositionTable';
import { useConfigStore } from '@/store/configStore';
import { useTradingStore } from '@/store/tradingStore';

export default function TradingTerminalPage(): React.ReactElement {
  const selectedSymbol = useConfigStore((s) => s.defaultSymbol);
  const positionsCount = useTradingStore((s) => s.positions.length);
  const ordersCount = useTradingStore((s) => s.pendingOrders.length);

  const [orderTab, setOrderTab] = React.useState<'market' | 'pending'>('market');
  const [bottomTab, setBottomTab] = React.useState<'positions' | 'orders' | 'symbols'>(
    'positions',
  );

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            <CandleChart height={440} />
            <TradingHoursInfo symbol={selectedSymbol} />
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
              <button
                type="button"
                onClick={() => setOrderTab('market')}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  orderTab === 'market'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Market Order
              </button>
              <button
                type="button"
                onClick={() => setOrderTab('pending')}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  orderTab === 'pending'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Pending Order
              </button>
            </div>

            {orderTab === 'market' ? <OrderForm /> : <CreatePendingOrderForm />}
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setBottomTab('positions')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                bottomTab === 'positions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Open Positions ({positionsCount})
            </button>
            <button
              type="button"
              onClick={() => setBottomTab('orders')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                bottomTab === 'orders'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending Orders ({ordersCount})
            </button>
            <button
              type="button"
              onClick={() => setBottomTab('symbols')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                bottomTab === 'symbols'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Instruments Catalog
            </button>
          </div>

          {bottomTab === 'positions' && <PositionTable />}
          {bottomTab === 'orders' && <PendingOrderTable />}
          {bottomTab === 'symbols' && (
            <SymbolBrowser onSelectTrade={() => setOrderTab('market')} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}

