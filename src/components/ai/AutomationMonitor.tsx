'use client';

import * as React from 'react';
import { Activity, Eraser, Pause, Play, Square, Terminal } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAutomation } from '@/hooks/useAutomation';
import { formatTime } from '@/utils/dateTime';
import { formatSigned } from '@/utils/formatters';

export function AutomationMonitor(): React.ReactElement {
  const {
    activeStrategy,
    automationStatus,
    automationLog,
    automationStats,
    pauseStrategy,
    resumeStrategy,
    stopStrategy,
    clearLog,
  } = useAutomation();

  const statusBadgeVariant =
    automationStatus === 'running'
      ? 'success'
      : automationStatus === 'paused'
        ? 'warning'
        : automationStatus === 'error'
          ? 'danger'
          : 'secondary';

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400" />
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">
                Live Automation Monitor &amp; Execution Log
              </CardTitle>
              <Badge variant={statusBadgeVariant} className="uppercase">
                {automationStatus}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400">
              {activeStrategy
                ? `${activeStrategy.name} • ${activeStrategy.symbol} (${activeStrategy.interval})`
                : 'No active automation strategy running'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {automationStatus === 'running' && (
            <Button
              size="sm"
              variant="outline"
              onClick={pauseStrategy}
              className="h-8 text-xs"
            >
              <Pause className="mr-1.5 h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          {automationStatus === 'paused' && (
            <Button
              size="sm"
              variant="buy"
              onClick={resumeStrategy}
              className="h-8 text-xs"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Resume
            </Button>
          )}
          {(automationStatus === 'running' || automationStatus === 'paused') && (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void stopStrategy(false)}
                className="h-8 text-xs"
              >
                <Square className="mr-1.5 h-3.5 w-3.5" />
                Stop
              </Button>
              <Button
                size="sm"
                variant="sell"
                onClick={() => void stopStrategy(true)}
                className="h-8 text-xs"
              >
                Stop &amp; Close Positions
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={automationLog.length === 0}
            onClick={clearLog}
            className="h-8 text-xs"
          >
            <Eraser className="mr-1 h-3.5 w-3.5" />
            Clear Log
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0 text-xs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
            <span className="text-[10px] text-slate-400">Executed Trades</span>
            <p className="mt-1 font-mono text-base font-bold text-slate-100">
              {automationStats.totalTrades}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
            <span className="text-[10px] text-slate-400">Session P&amp;L</span>
            <p
              className={`mt-1 font-mono text-base font-bold ${
                automationStats.profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatSigned(automationStats.profitLoss, 2)} USD
            </p>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
            <span className="text-[10px] text-slate-400">Active Positions</span>
            <p className="mt-1 font-mono text-base font-bold text-slate-100">
              {automationStats.activePositions} / {activeStrategy?.maxOpenPositions ?? '—'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3">
            <span className="text-[10px] text-slate-400">Daily Loss Guardrail</span>
            <p className="mt-1 font-mono text-base font-bold text-amber-400">
              Max ${activeStrategy?.maxDailyLoss ?? '—'} ({activeStrategy?.maxDrawdownPercent ?? '—'}% DD)
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
            <Terminal className="h-3.5 w-3.5 text-blue-400" />
            <span>Automation Event Stream ({automationLog.length})</span>
          </div>

          {automationLog.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No automation events logged yet. Activate a strategy above to begin monitoring.
            </p>
          ) : (
            <div className="max-h-64 space-y-1.5 overflow-y-auto font-mono text-[11px]">
              {[...automationLog].reverse().map((entry) => {
                const levelColor =
                  entry.level === 'action'
                    ? 'text-emerald-400'
                    : entry.level === 'warn'
                      ? 'text-amber-400'
                      : entry.level === 'error'
                        ? 'text-rose-400'
                        : 'text-slate-300';
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 rounded bg-slate-900/60 px-2.5 py-1.5"
                  >
                    <span className="shrink-0 text-slate-500">[{formatTime(entry.time)}]</span>
                    <span className={`uppercase font-semibold shrink-0 ${levelColor}`}>
                      [{entry.level}]
                    </span>
                    <span className="text-slate-200 break-words">{entry.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
