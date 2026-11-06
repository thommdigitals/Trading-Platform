'use client';

import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LEDGER_TYPES } from '@/config/market';
import type { LedgerEntry } from '@/types/api';
import type { CsvColumn } from '@/utils/csvExport';
import { formatDateTime } from '@/utils/dateTime';
import { formatMoney, formatSigned } from '@/utils/formatters';

import { ExportButton } from './ExportButton';

export interface LedgerTableProps {
  readonly entries: readonly LedgerEntry[];
  readonly currency?: string;
}

const CSV_COLUMNS: readonly CsvColumn<LedgerEntry>[] = [
  { header: 'ID', value: (r) => r.id },
  { header: 'Type', value: (r) => r.type },
  { header: 'Amount', value: (r) => r.amount },
  { header: 'Balance After', value: (r) => r.balanceAfter ?? '' },
  { header: 'Time', value: (r) => new Date(r.time).toISOString() },
  { header: 'Comment', value: (r) => r.comment },
];

export function LedgerTable({
  entries,
  currency = 'USD',
}: LedgerTableProps): React.ReactElement {
  const [typeFilter, setTypeFilter] = React.useState<string>('ALL');

  const filtered = React.useMemo(() => {
    return [...entries]
      .filter((e) => typeFilter === 'ALL' || e.type.toUpperCase() === typeFilter)
      .sort((a, b) => b.time - a.time);
  }, [entries, typeFilter]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-3">
        <CardTitle className="text-sm font-semibold">
          Ledger History ({filtered.length})
        </CardTitle>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter ledger by operation type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-8 w-40 text-xs py-0.5 px-2"
          >
            <option value="ALL">All Types</option>
            {LEDGER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>

          <ExportButton
            rows={filtered}
            columns={CSV_COLUMNS}
            filenamePrefix="fortuno_ledger"
          />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            No ledger operations found for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Operation Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance After</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs text-slate-400">#{entry.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-xs font-semibold ${
                        entry.amount >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatSigned(entry.amount, 2)} {currency}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-slate-300">
                      {entry.balanceAfter !== null
                        ? formatMoney(entry.balanceAfter, currency)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {formatDateTime(entry.time)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {entry.comment || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

