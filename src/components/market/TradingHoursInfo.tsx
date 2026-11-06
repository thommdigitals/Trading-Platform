'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fortunoApi } from '@/services/fortunoApi';
import { useConfigStore } from '@/store/configStore';
import type { TradingHours } from '@/types/api';

export interface TradingHoursInfoProps {
  readonly symbol: string;
}

export function TradingHoursInfo({ symbol }: TradingHoursInfoProps): React.ReactElement {
  const apiToken = useConfigStore((s) => s.apiToken);
  const demoMode = useConfigStore((s) => s.demoMode);
  const [hours, setHours] = React.useState<TradingHours | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!apiToken && !demoMode) return;
    let cancelled = false;
    setIsLoading(true);
    fortunoApi
      .getTradingHours(symbol)
      .then((res) => {
        if (!cancelled) setHours(res);
      })
      .catch(() => {
        if (!cancelled) setHours(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, apiToken, demoMode]);

  const isSessionOpen = hours?.isCurrentlyOpen ?? true;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          <CardTitle className="text-xs font-semibold text-slate-200">
            Session Schedule ({symbol.replace(/\.pro$/i, '')})
          </CardTitle>
        </div>
        <Badge variant={isSessionOpen ? 'success' : 'warning'} className="text-[10px]">
          {isSessionOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
        </Badge>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-0">
        {isLoading ? (
          <p className="text-[11px] text-slate-400">Loading session hours…</p>
        ) : !hours || hours.sessions.length === 0 ? (
          <p className="text-[11px] text-slate-400">24/5 Continuous Trading Session (UTC)</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {hours.sessions.map((session, idx) => (
              <div
                key={`${session.dayOfWeek}-${idx}`}
                className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[10px] font-mono text-slate-300"
              >
                <span className="font-semibold text-slate-100">{session.dayOfWeek}:</span>{' '}
                {session.open}–{session.close}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
