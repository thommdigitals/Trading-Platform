'use client';

import * as React from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { type CsvColumn, downloadCsv, toCsv } from '@/utils/csvExport';

export interface ExportButtonProps<T> {
  readonly rows: readonly T[];
  readonly columns: readonly CsvColumn<T>[];
  readonly filenamePrefix: string;
  readonly label?: string;
}

export function ExportButton<T>({
  rows,
  columns,
  filenamePrefix,
  label = 'Export CSV',
}: ExportButtonProps<T>): React.ReactElement {
  const handleExport = (): void => {
    const csv = toCsv(rows, columns);
    const dateStamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`${filenamePrefix}_${dateStamp}.csv`, csv);
  };

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={rows.length === 0}
      onClick={handleExport}
      aria-label={label}
      className="h-8 text-xs"
    >
      <Download className="mr-1.5 h-3.5 w-3.5" />
      {label} ({rows.length})
    </Button>
  );
}

