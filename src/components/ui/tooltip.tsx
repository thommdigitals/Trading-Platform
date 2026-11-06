'use client';

import * as React from 'react';
import { cn } from '@/utils/cn';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex items-center', className)} title={content}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-slate-100 opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 dark:bg-slate-800"
      >
        {content}
      </span>
    </span>
  );
}

