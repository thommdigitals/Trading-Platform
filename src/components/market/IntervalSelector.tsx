'use client';

import * as React from 'react';

import { CANDLE_INTERVALS } from '@/config/market';
import type { CandleInterval } from '@/types/api';
import { cn } from '@/utils/cn';

export interface IntervalSelectorProps {
  readonly value: CandleInterval;
  readonly onChange: (interval: CandleInterval) => void;
  readonly className?: string;
}

export function IntervalSelector({
  value,
  onChange,
  className,
}: IntervalSelectorProps): React.ReactElement {
  return (
    <div
      role="group"
      aria-label="Chart timeframe interval"
      className={cn(
        'inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-900/80 p-1',
        className,
      )}
    >
      {CANDLE_INTERVALS.map((interval) => {
        const active = value === interval;
        return (
          <button
            key={interval}
            type="button"
            onClick={() => onChange(interval)}
            aria-pressed={active}
            className={cn(
              'rounded px-2 py-1 font-mono text-[11px] font-semibold transition-colors',
              active
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
          >
            {interval}
          </button>
        );
      })}
    </div>
  );
}
