'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, LineChart } from 'lucide-react';

import { AccountSummaryWidget } from '@/components/account/AccountSummaryWidget';
import { PortfolioOverview } from '@/components/account/PortfolioOverview';
import { AppLayout } from '@/components/layout/AppLayout';
import { CandleChart } from '@/components/market/CandleChart';
import { WatchlistWidget } from '@/components/market/WatchlistWidget';
import { OrderForm } from '@/components/trading/OrderForm';
import { PendingOrderTable } from '@/components/trading/PendingOrderTable';
import { PositionTable } from '@/components/trading/PositionTable';
import { Button } from '@/components/ui/button';
import { useTradingStore } from '@/store/tradingStore';

export default function DashboardPage(): React.ReactElement {
  const positionsCount = useTradingStore((s) => s.positions.length);
  const ordersCount = useTradingStore((s) => s.pendingOrders.length);

  const [activeTab, setActiveTab] = React.useState<'positions' | 'orders'>('positions');
  const [showChart, setShowChart] = React.useState(true);

  return (
    <AppLayout>
      <div className="space-y-4">
        <AccountSummaryWidget />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <WatchlistWidget />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <LineChart className="h-3.5 w-3.5 text-blue-400" />
                  Live Market Chart Preview
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowChart((s) => !s)}
                  className="h-7 px-2 text-xs"
                >
                  {showChart ? (
                    <>
                      <ChevronUp className="mr-1 h-3.5 w-3.5" /> Hide Chart
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-1 h-3.5 w-3.5" /> Show Chart
                    </>
                  )}
                </Button>
              </div>
              {showChart && <CandleChart height={320} compact />}
            </div>
          </div>

          <div className="space-y-4">
            <OrderForm compact />
            <PortfolioOverview />
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('positions')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'positions'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Open Positions ({positionsCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'orders'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending Orders ({ordersCount})
            </button>
          </div>

          {activeTab === 'positions' ? <PositionTable /> : <PendingOrderTable />}
        </div>
      </div>
    </AppLayout>
  );
}
