'use client';

import * as React from 'react';
import { Check, ShieldAlert, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PendingToolApproval } from '@/types/ai';

export interface TradeConfirmCardProps {
  readonly approval: PendingToolApproval;
  readonly onConfirm: (approval: PendingToolApproval) => void;
  readonly onCancel: (callId: string) => void;
  readonly disabled?: boolean;
}

export function TradeConfirmCard({
  approval,
  onConfirm,
  onCancel,
  disabled = false,
}: TradeConfirmCardProps): React.ReactElement {
  return (
    <div className="my-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-amber-200">
            Konfirmasi Perintah Trading AI
          </span>
        </div>
        {approval.side && (
          <Badge variant={approval.side === 'BUY' ? 'success' : 'danger'}>
            {approval.side}
          </Badge>
        )}
      </div>

      <p className="mt-2 font-mono text-xs text-slate-100">{approval.summary}</p>

      <div className="mt-2 rounded bg-slate-950/70 p-2 font-mono text-[11px] text-slate-300">
        {Object.entries(approval.call.arguments).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-slate-400">{k}:</span>
            <span>{String(v ?? '—')}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onCancel(approval.call.id)}
          className="h-7 px-3 text-xs"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Batalkan
        </Button>
        <Button
          size="sm"
          variant={approval.side === 'SELL' ? 'sell' : 'buy'}
          disabled={disabled}
          onClick={() => onConfirm(approval)}
          className="h-7 px-3 text-xs"
        >
          <Check className="mr-1 h-3.5 w-3.5" />
          Konfirmasi
        </Button>
      </div>
    </div>
  );
}
