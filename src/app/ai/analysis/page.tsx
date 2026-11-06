'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { MarketAnalysisPanel } from '@/components/ai/MarketAnalysisPanel';
import { MultiSignalGrid } from '@/components/ai/MultiSignalGrid';
import { AppLayout } from '@/components/layout/AppLayout';
import { useConfigStore } from '@/store/configStore';
import type { AnalysisResult } from '@/types/ai';

export default function AIAnalysisPage(): React.ReactElement {
  const router = useRouter();
  const setDefaultSymbol = useConfigStore((s) => s.setDefaultSymbol);

  const handleTradeSignal = (result: AnalysisResult): void => {
    setDefaultSymbol(result.symbol);
    router.push(`/trading?symbol=${encodeURIComponent(result.symbol)}&side=${result.signal}`);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <MarketAnalysisPanel onTradeSignal={handleTradeSignal} />
        <MultiSignalGrid onTradeSignal={handleTradeSignal} />
      </div>
    </AppLayout>
  );
}
